# Configura OPENAI_API_KEY nos secrets do Supabase (sem commitar chave no Git).
# Uso: na pasta GlicNutri, execute:
#   powershell -ExecutionPolicy Bypass -File .\scripts\configurar-openai-supabase.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ''
Write-Host '=== GlicNutri — OpenAI no Supabase ===' -ForegroundColor Cyan
Write-Host 'Projeto: isiweqkdoyxorohuibqb' -ForegroundColor DarkGray
Write-Host ''

Write-Host '1) Verificando login no Supabase CLI...' -ForegroundColor White
$loginCheck = npx supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'Voce ainda NAO esta logado no CLI.' -ForegroundColor Yellow
  Write-Host 'Rode SOMENTE este comando, pressione Enter, faca login no navegador e execute este script de novo:' -ForegroundColor Yellow
  Write-Host '  npx supabase login' -ForegroundColor Green
  Write-Host ''
  Write-Host $loginCheck
  exit 1
}
Write-Host '   Login OK.' -ForegroundColor Green
Write-Host ''

Write-Host '2) Cole a OPENAI_API_KEY (comeca com sk-).' -ForegroundColor White
Write-Host '   Nao cole a chave no chat do Cursor — so aqui no terminal.' -ForegroundColor DarkGray
$key = (Read-Host 'OPENAI_API_KEY').Trim().Trim('"').Trim("'")
if (-not $key.StartsWith('sk-')) {
  Write-Host 'Chave invalida: deve comecar com sk-.' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '3) Gravando secrets...' -ForegroundColor White
npx supabase secrets set "OPENAI_API_KEY=$key" OPENAI_VISION_MODEL=gpt-4o-mini
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Falha ao gravar secrets. Tente pelo Dashboard (link abaixo).' -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host '4) Secrets no projeto:' -ForegroundColor White
npx supabase secrets list

Write-Host ''
Write-Host 'Pronto. A function analisar-refeicao-ia ja deployada usa esses secrets.' -ForegroundColor Green
Write-Host 'Teste: app paciente -> Registrar refeicao com IA -> foto.' -ForegroundColor White
Write-Host 'Logs: https://supabase.com/dashboard/project/isiweqkdoyxorohuibqb/functions/analisar-refeicao-ia/logs' -ForegroundColor DarkGray
Write-Host ''
