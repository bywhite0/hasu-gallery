#!/bin/bash
# Hasu Gallery - 边缘服务器 Postgres 设置脚本
# 适用于 512MB 内存的轻量级服务器

set -e

echo "=== Hasu Gallery Postgres 轻量级安装 ==="
echo ""

# 检测系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    echo "检测到系统: $OS $VERSION_ID"
else
    echo "无法检测系统类型"
    exit 1
fi

# 安装 Postgres
echo ""
echo "[1/5] 安装 PostgreSQL..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    apt-get update -qq
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
    dnf install -y postgresql-server postgresql-contrib
    postgresql-setup --initdb
    systemctl start postgresql
    systemctl enable postgresql
else
    echo "不支持的系统: $OS"
    exit 1
fi

echo "✅ PostgreSQL 已安装"

# 配置 Postgres 用户和数据库
echo ""
echo "[2/5] 创建数据库和用户..."
sudo -u postgres psql << 'EOF'
-- 创建用户
CREATE USER hasu_user WITH PASSWORD 'hasu_pass';

-- 创建数据库
CREATE DATABASE hasu_gallery OWNER hasu_user;

-- 授权
GRANT ALL PRIVILEGES ON DATABASE hasu_gallery TO hasu_user;

-- 连接到 hasu_gallery 数据库并授权 schema
\c hasu_gallery
GRANT ALL ON SCHEMA public TO hasu_user;

-- 退出
\q
EOF

echo "✅ 数据库和用户已创建"

# 配置远程访问（允许本地网络）
echo ""
echo "[3/5] 配置远程访问..."

PG_HBA=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file')
PG_CONF=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW config_file')

# 备份配置
cp "$PG_HBA" "$PG_HBA.backup"
cp "$PG_CONF" "$PG_CONF.backup"

# 允许密码认证（从任何地址）
if ! grep -q "host.*all.*all.*0.0.0.0/0.*md5" "$PG_HBA"; then
    echo "host    all             all             0.0.0.0/0               md5" >> "$PG_HBA"
fi

# 监听所有地址
if ! grep -q "^listen_addresses = '\*'" "$PG_CONF"; then
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
fi

# 优化内存设置（512MB 环境）
cat >> "$PG_CONF" << 'EOF'

# 轻量级优化（512MB 内存）
shared_buffers = 128MB
effective_cache_size = 256MB
maintenance_work_mem = 32MB
work_mem = 4MB
max_connections = 20
EOF

echo "✅ 远程访问已配置"

# 重启 Postgres
echo ""
echo "[4/5] 重启 PostgreSQL..."
systemctl restart postgresql

echo "✅ PostgreSQL 已重启"

# 测试连接
echo ""
echo "[5/5] 测试连接..."
if sudo -u postgres psql -d hasu_gallery -c "SELECT 1" > /dev/null 2>&1; then
    echo "✅ 数据库连接测试成功"
else
    echo "❌ 数据库连接测试失败"
    exit 1
fi

# 显示连接信息
echo ""
echo "=== 安装完成 ==="
echo ""
echo "数据库连接信息："
echo "  Host: 100.104.1.1"
echo "  Port: 5432"
echo "  Database: hasu_gallery"
echo "  User: hasu_user"
echo "  Password: hasu_pass"
echo ""
echo "连接字符串："
echo "  postgres://hasu_user:hasu_pass@100.104.1.1:5432/hasu_gallery"
echo ""
echo "⚠️  注意：请确保防火墙允许 5432 端口访问"
if command -v ufw > /dev/null 2>&1; then
    echo ""
    echo "运行以下命令开放端口（如果使用 ufw）："
    echo "  sudo ufw allow 5432/tcp"
fi
