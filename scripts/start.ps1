$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$VenvPath = Join-Path $ProjectRoot "venv"

if (-not (Test-Path $VenvPath)) {
    Write-Host "Virtual environment not found at $VenvPath." -ForegroundColor Red
    Write-Host "Please create it and install requirements.txt first." -ForegroundColor Yellow
    exit 1
}

$PythonExe = Join-Path $VenvPath "Scripts\python.exe"
$Env:PYTHONPATH = $ProjectRoot

Write-Host "Starting OpsPilot..." -ForegroundColor Cyan
Write-Host "Local URL: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the application." -ForegroundColor Yellow

# Start Uvicorn
& $PythonExe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
