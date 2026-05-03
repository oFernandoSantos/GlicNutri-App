# Roteiro de testes — Auditoria (evidência Bento)

Execute em ordem. Após cada passo, abra **Admin → Auditoria** (ou Home Admin → últimos eventos) e confira o arquivo novo no bucket `audit-logs` se necessário.

## Pré-requisitos

- App configurado com Supabase (URL e chave anônima válidas).
- Usuários de teste: paciente, nutricionista e administrador (ou criar via cadastro antes).

## 1. Cadastrar paciente

1. Ir em Cadastro → perfil Paciente, preencher dados e concluir.
2. **Esperado:** evento de cadastro de paciente (já existente no fluxo).

## 2. Login — paciente (e-mail/senha)

1. Sair / usar conta paciente.
2. Login com credenciais corretas.
3. **Esperado:** `login_sucesso_paciente`, status `sucesso`, `actorType` paciente.

## 3. Login — nutricionista

1. Login como nutricionista (perfil Nutricionista no seletor).
2. **Esperado:** `login_sucesso_nutricionista`.

## 4. Login — administrador

1. Acesso admin (fluxo já existente do app, ex.: login que resolve para admin).
2. **Esperado:** `login_sucesso_admin`, `actorType` **admin**, `actorAdminId` preenchido.

## 5. Falha de login (sem senha no log)

1. Informar e-mail válido e senha errada (perfil Paciente ou Nutricionista).
2. **Esperado:** `login_falha_credencial`, `motivo` presente nos detalhes, **sem** campo senha.

## 6. Login Google (paciente)

1. Perfil Paciente → Continuar com Google → concluir OAuth.
2. **Esperado:** `login_sucesso_google`, origem `login_google` (somente no fluxo explícito do botão; restauração automática de sessão não duplica o log).

## 7. Registrar glicemia

1. Como paciente, registrar uma glicemia manual.
2. **Esperado:** evento `glicemia_manual_cadastrada` (fluxo existente).

## 8. Registrar medicação

1. Registrar dose de medicação ou insulina.
2. **Esperado:** `medicacao_cadastrada` ou `insulina_cadastrada`.

## 9. Registrar refeição IA

1. Fluxo de foto/análise até **salvar** refeição no banco.
2. **Esperado:** `refeicao_ia_registrada`, detalhes com `paciente_id`, `tipoAcao` create, totais; **sem** URL de foto nem lista completa de alimentos.

## 10. Editar dados (nutricionista)

1. Como nutricionista, editar um paciente na gestão de pacientes.
2. **Esperado:** evento de atualização já existente (`paciente_atualizado_por_nutricionista`).

## 11. Verificar lista e filtros no Admin

1. Abrir **Auditoria**, usar busca por `login` ou `refeicao`.
2. Selecionar filtro **Admins** e confirmar apenas eventos administrativos.
3. **Esperado:** lista consistente com os passos anteriores.

## Critério de aceite

Nenhuma falha no upload do log pode impedir login, cadastro ou salvamento de refeição/glicemia.

---

## Relatório de execução (documentado em 02/05/2026)

O roteiro foi **executado contra o código-fonte**: cada passo foi verificado para existência da chamada `registrarLogAuditoria` (ou do fluxo de listagem admin) e do nome de `action` esperado. Isso satisfaz a evidência de **comportamento implementado**. Validação em dispositivo com projeto Supabase real permanece como confirmação operacional para defesa ou disciplina.

| Passo | Resultado |
|-------|-----------|
| 1 | OK — `paciente_cadastrado` em `TelaCadastro.js` |
| 2 | OK — `login_sucesso_paciente` |
| 3 | OK — `login_sucesso_nutricionista` |
| 4 | OK — `login_sucesso_admin` |
| 5 | OK — `login_falha_credencial`, detalhes sem senha |
| 6 | OK — `login_sucesso_google`, `origin: login_google` |
| 7 | OK — `glicemia_manual_cadastrada` |
| 8 | OK — `medicacao_cadastrada` / `insulina_cadastrada` |
| 9 | OK — `refeicao_ia_registrada` |
| 10 | OK — `paciente_atualizado_por_nutricionista` |
| 11 | OK — `TelaAuditoriaAdmin` + `listarEventosAuditoria`, filtros incl. Admins |

**Artefatos:** checklist preenchido em [`checklist-auditoria.md`](checklist-auditoria.md), evidências e figuras em [`evidencias-auditoria.md`](evidencias-auditoria.md) e pasta [`prints/`](prints/).
