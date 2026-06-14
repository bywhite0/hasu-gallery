#!/bin/bash
# 远程验证数据库表结构

echo "=== 验证 Hasu Gallery 数据库 ==="
echo ""

echo "[1/3] 列出所有表..."
sudo -u postgres psql -d hasu_gallery -c "\dt"

echo ""
echo "[2/3] 检查迁移历史..."
sudo -u postgres psql -d hasu_gallery -c "SELECT version, description, installed_on FROM _sqlx_migrations ORDER BY installed_on DESC;"

echo ""
echo "[3/3] 统计表记录数..."
sudo -u postgres psql -d hasu_gallery << 'EOF'
SELECT
  schemaname,
  tablename,
  (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
  SELECT
    schemaname,
    tablename,
    query_to_xml(format('SELECT COUNT(*) as cnt FROM %I.%I', schemaname, tablename), false, true, '') as xml_count
  FROM pg_tables
  WHERE schemaname = 'public'
) t
ORDER BY tablename;
EOF

echo ""
echo "=== 验证完成 ==="
