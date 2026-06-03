import { mostrarToastPaciente } from '../servicos/servicoToastPaciente';

/**
 * Abre mensagens com profissional vinculado (nutri: chat; médico: aviso até canal dedicado).
 */
export function abrirMensagensProfissionalVinculado(
  navigation,
  { usuarioLogado, profissional, papel, vinculado }
) {
  if (!navigation?.navigate) return;

  if (!vinculado) {
    mostrarToastPaciente({
      tipo: 'aviso',
      texto: 'Profissional não vinculado',
      subtexto: 'Solicite acompanhamento para enviar mensagens.',
    });
    return;
  }

  if (papel === 'nutricionista') {
    const nutriId = profissional?.id_nutricionista_uuid;
    if (!nutriId) {
      mostrarToastPaciente({
        tipo: 'erro',
        texto: 'Nutricionista indisponível',
        subtexto: 'Tente novamente em instantes.',
      });
      return;
    }

    navigation.navigate('PacienteChatNutricionistaDetalhe', {
      usuarioLogado,
      nutricionista: profissional,
      initialNutritionist: profissional,
    });
    return;
  }

  if (papel === 'medico') {
    mostrarToastPaciente({
      tipo: 'info',
      texto: 'Mensagens com o médico',
      subtexto:
        'O chat com o médico ainda não está disponível no app. Use Suporte ou Agendamentos se precisar de contato.',
    });
  }
}
