# PowerShell script to start InsightFlow AI Backend
Write-Host "Starting InsightFlow AI FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Cyan

if (Test-Path "$PSScriptRoot\app\main.py") {
    Set-Location -Path "$PSScriptRoot"
}

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
