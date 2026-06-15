# 使用 MinIO REST API 创建 bucket（不需要 AWS CLI）

$endpoint = "https://minio-console.kaho.top"
$accessKey = "IKVXKCF0TA0NCZXW1DDV"
$secretKey = "XRMZJy0IbR+os4+6PeDsgtFPF01q6D63Xx2JGtx+"
$bucketName = "hasu-gallery"

Write-Host "=== MinIO Bucket 初始化（HTTP API）===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] 检查 MinIO 连接..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$endpoint/minio/health/live" -Method GET -UseBasicParsing
    Write-Host "✅ MinIO 在线" -ForegroundColor Green
} catch {
    Write-Host "❌ 无法连接到 MinIO: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/2] 检查/创建 bucket..." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  由于 MinIO REST API 需要复杂的签名，推荐以下方式之一：" -ForegroundColor Yellow
Write-Host ""
Write-Host "方式1 - 使用 MinIO Web Console（推荐）：" -ForegroundColor Cyan
Write-Host "  1. 访问: $endpoint"
Write-Host "  2. 使用以下凭证登录："
Write-Host "     Access Key: $accessKey"
Write-Host "     Secret Key: $secretKey"
Write-Host "  3. 点击 'Buckets' -> 'Create Bucket'"
Write-Host "  4. 输入 bucket 名称: $bucketName"
Write-Host "  5. 创建后，设置 Access Policy 为 'Public'"
Write-Host ""

Write-Host "方式2 - 安装 AWS CLI：" -ForegroundColor Cyan
Write-Host "  scoop install aws"
Write-Host "  然后重新运行此脚本"
Write-Host ""

Write-Host "方式3 - 使用 mc (MinIO Client)：" -ForegroundColor Cyan
Write-Host "  scoop install minio-client"
Write-Host "  mc alias set minio $endpoint $accessKey $secretKey"
Write-Host "  mc mb minio/$bucketName"
Write-Host "  mc anonymous set download minio/$bucketName"
Write-Host ""

Write-Host "=== 请手动完成 bucket 创建后，继续测试上传功能 ===" -ForegroundColor Green
