#Requires -Version 5.1
<#
.SYNOPSIS
    Gera ZIP do código versionado (git archive), sem node_modules.

.DESCRIPTION
    Executar na raiz do repositório GlicNutri. Requer git no PATH.
    Saída: entregas/pacote-zip/GlicNutri-repositorio-YYYYMMDD.zip
#>
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $RepoRoot ".git"))) {
    Write-Error "Pasta .git nao encontrada em: $RepoRoot"
}
$OutDir = Join-Path $RepoRoot "entregas\pacote-zip"
if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}
$Date = Get-Date -Format "yyyyMMdd"
$OutFile = Join-Path $OutDir "GlicNutri-repositorio-$Date.zip"
Push-Location $RepoRoot
try {
    git archive --format=zip -o $OutFile HEAD
    if ($LASTEXITCODE -ne 0) { throw "git archive falhou com codigo $LASTEXITCODE" }
}
finally {
    Pop-Location
}
Write-Host "Criado: $OutFile"
Write-Host "Nota: ver entregas/PACOTE-MONTAGEM.md para CSV e anexos."
