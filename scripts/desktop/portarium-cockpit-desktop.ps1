param(
  [ValidateSet("Launch", "Install", "Status", "Uninstall")]
  [string]$Mode = "Launch",

  [string]$TargetUrl = "http://127.0.0.1:1355/",
  [string]$AppName = "Portarium Cockpit",
  [string]$ShortcutName = "Portarium Cockpit",
  [string]$StartMenuGroup = "Portarium",
  [string]$StateDir = "",
  [string]$ProfileDir = "",
  [string]$IconPath = "",
  [string]$WorkingDirectory = "",
  [string]$ShortcutCommandPath = "",
  [string]$ShortcutCommandArguments = "",
  [string]$ReportPath = "",
  [switch]$DesktopShortcut,
  [switch]$StartMenuShortcut,
  [switch]$RemoveProfile,
  [switch]$SkipProbe,
  [switch]$RequireReady
)

$ErrorActionPreference = "Stop"

$scriptPath = $PSCommandPath
$scriptDir = Split-Path -Parent $scriptPath
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDir "..\..")).Path
$isWindows = [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)

if ([string]::IsNullOrWhiteSpace($WorkingDirectory)) {
  $WorkingDirectory = $repoRoot
}

if ([string]::IsNullOrWhiteSpace($StateDir)) {
  $localAppData = if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { $env:TEMP } else { $env:LOCALAPPDATA }
  $StateDir = Join-Path $localAppData "Portarium\CockpitDesktop"
}

if ([string]::IsNullOrWhiteSpace($ProfileDir)) {
  $ProfileDir = Join-Path $StateDir "browser-profile"
}

if ([string]::IsNullOrWhiteSpace($IconPath)) {
  $IconPath = Join-Path $StateDir "portarium-cockpit.ico"
}

if ([string]::IsNullOrWhiteSpace($ReportPath)) {
  $ReportPath = Join-Path $StateDir "portarium-cockpit-desktop-report.json"
}

$installDesktopShortcut = [bool]$DesktopShortcut -or (-not $DesktopShortcut -and -not $StartMenuShortcut)
$installStartMenuShortcut = [bool]$StartMenuShortcut -or (-not $DesktopShortcut -and -not $StartMenuShortcut)
$startMenuShortcutPath = Join-Path (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$StartMenuGroup") "$ShortcutName.lnk"
$desktopShortcutPath = Join-Path ([Environment]::GetFolderPath("DesktopDirectory")) "$ShortcutName.lnk"

function Get-BrowserCandidate {
  $candidates = New-Object System.Collections.Generic.List[object]

  foreach ($path in @(
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
    $(if ($env:ProgramFiles -ne ${env:ProgramFiles(x86)}) { Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe" } else { $null }),
    (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
    $(if ($env:ProgramFiles -ne ${env:ProgramFiles(x86)}) { Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe" } else { $null }),
    (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe")
  )) {
    if (-not [string]::IsNullOrWhiteSpace($path) -and (Test-Path -LiteralPath $path)) {
      $name = if ($path -like "*msedge.exe") { "Microsoft Edge" } else { "Google Chrome" }
      $candidates.Add([PSCustomObject]@{ name = $name; path = $path; source = "well-known-path" }) | Out-Null
    }
  }

  foreach ($commandName in @("msedge.exe", "chrome.exe")) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command -and -not [string]::IsNullOrWhiteSpace($command.Source)) {
      $name = if ($commandName -eq "msedge.exe") { "Microsoft Edge" } else { "Google Chrome" }
      $candidates.Add([PSCustomObject]@{ name = $name; path = $command.Source; source = "path-command" }) | Out-Null
    }
  }

  return @($candidates | Select-Object -First 1)[0]
}

function Test-HttpEndpoint {
  param([string]$Uri)

  if ($SkipProbe) {
    return [ordered]@{
      uri = $Uri
      ok = $null
      skipped = $true
      statusCode = $null
      error = $null
    }
  }

  try {
    $response = Invoke-WebRequest -Uri $Uri -TimeoutSec 8 -UseBasicParsing
    return [ordered]@{
      uri = $Uri
      ok = [int]$response.StatusCode -eq 200
      skipped = $false
      statusCode = [int]$response.StatusCode
      error = $null
    }
  } catch {
    $statusCode = $null
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }
    return [ordered]@{
      uri = $Uri
      ok = $false
      skipped = $false
      statusCode = $statusCode
      error = $_.Exception.Message
    }
  }
}

function Ensure-AppIcon {
  New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
  if (Test-Path -LiteralPath $IconPath) {
    return $IconPath
  }

  try {
    Add-Type -AssemblyName System.Drawing
    if (-not ("PortariumDesktopIconNative" -as [type])) {
      Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class PortariumDesktopIconNative {
  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool DestroyIcon(IntPtr hIcon);
}
"@
    }

    $size = 64
    $bitmap = New-Object System.Drawing.Bitmap -ArgumentList $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $rect = New-Object System.Drawing.Rectangle -ArgumentList 2, 2, 60, 60
    $radius = 14
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
    $path.AddArc(($rect.Right - $radius), $rect.Y, $radius, $radius, 270, 90)
    $path.AddArc(($rect.Right - $radius), ($rect.Bottom - $radius), $radius, $radius, 0, 90)
    $path.AddArc($rect.X, ($rect.Bottom - $radius), $radius, $radius, 90, 90)
    $path.CloseFigure()

    $topColor = [System.Drawing.Color]::FromArgb(255, 14, 28, 38)
    $bottomColor = [System.Drawing.Color]::FromArgb(255, 16, 94, 104)
    $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $rect, $topColor, $bottomColor, 45.0
    $graphics.FillPath($backgroundBrush, $path)

    $accentColor = [System.Drawing.Color]::FromArgb(255, 115, 238, 205)
    $accentPen = New-Object System.Drawing.Pen -ArgumentList $accentColor, 3.0
    $graphics.DrawEllipse($accentPen, 38, 12, 10, 10)
    $graphics.DrawLine($accentPen, 43, 22, 43, 32)

    $font = New-Object System.Drawing.Font -ArgumentList "Segoe UI Semibold", 32.0, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::White)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $textRect = New-Object System.Drawing.RectangleF -ArgumentList 0.0, 8.0, 64.0, 52.0
    $graphics.DrawString("P", $font, $textBrush, $textRect, $format)

    $hIcon = $bitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    $stream = [System.IO.File]::Open($IconPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
    try {
      $icon.Save($stream)
    } finally {
      $stream.Close()
      $stream.Dispose()
      $icon.Dispose()
      [PortariumDesktopIconNative]::DestroyIcon($hIcon) | Out-Null
      $format.Dispose()
      $textBrush.Dispose()
      $font.Dispose()
      $accentPen.Dispose()
      $backgroundBrush.Dispose()
      $path.Dispose()
      $graphics.Dispose()
      $bitmap.Dispose()
    }

    return $IconPath
  } catch {
    return $null
  }
}

function Get-DefaultShortcutArguments {
  $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Mode Launch -TargetUrl `"$TargetUrl`" -AppName `"$AppName`" -ShortcutName `"$ShortcutName`" -StartMenuGroup `"$StartMenuGroup`" -StateDir `"$StateDir`" -ProfileDir `"$ProfileDir`" -IconPath `"$IconPath`" -WorkingDirectory `"$WorkingDirectory`""
  if ($SkipProbe) {
    $arguments = "$arguments -SkipProbe"
  }
  if ($RequireReady) {
    $arguments = "$arguments -RequireReady"
  }
  return $arguments
}

function New-AppShortcut {
  param(
    [string]$Path,
    [object]$Browser
  )

  $parent = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $parent | Out-Null

  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($Path)
  if ([string]::IsNullOrWhiteSpace($ShortcutCommandPath)) {
    $shortcut.TargetPath = "powershell.exe"
    $shortcut.Arguments = Get-DefaultShortcutArguments
  } else {
    $shortcut.TargetPath = $ShortcutCommandPath
    $shortcut.Arguments = $ShortcutCommandArguments
  }
  $shortcut.WorkingDirectory = $WorkingDirectory
  $shortcut.Description = "Launch $AppName in a dedicated browser app window."
  $appIcon = Ensure-AppIcon
  if (-not [string]::IsNullOrWhiteSpace($appIcon)) {
    $shortcut.IconLocation = "$appIcon,0"
  } elseif ($Browser -and -not [string]::IsNullOrWhiteSpace($Browser.path)) {
    $shortcut.IconLocation = "$($Browser.path),0"
  }
  $shortcut.Save()
}

function Get-ShortcutState {
  return [ordered]@{
    startMenu = [ordered]@{
      path = $startMenuShortcutPath
      exists = Test-Path -LiteralPath $startMenuShortcutPath
    }
    desktop = [ordered]@{
      path = $desktopShortcutPath
      exists = Test-Path -LiteralPath $desktopShortcutPath
    }
  }
}

function New-BaseReport {
  param(
    [string]$Status,
    [object]$Browser,
    [object]$Probe
  )

  return [ordered]@{
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
    status = $Status
    mode = $Mode
    appName = $AppName
    targetUrl = $TargetUrl
    browser = $(if ($Browser) { $Browser } else { [ordered]@{ name = $null; path = $null; source = $null } })
    stateDir = $StateDir
    profileDir = $ProfileDir
    icon = [ordered]@{
      path = $IconPath
      exists = Test-Path -LiteralPath $IconPath
    }
    shortcuts = Get-ShortcutState
    probe = $Probe
    boundaries = @(
      "Windows desktop integration only: Start Menu shortcut, optional Desktop shortcut, generated icon, and dedicated browser profile.",
      "Launch uses Microsoft Edge or Google Chrome app mode with --user-data-dir; it does not read cookies, storage, saved passwords, or profile contents.",
      "The launcher does not start Portarium services, create tunnels, change DNS, mutate provider accounts, or perform external actions.",
      "Pass a caller-owned wrapper as ShortcutCommandPath when a deployment needs readiness, policy, or access gates before opening Cockpit."
    )
  }
}

function Write-AppReport {
  param([object]$Report)

  $parent = Split-Path -Parent $ReportPath
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  $Report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ReportPath -Encoding UTF8
}

function Get-AppStatus {
  param(
    [object]$Browser,
    [object]$Probe,
    [string]$NotReadyStatus = "access-not-ready"
  )

  if (-not $isWindows) {
    return "blocked-unsupported-os"
  }

  if (-not $Browser) {
    return "blocked-no-browser"
  }

  if (-not $SkipProbe -and -not $Probe.ok) {
    return $NotReadyStatus
  }

  return "ok"
}

function Remove-ProfileIfRequested {
  if (-not $RemoveProfile -or -not (Test-Path -LiteralPath $ProfileDir)) {
    return
  }

  $resolvedProfile = (Resolve-Path -LiteralPath $ProfileDir).Path
  $resolvedState = (Resolve-Path -LiteralPath $StateDir).Path
  if (-not $resolvedProfile.StartsWith($resolvedState, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove profile outside state dir: $resolvedProfile"
  }
  Remove-Item -LiteralPath $resolvedProfile -Recurse -Force
}

if (-not $isWindows) {
  $probe = Test-HttpEndpoint -Uri $TargetUrl
  $report = New-BaseReport -Status "blocked-unsupported-os" -Browser $null -Probe $probe
  Write-AppReport -Report $report
  $report | ConvertTo-Json -Depth 10
  exit 1
}

$browser = Get-BrowserCandidate
$probe = Test-HttpEndpoint -Uri $TargetUrl

if ($Mode -eq "Status") {
  $status = Get-AppStatus -Browser $browser -Probe $probe
  $report = New-BaseReport -Status $status -Browser $browser -Probe $probe
  Write-AppReport -Report $report
  $report | ConvertTo-Json -Depth 10
  if ($status -in @("blocked-unsupported-os", "blocked-no-browser", "access-not-ready")) { exit 1 }
  exit 0
}

if ($Mode -eq "Install") {
  if (-not $browser) {
    $report = New-BaseReport -Status "blocked-no-browser" -Browser $null -Probe $probe
    Write-AppReport -Report $report
    $report | ConvertTo-Json -Depth 10
    exit 1
  }

  New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
  Ensure-AppIcon | Out-Null
  if ($installStartMenuShortcut) {
    New-AppShortcut -Path $startMenuShortcutPath -Browser $browser
  }
  if ($installDesktopShortcut) {
    New-AppShortcut -Path $desktopShortcutPath -Browser $browser
  }
  $status = Get-AppStatus -Browser $browser -Probe $probe -NotReadyStatus "installed-access-not-ready"
  $report = New-BaseReport -Status $status -Browser $browser -Probe $probe
  $report.install = [ordered]@{
    startMenuShortcutRequested = $installStartMenuShortcut
    desktopShortcutRequested = $installDesktopShortcut
    customShortcutCommand = -not [string]::IsNullOrWhiteSpace($ShortcutCommandPath)
  }
  Write-AppReport -Report $report
  $report | ConvertTo-Json -Depth 10
  exit 0
}

if ($Mode -eq "Uninstall") {
  foreach ($shortcut in @($startMenuShortcutPath, $desktopShortcutPath)) {
    if (Test-Path -LiteralPath $shortcut) {
      Remove-Item -LiteralPath $shortcut -Force
    }
  }
  Remove-ProfileIfRequested

  $status = Get-AppStatus -Browser $browser -Probe $probe
  $report = New-BaseReport -Status $status -Browser $browser -Probe $probe
  $report.uninstall = [ordered]@{
    removedProfile = [bool]$RemoveProfile
  }
  Write-AppReport -Report $report
  $report | ConvertTo-Json -Depth 10
  exit 0
}

if ($Mode -eq "Launch") {
  if (-not $browser) {
    $report = New-BaseReport -Status "blocked-no-browser" -Browser $null -Probe $probe
    Write-AppReport -Report $report
    $report | ConvertTo-Json -Depth 10
    exit 1
  }

  if ($RequireReady -and -not $SkipProbe -and -not $probe.ok) {
    $report = New-BaseReport -Status "access-not-ready" -Browser $browser -Probe $probe
    Write-AppReport -Report $report
    $report | ConvertTo-Json -Depth 10
    exit 1
  }

  New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
  $browserArguments = @(
    "--app=$TargetUrl",
    "--user-data-dir=$ProfileDir",
    "--no-first-run",
    "--disable-features=Translate"
  )
  $process = Start-Process -FilePath $browser.path -ArgumentList $browserArguments -WorkingDirectory $WorkingDirectory -PassThru
  $status = Get-AppStatus -Browser $browser -Probe $probe
  $report = New-BaseReport -Status $status -Browser $browser -Probe $probe
  $report.launch = [ordered]@{
    processId = $process.Id
    visibleWindow = $true
  }
  Write-AppReport -Report $report
  $report | ConvertTo-Json -Depth 10
  exit 0
}
