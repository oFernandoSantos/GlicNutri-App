# Demo — reunião Semana 2 (10/05)

Roteiro sugerido (~15 minutos + perguntas). Índice dos artefactos: [`README-ENTREGA-SEMANA-2.md`](README-ENTREGA-SEMANA-2.md).

## 1. Dados (Thayse) — ~5 min

- Mostrar [`machine-learning/EXPORT_CSV.md`](../machine-learning/EXPORT_CSV.md) e comando com `--manifest` (sem expor `DATABASE_URL`).
- Se existir: `export_manifest.json` ou linha da tabela “Registo de execução”.
- Abrir [`machine-learning/notebooks/glicnutri_ml_pipeline.ipynb`](../machine-learning/notebooks/glicnutri_ml_pipeline.ipynb) nas células de **validação** e **EDA** (histograma / dispersão).

## 2. App (Bento) — ~5 min

Dois fluxos obrigatórios:

1. **Login** → **Registro de glicemia** → **Admin → Auditoria** (evento correspondente visível).
2. **Login nutricionista** OU **recuperação de senha** (escolher o mais estável no ambiente de demo).

Referência de eventos: [`bento/semana-2-auditoria/roteiro-testes.md`](bento/semana-2-auditoria/roteiro-testes.md).

## 3. Pendências para Semana 3 — ~3 min

Conforme [`Planejamento_Final_Atividades_GlicNutri_Ajustado.md`](../Planejamento_Final_Atividades_GlicNutri_Ajustado.md) (secção 6):

- Treinar e avaliar os **quatro pipelines** com volume real suficiente.
- Métricas consolidadas e figuras para escolha do modelo final.
- Refinar pré-processamento no notebook após inspeção dos dados reais.

## Checklist pré-reunião

- [ ] Checklist [`checklist-semana-2-fluxos-app.md`](checklist-semana-2-fluxos-app.md) revisado.
- [ ] Plano B declarado se CSV real não estiver disponível (sample + limitações).
