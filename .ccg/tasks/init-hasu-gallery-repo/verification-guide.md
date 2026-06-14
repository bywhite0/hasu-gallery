# 验证与启动指南

**项目**: hasu-gallery  
**状态**: 骨架已搭建，等待依赖安装完成

---

## 🔍 验证清单

### 1. 验证后端（已完成 ✅）

```powershell
cd D:\Repos\hasu-gallery
cargo check --manifest-path backend\Cargo.toml
```

**结果**: ✅ 编译通过（59.01s）

---

### 2. 验证前端依赖（进行中 ⏳）

```powershell
cd D:\Repos\hasu-gallery
pnpm install
```

**预期输出**: 
```
Progress: resolved XXX, reused XXX, downloaded XXX, added XXX
+ @hasu-gallery/web
+ @hasu-gallery/ui
+ @hasu-gallery/types
```

**验证方式**:
```powershell
# 检查 node_modules 是否存在
Test-Path node_modules

# 检查已安装的包
pnpm list --depth 0
```

---

### 3. 验证前端开发服务器（待执行）

```powershell
cd D:\Repos\hasu-gallery
pnpm dev
```

**预期输出**:
```
rspack 1.1.8

  ➜ Local:   http://localhost:5173/
  ➜ Network: use --host to expose
  ➜ press h + enter to show help
```

**验证方式**:
- 打开浏览器访问 http://localhost:5173
- 应显示：
  - 标题："Hasu Gallery"
  - 欢迎文字："Welcome to Hasu Gallery"
  - 两个按钮："Meme Gallery" 和 "Art Gallery"

---

### 4. 验证 Storybook（待执行）

```powershell
cd D:\Repos\hasu-gallery
pnpm storybook
```

**预期输出**:
```
╭──────────────────────────────────────────────────╮
│                                                  │
│   Storybook 10.4.1 for storybook-react-rsbuild  │
│   started                                        │
│   3.8 s for manager and 4.2 s for preview       │
│                                                  │
│    Local:            http://localhost:6006/      │
│    On your network:  http://xxx.xxx.xxx.xxx:6006/│
│                                                  │
╰──────────────────────────────────────────────────╯
```

**验证方式**:
- 打开浏览器访问 http://localhost:6006
- 应显示 Storybook UI
- 左侧导航栏应有 "Primitives/Button" 故事
- 可预览 Button 组件的不同变体

---

### 5. 验证后端 API（待执行）

```powershell
cd D:\Repos\hasu-gallery
pnpm dev:api
```

**预期输出**:
```
hasu-gallery API listening at http://127.0.0.1:8787
```

**验证方式**:
```powershell
# 测试 health check
curl http://localhost:8787/health
```

**预期响应**: `OK`

---

## 🚀 启动顺序

### 方案 A：全栈开发（推荐）

1. **启动后端**（终端 1）:
   ```powershell
   cd D:\Repos\hasu-gallery
   pnpm dev:api
   ```

2. **启动前端**（终端 2）:
   ```powershell
   cd D:\Repos\hasu-gallery
   pnpm dev
   ```

3. 前端会自动代理 `/api/*` 请求到 `http://localhost:8787`

### 方案 B：仅前端开发

```powershell
cd D:\Repos\hasu-gallery
pnpm dev
```

API 调用会失败（预期行为），但 UI 可以正常开发。

### 方案 C：仅组件开发

```powershell
cd D:\Repos\hasu-gallery
pnpm storybook
```

独立开发 UI 组件，无需启动前端或后端。

---

## 🔧 常见问题

### 问题 1: pnpm install 报错 "EACCES: permission denied"

**解决**:
```powershell
# 清理缓存重试
pnpm store prune
pnpm install
```

### 问题 2: pnpm dev 报错 "Cannot find module '@hasu-gallery/ui'"

**原因**: workspace 依赖未正确链接

**解决**:
```powershell
# 重新安装
rm -rf node_modules
pnpm install
```

### 问题 3: Storybook 启动失败 "React is not defined"

**原因**: `pluginReact()` 未添加到 Rsbuild 配置

**检查**: `packages/ui/.storybook/main.ts` 应包含：
```typescript
rsbuildFinal: (rsbuildConfig) => {
  rsbuildConfig.plugins = [...(rsbuildConfig.plugins ?? []), pluginReact()];
  return rsbuildConfig;
}
```

### 问题 4: 后端编译报错

**解决**:
```powershell
# 更新依赖
cargo update --manifest-path backend\Cargo.toml

# 清理重新编译
cargo clean --manifest-path backend\Cargo.toml
cargo build --manifest-path backend\Cargo.toml
```

---

## 📊 性能预期

### 首次启动耗时

| 项目 | 预期耗时 | 说明 |
|------|---------|------|
| pnpm install | 2-5 分钟 | 取决于网络速度 |
| pnpm dev (首次) | 5-10 秒 | Rspack 冷启动 |
| pnpm dev (HMR) | < 1 秒 | 热更新 |
| pnpm storybook | 5-8 秒 | Rsbuild 启动 |
| cargo run | 1-2 秒 | 已编译的二进制 |

### 资源占用

| 进程 | CPU | 内存 |
|------|-----|------|
| rspack dev | 5-15% | ~300 MB |
| storybook | 5-10% | ~250 MB |
| cargo run | < 1% | ~10 MB |

---

## ✅ 验收标准

完成以下所有项即可进入 Phase 1：

- [ ] `pnpm install` 成功完成
- [ ] `pnpm dev` 启动成功，http://localhost:5173 可访问
- [ ] `pnpm storybook` 启动成功，http://localhost:6006 可访问
- [ ] `pnpm dev:api` 启动成功，http://localhost:8787/health 返回 "OK"
- [ ] 前端页面显示 "Welcome to Hasu Gallery"
- [ ] Storybook 可预览 Button 组件
- [ ] 前端可引用 `@hasu-gallery/ui` 和 `@hasu-gallery/types`

---

## 📝 验证后的下一步

验证通过后，建议执行以下操作：

1. **截图留档**:
   - 前端首页（http://localhost:5173）
   - Storybook（http://localhost:6006）
   - 后端 health check 响应

2. **推送到 GitHub**（可选）:
   ```powershell
   cd D:\Repos\hasu-gallery
   git remote add origin <your-repo-url>
   git push -u origin master
   ```

3. **开始 Phase 1 规划**:
   - 阅读 `.ccg/spec/phase0-content-core-model.md`
   - 设计数据库表结构
   - 规划 API 端点

---

**当前状态**: ⏳ 等待 pnpm 安装完成，监控已启动
