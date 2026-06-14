# hasu-gallery Evolution Roadmap

**Project**: hasu-gallery (新仓独立项目)  
**Vision**: Dual-gallery UGC platform (Meme Gallery + Art Gallery) with upload & moderation  
**Created**: 2026-06-09  
**Last Synced**: 2026-06-14  
**Status**: ✅ 方案 C 已选择 - 双轨拆仓，hasu-gallery 为新建 UGC 平台，hasu-memes 保持只读画廊终态

> **架构更新 (2026-06-14)**: 基于 linkura-apps 分析，采用 Rspack + TanStack Router/Query + zustand + Tailwind v4 技术栈

---

## 状态快照（2026-06-13 对照）

> 本节由 `master` 分支 + `backend/Cargo.toml` + `backend/src/` + 最近 20 个 commit 客观核对得出。**不替项目做方向决策**，只标注差距。

| Phase | 路线图声明 | 实际代码状态 | 差距 |
|---|---|---|---|
| **0: Foundation & Design** | ✅ COMPLETE | ✅ 规范文件已落地（`.ccg/spec/phase0-content-core-model.md`），决策表完整 | — |
| **1.1 Postgres 迁移** | ⏳ Ready to begin | ❌ `backend/Cargo.toml` 仍仅含 `axum + rusqlite + tokio + tower-http`；**零** sqlx/deadpool/argon2 依赖 | 未启动 |
| **1.2 替换 MemeDataCache** | ⏳ Ready to begin | ❌ `MemeDataCache` 仍是核心数据源（main.rs 3183 行） | 未启动 |
| **1.3 模块化 main.rs** | ⏳ Ready to begin | ❌ `backend/src/` 仍是扁平的 `main.rs` + `catalog.rs` + `facets.rs` + 两个 bin；无 `routes/ handlers/ middleware/ storage/ security/` | 未启动 |
| **1.4 Auth 中间件** | ⏳ Ready to begin | ❌ Grep `argon2\|session\|tower-http` 在路由保护中无命中 | 未启动 |
| **1.5 上传流水线** | ⏳ Ready to begin | ❌ 无 `POST /api/upload`、无 pHash 依赖、无 S3 客户端 | 未启动 |
| **1.6 动态 Facets** | ⏳ Ready to begin | ❌ `facets.rs` 仍从静态 `catalog.rs` 聚合（200 行） | 未启动 |
| **1.7 API 扩展** | ⏳ Ready to begin | ❌ 仅有 `GET /api/memes`，无 `?gallery=` 分流 | 未启动 |
| **2-5** | ⏳ 未开始 | ⏳ 未开始 | — |

**重要偏差（须在动手前决策方向）**：

1. **方向冲突**：最近 5 个 commit 集中在「Vercel 纯静态部署 + 静态数据导出 + 拆分静态详情」（消减 Rust 运行依赖）；路线图 Phase 1 规划「引入 Postgres + 鉴权 + S3 + 审核」（加深 Rust 依赖）。两条方向互为反方向，**强行推进 Phase 1 会推翻刚上线的静态化成果**。
2. ~~**数据规模声明失真**：路线图 Phase 0 文档写「3499 activity-record test items 充分」~~ ✅ **已核对，数字准确**（`tmp/real-memes/assets/` 精确为 3499 个图片，分布 webp 1992 / jpg 983 / png 510 / gif 14）
3. **README.md 完全无 UGC/Postgres/审核字样**：README 仍以「SQLite 单文件 + 本地 Rust API + Vercel 静态化」为主叙事，与 Phase 0/1 规范不一致。

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

**当前状态**：Phase 0 规范文档已落地，但与最近工作流方向冲突；Phase 1 任一子项未启动。

**先决项（阻塞所有 Phase 1 工作）**：

1. **⚠️ 方向决策**（必须先做，不能跳过）：
   - **A. 追路线图**：开始 Phase 1.1（Postgres 迁移）+ 1.3（模块化骨架），按规划演进 UGC 平台
   - **B. 重置路线图**：把 hasu-memes 定位为「只读画廊终态」，更新 roadmap.md 删除 Phase 1-5 内容，补"性能/可访问性/CI"作为新路线
   - **C. 双轨**：当前仓保持只读画廊；UGC 拆新仓 `hasu-gallery`（先迁 Phase 0 规范），主仓标记路线图「已迁移」
   - **D. 冻结**：维持现状，停止路线图相关工作，等业务侧给出新信号

2. **已落地的具体可补工作**（不依赖方向决策）：
   - 刷新 `README.md` 增加 Phase 0 数据模型简介（当前完全无 UGC 字样）
   - 同步 `tmp/real-memes/assets/` 实际规模（已核对：3499 项，分布 webp 1992 / jpg 983 / png 510 / gif 14）
   - 把 `backend/Cargo.toml` 实际依赖图与 Phase 1 计划依赖的差距作为 gap 清单归档到本文件

3. **若选 A 启动 Phase 1**（顺序敏感）：
   - 1.1 Postgres + 迁移工具（阻塞 1.2/1.5/1.6/1.7）
   - 1.3 模块化 main.rs（必须先于 1.2 缓存替换，避免双重重构）
   - 1.4 Auth 中间件（与 1.3 部分可并行）
   - 1.6 动态 Facets（依赖 1.1）
   - 1.5 上传流水线（依赖 1.4 + 1.6）
   - 1.2 替换 MemeDataCache（最后做，因为会改变所有 handler 的数据获取路径）

4. **若选 B 收口**：删除 `.ccg/spec/phase0-content-core-model.md` 中已废弃的 Postgres/S3 决策；路线图章节简化为「只读画廊」三项：性能（虚拟滚动/缩略图优先）、可访问性（aria/键盘导航）、CI 矩阵扩展。
