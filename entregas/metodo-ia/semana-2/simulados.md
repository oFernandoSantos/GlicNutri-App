# Simulados — perguntas estilo professor Bento

Respostas objetivas para ensaio oral.

---

**P1:** Onde ficam fisicamente os logs de auditoria neste projeto?

**R:** No **Supabase Storage**, bucket **`audit-logs`**, arquivos JSON sob o prefixo `app/`, gerados por `registrarLogAuditoria` em `servicoAuditoria.js`.

---

**P2:** Por que não usar tabela SQL para auditoria nesta entrega?

**R:** Foi adotado **Storage por decisão de projeto**: segregação simples, sem migrations novas, e compatível com a listagem já usada em `listarEventosAuditoria` e nas telas admin.

---

**P3:** O que acontece se o upload do log falhar?

**R:** O erro é tratado dentro de `registrarLogAuditoria`; o fluxo principal (login, salvamento) **não** é interrompido.

---

**P4:** Como garantem que senhas não vão parar no log?

**R:** Sanitização em `buildSafeDetails` remove campos sensíveis; nos fluxos de login não passamos senha para `details`; refeição IA não inclui URL de foto nem lista completa de alimentos.

---

**P5:** Como distinguir login de paciente, nutricionista e admin nos eventos?

**R:** Pelas **ações** (`login_sucesso_paciente`, `login_sucesso_nutricionista`, `login_sucesso_admin`) e pelo **`actorType`**, com inferência corrigida para admin (`id_admin_uuid`, `tipo_perfil`).

---

**P6:** O login com Google gera dois logs a cada abertura do app?

**R:** Não intencionalmente: o log de sucesso OAuth só dispara no fluxo explícito do botão (`auditLogin: true`). Restaurar sessão salva não duplica o evento.

---

**P7:** Qual evidência você mostraria na defesa?

**R:** Print da **Tela Auditoria** com eventos recentes + opcionalmente um arquivo JSON aberto no dashboard do Supabase mostrando `action`, `actorType`, `createdAt`, `status`.

---

## Simulado — perguntas estilo professor Thayse (ML / dados)

**P8:** De onde vêm os dados do modelo paciente-dia?

**R:** Agregação SQL no Postgres (Supabase): leituras de glicemia, refeições IA e medicação por `patient_id` e dia, exportadas pelo script `machine-learning/scripts/export_supabase_csv.py` para CSV.

**P9:** Por que não usar Pima Indians neste pipeline principal?

**R:** O requisito pede **dados do sistema GlicNutri**; Pima/Kaggle ficam apenas como referência histórica isolada, não como dataset oficial da monografia.

**P10:** Se o export falhar na véspera da entrega, qual plano B?

**R:** Demonstrar com `sample_glicnutri_patient_day.csv` + manifest/hash documentados, declarando limitações e volume real pendente — mantendo o notebook e a API como evidência de pipeline.
