# hasu-gallery Evolution Roadmap

**Project**: hasu-gallery (新仓独立项目)  
**Vision**: Dual-gallery UGC platform (Meme Gallery + Art Gallery) with upload & moderation  
**Created**: 2026-06-09  
**Last Synced**: 2026-07-07
**Status**: ✅ Phase 1-4 baseline 已完成真实浏览器验收；Phase 5 production hardening 已开始

> **架构更新 (2026-06-14)**: 基于 linkura-apps 分析，采用 Rspack + TanStack Router/Query + zustand + Tailwind v4 技术栈

---

## 状态快照（2026-07-06 对照）

> 本节由 `master` 分支 + `backend/src/` + `apps/web/src/` + 真实浏览器回归客观核对得出。

| Phase | 路线图声明 | 实际代码状态 | 差距 |
|---|---|---|---|
| **0: Foundation & Design** | ✅ COMPLETE | ✅ 规范文件已落地（`.ccg/spec/phase0-content-core-model.md`），决策表完整 | — |
| **1.1 Postgres 迁移** | ✅ COMPLETE | ✅ `backend/migrations/001_initial.sql` 已部署（9 表 + 5 枚举 + 2 触发器），边缘服务器 `<edge-db-host>:5432` 运行中 | — |
| **1.2 认证系统** | ✅ COMPLETE | ✅ argon2id + tower-sessions（PostgreSQL 存储），4 个 API 端点（register/login/logout/me） | — |
| **1.3 上传流水线** | ✅ COMPLETE | ✅ S3/MinIO 上传 + 缩略图生成（400x400 Lanczos3）+ multipart 验证，Nginx 公开代理 `https://cdn.example.com/hasu-gallery/` | — |
| **1.4 模块化 main.rs** | ✅ COMPLETE | ✅ `backend/src/` 已模块化：`auth.rs`、`db.rs`、`storage.rs`、`image_processor.rs`、`models/`、`routes/` | — |
| **2.1 认证界面** | ✅ COMPLETE | ✅ LoginPage + RegisterPage + AuthGuard（543 行）| — |
| **2.2 作品列表页** | ✅ COMPLETE | ✅ GalleryPage + WorksGrid + FilterPanel + Pagination（575 行），后端 `GET /api/works` | — |
| **2.3 作品详情页** | ✅ COMPLETE | ✅ WorkDetailPage（277 行），后端 `GET /api/works/:id` | — |
| **2.4 上传界面** | ✅ COMPLETE | ✅ UploadPage + FileDropZone + ImagePreview + UploadForm（558 行） | — |
| **2.5 用户个人页** | ✅ COMPLETE | ✅ ProfilePage + StatsCard + MyWorksList（609 行），后端 `GET /api/users/me/{stats,works}` | — |
| **3.1 审核队列 API** | ✅ COMPLETE | ✅ middleware.rs + routes/moderation.rs（300 行），3 个 API 端点 | — |
| **3.2 审核仪表板** | ✅ COMPLETE | ✅ ModerationPage + ModerationActions + ModerationLog（524 行）| — |
| **4: Art Gallery** | ✅ BASELINE COMPLETE | ✅ Baseline launch 已验证：Meme/Art 导航、Art upload metadata、rating 筛选、`work_art_meta` 写入、MinIO 上传成功路径与审核发布均通过真实浏览器验收 | 自动化 E2E 与 production hardening 已转入 Phase 5 |
| **5: Polish & Hardening** | 🔄 STARTED | 🔄 已开始：rating 偏好持久化、`GET /api/works/facets`、Art rating 计数、artist/medium 建议搜索已落地并通过真实 API + 浏览器验收 | E2E/集成测试、安全加固、部署/监控文档待补 |

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

**2026-07-07 CDN base URL 切片**: 统一 `PUBLIC_MEDIA_BASE_URL` 解析到 `storage::public_media_base_url()`，上传返回 URL 与作品列表/详情 URL 共用同一 CDN base，默认值为 `https://cdn.example.com/hasu-gallery` 并自动去除尾斜杠。

**2026-07-07 审核逻辑测试切片**: moderation queue 参数校验、状态流转目标校验与 review note 规范化抽成纯函数并补单元测试；review note 现在 trim 后入库，空白 note 转为 `NULL`，长度限制 1000 字符。

**2026-07-07 轻量 CI 迁移切片**: GitHub Actions 后端任务仍只跑 Postgres + `cargo test`，但数据库初始化从硬编码 `001_initial.sql` 改为按顺序执行 `backend/migrations/*.sql`，避免新增迁移后 CI schema 落后；E2E 继续只作为本地脚本。

**2026-07-07 API 集成测试切片**: 新增可选 Postgres HTTP 集成测试，CI 设置 `DATABASE_URL` 时会插入唯一 Art seed 数据并通过 `GET /api/works/facets?gallery=art` 验证 artist/medium 聚合计数；本地无 `DATABASE_URL` 时快速跳过真实 DB 部分。

**方向已确定**：方案 C（双轨拆仓）。hasu-memes 保持只读画廊终态，hasu-gallery 为新建 UGC 平台。

---

## Overview

Build the independent UGC platform for:
1. **Meme Gallery** (表情包画廊): Official + activity screenshots + fan-made memes
2. **Art Gallery** (美术部): Fan-created artwork (excluding memes)

Both galleries share the same authentication, upload, moderation, and storage spine.

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
- Deduplication: Perceptual hash (pHash) in MVP
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
**Status**: ✅ 已完成（2026-06-17），+2,562 行代码

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

#### 5.0 Art Gallery Production Polish ✅ STARTED

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

- ✅ Database indexing (on `gallery`, `status`, `created_at`, `phash`)
- ✅ Image optimization (thumbnail generation with fixed JPEG quality; progressive JPEG deferred to encoder/CDN support)
- ✅ CDN integration for static assets
- ✅ Lazy loading for gallery/profile grids

#### 5.3 Testing & CI

- ✅ Playwright E2E smoke: Art facets, rating filter, persisted preference restore
- ✅ Playwright E2E smoke: upload submission, moderation queue, approve flow
- ✅ Backend HTTP tests: `GET /api/works/facets` gallery/status validation and pending auth boundary
- ✅ Unit tests (backend: auth, upload, moderation logic)
- ✅ Integration tests (API endpoints)
- E2E tests (upload flow, moderation flow)
- ✅ GitHub Actions CI pipeline (lightweight; no Playwright E2E)

#### 5.4 Documentation

- API documentation (OpenAPI/Swagger)
- Deployment guide (Docker Compose, environment variables)
- Moderation guidelines
- User guide (how to upload, content policy)

#### 5.5 Monitoring

- Error tracking (Sentry or similar)
- Performance monitoring (APM)
- Database query profiling
- User analytics (upload success rate, moderation queue backlog)

---

## Next Actions

> **Current Status (2026-07-06)**: Phase 1-4 baseline 已完成真实浏览器验收；Phase 5 已完成 Art facets/search polish 的第一个切片，进入自动化测试与安全加固收尾。

**Immediate Next Steps**:
1. 在可用测试数据库环境下扩展 API 集成测试：facets moderator/admin 聚合路径、上传入库、审核状态流转。
2. 生产化安全加固：上传/登录限流、CSRF、防刷、继续补齐输入与上传校验审计。
3. 文档与可观测性：部署环境变量、内容政策/审核指南、错误监控与基础指标。

**Long-term Priorities**:
- Phase 5: 生产化加固（性能、安全、监控、自动化验收）
- Phase 5 follow-up: 自动化验收、限流/CSRF、部署与监控文档

---

## Technical Debt

1. ~~Frontend 尚未实现~~ ✅ Phase 2 完成
2. 缺少前端组件/单元测试（Vitest + Testing Library 未配置）
3. 缺少后端集成测试
4. 缺少发布/部署流水线（基础 CI 已覆盖 typecheck/build/cargo test；E2E 作为本地脚本）
5. 缺少生产环境监控

---

## Appendix: Migration from hasu-memes

**Context**: hasu-memes is a read-only gallery with 3499 memes from activity-record.  
**Decision (2026-06-14)**: Dual-track approach (方案 C)

- **hasu-memes**: Keep as-is (read-only, SQLite, no auth)
- **hasu-gallery**: New UGC platform (this project)

**No data migration needed**: hasu-gallery starts fresh with user-uploaded content.
