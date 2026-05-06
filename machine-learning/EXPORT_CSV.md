# Export CSV reprodutível (Supabase → paciente-dia)

Script: [`scripts/export_supabase_csv.py`](scripts/export_supabase_csv.py).

## Variáveis de ambiente

Defina uma das seguintes com a **URI PostgreSQL** do projeto (Supabase: **Settings → Database → Connection string → URI**, modo Session ou Transaction pooler conforme a sua rede):

- `DATABASE_URL`
- `SUPABASE_DB_URL`

Exemplo de formato:

```text
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Não** commite credenciais no repositório.

## Comando (PowerShell)

Na pasta **`GlicNutri/`** (raiz do app no monorepo):

```powershell
cd GlicNutri
$env:DATABASE_URL = "postgresql://..."
python machine-learning/scripts/export_supabase_csv.py `
  --output machine-learning/data/glicnutri_patient_day_export.csv `
  --manifest machine-learning/data/export_manifest.json `
  --days 90
```

Atalhos equivalentes (mesma pasta `GlicNutri/`, com variável de ambiente já definida):

- `npm run ml:export-csv` (script em [`package.json`](../package.json))
- `.\machine-learning\scripts\exportar_csv_semana2.ps1`

Parâmetros úteis:

- `--days N` — janela em dias até agora (predefinição 365).
- `--since` / `--until` — intervalo ISO8601 (substituem `--days`).
- `--manifest PATH` — grava JSON com `row_count`, lista de `columns`, intervalo `since_ts`/`until_ts`, `csv_sha256` e caminho do ficheiro (evidência reprodutível sem obrigar a commit do CSV completo).

## Saída

- Ficheiro CSV com colunas agregadas por `patient_id` e `dia` (ver SQL no script e [`dataset-referencia-glicnutri.md`](dataset-referencia-glicnutri.md)).
- Mensagem no stdout: `Exportadas N linhas → <caminho>`.

## Notebook ML após export

Defina `GLICNUTRI_CSV_PATH` para forçar um CSV (útil em CI ou caminho absoluto). Caso contrário, o notebook [`notebooks/glicnutri_ml_pipeline.ipynb`](notebooks/glicnutri_ml_pipeline.ipynb) usa **por ordem**: ficheiro `machine-learning/data/glicnutri_patient_day_export.csv` se existir localmente; senão `sample_glicnutri_patient_day.csv`.

## Evidência no repositório (Semana 2)

| Situação | O que versionar |
|----------|-----------------|
| Export executado com sucesso | Preferir commit de **`machine-learning/data/export_manifest.json`** (hash + contagem + colunas). O CSV real está em `.gitignore` por defeito em [`data/.gitignore`](data/.gitignore); anexe o CSV à entrega ZIP da disciplina se for obrigatório. |
| Sem credenciais neste ambiente | Este documento serve como procedimento reprodutível; o grupo executa localmente e anexa prova na entrega académica. |

**Execução neste workspace (maio/2026):** após `pip install psycopg2-binary pandas`, sem `DATABASE_URL` / `SUPABASE_DB_URL` o script termina com código 1 e a mensagem *«Defina DATABASE_URL (ou SUPABASE_DB_URL) com a URI Postgres do projeto.»* — comportamento esperado até configurar credenciais.

### Registo de execução (Semana 2 — preencher após export real)

| Campo | Valor |
|-------|--------|
| Data da execução | |
| Comando usado (sem password) | `python machine-learning/scripts/export_supabase_csv.py --output ... --manifest ...` |
| Linhas exportadas | (do stdout ou `export_manifest.json`) |
| SHA-256 do CSV | (do manifest) |
| Responsável | |
