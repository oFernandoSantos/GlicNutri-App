"""
API FastAPI — endpoint POST /predict para modelos treinados no pipeline GlicNutri.

Execução local:
  cd machine-learning/api
  pip install -r requirements.txt
  python scripts/fit_demo_models.py
  uvicorn app.main:app --reload
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from urllib import error as urllib_error
from urllib import request as urllib_request
from typing import Any

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ARTIFACTS = os.path.join(ROOT, "artifacts")


def _cors_allow_origins() -> list[str]:
    """
    Lista separada por vírgulas em ML_CORS_ORIGINS (ex.: https://app.exemplo.com,http://localhost:8081).
    Vazio => * (apenas desenvolvimento).
    """
    raw = os.environ.get("ML_CORS_ORIGINS", "").strip()
    if not raw:
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


def _load_json(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _artifact_path(name: str) -> str:
    return os.path.join(ARTIFACTS, name)


app = FastAPI(title="GlicNutri ML API", version="0.1.0")

# CORS: em produção defina ML_CORS_ORIGINS (origens do Expo Web / front-end).
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_allow_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


class LibreViewSyncIn(BaseModel):
    patientId: str | None = None
    patientEmail: str | None = None
    limit: int = Field(24, ge=1, le=1000)


class LibreViewReading(BaseModel):
    value: float
    date: str
    time: str


class LibreViewSyncOut(BaseModel):
    readings: list[LibreViewReading]
    count: int
    synced_at: str


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
                + ". Execute: python machine-learning/api/scripts/fit_demo_models.py"
            ),
        )


def _normalize_date(value: Any) -> str:
    if not value:
        return datetime.utcnow().strftime("%Y-%m-%d")

    text = str(value).strip()

    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except ValueError:
        pass

    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]

    return datetime.utcnow().strftime("%Y-%m-%d")


def _normalize_time(value: Any) -> str:
    if not value:
        return datetime.utcnow().strftime("%H:%M:%S")

    text = str(value).strip()

    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).strftime("%H:%M:%S")
    except ValueError:
        pass

    if len(text) == 5 and text[2] == ":":
        return f"{text}:00"

    if len(text) >= 8 and text[2] == ":":
        return text[:8]

    return datetime.utcnow().strftime("%H:%M:%S")


def _normalize_libreview_item(item: dict[str, Any]) -> LibreViewReading | None:
    timestamp = (
        item.get("timestamp")
        or item.get("dateTime")
        or item.get("date_time")
        or item.get("datetime")
        or item.get("createdAt")
        or item.get("time")
    )

    value = (
        item.get("valueMgDl")
        or item.get("value_mg_dl")
        or item.get("value_in_mg_per_dl")
        or item.get("glucose")
        or item.get("glucoseMgDl")
        or item.get("value")
    )

    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return None

    if numeric_value <= 0:
        return None

    return LibreViewReading(
        value=numeric_value,
        date=_normalize_date(item.get("date") or timestamp),
        time=_normalize_time(item.get("hour") or item.get("hora") or item.get("time") or timestamp),
    )


def _normalize_libreview_payload(payload: Any) -> list[LibreViewReading]:
    raw_readings = payload if isinstance(payload, list) else payload.get("readings", []) if isinstance(payload, dict) else []
    readings: list[LibreViewReading] = []

    for item in raw_readings:
        if not isinstance(item, dict):
          continue
        normalized = _normalize_libreview_item(item)
        if normalized:
            readings.append(normalized)

    return readings


def _call_libreview_provider(body: LibreViewSyncIn) -> list[LibreViewReading]:
    provider_url = os.environ.get("LIBREVIEW_PROVIDER_URL", "").strip()
    provider_token = os.environ.get("LIBREVIEW_PROVIDER_TOKEN", "").strip()
    provider_auth_header = os.environ.get("LIBREVIEW_PROVIDER_AUTH_HEADER", "Authorization").strip() or "Authorization"

    if not provider_url:
        raise HTTPException(
            status_code=501,
            detail="LIBREVIEW_PROVIDER_URL nao configurada no middleware.",
        )

    payload = json.dumps(
        {
            "patientId": body.patientId,
            "patientEmail": body.patientEmail,
            "limit": body.limit,
        }
    ).encode("utf-8")

    headers = {
        "Content-Type": "application/json",
    }

    if provider_token:
        headers[provider_auth_header] = provider_token

    req = urllib_request.Request(provider_url, data=payload, headers=headers, method="POST")

    try:
        with urllib_request.urlopen(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
    except urllib_error.HTTPError as exc:
        raw_error = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(
            status_code=502,
            detail=f"Falha do provedor LibreView ({exc.code}): {raw_error or exc.reason}",
        ) from exc
    except urllib_error.URLError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Nao foi possivel conectar ao provedor LibreView: {exc.reason}",
        ) from exc

    try:
        parsed = json.loads(raw) if raw else {}
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail="O provedor LibreView retornou uma resposta invalida.",
        ) from exc

    return _normalize_libreview_payload(parsed)


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


@app.post("/libreview/sync", response_model=LibreViewSyncOut)
def libreview_sync(body: LibreViewSyncIn) -> LibreViewSyncOut:
    if not body.patientId and not body.patientEmail:
        raise HTTPException(status_code=400, detail="Informe patientId ou patientEmail.")

    readings = _call_libreview_provider(body)

    return LibreViewSyncOut(
        readings=readings,
        count=len(readings),
        synced_at=datetime.utcnow().isoformat() + "Z",
    )
