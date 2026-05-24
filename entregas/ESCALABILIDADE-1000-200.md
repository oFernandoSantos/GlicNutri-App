# Escalabilidade GlicNutri — 1000 pacientes / 200 profissionais

## Capacidade alvo

| Recurso | Volume |
|---------|--------|
| Pacientes na plataforma | ~1.000 |
| Nutricionistas | ~200 |
| Pacientes por nutricionista (pico) | até ~500 |

## O que foi implementado no app

### Banco (migration `20260526000100_escalabilidade_indices_rpcs.sql`)

- Índices em `paciente`, `consulta`, `mensagem_chat`, `alerta_clinico`
- RPC `contar_resumo_chat_nutri` — métricas de chat em **1 query**
- RPC `contar_pacientes_nutricionista` — total de vínculos em **1 query**

### Backend / serviços

- Listas de pacientes: colunas enxutas (sem `select *`), limite 500/nutri, chunks de 80 IDs
- Inbox de chat: RPC em lotes de 60 pacientes; função `fetchNutritionistChatInboxForPatientIds` para páginas
- Cache com chave por conjunto de IDs + LRU (máx. 100 entradas experiência, 40 inbox)
- Relatórios: máximo 80 pacientes por geração, lotes de 2
- Dashboard nutri: contagens filtradas por `id_nutricionista_uuid`

### Telas

- **Mensagens (nutri):** lista abre rápido; prévias de chat em lotes de 40; realtime atualiza só o paciente afetado
- **Início (nutri):** não carrega inbox inteiro; usa RPC de resumo
- **Início (paciente):** carga `homeOnly` (já aplicada antes)

## Deploy obrigatório

```bash
supabase db push
# ou aplicar manualmente as migrations em ordem, incluindo:
# - 20260525000100_chat_inbox_preview_rpc.sql
# - 20260526000100_escalabilidade_indices_rpcs.sql
```

## Próximos passos (produção)

1. **Supabase Pro** + connection pooling (PgBouncer) para picos de 200 usuários simultâneos
2. **RLS real** por `auth.uid()` (hoje há políticas abertas em algumas tabelas)
3. **Relatório carteira** via job assíncrono (Edge Function + fila), não no celular
4. **Paginação server-side** da lista de pacientes com busca SQL (`ILIKE`)
5. **Realtime** Supabase só na conversa ativa, não em listas inteiras
6. Monitoramento: slow queries, `pg_stat_statements`, alertas de CPU no projeto Supabase

## Estimativa de carga (ordem de grandeza)

- 200 nutris online: ~200 req/s pico leve (com cache 20–120s) → viável no Pro com índices
- 1000 pacientes ativos: glicemia/refeições indexadas; home com 7 leituras + app state → OK
- Gargalo restante: nutri com 300+ pacientes abrindo **Relatórios** ou **todos** no chat de uma vez
