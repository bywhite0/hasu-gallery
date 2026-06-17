# hasu-gallery Evolution Roadmap

**Project**: hasu-gallery (新仓独立项目)  
**Vision**: Dual-gallery UGC platform (Meme Gallery + Art Gallery) with upload & moderation  
**Created**: 2026-06-09  
**Last Synced**: 2026-06-17  
**Status**: ✅ Phase 2 完成 — 前端画廊界面全部实现（+2,562 行代码）；Phase 3 审核工作流待开始

> **架构更新 (2026-06-14)**: 基于 linkura-apps 分析，采用 Rspack + TanStack Router/Query + zustand + Tailwind v4 技术栈

---

## 状态快照（2026-06-17 对照）

> 本节由 `master` 分支 + `backend/src/` + `apps/web/src/` + 最近提交客观核对得出。

| Phase | 路线图声明 | 实际代码状态 | 差距 |
|---|---|---|---|
| **0: Foundation & Design** | ✅ COMPLETE | ✅ 规范文件已落地（`.ccg/spec/phase0-content-core-model.md`），决策表完整 | — |
| **1.1 Postgres 迁移** | ✅ COMPLETE | ✅ `backend/migrations/001_initial.sql` 已部署（9 表 + 5 枚举 + 2 触发器），边缘服务器 `100.104.1.1:5432` 运行中 | — |
| **1.2 认证系统** | ✅ COMPLETE | ✅ argon2id + tower-sessions（PostgreSQL 存储），4 个 API 端点（register/login/logout/me） | — |
| **1.3 上传流水线** | ✅ COMPLETE | ✅ S3/MinIO 上传 + 缩略图生成（400x400 Lanczos3）+ multipart 验证，Nginx 公开代理 `https://assets.kaho.top/hasu-gallery/` | — |
| **1.4 模块化 main.rs** | ✅ COMPLETE | ✅ `backend/src/` 已模块化：`auth.rs`、`db.rs`、`storage.rs`、`image_processor.rs`、`models/`、`routes/` | — |
| **2.1 认证界面** | ✅ COMPLETE | ✅ LoginPage + RegisterPage + AuthGuard（543 行）| — |
| **2.2 作品列表页** | ✅ COMPLETE | ✅ GalleryPage + WorksGrid + FilterPanel + Pagination（575 行），后端 `GET /api/works` | — |
| **2.3 作品详情页** | ✅ COMPLETE | ✅ WorkDetailPage（277 行），后端 `GET /api/works/:id` | — |
| **2.4 上传界面** | ✅ COMPLETE | ✅ UploadPage + FileDropZone + ImagePreview + UploadForm（558 行） | — |
| **2.5 用户个人页** | ✅ COMPLETE | ✅ ProfilePage + StatsCard + MyWorksList（609 行），后端 `GET /api/users/me/{stats,works}` | — |
| **3: 审核工作流** | ⏳ 未开始 | ⏳ 未开始 | 计划中 |
| **4-5** | ⏳ 未开始 | ⏳ 未开始 | — |

**Phase 2 总计**: +2,562 行前端代码，11 个 API 端点，完整的画廊浏览和上传功能。

**方向已确定**：方案 C（双轨拆仓）。hasu-memes 保持只读画廊终态，hasu-gallery 为新建 UGC 平台。

---

## Overview

Evolve the current read-only meme gallery into a UGC platform supporting:
1. **Meme Gallery** (表情包画廊): Official + activity screenshots + fan-made memes
2. **Art Gallery** (美术部): Fan-created artwork (excluding memes)

Both galleries share the same authentication, upload, moderation, and storage spine.

> ⚠️ **方向待决**：上述愿景与最近 2 周实际工作流（静态化）不一致。建议在动手任何 Phase 1 子项前，先选择 A 追路线图 / B 重置路线图 / C 双轨拆仓。详见顶部「状态快照」与 Next Actions 第 1 项。

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

### Phase 4: Art Gallery Launch

**Goal**: Make art gallery production-ready with full metadata support

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
- Cookie/session to persist rating preference

**Deliverable**: Age-appropriate content filtering

---

### Phase 5: Polish & Hardening

**Goal**: Production readiness

#### 5.1 Security Hardening

- Rate limiting (upload, login attempts)
- CSRF protection
- Input sanitization audit
- SQL injection prevention (use parameterized queries)
- File upload restrictions (extension whitelist, magic byte validation)

#### 5.2 Performance Optimization

- Database indexing (on `gallery`, `status`, `created_at`, `phash`)
- Image optimization (thumbnail generation, progressive JPEG)
- CDN integration for static assets
- Lazy loading for gallery grids

#### 5.3 Testing & CI

- Unit tests (backend: auth, upload, moderation logic)
- Integration tests (API endpoints)
- E2E tests (upload flow, moderation flow)
- GitHub Actions CI pipeline

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

> **Current Status (2026-06-17)**: Phase 2 完成，Phase 3 准备启动

**Immediate Next Steps**:
1. Phase 3.1: 实现审核 API（`PATCH /api/works/:id/status` + 权限检查）
2. Phase 3.2: 构建审核界面（ModerationPage + 待审队列 + 批量操作）
3. Phase 3 验收：创建测试账号（moderator role），验证审核流程

**Long-term Priorities**:
- Phase 4: Art Gallery 上线（metadata + rating 系统）
- Phase 5: 生产化加固（性能、安全、监控）

---

## Technical Debt

1. ~~Frontend 尚未实现~~ ✅ Phase 2 完成
2. 缺少前端测试（Vitest + Testing Library 未配置）
3. 缺少后端集成测试
4. 缺少 CI/CD 流水线
5. 缺少生产环境监控

---

## Appendix: Migration from hasu-memes

**Context**: hasu-memes is a read-only gallery with 3499 memes from activity-record.  
**Decision (2026-06-14)**: Dual-track approach (方案 C)

- **hasu-memes**: Keep as-is (read-only, SQLite, no auth)
- **hasu-gallery**: New UGC platform (this project)

**No data migration needed**: hasu-gallery starts fresh with user-uploaded content.
