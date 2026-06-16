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
- 服务器：`100.104.1.1:5432`
- 数据库：`hasu_gallery`
- 凭证：`hasu_user` / `hasu_pass`

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
- 对象存储：MinIO S3 (内网 `http://100.104.3.1:9000`)
- 图片处理：`image` crate（缩略图生成、尺寸提取）
- 文件上传：`axum-extra` multipart
- 公开访问：Nginx 反向代理（`https://assets.kaho.top/hasu-gallery/`）

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
- 内部上传：`http://100.104.3.1:9000`（后端直连）
- 公开访问：`https://assets.kaho.top/hasu-gallery/{filename}`

**测试结果**
- 上传成功：✅ 返回 work ID
- S3 存储：✅ 文件已保存
- 缩略图生成：✅ JPEG 正常
- 公开访问：✅ Nginx 代理生效
- 数据库插入：✅ 约束验证通过

## 配置文件

### 后端 `.env`
```env
DATABASE_URL=postgres://hasu_user:hasu_pass@100.104.1.1:5432/hasu_gallery
S3_ENDPOINT=http://100.104.3.1:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=<隐藏>
S3_SECRET_KEY=<隐藏>
S3_BUCKET=hasu-gallery
PUBLIC_MEDIA_BASE_URL=https://assets.kaho.top/hasu-gallery
HOST=127.0.0.1
PORT=8787
RUST_LOG=info,sqlx=warn
```

### Nginx 配置
**位置**：`/etc/nginx/sites-available/assets.conf`

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
开发机 (Windows 11)
    ↓ (开发)
hasu-gallery/backend
    ↓ (cargo run)
localhost:8787 (API)
    ↓ (内网)
100.104.1.1:5432    ← PostgreSQL
100.104.3.1:9000    ← MinIO S3 API
    ↓ (Nginx 反向代理)
https://assets.kaho.top/hasu-gallery/  ← 公开访问
```

## 测试数据

**测试用户**
- Handle: `testuser`
- Password: `password123`
- Email: `test@example.com`
- Role: `member`

**测试上传**
- Work ID: `5c98beab-e79b-43f5-aedd-191e964aa966`
- 原图: [https://assets.kaho.top/hasu-gallery/5c98beab-e79b-43f5-aedd-191e964aa966.png](https://assets.kaho.top/hasu-gallery/5c98beab-e79b-43f5-aedd-191e964aa966.png)
- 缩略图: [https://assets.kaho.top/hasu-gallery/5c98beab-e79b-43f5-aedd-191e964aa966_thumb.jpg](https://assets.kaho.top/hasu-gallery/5c98beab-e79b-43f5-aedd-191e964aa966_thumb.jpg)

## 运行命令

### 启动后端
```powershell
cd D:\Repos\hasu-gallery\backend
cargo run
```

### 运行迁移
```powershell
sqlx migrate run --database-url "postgres://hasu_user:hasu_pass@100.104.1.1:5432/hasu_gallery"
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

### Phase 2: 前端画廊界面
- [ ] 作品列表页（支持筛选、分页）
- [ ] 作品详情页（显示原图、元数据、操作按钮）
- [ ] 上传表单组件（拖拽上传、进度条）
- [ ] 画廊切换（meme / art）

### Phase 3: 审核与状态管理
- [ ] 审核队列（moderator 可见）
- [ ] 状态流转：pending → approved / rejected
- [ ] 批量操作（批量审核、批量删除）

### Phase 4: 搜索与索引
- [ ] 全文搜索（PostgreSQL `tsvector`）
- [ ] 标签系统（多对多关系表）
- [ ] 按来源/分类筛选

### Phase 5: 生产部署
- [ ] Docker 容器化
- [ ] CI/CD 流水线（GitHub Actions）
- [ ] 日志聚合（结构化日志）
- [ ] 监控与告警（健康检查、错误率）

## 提交历史

- `8874657`: feat: add Vercel deployment support and optimize static data architecture
- `cbf860e`: docs: sync documentation with current implementation state
- `5af364e`: feat(phase1.3): add upload pipeline with S3 and thumbnail generation
- `a10784f`: fix(phase1.3): add origin field validation and fix public URL generation

## 参考文档

- [Edge Server Setup](./edge-server-setup.md) - PostgreSQL 部署指南
- [Upload Testing Scripts](../scripts/) - 上传测试脚本
- [Backend README](../backend/README.md) - 后端 API 文档

---

**最后更新**：2026-06-15  
**文档版本**：1.0
