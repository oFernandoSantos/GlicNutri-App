# Pacote final — checklist (ZIP/Slides/Vídeo/Word)

Este checklist ajuda a montar a entrega final sem esquecer nada.

## 1) Word (documento final)

- [ ] Objetivo do sistema + público-alvo
- [ ] Tecnologias (Expo/React Native, Supabase, Python/FastAPI, scikit-learn)
- [ ] Requisitos Bento (1–13) com evidências (citar arquivos + prints)
- [ ] LGPD (texto curto: dados sensíveis, minimização, não commit de credenciais)
- [ ] Banco de dados (ER + prints do Supabase)
- [ ] Fluxo do sistema (prints do paciente/nutri/admin)
- [ ] ML (dataset oficial, export, notebook, métricas, artefatos, API, integração)

Links internos úteis:
- Bento: `entregas/bento/RESUMO-REQUISITOS-BENTO.md`
- Checklist 13 Bento: `entregas/bento/checklist-13-requisitos-bento.md`
- Banco/ER: `entregas/bento/BANCO-DE-DADOS-ER-EVIDENCIAS.md`
- CRUD/Validações: `entregas/bento/CRUD-VALIDACOES-ROTEIRO-EVIDENCIAS.md`
- Usabilidade/Relatórios: `entregas/bento/USABILIDADE-RELATORIOS-PRINTS-TEXTO.md`
- Thayse (ML): `entregas/thayse/RESUMO-ENTREGA-ML.md`

## 2) Slides

- [ ] Problema e solução (1 slide)
- [ ] Arquitetura (App + Supabase + ML API) (1 slide)
- [ ] Banco (ER) (1 slide)
- [ ] Fluxo do paciente (prints) (1–2 slides)
- [ ] Fluxo do nutricionista/admin (prints) (1 slide)
- [ ] ML: dataset + modelo + demo `/predict` (1–2 slides)
- [ ] Encerramento (riscos, próximos passos) (1 slide)

## 3) Vídeo demo (roteiro sugerido)

- [ ] Login (paciente)
- [ ] Home paciente + registro (glicose/refeição/medicação)
- [ ] Admin auditoria (mostrar logs)
- [ ] ML: tela “Previsão (IA)” chamando `/predict`
- [ ] Encerrar

## 4) ZIP do projeto

- [ ] Código (pasta do projeto)
- [ ] Evidências (prints)
- [ ] `machine-learning/data/export_manifest.json`
- [ ] (Se exigido) `machine-learning/data/glicnutri_patient_day_export.csv`
- [ ] Artefatos ML: `machine-learning/api/artifacts/`

## 5) Conferência final (antes de enviar)

- [ ] Rodar API: `python -m uvicorn app.main:app --port 8001`
- [ ] Rodar app: `npm.cmd run start`
- [ ] Testar no app: “Previsão (IA)” → `/health` e `/predict`

