$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $repoRoot "app\.venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "Python venv not found at: $venvPython" -ForegroundColor Red
    Write-Host "Create/install it first:"
    Write-Host "  py -m venv app\.venv"
    Write-Host "  .\app\.venv\Scripts\python.exe -m pip install -r .\app\requirements.txt"
    exit 1
}

# Mixed imports currently require both root and app on PYTHONPATH.
$env:PYTHONPATH = "$repoRoot;$repoRoot\app"

& $venvPython -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
