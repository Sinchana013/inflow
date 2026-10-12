# PowerShell script to start InsightFlow AI Frontend
Write-Host "Starting InsightFlow AI React Frontend on http://127.0.0.1:5173..." -ForegroundColor Cyan

npm run dev -- --host 127.0.0.1 --port 5173
