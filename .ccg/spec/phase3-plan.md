# Phase 3 执行计划：审核工作流

**创建时间**: 2026-06-17  
**预计工期**: 2-3 天  
**目标**: 实现完整的作品审核系统，让 moderator 可以审核 pending 作品

---

## 概述

Phase 2 完成后，所有用户上传的作品都进入 `pending` 状态，需要审核人员批准才能公开显示。Phase 3 将实现完整的审核工作流，包括：

1. 后端审核 API（角色权限、状态变更、审核日志）
2. 前端审核仪表板（队列展示、操作界面、日志查看）

---

## 技术架构

### 后端（Rust + Axum）
- 角色权限中间件（moderator/admin only）
- 审核队列 API
- 作品状态变更 API
- 审核日志记录与查询

### 前端（React + TanStack）
- 审核仪表板页面
- 权限路由保护
- 作品预览与元数据展示
- 批量操作（可选）

---

## Phase 3.1: 审核队列 API（后端）

### 3.1.1 角色权限中间件

**文件**: `backend/src/middleware/auth.rs`（新建）

**功能**:
- 检查用户 Session
- 验证用户角色（moderator 或 admin）
- 拒绝无权限请求（403 Forbidden）

**实现**:
```rust
pub async fn require_moderator(
    session: Session,
    State(pool): State<PgPool>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // 1. 从 session 获取 user_id
    // 2. 查询用户角色
    // 3. 检查 role IN ('moderator', 'admin')
    // 4. 通过则继续，否则返回 403
}
```

**集成**: 在 `main.rs` 中注册中间件并应用到审核路由

---

### 3.1.2 审核队列 API

**端点**: `GET /api/moderation/queue`

**参数**:
- `gallery`: `meme` | `art`（必填）
- `status`: `pending` | `approved` | `rejected` | `takedown`（默认 `pending`）
- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 20）

**权限**: Moderator/Admin only

**响应**:
```json
{
  "works": [
    {
      "id": "uuid",
      "title": "string",
      "gallery": "meme",
      "status": "pending",
      "uploader_handle": "string",
      "thumbnail_url": "string",
      "file_url": "string",
      "origin": "fan_made",
      "source": "string",
      "source_url": "string",
      "created_at": "ISO8601",
      "dimensions": "1920x1080",
      "file_size_bytes": 123456
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "total_pages": 5
  }
}
```

**实现**:
- SQL 查询 `works` 表，JOIN `users` 表获取 uploader_handle
- 按 `created_at ASC`排序（最早的先审核）
- 返回完整元数据用于审核决策

**文件**: `backend/src/routes/moderation.rs`（新建）

---

### 3.1.3 作品状态变更 API

**端点**: `PATCH /api/works/:id/status`

**权限**: Moderator/Admin only

**请求体**:
```json
{
  "status": "approved" | "rejected" | "takedown",
  "note": "审核理由（可选）"
}
```

**响应**:
```json
{
  "id": "uuid",
  "status": "approved",
  "updated_at": "ISO8601"
}
```

**实现**:
1. 验证权限（moderator/admin）
2. 验证状态转换合法性（pending → approved/rejected/takedown）
3. 更新 `works.status` 和 `works.updated_at`
4. 记录到 `moderation_log` 表
5. 返回更新后的状态

**状态转换规则**:
- `pending` → `approved`/`rejected`/`takedown` ✅
- `approved` → `takedown` ✅（撤销批准）
- `rejected` → `approved` ✅（重新审核）
- `takedown` → 不可逆 ❌

**文件**: `backend/src/routes/moderation.rs`

---

### 3.1.4 审核日志 API

**端点**: `GET /api/moderation/log/:work_id`

**权限**: Moderator/Admin only

**响应**:
```json
{
  "work_id": "uuid",
  "logs": [
    {
      "id": 1,
      "action": "approved",
      "moderator_handle": "admin",
      "note": "符合规范",
      "created_at": "ISO8601"
    }
  ]
}
```

**实现**:
- 查询 `moderation_log` 表
- JOIN `users` 表获取 moderator_handle
- 按 `created_at DESC` 排序（最新的在前）

**文件**: `backend/src/routes/moderation.rs`

---

### 3.1.5 数据库模型

**已存在的表**（Phase 0 已创建）:

```sql
-- moderation_log 表
CREATE TABLE moderation_log (
    id SERIAL PRIMARY KEY,
    work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    moderator_id INTEGER NOT NULL REFERENCES users(id),
    action moderation_action NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- moderation_action 枚举
CREATE TYPE moderation_action AS ENUM (
    'approved',
    'rejected',
    'takedown'
);
```

**索引优化**（如需要）:
```sql
CREATE INDEX idx_moderation_log_work_id ON moderation_log(work_id);
CREATE INDEX idx_works_status_created ON works(status, created_at);
```

---

## Phase 3.2: 审核仪表板（前端）

### 3.2.1 路由与权限保护

**路由**: `/moderation`

**权限**: Moderator/Admin only

**实现**:
1. 创建 `ModeratorGuard` 组件（类似 `AuthGuard`）
2. 检查 `user.role` 是否为 `moderator` 或 `admin`
3. 未授权用户重定向到首页

**文件**: `apps/web/src/components/ModeratorGuard.tsx`

---

### 3.2.2 审核队列页面

**文件**: `apps/web/src/pages/ModerationPage.tsx`

**布局**:
```
┌─────────────────────────────────────────────┐
│ Moderation Dashboard                        │
├─────────────────────────────────────────────┤
│ [Gallery: Meme ▼] [Status: Pending ▼]      │
├─────────────────────────────────────────────┤
│ ┌───────────────────────────────────────┐   │
│ │ 🖼️ Work Preview                       │   │
│ │ Title: "Funny Meme"                   │   │
│ │ Uploader: @user123                    │   │
│ │ Created: 2026-06-17 12:00             │   │
│ │ Origin: fan_made                      │   │
│ │ Source: https://...                   │   │
│ │                                       │   │
│ │ [Approve] [Reject] [Takedown]         │   │
│ │ Note: [____________]                  │   │
│ └───────────────────────────────────────┘   │
│                                             │
│ ← Previous | Next →                         │
└─────────────────────────────────────────────┘
```

**功能**:
- 从 `GET /api/moderation/queue` 获取待审作品
- 显示作品预览图（大图 + 缩略图）
- 显示完整元数据（标题、上传者、来源、尺寸、文件大小）
- 提供三个操作按钮：Approve、Reject、Takedown
- 可选输入审核理由（textarea）
- 分页导航（上一个/下一个）

**API 调用**:
- `GET /api/moderation/queue?gallery=meme&status=pending&page=1`
- `PATCH /api/works/:id/status` + `{status, note}`

---

### 3.2.3 审核操作组件

**文件**: `apps/web/src/components/ModerationActions.tsx`

**Props**:
```typescript
interface ModerationActionsProps {
  workId: string;
  onSuccess: () => void;
}
```

**功能**:
- 三个按钮：Approve（绿色）、Reject（红色）、Takedown（灰色）
- Note textarea（可选）
- 确认对话框（防止误操作）
- Loading 状态
- 错误提示

**实现**:
```tsx
const handleApprove = async () => {
  if (!confirm('确认批准这个作品？')) return;
  await moderationApi.updateStatus(workId, 'approved', note);
  onSuccess();
};
```

---

### 3.2.4 审核日志查看器

**文件**: `apps/web/src/components/ModerationLog.tsx`

**Props**:
```typescript
interface ModerationLogProps {
  workId: string;
}
```

**功能**:
- 从 `GET /api/moderation/log/:work_id` 获取日志
- 显示时间线格式的日志列表
- 每条日志显示：操作、审核员、理由、时间

**布局**:
```
Moderation History:
─────────────────────────────
✅ Approved by @admin
   "符合规范"
   2026-06-17 14:30

❌ Rejected by @mod1
   "质量不足"
   2026-06-17 12:00
```

---

### 3.2.5 批量操作（可选，Nice-to-have）

**功能**:
- 复选框选择多个作品
- 批量批准/拒绝
- 确认对话框（显示选中数量）

**实现**:
- 前端维护选中状态（useState）
- 循环调用 `PATCH /api/works/:id/status`
- 或后端新增 `POST /api/moderation/batch` 端点

**优先级**: P2（如时间充足则实现）

---

## 实施顺序

### Day 1: 后端 API（3.1）

1. ✅ 创建 `backend/src/middleware/auth.rs`
   - 实现 `require_moderator` 中间件
   
2. ✅ 创建 `backend/src/routes/moderation.rs`
   - 实现 `GET /api/moderation/queue`
   - 实现 `PATCH /api/works/:id/status`
   - 实现 `GET /api/moderation/log/:work_id`
   
3. ✅ 更新 `backend/src/main.rs`
   - 注册审核路由
   - 应用权限中间件
   
4. ✅ 测试
   - 使用 curl 测试所有端点
   - 验证权限控制
   - 验证日志记录

### Day 2: 前端界面（3.2）

1. ✅ 创建权限保护
   - `apps/web/src/components/ModeratorGuard.tsx`
   
2. ✅ 创建审核页面
   - `apps/web/src/pages/ModerationPage.tsx`
   - 实现作品预览
   - 实现筛选器（gallery, status）
   - 实现分页
   
3. ✅ 创建操作组件
   - `apps/web/src/components/ModerationActions.tsx`
   - 三个操作按钮
   - 理由输入
   - 确认对话框
   
4. ✅ 创建日志组件
   - `apps/web/src/components/ModerationLog.tsx`
   - 时间线展示

### Day 3: 集成测试与优化

1. ✅ 端到端测试
   - 完整审核流程测试
   - 权限测试
   - 边界情况测试
   
2. ✅ UI/UX 优化
   - 响应式布局
   - Loading 状态
   - 错误提示
   - 键盘快捷键（可选）
   
3. ✅ 文档更新
   - 更新 CLAUDE.md
   - 更新 roadmap.md
   - 创建 Phase 3 总结文档

---

## 验收标准

### 后端 API

- [ ] 权限中间件正确阻止非 moderator 用户
- [ ] 审核队列 API 返回正确的作品列表
- [ ] 状态变更 API 正确更新作品状态
- [ ] 每次状态变更都记录到 moderation_log
- [ ] 审核日志 API 返回完整的操作历史
- [ ] 所有 API 通过 curl 测试

### 前端界面

- [ ] 非 moderator 用户无法访问审核页面
- [ ] 审核队列正确显示待审作品
- [ ] 作品预览清晰完整（大图 + 元数据）
- [ ] 三个操作按钮功能正常
- [ ] 操作后自动刷新队列
- [ ] 审核日志正确显示
- [ ] 响应式布局在不同屏幕尺寸下正常
- [ ] 使用 Playwright 完成端到端测试

### 业务逻辑

- [ ] Moderator 可以批准 pending 作品
- [ ] Moderator 可以拒绝 pending 作品
- [ ] Moderator 可以下架已批准的作品
- [ ] 所有操作都记录到日志
- [ ] 用户只能在画廊中看到 approved 作品
- [ ] 用户在个人中心能看到自己的所有作品（含 pending）

---

## 技术债务与优化

### 当前可接受的限制

1. **无批量操作**: 每次只能操作一个作品（P2 功能）
2. **无审核统计**: 不显示待审数量、审核速度等指标（Phase 4）
3. **无通知系统**: 用户不会收到审核结果通知（Phase 5）

### 未来优化方向

1. **WebSocket 实时更新**: 新作品上传时自动出现在队列
2. **审核快捷键**: A = Approve, R = Reject, T = Takedown
3. **审核员排行榜**: 显示审核数量和速度
4. **自动审核**: AI 辅助识别不当内容（Phase 5）

---

## 风险与缓解

### 风险 1: 权限系统复杂度

**风险**: 角色权限中间件可能影响性能  
**缓解**: 
- 使用 Session 缓存用户角色
- 避免每次请求都查询数据库
- 如需要，添加 Redis 缓存

### 风险 2: 审核队列性能

**风险**: 大量 pending 作品时查询变慢  
**缓解**:
- 添加数据库索引（status, created_at）
- 限制每页数量（默认 20）
- 使用游标分页（如需要）

### 风险 3: 状态转换冲突

**风险**: 多个 moderator 同时审核同一作品  
**缓解**:
- 使用数据库事务
- 添加乐观锁（updated_at 版本检查）
- 前端提示"作品已被其他审核员处理"

---

## 成功指标

1. **功能完整性**: 所有验收标准通过
2. **性能**: 审核操作响应时间 < 500ms
3. **可用性**: Moderator 可以在 5 分钟内完成 10 个作品的审核
4. **代码质量**: TypeScript 0 errors, Rust 0 warnings
5. **测试覆盖**: 端到端测试通过

---

**准备开始实施 Phase 3.1 - 后端 API 开发**
