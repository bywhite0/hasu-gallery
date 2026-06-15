#!/bin/bash
# 测试上传功能

echo "=== 测试上传流水线 ==="
echo ""

# 1. 登录获取 session
echo "[1/3] 登录获取 session..."
curl -s -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -c /tmp/upload_test_cookies.txt \
  -d '{"handle":"testuser","password":"password123"}' | jq .

echo ""
echo "[2/3] 创建测试图片..."
# 使用 ImageMagick 创建 1x1 测试图片
convert -size 100x100 xc:blue /tmp/test_upload.png

echo ""
echo "[3/3] 上传图片..."
curl -v -X POST http://localhost:8787/api/works/upload \
  -b /tmp/upload_test_cookies.txt \
  -F "file=@/tmp/test_upload.png" \
  -F "title=Test Meme" \
  -F "gallery=meme"

echo ""
echo "=== 测试完成 ==="
