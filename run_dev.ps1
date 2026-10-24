# Powershell Development Runner
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Starting MyMusic Platform (Dev)      " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Set environment variables
$env:PYTHONPATH = "server"

# 2. Check and seed database if necessary
& ".\.venv\Scripts\python.exe" server\app\services\seed.py

# 3. Start Backend server
Write-Host "Starting FastAPI Backend on http://localhost:8000..." -ForegroundColor Yellow
$backendJob = Start-Process -FilePath ".\.venv\Scripts\python.exe" -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000" -PassThru

# 4. Start Frontend development server
Write-Host "Starting Vite React Frontend on http://localhost:5173..." -ForegroundColor Yellow
Set-Location web
& "C:\Program Files\nodejs\npm.cmd" run dev

# Stop backend when frontend terminates
Stop-Process -Id $backendJob.Id -Force
