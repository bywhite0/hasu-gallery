# Hasu Gallery

双画廊 UGC 平台（Meme + Art），支持用户上传、审核与浏览。

## 技术栈

**前端**
- Rspack 1.1 + React 19
- TanStack Router + Query + zustand
- Tailwind v4 + storybook-react-rsbuild

**后端**
- Axum + sqlx + Postgres
- argon2 认证 + S3 对象存储

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动前端开发服务器
pnpm dev                  # http://localhost:5173

# 启动 Storybook
pnpm storybook            # http://localhost:6006

# 启动后端 API
pnpm dev:api              # http://localhost:8787
```

## Monorepo 结构

```
hasu-gallery/
├── apps/
│   └── web/              # @hasu-gallery/web - React 前端应用
├── packages/
│   ├── ui/               # @hasu-gallery/ui - 组件库 + Storybook
│   └── types/            # @hasu-gallery/types - 共享类型定义
└── backend/              # Rust API 服务
```

## 环境要求

- Node.js 20+
- pnpm 10+
- Rust 1.70+
- Postgres 16+
