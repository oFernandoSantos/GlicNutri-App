# Resumo da entrega — Thayse (Machine Learning + API + dados reais)

Este documento é o “texto pronto” para a entrega/demonstração do ML usando **dados do GlicNutri** (Supabase), com **pipeline**, **persistência** e **API**.

## 1) Dataset oficial (contrato)

- **Unidade**: 1 linha = 1 **paciente-dia** (`patient_id` + `dia`)
- **Janela padrão**: últimos **60 dias** (`--days 60`)
- **CSV**: `machine-learning/data/glicnutri_patient_day_export.csv`
- **Manifest (evidência reprodutível)**: `machine-learning/data/export_manifest.json` (contagem, colunas, janela e SHA-256 do CSV)

### Features usadas no `/predict`

- `n_leituras_glicemia`
- `carbs_sum_g`
- `kcal_sum`
- `protein_sum_g`
- `fat_sum_g`
- `n_refeicoes_ia`
- `n_eventos_medicacao`

### Alvos (tarefas)

- **Classificação**: `target_glucose_high = (glucose_mean_mg_dl >= 150)`
- **Regressão**: prever `glucose_mean_mg_dl`
- **Clusterização**: KMeans (features)
- **Similaridade**: NearestNeighbors (features)

## 2) Como exportar (Supabase → CSV)

Na pasta `GlicNutri/`:

```powershell
$env:DATABASE_URL = "postgresql://..."
python machine-learning/scripts/export_supabase_csv.py `
  --output machine-learning/data/glicnutri_patient_day_export.csv `
  --manifest machine-learning/data/export_manifest.json `
  --days 60
```

Evidência gerada:
- `machine-learning/data/glicnutri_patient_day_export.csv`
- `machine-learning/data/export_manifest.json`

## 3) Como treinar e gerar artefatos

Notebook principal (pipeline):
- `machine-learning/notebooks/glicnutri_ml_pipeline.ipynb`

Evidência de execução (no repositório):
- `machine-learning/notebooks/glicnutri_ml_pipeline.executed.ipynb`

Artefatos gerados (joblib):
- `machine-learning/api/artifacts/model_classification.joblib`
- `machine-learning/api/artifacts/model_regression.joblib`
- `machine-learning/api/artifacts/model_clustering.joblib`
- `machine-learning/api/artifacts/model_similarity.joblib`
- `machine-learning/api/artifacts/similarity_train_matrix.joblib`
- `machine-learning/api/artifacts/training_meta.json`

## 4) API (FastAPI)

Código:
- `machine-learning/api/app/main.py`

Endpoints:
- `GET /health`
- `POST /predict`

Execução local:

```powershell
cd machine-learning/api
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

> Observação: CORS está habilitado para permitir chamadas do app web (Expo).

### Exemplo de chamada (`/predict`)

```powershell
$payload = @{
  n_leituras_glicemia = 4
  carbs_sum_g = 95
  kcal_sum = 850
  protein_sum_g = 40
  fat_sum_g = 30
  n_refeicoes_ia = 2
  n_eventos_medicacao = 1
} | ConvertTo-Json -Compress

irm "http://127.0.0.1:8001/predict" -Method Post -ContentType "application/json" -Body $payload
```

## 5) Integração no app (teste local)

- Tela paciente: `src/telas/paciente/TelaPrevisaoMl.js` (rota `PacientePrevisaoML`)
- Serviço: `src/servicos/servicoMlLocal.js`
- Acesso no menu do paciente: item **“Previsão (IA)”**

Host padrão:
- Android emulador: `10.0.2.2`
- Web/iOS: `127.0.0.1`
- Celular físico: IP do PC (mesma rede)

## 6) Checklist de evidências para apresentação/ZIP

- [x] CSV exportado (`machine-learning/data/glicnutri_patient_day_export.csv`)
- [x] Manifest (`machine-learning/data/export_manifest.json`)
- [x] Notebook executado (`machine-learning/notebooks/glicnutri_ml_pipeline.executed.ipynb`) ou prints do output
- [x] Artefatos (`machine-learning/api/artifacts/`)
- [x] API rodando (`/health` ok + `/predict` retornando JSON)
- [x] App mostrando resultado na tela “Previsão (Machine Learning)”

