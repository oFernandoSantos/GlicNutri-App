#!/usr/bin/env python3
"""
Exporta dados agregados do Postgres do Supabase para CSV reprodutível (paciente-dia).

Requisitos de ambiente:
  DATABASE_URL — URI PostgreSQL (Supabase: Settings → Database → Connection string → URI).
    Ex.: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres

Uso:
  python export_supabase_csv.py --output ../data/glicnutri_patient_day_export.csv
  python export_supabase_csv.py --days 90 --output ./out.csv

O SQL espelha o vocabulário em ml/dataset-referencia-glicnutri.md (paciente ativo,
registro_glicemia_manual, refeicao_ia, registro_medicacao).
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Instale dependências: pip install psycopg2-binary pandas", file=sys.stderr)
    sys.exit(1)

import pandas as pd


EXPORT_SQL = """
WITH bounds AS (
  SELECT %(since_ts)s::timestamptz AS since_ts, %(until_ts)s::timestamptz AS until_ts
),
patient_day_glucose AS (
  SELECT
    rgm.id_paciente_uuid AS patient_id,
    rgm.data AS dia,
    AVG(rgm.valor_glicose_mgdl)::double precision AS glucose_mean_mg_dl,
    MIN(rgm.valor_glicose_mgdl)::double precision AS glucose_min_mg_dl,
    MAX(rgm.valor_glicose_mgdl)::double precision AS glucose_max_mg_dl,
    COUNT(*)::int AS n_leituras_glicemia
  FROM public.registro_glicemia_manual rgm
  CROSS JOIN bounds b
  WHERE rgm.data >= (b.since_ts AT TIME ZONE 'UTC')::date
    AND rgm.data < (b.until_ts AT TIME ZONE 'UTC')::date
  GROUP BY rgm.id_paciente_uuid, rgm.data
),
patient_day_meals AS (
  SELECT
    ri.paciente_id AS patient_id,
    (ri.created_at AT TIME ZONE 'UTC')::date AS dia,
    COALESCE(SUM(ri.carboidratos_total), 0)::double precision AS carbs_sum_g,
    COALESCE(SUM(ri.calorias_total), 0)::double precision AS kcal_sum,
    COALESCE(SUM(ri.proteinas_total), 0)::double precision AS protein_sum_g,
    COALESCE(SUM(ri.gorduras_total), 0)::double precision AS fat_sum_g,
    COUNT(*)::int AS n_refeicoes_ia
  FROM public.refeicao_ia ri
  CROSS JOIN bounds b
  WHERE ri.created_at >= b.since_ts AND ri.created_at < b.until_ts
  GROUP BY ri.paciente_id, (ri.created_at AT TIME ZONE 'UTC')::date
),
patient_day_meds AS (
  SELECT
    rm.id_paciente_uuid AS patient_id,
    rm.data AS dia,
    COUNT(*)::int AS n_eventos_medicacao
  FROM public.registro_medicacao rm
  CROSS JOIN bounds b
  WHERE rm.data >= (b.since_ts AT TIME ZONE 'UTC')::date
    AND rm.data < (b.until_ts AT TIME ZONE 'UTC')::date
  GROUP BY rm.id_paciente_uuid, rm.data
),
keys AS (
  SELECT patient_id, dia FROM patient_day_glucose
  UNION
  SELECT patient_id, dia FROM patient_day_meals
  UNION
  SELECT patient_id, dia FROM patient_day_meds
),
joined AS (
  SELECT
    k.patient_id::text AS patient_id,
    k.dia AS dia,
    COALESCE(g.glucose_mean_mg_dl, NULL::double precision) AS glucose_mean_mg_dl,
    COALESCE(g.glucose_min_mg_dl, NULL::double precision) AS glucose_min_mg_dl,
    COALESCE(g.glucose_max_mg_dl, NULL::double precision) AS glucose_max_mg_dl,
    COALESCE(g.n_leituras_glicemia, 0) AS n_leituras_glicemia,
    COALESCE(m.carbs_sum_g, 0) AS carbs_sum_g,
    COALESCE(m.kcal_sum, 0) AS kcal_sum,
    COALESCE(m.protein_sum_g, 0) AS protein_sum_g,
    COALESCE(m.fat_sum_g, 0) AS fat_sum_g,
    COALESCE(m.n_refeicoes_ia, 0) AS n_refeicoes_ia,
    COALESCE(md.n_eventos_medicacao, 0) AS n_eventos_medicacao
  FROM keys k
  LEFT JOIN patient_day_glucose g
    ON g.patient_id = k.patient_id AND g.dia = k.dia
  LEFT JOIN patient_day_meals m
    ON m.patient_id = k.patient_id AND m.dia = k.dia
  LEFT JOIN patient_day_meds md
    ON md.patient_id = k.patient_id AND md.dia = k.dia
)
SELECT j.*
FROM joined j
INNER JOIN public.paciente p ON p.id_paciente_uuid = j.patient_id::uuid
WHERE COALESCE(p.excluido, FALSE) = FALSE
ORDER BY j.patient_id, j.dia;
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Export Supabase Postgres → CSV (paciente-dia).")
    parser.add_argument(
        "--output",
        "-o",
        required=True,
        help="Caminho do arquivo CSV de saída.",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=365,
        help="Janela rolling em dias até agora (ignorado se --since/--until forem usados).",
    )
    parser.add_argument("--since", default=None, help="ISO8601 início (opcional).")
    parser.add_argument("--until", default=None, help="ISO8601 fim (opcional).")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print(
            "Defina DATABASE_URL (ou SUPABASE_DB_URL) com a URI Postgres do projeto.",
            file=sys.stderr,
        )
        sys.exit(1)

    since_ts = args.since
    until_ts = args.until
    days_delta = timedelta(days=max(args.days, 1))
    if not since_ts:
        since_ts = datetime.now(timezone.utc) - days_delta
    else:
        since_ts = datetime.fromisoformat(args.since.replace("Z", "+00:00"))

    if not until_ts:
        until_ts = datetime.now(timezone.utc)
    else:
        until_ts = datetime.fromisoformat(args.until.replace("Z", "+00:00"))

    conn = psycopg2.connect(db_url)
    try:
        df = pd.read_sql_query(
            EXPORT_SQL,
            conn,
            params={
                "since_ts": since_ts,
                "until_ts": until_ts,
            },
        )
    finally:
        conn.close()

    os.makedirs(os.path.dirname(os.path.abspath(args.output)) or ".", exist_ok=True)
    df.to_csv(args.output, index=False)
    print(f"Exportadas {len(df)} linhas → {args.output}")


if __name__ == "__main__":
    main()
