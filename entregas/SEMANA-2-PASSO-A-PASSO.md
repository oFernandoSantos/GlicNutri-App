# Semana 2 — o que fazer na prática (manual do grupo)

Objetivo: fechar **Thayse** (CSV real + notebook) e **confirmar Bento** (fluxos), conforme o [Planejamento_Final_Atividades_GlicNutri_Ajustado.md](../Planejamento_Final_Atividades_GlicNutri_Ajustado.md). Índice da entrega: [README-ENTREGA-SEMANA-2.md](README-ENTREGA-SEMANA-2.md).

---

## Parte A — Só quem tem acesso ao Supabase (Thayse / dados)

### A1. Instalar Python e dependências (uma vez por máquina)

1. Instale [Python 3.11+](https://www.python.org/) (marque “Add to PATH” no Windows).
2. Abra **PowerShell** na pasta do projeto:
   ```powershell
   cd "C:\caminho\para\GlicNutri-App\GlicNutri"
   pip install psycopg2-binary pandas
   ```
   Ou, alinhado ao que está no repositório: `pip install -r machine-learning/requirements.txt`
3. (Opcional) Para abrir o notebook: packages extra em [`machine-learning/requirements.txt`](../machine-learning/requirements.txt) (jupyter, sklearn, etc., conforme o ficheiro).

### A2. Obter a connection string (não partilhar em público)

1. No [Supabase](https://supabase.com) → o projeto GlicNutri.
2. **Settings** → **Database** → **Connection string** → escolha **URI** (Session ou **Transaction** pooler, consoante a rede).
3. Copie a URI. Substitua `[YOUR-PASSWORD]` pela password real da base de dados.

### A3. Exportar o CSV (paciente-dia)

1. No PowerShell, **ainda em `GlicNutri/`**:
   ```powershell
   $env:DATABASE_URL = "postgresql://postgres.xxx:Senha@aws-0-....pooler.supabase.com:6543/postgres"
   ```
   (Cole a sua URI completa; **não** faça commit disto.)
2. Corra o export com manifest (evidência sem obrigar a subir o CSV):
   ```powershell
   python machine-learning/scripts/export_supabase_csv.py `
     --output machine-learning/data/glicnutri_patient_day_export.csv `
     --manifest machine-learning/data/export_manifest.json `
     --days 90
   ```
3. **Esperado:** mensagem `Exportadas N linhas → ...` e criação de `export_manifest.json`.
4. Se sair **0 linhas:** pode ser janela `--days` sem dados; tente `--days 365` ou altere datas com `--since` / `--until` (ver [EXPORT_CSV.md](../machine-learning/EXPORT_CSV.md)).

**Atalho (uma linha):** com `DATABASE_URL` já definida no mesmo terminal:

```powershell
python machine-learning/scripts/export_supabase_csv.py --output machine-learning/data/glicnutri_patient_day_export.csv --manifest machine-learning/data/export_manifest.json --days 90
```

**Mesmo resultado sem repetir o comando:** [`machine-learning/scripts/exportar_csv_semana2.ps1`](../machine-learning/scripts/exportar_csv_semana2.ps1) ou, com `DATABASE_URL` já definida: `npm run ml:export-csv` (ver [`package.json`](../package.json)).

### A4. Preencher evidência no repositório

1. Abra [`machine-learning/EXPORT_CSV.md`](../machine-learning/EXPORT_CSV.md) e preencha a tabela **“Registo de execução”** (data, comando sem password, linhas, SHA-256 do manifest, responsável).
2. Se a política da disciplina permitir, pode commitar **`machine-learning/data/export_manifest.json`**. O ficheiro **`glicnutri_patient_day_export.csv`** costuma ficar fora do Git (ver `machine-learning/data/.gitignore`).

### A5. Notebook — validação e EDA inicial

1. Abra Jupyter / VS Code na pasta `GlicNutri/machine-learning/notebooks/`.
2. Execute [`glicnutri_ml_pipeline.ipynb`](../machine-learning/notebooks/glicnutri_ml_pipeline.ipynb) até à secção **EDA** (o notebook escolhe automaticamente o CSV exportado se existir em `machine-learning/data/`).
3. Guarde o notebook com as células corridas (outputs visíveis) para evidência no grupo / ZIP.

---

## Parte B — Qualquer integrante (app / Bento)

### B1. Checklist de fluxos

1. Abra [`checklist-semana-2-fluxos-app.md`](checklist-semana-2-fluxos-app.md).
2. Marque **T1–T5** (Thayse) após a Parte A estar feita.
3. Marque **B1–B4** e **C1–C4** testando no **dispositivo ou web** com o Supabase de desenvolvimento do grupo.

### B2. Roteiro de auditoria (referência)

Fluxos e eventos esperados: [`bento/semana-2-auditoria/roteiro-testes.md`](bento/semana-2-auditoria/roteiro-testes.md).

### B3. Reunião Semana 2

Seguir [`demo-reuniao-semana-2.md`](demo-reuniao-semana-2.md) (demo curta + pendências para Semana 3).

---

## O que já está feito no código (sem as suas credenciais)

- Script de export, notebook paciente-dia, API FastAPI, checklist e documentação de export estão no repositório.
- A parte **Bento / auditoria** com capturas no Git já foi tratada como **completa** no planejamento; o grupo só confirma com testes se necessário.

---

## Resumo de responsabilidades

| Quem | O quê |
|------|--------|
| Integrante com **DATABASE_URL** | A1–A5 (export + manifest + notebook + registo) |
| Restantes | B1–B3 (testes, checklist, reunião) |
