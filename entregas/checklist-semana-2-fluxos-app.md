# Checklist — Semana 2 (fluxos principais + dados ML)

Marque após execução manual ou evidência gerada. Referências de auditoria: [`bento/semana-2-auditoria/roteiro-testes.md`](bento/semana-2-auditoria/roteiro-testes.md). Índice da entrega: [`README-ENTREGA-SEMANA-2.md`](README-ENTREGA-SEMANA-2.md).

## Repositório — preparação Semana 2 (sem credenciais)

| # | Verificação | OK |
|---|-------------|---|
| R1 | Script export + docs (`machine-learning/EXPORT_CSV.md`, `entregas/SEMANA-2-PASSO-A-PASSO.md`). | [x] |
| R2 | Atalhos: `npm run ml:export-csv`, `machine-learning/scripts/exportar_csv_semana2.ps1`. | [x] |
| R3 | Notebook `glicnutri_ml_pipeline.ipynb` e CSV de exemplo em `machine-learning/data/`. | [x] |

## Thayse — export e notebook

| # | Verificação | OK |
|---|-------------|---|
| T1 | `DATABASE_URL` definido localmente (não commitado). | [ ] |
| T2 | Comando com `--manifest`: ver [`machine-learning/EXPORT_CSV.md`](../../machine-learning/EXPORT_CSV.md). | [ ] |
| T3 | `machine-learning/data/glicnutri_patient_day_export.csv` gerado OU manifest/`export_manifest.json` preenchido para evidência. | [ ] |
| T4 | Notebook `machine-learning/notebooks/glicnutri_ml_pipeline.ipynb` executado até EDA sem erro (usa export se existir; senão sample). | [ ] |
| T5 | Registo em [`machine-learning/EXPORT_CSV.md`](../../machine-learning/EXPORT_CSV.md) — tabela “Registo de execução” atualizada. | [ ] |

## Bento — autenticação e recuperação

| # | Verificação | OK |
|---|-------------|---|
| B1 | Login paciente e-mail/senha OK; falha credencial sem senha nos logs (roteiro §2 e §5). | [ ] |
| B2 | Login nutricionista e admin conforme roteiro §3–4. | [ ] |
| B3 | Recuperação de senha (paciente/nutri): código por e-mail e nova senha aceita. | [ ] |
| B4 | Cadastro com validação de e-mail (código) quando aplicável. | [ ] |

## Bento — CRUD e fluxo clínico principal

| # | Verificação | OK |
|---|-------------|---|
| C1 | Cadastro paciente / edição nutricionista sem regressão. | [ ] |
| C2 | Registro glicemia manual persiste e aparece no monitoramento. | [ ] |
| C3 | Registro medicação/insulina. | [ ] |
| C4 | Refeição IA até gravar no banco. | [ ] |

## Evidências

| # | Verificação | OK |
|---|-------------|---|
| E1 | Prints ou relatório já em [`bento/semana-2-auditoria/`](bento/semana-2-auditoria/) cobrem login + glicemia + auditoria. | [x] |
| E2 | Nova evidência só se algum fluxo acima falhar ou disciplina pedir recuperação de senha explícita. | [ ] |

---

**Última atualização:** 04/05/2026 — índice [`README-ENTREGA-SEMANA-2.md`](README-ENTREGA-SEMANA-2.md); evidências E1 alinhadas a [`evidencias-auditoria.md`](bento/semana-2-auditoria/evidencias-auditoria.md); itens Thayse T1–T5 e fluxos B/C permanecem para validação manual com ambiente real.
