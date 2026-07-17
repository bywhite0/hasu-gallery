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

当前实现仍是独立 Rspack SPA + Rust JSON API。已批准的 Architecture V2
将保持现有 React 前端架构，但把生产 SPA 内嵌进单个 Rust 可执行文件，
业务 API 迁移到 Protobuf，并使用托管 PostgreSQL、AWS S3/Cloudflare R2
一类外部对象存储以及 UUIDv4 公共媒体 URL。V2 同时新增 Fiction 内容域，
以 PostgreSQL 保存版本化正文、草稿、审核修订和系列关系，封面/插图复用
私有媒体链路。迁移状态与完整架构图见
[Architecture V2](.ccg/spec/architecture-v2.md)。

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
