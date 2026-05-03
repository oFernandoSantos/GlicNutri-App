# Dataset de referência — GlicNutri (preparação ML, sem pipeline aqui)

Documentação leve para alinhar futuros CSVs exportados do Supabase às necessidades da disciplina de ML **sem** implementar notebook ou ETL neste passo.

## Tabelas-alvo no projeto (referência)

| Área | Tabela / origem | Uso típico em ML |
|------|-----------------|------------------|
| Identificação | `paciente` | Rótulos demográficos, exclusão lógica (`excluido`) |
| Glicemia | `registro_glicemia_manual` | Regressão séries temporais, classificação faixa glicêmica |
| Medicação | `registro_medicacao` | Features de tratamento, dose/evento |
| Refeição | `refeicao_ia` | Macros (carboidratos, calorias…), confirmação pelo usuário |
| Estado agregado | campo serializado em `paciente` (app state / objetivo) | Hábitos resumidos quando exportados de forma controlada |

Não há neste repositório tabelas nomeadas `diario_rotina` ou `plano_alimentar`; parte do “diário” pode estar no estado do app persistido no paciente.

## Datasets públicos “parecidos” (somente inspiração metodológica)

- **Diabetes / leituras glicêmicas:** datasets tabulares com variáveis contínuas e fatores clínicos (ex.: estudos com glucose, insulin, BMI) servem como referência de **formato**, não de domínio idêntico.
- **Food / nutrition logs:** bases com macros por refeição ajudam a pensar **features** para `refeicao_ia`. Substituir sempre por dados reais do GlicNutri na etapa de ML.

## Mapeamento conceitual → colunas futuras de CSV

| Feature conceitual | Possível origem Supabase |
|--------------------|---------------------------|
| `patient_id` | `paciente.id_paciente_uuid` |
| `glucose_mg_dl` | `registro_glicemia_manual.valor_glicose_mgdl` |
| `glucose_datetime` | `data` + `hora` |
| `meal_carbs_g` | `refeicao_ia.carboidratos_total` |
| `meal_kcal` | `refeicao_ia.calorias_total` |
| `medication_event` | Agregar por dia a partir de `registro_medicacao` |

## Como gerar CSV (reprodutível)

Script versionado: [`scripts/export_supabase_csv.py`](scripts/export_supabase_csv.py).

1. Definir **janela temporal** (`--days`, `--since`, `--until`).
2. Exportar com cliente Postgres: definir `DATABASE_URL` (URI do projeto Supabase) e executar:
   `python ml/scripts/export_supabase_csv.py --output ml/data/glicnutri_patient_day_export.csv`
3. Validar tipos, nulos e consistência (pacientes com `excluido = false` já filtrados no script).
4. Usar o CSV no notebook [`notebooks/glicnutri_ml_pipeline.ipynb`](notebooks/glicnutri_ml_pipeline.ipynb) e regenerar artefatos em `backend/artifacts/`.

Arquivo de exemplo sem banco: [`data/sample_glicnutri_patient_day.csv`](data/sample_glicnutri_patient_day.csv).

Este arquivo ancora o vocabulário ao schema do app; o pipeline completo e a API `POST /predict` estão em `ml/notebooks/` e `backend/app/main.py`.
