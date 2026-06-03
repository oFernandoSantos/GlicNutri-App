import {
  PATIENT_TOAST_DURATION_MS,
  resolverMensagemPaciente,
  resolverMensagemPacienteDeErro,
} from '../utilitarios/mensagensPaciente';

let activeToast = null;
const listeners = new Set();
let lastToastSignature = '';
let lastToastShownAt = 0;

function buildToastSignature(resolved) {
  return `${resolved.tipo}::${resolved.texto}::${resolved.subtexto}`;
}

function notify() {
  listeners.forEach((listener) => {
    try {
      listener(activeToast);
    } catch (_error) {
      // noop
    }
  });
}

export function subscribeToastPaciente(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);
  listener(activeToast);

  return () => {
    listeners.delete(listener);
  };
}

export function fecharToastPaciente() {
  activeToast = null;
  notify();
}

export function mostrarToastPaciente(input = {}) {
  const resolved = resolverMensagemPaciente(input);
  const signature = buildToastSignature(resolved);
  const now = Date.now();
  const dedupeWindowMs = PATIENT_TOAST_DURATION_MS + 800;

  if (
    !input.carregando &&
    signature === lastToastSignature &&
    now - lastToastShownAt < dedupeWindowMs
  ) {
    return activeToast;
  }

  lastToastSignature = signature;
  lastToastShownAt = now;

  activeToast = {
    ...resolved,
    carregando: Boolean(input.carregando),
  };

  notify();
  return activeToast;
}

export function mostrarToastPacienteErro(error, fallbackTexto) {
  return mostrarToastPaciente(resolverMensagemPacienteDeErro(error, fallbackTexto));
}

/**
 * Substitui Alert.alert informativo (1 botão ou OK/Cancel sem ação destrutiva).
 * Confirmações com 2+ ações continuam em Alert nativo.
 */
export function alertPaciente(titulo, mensagem, botoes) {
  const actions = Array.isArray(botoes) ? botoes : [{ text: 'OK' }];

  if (actions.length > 1) {
    const { Alert } = require('react-native');
    Alert.alert(titulo, mensagem, botoes);
    return;
  }

  mostrarToastPaciente({
    texto: titulo,
    subtexto: mensagem,
  });

  const action = actions[0];
  if (typeof action?.onPress === 'function') {
    action.onPress();
  }
}
