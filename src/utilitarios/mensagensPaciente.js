export const PATIENT_TOAST_DURATION_MS = 4000;

const MESSAGE_REWRITES = [
  {
    match: /nao foi possivel exportar|não foi possível exportar/i,
    tipo: 'erro',
    texto: 'Não conseguimos gerar seu relatório agora',
    subtexto: 'Tente de novo em alguns instantes.',
  },
  {
    match: /exporta(c|ç)(a|ã)o conclu|pdf gerado|relatorio exportado/i,
    tipo: 'sucesso',
    texto: 'Relatório pronto',
    subtexto: 'Você já pode abrir ou compartilhar o arquivo.',
  },
  {
    match: /sessao expirada|sessão expirada|unauthorized|401/i,
    tipo: 'aviso',
    texto: 'Sua sessão expirou',
    subtexto: 'Entre novamente para continuar.',
  },
  {
    match: /nao foi possivel enviar|não foi possível enviar/i,
    tipo: 'erro',
    texto: 'Não enviamos sua mensagem',
    subtexto: 'Confira a conexão e tente outra vez.',
  },
  {
    match: /selecione um horario|selecione um horário/i,
    tipo: 'aviso',
    texto: 'Escolha um horário',
    subtexto: 'Toque em um horário livre na agenda.',
  },
  {
    match: /nao foi possivel carregar os horarios|não foi possível carregar os horários/i,
    tipo: 'erro',
    texto: 'Agenda indisponível agora',
    subtexto: 'Atualize a tela ou tente de novo em instantes.',
  },
  {
    match: /nao foi possivel carregar as notificacoes|não foi possível carregar as notificações/i,
    tipo: 'erro',
    texto: 'Notificações indisponíveis',
    subtexto: 'Tente abrir de novo em alguns segundos.',
  },
  {
    match: /nao foi possivel identificar o paciente|não foi possível identificar o paciente/i,
    tipo: 'erro',
    texto: 'Não encontramos seu cadastro',
    subtexto: 'Saia e entre de novo no app.',
  },
  {
    match: /nao foi possivel excluir|não foi possível excluir/i,
    tipo: 'erro',
    texto: 'Não removemos esse registro',
    subtexto: 'Verifique a internet e tente novamente.',
  },
  {
    match: /sem foto|foto indispon|não foi possível exibir a imagem/i,
    tipo: 'aviso',
    texto: 'Foto não disponível',
    subtexto: 'Este registro não tem imagem ou ela não abriu.',
  },
  {
    match: /alerta de glicose alta|glicemia de .* registrada/i,
    tipo: 'aviso',
    texto: 'Glicose acima do ideal',
    subtexto: 'Siga o plano da sua equipe e monitore nos próximos registros.',
  },
  {
    match: /cep nao encontrado|cep não encontrado/i,
    tipo: 'aviso',
    texto: 'CEP não encontrado',
    subtexto: 'Confira os números ou preencha o endereço manualmente.',
  },
  {
    match: /endereco preenchido pelo cep|endereço preenchido pelo cep/i,
    tipo: 'sucesso',
    texto: 'Endereço preenchido',
    subtexto: 'Confira número e complemento antes de salvar.',
  },
  {
    match: /nao foi possivel buscar esse cep|não foi possível buscar esse cep/i,
    tipo: 'erro',
    texto: 'CEP indisponível agora',
    subtexto: 'Tente de novo ou digite o endereço manualmente.',
  },
  {
    match: /acompanhamento (medico|médico )?encerrado|acompanhamento encerrado/i,
    tipo: 'sucesso',
    texto: 'Acompanhamento atualizado',
    subtexto: 'Você pode vincular outro profissional quando quiser.',
  },
  {
    match: /solicitacao enviada|solicitação enviada|consulta agendada|agendamento confirmado/i,
    tipo: 'sucesso',
    texto: 'Tudo certo',
    subtexto: 'Acompanhe os detalhes em Minhas consultas.',
  },
  {
    match: /quota|insufficient_quota|openai|api key/i,
    tipo: 'aviso',
    texto: 'Recurso de IA indisponível',
    subtexto: 'Use busca manual na TACO ou tente mais tarde.',
  },
  {
    match: /failed to fetch|network request failed/i,
    tipo: 'erro',
    texto: 'Sem conexão estável',
    subtexto: 'Confira sua internet e tente novamente.',
  },
  {
    match: /nao foi possivel carregar os horarios|não foi possível carregar os horários|carregar datas e horarios/i,
    tipo: 'erro',
    texto: 'Agenda indisponível agora',
    subtexto: 'Atualize a tela ou tente de novo em instantes.',
  },
  {
    match: /solicite o acompanhamento primeiro|acompanhamento primeiro/i,
    tipo: 'aviso',
    texto: 'Vincule o profissional antes',
    subtexto: 'Peça acompanhamento e aguarde aprovação para agendar.',
  },
  {
    match: /nao foi possivel confirmar o agendamento|não foi possível confirmar o agendamento/i,
    tipo: 'erro',
    texto: 'Agendamento não confirmado',
    subtexto: 'Tente outro horário ou verifique sua conexão.',
  },
  {
    match: /consulta cancelada|cancelada com sucesso/i,
    tipo: 'sucesso',
    texto: 'Consulta cancelada',
    subtexto: 'O horário voltou a ficar disponível na agenda.',
  },
  {
    match: /consulta confirmada|confirmada com sucesso/i,
    tipo: 'sucesso',
    texto: 'Consulta confirmada',
    subtexto: 'Guarde o link da videochamada para o dia.',
  },
  {
    match: /nao foi possivel cancelar|não foi possível cancelar/i,
    tipo: 'erro',
    texto: 'Não cancelamos a consulta',
    subtexto: 'Tente novamente em alguns instantes.',
  },
  {
    match: /nao foi possivel abrir o google meet|google meet/i,
    tipo: 'erro',
    texto: 'Link da consulta indisponível',
    subtexto: 'Peça um novo link à sua nutricionista ou médico.',
  },
  {
    match: /paciente sem identificador/i,
    tipo: 'aviso',
    texto: 'Cadastro incompleto',
    subtexto: 'Saia e entre de novo para continuar.',
  },
  {
    match: /libreview.*importad|leitura\(s\) importada|importacao concluida|sincroniz.*libre|conta librelinkup desvinculada|librelinkup.*vinculad/i,
    tipo: 'sucesso',
    texto: 'Sensor atualizado',
    subtexto: 'Suas leituras foram sincronizadas no app.',
  },
  {
    match: /nao foi possivel sincronizar.*libre|não foi possível sincronizar.*libre|vincular o librelinkup/i,
    tipo: 'erro',
    texto: 'Sensor não conectou',
    subtexto: 'Confira e-mail, senha e compartilhamento no LibreLinkUp.',
  },
  {
    match: /nao encontramos leituras validas|não encontramos leituras válidas/i,
    tipo: 'aviso',
    texto: 'Arquivo sem leituras',
    subtexto: 'Exporte de novo o CSV do LibreView e tente outra vez.',
  },
  {
    match: /nao foi possivel importar|não foi possível importar.*libre/i,
    tipo: 'erro',
    texto: 'Importação não concluída',
    subtexto: 'Confira o arquivo CSV e sua conexão.',
  },
  {
    match: /informe e-mail e senha.*librelinkup/i,
    tipo: 'aviso',
    texto: 'Dados da conta Libre',
    subtexto: 'Preencha e-mail e senha do LibreLinkUp.',
  },
  {
    match: /vincule sua conta librelinkup|vincule.*librelinkup/i,
    tipo: 'aviso',
    texto: 'Conecte o sensor primeiro',
    subtexto: 'Vincule sua conta LibreLinkUp nesta tela.',
  },
  {
    match: /sincronizacao indisponivel|sincronização indisponível/i,
    tipo: 'erro',
    texto: 'Sincronização indisponível',
    subtexto: 'Tente mais tarde ou use importação por arquivo.',
  },
  {
    match: /bem-estar salvo|sinais do dia foram atualizados/i,
    tipo: 'sucesso',
    texto: 'Bem-estar registrado',
    subtexto: 'Seus sintomas e hábitos foram salvos.',
  },
  {
    match: /atividade registrada|caminhada leve salva/i,
    tipo: 'sucesso',
    texto: 'Atividade registrada',
    subtexto: 'Continue registrando para ver tendências.',
  },
  {
    match: /nao foi possivel salvar seu bem-estar|não foi possível salvar seu bem-estar/i,
    tipo: 'erro',
    texto: 'Bem-estar não salvo',
    subtexto: 'Confira a internet e tente novamente.',
  },
  {
    match: /selecione pelo menos um sintoma/i,
    tipo: 'aviso',
    texto: 'Marque como você se sente',
    subtexto: 'Escolha ao menos um sintoma ou estado.',
  },
  {
    match: /relato enviado/i,
    tipo: 'sucesso',
    texto: 'Mensagem enviada',
    subtexto: 'Se precisarmos de mais detalhes, entraremos em contato.',
  },
  {
    match: /nao foi possivel enviar o relato|não foi possível enviar o relato/i,
    tipo: 'erro',
    texto: 'Relato não enviado',
    subtexto: 'Confira os campos e sua conexão.',
  },
  {
    match: /informe um valor de glicose válido|glicose invalida|glicose inválida/i,
    tipo: 'aviso',
    texto: 'Valor de glicose inválido',
    subtexto: 'Use um número maior que zero em mg/dL.',
  },
  {
    match: /selecione o tipo da glicemia/i,
    tipo: 'aviso',
    texto: 'Tipo da medição',
    subtexto: 'Informe se é em jejum, antes ou depois da refeição.',
  },
  {
    match: /registro salvo|salvo com sucesso|dados salvos/i,
    tipo: 'sucesso',
    texto: 'Registro salvo',
    subtexto: 'Seu histórico foi atualizado.',
  },
];

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferTipoFromText(text) {
  const lower = String(text || '').toLowerCase();

  if (/erro|falha|invalid|inválid|nao foi poss|não foi poss|indispon|bloquead/.test(lower)) {
    return 'erro';
  }

  if (/sucesso|salvo|confirmad|conclu|enviad|vinculad|atualizad|pronto/.test(lower)) {
    return 'sucesso';
  }

  if (/aguarde|carregando|processando|sincronizando/.test(lower)) {
    return 'processando';
  }

  return 'aviso';
}

function applyRewrite(texto, subtexto, tipo) {
  const combined = normalizeWhitespace([texto, subtexto].filter(Boolean).join(' '));

  for (const rule of MESSAGE_REWRITES) {
    if (!rule.match.test(combined)) continue;

    return {
      tipo: rule.tipo || tipo,
      texto: rule.texto,
      subtexto: rule.subtexto || '',
    };
  }

  return {
    tipo,
    texto: normalizeWhitespace(texto),
    subtexto: normalizeWhitespace(subtexto),
  };
}

function humanizeRawMessage(text) {
  const cleaned = normalizeWhitespace(
    String(text || '')
      .replace(/^error:\s*/i, '')
      .replace(/rpc error/i, 'erro de comunicação')
  );

  if (!cleaned) return '';

  if (cleaned.length <= 120) return cleaned;

  return `${cleaned.slice(0, 117)}...`;
}

/**
 * Normaliza titulo/texto/subtexto para visão paciente (tom claro, sem jargão técnico).
 */
export function resolverMensagemPaciente({
  tipo,
  texto,
  subtexto = '',
  titulo = '',
  mensagem = '',
} = {}) {
  const rawTexto = normalizeWhitespace(texto || titulo || mensagem);
  const rawSubtexto = normalizeWhitespace(subtexto || (titulo && mensagem ? mensagem : ''));
  const tipoBase = tipo || inferTipoFromText(`${rawTexto} ${rawSubtexto}`);
  const rewritten = applyRewrite(rawTexto, rawSubtexto, tipoBase);

  if (!rewritten.texto && rewritten.subtexto) {
    rewritten.texto = rewritten.subtexto;
    rewritten.subtexto = '';
  }

  if (!rewritten.texto) {
    rewritten.texto = 'Algo não saiu como esperado';
    rewritten.subtexto = 'Tente novamente em instantes.';
    rewritten.tipo = 'aviso';
  }

  if (!rewritten.subtexto && rewritten.texto.length > 72) {
    const pivot = rewritten.texto.indexOf('. ');
    if (pivot > 24 && pivot < 90) {
      rewritten.subtexto = rewritten.texto.slice(pivot + 2);
      rewritten.texto = rewritten.texto.slice(0, pivot + 1);
    } else {
      rewritten.subtexto = humanizeRawMessage(rewritten.texto.slice(72));
      rewritten.texto = `${rewritten.texto.slice(0, 69)}...`;
    }
  }

  return rewritten;
}

export function resolverMensagemPacienteDeErro(error, fallbackTexto = 'Não foi possível concluir agora.') {
  const message = normalizeWhitespace(error?.message || error || fallbackTexto);
  return resolverMensagemPaciente({
    tipo: 'erro',
    texto: message,
    subtexto: 'Tente de novo em alguns instantes.',
  });
}
