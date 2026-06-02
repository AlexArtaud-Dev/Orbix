# Orbix dev launcher — PowerShell
$root = $PSScriptRoot

Get-Content "$root\.env" | ForEach-Object {
    if ($_ -match "^([A-Z_][A-Z0-9_]*)=(.*)$") {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

Write-Host "Starting PostgreSQL..." -ForegroundColor Cyan
docker compose up db -d

Write-Host "Starting backend in new window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "Set-Location '$root\backend'; `$env:DATABASE_URL='$($env:DATABASE_URL)'; `$env:JWT_SECRET='$($env:JWT_SECRET)'; `$env:VAULT_ENCRYPTION_KEY='$($env:VAULT_ENCRYPTION_KEY)'; `$env:PORT='3001'; `$env:NODE_ENV='development'; pnpm run start:dev"

Write-Host "Starting frontend..." -ForegroundColor Cyan
Set-Location "$root\frontend"
pnpm run dev
