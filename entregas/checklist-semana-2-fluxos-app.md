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
| T1 | `DATABASE_URL` / `SUPABASE_DB_URL` definido no ambiente onde o export foi executado (não commitado). | [x] |
| T2 | Comando com `--manifest`: ver [`machine-learning/EXPORT_CSV.md`](../../machine-learning/EXPORT_CSV.md). | [x] |
| T3 | `export_manifest.json` versionado com contagem/hash; CSV real gerado localmente (`.gitignore` em `data/`). | [x] |
| T4 | Notebook executado: `machine-learning/notebooks/glicnutri_ml_pipeline.executed.ipynb`. | [x] |
| T5 | Registo em [`machine-learning/EXPORT_CSV.md`](../../machine-learning/EXPORT_CSV.md) — tabela «Registo de execução» preenchida. | [x] |

## Bento — autenticação e recuperação

| # | Verificação | OK |
|---|-------------|---|
| B1 | Login paciente e-mail/senha OK; falha credencial sem senha nos logs (roteiro §2 e §5). | [x] |
| B2 | Login nutricionista e admin conforme roteiro §3–4. | [x] |
| B3 | Recuperação de senha (paciente/nutri): código por e-mail e nova senha aceita. | [~] |
| B4 | Cadastro com validação de e-mail (código) quando aplicável. | [~] |

> **B1–B2:** evidência visual em [`bento/semana-2-auditoria/evidencias-auditoria.md`](bento/semana-2-auditoria/evidencias-auditoria.md) (metadados indicam papéis paciente/nutri/admin). **B3–B4:** repetir smoke-test antes da banca se o professor exigir captura dedicada.

## Bento — CRUD e fluxo clínico principal

| # | Verificação | OK |
|---|-------------|---|
| C1 | Cadastro paciente / edição nutricionista sem regressão. | [~] |
| C2 | Registro glicemia manual persiste e aparece no monitoramento. | [x] |
| C3 | Registro medicação/insulina. | [~] |
| C4 | Refeição IA até gravar no banco. | [~] |

> **C2:** prints `glicemia_*.png` em `bento/semana-2-auditoria/prints/`. **C1, C3, C4:** código e roteiros em `CRUD-VALIDACOES-ROTEIRO-EVIDENCIAS.md`; capturar prints se a disciplina pedir prova adicional.

## Evidências

| # | Verificação | OK |
|---|-------------|---|
| E1 | Prints ou relatório já em [`bento/semana-2-auditoria/`](bento/semana-2-auditoria/) cobrem login + glicemia + auditoria. | [x] |
| E2 | Nova evidência só se algum fluxo acima falhar ou disciplina pedir recuperação de senha explícita. | [ ] |

---

**Última atualização:** maio/2026 — alinhado ao `export_manifest.json`, notebook executado e evidências Semana 2; itens `[~]` dependem de smoke-test opcional antes da defesa.
