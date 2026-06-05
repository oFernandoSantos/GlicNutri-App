-- Revoga overloads legados sem p_token_sessao (chat + refeicao) para forcar RPC seguras.

REVOKE EXECUTE ON FUNCTION public.listar_mensagens_chat(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enviar_mensagem_chat(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.listar_mensagens_chat_inbox(uuid, uuid[], integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.listar_refeicoes_ia_paciente(uuid, integer) FROM PUBLIC, anon, authenticated;
