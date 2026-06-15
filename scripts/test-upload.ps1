# 测试上传功能

Write-Host "=== 测试上传流水线 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 登录
Write-Host "[1/4] 登录..." -ForegroundColor Yellow
$loginBody = @{
    handle = "testuser"
    password = "password123"
} | ConvertTo-Json

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginResponse = Invoke-RestMethod -Uri "http://localhost:8787/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody `
    -WebSession $session

Write-Host "✅ 登录成功: $($loginResponse.handle)" -ForegroundColor Green

# 2. 创建测试图片
Write-Host ""
Write-Host "[2/4] 创建测试图片..." -ForegroundColor Yellow
$testImagePath = "$env:TEMP\test_upload_$([guid]::NewGuid()).png"

# 创建 1x1 白色 PNG (base64)
$pngData = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==")
[System.IO.File]::WriteAllBytes($testImagePath, $pngData)
Write-Host "✅ 测试图片已创建: $testImagePath" -ForegroundColor Green

# 3. 准备 multipart form data
Write-Host ""
Write-Host "[3/4] 上传图片..." -ForegroundColor Yellow

$boundary = [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$fileBytes = [System.IO.File]::ReadAllBytes($testImagePath)
$fileEnc = [System.Text.Encoding]::GetEncoding('iso-8859-1').GetString($fileBytes)

$bodyLines = (
    "--$boundary",
    "Content-Disposition: form-data; name=`"file`"; filename=`"test.png`"",
    "Content-Type: image/png$LF",
    $fileEnc,
    "--$boundary",
    "Content-Disposition: form-data; name=`"title`"$LF",
    "Test Upload Meme",
    "--$boundary",
    "Content-Disposition: form-data; name=`"gallery`"$LF",
    "meme",
    "--$boundary--$LF"
) -join $LF

try {
    $uploadResponse = Invoke-RestMethod -Uri "http://localhost:8787/api/works/upload" `
        -Method POST `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body $bodyLines `
        -WebSession $session

    Write-Host "✅ 上传成功!" -ForegroundColor Green
    $uploadResponse | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "❌ 上传失败: $_" -ForegroundColor Red
    $_.Exception.Response.StatusCode | Write-Host
}

# 4. 清理
Write-Host ""
Write-Host "[4/4] 清理..." -ForegroundColor Yellow
Remove-Item $testImagePath -ErrorAction SilentlyContinue
Write-Host "✅ 测试完成" -ForegroundColor Green
