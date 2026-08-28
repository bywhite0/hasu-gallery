# Sync Rspack production build into galleryd embed directory (Windows).
# Usage (repo root):
#   pnpm --filter @hasu-gallery/web build
#   pwsh scripts/sync-web-embed.ps1
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
if (-not $Root) { $Root = (Resolve-Path "$PSScriptRoot\..").Path }

$Src = Join-Path $Root "apps\web\dist"
$Dest = Join-Path $Root "backend\embedded-web"

if (-not (Test-Path $Src)) {
  Write-Error "missing $Src — run: pnpm --filter @hasu-gallery/web build"
}

if (-not (Test-Path (Join-Path $Src "index.html"))) {
  Write-Error "$Src\index.html not found"
}

if (Test-Path $Dest) {
  Remove-Item -Recurse -Force $Dest
}
New-Item -ItemType Directory -Path $Dest | Out-Null
Copy-Item -Path (Join-Path $Src "*") -Destination $Dest -Recurse -Force
# Source maps are private build artifacts; never embed them in the public binary.
Get-ChildItem -Path $Dest -Recurse -Filter "*.map" | Remove-Item -Force
Write-Host "synced $Src -> $Dest (source maps excluded)"
