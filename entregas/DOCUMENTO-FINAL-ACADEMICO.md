# GlicNutri — documento final acadêmico (fonte para Word)

Este ficheiro reúne o conteúdo pedido para o **documento Word** da entrega: pode copiar secção a secção para o modelo da instituição. Não substitui o PDF dos professores; serve como **texto consolidado** com ligações ao repositório.

---

## 1. Objetivo do sistema e público-alvo

**Objetivo:** apoiar o acompanhamento nutricional e metabólico de pessoas com diabetes (ou risco), integrando registo de glicemia, refeições (com apoio de IA), medicação/insulina, plano alimentar e contacto com nutricionista, com painel administrativo, auditoria e logs.

**Público-alvo:**

- **Paciente:** registo diário, consulta de histórico, plano e bem-estar; teste de previsão ML (ambiente local).
- **Nutricionista:** gestão de pacientes, agenda, consultas, prontuário e plano alimentar.
- **Administrador:** indicadores, auditoria e logs do sistema (incluindo Storage Supabase).

---

## 2. Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Aplicação móvel / web | Expo / React Native |
| Backend de dados e auth | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Machine Learning | Python, pandas, scikit-learn, notebooks Jupyter |
| API de inferência | FastAPI, Uvicorn; modelos persistidos em `joblib` |
| Versionamento | Git; migrações SQL em `supabase/migrations/` |

---

## 3. LGPD e dados sensíveis (texto curto)

O GlicNutri trata **dados de saúde** (glicemia, medicação, refeições), enquadrados como **dados pessoais sensíveis** pela LGPD. O projeto adota:

- **Minimização:** exportações para ML agregam informação ao nível **paciente-dia**; o CSV completo de produção não é versionado no Git (ver `machine-learning/data/.gitignore`).
- **Controlo de acesso:** autenticação Supabase e políticas de leitura/escrita no backend.
- **Auditoria:** registo de eventos relevantes e logs em Storage, consumíveis pelo perfil administrador (evidências em `entregas/bento/semana-2-auditoria/`).
- **Segurança operacional:** **não** commitar credenciais, `DATABASE_URL` ou chaves de API; usar variáveis de ambiente locais e segredos fora do repositório.

---

## 4. Requisitos Bento (1–13) — rastreabilidade

| # | Requisito | Onde evidenciar no repo |
|---|-----------|-------------------------|
| 1 | Documentação inicial | `Planejamento_Final_Atividades_GlicNutri_Ajustado.md`, `entregas/bento/RESUMO-REQUISITOS-BENTO.md`, este ficheiro |
| 2 | Base de dados | `supabase/migrations/`, `entregas/bento/BANCO-DE-DADOS-ER-EVIDENCIAS.md`, diagrama `entregas/diagrama-glicnutri-a4-vertical.pdf` (ou `.html`/`.png`) |
| 3 | Autenticação | `App.js`, `src/telas/autenticacao/TelaLogin.js`, `src/servicos/configSupabase.js`; prints Semana 2 em `entregas/bento/semana-2-auditoria/prints/` |
| 4 | CRUD / exclusão lógica | `TelaCadastro.js`, `TelaPacientesNutricionista.js`, `servicoDadosPaciente.js`; roteiro `entregas/bento/CRUD-VALIDACOES-ROTEIRO-EVIDENCIAS.md` |
| 5 | Validações | Mesmo roteiro; `servicoVerificacaoEmail.js` |
| 6 | Fluxo do sistema | Rotas em `App.js`, telas em `src/telas/paciente/`, `nutricionista/`, `admin/` |
| 7 | Usabilidade | `src/temas/`, `src/componentes/`; texto `entregas/bento/USABILIDADE-RELATORIOS-PRINTS-TEXTO.md` |
| 8 | Auditoria e logs | `servicoAuditoria.js`, telas `src/telas/admin/*`; `evidencias-auditoria.md` |
| 9 | Relatórios e gráficos | `TelaHomeAdmin.js`, telas de monitoramento paciente; mesmo ficheiro de usabilidade/relatórios |
| 10 | Organização do código | Estrutura `src/telas`, `src/servicos`, `src/componentes` |
| 11 | Atualização da documentação | `entregas/`, planejamento ajustado |
| 12 | Entrega final | `entregas/PACOTE-FINAL-CHECKLIST.md`, `entregas/PACOTE-MONTAGEM.md`, `scripts/build-zip-entrega.ps1` |
| 13 | Critérios de avaliação | `entregas/ENSAIO-FINAL-CHECKLIST.md`, `entregas/bento/checklist-13-requisitos-bento.md` |

**Nota de desenho (CRUD):** exclusão física de glicemia/medicação não é exposta; usa-se histórico com ocultação e auditoria; exclusão de paciente pelo nutricionista pode ser lógica (`excluido`), conforme planejamento.

---

## 5. Banco de dados (ER e persistência)

- **Migrações:** `supabase/migrations/` definem tabelas, chaves e políticas.
- **Texto + roteiro de prints Supabase:** `entregas/bento/BANCO-DE-DADOS-ER-EVIDENCIAS.md`.
- **Diagrama A4:** `entregas/diagrama-glicnutri-a4-vertical.pdf` (anexar print na entrega se pedido).

---

## 6. Fluxo do sistema (paciente / nutricionista / admin)

1. Autenticação (e-mail/senha ou fluxos configurados no projeto).
2. Paciente: início → monitoramento / registo de glicemia → refeição (IA) / medicação → consultas / plano.
3. Nutricionista: pacientes → prontuário / agenda / consulta.
4. Admin: painel → auditoria → logs (Storage).

Roteiros de captura: `entregas/bento/semana-2-auditoria/` e `entregas/bento/CRUD-VALIDACOES-ROTEIRO-EVIDENCIAS.md`.

---

## 7. Machine Learning (disciplina Thayse)

- **Dataset oficial:** uma linha = um **paciente-dia**; manifest reprodutível `machine-learning/data/export_manifest.json`; script `machine-learning/scripts/export_supabase_csv.py`.
- **Notebook:** `machine-learning/notebooks/glicnutri_ml_pipeline.ipynb` (execução arquivada: `glicnutri_ml_pipeline.executed.ipynb`).
- **Artefatos:** `machine-learning/api/artifacts/*.joblib`, `training_meta.json`.
- **API:** `machine-learning/api/app/main.py` (`GET /health`, `POST /predict`).
- **Integração no app:** `src/telas/paciente/TelaPrevisaoMl.js`, `src/servicos/servicoMlLocal.js`.

Texto de apoio completo: `entregas/thayse/RESUMO-ENTREGA-ML.md` e secção 5.3 do `Planejamento_Final_Atividades_GlicNutri_Ajustado.md`.

---

## 8. Referências rápidas para anexos do ZIP

- Evidências visuais Semana 2: `entregas/bento/semana-2-auditoria/prints/`.
- Checklist Bento 1:1: `entregas/bento/checklist-13-requisitos-bento.md`.
- Manifest ML (sem CSV sensível no Git): `machine-learning/data/export_manifest.json`.

---

*Última atualização: consolidado automaticamente para fechamento do planejamento (entrega académica).*
