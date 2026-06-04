/**
 * Abre o chat do nutricionista com o paciente e leva o contexto de um registro.
 */
export function abrirChatNutriComRegistro(
  navigation,
  { usuarioLogado, pacienteId, registroContext }
) {
  if (!navigation?.navigate || !pacienteId || !registroContext) return false;

  navigation.navigate('NutricionistaMensagens', {
    usuarioLogado,
    pacienteId,
    registroContext,
  });
  return true;
}
