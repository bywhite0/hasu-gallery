# Initialize MinIO/S3 bucket using environment configuration only.
# Required env:
#   S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY
# Optional:
#   S3_BUCKET (default: hasu-gallery), S3_REGION (default: us-east-1)

$ErrorActionPreference = "Stop"

$endpoint = $env:S3_ENDPOINT
$accessKey = $env:S3_ACCESS_KEY
$secretKey = $env:S3_SECRET_KEY
$bucketName = if ($env:S3_BUCKET) { $env:S3_BUCKET } else { "hasu-gallery" }
$region = if ($env:S3_REGION) { $env:S3_REGION } else { "us-east-1" }

if (-not $endpoint -or -not $accessKey -or -not $secretKey) {
    Write-Host "Missing required env: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY" -ForegroundColor Red
    Write-Host "Load them from backend/.env or your secret store, then re-run." -ForegroundColor Yellow
    exit 1
}

Write-Host "=== MinIO Bucket init ===" -ForegroundColor Cyan
Write-Host "Endpoint: $endpoint"
Write-Host "Bucket:   $bucketName"
Write-Host ""

Write-Host "[1/3] Health check..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "$endpoint/minio/health/live" -Method GET -UseBasicParsing | Out-Null
    Write-Host "OK: storage reachable" -ForegroundColor Green
} catch {
    Write-Host "WARN: health endpoint failed (continuing if AWS CLI works): $_" -ForegroundColor Yellow
}

if (!(Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Host "AWS CLI is required. Install: https://aws.amazon.com/cli/" -ForegroundColor Red
    exit 1
}

$env:AWS_ACCESS_KEY_ID = $accessKey
$env:AWS_SECRET_ACCESS_KEY = $secretKey
$env:AWS_DEFAULT_REGION = $region

Write-Host "[2/3] Ensure bucket exists..." -ForegroundColor Yellow
$bucketExists = aws s3 ls --endpoint-url $endpoint 2>$null | Select-String $bucketName
if ($bucketExists) {
    Write-Host "OK: bucket already exists" -ForegroundColor Green
} else {
    aws s3 mb "s3://$bucketName" --endpoint-url $endpoint
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL: create bucket" -ForegroundColor Red
        exit 1
    }
    Write-Host "OK: bucket created" -ForegroundColor Green
}

Write-Host "[3/3] Optional public-read policy (best-effort)..." -ForegroundColor Yellow
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
$policyFile = Join-Path $env:TEMP "hasu-gallery-bucket-policy.json"
$policy | Out-File -FilePath $policyFile -Encoding utf8
aws s3api put-bucket-policy --bucket $bucketName --policy "file://$policyFile" --endpoint-url $endpoint 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK: public-read policy applied" -ForegroundColor Green
} else {
    Write-Host "SKIP: policy not applied (may need admin rights or private CDN proxy)" -ForegroundColor Yellow
}
Remove-Item $policyFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
