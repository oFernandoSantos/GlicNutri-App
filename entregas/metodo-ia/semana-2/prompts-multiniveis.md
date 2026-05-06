# Prompts multiníveis — projeto GlicNutri (Semana 2)

Aplicação ao tema **auditoria em Storage** (sem tabela SQL dedicada).

## Nível 1 — Lembrete (o que fazer)

> Liste, em uma frase, onde o app chama `registrarLogAuditoria` e qual bucket do Supabase recebe os arquivos.

## Nível 2 — Execução (como testar)

> Monte um mini-roteiro: login paciente → registrar glicemia → salvar refeição IA → abrir painel Admin Auditoria. Para cada passo, diga qual **action** esperar no JSON do Storage.

## Nível 3 — Crítica (limitações)

> Explique por que logs em arquivo JSON no Storage não substituem um SIEM corporativo, mas ainda atendem evidência acadêmica de rastreabilidade.

## Nível 4 — Extensão (sem implementar)

> Proponha uma política de retenção (dias) e mascaramento adicional para e-mails em logs, sem alterar o código agora.

---

### Respostas de referência (curtas)

- **Nível 1:** Chamadas em cadastro, dados do paciente, login, refeição IA, etc.; bucket `audit-logs`, prefixo `app/`.
- **Nível 2:** Ex.: `login_sucesso_paciente` → `glicemia_manual_cadastrada` → `refeicao_ia_registrada`; conferir em **Auditoria** admin.
- **Nível 3:** Sem indexação relacional centralizada, dependência de listagem por prefixo/data, mas prova de evento com timestamp e ator.
- **Nível 4:** Ex.: retenção 90 dias no bucket; hash ou domínio parcial para e-mail nos `details` se o professor exigir anonimização extra.

---

## Tema ML — export CSV e notebook (Semana 2)

| Nível | Pergunta-guia |
|-------|----------------|
| **1 — Contexto** | Qual é o objetivo do agregado paciente-dia e que tabelas alimentam o SQL em `export_supabase_csv.py`? |
| **2 — Estado** | Caminho do CSV gerado, número de linhas, variável `DATABASE_URL` configurada? Erro ao ler no notebook? |
| **3 — Tarefa** | Pedir revisão de **uma** coisa: só validação de colunas, só imputação, ou só histograma EDA. |
| **4 — Formato** | Resposta em passos numerados + hipótese de causa raiz antes de sugerir mudança no SQL. |
