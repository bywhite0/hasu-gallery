#!/bin/bash
# 测试远程数据库连接

echo "=== 测试 Hasu Gallery 数据库连接 ==="
echo ""

# 测试 API health check
echo "[1/3] 测试 API health check..."
if curl -f -s http://localhost:8787/health > /dev/null 2>&1; then
    echo "✅ API 健康检查通过"
else
    echo "❌ API 未启动或健康检查失败"
    exit 1
fi

# 检查数据库表
echo ""
echo "[2/3] 检查数据库表..."
PGPASSWORD=hasu_pass psql -h 100.104.1.1 -U hasu_user -d hasu_gallery -c "\dt" 2>&1 | head -20

# 检查迁移历史
echo ""
echo "[3/3] 检查迁移历史..."
PGPASSWORD=hasu_pass psql -h 100.104.1.1 -U hasu_user -d hasu_gallery -c "SELECT * FROM _sqlx_migrations ORDER BY installed_on DESC LIMIT 5"

echo ""
echo "=== 测试完成 ==="
