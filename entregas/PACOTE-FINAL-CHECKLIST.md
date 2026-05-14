# Pacote final — checklist (ZIP/Slides/Vídeo/Word)

Este checklist ajuda a montar a entrega final sem esquecer nada.

## Estado no repositório (suporte já preparado)

| Entrega | Onde está preparado |
|---------|---------------------|
| Montagem ZIP + lista de anexos | [`entregas/PACOTE-MONTAGEM.md`](PACOTE-MONTAGEM.md), [`scripts/build-zip-entrega.ps1`](../scripts/build-zip-entrega.ps1) |
| LGPD (texto curto) | [`entregas/LGPD-TEXTO-CURTO.md`](LGPD-TEXTO-CURTO.md) |
| Roteiro de slides | [`entregas/slides-roteiro.md`](slides-roteiro.md) |
| Ensaio / demo | [`entregas/ENSAIO-FINAL-CHECKLIST.md`](ENSAIO-FINAL-CHECKLIST.md) |
| Atualização Word (suplemento) | `WordFinalGlicNutri-ATUALIZADO.docx`, `entregas/WordFinalGlicNutri-ATUALIZACOES-PARA-COLAR.md` |

**Ainda manual (grupo):** exportar `.pptx`, gravar vídeo, correr o script ZIP na máquina de entrega e anexar ficheiros que não entram no Git (ex.: CSV real se exigido).

## 1) Word (documento final)

- [x] Objetivo do sistema + público-alvo *(fontes: `Planejamento_Final_Atividades_GlicNutri_Ajustado.md`, TCC Word)*
- [x] Tecnologias (Expo/React Native, Supabase, Python/FastAPI, scikit-learn) *(Thayse: `entregas/thayse/RESUMO-ENTREGA-ML.md`)*
- [x] Requisitos Bento (1–13) com evidências (citar arquivos + prints) *(`entregas/bento/checklist-13-requisitos-bento.md`)*
- [x] LGPD (texto curto: dados sensíveis, minimização, não commit de credenciais) *(`entregas/LGPD-TEXTO-CURTO.md`)*
- [x] Banco de dados (ER + prints do Supabase) *(ER: `entregas/diagrama-glicnutri-a4-vertical.pdf`; texto: `BANCO-DE-DADOS-ER-EVIDENCIAS.md`; print Supabase opcional no ZIP)*
- [x] Fluxo do sistema (prints do paciente/nutri/admin) *(Semana 2 + roteiros `entregas/bento/`)*
- [x] ML (dataset oficial, export, notebook, métricas, artefatos, API, integração) *(`RESUMO-ENTREGA-ML.md`, `export_manifest.json`, `machine-learning/api/artifacts/`, tela `TelaPrevisaoMl.js`)*

Links internos úteis:
- Bento: `entregas/bento/RESUMO-REQUISITOS-BENTO.md`
- Checklist 13 Bento: `entregas/bento/checklist-13-requisitos-bento.md`
- Banco/ER: `entregas/bento/BANCO-DE-DADOS-ER-EVIDENCIAS.md`
- CRUD/Validações: `entregas/bento/CRUD-VALIDACOES-ROTEIRO-EVIDENCIAS.md`
- Usabilidade/Relatórios: `entregas/bento/USABILIDADE-RELATORIOS-PRINTS-TEXTO.md`
- Thayse (ML): `entregas/thayse/RESUMO-ENTREGA-ML.md`

## 2) Slides

- [x] Roteiro completo *(ver `entregas/slides-roteiro.md`)*
- [ ] Ficheiro `.pptx` exportado *(montagem manual no PowerPoint / Google Slides)*
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

> Roteiro alinhado a `entregas/ENSAIO-FINAL-CHECKLIST.md` §4.

## 4) ZIP do projeto

- [x] Script para ZIP do código versionado (`scripts/build-zip-entrega.ps1` → `entregas/pacote-zip/`)
- [ ] Executar o script e anexar o `.zip` na plataforma de entrega
- [x] Evidências (prints) no repo (`entregas/bento/semana-2-auditoria/prints/`)
- [x] `machine-learning/data/export_manifest.json`
- [ ] (Se exigido) `machine-learning/data/glicnutri_patient_day_export.csv` *(gerar localmente; não versionado)*
- [x] Artefatos ML: `machine-learning/api/artifacts/` *(ficheiros versionados conforme política do grupo)*

## 5) Conferência final (antes de enviar)

Checklist detalhado: [`entregas/ENSAIO-FINAL-CHECKLIST.md`](ENSAIO-FINAL-CHECKLIST.md).

- [ ] Rodar API: `python -m uvicorn app.main:app --port 8001`
- [ ] Rodar app: `npm.cmd run start`
- [ ] Testar no app: “Previsão (IA)” → `/health` e `/predict`

