# Roteiro de slides — GlicNutri (entrega / banca)

Montar o ficheiro `.pptx` a partir deste roteiro (1 slide por bloco, ajustar títulos).

| # | Título sugerido | Conteúdo (bullets) | Evidência / print |
|---|-----------------|-------------------|-------------------|
| 1 | Problema e solução | DM e lacuna entre dados e nutrição; GlicNutri integra registo, plano e acompanhamento | Logo ou capa do app |
| 2 | Arquitetura | Cliente Expo/React Native; Supabase (Auth, Postgres, Storage); ML Python + FastAPI (`/predict`) | Diagrama simples (caixas) ou `entregas/diagrama-glicnutri-a4-vertical.pdf` |
| 3 | Base de dados | ER / tabelas; migrations versionadas | Print Supabase Table editor + figura ER |
| 4 | Fluxo — paciente | Login → início → monitoramento / registo glicemia | Prints `TelaInicioPaciente`, `TelaMonitoramentoPaciente` |
| 5 | Fluxo — nutricionista e admin | Pacientes, consultas; painel admin e auditoria | `TelaPacientesNutricionista`, `TelaHomeAdmin`, prints Semana 2 |
| 6 | Machine Learning | Dataset paciente-dia; 4 tarefas; manifest; API | Notebook métricas + tela «Previsão (IA)» + chamada `/predict` |
| 7 | LGPD e segurança | Dados sensíveis; minimização; sem credenciais no Git | Texto de `entregas/LGPD-TEXTO-CURTO.md` (resumo) |
| 8 | Encerramento | Riscos (dados clínicos, demo local); próximos passos (validação, CGM) | Uma frase de fecho |

**Referências rápidas:** `entregas/thayse/RESUMO-ENTREGA-ML.md`, `entregas/bento/checklist-13-requisitos-bento.md`.
