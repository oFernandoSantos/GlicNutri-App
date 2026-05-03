"""
Treina modelos de demonstração a partir do CSV de exemplo e grava artefatos em backend/artifacts/.
Execute após clonar o repositório ou substitua pelo pipeline do notebook.

  python backend/scripts/fit_demo_models.py
"""

from __future__ import annotations

import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import Ridge
from sklearn.neighbors import NearestNeighbors
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CSV_DEFAULT = os.path.join(ROOT, "ml", "data", "sample_glicnutri_patient_day.csv")
ARTIFACTS = os.path.join(ROOT, "backend", "artifacts")

FEATURE_COLS = [
    "n_leituras_glicemia",
    "carbs_sum_g",
    "kcal_sum",
    "protein_sum_g",
    "fat_sum_g",
    "n_refeicoes_ia",
    "n_eventos_medicacao",
]


def main() -> None:
    csv_path = sys.argv[1] if len(sys.argv) > 1 else CSV_DEFAULT
    df = pd.read_csv(csv_path)
    df["dia"] = pd.to_datetime(df["dia"])

    df["target_glucose_high"] = (df["glucose_mean_mg_dl"] >= 150).astype(int)
    y_cls = df["target_glucose_high"]
    y_reg = df["glucose_mean_mg_dl"]

    X = df[FEATURE_COLS].fillna(0)

    os.makedirs(ARTIFACTS, exist_ok=True)

    clf_pipe = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("model", RandomForestClassifier(n_estimators=50, random_state=42)),
        ]
    )
    clf_pipe.fit(X, y_cls)
    joblib.dump(clf_pipe, os.path.join(ARTIFACTS, "model_classification.joblib"))

    reg_pipe = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("model", Ridge(alpha=1.0)),
        ]
    )
    reg_pipe.fit(X, y_reg)
    joblib.dump(reg_pipe, os.path.join(ARTIFACTS, "model_regression.joblib"))

    km = KMeans(n_clusters=min(3, len(df)), random_state=42, n_init=10)
    km.fit(X)
    joblib.dump(km, os.path.join(ARTIFACTS, "model_clustering.joblib"))

    nn = NearestNeighbors(n_neighbors=min(3, len(df)))
    nn.fit(X)
    joblib.dump(nn, os.path.join(ARTIFACTS, "model_similarity.joblib"))
    joblib.dump(X.values, os.path.join(ARTIFACTS, "similarity_train_matrix.joblib"))

    meta = {
        "feature_columns": FEATURE_COLS,
        "target_classification": "target_glucose_high (1 se glucose_mean_mg_dl >= 150)",
        "target_regression": "glucose_mean_mg_dl",
        "csv_source": os.path.normpath(csv_path),
    }
    with open(os.path.join(ARTIFACTS, "training_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    print(f"Artefatos gravados em {ARTIFACTS}")


if __name__ == "__main__":
    main()
