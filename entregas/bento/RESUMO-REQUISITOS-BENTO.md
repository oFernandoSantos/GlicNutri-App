# Resumo — Requisitos do Bento (1–13) com evidências no repo

Este arquivo consolida **o que já existe no projeto** e **como provar** cada requisito do professor Bento na entrega/apresentação.

> Observação: alguns itens dependem de evidências externas (prints, slides, vídeo, Word). Aqui deixamos **roteiro e links** para facilitar.

## 1) Documentação inicial

- **Evidência no repo**: `Planejamento_Final_Atividades_GlicNutri_Ajustado.md`
- **O que ainda é externo**: transformar este conteúdo em **Word final** (padronizado).
- **Como provar**: abrir o planejamento e mostrar tabela/cronograma + índice da pasta `entregas/`.

## 2) Banco de dados (tabelas, chaves e relacionamentos)

- **Evidência no repo**: `supabase/migrations/`
- **Como provar**:
  - print da aba “Table editor” do Supabase (tabelas e chaves)
  - print dos relacionamentos principais (FKs).

## 3) Autenticação (login + sessão)

- **Evidência no código**:
  - Rotas e sessão: `App.js`
  - Login: `src/telas/autenticacao/TelaLogin.js`
  - Supabase client: `src/servicos/configSupabase.js`
- **Como provar**: print login bem-sucedido + logout + (opcional) restauração de sessão.

## 4) CRUD completo (cadastro, consulta, edição, exclusão lógica)

- **Evidência no código**:
  - Cadastro: `src/telas/autenticacao/TelaCadastro.js`
  - Gestão nutricionista: `src/telas/nutricionista/TelaPacientesNutricionista.js`
  - Persistência: `src/servicos/servicoDadosPaciente.js`
- **Como provar**:
  - criar/editar paciente
  - demonstrar exclusão lógica (campo `excluido`), quando aplicável.

## 5) Validações de dados (CPF/CEP/e-mail, obrigatórios)

- **Evidência no código**:
  - Verificação de e-mail: `src/servicos/servicoVerificacaoEmail.js`
  - Telas de cadastro/edição: `src/telas/autenticacao/TelaCadastro.js`, `src/telas/nutricionista/TelaPacientesNutricionista.js`
- **Como provar**: prints de erro (campo inválido) + sucesso após correção.

## 6) Fluxo do sistema (navegação e uso real)

- **Evidência no código**:
  - Navegação/rotas: `App.js`
  - Paciente: `src/telas/paciente/*`
  - Nutricionista/Admin: `src/telas/nutricionista/*`, `src/telas/admin/*`
- **Como provar**: demo curta (login → home → diário/monitoramento → salvar).

## 7) Usabilidade (UI/UX)

- **Evidência no código**:
  - Componentes/tema: `src/componentes/`, `src/temas/`
- **Como provar**: prints de 2–3 telas-chave + explicação simples (por que é fácil de usar).

## 8) Auditoria (logs de ações)

- **Evidência no código**:
  - Serviço: `src/servicos/servicoAuditoria.js`
  - Telas admin: `src/telas/admin/TelaAuditoriaAdmin.js`, `TelaLogsSistemaAdmin.js`, `TelaHomeAdmin.js`
- **Evidência visual já pronta (Semana 2)**:
  - `entregas/bento/semana-2-auditoria/evidencias-auditoria.md`
  - `entregas/bento/semana-2-auditoria/prints/`

## 9) Relatórios e gráficos

- **Evidência no código**:
  - Painel admin: `src/telas/admin/TelaHomeAdmin.js`
  - Visualizações paciente: `src/telas/paciente/TelaInicioPaciente.js` (tendências/indicadores)
- **Como provar**: print do painel + explicação do que cada indicador significa.

## 10) Organização do código

- **Evidência no repo**: `src/` organizado por `telas/`, `servicos/`, `componentes/`, `temas/`, `dados/`.
- **Como provar**: mostrar árvore de pastas + explicar separação.

## 11) Atualização da documentação

- **Evidência no repo**:
  - `Planejamento_Final_Atividades_GlicNutri_Ajustado.md`
  - pasta `entregas/` (checklists/roteiros/resumos)

## 12) Entrega final (ZIP, slides, vídeo)

- **Fora do repo** (normalmente): ZIP final, slides e vídeo.
- **Como provar**: checklist final + abertura do ZIP com os arquivos.

## 13) Critérios de avaliação (ensaio/apresentação)

- **Evidência no repo**: checklists e roteiros em `entregas/`.
- **Como provar**: usar estes roteiros como script da demo e garantir que tudo roda no PC.

