# Hasu Gallery - 项目文档

[根目录](./) > **hasu-gallery**

**变更记录 (Changelog)**
- 2026-07-03: Phase 1-4 审查与真实浏览器回归 — 修复后端 env 加载、注册 session、前端 auth 竞态、审核权限边界、Postgres enum 解码、开发代理本机连接与 review 字段写入
- 2026-06-22: Phase 3 完成 — 审核工作流全部实现（+824 行代码：后端 300 行 + 前端 524 行）
- 2026-06-17: Phase 2 完成 — 前端画廊界面、上传流程、用户个人页全部实现（+2,562 行代码）
- 2026-06-17: Phase 1 完成 — 数据库迁移、认证系统、上传流水线全部落地
- 2026-06-14: 初始化项目架构，基于 linkura-apps 技术栈（Rspack + TanStack + Tailwind v4）
- 2026-06-14: 迁移 Phase 0 规范与 roadmap，确认方案 C（双轨拆仓）

---

## 项目愿景

Hasu Gallery 是一个面向「莲之空（Hasu no Sora）」的**双画廊 UGC 平台**，支持用户上传、审核与浏览 Meme 和 Art 作品。项目采用 **monorepo 架构**，前端专注用户体验与交互，后端负责数据管理、审核流程与对象存储。

### 核心体验目标

1. **双画廊模式**：Meme Gallery（表情包）+ Art Gallery（同人画作），独立策展与审核
2. **UGC 流程**：用户上传 → 审核队列 → 发布/拒绝 → 公开浏览
3. **性能优先**：支持大规模作品库的流畅浏览与服务端筛选
4. **灵活部署**：前端静态化 + 后端独立 API，支持多种托管方式

---

## 架构总览

### 技术栈

**前端**
- Rspack 1.1 + React 19 + TypeScript 5.7
- TanStack Router（路由）+ TanStack Query（数据请求）+ zustand（状态管理）
- Tailwind v4（`@theme` tokens）+ storybook-react-rsbuild
- pnpm workspace 管理

**后端**
- Rust（Axum 0.7 + tokio 1）
- PostgreSQL 16（sqlx 0.7，连接池 20 连接）
- MinIO S3（aws-sdk-s3 1.52，内网 `<edge-s3-host>:9000`）
- argon2 0.5 密码哈希 + tower-sessions 0.12（PostgreSQL 存储，7 天过期）
- image 0.25（缩略图生成，Lanczos3 400x400 JPEG）

**开发工具**
- pnpm 10.26.2（包管理与脚本）
- Cargo（Rust 构建与测试）
- PowerShell（主要 shell 环境）

### 部署模式

1. **开发模式**：Rspack dev server + Cargo API
2. **生产模式**：静态前端（可部署到 CDN）+ 独立 Rust API 二进制
3. **混合模式**：前端 SSR 平台 + 独立 API 服务

---

## Monorepo 结构

```
hasu-gallery/
├── apps/
│   └── web/                   # @hasu-gallery/web - React 前端应用
│       ├── rspack.config.js   # Rspack 配置
│       ├── src/
│       │   ├── main.tsx
│       │   ├── router.tsx     # TanStack Router（8 个路由）
│       │   ├── store/         # zustand 状态
│       │   │   ├── index.ts
│       │   │   └── auth.ts    # 认证状态
│       │   ├── pages/         # 页面组件
│       │   │   ├── LoginPage.tsx
│       │   │   ├── RegisterPage.tsx
│       │   │   ├── GalleryPage.tsx      # 作品列表（meme/art）
│       │   │   ├── WorkDetailPage.tsx   # 作品详情
│       │   │   ├── UploadPage.tsx       # 上传界面
│       │   │   ├── ProfilePage.tsx      # 用户个人页
│       │   │   └── ModerationPage.tsx   # 审核仪表板
│       │   ├── components/    # 业务组件
│       │   │   ├── AuthGuard.tsx
│       │   │   ├── ModeratorGuard.tsx   # 审核员权限保护
│       │   │   ├── WorkCard.tsx         # 作品卡片
│       │   │   ├── WorksGrid.tsx        # 作品网格
│       │   │   ├── FilterPanel.tsx      # 筛选面板
│       │   │   ├── Pagination.tsx       # 分页控制
│       │   │   ├── FileDropZone.tsx     # 拖拽上传区
│       │   │   ├── ImagePreview.tsx     # 图片预览
│       │   │   ├── UploadForm.tsx       # 上传表单
│       │   │   ├── StatsCard.tsx        # 统计卡片
│       │   │   ├── MyWorksList.tsx      # 我的作品列表
│       │   │   ├── ModerationActions.tsx # 审核操作按钮
│       │   │   └── ModerationLog.tsx    # 审核日志展示
│       │   ├── api/           # API 客户端
│       │   │   ├── client.ts   # fetchJson 封装
│       │   │   ├── auth.ts     # 认证 API
│       │   │   ├── works.ts    # 作品列表/详情 API
│       │   │   ├── upload.ts   # 上传 API
│       │   │   ├── profile.ts  # 用户统计/我的作品 API
│       │   │   └── moderation.ts # 审核队列/状态变更/日志 API
│       │   └── styles/
│       └── public/
├── packages/
│   ├── ui/                    # @hasu-gallery/ui - 组件库
│   │   ├── .storybook/        # Storybook 配置
│   │   ├── src/
│   │   │   ├── primitives/    # 基础组件（Button 等）
│   │   │   ├── styles/
│   │   │   │   └── tokens.css # Tailwind v4 tokens
│   │   │   └── lib/
│   │   └── package.json
│   └── types/                 # @hasu-gallery/types - 共享类型
│       └── src/
│           ├── models.ts      # Work/User 等
│           └── api.ts         # API 响应类型
└── backend/                   # Rust API（不在 pnpm workspace）
    ├── Cargo.toml
    ├── migrations/
    │   └── 001_initial.sql     # Phase 0 DDL（9 表 + 5 枚举 + 2 触发器）
    └── src/
        ├── main.rs             # 服务器入口 + CORS + 路由注册
        ├── db.rs               # 连接池 + 迁移运行
        ├── auth.rs             # argon2 密码哈希/验证
        ├── storage.rs          # S3 客户端 + 上传
        ├── image_processor.rs  # 缩略图生成 + 格式检测
        ├── middleware.rs       # 权限中间件（require_moderator）
        ├── models/
        │   ├── mod.rs
        │   └── user.rs         # User 模型 + 注册/登录请求
        └── routes/
            ├── mod.rs
            ├── auth.rs         # register/login/logout/me
            ├── upload.rs       # multipart 上传 + 验证
            ├── works.rs        # 作品列表/详情 API
            ├── users.rs        # 用户统计/我的作品 API
            └── moderation.rs   # 审核队列/状态变更/日志 API
```

---

## 运行与开发

### 环境要求

- **Node.js**: 推荐 LTS 20+
- **pnpm**: 10.26.2+
- **Rust**: 1.70+（包含 Cargo）
- **Postgres**: 16+
- **操作系统**: Windows 11 Pro（主要开发环境）

### 安装依赖

```powershell
# 安装前端依赖
pnpm install
```

### 本地开发

```powershell
# 启动后端 API (端口 8787)
pnpm run dev:api

# 启动前端开发服务器 (端口 5173)
pnpm run dev

# 启动 Storybook (端口 6006)
pnpm run storybook
```

### 生产构建

```powershell
# 构建前端
pnpm run build

# 构建后端二进制
cargo build --release --manifest-path backend/Cargo.toml
```

---

## 编码规范

### 前端规范

1. **组件结构**: 使用 React 函数组件与 hooks，复杂逻辑优先抽到 `src/hooks/` 或 zustand store
2. **样式管理**: Tailwind v4 + `@theme` tokens，避免内联样式
3. **类型安全**: TypeScript 严格模式，共享类型在 `packages/types`
4. **路由管理**: TanStack Router 文件路由，类型安全导航
5. **状态管理**: zustand（全局状态）+ TanStack Query（服务端状态）
6. **命名约定**:
   - 组件：PascalCase（如 `MemeGrid.tsx`）
   - hooks：`use` 前缀（如 `useAppStore.ts`）
   - 函数/变量：camelCase（如 `fetchWorkList`）
   - 常量：UPPER_SNAKE_CASE（如 `API_BASE_URL`）

### 后端规范

1. **错误处理**: 使用 `Result<T, String>` 统一错误传播
2. **并发安全**: 使用 `Arc<Mutex<T>>` 保护共享状态
3. **资源管理**: 利用 RAII 与 `Drop` 确保资源释放
4. **命名约定**:
   - 模块：snake_case（如 `work_service`）
   - 类型：PascalCase（如 `WorkResponse`）
   - 常量：SCREAMING_SNAKE_CASE（如 `API_CACHE_CONTROL`）

### Git 提交规范

遵循 Conventional Commits（英文）：

```
feat: add upload workflow
fix: resolve S3 connection timeout
docs: update deployment guide
test: add moderation API tests
chore: upgrade dependencies
```

---

## AI 使用指引

### 项目上下文

1. **架构约束**: 前后端独立，不耦合部署
2. **数据流**: PostgreSQL → Rust API（Axum） → React Frontend（TanStack Query）
3. **存储流**: 用户上传 → Rust API 验证 → S3/MinIO 原图 + 缩略图 → Nginx 公开代理
4. **关键文件**:
   - 前端类型: `packages/types/src/models.ts`
   - 前端路由: `apps/web/src/router.tsx`
   - 后端入口: `backend/src/main.rs`
   - 数据模型: `.ccg/spec/phase0-content-core-model.md`

### 常见任务

1. **新增作品字段**:
   - 修改 `backend/migrations/` 添加新迁移
   - 更新 `packages/types/src/models.ts` 中的 `Work` 类型
   - 同步后端 routes 中的 SQL 查询与 API 响应结构

2. **添加页面路由**:
   - 在 `apps/web/src/router.tsx` 添加新 route
   - 使用 TanStack Router 的类型安全导航
   - 配置路由级数据预加载（loader）

3. **添加筛选维度**:
   - 前端: 更新 zustand store 或页面组件状态
   - 后端: 扩展 `GET /api/works` 查询参数与 SQL WHERE 过滤
   - 类型: 同步 `packages/types/src/api.ts` 请求/响应类型

### 注意事项

- ❌ 不要在前端 `public/` 存放用户上传作品（使用 S3 URL `https://cdn.example.com/hasu-gallery/`）
- ❌ 不要硬编码作品数据到组件中
- ✅ 优先使用 PostgreSQL 维护数据结构
- ✅ 保持 API 契约稳定，前端只消费 JSON 响应
- ✅ 大量数据筛选优先走服务端 `GET /api/works?gallery=&status=&page=&limit=`
- ✅ 上传必须先登录（session cookie），gallery=meme 必须提供 origin

---

## 相关文件清单

### 根目录配置

- `package.json` - 根脚本（前后端启动、构建）
- `pnpm-workspace.yaml` - pnpm workspace 配置
- `README.md` - 用户文档（本文件）
- `CLAUDE.md` - AI 开发指引（本文件）
- `.ccg/spec/phase0-content-core-model.md` - Phase 0 数据模型规范
- `.ccg/spec/roadmap.md` - 项目路线图
- `.ccg/spec/phase1-summary.md` - Phase 1 实施总结
- `.ccg/spec/phase2-plan.md` - Phase 2 前端实施计划
- `.ccg/spec/phase3-plan.md` - Phase 3 执行计划
- `.ccg/spec/phase3-summary.md` - Phase 3 实施总结
- `docs/edge-server-setup.md` - 边缘服务器部署指南

### 前端关键文件

- `apps/web/src/main.tsx` - 应用入口
- `apps/web/src/router.tsx` - TanStack Router 配置
- `apps/web/src/store/index.ts` - zustand 全局状态
- `apps/web/rspack.config.js` - Rspack 配置
- `packages/ui/src/index.ts` - UI 组件库导出
- `packages/ui/src/styles/tokens.css` - Tailwind v4 tokens
- `packages/types/src/models.ts` - 共享类型定义

### 后端关键文件

- `backend/src/main.rs` - API 服务器入口（路由注册、CORS、session）
- `backend/src/db.rs` - 数据库连接池与迁移
- `backend/src/auth.rs` - argon2 密码哈希与验证
- `backend/src/storage.rs` - S3 客户端与文件上传
- `backend/src/image_processor.rs` - 缩略图生成（400x400 Lanczos3）
- `backend/src/middleware.rs` - 权限中间件（require_moderator）
- `backend/src/routes/auth.rs` - 认证 API（register/login/logout/me）
- `backend/src/routes/upload.rs` - 上传 API（multipart + 验证）
- `backend/src/routes/moderation.rs` - 审核 API（queue/status/log）
- `backend/src/models/user.rs` - 用户模型与请求验证
- `backend/migrations/001_initial.sql` - 数据库 DDL
- `backend/Cargo.toml` - Rust 依赖声明
- `backend/.env` - 环境变量（不提交）

---

## 缺口与下一步

### 当前状态

✅ **Phase 0（骨架期）已完成**：
- Monorepo 结构已搭建
- Rspack + TanStack 技术栈就位
- Tailwind v4 + Storybook 配置完成
- Phase 0 数据模型规范落地

✅ **Phase 1（后端基础设施）已完成**：
- PostgreSQL 数据库迁移（9 表 + 5 枚举 + 2 触发器）
- 认证系统（argon2id + tower-sessions + 4 个 API 端点）
- 上传流水线（S3/MinIO + 缩略图生成 + 格式验证）
- 边缘服务器部署（PostgreSQL @ <edge-db-host>，MinIO @ <edge-s3-host>）

✅ **Phase 2（前端画廊界面）已完成**（+2,562 行代码）

✅ **Phase 3（审核工作流）已完成**（+824 行代码）：

**3.1 审核队列 API**（300 行后端）
- middleware.rs - 权限中间件（require_moderator）
- routes/moderation.rs - 审核队列、状态变更、日志 API
- 角色权限控制（moderator/admin only）
- 事务安全的状态变更 + 日志记录

**3.2 审核仪表板**（524 行前端）
- ModerationPage - 审核队列界面
- ModeratorGuard - 权限路由保护
- ModerationActions - 批准/拒绝/下架按钮
- ModerationLog - 审核历史展示
- api/moderation.ts - 审核 API 客户端

✅ **2026-07-03 回归补强已完成**：
- `pnpm dev:api` 从仓库根目录可正确加载 `backend/.env`
- 注册后后端 session 与前端 auth store 同步
- AuthGuard / ModeratorGuard 等待首次认证恢复，避免刷新或慢查询时误跳转
- 普通用户访问 `/moderation` 不会发起审核队列请求
- 审核状态变更同步写入 `reviewed_by`、`reviewed_at`、`review_note`
- Postgres enum 字段以 text 返回，避免详情页/列表页解码为 `String` 时 500
- 本地开发 API 默认直连 `http://127.0.0.1:8787`，避免 Rspack dev proxy 在 Windows 上偶发 `/api/auth/me` EACCES
- 真实浏览器回归通过：注册、Meme/Art MinIO 上传、owner pending 详情、审核批准、公开画廊、Art rating 筛选、个人页统计与审核日志均已验证

**Phase 2 详情**：

**2.1 认证界面**（543 行）
- LoginPage + RegisterPage（表单验证 + 错误提示）
- AuthGuard 路由保护
- zustand auth store（用户状态管理）

**2.2 作品列表页**（575 行）
- GalleryPage（可复用，支持 meme/art）
- WorksGrid + WorkCard（响应式网格）
- FilterPanel（status/origin/sort 筛选）
- Pagination 组件
- 后端 API：`GET /api/works`（分页 + 筛选 + 排序）

**2.3 作品详情页**（277 行）
- WorkDetailPage（大图查看 + 元数据面板）
- 下载功能 + 返回导航
- 后端 API：`GET /api/works/:id`（404 处理）

**2.4 上传界面**（558 行）
- UploadPage（完整上传流程）
- FileDropZone（拖拽 + 文件验证）
- ImagePreview（预览 + 尺寸检测）
- UploadForm（多字段表单 + 条件显示）
- upload API 客户端（FormData + multipart）

**2.5 用户个人页**（609 行）
- ProfilePage（用户信息 + 统计 + 我的上传）
- StatsCard 组件（4 种 variant）
- MyWorksList（状态徽章 + 筛选）
- 后端 API：`GET /api/users/me/stats`、`GET /api/users/me/works`

### 推荐下一步（Phase 4 - Art Gallery）

> 2026-07-03 审查：画廊切换、Art 上传元数据、rating 筛选已有基础实现并通过真实浏览器验收；偏好持久化、Art facets、artist/medium 搜索体验进入 Phase 5 production hardening。

1. **画廊切换器**
   - 顶层 tab/下拉菜单：Meme Gallery vs Art Gallery
   - 复用现有组件（WorksGrid, FilterPanel）
   - 切换数据源：`GET /api/works?gallery=art`

2. **Art 元数据增强**
   - 上传表单支持 artist, medium, rating 字段
   - 作品详情页显示 art 专属元数据
   - Art 画廊筛选器：artist, medium, rating

3. **内容过滤**
   - Rating 系统（all_ages/r15/r18）
   - 默认过滤（guest 只看 all_ages）
   - 用户偏好设置（Cookie/Session 持久化）

---

## 技术债务

1. ~~`frontend/` 尚未实现任何页面（仅骨架就位）~~ ✅ Phase 2 完成
2. ~~审核工作流未实现~~ ✅ Phase 3 完成
3. 缺少前端测试（Vitest + Testing Library 未配置）
4. 缺少后端集成测试（仅有单元测试）
5. 缺少 CI/CD 流水线（GitHub Actions 未配置）
6. 缺少生产环境错误监控与性能指标收集
7. 缺少批量审核操作（Phase 3 计划中标记为可选）

---

## API 路由清单

### 认证 API
- `POST /api/auth/register` - 用户注册（handle, email, password, display_name）
- `POST /api/auth/login` - 用户登录（handle, password）
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息（需要 session）

### 作品 API
- `GET /api/works` - 作品列表
  - 参数：gallery（必填），status, origin（meme only）, page, limit, sort
  - 返回：{ works: WorkItem[], pagination: {...} }
  
- `GET /api/works/:id` - 作品详情
  - 返回：WorkItem（含完整元数据）
  - 404 如果作品不存在
  
- `POST /api/works/upload` - 上传作品（需要认证）
  - multipart/form-data：file, title, gallery, origin（meme 必填）, source, source_url
  - 返回：上传成功的 WorkItem

### 用户 API
- `GET /api/users/me/stats` - 当前用户统计（需要认证）
  - 返回：{ total, pending, approved, rejected }
  
- `GET /api/users/me/works` - 我的上传列表（需要认证）
  - 参数：status（可选）, page, limit
  - 返回：{ works: WorkItem[], pagination: {...} }

### 审核 API（需要 moderator/admin 权限）
- `GET /api/moderation/queue` - 审核队列
  - 参数：gallery（必填）, status, page, limit
  - 返回：{ works: QueueWorkItem[], pagination: {...} }

- `PATCH /api/works/:id/status` - 更新作品状态
  - 请求体：{ status: "approved"|"rejected"|"takedown", note?: string }
  - 返回：{ id, status, updated_at }

- `GET /api/moderation/log/:work_id` - 审核日志
  - 返回：{ work_id, logs: ModerationLogEntry[] }

### 健康检查
- `GET /health` - 服务器健康检查

---

## .context 项目上下文

> 项目使用 `.context/` 管理开发决策上下文（如存在）。

- **编码规范**: `.context/prefs/coding-style.md` - 定义团队编码风格指南
- **工作流规则**: `.context/prefs/workflow.md` - 定义 LLM 开发工作流强制规则
- **决策历史**: `.context/history/commits.md` - 归档所有提交的关键决策与教训
