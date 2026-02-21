# Install bd binary from GitHub release, inspect zip contents, place at known location
$ErrorActionPreference = "Stop"

$tempDir = Join-Path $env:TEMP 'beads-inspect'
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$extractDir = Join-Path $tempDir 'extracted'
New-Item -ItemType Directory -Force -Path $extractDir | Out-Null

$version = "0.55.4"
$zipUrl = "https://github.com/steveyegge/beads/releases/download/v$version/beads_${version}_windows_amd64.zip"
$zipPath = Join-Path $tempDir "beads.zip"

Write-Host "Downloading $zipUrl..."
Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing

Write-Host "Extracting..."
Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

Write-Host "Contents of extracted archive:"
Get-ChildItem -Recurse $extractDir | Select-Object -ExpandProperty FullName

# Find bd.exe anywhere in the extracted tree
$bdExe = Get-ChildItem -Recurse $extractDir -Filter "bd.exe" | Select-Object -First 1
if (-not $bdExe) {
    # Try beads.exe
    $bdExe = Get-ChildItem -Recurse $extractDir -Filter "beads.exe" | Select-Object -First 1
}

if ($bdExe) {
    Write-Host "Found binary at: $($bdExe.FullName)"

    $installDir = Join-Path $env:LOCALAPPDATA "Programs\bd"
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    Copy-Item -Path $bdExe.FullName -Destination (Join-Path $installDir "bd.exe") -Force
    Write-Host "Installed to: $installDir\bd.exe"

    # Verify
    $installed = & "$installDir\bd.exe" version 2>&1
    Write-Host "Version: $installed"
} else {
    Write-Host "ERROR: No bd.exe or beads.exe found in archive"
    exit 1
}

# Cleanup
Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
