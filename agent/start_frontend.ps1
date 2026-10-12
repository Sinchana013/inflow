# PowerShell script to start InsightFlow AI Frontend
Write-Host "Starting InsightFlow AI React Frontend on http://127.0.0.1:5173..." -ForegroundColor Cyan

if (Test-Path "$PSScriptRoot\frontend") {
    Set-Location -Path "$PSScriptRoot\frontend"
} elseif (Test-Path ".\package.json") {
    # Already in frontend
}

npm run dev
