# hasu-gallery Evolution Roadmap

**Project**: hasu-gallery (新仓独立项目)  
**Vision**: Multi-content UGC platform for Meme, Art, and Fiction with publishing, moderation, and reading
**Created**: 2026-06-09
**Last Synced**: 2026-07-18

**Status**: ✅ Phase 1-5 已完成；Architecture V2 已被 V3 取代（2026-08-28）；V3 S1 已落地

> **架构更新 (2026-06-14)**: 基于 linkura-apps 分析，采用 Rspack + TanStack Router/Query + zustand + Tailwind v4 技术栈
>
> **Architecture V2 决策 (2026-07-18)**: 保持现有前端技术栈，生产形态迁移为
> 单个 Rust 可执行文件内嵌 SPA、同源 HTTP + Protobuf API、托管 PostgreSQL、
> 外部 S3/R2、UUIDv4 媒体 URL、私有审核媒体与 CDN 公开净化变体；同时新增
> Fiction 一等内容域，以 PostgreSQL 保存安全文本、草稿/审核修订与系列关系。
>
> **Architecture V3 决策 (2026-08-28)**: 基于第一性原理复审，V2 的 Protobuf
> 传输层与企业级边缘/媒体范围被判定为非承载复杂度。V3 收敛为单一 JSON 契约 +
> 单二进制 galleryd + 私有媒体/UUIDv4 公开 URL + 集中策略层，迁移压缩为
> S1–S3 三个 slice。权威设计见 `.ccg/spec/architecture-v3.md`；
> `architecture-v2.md` 已标记 superseded 并保留作历史。

---

## 状态快照（Phase baseline 2026-07-06；Architecture V2 2026-07-18）

> Phase 1-5 状态由 `master` 分支 + `backend/src/` + `apps/web/src/` +
> 2026-07-06 真实浏览器回归客观核对；Architecture V2 行仅表示 2026-07-18
> 已批准设计已落盘；Slice A foundation 已入仓，业务运行时仍以 JSON API 为准。

| Phase | 路线图声明 | 实际代码状态 | 差距 |
|---|---|---|---|
| **0: Foundation & Design** | ✅ COMPLETE | ✅ 规范文件已落地（`.ccg/spec/phase0-content-core-model.md`），决策表完整 | — |
| **1.1 Postgres 迁移** | ✅ COMPLETE | ✅ `backend/migrations/001_initial.sql` 已部署（9 表 + 5 枚举 + 2 触发器），边缘服务器 `edge-db-host:5432` 运行中 | — |
| **1.2 认证系统** | ✅ COMPLETE | ✅ argon2id + tower-sessions（PostgreSQL 存储），4 个 API 端点（register/login/logout/me） | — |
| **1.3 上传流水线** | ✅ COMPLETE | ✅ S3/MinIO 上传 + 缩略图生成（400x400 Lanczos3）+ multipart 验证，Nginx 公开代理 `http://127.0.0.1:8787/media/` | — |
| **1.4 模块化 main.rs** | ✅ COMPLETE | ✅ `backend/src/` 已模块化：`auth.rs`、`db.rs`、`storage.rs`、`image_processor.rs`、`models/`、`routes/` | — |
| **2.1 认证界面** | ✅ COMPLETE | ✅ LoginPage + RegisterPage + AuthGuard（543 行）| — |
| **2.2 作品列表页** | ✅ COMPLETE | ✅ GalleryPage + WorksGrid + FilterPanel + Pagination（575 行），后端 `GET /api/works` | — |
| **2.3 作品详情页** | ✅ COMPLETE | ✅ WorkDetailPage（277 行），后端 `GET /api/works/:id` | — |
| **2.4 上传界面** | ✅ COMPLETE | ✅ UploadPage + FileDropZone + ImagePreview + UploadForm（558 行） | — |
| **2.5 用户个人页** | ✅ COMPLETE | ✅ ProfilePage + StatsCard + MyWorksList（609 行），后端 `GET /api/users/me/{stats,works}` | — |
| **3.1 审核队列 API** | ✅ COMPLETE | ✅ middleware.rs + routes/moderation.rs（300 行），3 个 API 端点 | — |
| **3.2 审核仪表板** | ✅ COMPLETE | ✅ ModerationPage + ModerationActions + ModerationLog（524 行）| — |
| **4: Art Gallery** | ✅ BASELINE COMPLETE | ✅ Baseline launch 已验证：Meme/Art 导航、Art upload metadata、rating 筛选、`work_art_meta` 写入、MinIO 上传成功路径与审核发布均通过真实浏览器验收 | 自动化 E2E 与 production hardening 已转入 Phase 5 |
| **5: Polish & Hardening** | ✅ COMPLETE | ✅ Art polish、轻量 CI、后端测试、安全加固、性能索引/媒体优化、部署/审核/监控文档与监控摘要 API 均已落地；Playwright E2E 作为本地脚本保留 | 后续仅剩外部 APM/Sentry、发布自动化与前端组件测试等增强项 |
| **Architecture V2→V3 migration track** | V3 APPROVED / S1–S3 ✅ | ✅ 单一 JSON 契约 + galleryd 单二进制 + Fiction 域 + 私有媒体/UUIDv4 + 策略层/安全头/ETag | 生产切换（ops runbook 已备）+ 双读窗口清理 |

**Phase 2 总计**: +2,562 行前端代码，11 个 API 端点，完整的画廊浏览和上传功能。

**Phase 3 总计**: +824 行代码（后端 300 行 + 前端 524 行），审核工作流完整实现。

**2026-07-03 回归补强**: 修复根目录启动后端 env 加载、注册 session 同步、前端 auth 竞态、favicon 路径、审核页权限请求边界、Postgres enum 解码、开发代理本机连接稳定性，并补写 `reviewed_by/reviewed_at/review_note`。真实浏览器验收已覆盖注册、MinIO 上传、owner pending 详情、审核批准、公开画廊、Art rating 筛选、个人页统计与审核日志。

**2026-07-06 Phase 5 首个切片**: 新增 Art facets API 与前端消费链路，`GET /api/works/facets?gallery=art` 返回 artist/medium/rating 聚合计数；Art 筛选面板显示 rating 计数并为 artist/medium 提供现有数据建议。已验证 `pnpm typecheck`、`cargo check --manifest-path backend/Cargo.toml`、真实 API 返回与 Playwright 浏览器筛选行为。

**2026-07-07 自动化验收切片**: 引入 `@playwright/test` 与 root `pnpm e2e` 本地脚本，新增 Art Gallery E2E：mock API 响应覆盖 facets 计数、rating 切换、`hasu-gallery-preferences` 持久化与 reload 恢复。CI 保持轻量，E2E 暂不纳入 GitHub Actions。

**2026-07-07 后端边界测试切片**: 为 `GET /api/works/facets` 补充 HTTP 级后端测试，覆盖非 Art gallery 拒绝、非法 status 拒绝，以及未登录访问 pending facets 返回 401。测试使用内存 session 与 lazy Postgres pool，不依赖当前远端数据库可用性。

**2026-07-07 上传/审核 E2E 切片**: 新增本地 Playwright smoke，使用 mock API 串起 Art 上传提交、pending 审核队列展示、审核批准与队列刷新为空。E2E 继续保持本地脚本，不进入 CI。

**2026-07-07 上传输入校验切片**: 后端上传入口补齐服务端字段规范化：必填字段 trim 后校验、标题/artist/medium/source/source_url 长度限制，以及 source_url 必须为绝对 HTTP(S) URL；新增纯单元测试覆盖边界。

**2026-07-07 登录/上传限流切片**: 新增轻量内存限流 middleware，并挂载到 `POST /api/auth/login` 与 `POST /api/works/upload`；默认登录每分钟 10 次、上传每小时 20 次，按 forwarded/client 指纹 + 方法 + 路径分桶，超限返回 429。

**2026-07-07 CSRF 来源校验切片**: 新增 Origin/Referer guard，复用 `CORS_ALLOWED_ORIGINS` 作为可信浏览器来源列表；非安全方法在携带不可信浏览器来源时返回 403，无来源头的脚本/服务端调用保持兼容。

**2026-07-07 上传扩展名限制切片**: 后端上传入口读取 multipart 原始文件名，并在 magic byte MIME 检测后校验扩展名白名单；`.png/.jpg/.jpeg/.gif/.webp` 必须与检测出的图片类型匹配。

**2026-07-07 SQL 注入防护审计切片**: 将作品列表 `sort` 到 `ORDER BY` 的映射收紧为静态 SQL 白名单 helper，并补测试覆盖注入式 sort 被拒绝；筛选值继续通过 sqlx bind 绑定。

**2026-07-07 认证输入规范化切片**: 注册/登录请求在 validator 前统一规范化，handle/display_name/email 去除首尾空白，email 转小写，password 保持原样；新增单元测试覆盖规范化与校验顺序。

**2026-07-07 数据库索引切片**: 新增 `002_performance_indexes.sql`，覆盖 gallery/status/created_at、gallery/status/title、uploader/created_at 与 Art metadata facets/filter 索引；审核队列查询改为 enum 参数 cast，避免 `gallery::TEXT/status::TEXT` 绕开索引。

**2026-07-07 缩略图编码切片**: 缩略图生成改为显式 `JpegEncoder::new_with_quality(..., 82)` 并统一转 RGB，避免默认 JPEG 质量不可控，同时覆盖 alpha PNG 输入测试。当前 `image` crate 未提供 progressive JPEG encoder 开关，progressive 可在后续通过专用 encoder/CDN 处理。

**2026-07-07 前端懒加载切片**: Gallery/Home 已使用 lazy image；个人页 `MyWorksList` 从 CSS background-image 改为 `<img loading="lazy" decoding="async">`，让缩略图加载行为统一受浏览器懒加载控制。

**2026-07-07 CDN base URL 切片**: 统一 `PUBLIC_MEDIA_BASE_URL` 解析到 `storage::public_media_base_url()`，上传返回 URL 与作品列表/详情 URL 共用同一 CDN base，默认值为 `http://127.0.0.1:8787/media` 并自动去除尾斜杠。

**2026-07-07 审核逻辑测试切片**: moderation queue 参数校验、状态流转目标校验与 review note 规范化抽成纯函数并补单元测试；review note 现在 trim 后入库，空白 note 转为 `NULL`，长度限制 1000 字符。

**2026-07-07 轻量 CI 迁移切片**: GitHub Actions 后端任务仍只跑 Postgres + `cargo test`，但数据库初始化从硬编码 `001_initial.sql` 改为按顺序执行 `backend/migrations/*.sql`，避免新增迁移后 CI schema 落后；E2E 继续只作为本地脚本。

**2026-07-07 API 集成测试切片**: 新增可选 Postgres HTTP 集成测试，CI 设置 `DATABASE_URL` 时会插入唯一 Art seed 数据并通过 `GET /api/works/facets?gallery=art` 验证 artist/medium 聚合计数；本地无 `DATABASE_URL` 时快速跳过真实 DB 部分。

**2026-07-07 文档切片**: 新增 `docs/api.md`、`docs/deployment.md`、`docs/moderation-guidelines.md`、`docs/user-guide.md`，并在 README 增加文档入口；覆盖 API 契约、部署环境变量/迁移/CDN、本地 E2E、审核政策与上传指南。

**2026-07-07 基础可观测性切片**: 新增全局 request observability middleware，记录 method/path/status/duration，并为响应附加 `x-request-duration-ms`；为后续 Sentry/APM 与指标采集保留统一入口。

**2026-07-07 监控摘要 API 切片**: 新增 moderator/admin 保护的 `GET /api/monitoring/summary`，返回 total uploads、approved uploads、pending backlog、upload success rate 与按 gallery 分组的 pending backlog；API 文档同步记录响应结构。

**2026-07-07 监控 Runbook 切片**: 新增 `docs/monitoring.md`，覆盖 request duration 日志/响应头、错误追踪日志接入、`GET /api/monitoring/summary` 运维探针、Postgres `pg_stat_statements` 查询 profiling 与发布后检查。

**2026-07-18 Architecture V2 设计切片**: 新增
`.ccg/spec/architecture-v2.md`，锁定单二进制模块化单体、普通 HTTP +
Protobuf `/api/v2`、托管 PostgreSQL、外部 S3/R2、UUIDv4 公共媒体 URL、
私有原图/审核链路、Fiction 安全文本/草稿/修订/系列模型、集中权限策略、
1C512M 资源预算与 A-G 迁移 slices。此切片只更新设计和入口文档，不代表 V2
运行时代码或 Fiction 服务已经实现。
**2026-07-18 Architecture V2 Slice A foundation**: 新增
`proto/hasu/gallery/v2/{common,fiction}.proto`、backend prost `build.rs`、
`galleryd` CLI（serve/migrate/doctor/media-worker stub）、嵌入 SPA 回退
（`backend/embedded-web` + sync 脚本）、`GET /api/v2/public/health` 与
Protobuf 错误/媒体类型管线、`packages/proto` TypeScript 契约镜像。现有
JSON 路由与 Meme/Art 行为保持不变；Fiction DB/业务与媒体 UUID 不在本切片。

**2026-07-18 Architecture V2 Slice B public read path**: 新增
`proto/.../works.proto` 与 `GET /api/v2/public/works`、`/works/:id`、`/works/facets`。
公共端点固定 approved + Art all_ages，不读 cookie；JSON API 与前端仍保持现有路径。

**2026-07-18 Architecture V2 Slice C Fiction foundation**: 新增
`003_fiction_foundation.sql`、HFM safe-markup、draft/submit/atomic publish 领域服务，
以及 public/account/moderation Fiction Protobuf 路由。公开仅可读已发布 revision；
草稿/审核副本 no-store。Meme/Art JSON 行为保持不变。

**2026-07-20 Fiction migration split**: PostgreSQL requires gallery_kind=fiction ADD VALUE to commit before use. Applied as 003_fiction_gallery_kind + 004_fiction_foundation + 005_fiction_revision_metadata.

**2026-07-18 Architecture V2 Slice C Fiction SPA consumer**: 前端接入
`/api/v2` Fiction 公共列表/详情、作者草稿工作台、修订元数据隔离（004 迁移）与
审核队列；公开仅 all-ages 已发布 revision。Meme/Art JSON 路径保持不变。

**2026-08-28 Architecture V3 决策切片**: 对 V2 做整体可行性/复杂度复审后批准
`.ccg/spec/architecture-v3.md`：移除 Protobuf 传输（收敛为单一 JSON 契约）、
上传保持服务端流式代理、私有审核媒体改用 presigned GET、媒体变体收敛为
净化原图 + 缩略图、企业级边缘/MFA/SBOM 等降级为 hardening backlog；迁移
计划压缩为 S1（单一 JSON 契约）、S2（私有媒体 + UUIDv4 公开 URL）、
S3（策略层收敛 + 安全头 + 单二进制切换）。

**2026-08-28 Architecture V3 S1 单一 JSON 契约切片**: Fiction
public/account/moderation 路由移植为 JSON（`backend/src/routes/fiction.rs`，
路径 `/api/fictions*`、`/api/users/me/fictions*`、`/api/moderation/fictions*`，
领域层 `fiction::service` 不变，发布详情保留 content_sha256 强 ETag）；前端
`api/fiction.ts` 切换 JSON、共享类型移至 `packages/types/src/fiction.ts`；
删除 `proto/`、`packages/proto`、prost/build.rs、`api_v2` Protobuf 管线与
`protobuf.ts`；嵌入 SPA 回退移至 `backend/src/spa.rs`；移除重复的
`hasu-gallery-api` bin。验证：`cargo test` 51 通过、`pnpm typecheck`、
`pnpm test` 9 通过、`pnpm build` 全绿。works 读路径的 ETag/micro-cache
移植为后续跟进项。

**2026-08-28 Architecture V3 S2 私有媒体切片**: 新增 `006_media_assets.sql`
（media_assets 表 + works.media_id）与 `backend/src/media.rs`。新上传写入
`private/{media_uuid}/`（原图 + 缩略图，含 sha256），作品 ID 与媒体 UUID 分离；
审核批准在事务提交前将净化对象服务端复制到 `public/{media_uuid}/v1/`（提交
失败补偿删除），公开 URL 为 `{base}/public/{uuid}/v1/image.{ext}`；owner/
审核队列/非公开详情通过 300s presigned GET 查看私有对象，公开上下文绝不输出
私有 URL；takedown 标记 removed 并删除公开对象（保留私有原件）。新增
`galleryd backfill-media`：approved 旧作品复制到公开 UUID 键（旧 URL 双读
窗口保留），pending/rejected 迁入私有前缀并删除旧公开对象，关闭 S2 前的
pending 可达缺口。部署要求：CDN/代理必须拒绝 `private/*` 路径（见
`docs/deployment.md`）。验证：`cargo test` 57 通过。

**2026-08-28 Architecture V3 S3 安全边界切片**: 新增 `backend/src/policy.rs`
集中式 deny-by-default 授权（作品可见性 × 所有权、分级内容、投稿、审核），
works 列表/facets/详情、moderation 路由守卫与 Fiction 鉴权全部改走策略层，
并附角色×动作×状态表驱动测试；新增全局安全响应头 middleware（nosniff、
Referrer-Policy、X-Frame-Options DENY、Permissions-Policy、HTML 专属 CSP、
HSTS 随 `SESSION_COOKIE_SECURE` 开启）；补齐 S1 遗留项：公共 works
列表/详情在 approved + all_ages（会话无关变体）下输出强 ETag +
`public, max-age=60, stale-while-revalidate=120` 并支持 If-None-Match 304，
分级/审核变体与 facets 保持不可共享缓存。单二进制同源切换 runbook 见
`docs/deployment.md`。验证：`cargo test` 64 通过、0 编译警告。

**2026-08-28 本地服务端验证**: `galleryd serve` 对 dev 库自动应用 006 迁移并
完成全链路实测——公共 works 列表强 ETag + micro-cache + If-None-Match 304、
安全响应头全量（HTML 专属 CSP）、guest r18/pending 401、Fiction JSON
列表/404/未登录 401/415、旧 `/api/v2` 路径回落 SPA；S2 生命周期端到端通过：
上传 → `private/{uuid}` + 300s presigned 预览（实取 PNG 成功）→ pending 对
游客 401 → 批准 → 游客获得 `public/{uuid}/v1/` URL 且 CDN 可取 → takedown →
源站公开对象已删（404）、私有原件保留（审核队列 presign 可取）。实测发现两
项运维事项已记入 `docs/deployment.md`：① MinIO 桶仍是全桶匿名可读，
`private/*` 当前经 CDN 匿名可达，需立即加边缘拒绝规则；② presigned URL 指向
tailnet 内网端点，非 tailnet 审核需公开 presign 域名；另确认 takedown 后
Cloudflare 缓存需手动 purge（cf-cache-status: HIT）。

**2026-08-28 媒体主机加固（运维实施）**: 经 SSH 在媒体主机完成两项配置——
① nginx `assets.conf` 增加 `location ^~ /hasu-gallery/private/ { return 404; }`
（已备份原配置，legacy 公开媒体不受影响）；② 实测发现 MinIO 9000/9001 曾直接
暴露公网且允许匿名列举/读取整桶，已加 iptables DROP（限 eth0）并以幂等
systemd oneshot 单元持久化；tailnet/localhost 路径（后端直连、presigned、
nginx 代理）全部验证正常。主机细节与暴露评估记录于
`.codex-local/ops/media-host-hardening-20260828.md`（gitignored）。遗留：
双读窗口结束后收窄桶匿名策略至 `public/*` 并关闭匿名列举；takedown 需
Cloudflare purge；非 tailnet 审核需公开 presign 域名。

**方向已确定**：方案 C（双轨拆仓）。hasu-memes 保持只读画廊终态，hasu-gallery 为新建 UGC 平台。

---

## Overview

The implemented baseline provides:
1. **Meme Gallery** (表情包画廊): Official + activity screenshots + fan-made memes
2. **Art Gallery** (美术部): Fan-created artwork (excluding memes)

Architecture V2 adds:

3. **Fiction** (同人文): Pixiv-novel-like single works and ordered series with
   author drafts, moderated revisions, public reading, and optional
   cover/illustration media.

All content domains share authentication, attribution, moderation, reporting,
audit, and discovery boundaries while keeping domain-specific storage models.

> **方向已收敛**：早期“静态化 vs UGC 平台”的分歧已由 2026-06-14 方案 C 解决。`hasu-memes` 保持只读画廊终态，`hasu-gallery` 独立承接 UGC、上传、审核与生产化加固。

---

## Phase Breakdown

### Phase 0: Foundation & Design ✅ COMPLETE

**Deliverable**: Data model specification  
**File**: `.ccg/spec/phase0-content-core-model.md`

**What was locked**:
- Database: Postgres (not SQLite)
- Schema: Core `works` table + gallery-specific extensions (`work_art_meta`, M2M associations)
- Authentication: argon2id + role-based (member/moderator/admin)
- Moderation: State machine (pending → approved/rejected/takedown)
- Storage: Repository `assets/` for official + S3-compatible for UGC
- Deduplication: Perceptual hash (pHash) planned; schema field exists, computation not shipped
- Content policy: Mandatory provenance (derived/fan_made → source; art → source_url)
- Rating: Art-only (all_ages/r15/r18)
- No historical data migration (3499 test items sufficient)

**Key artifacts**:
- Complete Postgres DDL
- State machine diagram
- Metadata attribution table
- Authentication/role model

---

### Phase 1: Backend Spine Refactor

**Goal**: Replace read-only foundation with write-capable spine  
**Estimated complexity**: Medium-High (refactor, not rewrite)

#### 1.1 Database Migration

**Tasks**:
- Set up Postgres instance (local dev + deployment)
- Install migration tool (`sqlx-cli` or `refinery`)
- Translate Phase 0 DDL into versioned migrations
- Seed test data (3499 activity-record memes from `tmp/real-memes/`)

**Deliverable**: Running Postgres with `works`, `users`, `moderation_log` tables

#### 1.2 Replace MemeDataCache

**Current issue**: `MemeDataCache` reloads entire dataset on file mtime change → incompatible with writes

**Tasks**:
- Remove `MemeDataCache` struct
- Replace with connection pool (`sqlx::PgPool` or `deadpool-postgres`)
- Refactor `load_meme_data()` → direct queries with WHERE filters
- Update ETag generation (based on query result hash, not global mtime)

**Deliverable**: Write-aware data layer

#### 1.3 Modularize main.rs

**Current**: 3200 lines in single file  
**Target**: Modular structure

```
backend/src/
  main.rs           -- server setup, shared state
  routes/           -- route definitions
    memes.rs
    auth.rs
    upload.rs
    moderation.rs
  handlers/         -- request handlers
    memes.rs
    auth.rs
    upload.rs
    moderation.rs
  middleware/
    auth.rs         -- session validation
  storage/
    object.rs       -- S3-compatible client
    media.rs        -- media serving (preserve existing logic)
  security/
    prescreen.rs    -- upload validation (reuse preflight logic)
    phash.rs        -- perceptual hash
  catalog.rs        -- preserve (data loading)
  facets.rs         -- refactor to query work_* tables
```

**Deliverable**: Modular codebase, easier to test and extend

#### 1.4 Authentication Middleware

**Tasks**:
- Password hashing: `argon2` crate
- Session token generation (UUID or JWT)
- `tower-http` middleware for protected routes
- Login/logout endpoints (`POST /api/auth/login`, `/api/auth/logout`)
- Registration endpoint (`POST /api/auth/register`)

**Deliverable**: Auth endpoints + protected route middleware

#### 1.5 Upload Pipeline

**Tasks**:
- Form handler: `POST /api/upload` (multipart/form-data)
- Pre-screen checks (reuse `preflight_memes.rs` logic):
  - MIME sniffing
  - Size limit (e.g., 10MB)
  - Dimension extraction
  - EXIF stripping
  - pHash calculation
- Duplicate detection: query `works.phash` for Hamming distance < threshold
- Object storage upload (S3 client)
- Insert `works` row with `status='pending'`
- Return upload receipt to user

**Deliverable**: Functional upload endpoint (auth-protected)

#### 1.6 Facet System Refactor

**Current**: `facets.rs` loads from static catalog  
**New**: Dynamic queries on `work_characters`, `work_tags`, `work_categories`

**Tasks**:
- Refactor `load_character_facets()` → query `work_characters` grouped by `name`, scoped by `gallery`
- Same for tags, categories
- Add `GET /api/facets/artists` (art-only, from `work_art_meta`)
- Preserve facet caching + ETag

**Deliverable**: Dynamic, gallery-scoped facets

#### 1.7 API Extensions

**New endpoints**:
- `GET /api/works?gallery=meme` (replace `/api/memes`, backward-compatible alias)
- `GET /api/works?gallery=art` (art gallery listing)
- `GET /api/works/:id` (unified detail endpoint)
- `GET /api/facets/:type?gallery=meme|art` (scoped facets)

**Preserve**: Existing `/api/memes`, `/api/categories` endpoints for backward compatibility

**Deliverable**: Extended API contract


### Phase 2: Frontend Gallery Interface ✅ COMPLETE

**Goal**: Build complete user-facing gallery and upload experience  
**Status**: ✅ Phase 1-5 已完成；Architecture V2 已批准；Slice A–C foundation 已落地

#### 2.1 Authentication UI ✅

**Features**:
- LoginPage + RegisterPage (表单验证 + 错误提示)
- AuthGuard 路由保护
- zustand auth store（用户状态管理）

**Files**: `apps/web/src/pages/{LoginPage,RegisterPage}.tsx`, `apps/web/src/components/AuthGuard.tsx`, `apps/web/src/store/auth.ts`

**Deliverable**: Complete authentication UI

#### 2.2 Works List Page ✅

**Features**:
- GalleryPage（可复用，支持 meme/art）
- WorksGrid + WorkCard（响应式网格 1/3/4/6 列）
- FilterPanel（status/origin/sort 筛选）
- Pagination 组件
- 后端 API：`GET /api/works`（分页 + 筛选 + 排序）

**Files**: `apps/web/src/pages/GalleryPage.tsx`, `apps/web/src/components/{WorkCard,WorksGrid,FilterPanel,Pagination}.tsx`, `backend/src/routes/works.rs`

**Deliverable**: Functional gallery browsing

#### 2.3 Work Detail Page ✅

**Features**:
- WorkDetailPage（大图查看 + 元数据面板）
- 下载功能 + 返回导航
- 后端 API：`GET /api/works/:id`（404 处理）

**Files**: `apps/web/src/pages/WorkDetailPage.tsx`

**Deliverable**: Work detail view

#### 2.4 Upload Interface ✅

**Features**:
- UploadPage（完整上传流程）
- FileDropZone（拖拽 + 文件验证，max 10MB）
- ImagePreview（预览 + 尺寸检测）
- UploadForm（多字段表单 + 条件显示）
- upload API 客户端（FormData + multipart）

**Files**: `apps/web/src/pages/UploadPage.tsx`, `apps/web/src/components/{FileDropZone,ImagePreview,UploadForm}.tsx`, `apps/web/src/api/upload.ts`

**Deliverable**: User upload flow (uploads → pending status)

#### 2.5 User Profile Page ✅

**Features**:
- ProfilePage（用户信息 + 统计 + 我的上传）
- StatsCard 组件（4 种 variant）
- MyWorksList（状态徽章 + 筛选）
- 后端 API：`GET /api/users/me/stats`、`GET /api/users/me/works`

**Files**: `apps/web/src/pages/ProfilePage.tsx`, `apps/web/src/components/{StatsCard,MyWorksList}.tsx`, `backend/src/routes/users.rs`

**Deliverable**: User profile & submission management

**Phase 2 Summary**: 完整的用户体验闭环 — 认证、浏览、上传、个人中心。所有作品进入 `pending` 状态，等待 Phase 3 审核流程。

---

### Phase 3: Moderation UI & Workflow

**Goal**: Enable moderators to review pending submissions

#### 3.1 Moderation Queue API

**Endpoints**:
- `GET /api/moderation/queue?gallery=meme|art&status=pending` (moderator-only)
- `PATCH /api/works/:id/status` (body: `{status: "approved"|"rejected"|"takedown", note: "..."}`)
- `GET /api/moderation/log/:work_id` (audit trail)

**Access control**: 
- Role check (moderator/admin only)
- Record each action in `moderation_log` table

**Deliverable**: Moderation API

#### 3.2 Frontend: Moderation Dashboard

**Features**:
- Moderation queue (pending works, filterable by gallery)
- Work preview + metadata display
- Approve/reject/takedown buttons with reason textarea
- Batch operations (optional, nice-to-have)
- Audit log viewer

**Access control**: Route-level guard (moderator role required)

**Deliverable**: Functional moderation UI

---

### Phase 4: Art Gallery Launch ✅ BASELINE COMPLETE

**Goal**: Launch the Art Gallery baseline with metadata support; production hardening now continues in Phase 5.

#### 4.1 Frontend: Gallery Switcher

**Features**:
- Top-level tab or dropdown: "Meme Gallery" vs "Art Gallery"
- Reuse existing grid/facet/preview components
- Swap data source: `GET /api/works?gallery=art`
- Art-specific facets: artist, medium, rating

**Deliverable**: Dual-gallery navigation

#### 4.2 Art Metadata Enhancement

**Features**:
- Artist field support in upload form and display
- Medium/technique tagging
- Rating system (all_ages/r15/r18)
- Art-specific filters in gallery

**Database**: Use existing `work_art_meta` table

**Deliverable**: Art gallery metadata complete

#### 4.3 Content Filtering

**Features**:
- Rating filter (art gallery only)
- Default: all_ages (guest) or user preference (logged in)
- Local preference persistence for rating selection

**Deliverable**: Age-appropriate content filtering

---

### Phase 5: Polish & Hardening

**Goal**: Production readiness

#### 5.0 Art Gallery Production Polish ✅ COMPLETE

- ✅ Rating preference persistence via `hasu-gallery-preferences` local storage
- ✅ Art facets API: `GET /api/works/facets?gallery=art`
- ✅ Rating option counts in Art filters
- ✅ Artist/medium suggestions backed by server-side facets
- ✅ Automated E2E coverage for Art facets and rating preference restore

#### 5.1 Security Hardening

- ✅ Rate limiting (upload, login attempts): in-memory per-client route buckets with 429 responses
- ✅ CSRF protection: unsafe-method Origin/Referer validation against configured allowed origins
- ✅ Input sanitization audit: auth/upload text normalization, length limits, source URL scheme/authority validation
- ✅ SQL injection prevention: parameterized filters plus static ORDER BY whitelist
- ✅ File upload restrictions: extension whitelist plus magic byte validation

#### 5.2 Performance Optimization

- ✅ Database indexing (on `gallery`, `status`, `created_at`; `phash` index exists for future dedup)
- ✅ Image optimization (thumbnail generation with fixed JPEG quality; progressive JPEG deferred to encoder/CDN support)
- ✅ CDN integration for static assets
- ✅ Lazy loading for gallery/profile grids

#### 5.3 Testing & CI

- ✅ Playwright E2E smoke: Art facets, rating filter, persisted preference restore on desktop and mobile viewports
- ✅ Playwright E2E smoke: upload submission, moderation queue, approve flow on desktop and mobile viewports
- ✅ Backend HTTP tests: `GET /api/works/facets` gallery/status validation and pending auth boundary
- ✅ Frontend component test baseline: Vitest + Testing Library in CI, covering moderation filter labels and queue reload behavior
- ✅ Unit tests (backend: auth, upload, moderation logic)
- ✅ Integration tests (API endpoints)
- ✅ E2E tests (upload flow, moderation flow; local Playwright script, not CI)
- ✅ GitHub Actions CI pipeline (lightweight; no Playwright E2E)

#### 5.4 Documentation

- ✅ API documentation
- ✅ Deployment guide (environment variables, migrations, CDN, verification)
- ✅ Moderation guidelines
- ✅ User guide (how to upload, content policy)

#### 5.5 Monitoring

- ✅ Error tracking (Sentry or similar): log-drain baseline and SDK hook point documented
- ✅ Performance monitoring baseline: request duration logs and response header
- ✅ Database query profiling
- ✅ User analytics (upload success rate, moderation queue backlog)

---

## Next Actions

> **Current Status (2026-08-28)**: Phase 1-5 baseline 已完成且必须保持回归
> 绿色。Architecture V3 已批准且 S1–S3 代码全部落地；生产切换按
> `docs/deployment.md` 的单二进制 runbook 执行。

**Immediate Next Steps**:
1. 维持当前发布前验收：`pnpm test`、`pnpm typecheck`、`pnpm build`、
   `cargo test --manifest-path backend/Cargo.toml` 与 `pnpm e2e`。
2. 生产部署 S2/S3：应用 006 迁移、确认 CDN/代理拒绝 `private/*`、运行一次
   `galleryd backfill-media`、切换到 galleryd 单二进制同源部署（保留旧拓扑
   到回滚窗口结束），窗口后清理 approved 旧公开对象。
3. 恢复产品路线：账号设置 → 收藏/点赞/举报 → 审核制评论（V3 §9 非目标与
   hardening backlog 见 `.ccg/spec/architecture-v3.md`）。

**Long-term Priorities**:
- Architecture V2: 完成 1C512M、权限矩阵、恶意媒体、CDN、备份恢复验收
- Fiction: 完成安全正文、草稿/修订、系列、阅读与文本审核基线
- Phase 5 follow-up: 外部监控平台、发布流水线与前端组件测试覆盖扩展
- Future product work: 批量审核、通知、搜索体验与运营后台增强

---

## Technical Debt

1. ~~Frontend 尚未实现~~ ✅ Phase 2 完成
2. 前端组件/单元测试覆盖仍需扩展（Vitest + Testing Library 基础已接入 CI）
3. ~~缺少后端集成测试~~ ✅ Phase 5 已补 facets API HTTP 集成路径
4. 缺少发布/部署流水线（轻量 CI 已覆盖 typecheck/build/frontend tests/cargo test；E2E 作为本地脚本）
5. ~~缺少生产环境监控~~ ✅ Phase 5 已补日志/响应头/监控摘要 API 与监控 runbook；外部 APM/Sentry 接入为后续增强
6. Architecture V2 尚未实现：当前仍为独立 SPA + JSON API，生产单二进制与
   Protobuf 契约待按 slices 迁移
7. 当前 pending 对象仍与 approved 对象共享公共 media base；V2 私有暂存、
   审核签名 URL 和公开净化变体尚未落地
8. Fiction 内容域尚未实现：共享 content kind/rating、正文修订、系列、阅读
   API、文本安全与搜索投影仅存在于 Architecture V2 设计

---

## Appendix: Migration from hasu-memes

**Context**: hasu-memes is a read-only gallery with 3499 memes from activity-record.  
**Decision (2026-06-14)**: Dual-track approach (方案 C)

- **hasu-memes**: Keep as-is (read-only, SQLite, no auth)
- **hasu-gallery**: New UGC platform (this project)

**No data migration needed**: hasu-gallery starts fresh with user-uploaded content.
