# Chain-of-Thought — depuração export CSV / notebook

Use este roteiro ao pedir ajuda à IA ou ao debater em grupo **antes** de alterar SQL ou Python.

## Template de raciocínio explícito

1. **Estado observado** — Ex.: “Notebook falha com `KeyError: glucose_mean_mg_dl`” ou “Export devolve 0 linhas”.
2. **Hipóteses ordenadas** — Da mais provável à menos:
   - Janela `--days` não cobre datas onde há dados.
   - Colunas renomeadas na migration não refletidas no `EXPORT_SQL`.
   - Pacientes marcados `excluido = true` removem todas as linhas.
   - Pooler / timezone: `since_ts` vs `until_ts` interpretados em UTC vs local.
3. **Teste mínimo** — Um único passo comprovável (query `COUNT(*)` numa tabela-fonte, ou `head()` do CSV).
4. **Conclusão** — Aceitar ou refutar cada hipótese com evidência do passo 3.
5. **Mudança** — Só então propor patch no script, migration ou notebook.

## Prompt curto para o modelo

> Pensa passo a passo: lista hipóteses, não sugiras código até validares o schema esperado em `dataset-referencia-glicnutri.md`, depois propõe uma alteração única.

## Ligação ao projeto

- Script: [`machine-learning/scripts/export_supabase_csv.py`](../../../machine-learning/scripts/export_supabase_csv.py)
- Referência de colunas: [`machine-learning/dataset-referencia-glicnutri.md`](../../../machine-learning/dataset-referencia-glicnutri.md)
