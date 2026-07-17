use image::{
    codecs::jpeg::JpegEncoder, imageops::FilterType, DynamicImage, GenericImageView, ImageFormat,
};
use std::io::Cursor;

const JPEG_THUMBNAIL_QUALITY: u8 = 82;
const JPEG_PUBLIC_QUALITY: u8 = 92;

/// 生成缩略图
///
/// 目标尺寸：400x400（保持比例）
pub fn generate_thumbnail(image_data: &[u8], max_size: u32) -> Result<Vec<u8>, String> {
    // 加载图片
    let img = image::load_from_memory(image_data)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    // 计算缩略图尺寸（保持比例）
    let (width, height) = img.dimensions();
    let thumbnail = if width > max_size || height > max_size {
        img.resize(max_size, max_size, FilterType::Lanczos3)
    } else {
        img
    };

    // 编码为固定质量的 JPEG，避免依赖 image crate 的默认质量。
    let mut buffer = Vec::new();
    let thumbnail_rgb = thumbnail.to_rgb8();
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, JPEG_THUMBNAIL_QUALITY);
    encoder
        .encode_image(&thumbnail_rgb)
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    Ok(buffer)
}

/// 检测图片格式并返回 MIME type
pub fn detect_image_format(data: &[u8]) -> Result<String, String> {
    let format = image::guess_format(data)
        .map_err(|e| format!("Failed to detect image format: {}", e))?;

    let mime = match format {
        ImageFormat::Png => "image/png",
        ImageFormat::Jpeg => "image/jpeg",
        ImageFormat::Gif => "image/gif",
        ImageFormat::WebP => "image/webp",
        _ => return Err("Unsupported image format".to_string()),
    };

    Ok(mime.to_string())
}

/// 获取图片尺寸
pub fn get_image_dimensions(data: &[u8]) -> Result<(u32, u32), String> {
    let img = image::load_from_memory(data)
        .map_err(|e| format!("Failed to load image: {}", e))?;

    Ok(img.dimensions())
}

/// Prepare bytes that are safe to publish as the public original.
///
/// JPEG and PNG are re-encoded so EXIF/XMP/GPS and similar metadata are dropped.
/// Animated GIF/WebP keep original container bytes so frame animation is not lost;
/// those formats rarely embed GPS-style EXIF the way camera JPEGs do.
pub fn prepare_public_original(
    image_data: &[u8],
    content_type: &str,
) -> Result<(Vec<u8>, &'static str), String> {
    match content_type {
        "image/jpeg" => {
            let img = load_image(image_data)?;
            Ok((encode_jpeg(&img, JPEG_PUBLIC_QUALITY)?, "image/jpeg"))
        }
        "image/png" => {
            let img = load_image(image_data)?;
            let mut buffer = Vec::new();
            img.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
                .map_err(|e| format!("Failed to encode public PNG: {}", e))?;
            Ok((buffer, "image/png"))
        }
        "image/gif" | "image/webp" => Ok((image_data.to_vec(), content_type_static(content_type)?)),
        _ => Err(format!(
            "Unsupported content type for public original: {}",
            content_type
        )),
    }
}

fn content_type_static(content_type: &str) -> Result<&'static str, String> {
    match content_type {
        "image/gif" => Ok("image/gif"),
        "image/webp" => Ok("image/webp"),
        "image/jpeg" => Ok("image/jpeg"),
        "image/png" => Ok("image/png"),
        _ => Err(format!("Unsupported content type: {}", content_type)),
    }
}

fn load_image(image_data: &[u8]) -> Result<DynamicImage, String> {
    image::load_from_memory(image_data).map_err(|e| format!("Failed to load image: {}", e))
}

fn encode_jpeg(img: &DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    let mut buffer = Vec::new();
    let rgb = img.to_rgb8();
    let mut encoder = JpegEncoder::new_with_quality(&mut buffer, quality);
    encoder
        .encode_image(&rgb)
        .map_err(|e| format!("Failed to encode public JPEG: {}", e))?;
    Ok(buffer)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::DynamicImage;

    #[test]
    fn test_generate_thumbnail() {
        // 创建一个简单的测试图片（1x1 白色像素）
        let img = DynamicImage::new_rgb8(1, 1);
        let mut buffer = Vec::new();
        img.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
            .unwrap();

        // 生成缩略图
        let thumbnail = generate_thumbnail(&buffer, 400).unwrap();

        // 验证缩略图可以加载
        assert!(image::load_from_memory(&thumbnail).is_ok());
        assert_eq!(&thumbnail[..2], &[0xFF, 0xD8]);
        assert_eq!(image::guess_format(&thumbnail).unwrap(), ImageFormat::Jpeg);
    }

    #[test]
    fn test_generate_thumbnail_from_alpha_image() {
        let img = DynamicImage::new_rgba8(2, 2);
        let mut buffer = Vec::new();
        img.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)
            .unwrap();

        let thumbnail = generate_thumbnail(&buffer, 400).unwrap();
        let decoded = image::load_from_memory(&thumbnail).unwrap();

        assert_eq!(decoded.color().channel_count(), 3);
    }

    #[test]
    fn test_detect_image_format() {
        // PNG 魔数
        let png_data = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        assert_eq!(detect_image_format(&png_data).unwrap(), "image/png");

        // JPEG 魔数
        let jpeg_data = vec![0xFF, 0xD8, 0xFF];
        assert_eq!(detect_image_format(&jpeg_data).unwrap(), "image/jpeg");
    }

    #[test]
    fn prepare_public_original_reencodes_jpeg_without_exif_app1() {
        // Minimal JPEG with APP1 EXIF marker after SOI.
        // FF D8 SOI, FF E1 APP1 with short payload, then a tiny baseline frame is hard-coded.
        // We build via image crate then inject an APP1 segment.
        let img = DynamicImage::new_rgb8(2, 2);
        let jpeg = encode_jpeg(&img, 90).unwrap();
        assert_eq!(&jpeg[..2], &[0xFF, 0xD8]);

        // Insert a fake APP1 segment after SOI: FF E1 00 08 + "Exif\0\0"
        let mut with_exif = Vec::new();
        with_exif.extend_from_slice(&jpeg[..2]);
        with_exif.extend_from_slice(&[0xFF, 0xE1, 0x00, 0x08, b'E', b'x', b'i', b'f', 0, 0]);
        with_exif.extend_from_slice(&jpeg[2..]);
        assert!(with_exif.windows(4).any(|w| w == b"Exif"));

        let (cleaned, content_type) = prepare_public_original(&with_exif, "image/jpeg").unwrap();
        assert_eq!(content_type, "image/jpeg");
        assert_eq!(&cleaned[..2], &[0xFF, 0xD8]);
        assert!(!cleaned.windows(4).any(|w| w == b"Exif"));
        assert!(image::load_from_memory(&cleaned).is_ok());
    }

    #[test]
    fn prepare_public_original_keeps_gif_bytes() {
        let gif = [
            0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x3B,
        ];
        let (out, content_type) = prepare_public_original(&gif, "image/gif").unwrap();
        assert_eq!(content_type, "image/gif");
        assert_eq!(out, gif);
    }
}
