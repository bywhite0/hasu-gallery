# 初始化 MinIO bucket

$endpoint = "https://minio-console.kaho.top"
$accessKey = "IKVXKCF0TA0NCZXW1DDV"
$secretKey = "XRMZJy0IbR+os4+6PeDsgtFPF01q6D63Xx2JGtx+"
$bucketName = "hasu-gallery"

Write-Host "=== MinIO Bucket 初始化 ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] 检查 MinIO 连接..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$endpoint/minio/health/live" -Method GET -UseBasicParsing
    Write-Host "✅ MinIO 在线" -ForegroundColor Green
} catch {
    Write-Host "❌ 无法连接到 MinIO: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/3] 安装 AWS CLI（如果需要）..." -ForegroundColor Yellow
if (!(Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "请安装 AWS CLI: https://aws.amazon.com/cli/" -ForegroundColor Red
    Write-Host "或使用 Scoop: scoop install aws" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ AWS CLI 已安装" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/3] 创建 bucket..." -ForegroundColor Yellow

# 配置 AWS CLI
$env:AWS_ACCESS_KEY_ID = $accessKey
$env:AWS_SECRET_ACCESS_KEY = $secretKey
$env:AWS_DEFAULT_REGION = "us-east-1"

# 检查 bucket 是否存在
$bucketExists = aws s3 ls --endpoint-url $endpoint 2>$null | Select-String $bucketName

if ($bucketExists) {
    Write-Host "✅ Bucket '$bucketName' 已存在" -ForegroundColor Green
} else {
    # 创建 bucket
    aws s3 mb "s3://$bucketName" --endpoint-url $endpoint
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Bucket '$bucketName' 创建成功" -ForegroundColor Green
    } else {
        Write-Host "❌ 创建 bucket 失败" -ForegroundColor Red
        exit 1
    }
}

# 设置 bucket 为公开读取（用于媒体访问）
Write-Host ""
Write-Host "[Optional] 设置 bucket 公开访问策略..." -ForegroundColor Yellow
$policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::$bucketName/*"]
    }
  ]
}
"@

$policyFile = "$env:TEMP\bucket-policy.json"
$policy | Out-File -FilePath $policyFile -Encoding UTF8

aws s3api put-bucket-policy --bucket $bucketName --policy "file://$policyFile" --endpoint-url $endpoint 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 公开访问策略已设置" -ForegroundColor Green
} else {
    Write-Host "⚠️  设置公开访问策略失败（可能需要 MinIO 管理员权限）" -ForegroundColor Yellow
}

Remove-Item $policyFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== 初始化完成 ===" -ForegroundColor Green
Write-Host "Bucket URL: $endpoint/$bucketName" -ForegroundColor Cyan
