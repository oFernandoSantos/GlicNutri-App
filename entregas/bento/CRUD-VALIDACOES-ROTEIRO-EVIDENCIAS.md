# CRUD + Validações — roteiro e evidências (Bento)

Objetivo: transformar “tem no código” em “tenho evidência” para:
- CRUD completo (cadastro/consulta/edição/exclusão lógica)
- validações (CPF/CEP/e-mail/obrigatórios)

## Onde está no código

- Cadastro (usuário/paciente): `src/telas/autenticacao/TelaCadastro.js`
- Gestão de pacientes (nutri): `src/telas/nutricionista/TelaPacientesNutricionista.js`
- Perfil paciente: `src/telas/paciente/TelaPerfilPaciente.js`
- Persistência / regras: `src/servicos/servicoDadosPaciente.js`
- Verificação de e-mail: `src/servicos/servicoVerificacaoEmail.js`

## Roteiro de demo (prints sugeridos)

### Parte 1 — Criar (Create)

1) Abrir tela **Cadastro**.
2) Tentar salvar com campo obrigatório vazio → **print do erro/validação**.
3) Preencher dados válidos → **print de sucesso** (ou redirecionamento).

**Prints mínimos**:
- “Erro de validação” (campo obrigatório)
- “Cadastro concluído” (ou usuário criado no Supabase)

### Parte 2 — Consultar (Read)

1) Logar como nutricionista.
2) Abrir **Gerenciar pacientes**.
3) Buscar um paciente pelo nome/CPF/e-mail (se existir busca).

**Print mínimo**:
- Lista de pacientes carregada

### Parte 3 — Editar (Update)

1) Selecionar paciente.
2) Alterar um campo simples (telefone, cidade, objetivo).
3) Salvar e reabrir para confirmar persistência.

**Print mínimo**:
- Tela de edição antes/depois (ou confirmação)

### Parte 4 — Excluir (Delete lógico)

Se o app usar exclusão lógica:
1) Excluir/arquivar paciente (fluxo existente).
2) Confirmar que não aparece como “ativo”, mas fica rastreável.

**Print mínimo**:
- Confirmação de exclusão/arquivamento

> Observação: exclusão física de glicemia/medicação não é exposta por design; o planejamento registra essa decisão.

## Validações (o que provar)

Escolha pelo menos 2 validações para printar:

- **E-mail**: formato inválido → erro; formato válido → segue.
- **CPF**: formato inválido → erro; formato válido → segue.
- **CEP**: inválido → erro/alerta; válido → segue.

Se existir verificação por código (e-mail):
- print da etapa de solicitação do código (sem mostrar código real).

## Checklist rápido (para marcar)

- [ ] Create: bloqueia campo obrigatório vazio
- [ ] Create: salva cadastro com sucesso
- [ ] Read: lista pacientes (nutri/admin)
- [ ] Update: salva e persiste alteração
- [ ] Delete lógico: paciente é arquivado/oculto
- [ ] Validação 1 (e-mail/CPF/CEP) com print
- [ ] Validação 2 (e-mail/CPF/CEP) com print

