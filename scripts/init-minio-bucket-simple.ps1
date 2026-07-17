# Guidance-only helper for creating a MinIO bucket without AWS CLI.
# Credentials must come from the environment; nothing secret is hardcoded.

$endpoint = $env:S3_ENDPOINT
$accessKey = $env:S3_ACCESS_KEY
$secretKey = $env:S3_SECRET_KEY
$bucketName = if ($env:S3_BUCKET) { $env:S3_BUCKET } else { "hasu-gallery" }

Write-Host "=== MinIO bucket setup hints ===" -ForegroundColor Cyan
Write-Host ""

if (-not $endpoint -or -not $accessKey -or -not $secretKey) {
    Write-Host "Set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY (and optional S3_BUCKET) first." -ForegroundColor Yellow
    Write-Host "Prefer loading from backend/.env or a secret manager." -ForegroundColor Yellow
    exit 1
}

Write-Host "Option 1 - MinIO Console:" -ForegroundColor Cyan
Write-Host "  1. Open: $endpoint"
Write-Host "  2. Sign in with the access/secret keys from your environment"
Write-Host "  3. Create bucket: $bucketName"
Write-Host "  4. Set access policy according to your CDN/proxy design"
Write-Host ""
Write-Host "Option 2 - AWS CLI script:" -ForegroundColor Cyan
Write-Host "  .\scripts\init-minio-bucket.ps1"
Write-Host ""
Write-Host "Option 3 - mc (MinIO Client):" -ForegroundColor Cyan
Write-Host "  mc alias set minio `$env:S3_ENDPOINT `$env:S3_ACCESS_KEY `$env:S3_SECRET_KEY"
Write-Host "  mc mb minio/$bucketName"
Write-Host ""
Write-Host "Do not commit real keys or production hostnames into the repository." -ForegroundColor Yellow
