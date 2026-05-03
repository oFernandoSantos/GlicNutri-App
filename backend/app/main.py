"""
API FastAPI — endpoint POST /predict para modelos treinados no pipeline GlicNutri.

Execução local:
  cd backend
  pip install -r requirements.txt
  python scripts/fit_demo_models.py
  uvicorn app.main:app --reload
"""

from __future__ import annotations

import json
import os
from typing import Any

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ARTIFACTS = os.path.join(ROOT, "artifacts")


def _load_json(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _artifact_path(name: str) -> str:
    return os.path.join(ARTIFACTS, name)


app = FastAPI(title="GlicNutri ML API", version="0.1.0")


class PredictIn(BaseModel):
    """Valores numéricos alinhados às colunas do CSV paciente-dia (após export)."""

    n_leituras_glicemia: float = Field(0, ge=0)
    carbs_sum_g: float = Field(0, ge=0)
    kcal_sum: float = Field(0, ge=0)
    protein_sum_g: float = Field(0, ge=0)
    fat_sum_g: float = Field(0, ge=0)
    n_refeicoes_ia: float = Field(0, ge=0)
    n_eventos_medicacao: float = Field(0, ge=0)


class PredictOut(BaseModel):
    prob_glucose_elevada: float
    classe_glucose_elevada: int
    glucose_mean_previsto_mg_dl: float
    cluster_id: int
    vizinhos_mais_proximos_indices: list[int]


def _ensure_artifacts() -> None:
    required = [
        "model_classification.joblib",
        "model_regression.joblib",
        "model_clustering.joblib",
        "model_similarity.joblib",
        "similarity_train_matrix.joblib",
        "training_meta.json",
    ]
    missing = [r for r in required if not os.path.isfile(_artifact_path(r))]
    if missing:
        raise HTTPException(
            status_code=503,
            detail=(
                "Artefatos ausentes: "
                + ", ".join(missing)
                + ". Execute: python backend/scripts/fit_demo_models.py"
            ),
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", response_model=PredictOut)
def predict(body: PredictIn) -> PredictOut:
    _ensure_artifacts()

    meta = _load_json(_artifact_path("training_meta.json"))
    cols: list[str] = meta["feature_columns"]

    row_df = pd.DataFrame([{c: float(getattr(body, c)) for c in cols}])

    clf = joblib.load(_artifact_path("model_classification.joblib"))
    reg = joblib.load(_artifact_path("model_regression.joblib"))
    km = joblib.load(_artifact_path("model_clustering.joblib"))
    nn = joblib.load(_artifact_path("model_similarity.joblib"))

    proba = clf.predict_proba(row_df)[0]
    cls = int(clf.predict(row_df)[0])
    reg_val = float(reg.predict(row_df)[0])
    cluster = int(km.predict(row_df)[0])

    dist, ind = nn.kneighbors(row_df, return_distance=True)
    neighbors = ind[0].tolist()

    prob_pos = float(proba[1]) if proba.shape[0] > 1 else float(proba[0])

    return PredictOut(
        prob_glucose_elevada=prob_pos,
        classe_glucose_elevada=cls,
        glucose_mean_previsto_mg_dl=reg_val,
        cluster_id=cluster,
        vizinhos_mais_proximos_indices=neighbors,
    )
