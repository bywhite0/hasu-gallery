# Hasu Gallery - 边缘服务器快速安装指南

## 连接服务器

```bash
ssh root@100.104.1.1
# 密码: <PASSWORD_REDACTED>
```

## 一键安装命令（复制粘贴执行）

```bash
# === 安装 PostgreSQL ===
export DEBIAN_FRONTEND=noninteractive && \
apt-get update -qq && \
apt-get install -y postgresql postgresql-contrib && \
systemctl start postgresql && \
systemctl enable postgresql && \
echo "✅ PostgreSQL 已安装" && \

# === 创建数据库和用户 ===
sudo -u postgres psql << 'EOF'
CREATE USER hasu_user WITH PASSWORD 'hasu_pass';
CREATE DATABASE hasu_gallery OWNER hasu_user;
GRANT ALL PRIVILEGES ON DATABASE hasu_gallery TO hasu_user;
\c hasu_gallery
GRANT ALL ON SCHEMA public TO hasu_user;
\q
EOF
echo "✅ 数据库已创建" && \

# === 配置远程访问 ===
PG_HBA=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file') && \
PG_CONF=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW config_file') && \
cp "$PG_HBA" "$PG_HBA.backup" && \
cp "$PG_CONF" "$PG_CONF.backup" && \
echo "host    all             all             0.0.0.0/0               md5" >> "$PG_HBA" && \
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF" && \
echo "" >> "$PG_CONF" && \
echo "# 轻量级优化（512MB 内存）" >> "$PG_CONF" && \
echo "shared_buffers = 128MB" >> "$PG_CONF" && \
echo "effective_cache_size = 256MB" >> "$PG_CONF" && \
echo "maintenance_work_mem = 32MB" >> "$PG_CONF" && \
echo "work_mem = 4MB" >> "$PG_CONF" && \
echo "max_connections = 20" >> "$PG_CONF" && \
echo "✅ 配置已更新" && \

# === 重启并测试 ===
systemctl restart postgresql && \
sleep 2 && \
sudo -u postgres psql -d hasu_gallery -c "SELECT 'Database OK' AS status" && \
echo "" && \
echo "=== 安装完成 ===" && \
echo "连接字符串: postgres://hasu_user:hasu_pass@100.104.1.1:5432/hasu_gallery"
```

## 防火墙配置（如需要）

```bash
# UFW 防火墙
ufw allow 5432/tcp

# 或 firewalld
firewall-cmd --permanent --add-port=5432/tcp
firewall-cmd --reload
```

## 验证安装

```bash
# 本地测试
psql -U hasu_user -d hasu_gallery -c "SELECT version();"

# 查看 PostgreSQL 状态
systemctl status postgresql
```

## 卸载（如需要）

```bash
apt-get remove --purge -y postgresql postgresql-contrib
rm -rf /var/lib/postgresql /etc/postgresql
```

---

## 后端配置（回到开发机）

更新 `D:\Repos\hasu-gallery\backend\.env`：

```env
DATABASE_URL=postgres://hasu_user:hasu_pass@100.104.1.1:5432/hasu_gallery
```

启动后端：

```bash
cd D:\Repos\hasu-gallery
pnpm dev:api
```

预期输出：
```
Connecting to database...
Running migrations...
Migrations completed
hasu-gallery API listening at http://127.0.0.1:8787
```
