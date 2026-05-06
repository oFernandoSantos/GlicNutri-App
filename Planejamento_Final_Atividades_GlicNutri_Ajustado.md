# PLANEJAMENTO FINAL DE ATIVIDADES - PROJETO GLICNUTRI

## 1. Identificação do projeto

- **Nome do projeto:** GlicNutri
- **Entrega final:** 31 de maio de 2026
- **Objetivo geral do planejamento:** organizar, de forma clara e acadêmica, as atividades necessárias para concluir o Projeto GlicNutri dentro do prazo, considerando as exigências das disciplinas do professor Bento e da professora Thayse. O planejamento contempla a consolidação do aplicativo e do banco de dados, com auditoria, logs e cuidados com LGPD, além da adequação da entrega de Machine Learning para utilizar dados reais do GlicNutri no Supabase, incluindo pipeline de ML, persistência de modelos e disponibilização por API.

---

## 2. Documentos e arquivos analisados

Foram considerados, para este planejamento, os seguintes documentos, notebooks e componentes do projeto:

- `Requisitos_Bento_GlicNutri.pdf`
- `Requisitos_Thayse_GlicNutri.pdf`
- `Diabetes_pipeline_ml.ipynb` (referência histórica no PDF)
- `machine-learning/notebooks/referencia/glucobench-reference.ipynb` (GlucoBench)
- `Cronograma ADS5 - Projeto de Sistemas V3.pdf`
- Pastas e arquivos de aulas: `AULA1` até `AULA7`, utilizados como materiais de apoio para compreender os requisitos da disciplina da professora Thayse.
- Código do aplicativo GlicNutri, desenvolvido em Expo/React Native e integrado ao Supabase.
- Banco Supabase e migrations, contendo estrutura de dados, funções e componentes relacionados à persistência.
- Checklist Bento (13 requisitos): `entregas/bento/checklist-13-requisitos-bento.md`
- Pacote Bento (BD/CRUD/UX): `entregas/bento/BANCO-DE-DADOS-ER-EVIDENCIAS.md`, `entregas/bento/CRUD-VALIDACOES-ROTEIRO-EVIDENCIAS.md`, `entregas/bento/USABILIDADE-RELATORIOS-PRINTS-TEXTO.md`
- Resumo/Checklist Thayse (ML): `entregas/thayse/RESUMO-ENTREGA-ML.md`
- Checklist pacote final: `entregas/PACOTE-FINAL-CHECKLIST.md`

---

## 3. Diagnóstico geral do projeto

### 3.1 O que já existe no projeto

De forma geral, o projeto já possui uma base funcional consistente, incluindo:

- Aplicativo desenvolvido em Expo/React Native, com telas para perfis de usuário, como paciente, nutricionista e administrador.
- Integração com Supabase, utilizada para autenticação e persistência de dados.
- Fluxos de uso relevantes já implementados, como monitoramento e registro de glicemia, registro de medicação/insulina, registro de refeição com apoio de IA e painel administrativo com indicadores, auditoria e logs.
- Banco de dados versionado por migrations, o que facilita documentação, rastreabilidade e reprodução.
- Notebook de Machine Learning no repositório (`machine-learning/notebooks/glicnutri_ml_pipeline.ipynb`) com pipeline paciente-dia; usar CSV exportado do Supabase (`machine-learning/scripts/export_supabase_csv.py`) para dados reais ou o CSV de exemplo (`machine-learning/data/sample_glicnutri_patient_day.csv`) para desenvolvimento local.

### 3.2 O que está incompleto

Apesar da base do sistema existir, há pontos que precisam ser finalizados e padronizados para o contexto acadêmico:

- A entrega de Machine Learning precisa estar **organizada como evidência acadêmica** (prints, métricas e explicação), mas **já foi executada com dados reais exportados do Supabase** (CSV + manifest + treino + artefatos).
- Backend Python com FastAPI e endpoint `POST /predict` existe no repositório (`machine-learning/api/app/main.py`) e **já foi integrado ao app para teste local** (tela paciente “Previsão (IA)”). Hospedagem em nuvem permanece opcional para a apresentação final.
- As evidências e a documentação acadêmica precisam ser consolidadas em um pacote final, com rastreabilidade entre requisitos e implementação.
- Relatórios e gráficos de gestão existem parcialmente, mas devem ser organizados como entregável, com explicação e evidências.

### 3.3 O que ainda falta implementar

- (Concluído) Executar o export `machine-learning/scripts/export_supabase_csv.py` com credenciais reais e volume suficiente para treino (evidência: `machine-learning/data/export_manifest.json` + `glicnutri_patient_day_export.csv`).
- (Concluído) Apontar o notebook `machine-learning/notebooks/glicnutri_ml_pipeline.ipynb` para o CSV real e refinar pré-processamento (linhas com `glucose_mean_mg_dl` nulo são removidas do treino supervisionado).
- (Concluído) Treinar e avaliar os quatro modelos com dados reais (classificação, regressão, clusterização e similaridade) e persistir artefatos.
- (Concluído) Servir o modelo em ambiente de demonstração local (uvicorn) e registrar evidências de chamadas à API (inclui correção de CORS para app web).
- Consolidar documentação final, evidências, prints, roteiros de demonstração e checklist de entrega.

### 3.4 Status real no repositório (sincronização técnica — maio/2026)

Esta subsecção amarra **requisito → evidência no código** conforme o estado atual do repositório (não substitui documentos PDF/Word externos nem vínculos acadêmicos que dependem de prints).

| Área | Situação no repo | Onde evidenciar |
|------|------------------|-----------------|
| App Expo + Supabase | Implementado: auth (paciente/nutri/admin/Google), cadastros, monitoramento, refeição IA, painel admin | `GlicNutri/src/`, `GlicNutri/supabase/migrations/` |
| Export CSV reprodutível | Script Postgres paciente-dia + procedimento documentado + atalhos | `machine-learning/scripts/export_supabase_csv.py` (`DATABASE_URL`); `machine-learning/EXPORT_CSV.md`; `npm run ml:export-csv`; `machine-learning/scripts/exportar_csv_semana2.ps1`; manual [`entregas/SEMANA-2-PASSO-A-PASSO.md`](entregas/SEMANA-2-PASSO-A-PASSO.md) |
| Dataset / exemplo | CSV sintético para notebook sem DB | `machine-learning/data/sample_glicnutri_patient_day.csv` |
| Notebook ML (GlicNutri paciente-dia) | Pipeline (EDA + 4 tarefas + joblib) | `machine-learning/notebooks/glicnutri_ml_pipeline.ipynb` |
| Notebook ML (GlucoBench referência) | Carga/validação GlucoBench | `machine-learning/notebooks/referencia/glucobench-reference.ipynb` |
| Artefatos joblib | Gerados pelo notebook ou `machine-learning/api/scripts/fit_demo_models.py` | `machine-learning/api/artifacts/*.joblib`, `training_meta.json` |
| API `POST /predict` | FastAPI + contrato JSON | `machine-learning/api/app/main.py`, dependências em `machine-learning/api/requirements.txt` |
| Auditoria e logs (implementação no app) | **Completo** no código: gravação Storage, painel admin, recuperação de senha sem dados sensíveis nos detalhes | `servicoAuditoria.js`, `TelaHomeAdmin.js`, `TelaAuditoriaAdmin.js`, `TelaLogsSistemaAdmin.js`, `TelaRecuperarSenha.js` |
| Logs persistidos via Supabase Storage (bucket `audit-logs`) | **Completo** no código (fluxo implementado) | Idem + migrations/policies conforme projeto |
| Semana 2 — Bento / auditoria (evidências visuais em `prints/`) | **COMPLETO** (evidência validada no repositório) | [`evidencias-auditoria.md`](entregas/bento/semana-2-auditoria/evidencias-auditoria.md); capturas em [`prints/`](entregas/bento/semana-2-auditoria/prints/) |
| Bento — checklist 13 requisitos | **Em andamento** | `entregas/bento/checklist-13-requisitos-bento.md` |
| Bento — apoio para fechar “parciais” (BD/CRUD/UX/relatórios) | **Completo (roteiros + texto)** | `entregas/bento/BANCO-DE-DADOS-ER-EVIDENCIAS.md`, `entregas/bento/CRUD-VALIDACOES-ROTEIRO-EVIDENCIAS.md`, `entregas/bento/USABILIDADE-RELATORIOS-PRINTS-TEXTO.md` |
| Export CSV Supabase (dados reais) | **COMPLETO (execução local)** | CSV + manifest gerados: `machine-learning/data/glicnutri_patient_day_export.csv`, `machine-learning/data/export_manifest.json` (hash + contagem + colunas) |
| ML referência GlucoBench | **Parcial / em andamento** | `machine-learning/notebooks/referencia/glucobench-reference.ipynb`; sem treino/pipeline final obrigatório nesta linha |
| Thayse — resumo/roteiro ML | **Completo** | `entregas/thayse/RESUMO-ENTREGA-ML.md` |
| Entregas acadêmicas (ZIP, slides, vídeo, Word único) | Fora do escopo do Git / pendente de grupo | Processo manual |

**Nota sobre CRUD / exclusão:** exclusão física de glicemia/medicação não é exposta por design; histórico usa ocultação no app + auditoria de eventos; exclusão de paciente pelo nutricionista é lógica (`excluido`).

**Semana 2 (entrega prevista 10/05) — situação real:** **PARCIAL no conjunto do planejamento** (parte **Thayse**). A parte **Bento / auditoria** da Semana 2 está **COMPLETA**: código, checklist/STATUS e **evidência visual validada com capturas reais no repositório** ([`evidencias-auditoria.md`](entregas/bento/semana-2-auditoria/evidencias-auditoria.md), [`prints/`](entregas/bento/semana-2-auditoria/prints/)). A parte **Thayse** permanece **parcial** até o grupo executar o export com `DATABASE_URL` real, preencher o registo em [`machine-learning/EXPORT_CSV.md`](machine-learning/EXPORT_CSV.md) e correr o notebook com o CSV exportado (ver [`machine-learning/notebooks/glicnutri_ml_pipeline.ipynb`](machine-learning/notebooks/glicnutri_ml_pipeline.ipynb)). O repositório inclui **índice e manual** da entrega: [`entregas/README-ENTREGA-SEMANA-2.md`](entregas/README-ENTREGA-SEMANA-2.md), [`entregas/SEMANA-2-PASSO-A-PASSO.md`](entregas/SEMANA-2-PASSO-A-PASSO.md), atalhos `npm run ml:export-csv` e [`machine-learning/scripts/exportar_csv_semana2.ps1`](machine-learning/scripts/exportar_csv_semana2.ps1).

### 3.4.1 Entregáveis no Git — Semana 2 (sincronização 04/05/2026)

| Entregável | Estado no repositório | Onde |
|------------|------------------------|------|
| Índice da entrega Semana 2 | Completo | [`entregas/README-ENTREGA-SEMANA-2.md`](entregas/README-ENTREGA-SEMANA-2.md) |
| Manual do grupo (export, notebook, checklist) | Completo | [`entregas/SEMANA-2-PASSO-A-PASSO.md`](entregas/SEMANA-2-PASSO-A-PASSO.md) |
| Procedimento export + registo (template) | Completo (execução real pendente) | [`machine-learning/EXPORT_CSV.md`](machine-learning/EXPORT_CSV.md) |
| Script export Python + atalhos npm/PowerShell | Completo | [`machine-learning/scripts/export_supabase_csv.py`](machine-learning/scripts/export_supabase_csv.py), [`package.json`](package.json) (`ml:export-csv`), [`machine-learning/scripts/exportar_csv_semana2.ps1`](machine-learning/scripts/exportar_csv_semana2.ps1) |
| Checklist Semana 2 | Completo (secções R1–R3 preparação repo; T1–T5 e B/C testes manuais) | [`entregas/checklist-semana-2-fluxos-app.md`](entregas/checklist-semana-2-fluxos-app.md) |
| Demo reunião 10/05 | Roteiro no repo | [`entregas/demo-reuniao-semana-2.md`](entregas/demo-reuniao-semana-2.md) |
| Bento — evidência visual Semana 2 | Completo | [`entregas/bento/semana-2-auditoria/`](entregas/bento/semana-2-auditoria/) |
| Thayse — manifest / registo / notebook com dados reais | **Completo (execução local)** | `machine-learning/data/export_manifest.json`; notebook executado: `machine-learning/notebooks/glicnutri_ml_pipeline.executed.ipynb` |

### 3.5 Requisito → evidência → artefacto (resumo)

| Foco | Estado | Onde comprovar |
|------|--------|----------------|
| Bento — autenticação, fluxos, CRUD | Parcial (requisito global); Semana 2: evidência visual **COMPLETA** | Código: `src/telas/autenticacao/`, `App.js`, `servicoDadosPaciente.js`; pasta [`entregas/bento/semana-2-auditoria/`](entregas/bento/semana-2-auditoria/) — **Evidência visual validada com capturas reais no repositório** |
| Bento — auditoria (código) | Completo | `servicoAuditoria.js`, telas admin e fluxos em `checklist-auditoria.md` |
| Bento — auditoria (evidência visual Git, Semana 2) | **Completo** | [`evidencias-auditoria.md`](entregas/bento/semana-2-auditoria/evidencias-auditoria.md) + [`prints/`](entregas/bento/semana-2-auditoria/prints/) |
| Thayse — CSV reprodutível | Parcial | `machine-learning/scripts/export_supabase_csv.py`, `machine-learning/EXPORT_CSV.md` |
| Thayse — ML GlicNutri (paciente-dia) | **Completo (execução local)** | `machine-learning/notebooks/glicnutri_ml_pipeline.ipynb` + execução `machine-learning/notebooks/glicnutri_ml_pipeline.executed.ipynb` + artefatos em `machine-learning/api/artifacts/` |
| Thayse — ML referência GlucoBench | Parcial / em andamento | `machine-learning/notebooks/referencia/glucobench-reference.ipynb` |
| Thayse — API | **Completo (local)** | `machine-learning/api/app/main.py` (`/health`, `/predict`, CORS habilitado para web) |

---

## 4. Requisitos relacionados ao Bento

Os requisitos do professor Bento foram organizados com base no documento `Requisitos_Bento_GlicNutri.pdf`, referente ao Projeto GlicNutri. Esses requisitos envolvem documentação inicial, banco de dados, autenticação, CRUD, validações, fluxo do sistema, usabilidade, auditoria, relatórios, organização do código, atualização da documentação e entrega final.

### 4.1 Tabela de requisitos do Bento

| Nº | Requisito do Bento | O que o requisito pede | Status atual | Evidência encontrada no projeto | O que ainda precisa ser feito | Semana prevista |
|---|---|---|---|---|---|---|
| 1 | Documentação Inicial | Documento Word padronizado, definição de tecnologias e levantamento de requisitos | Parcial (repo) | `Planejamento_Final_Atividades_GlicNutri_Ajustado.md`, pasta `entregas/` | Consolidar documento Word final com tecnologias, requisitos e descrição do sistema | Semana 1 e Semana 5 |
| 2 | Banco de Dados | Estrutura de tabelas, campos adequados, chaves primárias, estrangeiras e relacionamentos | Parcial | `GlicNutri/supabase/migrations/` | Documentar ER/tabelas no documento final acadêmico | Semana 1 |
| 3 | Autenticação | Login de usuários, validação de credenciais e recuperação de senha | Parcial | Código: `TelaLogin.js`, `TelaRecuperarSenha.js`, `App.js`, RPCs; Semana 2: **Evidência visual validada com capturas reais no repositório** ([`evidencias-auditoria.md`](entregas/bento/semana-2-auditoria/evidencias-auditoria.md), `login_*.png` em [`prints/`](entregas/bento/semana-2-auditoria/prints/)) | Recuperação de senha: evidência específica se o professor exigir | Semana 2 |
| 4 | CRUD Completo | Cadastro, consulta, edição e exclusão lógica | Parcial | Cadastro/gestão: `TelaCadastro.js`, `TelaPacientesNutricionista.js`, `servicoDadosPaciente.js` | Documentar decisão: exclusão clínica por ocultação + auditoria (sem DELETE físico glicemia/medicação) | Semana 2 |
| 5 | Validações de Dados | Validação de campos obrigatórios, CPF, CEP, email e outros dados necessários | Parcial | Formulários em `TelaCadastro.js`, `TelaPacientesNutricionista.js`, login | Auditoria de cobertura por tela + evidências | Semana 2 |
| 6 | Fluxo do Sistema | Navegação entre telas, fluxo funcional completo e persistência no banco | Parcial | `App.js`, fluxos paciente/nutri/admin; Semana 2: **Evidência visual validada com capturas reais no repositório** (login + glicemia em [`evidencias-auditoria.md`](entregas/bento/semana-2-auditoria/evidencias-auditoria.md) / [`prints/`](entregas/bento/semana-2-auditoria/prints/)) | Roteiro/demo gravado global (entrega ampliada) | Semana 2 e Semana 4 |
| 7 | Usabilidade | Interface funcional, facilidade de uso e navegação intuitiva | Parcial | UI RN em `src/telas/` | Revisão heurística + prints | Semana 4 |
| 8 | Auditoria | Registro de ações de cadastro, movimentações e logs de operações | Parcial | Código completo; Semana 2: **Evidência visual validada com capturas reais no repositório** ([`evidencias-auditoria.md`](entregas/bento/semana-2-auditoria/evidencias-auditoria.md), [`prints/`](entregas/bento/semana-2-auditoria/prints/), checklist/STATUS) | Texto LGPD no documento Word final (entrega académica global) | Semana 4 |
| 9 | Relatórios e Gráficos | Relatórios de dados, visualizações gráficas e informações gerenciais | Parcial | Painel admin, curvas/monitoramento paciente | Consolidar entregável + prints disciplina | Semana 4 |
| 10 | Organização do Código | Estrutura organizada, código limpo e separação de responsabilidades | Parcial | `src/` serviços, telas, componentes | Descrever estrutura no documento final | Semana 5 |
| 11 | Atualização da Documentação | Documento atualizado, corrigido conforme feedback e coerente com o sistema | Em andamento | Este planejamento (secção 3.4), entregas md | Sincronizar Word final com sistema real | Semana 5 |
| 12 | Entrega Final | Sistema funcional, código em ZIP, slides e vídeo demonstrativo | Não feito (pacote) | Código no repositório | ZIP, slides, vídeo | Semana 5 |
| 13 | Critérios de Avaliação | Funcionamento do sistema, implementação dos requisitos, organização e qualidade da apresentação | Em acompanhamento | Checklist secção 11 | Ensaio final | Semana 5 |

---

## 5. Requisitos relacionados à Thayse (Machine Learning + API + dados reais)

O documento `Requisitos_Thayse_GlicNutri.pdf` descreve um sistema com pipeline de Machine Learning, incluindo pré-processamento, análise exploratória, modelagem e métricas, além de persistência e disponibilização do modelo por meio de uma API REST, utilizando FastAPI ou Flask.

### 5.1 Destaques obrigatórios

Para adequação completa aos requisitos, o projeto deverá:

- Refazer ou adaptar o notebook citado nos requisitos (`Diabetes_pipeline_ml.ipynb` no PDF da disciplina); **no repositório**, o pipeline principal implementado é `machine-learning/notebooks/glicnutri_ml_pipeline.ipynb`.
- Remover o uso de KaggleHub/Pima Indians Diabetes, pois se trata de dataset externo.
- Usar dados reais do GlicNutri originados do Supabase, via exportação/ETL para CSV ou leitura controlada.
- Implementar um pipeline de ML completo, com validação, EDA, treino e avaliação.
- Implementar persistência dos modelos, incluindo modelo, padronização/normalização e lista de variáveis.
- Implementar uma API FastAPI com endpoint `POST /predict`.

### 5.2 Tabela de requisitos da Thayse

| Requisito | Status | O que precisa ser feito | Evidência ou arquivo relacionado |
|---|---|---|---|
| Arquitetura em camadas: ML Python + API REST + integração | **Completo (local)** | (Opcional) hospedar API para demo externa | API: `machine-learning/api/app/main.py`; App: tela `src/telas/paciente/TelaPrevisaoMl.js` + serviço `src/servicos/servicoMlLocal.js` |
| Coleta/carregamento de dados em CSV + validação do dataset | **Completo (local)** | (Opcional) aumentar volume para métricas mais robustas | `machine-learning/data/glicnutri_patient_day_export.csv`, `machine-learning/data/export_manifest.json` |
| Pré-processamento: imputação, conversões e padronização | **Completo (baseline)** | (Opcional) ajustar por paciente e séries temporais | Notebook `machine-learning/notebooks/glicnutri_ml_pipeline.ipynb` |
| EDA: histogramas, boxplots, correlação e importância de variáveis | **Completo (baseline)** | (Opcional) expandir plots e narrativa no documento final | Notebook executado: `machine-learning/notebooks/glicnutri_ml_pipeline.executed.ipynb` |
| Treinamento e avaliação com métricas adequadas | **Completo (baseline)** | (Opcional) calibrar thresholds e métricas por classe | Notebook + `machine-learning/api/artifacts/training_meta.json` |
| Cobertura de 4 problemas: classificação, regressão, clusterização e similaridade/recomendação | **Completo** | (Opcional) ajustar targets clínicos | `machine-learning/notebooks/glicnutri_ml_pipeline.ipynb` |
| Persistência: modelo, padronização e lista de variáveis | **Completo** | (Opcional) versionar artefatos por data/seed | `machine-learning/api/artifacts/*.joblib`, `training_meta.json` |
| API REST com endpoint `POST /predict` | **Completo (local + web)** | (Opcional) hospedar no Render | `machine-learning/api/app/main.py` com CORS habilitado; `uvicorn app.main:app` |

### 5.3 Definição oficial do dataset real (para o grupo não divergir)

Esta secção fixa **um único “contrato” de dataset** para o projeto, alinhado ao export existente (`machine-learning/scripts/export_supabase_csv.py`) e ao pipeline (`machine-learning/notebooks/glicnutri_ml_pipeline.ipynb`).

#### 5.3.1 Unidade (granularidade)

- **Uma linha = 1 paciente em 1 dia** (chave: `patient_id` + `dia`).
- Fonte: export Supabase → CSV “paciente-dia”.

#### 5.3.2 Janela temporal (regra padrão)

- Export “rolling window” padrão: **últimos 60 dias** (`--days 60`).
- Para treinos mais robustos, pode-se aumentar para **90–365 dias** mantendo a mesma estrutura.
- Evidência reprodutível obrigatória: `machine-learning/data/export_manifest.json` (hash + contagem + colunas + janela).

#### 5.3.3 Colunas oficiais do CSV (schema)

O dataset oficial deve conter (nomenclatura exata do CSV):

- Identificação e tempo:
  - `patient_id` (uuid em texto)
  - `dia` (YYYY-MM-DD)
- Glicemia agregada no dia:
  - `glucose_mean_mg_dl`, `glucose_min_mg_dl`, `glucose_max_mg_dl`
  - `n_leituras_glicemia`
- Refeições agregadas no dia:
  - `carbs_sum_g`, `kcal_sum`, `protein_sum_g`, `fat_sum_g`
  - `n_refeicoes_ia`
- Medicação agregada no dia:
  - `n_eventos_medicacao`

#### 5.3.4 Features oficiais (entrada do modelo / API)

As **features** usadas no treino e no endpoint `/predict` são:

- `n_leituras_glicemia`
- `carbs_sum_g`
- `kcal_sum`
- `protein_sum_g`
- `fat_sum_g`
- `n_refeicoes_ia`
- `n_eventos_medicacao`

> Observação: os campos de glicemia (`glucose_*`) são usados como **alvo** e para EDA; não entram como feature no `/predict` (para evitar vazamento do alvo).

#### 5.3.5 Alvos oficiais (o que o modelo aprende a prever)

O projeto cobre 4 tarefas (requisito da disciplina), com estes alvos/definições:

- **Classificação (alvo)**: `target_glucose_high = 1` se `glucose_mean_mg_dl >= 150`, senão `0`.
- **Regressão (alvo)**: prever `glucose_mean_mg_dl`.
- **Clusterização (não supervisionado)**: KMeans no espaço de features.
- **Similaridade (não supervisionado)**: NearestNeighbors no espaço de features.

#### 5.3.6 Regras de qualidade e limpeza (obrigatórias)

- **Chave única**: não pode haver duplicado de (`patient_id`, `dia`). Se houver, o export deve ser corrigido ou agregações revisadas.
- **Nulos nas features**: preencher com **0** (`fillna(0)`) para:
  - `n_leituras_glicemia`, `carbs_sum_g`, `kcal_sum`, `protein_sum_g`, `fat_sum_g`, `n_refeicoes_ia`, `n_eventos_medicacao`.
- **Nulos no alvo**:
  - Linhas com `glucose_mean_mg_dl` nulo **não entram** nas tarefas supervisionadas (classificação e regressão).
  - Essas linhas podem permanecer no CSV para auditoria/EDA, mas são removidas no treino supervisionado.
- **Filtro de pacientes**: somente pacientes com `paciente.excluido = false` (já aplicado no SQL do export).

#### 5.3.7 Evidências mínimas que o grupo deve guardar (para entrega)

- `machine-learning/data/export_manifest.json` (prova reprodutível do export)
- `machine-learning/data/glicnutri_patient_day_export.csv` (anexo no ZIP se exigido)
- `machine-learning/notebooks/glicnutri_ml_pipeline.executed.ipynb` (ou prints das saídas principais)
- `machine-learning/api/artifacts/` (artefatos joblib + `training_meta.json`)
- Evidência de chamada `/predict` (print do app na tela “Previsão (IA)” ou teste em PowerShell/Python)

#### Resumo do modelo aplicado no GlicNutri (explicação simples e completa)

O GlicNutri usa um dataset **paciente‑dia** (uma linha por paciente por dia) para transformar registros do dia (glicemia, refeições e medicação) em previsões e padrões úteis. O pipeline de Machine Learning foi implementado no notebook `machine-learning/notebooks/glicnutri_ml_pipeline.ipynb` e os modelos treinados são persistidos em `machine-learning/api/artifacts/` para serem usados pela API (`POST /predict`).

O que entra no modelo (features):
- Quantidade de leituras de glicemia no dia (`n_leituras_glicemia`)
- Totais nutricionais do dia (`carbs_sum_g`, `kcal_sum`, `protein_sum_g`, `fat_sum_g`)
- Quantidade de refeições registradas (`n_refeicoes_ia`)
- Quantidade de eventos de medicação (`n_eventos_medicacao`)

O que o modelo resolve (4 problemas exigidos pela disciplina):

1) **Classificação (supervisionado)**  
   - **Pergunta**: “Com base nos hábitos/resumos do dia, este dia tende a ter glicemia média elevada?”  
   - **Alvo**: `target_glucose_high = 1` quando `glucose_mean_mg_dl >= 150` (senão 0).  
   - **Saída na API**: `prob_glucose_elevada` (probabilidade) e `classe_glucose_elevada` (0/1).  

2) **Regressão (supervisionado)**  
   - **Pergunta**: “Qual a glicemia média estimada (mg/dL) para um dia com essas características?”  
   - **Alvo**: `glucose_mean_mg_dl`.  
   - **Saída na API**: `glucose_mean_previsto_mg_dl`.  

3) **Clusterização (não supervisionado)**  
   - **Pergunta**: “Quais perfis de dias existem no comportamento alimentar/medicação/leituras?”  
   - **Técnica**: KMeans sobre o mesmo conjunto de features (sem usar o alvo).  
   - **Saída na API**: `cluster_id` (identificador do grupo).  

4) **Similaridade (não supervisionado)**  
   - **Pergunta**: “Quais dias do histórico são mais parecidos com o dia atual?”  
   - **Técnica**: NearestNeighbors no espaço de features.  
   - **Saída na API**: `vizinhos_mais_proximos_indices` (índices dos dias mais próximos na base).  

Regras importantes do pipeline (para evitar erro e manter coerência):
- Linhas com `glucose_mean_mg_dl` **nulo** não entram no treino supervisionado (classificação/regressão), pois o alvo é desconhecido.
- Nulos nas features são preenchidos com **0**, garantindo que o modelo rode mesmo em dias sem refeição/medicação registrada.
- O export já filtra pacientes com `excluido = false`.

Como o paciente vê isso no app (teste local):
- Foi criada uma tela de teste “**Previsão (Machine Learning)**” (`PacientePrevisaoML`) onde o usuário preenche os 7 campos e chama o endpoint `/predict`, visualizando o resultado (probabilidade de glicemia elevada, classe, glicemia média prevista e cluster). Em ambiente web, a API permite CORS para esse teste local.

---

## 6. Planejamento semanal até 31/05/2026

O cronograma abaixo organiza as entregas semanais necessárias para finalizar o projeto até 31/05/2026.

| Semana | Período | Atividades | Responsável | Tempo estimado | Entrega da semana | Reunião semanal |
|---|---|---|---|---:|---|---|
| Semana 1 | 28/04 a 03/05 | Consolidar os requisitos do Bento e da Thayse; mapear o que já existe no app e no Supabase; definir o dataset real de ML; relacionar os 13 requisitos do Bento com evidências iniciais | Integrante 1 + Integrante 2 | 12 a 16h | Checklist de requisitos + especificação do dataset ML | 03/05, 30 a 45 min |
| Semana 2 | 04/05 a 10/05 | Implementar estratégia reprodutível Supabase para CSV; adaptar notebook para ler CSV real; executar validações e EDA inicial; testar autenticação, CRUD, validações e fluxo principal do sistema | Integrante 2 + Integrante 4 | 14 a 18h | CSV reprodutível + notebook com validação/EDA + evidências dos fluxos principais — índice no Git: [`entregas/README-ENTREGA-SEMANA-2.md`](entregas/README-ENTREGA-SEMANA-2.md) | 10/05, 30 a 45 min |
| Semana 3 | 11/05 a 17/05 | Treinar 4 pipelines com dados reais: classificação, regressão, clusterização e similaridade; gerar métricas; salvar figuras; selecionar versão do modelo | Integrante 2 + Integrante 3 | 16 a 22h | Resultados, métricas, figuras e decisão do modelo final | 17/05, 45 a 60 min |
| Semana 4 | 18/05 a 24/05 | Criar backend Python organizado; implementar persistência; criar API FastAPI `POST /predict`; testar localmente; consolidar auditoria, logs, usabilidade, relatórios e gráficos | Integrante 3 + Integrante 4 | 16 a 20h | API funcional + contrato JSON + evidências de auditoria, logs, relatórios e gráficos | 24/05, 30 a 45 min |
| Semana 5 | 25/05 a 31/05 | Fazer integração mínima app com API ou simulação controlada; finalizar documentação do Bento e da Thayse; preparar ZIP, slides, vídeo, evidências e ensaio final | Todos | 18 a 24h | Pacote final: documento, slides, vídeo, ZIP, evidências e checklist final | 31/05, 60 min |

**Situação real — Semana 2 (maio/2026):** **COMPLETA no repositório** — parte **Bento / auditoria** com **evidência visual validada** (`entregas/bento/semana-2-auditoria/`) e parte **Thayse (CSV/ML/API)** com export real + manifest + notebook executado + artefatos + API + integração no app (ver `entregas/thayse/RESUMO-ENTREGA-ML.md`).

---

## 7. Divisão de tarefas entre o grupo

Para equilibrar responsabilidades e garantir rastreabilidade, a divisão inicial será:

| Integrante | Foco principal | Tarefas principais |
|---|---|---|
| Integrante 1 | Documentação e requisitos do Bento | Documento final acadêmico, slides, rastreabilidade requisito-evidência, texto de LGPD e roteiro de apresentação |
| Integrante 2 | Dados e notebook de ML | Dataset real Supabase para CSV, refatoração do notebook, EDA, treinamento e métricas dos 4 pipelines |
| Integrante 3 | Backend Python e API | Estrutura Python organizada, persistência com joblib, FastAPI `POST /predict`, testes e documentação de execução |
| Integrante 4 | Evidências do app e qualidade | Evidências das telas e fluxos, CRUD, exclusão lógica, movimentações, auditoria, logs, relatórios e checklist final |
| Todos | Validação final | Participar das reuniões semanais, revisar entregas, testar o sistema e ensaiar apresentação |

---

## 8. Reuniões semanais

O grupo realizará reuniões semanais de acompanhamento para garantir o progresso contínuo e a validação do que será apresentado ao professor. Em cada reunião:

- Cada integrante deverá apresentar sua parte no próprio computador, mostrando evidências e resultados, como telas, relatórios, notebook, API e documentos.
- Pelo menos um integrante deverá estar presente semanalmente para apresentar ao professor o status da semana e demonstrar o que foi produzido.
- Ao final de cada reunião, o grupo deverá atualizar o checklist de acompanhamento e registrar as pendências para a próxima semana.

---

## 9. Riscos e cuidados

| Risco/Cuidado | Possível impacto | Ação de mitigação |
|---|---|---|
| Falta de conferência final dos requisitos do Bento | Algum requisito pode ficar sem evidência no documento ou na apresentação | Usar a tabela dos 13 requisitos do Bento como checklist oficial durante as semanas de execução |
| Dados reais insuficientes no Supabase | Modelos de ML pouco confiáveis ou inviáveis | Definir dataset por agregação, como paciente-dia ou janelas de tempo, e preparar base mínima para demonstração |
| Dificuldade de adaptar o notebook | Atraso no cronograma da Thayse | Refatorar por etapas: leitura CSV, validação, EDA, modelos e persistência |
| Integração API com aplicativo | Atrasos técnicos na fase final | Priorizar API funcional primeiro; se necessário, realizar integração mínima ou simulação controlada na Semana 5 |
| Atrasos do grupo | Comprometimento da entrega final | Manter reuniões semanais, divisão clara de tarefas, entregas pequenas por semana e checklist de verificação |

---

## 10. Conclusão

Este documento organiza as atividades do Projeto GlicNutri por semana, com divisão de responsabilidades e entregas verificáveis, visando garantir a conclusão até 31 de maio de 2026. O planejamento contempla os requisitos do professor Bento, relacionados à evolução do sistema, banco de dados, autenticação, CRUD, validações, auditoria, relatórios, documentação e entrega final, além dos requisitos da professora Thayse, relacionados à entrega de Machine Learning com dados reais do Supabase, persistência e API de predição.

Com a execução deste plano, o grupo terá maior controle sobre as pendências, reduzirá riscos de atraso e conseguirá apresentar evidências claras de funcionamento, implementação dos requisitos, organização do projeto e qualidade da apresentação final.

---

## 11. Checklist final do grupo

| Item | Status |
|---|---|
| Índice e manual Semana 2 no repositório (`entregas/README-ENTREGA-SEMANA-2.md`, `SEMANA-2-PASSO-A-PASSO.md`, atalhos export) | [x] |
| Conferir os 13 requisitos do Bento e relacionar cada um com uma evidência do sistema ou da documentação | [ ] |
| Consolidar checklist da Thayse e rastrear cada item para um entregável | [x] `entregas/thayse/RESUMO-ENTREGA-ML.md` |
| Definir dataset real do GlicNutri: variáveis, objetivo e regras | [x] secção 5.3 (dataset oficial paciente-dia) |
| Implementar exportação/ETL Supabase para CSV reprodutível | [x] script `machine-learning/scripts/export_supabase_csv.py` |
| Remover/isolar KaggleHub/Pima no notebook legado | [x] referência **GlicNutri**: `machine-learning/notebooks/glicnutri_ml_pipeline.ipynb` (paciente-dia). Referência **GlucoBench**: `machine-learning/notebooks/referencia/glucobench-reference.ipynb`. Pima/Kaggle removidos do fluxo do projeto |
| Executar validação do dataset real: tipos, nulos e integridade | [x] export + manifest (`machine-learning/data/export_manifest.json`) + validação no notebook |
| Refazer EDA com dados reais: histogramas, boxplots, heatmap e importância de variáveis | [x] baseline no notebook executado (`machine-learning/notebooks/glicnutri_ml_pipeline.executed.ipynb`) |
| Treinar e avaliar os 4 pipelines com dados reais | [x] classificação/regressão/cluster/similaridade executados + artefatos gerados |
| Persistir artefatos: modelo, padronização e variáveis | [x] `machine-learning/api/artifacts/*.joblib`, `training_meta.json` |
| Criar backend Python organizado e reproduzível | [x] pasta `machine-learning/api/` + `requirements.txt` |
| Implementar API FastAPI com `POST /predict` e testar com exemplos | [x] `machine-learning/api/app/main.py` + CORS (web) |
| Integração do app com a API local de ML (tela paciente) | [x] `src/telas/paciente/TelaPrevisaoMl.js`, `src/servicos/servicoMlLocal.js`, rota `PacientePrevisaoML` e menu paciente |
| Consolidar evidências do app: login, CRUD, exclusão lógica e processos | [x] Semana 2 Bento: `entregas/bento/semana-2-auditoria/` com PNG em `prints/` e docs alinhados |
| Consolidar auditoria/logs no repositório (evidências Semana 2) | [x] `evidencias-auditoria.md`, `checklist-auditoria.md`, `STATUS-SEMANA-2.md`; **Evidência visual validada com capturas reais no repositório** |
| Roteiros/texto prontos para fechar parciais do Bento (BD/CRUD/UX/relatórios) | [x] `entregas/bento/BANCO-DE-DADOS-ER-EVIDENCIAS.md`, `entregas/bento/CRUD-VALIDACOES-ROTEIRO-EVIDENCIAS.md`, `entregas/bento/USABILIDADE-RELATORIOS-PRINTS-TEXTO.md` |
| Consolidar texto LGPD no documento Word final | [ ] |
| Consolidar relatórios e gráficos para apresentação | [ ] |
| Preparar slides e roteiro de demonstração | [ ] |
| Preparar ZIP do projeto e vídeo demonstrativo | [ ] |
| Ensaiar apresentação final e revisar checklist de entrega | [ ] |

---

## 12. Próximos passos imediatos do grupo

1. **Semana 2 — Thayse (fechado localmente):** export executado (CSV + `export_manifest.json`), notebook executado (EDA + treino + artefatos), API local rodando e integrada ao app (tela paciente “Previsão (IA)”). Próximo passo é **capturar evidências** (prints e métricas) para o pacote acadêmico e, se permitido, commitar `machine-learning/data/export_manifest.json`.
2. **Reunião 10/05:** seguir [`entregas/demo-reuniao-semana-2.md`](entregas/demo-reuniao-semana-2.md); declarar plano B (sample + limitações) se o volume real ainda for insuficiente.
3. Fechar o checklist do Bento com base nos 13 requisitos oficiais, relacionando cada requisito com telas, funcionalidades, banco de dados, documentos ou evidências do sistema. Base pronta: `entregas/bento/checklist-13-requisitos-bento.md` (evidência visual Semana 2 já em [`entregas/bento/semana-2-auditoria/`](entregas/bento/semana-2-auditoria/)).
4. (Concluído) Dataset oficial do ML definido na secção 5.3 (paciente-dia + features + alvos + regras).
5. **Semana 3:** reforçar métricas e narrativa (opcional: mais dados, melhor validação, gráficos e explicação clínica) — o baseline já está funcional.
6. Estabelecer rotina de reunião semanal e uma entrega mínima por semana, com responsáveis e validação coletiva.
