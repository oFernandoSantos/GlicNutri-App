import { useCallback } from 'react';
import {
  alertPaciente,
  fecharToastPaciente,
  mostrarToastPaciente,
  mostrarToastPacienteErro,
} from '../servicos/servicoToastPaciente';

export function useToastPaciente() {
  const mostrar = useCallback((input) => mostrarToastPaciente(input), []);
  const mostrarErro = useCallback(
    (error, fallback) => mostrarToastPacienteErro(error, fallback),
    []
  );
  const alertar = useCallback((titulo, mensagem, botoes) => alertPaciente(titulo, mensagem, botoes), []);
  const fechar = useCallback(() => fecharToastPaciente(), []);

  return {
    mostrarToastPaciente: mostrar,
    mostrarToastPacienteErro: mostrarErro,
    alertPaciente: alertar,
    fecharToastPaciente: fechar,
  };
}
