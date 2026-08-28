// Architecture V3 S2 backfill: give legacy works a media_assets identity.
//
// Approved works copy their objects into the immutable public/{uuid}/v1/...
// namespace (legacy keys are kept during the dual-read window). Pending and
// rejected works move to private/{uuid}/... and their legacy publicly
// reachable objects are deleted, closing the pre-S2 exposure gap.

use sqlx::Row;
use uuid::Uuid;

use crate::{media, storage};

pub async fn run(db: &crate::db::DbPool, s3: &aws_sdk_s3::Client) -> Result<(), String> {
    let bucket = storage::s3_bucket();
    let rows = sqlx::query(
        "SELECT w.id, w.uploader_id, w.status::TEXT AS status, w.asset_file, w.width, w.height
         FROM works w
         WHERE w.media_id IS NULL
           AND w.gallery IN ('meme'::gallery_kind, 'art'::gallery_kind)
           AND w.status <> 'takedown'::work_status
         ORDER BY w.created_at",
    )
    .fetch_all(db)
    .await
    .map_err(|e| format!("list legacy works: {}", e))?;

    let mut migrated = 0u32;
    let mut failed = 0u32;

    for row in &rows {
        let work_id: String = row.try_get("id").unwrap_or_default();
        let status: String = row.try_get("status").unwrap_or_default();
        let uploader_id: Option<i64> = row.try_get("uploader_id").ok();
        let asset_file: Option<String> = row.try_get("asset_file").ok();
        let width: i32 = row.try_get("width").unwrap_or(0);
        let height: i32 = row.try_get("height").unwrap_or(0);

        let (Some(uploader_id), Some(asset_file)) = (uploader_id, asset_file) else {
            tracing::warn!(work_id = %work_id, "skipping work without uploader or asset_file");
            failed += 1;
            continue;
        };

        let ext = asset_file.rsplit('.').next().unwrap_or("jpg").to_string();
        let mime = media::mime_for_extension(&ext);
        let legacy_original = format!("{}.{}", work_id, ext);
        let legacy_thumb = format!("{}_thumb.jpg", work_id);

        let media_id = Uuid::new_v4();
        let approved = status == "approved";
        let (dst_original, dst_thumb, state) = if approved {
            (
                media::public_original_key(&media_id, 1, &ext),
                media::public_thumb_key(&media_id, 1),
                "public",
            )
        } else {
            (
                media::private_original_key(&media_id, &ext),
                media::private_thumb_key(&media_id),
                "pending",
            )
        };

        let mut copied: Vec<String> = Vec::new();
        let mut copy_failed = false;
        for (src, dst) in [
            (&legacy_original, &dst_original),
            (&legacy_thumb, &dst_thumb),
        ] {
            if let Err(error) = storage::copy_object(s3, &bucket, src, dst).await {
                tracing::warn!(work_id = %work_id, error = %error, "backfill copy failed");
                storage::delete_files_best_effort(s3, &bucket, &copied).await;
                copy_failed = true;
                break;
            }
            copied.push(dst.clone());
        }
        if copy_failed {
            failed += 1;
            continue;
        }

        let result = async {
            let mut tx = db.begin().await.map_err(|e| e.to_string())?;
            sqlx::query(
                "INSERT INTO media_assets (id, owner_id, state, mime_type, original_key, thumb_key, width, height)
                 VALUES ($1, $2, $3::media_asset_state, $4, $5, $6, $7, $8)",
            )
            .bind(media_id)
            .bind(uploader_id)
            .bind(state)
            .bind(mime)
            .bind(if approved { &legacy_original } else { &dst_original })
            .bind(if approved { &legacy_thumb } else { &dst_thumb })
            .bind(width.max(1))
            .bind(height.max(1))
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

            sqlx::query("UPDATE works SET media_id = $1, updated_at = NOW() WHERE id = $2")
                .bind(media_id)
                .bind(&work_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;

            tx.commit().await.map_err(|e| e.to_string())
        }
        .await;

        if let Err(error) = result {
            tracing::warn!(work_id = %work_id, error = %error, "backfill db update failed");
            storage::delete_files_best_effort(s3, &bucket, &copied).await;
            failed += 1;
            continue;
        }

        // Pending/rejected works must stop being publicly reachable: their
        // original_key now points at private/..., delete the legacy objects.
        // Approved works keep legacy objects for the old-URL dual-read window.
        if !approved {
            storage::delete_files_best_effort(
                s3,
                &bucket,
                &[legacy_original.clone(), legacy_thumb.clone()],
            )
            .await;
        }

        migrated += 1;
    }

    println!(
        "backfill-media: migrated {} work(s), {} failure(s), {} examined",
        migrated,
        failed,
        rows.len()
    );
    if failed > 0 {
        return Err(format!("{} work(s) failed to backfill; re-run after fixing", failed));
    }
    Ok(())
}
