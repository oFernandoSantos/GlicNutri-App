# Machine Learning — GlicNutri

Tudo o que é **ML e API Python** do projeto está aqui.

| Subpasta | Conteúdo |
|----------|-----------|
| `data/` | CSV de exemplo, export real (gitignored), manifest opcional |
| `scripts/` | `export_supabase_csv.py` — Postgres → CSV paciente-dia |
| `notebooks/` | Pipeline principal `glicnutri_ml_pipeline.ipynb`; `referencia/` (GlucoBench) |
| `api/` | **FastAPI**: `app/main.py` (`GET /health`, `POST /predict`), `artifacts/*.joblib`, `requirements.txt`, `scripts/fit_demo_models.py` |

Documentação: [`EXPORT_CSV.md`](EXPORT_CSV.md), [`dataset-referencia-glicnutri.md`](dataset-referencia-glicnutri.md).
