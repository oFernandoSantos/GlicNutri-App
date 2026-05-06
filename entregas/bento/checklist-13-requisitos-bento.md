# Checklist — 13 requisitos (Professor Bento)

Objetivo: ter um checklist **1:1** (requisito → evidência) para não faltar nada na entrega/apresentação.

> Este checklist aponta para arquivos e telas **do repositório**. As evidências visuais (prints) devem ser capturadas na apresentação/ZIP quando solicitado.

## Evidências já prontas (Semana 2 — auditoria)

- Pasta com evidências visuais: `entregas/bento/semana-2-auditoria/`
  - Documento: `entregas/bento/semana-2-auditoria/evidencias-auditoria.md`
  - Checklist: `entregas/bento/semana-2-auditoria/checklist-auditoria.md`
  - Status: `entregas/bento/semana-2-auditoria/STATUS-SEMANA-2.md`
  - Prints: `entregas/bento/semana-2-auditoria/prints/`

## Tabela oficial (13 requisitos)

| # | Requisito | Status | Evidência no código/telas | Evidência sugerida (print/demo) |
|---:|---|:--:|---|---|
| 1 | Documentação inicial | [~] | Planejamento: `Planejamento_Final_Atividades_GlicNutri_Ajustado.md`; resumo: `entregas/bento/RESUMO-REQUISITOS-BENTO.md` | Mostrar índice do repositório + planejamento atualizado (Word final ainda é externo) |
| 2 | Banco de dados (tabelas, chaves, relacionamentos) | [~] | Supabase migrations: `supabase/migrations/`; resumo: `entregas/bento/RESUMO-REQUISITOS-BENTO.md` | Print do Supabase (tables / relationships) + (opcional) diagrama ER (print externo) |
| 3 | Autenticação | [x] | `App.js`, `src/telas/autenticacao/TelaLogin.js`, `src/servicos/configSupabase.js` | Print login OK + logout + (opcional) sessão persistida |
| 4 | CRUD completo (cadastro/edição/consulta + exclusão lógica) | [~] | `src/telas/autenticacao/TelaCadastro.js`, `src/telas/nutricionista/TelaPacientesNutricionista.js`, `src/servicos/servicoDadosPaciente.js`; roteiro: `entregas/bento/CRUD-VALIDACOES-ROTEIRO-EVIDENCIAS.md` | Print criando/alterando paciente + evidência de exclusão lógica (`excluido`) |
| 5 | Validações de dados (CPF/CEP/e-mail, obrigatórios) | [~] | `src/servicos/servicoVerificacaoEmail.js`, telas de cadastro/edição; roteiro: `entregas/bento/CRUD-VALIDACOES-ROTEIRO-EVIDENCIAS.md` | Prints de erro de validação + sucesso após corrigir |
| 6 | Fluxo do sistema (navegação e uso real) | [x] | Rotas em `App.js`, telas em `src/telas/` | Demo: login → home → diário/monitoramento → salvar dados |
| 7 | Usabilidade (UI/UX) | [~] | Componentes/tema: `src/temas/`, `src/componentes/`; texto/prints: `entregas/bento/USABILIDADE-RELATORIOS-PRINTS-TEXTO.md` | Prints de 2–3 telas-chave + justificativa curta |
| 8 | Auditoria (registro de ações e logs) | [x] | `src/servicos/servicoAuditoria.js`, telas admin `src/telas/admin/*` | Prints já em `entregas/bento/semana-2-auditoria/prints/` |
| 9 | Relatórios e gráficos | [~] | Painéis: `src/telas/admin/TelaHomeAdmin.js`, relatórios em telas paciente; texto/prints: `entregas/bento/USABILIDADE-RELATORIOS-PRINTS-TEXTO.md` | Print do painel/indicadores + explicação |
| 10 | Organização do código | [x] | Estrutura `src/telas/`, `src/servicos/`, `src/componentes/` | Mostrar árvore de pastas e explicar separação |
| 11 | Atualização da documentação | [x] | Planejamento atualizado + pasta `entregas/` | Mostrar checklist/README de entrega e planejamento |
| 12 | Entrega final (ZIP/slides/vídeo) | [~] | Checklist: `entregas/PACOTE-FINAL-CHECKLIST.md` | Checklist final + pasta/zip com evidências |
| 13 | Critérios de avaliação (funcionamento/qualidade/apresentação) | [~] | Checklists em `entregas/`; pacote final: `entregas/PACOTE-FINAL-CHECKLIST.md` | Ensaiar demo e usar este checklist como “script” |

## Próximos passos (para fechar os [ ])

- **Requisito 2**: gerar um print do Supabase (tabelas + chaves) e anexar no pacote final.
- **Requisitos 4–5**: fazer 1 demo completa (cadastro/edição + validações) e salvar prints.
- **Requisitos 7–9**: selecionar 3 telas e 1 painel/relatório para justificar “usabilidade” e “relatórios”.
- **Requisitos 12–13**: montar ZIP + slides + vídeo (fora do repositório).

