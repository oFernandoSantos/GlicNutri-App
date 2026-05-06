# Usabilidade + Relatórios/Gráficos — prints e texto pronto (Bento)

Objetivo: “fechar” os requisitos de **usabilidade** e **relatórios/gráficos** com:
- quais telas printar
- um texto curto pronto para colar no Word/slides

## Telas recomendadas para print (3–4 prints)

1) **Paciente — Início (painel)**  
   - Arquivo: `src/telas/paciente/TelaInicioPaciente.js`  
   - O que mostra: status de glicose, tempo na meta, tendências e ações rápidas.

2) **Paciente — Monitoramento (glicose)**  
   - Arquivo: `src/telas/paciente/TelaMonitoramentoPaciente.js`  
   - O que mostra: leituras e acompanhamento do paciente (fluxo clínico principal).

3) **Nutricionista — Gerenciar pacientes**  
   - Arquivo: `src/telas/nutricionista/TelaPacientesNutricionista.js`  
   - O que mostra: carteira ativa, indicadores e lista para gestão.

4) **Admin — Painel/Relatórios** (se disponível)  
   - Arquivo: `src/telas/admin/TelaHomeAdmin.js`  
   - O que mostra: indicadores administrativos (gestão e auditoria/logs).

## Texto pronto — Usabilidade (colar no Word)

O GlicNutri foi desenhado para reduzir atrito no registro diário do paciente diabético, priorizando ações rápidas e navegação simples. A Home do paciente apresenta um painel com o estado atual (glicose), indicadores resumidos e atalhos para as tarefas mais frequentes (registro de refeição, glicose e medicação). O sistema separa claramente os perfis (paciente, nutricionista e admin), evitando sobrecarga de informações e mantendo cada jornada focada no objetivo do usuário.

Além disso, a interface utiliza componentes consistentes (cores, cards e botões) e feedbacks de erro/sucesso para orientar o preenchimento correto dos dados. Isso melhora a confiabilidade do banco e a experiência do usuário durante o acompanhamento clínico.

## Texto pronto — Relatórios e gráficos (colar no Word)

O projeto inclui relatórios e visualizações para apoiar decisões do nutricionista e do paciente. No paciente, há painéis e tendências (ex.: leituras recentes e estado glicêmico) que ajudam a identificar períodos de risco. Para o nutricionista e o administrador, o sistema apresenta indicadores agregados (carteira de pacientes, cadastros completos e visão geral do sistema), permitindo monitorar o uso e a qualidade dos registros.

Essas visualizações funcionam como relatórios operacionais do dia a dia, fornecendo uma visão rápida do estado do acompanhamento e facilitando a tomada de decisão clínica e de gestão.

