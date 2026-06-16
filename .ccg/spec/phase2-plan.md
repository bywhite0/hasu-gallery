# Phase 2: 前端画廊界面

## 目标

构建用户友好的 Web 画廊界面，允许浏览、上传、筛选和管理作品。

## 技术栈

- **Rspack 1.1** + React 19 + TypeScript 5.7
- **TanStack Router** 路由管理（类型安全导航）
- **TanStack Query** 异步状态管理
- **zustand** 全局状态
- **Tailwind v4**（`@theme` tokens）
- **@hasu-gallery/ui** 组件库（Button 等基础组件已就位）

## 子阶段规划

### 2.1 认证界面（1天）

**页面**
- `/login` - 登录页
- `/register` - 注册页

**组件**
- `AuthLayout` - 认证页面布局
- `LoginForm` - 登录表单
- `RegisterForm` - 注册表单
- `AuthGuard` - 路由保护

**功能**
- 表单验证（email 格式、密码强度）
- 错误提示（API 错误反馈）
- 自动跳转（登录后回到原页面）
- Session 持久化（cookie 自动管理）

**API 集成**
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`

---

### 2.2 作品列表页（2天）

**路由**
- `/gallery/meme` - 表情包画廊
- `/gallery/art` - 艺术作品画廊

**组件**
- `GalleryLayout` - 画廊布局（导航 + 侧边栏）
- `WorksGrid` - 作品网格展示
- `WorkCard` - 单个作品卡片
- `FilterPanel` - 筛选面板
- `Pagination` - 分页组件

**功能**
- 响应式网格布局（移动端 1 列，平板 2-3 列，桌面 4-6 列）
- 图片懒加载（`loading="lazy"` + Intersection Observer）
- 筛选器：状态、来源（meme）、上传时间
- 排序：按创建时间、按标题
- 缩略图预览（hover 显示大图）

**API 集成**
- `GET /api/works?gallery={meme|art}&status=approved&page=1&limit=24`

**待实现后端 API**
```rust
GET /api/works
Query params:
  - gallery: meme | art
  - status: pending | approved | rejected (默认 approved)
  - origin: official | derivative | fan_made (meme 专用)
  - page: 页码（默认 1）
  - limit: 每页数量（默认 24）
  - sort: created_at_desc | created_at_asc | title_asc

Response:
{
  "works": [
    {
      "id": "uuid",
      "gallery": "meme",
      "origin": "official",
      "title": "...",
      "status": "approved",
      "thumbnail_url": "https://...",
      "width": 800,
      "height": 600,
      "created_at": "2026-06-15T..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 156,
    "total_pages": 7
  }
}
```

---

### 2.3 作品详情页（1天）

**路由**
- `/works/:id` - 作品详情

**组件**
- `WorkDetail` - 详情页主体
- `ImageViewer` - 大图查看器（支持缩放、平移）
- `MetadataPanel` - 元数据面板
- `ActionButtons` - 操作按钮组

**功能**
- 原图展示（点击放大、滚轮缩放）
- 元数据显示：标题、尺寸、上传者、上传时间、来源、状态
- 操作按钮：下载原图、复制链接、编辑（owner/moderator）、删除（owner/admin）
- 键盘导航（左右键切换上下作品）

**API 集成**
- `GET /api/works/:id`

**待实现后端 API**
```rust
GET /api/works/:id

Response:
{
  "id": "uuid",
  "gallery": "meme",
  "origin": "official",
  "title": "...",
  "status": "approved",
  "file_url": "https://...",
  "thumbnail_url": "https://...",
  "width": 1920,
  "height": 1080,
  "source": "...",
  "source_url": "https://...",
  "uploader": {
    "id": 1,
    "handle": "testuser",
    "display_name": "Test User"
  },
  "created_at": "2026-06-15T...",
  "updated_at": "2026-06-15T..."
}
```

---

### 2.4 上传界面（1天）

**路由**
- `/upload` - 上传页面

**组件**
- `UploadForm` - 上传表单
- `FileDropzone` - 拖拽上传区域
- `ImagePreview` - 上传前预览
- `UploadProgress` - 上传进度条
- `MetadataForm` - 元数据填写

**功能**
- 拖拽上传 + 点击选择
- 图片预览（客户端）
- 元数据填写：标题、画廊类型、来源、来源说明、来源 URL、版权说明
- 上传进度反馈
- 批量上传（一次多张）
- 上传后跳转到详情页

**API 集成**
- `POST /api/works/upload`（已实现）

---

### 2.5 用户中心（1天）

**路由**
- `/profile` - 个人中心
- `/profile/uploads` - 我的上传

**组件**
- `ProfileLayout` - 用户中心布局
- `ProfileHeader` - 用户信息头
- `MyUploads` - 我的作品列表
- `UploadStats` - 上传统计

**功能**
- 显示用户信息（头像、昵称、角色）
- 我的上传列表（支持筛选状态）
- 上传统计：总上传数、审核通过/待审核/已拒绝
- 快捷操作：编辑作品元数据、删除作品

**API 集成**
- `GET /api/auth/me`
- `GET /api/works?uploader_id={user_id}`
- `DELETE /api/works/:id`
- `PATCH /api/works/:id`

**待实现后端 API**
```rust
DELETE /api/works/:id
  Auth: owner | moderator | admin

PATCH /api/works/:id
  Body: {
    "title": "...",
    "source": "...",
    "source_url": "...",
    "rights_note": "..."
  }
  Auth: owner | moderator
```

---

## 实施顺序

### Week 1
1. **Day 1**: 2.1 认证界面 + 路由保护
2. **Day 2-3**: 2.2 作品列表页 + 后端 `GET /api/works` API
3. **Day 4**: 2.3 作品详情页 + 后端 `GET /api/works/:id` API

### Week 2
4. **Day 5**: 2.4 上传界面
5. **Day 6**: 2.5 用户中心 + 后端 `DELETE/PATCH /api/works/:id` API
6. **Day 7**: 集成测试 + UI 优化

---

## 后端 API 开发清单

### 新增端点
- [ ] `GET /api/works` - 作品列表（带分页、筛选、排序）
- [ ] `GET /api/works/:id` - 作品详情
- [ ] `DELETE /api/works/:id` - 删除作品
- [ ] `PATCH /api/works/:id` - 更新作品元数据

### 已有端点（Phase 1）
- [x] `POST /api/auth/register`
- [x] `POST /api/auth/login`
- [x] `POST /api/auth/logout`
- [x] `GET /api/auth/me`
- [x] `POST /api/works/upload`

---

## 设计参考

### 布局风格
- **简洁现代**：大量留白，卡片式设计
- **图片优先**：缩略图为主，文字为辅
- **响应式**：移动端 1 列，平板 2-3 列，桌面 4-6 列

### 配色方案
- 使用 `packages/ui/src/styles/tokens.css` 中定义的 token：
  - `--color-paper`、`--color-ink`、`--color-accent`、`--color-sakura`
- 背景：浅灰（paper）/ 深色模式（ink）

### 权限控制
- **游客**：浏览 approved 作品
- **Member**：上传、查看自己的作品、编辑自己的作品
- **Moderator**：查看所有作品（包括 pending）、审核、编辑任何作品
- **Admin**：所有权限 + 删除任何作品

---

## 测试计划

- [ ] API 客户端函数（mock fetch）
- [ ] 表单验证逻辑
- [ ] 权限检查逻辑
- [ ] 登录 → 浏览 → 上传 → 查看详情 集成流程

---

**计划创建时间**：2026-06-15  
**预计完成时间**：2026-06-29 (2 weeks)  
**技术栈修正**：2026-06-17（Vite → Rspack，React Router → TanStack Router）