# Checklist — Auditoria (Semana 2 — Bento)

**Legenda de validação (maio/2026):** os itens abaixo foram marcados após **(1)** rastreamento do roteiro em [`roteiro-testes.md`](roteiro-testes.md) frente ao código em `GlicNutri/src` e **(2)** conferência de que cada `action` / entidade existe em chamadas a `registrarLogAuditoria`. Isso comprova a **implementação**. O documento [`evidencias-auditoria.md`](evidencias-auditoria.md) descreve **execução real** e referencia PNG em `prints/`; **completar** a evidência académica exige **versionar** esses PNG no repositório (ver secção “Semana 2 — estado da evidência” abaixo).

## Cadastro

- [x] Cadastro de paciente gera evento no Storage (ação `paciente_cadastrado`, entidade cadastro) — [`TelaCadastro.js`](../../../GlicNutri/src/telas/autenticacao/TelaCadastro.js).
- [x] Cadastro de nutricionista gera evento com `actorType` nutricionista — ação `nutricionista_cadastrado`.

## Login

- [x] Login paciente (e-mail/senha) com sucesso gera `login_sucesso_paciente`, status sucesso — [`TelaLogin.js`](../../../GlicNutri/src/telas/autenticacao/TelaLogin.js).
- [x] Login nutricionista com sucesso gera `login_sucesso_nutricionista`, status sucesso.
- [x] Login administrador com sucesso gera `login_sucesso_admin`, `actorType` admin (e sessão admin persistida).
- [x] Login Google (paciente) com sucesso gera `login_sucesso_google`, origem `login_google` (`auditLogin: true` no fluxo do botão).
- [x] Falha de credencial gera `login_falha_credencial` sem dados de senha nos detalhes (`buildSafeDetails` remove campos sensíveis).
- [x] Paciente excluído tentando entrar gera `login_falha_paciente_excluido`.
- [x] Erro inesperado no fluxo de login gera `login_falha_erro` (detalhes sem stack nem senha).

## Registros clínicos e rotina

- [x] Registro de glicemia manual gera evento na entidade `registro_glicemia_manual` — ação `glicemia_manual_cadastrada` — [`servicoDadosPaciente.js`](../../../GlicNutri/src/servicos/servicoDadosPaciente.js).
- [x] Registro de medicação/insulina gera evento na entidade `registro_medicacao` — ações `medicacao_cadastrada` / `insulina_cadastrada`.
- [x] Refeição IA salva gera `refeicao_ia_registrada`, com `paciente_id` e totais agregados (sem URL de imagem nem lista completa de alimentos; `foto_url` sanitizada globalmente) — [`servicoRefeicaoIA.js`](../../../GlicNutri/src/servicos/servicoRefeicaoIA.js).

## Edição e exclusão lógica (nutricionista / paciente)

- [x] Edição de paciente pelo nutricionista gera evento de atualização — `paciente_atualizado_por_nutricionista` — [`TelaPacientesNutricionista.js`](../../../GlicNutri/src/telas/nutricionista/TelaPacientesNutricionista.js).
- [x] Exclusão lógica de paciente gera evento — `paciente_excluido_logicamente`.
- [x] Ocultar glicemia/medicação/refeição no histórico gera evento correspondente — `glicemia_ocultada_historico`, `medicacao_ocultada_historico` / `insulina_ocultada_historico`, `alimentacao_ocultada_historico`.

## Recuperação de senha

- [x] Fluxo de solicitação/reenvio e confirmação gera eventos agregados (sem e-mail/código em `details`) — ações `recuperacao_senha_codigo_solicitado`, `recuperacao_senha_codigo_reenviado`, `recuperacao_senha_redefinicao_ok`, `recuperacao_senha_confirmacao_falha` — [`TelaRecuperarSenha.js`](../../../GlicNutri/src/telas/autenticacao/TelaRecuperarSenha.js).

## Painel administrativo

- [x] Tela **Auditoria** lista eventos recentes do bucket via `listarEventosAuditoria` — [`TelaAuditoriaAdmin.js`](../../../GlicNutri/src/telas/admin/TelaAuditoriaAdmin.js).
- [x] Filtro **Admins** restringe por `actorType === 'admin'` no mesmo serviço de listagem.
- [x] Resumo na Home Admin inclui contagem relacionada a audit (`administradores` em `buildSummary` / cartões do dashboard) — [`TelaHomeAdmin.js`](../../../GlicNutri/src/telas/admin/TelaHomeAdmin.js).
- [x] **Logout** do admin gera `logout_admin` (origem `admin_home`) — `TelaHomeAdmin.js`.
- [x] Após carregar eventos na tela **Auditoria** (perfil admin), regista `admin_consulta_auditoria` com resumo de contagem — `TelaAuditoriaAdmin.js`.
- [x] Após carregar logs na tela **Observabilidade**, regista `admin_consulta_logs_sistema` — `TelaLogsSistemaAdmin.js`.

## LGPD e segurança dos logs

- [x] Confirmado no código: `buildSafeDetails` remove senha, tokens e URLs de foto; refeição IA registra apenas campos agregados.
- [x] Falha ao gravar log não bloqueia login principal: em login, chamadas a `registrarLogAuditoria` não são `await` (fire-and-forget); a função retorna `null` em erro sem lançar exceção — [`servicoAuditoria.js`](../../../GlicNutri/src/servicos/servicoAuditoria.js).

---

## Semana 2 — estado da evidência (maio/2026)

| Critério | Situação |
|----------|----------|
| Rastreio código ↔ `registrarLogAuditoria` | Completo (checklist acima + roteiro) |
| Documento de evidências (`evidencias-auditoria.md`) | Atualizado para **execução real** (metadados + secção de PNG) |
| Ficheiros PNG em `prints/` (7 nomes referenciados no md) | **Pendente** — validação no repo: ainda não versionados; só existem SVG legados até inclusão dos PNG |
| Execução manual no Supabase do grupo | Confirmável quando os PNG (Storage + app) estiverem no repositório ou anexados à entrega |

**Nota:** A Semana 2 no planejamento integra também CSV/notebook ML e roteiros de fluxo geral do app; esses itens estão documentados em [`Planejamento_Final_Atividades_GlicNutri_Ajustado.md`](../../../GlicNutri/Planejamento_Final_Atividades_GlicNutri_Ajustado.md) (secção 6 e checklist §11).
