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
- `Diabetes_pipeline_ml (3).ipynb` (GlucoBench) e `Diabetes_pipeline_ml_legacy_pima_anexo.ipynb` (Pima legado isolado)
- `Cronograma ADS5 - Projeto de Sistemas V3.pdf`
- Pastas e arquivos de aulas: `AULA1` até `AULA7`, utilizados como materiais de apoio para compreender os requisitos da disciplina da professora Thayse.
- Código do aplicativo GlicNutri, desenvolvido em Expo/React Native e integrado ao Supabase.
- Banco Supabase e migrations, contendo estrutura de dados, funções e componentes relacionados à persistência.

---

## 3. Diagnóstico geral do projeto

### 3.1 O que já existe no projeto

De forma geral, o projeto já possui uma base funcional consistente, incluindo:

- Aplicativo desenvolvido em Expo/React Native, com telas para perfis de usuário, como paciente, nutricionista e administrador.
- Integração com Supabase, utilizada para autenticação e persistência de dados.
- Fluxos de uso relevantes já implementados, como monitoramento e registro de glicemia, registro de medicação/insulina, registro de refeição com apoio de IA e painel administrativo com indicadores, auditoria e logs.
- Banco de dados versionado por migrations, o que facilita documentação, rastreabilidade e reprodução.
- Notebook de Machine Learning no repositório (`ml/notebooks/glicnutri_ml_pipeline.ipynb`) com pipeline paciente-dia; usar CSV exportado do Supabase (`ml/scripts/export_supabase_csv.py`) para dados reais ou o CSV de exemplo (`ml/data/sample_glicnutri_patient_day.csv`) para desenvolvimento local.

### 3.2 O que está incompleto

Apesar da base do sistema existir, há pontos que precisam ser finalizados e padronizados para o contexto acadêmico:

- A entrega de Machine Learning ainda não utiliza dados reais do GlicNutri extraídos do Supabase.
- Backend Python com FastAPI e endpoint `POST /predict` passou a existir no repositório (`backend/app/main.py`); falta integração opcional com o app e hospedagem para demonstração final.
- As evidências e a documentação acadêmica precisam ser consolidadas em um pacote final, com rastreabilidade entre requisitos e implementação.
- Relatórios e gráficos de gestão existem parcialmente, mas devem ser organizados como entregável, com explicação e evidências.

### 3.3 O que ainda falta implementar

- Executar o export `ml/scripts/export_supabase_csv.py` com credenciais reais e volume suficiente para treino (o pipeline de export já existe).
- Apontar o notebook `ml/notebooks/glicnutri_ml_pipeline.ipynb` para o CSV real e refinar pré-processamento/métricas. O notebook `Diabetes_pipeline_ml (3).ipynb` cobre **GlucoBench** como referência de domínio; o legado Pima foi **isolado** em `Diabetes_pipeline_ml_legacy_pima_anexo.ipynb`.
- Treinar e avaliar os quatro modelos com dados reais (substituindo o CSV de exemplo ou artefatos gerados por `backend/scripts/fit_demo_models.py`).
- Servir o modelo em ambiente de demonstração (uvicorn/local ou nuvem) e registrar evidências de chamadas à API.
- Consolidar documentação final, evidências, prints, roteiros de demonstração e checklist de entrega.

### 3.4 Status real no repositório (sincronização técnica — maio/2026)

Esta subsecção amarra **requisito → evidência no código** conforme o estado atual do repositório (não substitui documentos PDF/Word externos nem vínculos acadêmicos que dependem de prints).

| Área | Situação no repo | Onde evidenciar |
|------|------------------|-----------------|
| App Expo + Supabase | Implementado: auth (paciente/nutri/admin/Google), cadastros, monitoramento, refeição IA, painel admin | `GlicNutri/src/`, `GlicNutri/supabase/migrations/` |
| Export CSV reprodutível | Script Postgres paciente-dia + procedimento documentado | `ml/scripts/export_supabase_csv.py` (variável `DATABASE_URL`); passos em `ml/EXPORT_CSV.md` |
| Dataset / exemplo | CSV sintético para notebook sem DB | `ml/data/sample_glicnutri_patient_day.csv` |
| Notebook ML (GlicNutri paciente-dia) | Pipeline (EDA + 4 tarefas + joblib) | `ml/notebooks/glicnutri_ml_pipeline.ipynb` |
| Notebook ML (GlucoBench referência) | Carga/validação GlucoBench; legado Pima **isolado** | `Diabetes_pipeline_ml (3).ipynb`; anexo `Diabetes_pipeline_ml_legacy_pima_anexo.ipynb` |
| Artefatos joblib | Gerados pelo notebook ou `backend/scripts/fit_demo_models.py` | `backend/artifacts/*.joblib`, `training_meta.json` |
| API `POST /predict` | FastAPI + contrato JSON | `backend/app/main.py`, dependências em `backend/requirements.txt` |
| Auditoria e logs (implementação no app) | **Completo** no código: gravação Storage, painel admin, recuperação de senha sem dados sensíveis nos detalhes | `servicoAuditoria.js`, `TelaHomeAdmin.js`, `TelaAuditoriaAdmin.js`, `TelaLogsSistemaAdmin.js`, `TelaRecuperarSenha.js` |
| Logs persistidos via Supabase Storage (bucket `audit-logs`) | **Completo** no código (fluxo implementado) | Idem + migrations/policies conforme projeto |
| Evidências visuais Semana 2 (capturas PNG) | **Parcial** no repositório: [`evidencias-auditoria.md`](../entregas/bento/semana-2-auditoria/evidencias-auditoria.md) referencia sete PNG; **ficheiros ainda não versionados** em [`prints/`](../entregas/bento/semana-2-auditoria/prints/) (só SVG legados na última validação) | Versionar `login_tela.png`, `login_sucesso.png`, `glicemia_input.png`, `glicemia_salva.png`, `auditoria_app.png`, `storage_lista.png`, `storage_log.png` |
| Autenticação (evidência visual Semana 2) | **Parcial** até os PNG de login existirem em `prints/` | Idem |
| Fluxo paciente — glicemia (evidência visual Semana 2) | **Parcial** até os PNG `glicemia_*.png` existirem em `prints/` | Idem |
| Export CSV Supabase (dados reais) | **Parcial** | `ml/scripts/export_supabase_csv.py`, `ml/EXPORT_CSV.md`; execução com `DATABASE_URL` real ainda não evidenciada no repo |
| ML referência GlucoBench | **Parcial / em andamento** | `Diabetes_pipeline_ml (3).ipynb` + `Diabetes_pipeline_ml_legacy_pima_anexo.ipynb`; sem treino/pipeline final obrigatório nesta linha |
| Entregas acadêmicas (ZIP, slides, vídeo, Word único) | Fora do escopo do Git / pendente de grupo | Processo manual |

**Nota sobre CRUD / exclusão:** exclusão física de glicemia/medicação não é exposta por design; histórico usa ocultação no app + auditoria de eventos; exclusão de paciente pelo nutricionista é lógica (`excluido`).

**Semana 2 (entrega prevista 10/05) — situação real:** **PARCIAL no conjunto do planejamento.** A parte **Bento / auditoria** está **fechada em código** e **documentada** para execução real em [`evidencias-auditoria.md`](../entregas/bento/semana-2-auditoria/evidencias-auditoria.md), [`checklist-auditoria.md`](../entregas/bento/semana-2-auditoria/checklist-auditoria.md) e [`STATUS-SEMANA-2.md`](../entregas/bento/semana-2-auditoria/STATUS-SEMANA-2.md); a **evidência fotográfica** no Git continua **parcial** até os PNG referenciados existirem em `prints/`. A parte **Thayse** continua **parcial**: export CSV com credenciais reais e narrativa ML completa com dados GlicNutri (ver `ml/EXPORT_CSV.md` e `ml/notebooks/glicnutri_ml_pipeline.ipynb`).

### 3.5 Requisito → evidência → artefacto (resumo)

| Foco | Estado | Onde comprovar |
|------|--------|----------------|
| Bento — autenticação, fluxos, CRUD | Parcial (evid. visual S2 até PNG versionados) | Código: `src/telas/autenticacao/`, `App.js`, `servicoDadosPaciente.js`; pasta [`../entregas/bento/semana-2-auditoria/`](../entregas/bento/semana-2-auditoria/) (`evidencias-auditoria.md`, `checklist-auditoria.md`, `STATUS-SEMANA-2.md`, `roteiro-testes.md`, [`prints/`](../entregas/bento/semana-2-auditoria/prints/)) |
| Bento — auditoria (código) | Completo | `servicoAuditoria.js`, telas admin e fluxos em `checklist-auditoria.md` |
| Bento — auditoria (evidência visual Git) | Parcial | [`evidencias-auditoria.md`](../entregas/bento/semana-2-auditoria/evidencias-auditoria.md) + PNG em `prints/` (pendentes) |
| Thayse — CSV reprodutível | Parcial | `ml/scripts/export_supabase_csv.py`, `ml/EXPORT_CSV.md` |
| Thayse — ML GlicNutri (paciente-dia) | Parcial | `ml/notebooks/glicnutri_ml_pipeline.ipynb` |
| Thayse — ML referência GlucoBench | Parcial / em andamento | `Diabetes_pipeline_ml (3).ipynb` (legado Pima: `Diabetes_pipeline_ml_legacy_pima_anexo.ipynb`) |
| Thayse — API | Parcial | `backend/app/main.py` |

---

## 4. Requisitos relacionados ao Bento

Os requisitos do professor Bento foram organizados com base no documento `Requisitos_Bento_GlicNutri.pdf`, referente ao Projeto GlicNutri. Esses requisitos envolvem documentação inicial, banco de dados, autenticação, CRUD, validações, fluxo do sistema, usabilidade, auditoria, relatórios, organização do código, atualização da documentação e entrega final.

### 4.1 Tabela de requisitos do Bento

| Nº | Requisito do Bento | O que o requisito pede | Status atual | Evidência encontrada no projeto | O que ainda precisa ser feito | Semana prevista |
|---|---|---|---|---|---|---|
| 1 | Documentação Inicial | Documento Word padronizado, definição de tecnologias e levantamento de requisitos | Parcial (repo) | `Planejamento_Final_Atividades_GlicNutri_Ajustado.md`, pasta `entregas/` | Consolidar documento Word final com tecnologias, requisitos e descrição do sistema | Semana 1 e Semana 5 |
| 2 | Banco de Dados | Estrutura de tabelas, campos adequados, chaves primárias, estrangeiras e relacionamentos | Parcial | `GlicNutri/supabase/migrations/` | Documentar ER/tabelas no documento final acadêmico | Semana 1 |
| 3 | Autenticação | Login de usuários, validação de credenciais e recuperação de senha | Parcial | Código: `TelaLogin.js`, `TelaRecuperarSenha.js`, `App.js`, RPCs; evidência visual Semana 2: [`evidencias-auditoria.md`](../entregas/bento/semana-2-auditoria/evidencias-auditoria.md) (PNG `login_*.png` referenciados — versionar em `prints/`) | Recuperação de senha: evidência específica se o professor exigir; completar PNG no repo | Semana 2 |
| 4 | CRUD Completo | Cadastro, consulta, edição e exclusão lógica | Parcial | Cadastro/gestão: `TelaCadastro.js`, `TelaPacientesNutricionista.js`, `servicoDadosPaciente.js` | Documentar decisão: exclusão clínica por ocultação + auditoria (sem DELETE físico glicemia/medicação) | Semana 2 |
| 5 | Validações de Dados | Validação de campos obrigatórios, CPF, CEP, email e outros dados necessários | Parcial | Formulários em `TelaCadastro.js`, `TelaPacientesNutricionista.js`, login | Auditoria de cobertura por tela + evidências | Semana 2 |
| 6 | Fluxo do Sistema | Navegação entre telas, fluxo funcional completo e persistência no banco | Parcial | `App.js`, fluxos paciente/nutri/admin; Semana 2: capturas login + glicemia em [`evidencias-auditoria.md`](../entregas/bento/semana-2-auditoria/evidencias-auditoria.md) (PNG pendentes em `prints/`) | Roteiro/demo gravado global; versionar PNG para evidência Git | Semana 2 e Semana 4 |
| 7 | Usabilidade | Interface funcional, facilidade de uso e navegação intuitiva | Parcial | UI RN em `src/telas/` | Revisão heurística + prints | Semana 4 |
| 8 | Auditoria | Registro de ações de cadastro, movimentações e logs de operações | Parcial | Código completo; pasta [`../entregas/bento/semana-2-auditoria/`](../entregas/bento/semana-2-auditoria/) (`checklist-auditoria.md`, `evidencias-auditoria.md`, `STATUS-SEMANA-2.md`) | Versionar PNG (`auditoria_app`, `storage_*`) em `prints/`; texto LGPD no documento Word final | Semana 4 |
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

- Refazer ou adaptar o notebook `Diabetes_pipeline_ml.ipynb`.
- Remover o uso de KaggleHub/Pima Indians Diabetes, pois se trata de dataset externo.
- Usar dados reais do GlicNutri originados do Supabase, via exportação/ETL para CSV ou leitura controlada.
- Implementar um pipeline de ML completo, com validação, EDA, treino e avaliação.
- Implementar persistência dos modelos, incluindo modelo, padronização/normalização e lista de variáveis.
- Implementar uma API FastAPI com endpoint `POST /predict`.

### 5.2 Tabela de requisitos da Thayse

| Requisito | Status | O que precisa ser feito | Evidência ou arquivo relacionado |
|---|---|---|---|
| Arquitetura em camadas: ML Python + API REST + integração | Parcial (repo) | Integrar predição ao app ou demo controlada na reta final | `backend/app/main.py`, `backend/requirements.txt` |
| Coleta/carregamento de dados em CSV + validação do dataset | Parcial | Rodar export com dados reais (`DATABASE_URL`) e validar volume/campos | `ml/scripts/export_supabase_csv.py`, `ml/data/sample_glicnutri_patient_day.csv`, notebook |
| Pré-processamento: imputação, conversões e padronização | Parcial | Refinar imputação com dataset real (hoje: fillna em features numéricas no notebook) | `ml/notebooks/glicnutri_ml_pipeline.ipynb` |
| EDA: histogramas, boxplots, correlação e importância de variáveis | Parcial | Expandir figuras e narrativa com CSV real | Idem notebook |
| Treinamento e avaliação com métricas adequadas | Parcial | Reexecutar com amostra real suficiente; documentar métricas na monografia | Idem notebook |
| Cobertura de 4 problemas: classificação, regressão, clusterização e similaridade/recomendação | Parcial | Quatro blocos no notebook; ajustar definições com domínio clínico real | Idem notebook |
| Persistência: modelo, padronização e lista de variáveis | Parcial | Artefatos joblib + `training_meta.json`; regerar após treino real | `backend/artifacts/`, `backend/scripts/fit_demo_models.py` |
| API REST com endpoint `POST /predict` | Parcial (repo) | Hospedar/testar em ambiente de demonstração | `backend/app/main.py` (`/health`, `/predict`) |

---

## 6. Planejamento semanal até 31/05/2026

O cronograma abaixo organiza as entregas semanais necessárias para finalizar o projeto até 31/05/2026.

| Semana | Período | Atividades | Responsável | Tempo estimado | Entrega da semana | Reunião semanal |
|---|---|---|---|---:|---|---|
| Semana 1 | 28/04 a 03/05 | Consolidar os requisitos do Bento e da Thayse; mapear o que já existe no app e no Supabase; definir o dataset real de ML; relacionar os 13 requisitos do Bento com evidências iniciais | Integrante 1 + Integrante 2 | 12 a 16h | Checklist de requisitos + especificação do dataset ML | 03/05, 30 a 45 min |
| Semana 2 | 04/05 a 10/05 | Implementar estratégia reprodutível Supabase para CSV; adaptar notebook para ler CSV real; executar validações e EDA inicial; testar autenticação, CRUD, validações e fluxo principal do sistema | Integrante 2 + Integrante 4 | 14 a 18h | CSV reprodutível + notebook com validação/EDA + evidências dos fluxos principais | 10/05, 30 a 45 min |
| Semana 3 | 11/05 a 17/05 | Treinar 4 pipelines com dados reais: classificação, regressão, clusterização e similaridade; gerar métricas; salvar figuras; selecionar versão do modelo | Integrante 2 + Integrante 3 | 16 a 22h | Resultados, métricas, figuras e decisão do modelo final | 17/05, 45 a 60 min |
| Semana 4 | 18/05 a 24/05 | Criar backend Python organizado; implementar persistência; criar API FastAPI `POST /predict`; testar localmente; consolidar auditoria, logs, usabilidade, relatórios e gráficos | Integrante 3 + Integrante 4 | 16 a 20h | API funcional + contrato JSON + evidências de auditoria, logs, relatórios e gráficos | 24/05, 30 a 45 min |
| Semana 5 | 25/05 a 31/05 | Fazer integração mínima app com API ou simulação controlada; finalizar documentação do Bento e da Thayse; preparar ZIP, slides, vídeo, evidências e ensaio final | Todos | 18 a 24h | Pacote final: documento, slides, vídeo, ZIP, evidências e checklist final | 31/05, 60 min |

**Situação real — Semana 2 (maio/2026):** **PARCIAL (global).** A parte **Bento — auditoria** está **validada em código** e o texto em `entregas/bento/semana-2-auditoria/` descreve **execução real** com referências PNG; **completar** no Git exige **versionar** os ficheiros em `prints/`. A parte **Thayse** permanece **parcial**: export CSV com `DATABASE_URL` real e ML com dados reais, conforme secção 3.4.

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
| Conferir os 13 requisitos do Bento e relacionar cada um com uma evidência do sistema ou da documentação | [ ] |
| Consolidar checklist da Thayse e rastrear cada item para um entregável | [ ] |
| Definir dataset real do GlicNutri: variáveis, objetivo e regras | [ ] |
| Implementar exportação/ETL Supabase para CSV reprodutível | [x] script `ml/scripts/export_supabase_csv.py` |
| Remover/isolar KaggleHub/Pima no notebook legado | [x] referência **GlicNutri**: `ml/notebooks/glicnutri_ml_pipeline.ipynb` (paciente-dia). Referência **GlucoBench**: `Diabetes_pipeline_ml (3).ipynb`. Legado Pima isolado em `Diabetes_pipeline_ml_legacy_pima_anexo.ipynb` (não é o fluxo principal de avaliação) |
| Executar validação do dataset real: tipos, nulos e integridade | [ ] rodar export + notebook com `DATABASE_URL` |
| Refazer EDA com dados reais: histogramas, boxplots, heatmap e importância de variáveis | [ ] ampliar notebook com CSV real |
| Treinar e avaliar os 4 pipelines com dados reais | [ ] depende de volume de dados no Supabase |
| Persistir artefatos: modelo, padronização e variáveis | [x] `backend/artifacts/*.joblib`, `training_meta.json` |
| Criar backend Python organizado e reproduzível | [x] pasta `backend/` + `requirements.txt` |
| Implementar API FastAPI com `POST /predict` e testar com exemplos | [x] `backend/app/main.py` |
| Consolidar evidências do app: login, CRUD, exclusão lógica e processos | [ ] parcial — Semana 2: md + checklist em `entregas/bento/semana-2-auditoria/`; **PNG referenciados ainda não no repo** |
| Consolidar auditoria/logs no repositório (evidências Semana 2) | [x] `evidencias-auditoria.md`, `checklist-auditoria.md`, `STATUS-SEMANA-2.md` (execução real descrita); **pendente:** versionar 7 PNG em `prints/` |
| Consolidar texto LGPD no documento Word final | [ ] |
| Consolidar relatórios e gráficos para apresentação | [ ] |
| Preparar slides e roteiro de demonstração | [ ] |
| Preparar ZIP do projeto e vídeo demonstrativo | [ ] |
| Ensaiar apresentação final e revisar checklist de entrega | [ ] |

---

## 12. Próximos passos imediatos do grupo

1. Fechar o checklist do Bento com base nos 13 requisitos oficiais, relacionando cada requisito com telas, funcionalidades, banco de dados, documentos ou evidências do sistema.
2. Definir oficialmente o dataset real do ML, incluindo quais dados do Supabase serão usados, qual será o objetivo do modelo e quais variáveis serão calculadas.
3. Combinar a estratégia de exportação do Supabase para CSV, garantindo que o grupo consiga reproduzir o mesmo formato de dataset posteriormente.
4. Planejar evidências desde já, registrando prints e um roteiro simples de demonstração das telas e fluxos do aplicativo.
5. Estabelecer rotina de reunião semanal e uma entrega mínima por semana, com responsáveis e validação coletiva.
