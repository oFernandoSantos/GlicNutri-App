# Entrega Semana 2 — índice do repositório

**Prazo planejado:** 10/05/2026 · **Estado global:** parcial (Thayse/dados reais dependem de credenciais); Bento/auditoria com evidência visual completa no Git.

## O que entregar / mostrar na reunião

| Peça | Ficheiro | Quem completa |
|------|----------|----------------|
| Manual passo a passo (export + notebook + checklist) | [`SEMANA-2-PASSO-A-PASSO.md`](SEMANA-2-PASSO-A-PASSO.md) | Grupo |
| Procedimento export CSV | [`../machine-learning/EXPORT_CSV.md`](../machine-learning/EXPORT_CSV.md) | Thayse / credenciais DB |
| Checklist fluxos app + ML | [`checklist-semana-2-fluxos-app.md`](checklist-semana-2-fluxos-app.md) | Grupo após testes |
| Demo reunião | [`demo-reuniao-semana-2.md`](demo-reuniao-semana-2.md) | Quem apresenta |
| Evidências auditoria (Bento) | [`bento/semana-2-auditoria/evidencias-auditoria.md`](bento/semana-2-auditoria/evidencias-auditoria.md) + [`prints/`](bento/semana-2-auditoria/prints/) | Completo no repo |
| Status consolidado Bento | [`bento/semana-2-auditoria/STATUS-SEMANA-2.md`](bento/semana-2-auditoria/STATUS-SEMANA-2.md) | Referência |

## O que já está preparado no código (sem `DATABASE_URL`)

- Script Python: [`machine-learning/scripts/export_supabase_csv.py`](../machine-learning/scripts/export_supabase_csv.py)
- Atalho PowerShell: [`machine-learning/scripts/exportar_csv_semana2.ps1`](../machine-learning/scripts/exportar_csv_semana2.ps1)
- Comando npm (na pasta `GlicNutri/`): `npm run ml:export-csv` — ver [`package.json`](../package.json)
- Notebook ML: [`machine-learning/notebooks/glicnutri_ml_pipeline.ipynb`](../machine-learning/notebooks/glicnutri_ml_pipeline.ipynb)
- Planejamento atualizado: [`Planejamento_Final_Atividades_GlicNutri_Ajustado.md`](../Planejamento_Final_Atividades_GlicNutri_Ajustado.md)

## Pendências só com dados reais (Thayse)

1. Export com `DATABASE_URL` / `SUPABASE_DB_URL` e preenchimento da tabela “Registo de execução” em `EXPORT_CSV.md`.
2. Opcional: commit de `machine-learning/data/export_manifest.json` após export (política do grupo/disciplina).
3. Executar o notebook até EDA com o CSV exportado (ou declarar plano B: sample + limitações na demo).
