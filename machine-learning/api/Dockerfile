# Build a partir da raiz do repositório GlicNutri:
#   docker build -f machine-learning/api/Dockerfile -t glicnutri-ml-api .
#
# Gera artefatos com sample_glicnutri_patient_day.csv (substitua por volume ou build-arg em produção).

FROM python:3.12-slim

WORKDIR /repo
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY machine-learning/api/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY machine-learning/data/sample_glicnutri_patient_day.csv /repo/machine-learning/data/sample_glicnutri_patient_day.csv
COPY machine-learning/api /repo/machine-learning/api

RUN python /repo/machine-learning/api/scripts/fit_demo_models.py \
  /repo/machine-learning/data/sample_glicnutri_patient_day.csv

WORKDIR /repo/machine-learning/api
EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
