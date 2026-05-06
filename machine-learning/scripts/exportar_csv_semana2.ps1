# Export CSV paciente-dia (Semana 2).
# Antes de executar, defina a URI Postgres no mesmo terminal:
#   $env:DATABASE_URL = "postgresql://..."
# ou $env:SUPABASE_DB_URL = "..."
#
# Executar a partir da pasta GlicNutri:
#   .\machine-learning\scripts\exportar_csv_semana2.ps1

$ErrorActionPreference = "Stop"

$glicnutriRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $glicnutriRoot

if (-not $env:DATABASE_URL -and -not $env:SUPABASE_DB_URL) {
    Write-Host ""
    Write-Host "Defina primeiro uma das variaveis:" -ForegroundColor Yellow
    Write-Host '  $env:DATABASE_URL = "postgresql://postgres.[ref]:[PASSWORD]@....pooler.supabase.com:6543/postgres"' -ForegroundColor Cyan
    Write-Host "  ou SUPABASE_DB_URL" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Python nao encontrado no PATH. Instale Python 3 e tente de novo." -ForegroundColor Red
    exit 1
}

Write-Host "Pasta: $glicnutriRoot" -ForegroundColor Gray

& python `
    machine-learning/scripts/export_supabase_csv.py `
    --output machine-learning/data/glicnutri_patient_day_export.csv `
    --manifest machine-learning/data/export_manifest.json `
    --days 90
