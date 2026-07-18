# Hasu Gallery

多内容 UGC 平台：当前已实现 Meme + Art 双画廊，Architecture V2 将新增
类似 Pixiv 小说的 Fiction 同人文发布与阅读服务。

## 技术栈

**前端**
- Rspack 1.1 + React 19
- TanStack Router + Query + zustand
- Tailwind v4 + storybook-react-rsbuild

**后端**
- Axum + sqlx + Postgres
- argon2 认证 + S3 对象存储

## 架构方向

当前实现仍以独立 Rspack SPA + Rust JSON API 为权威运行时。Architecture V2
Slice A foundation 已落地：`galleryd` 可嵌入 SPA、提供
`GET /api/v2/public/health` Protobuf smoke，并保留全部现有 JSON 路由。Slice B
补充了 `GET /api/v2/public/works*` 公共 Protobuf 读路径（approved/all-ages，
不读 cookie）。后续 slice 才会迁移前端消费、媒体 UUID 与 Fiction 运行时。完整
架构图见 [Architecture V2](.ccg/spec/architecture-v2.md)。

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动前端开发服务器
pnpm dev                  # http://localhost:5173

# 启动 Storybook
pnpm storybook            # http://localhost:6006

# 启动后端 API（galleryd serve）
pnpm dev:api              # http://localhost:8787

# 将前端生产构建同步进 galleryd 嵌入目录后发布构建
pnpm run build:galleryd
```

## Monorepo 结构

```
hasu-gallery/
├── apps/
│   └── web/              # @hasu-gallery/web - React 前端应用
├── packages/
│   ├── ui/               # @hasu-gallery/ui - 组件库 + Storybook
│   ├── types/            # @hasu-gallery/types - 共享类型定义
│   └── proto/            # @hasu-gallery/proto - V2 Protobuf TS 镜像
├── proto/                # hasu.gallery.v2 schema source
└── backend/              # galleryd / hasu-gallery-api (Rust)
```

## 文档

- [Architecture V2](.ccg/spec/architecture-v2.md)
- [API Reference](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Moderation Guidelines](docs/moderation-guidelines.md)
- [Monitoring Runbook](docs/monitoring.md)
- [User Guide](docs/user-guide.md)
- [Edge Server Setup](docs/edge-server-setup.md)

## 环境要求

- Node.js 20+
- pnpm 10+
- Rust 1.70+
- Postgres 16+
