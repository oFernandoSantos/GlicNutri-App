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

Na raiz do repositório:

```powershell
$env:DATABASE_URL = "postgresql://..."
python ml/scripts/export_supabase_csv.py --output ml/data/glicnutri_patient_day_export.csv --days 90
```

Parâmetros úteis:

- `--days N` — janela em dias até agora (predefinição 365).
- `--since` / `--until` — intervalo ISO8601 (substituem `--days`).

## Saída

- Ficheiro CSV com colunas agregadas por `patient_id` e `dia` (ver SQL no script e [`dataset-referencia-glicnutri.md`](dataset-referencia-glicnutri.md)).
- Mensagem no stdout: `Exportadas N linhas → <caminho>`.

## Evidência no repositório (Semana 2)

| Situação | O que versionar |
|----------|-----------------|
| Export executado com sucesso | Anexar ou referenciar `ml/data/glicnutri_patient_day_export.csv` (ou cópia em `entregas/`) **sem dados sensíveis** se a política da disciplina o permitir; caso contrário, guardar apenas hash/contagem de linhas num relatório. |
| Sem credenciais neste ambiente | Este documento serve como procedimento reprodutível; o grupo executa localmente e anexa prova na entrega académica. |

**Execução neste workspace (maio/2026):** após `pip install psycopg2-binary pandas`, sem `DATABASE_URL` / `SUPABASE_DB_URL` o script termina com código 1 e a mensagem *«Defina DATABASE_URL (ou SUPABASE_DB_URL) com a URI Postgres do projeto.»* — comportamento esperado até configurar credenciais.
