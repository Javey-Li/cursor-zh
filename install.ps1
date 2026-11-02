# cursor-zh - Windows PowerShell installer
$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

Write-Host "cursor-zh - Cursor 简体中文汉化"
Write-Host "================================"
Write-Host ""

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    Write-Host "未找到 Node.js。请先安装 Node.js 18 或更高版本："
    Write-Host "  https://nodejs.org/"
    Write-Host ""
    Read-Host "按回车退出"
    exit 1
}

$nodeVersion = (& node -p "process.versions.node").Trim()
$nodeMajor = [int]($nodeVersion.Split(".")[0])
if ($nodeMajor -lt 18) {
    Write-Host "Node.js 版本过低：$nodeVersion，需要 18 或更高版本。"
    Write-Host ""
    Read-Host "按回车退出"
    exit 1
}

Write-Host "Node.js: $nodeVersion"
Write-Host "仓库: $PSScriptRoot"
Write-Host ""

$appArgs = @()
if ($env:CURSOR_ZH_APP) {
    $appArgs = @("--app", $env:CURSOR_ZH_APP)
}

& node cli/index.js doctor @appArgs
& node cli/index.js install @appArgs
$status = $LASTEXITCODE

Write-Host ""
if ($status -eq 0) {
    Write-Host "完成。请完全退出 Cursor 再重新打开。"
} else {
    Write-Host "安装未完成（退出码 $status）。"
    Write-Host "如需回滚：node cli/index.js restore"
}
Write-Host ""

Read-Host "按回车关闭窗口"
exit $status
