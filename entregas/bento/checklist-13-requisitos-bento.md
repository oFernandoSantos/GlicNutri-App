# Checklist — 13 requisitos (Professor Bento)

Objetivo: ter um checklist **1:1** (requisito → evidência) para não faltar nada na entrega/apresentação.

> **Atualização maio/2026:** todos os requisitos têm **evidência no repositório** (código, Markdown ou prints). O que permanece **manual** é apenas anexar ao ZIP da disciplina capturas adicionais se o professor pedir (além das já existentes) e montar o ficheiro `.pptx` a partir do roteiro.

## Evidências já prontas (Semana 2 — auditoria)

- Pasta com evidências visuais: `entregas/bento/semana-2-auditoria/`
  - Documento: `entregas/bento/semana-2-auditoria/evidencias-auditoria.md`
  - Checklist: `entregas/bento/semana-2-auditoria/checklist-auditoria.md`
  - Status: `entregas/bento/semana-2-auditoria/STATUS-SEMANA-2.md`
  - Prints: `entregas/bento/semana-2-auditoria/prints/`

## Tabela oficial (13 requisitos)

| # | Requisito | Status | Evidência no código/telas | Evidência sugerida (print/demo) |
|---:|---|:--:|---|---|
| 1 | Documentação inicial | [x] | `Planejamento_Final_Atividades_GlicNutri_Ajustado.md`; `entregas/bento/RESUMO-REQUISITOS-BENTO.md`; `entregas/PACOTE-MONTAGEM.md` | Word TCC + `WordFinalGlicNutri-ATUALIZADO.docx` / `entregas/WordFinalGlicNutri-ATUALIZACOES-PARA-COLAR.md` |
| 2 | Banco de dados (tabelas, chaves, relacionamentos) | [x] | `supabase/migrations/`; `entregas/bento/BANCO-DE-DADOS-ER-EVIDENCIAS.md`; diagrama `entregas/diagrama-glicnutri-a4-vertical.pdf` | Print Supabase (opcional no pacote) + ER do repositório |
| 3 | Autenticação | [x] | `App.js`, `src/telas/autenticacao/TelaLogin.js`, `src/servicos/configSupabase.js` | Prints `login_*.png` em `entregas/bento/semana-2-auditoria/prints/` |
| 4 | CRUD completo (cadastro/edição/consulta + exclusão lógica) | [x] | `TelaCadastro.js`, `TelaPacientesNutricionista.js`, `servicoDadosPaciente.js`; roteiro `entregas/bento/CRUD-VALIDACOES-ROTEIRO-EVIDENCIAS.md` (exclusão lógica `excluido`) | Demo + prints extras no ZIP se exigido |
| 5 | Validações de dados (CPF/CEP/e-mail, obrigatórios) | [x] | `servicoVerificacaoEmail.js`, telas de cadastro/edição; mesmo roteiro CRUD | Prints de validação (opcional no pacote) |
| 6 | Fluxo do sistema (navegação e uso real) | [x] | `App.js`, `src/telas/paciente/*`, `nutricionista/*`, `admin/*` | Demo + prints Semana 2 (login + glicemia) |
| 7 | Usabilidade (UI/UX) | [x] | `src/temas/`, `src/componentes/`; texto `entregas/bento/USABILIDADE-RELATORIOS-PRINTS-TEXTO.md` | 3 telas sugeridas no mesmo ficheiro |
| 8 | Auditoria (registro de ações e logs) | [x] | `servicoAuditoria.js`, `src/telas/admin/*` | Prints em `semana-2-auditoria/prints/` |
| 9 | Relatórios e gráficos | [x] | `TelaHomeAdmin.js`, telas paciente (painéis); texto em `USABILIDADE-RELATORIOS-PRINTS-TEXTO.md` | Print painel admin / início paciente |
| 10 | Organização do código | [x] | `src/telas/`, `src/servicos/`, `src/componentes/` | Árvore de pastas no IDE |
| 11 | Atualização da documentação | [x] | `Planejamento_Final_Atividades_GlicNutri_Ajustado.md` (secção 11 atualizada); pasta `entregas/` | Checklists e `PACOTE-MONTAGEM.md` |
| 12 | Entrega final (ZIP/slides/vídeo) | [x] | `entregas/PACOTE-FINAL-CHECKLIST.md`, `PACOTE-MONTAGEM.md`, `scripts/build-zip-entrega.ps1`, `slides-roteiro.md` | Executar script ZIP; gravar vídeo; exportar `.pptx` |
| 13 | Critérios de avaliação (funcionamento/qualidade/apresentação) | [x] | `entregas/ENSAIO-FINAL-CHECKLIST.md` + checklists em `entregas/` | Ensaiar demo antes da banca |

## Próximos passos (apenas entrega física / grupo)

1. Correr `.\scripts\build-zip-entrega.ps1` e juntar ao pacote o CSV exportado **se** a disciplina exigir ficheiro local.
2. Gravar vídeo segundo `entregas/PACOTE-FINAL-CHECKLIST.md` §3.
3. Montar `.pptx` a partir de `entregas/slides-roteiro.md`.
4. Ensaio: `entregas/ENSAIO-FINAL-CHECKLIST.md`.
