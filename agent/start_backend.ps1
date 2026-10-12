# PowerShell script to start InsightFlow AI Backend
Write-Host "Starting InsightFlow AI FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Cyan

if (Test-Path "$PSScriptRoot\backend") {
    Set-Location -Path "$PSScriptRoot\backend"
} elseif (Test-Path ".\app\main.py") {
    # Already in backend
}

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
