# hasu-gallery Evolution Roadmap

**Project**: hasu-gallery (新仓独立项目)  
**Vision**: Dual-gallery UGC platform (Meme Gallery + Art Gallery) with upload & moderation  
**Created**: 2026-06-09  
**Last Synced**: 2026-06-17  
**Status**: ✅ Phase 1 完成 — 数据库迁移、认证系统、上传流水线全部落地；Phase 2 前端画廊界面进行中

> **架构更新 (2026-06-14)**: 基于 linkura-apps 分析，采用 Rspack + TanStack Router/Query + zustand + Tailwind v4 技术栈

---

## 状态快照（2026-06-17 对照）

> 本节由 `master` 分支 + `backend/src/` + 最近 20 个 commit 客观核对得出。

| Phase | 路线图声明 | 实际代码状态 | 差距 |
|---|---|---|---|
| **0: Foundation & Design** | ✅ COMPLETE | ✅ 规范文件已落地（`.ccg/spec/phase0-content-core-model.md`），决策表完整 | — |
| **1.1 Postgres 迁移** | ✅ COMPLETE | ✅ `backend/migrations/001_initial.sql` 已部署（9 表 + 5 枚举 + 2 触发器），边缘服务器 `100.104.1.1:5432` 运行中 | — |
| **1.2 认证系统** | ✅ COMPLETE | ✅ argon2id + tower-sessions（PostgreSQL 存储），4 个 API 端点（register/login/logout/me） | — |
| **1.3 上传流水线** | ✅ COMPLETE | ✅ S3/MinIO 上传 + 缩略图生成（400x400 Lanczos3）+ multipart 验证，Nginx 公开代理 `https://assets.kaho.top/hasu-gallery/` | — |
| **1.4 模块化 main.rs** | ✅ COMPLETE | ✅ `backend/src/` 已模块化：`auth.rs`、`db.rs`、`storage.rs`、`image_processor.rs`、`models/`、`routes/` | — |
| **2: 前端画廊界面** | ⏳ 进行中 | ⏳ 前端骨架就位（Rspack + TanStack），页面尚未实现 | 计划见 `docs/phase2-plan.md` |
| **3-5** | ⏳ 未开始 | ⏳ 未开始 | — |

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

---

### Phase 2: Moderation UI & Workflow

**Goal**: Enable moderators to review pending submissions

#### 2.1 Moderation Queue API

**Endpoints**:
- `GET /api/moderation/queue?gallery=meme|art&status=pending` (moderator-only)
- `POST /api/moderation/approve/:id` (body: `{note}`)
- `POST /api/moderation/reject/:id` (body: `{note}`)
- `POST /api/moderation/takedown/:id` (body: `{note}`)
- `GET /api/moderation/log/:work_id` (audit trail)

**Deliverable**: Moderation API

#### 2.2 Frontend: Moderation Dashboard

**Features**:
- Moderation queue (pending works, filterable by gallery)
- Work preview + metadata display
- Approve/reject/takedown buttons with reason textarea
- Batch operations (optional, nice-to-have)

**Access control**: Route-level guard (moderator role required)

**Deliverable**: Functional moderation UI

---

### Phase 3: User-Facing Upload Flow

**Goal**: Enable members to submit works

#### 3.1 Frontend: Upload Form

**Features**:
- Gallery selection (meme vs art)
- File picker (with client-side preview)
- Metadata form:
  - Title (required)
  - Characters (multi-select, shared vocabulary)
  - Tags (multi-select, shared vocabulary)
  - Source / Source URL (required for derived/fan_made memes, art)
  - Rights note (required)
  - **Art-only**: Artist, Medium, Rating
- Submit button → `POST /api/upload`
- Status feedback: "Submitted for review" → link to "My Submissions"

**Deliverable**: Upload UI

#### 3.2 Frontend: My Submissions

**Features**:
- List user's own works (all statuses: pending/approved/rejected)
- Status badge (pending/approved/rejected)
- Rejection reason display (if rejected)
- Resubmit button (if rejected) → pre-fill form with existing data

**Deliverable**: Submission management UI

---

### Phase 4: Art Gallery Launch

**Goal**: Make art gallery publicly visible

#### 4.1 Frontend: Gallery Switcher

**Features**:
- Top-level tab or dropdown: "Meme Gallery" vs "Art Gallery"
- Reuse existing grid/facet/preview components
- Swap data source: `GET /api/works?gallery=art`
- Art-specific facets: artist, medium, rating

**Deliverable**: Dual-gallery navigation

#### 4.2 Content Filtering

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
- Input sanitization (especially user-provided URLs)
- Object storage URL signing (if needed)

#### 5.2 Observability

- Structured logging (`tracing` crate)
- Health check endpoint (`GET /health`)
- Metrics (optional: Prometheus exporter)

#### 5.3 Performance Optimization

- Connection pooling tuning
- Query optimization (EXPLAIN plans)
- CDN integration for object storage
- Frontend: virtual scrolling (if not already in Phase 2/3)

#### 5.4 Testing

- Integration tests (end-to-end upload → moderation → public flow)
- Load testing (concurrent uploads, moderation queue under stress)
- Security testing (OWASP Top 10 checks)

---

## Technical Decisions Log

| Decision | Rationale |
|----------|-----------|
| Keep Rust (no Go rewrite) | 3700 lines + 35 tests already proven; rewrite = zero new user value |
| Postgres over SQLite | Write concurrency, FTS, growth headroom for UGC scale |
| Core + extension tables | Art/meme metadata divergence; cleaner than nullable monolith |
| pHash in MVP | Duplicate prevention is critical for UGC quality |
| No historical migration | 3499 test items sufficient; fresh start cheaper than backfill |
| argon2id password hashing | Compliance (per CLAUDE.md legal/compliance note) |
| S3-compatible storage | UGC cannot live in git; standard solution |

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Legal: Copyright/DMCA claims | `takedown` state + mandatory provenance + moderation log |
| Abuse: Malicious uploads | Pre-screen (MIME/size/pHash) + moderation queue + rate limiting |
| Scale: Moderation queue grows | Batch ops UI + auto-prescreen to reduce queue load |
| Security: Auth bypass | Standard practices (argon2, httpOnly cookies, CSRF tokens) |
| Complexity: Phase 1 refactor risk | Incremental, not rewrite; preserve tests; modularize first |

---

## Success Criteria

### Phase 1 (Backend Spine)
- ✅ Postgres migrations run without errors
- ✅ Upload endpoint accepts multipart form, stores in object storage
- ✅ pHash duplicate detection triggers correctly
- ✅ Auth middleware protects moderation/upload routes
- ✅ Existing 35 tests ported and passing

### Phase 2 (Moderation)
- ✅ Moderator can approve/reject pending works
- ✅ Approved works appear in public gallery
- ✅ Rejection reason shown to uploader

### Phase 3 (Upload Flow)
- ✅ Member can submit meme or art
- ✅ Pre-screen catches invalid formats, oversized files
- ✅ Duplicate works rejected with link to original

### Phase 4 (Art Gallery)
- ✅ Art gallery accessible via UI
- ✅ Art-specific facets (artist, medium, rating) functional
- ✅ Rating filter applied correctly

### Phase 5 (Production)
- ✅ No critical security vulnerabilities (OWASP Top 10)
- ✅ 95th percentile upload latency < 3s
- ✅ Health check endpoint returns 200

---

## Estimated Timeline (Rough)

| Phase | Estimated Effort | Parallelizable? |
|-------|-----------------|-----------------|
| 0: Design | 1 day | — |
| 1: Backend Spine | 2-3 weeks | Partially (1.1-1.4 can overlap) |
| 2: Moderation | 1 week | Some backend/frontend overlap |
| 3: Upload Flow | 1 week | Some backend/frontend overlap |
| 4: Art Gallery | 3-5 days | Mostly frontend |
| 5: Hardening | 1-2 weeks | Ongoing |

**Total**: ~6-8 weeks for MVP (single developer, full-time equivalent)

**Assumptions**: Developer familiar with Rust, React, Postgres. Includes testing time.

---

## Next Actions

**当前状态**：Phase 1 全部完成，Phase 2 前端画廊界面进行中。

**Phase 2 优先项**（详见 `phase2-plan.md`）：
1. **认证界面**：登录/注册页面 + 路由保护
2. **作品列表 API**：`GET /api/works`（分页、筛选、排序）
3. **作品列表页**：Meme/Art 双画廊网格
4. **作品详情 API + 页面**：`GET /api/works/:id` + 大图查看器
5. **上传界面**：拖拽上传 + 元数据表单
6. **用户中心**：我的上传列表 + 统计

**阻塞项**：Phase 2 前端页面依赖后端 `GET /api/works` 和 `GET /api/works/:id` API（尚未实现）。
