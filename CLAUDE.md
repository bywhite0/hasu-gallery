# Hasu Gallery - 项目文档

[根目录](./) > **hasu-gallery**

**变更记录 (Changelog)**
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
- Postgres 16（sqlx 0.7）
- S3-compatible 对象存储
- argon2 认证 + tower-sessions

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
│       │   ├── router.tsx     # TanStack Router
│       │   ├── store/         # zustand 状态
│       │   ├── pages/         # 页面组件
│       │   ├── components/    # 业务组件
│       │   └── styles/
│       └── public/
├── packages/
│   ├── ui/                    # @hasu-gallery/ui - 组件库
│   │   ├── .storybook/        # Storybook 配置
│   │   ├── src/
│   │   │   ├── primitives/    # 基础组件
│   │   │   ├── styles/
│   │   │   │   └── tokens.css # Tailwind v4 tokens
│   │   │   └── lib/
│   │   └── package.json
│   └── types/                 # @hasu-gallery/types - 共享类型
│       └── src/
│           ├── models.ts      # Work/User 等
│           └── api.ts
└── backend/                   # Rust API（不在 pnpm workspace）
    ├── Cargo.toml
    └── src/
        └── main.rs
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
2. **数据流**: Postgres → Rust API → React Frontend
3. **关键文件**:
   - 前端类型: `packages/types/src/models.ts`
   - 前端路由: `apps/web/src/router.tsx`
   - 后端入口: `backend/src/main.rs`
   - 数据模型: `.ccg/spec/phase0-content-core-model.md`

### 常见任务

1. **新增作品字段**:
   - 修改 `backend/migrations/` 数据库迁移
   - 更新 `packages/types/src/models.ts` 中的 `Work` 类型
   - 同步 API 响应结构

2. **添加页面路由**:
   - 在 `apps/web/src/router.tsx` 添加新 route
   - 使用 TanStack Router 的类型安全导航
   - 配置路由级数据预加载（loader）

3. **添加筛选维度**:
   - 前端: 更新 zustand store 或页面组件状态
   - 后端: 扩展查询参数与 SQL 过滤逻辑
   - 类型: 同步 API 请求/响应类型

### 注意事项

- ❌ 不要在前端 `public/` 存放用户上传作品（使用 S3 URL）
- ❌ 不要硬编码作品数据到组件中
- ✅ 优先使用 Postgres 维护数据结构
- ✅ 保持 API 契约稳定，前端只消费 JSON 响应
- ✅ 大量数据筛选优先走服务端（避免前端全量加载）

---

## 相关文件清单

### 根目录配置

- `package.json` - 根脚本（前后端启动、构建）
- `pnpm-workspace.yaml` - pnpm workspace 配置
- `README.md` - 用户文档（本文件）
- `CLAUDE.md` - AI 开发指引（本文件）
- `.ccg/spec/phase0-content-core-model.md` - Phase 0 数据模型规范
- `.ccg/spec/roadmap.md` - 项目路线图

### 前端关键文件

- `apps/web/src/main.tsx` - 应用入口
- `apps/web/src/router.tsx` - TanStack Router 配置
- `apps/web/src/store/index.ts` - zustand 全局状态
- `apps/web/rspack.config.js` - Rspack 配置
- `packages/ui/src/index.ts` - UI 组件库导出
- `packages/ui/src/styles/tokens.css` - Tailwind v4 tokens
- `packages/types/src/models.ts` - 共享类型定义

### 后端关键文件

- `backend/src/main.rs` - API 服务器入口
- `backend/Cargo.toml` - Rust 依赖声明
- `backend/.env.example` - 环境变量示例

---

## 缺口与下一步

### 当前状态

✅ **Phase 0（骨架期）已完成**：
- Monorepo 结构已搭建
- Rspack + TanStack 技术栈就位
- Tailwind v4 + Storybook 配置完成
- 后端 Rust 骨架就位

### 推荐下一步（Phase 1）

1. **数据库迁移**（Phase 1.1）
   - 创建 `backend/migrations/` 目录
   - 按 Phase 0 DDL 定义 Postgres 表结构
   - 配置 sqlx 离线模式

2. **认证中间件**（Phase 1.2）
   - argon2 密码哈希
   - tower-sessions session 管理
   - 登录/注册 API

3. **上传流水线**（Phase 1.3）
   - S3 对象存储集成
   - 文件上传 API
   - 缩略图生成

4. **审核工作台**（Phase 1.4）
   - 审核队列页面
   - 批准/拒绝操作
   - 权限控制

5. **画廊浏览**（Phase 1.5）
   - Meme Gallery 页面
   - Art Gallery 页面
   - 筛选与搜索

---

## 技术债务

1. 缺少前端测试（Vitest + Testing Library）
2. 缺少后端集成测试（Postgres 测试容器）
3. 缺少错误监控（生产环境）
4. 缺少性能监控（Web Vitals）

---

## .context 项目上下文

> 项目使用 `.context/` 管理开发决策上下文（如存在）。

- **编码规范**: `.context/prefs/coding-style.md` - 定义团队编码风格指南
- **工作流规则**: `.context/prefs/workflow.md` - 定义 LLM 开发工作流强制规则
- **决策历史**: `.context/history/commits.md` - 归档所有提交的关键决策与教训
