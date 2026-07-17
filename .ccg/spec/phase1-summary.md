# Phase 1 实施总结

## 概览

Phase 1 完成了 Hasu Gallery 的核心基础设施搭建，包括数据库架构、认证系统和上传流水线。

## 已完成模块

### 1.1 数据库架构 ✅

**PostgreSQL Schema**
- `users` 表：用户账户（支持 admin/moderator/member 角色）
- `works` 表：作品主表（支持 meme/art 两种画廊类型）
- 枚举类型：`gallery_kind`、`meme_origin`、`work_status`
- 约束：gallery-origin 规则、文件字段互斥约束

**部署位置**
- 服务器：私有边缘主机（具体主机/凭证仅保存在本地 ops 文档）
- 数据库：`hasu_gallery`
- 凭证：通过本地 `backend/.env` 或密钥管理配置，不写入仓库

**迁移管理**
- 使用 `sqlx-cli` 管理
- 迁移文件：`backend/migrations/*.sql`
- 自动执行：后端启动时检查并运行待执行迁移

### 1.2 认证系统 ✅

**实现方式**
- 密码哈希：Argon2id（内存 19MB，迭代 2 次，并行度 1）
- Session 管理：`tower-sessions` + PostgreSQL 存储
- Cookie：HTTP-only，Secure（生产环境），SameSite=Lax

**API 端点**
- `POST /api/auth/register`：用户注册
- `POST /api/auth/login`：登录（返回用户信息）
- `POST /api/auth/logout`：登出
- `GET /api/auth/me`：获取当前用户信息

**测试覆盖**
- 密码哈希与验证：✅ 通过
- 不同盐值生成：✅ 通过
- Session 持久化：✅ 通过（手动测试）

### 1.3 上传流水线 ✅

**技术栈**
- 对象存储：MinIO S3（内网 endpoint，由 `S3_ENDPOINT` 配置）
- 图片处理：`image` crate（缩略图生成、尺寸提取）
- 文件上传：`axum-extra` multipart
- 公开访问：Nginx 反向代理（由 `PUBLIC_MEDIA_BASE_URL` 配置）

**功能特性**
- 支持格式：PNG、JPEG、GIF、WebP
- 文件大小限制：10MB
- 自动生成缩略图：400x400，JPEG 85% 质量
- 认证要求：必须登录
- 字段验证：
  - `gallery=meme` 必须提供 `origin`
  - `gallery=art` 不能有 `origin`

**API 端点**
- `POST /api/works/upload`
  - 参数：`file`（multipart）、`title`、`gallery`、`origin`（meme 必填）
  - 返回：work ID、文件 URL、缩略图 URL、尺寸

**存储架构**
```
S3 Bucket: hasu-gallery
├── {uuid}.png/jpg/gif/webp    # 原图
└── {uuid}_thumb.jpg           # 缩略图
```

**URL 生成**
- 内部上传：S3/MinIO endpoint（后端直连，来自环境变量）
- 公开访问：`{PUBLIC_MEDIA_BASE_URL}/{filename}`

**测试结果**
- 上传成功：✅ 返回 work ID
- S3 存储：✅ 文件已保存
- 缩略图生成：✅ JPEG 正常
- 公开访问：✅ Nginx 代理生效
- 数据库插入：✅ 约束验证通过

## 配置文件

### 后端 `.env`（仅本地，勿提交）

见 `backend/.env.example`。真实主机、账号、密钥只放在本机环境文件或 `.codex-local/ops/`。

```env
DATABASE_URL=postgres://APP_USER:APP_PASSWORD@127.0.0.1:5432/hasu_gallery
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=<local-or-secret-store>
S3_SECRET_KEY=<local-or-secret-store>
S3_BUCKET=hasu-gallery
PUBLIC_MEDIA_BASE_URL=http://127.0.0.1:8787/media
HOST=127.0.0.1
PORT=8787
RUST_LOG=info,sqlx=warn
```

### Nginx 配置

**位置**：由部署主机自行管理（示例路径 `/etc/nginx/sites-available/assets.conf`）

**新增路径**：
```nginx
location /hasu-gallery/ {
    if ($request_uri ~* "^/hasu-gallery/?$") {
        return 404;
    }
    proxy_pass http://127.0.0.1:9000/hasu-gallery/;
    # ... proxy headers ...
}
```

## 部署架构

```
开发机
    ↓
hasu-gallery/backend
    ↓
127.0.0.1:8787 (API)
    ↓ (private network / VPN / SSH tunnel)
PostgreSQL + MinIO
    ↓ (reverse proxy)
PUBLIC_MEDIA_BASE_URL
```

真实拓扑与主机映射仅保存在本地 ops 文档。

## 测试数据

**测试用户（本地开发示例）**
- Handle: `testuser`
- Password: `password123`
- Email: `test@example.com`
- Role: `member`

**测试上传**
- Work ID / 媒体 URL 为本地或私有 CDN 资源，不在公开文档中硬编码生产地址

## 运行命令

### 启动后端
```powershell
cd backend
cargo run
```

### 运行迁移
```powershell
sqlx migrate run --database-url "$env:DATABASE_URL"
```

### 测试上传
```bash
# 登录
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"handle":"testuser","password":"password123"}'

# 上传
curl -X POST http://localhost:8787/api/works/upload \
  -b cookies.txt \
  -F "file=@test.png" \
  -F "title=Test Upload" \
  -F "gallery=meme" \
  -F "origin=official"
```

## 已知限制

1. **公开读取策略未设置**：MinIO bucket 目前依赖 Nginx 代理，未配置 S3 public-read policy
2. **缩略图尺寸固定**：400x400，未来可能需要多尺寸支持
3. **文件类型验证仅在扩展名**：未做 MIME type 深度检测
4. **上传进度无反馈**：前端未实现，后端支持流式上传但无进度回传

## 下一步计划

### Phase 2: 前端画廊界面（详见 `phase2-plan.md`）
- [ ] 认证界面（登录/注册 + 路由保护）
- [ ] 作品列表 API（`GET /api/works` 分页/筛选/排序）
- [ ] 作品列表页（Meme/Art 双画廊网格）
- [ ] 作品详情 API + 页面（`GET /api/works/:id` + 大图查看器）
- [ ] 上传界面（拖拽上传 + 元数据表单）
- [ ] 用户中心（我的上传列表 + 统计）

### Phase 3: 审核与状态管理
- [ ] 审核队列（moderator 可见）
- [ ] 状态流转：pending → approved / rejected
- [ ] 批量操作（批量审核、批量删除）

### Phase 4: Art Gallery 发布
- [ ] 画廊切换器（Meme / Art）
- [ ] Art 专属筛选（artist、medium、rating）
- [ ] 内容分级过滤

### Phase 5: 生产硬化
- [ ] 安全加固（速率限制、CSRF、输入消毒）
- [ ] 可观测性（结构化日志、健康检查）
- [ ] CI/CD 流水线（GitHub Actions）
- [ ] 性能优化（连接池调优、CDN、虚拟滚动）

## 参考文档

- [Edge Server Setup](../../docs/edge-server-setup.md) - PostgreSQL 安全部署指南
- [Deployment](../../docs/deployment.md) - 环境变量与迁移
- [Phase 2 Plan](./phase2-plan.md) - 前端画廊界面计划
- 本地基础设施明细：`.codex-local/ops/`（不进 Git）

---

**最后更新**：2026-07-17  
**文档版本**：1.2（已移除基础设施敏感信息）
