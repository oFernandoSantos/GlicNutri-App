import React, { useEffect, useState } from 'react';
import ToastPaciente from './ToastPaciente';
import {
  fecharToastPaciente,
  subscribeToastPaciente,
} from '../../servicos/servicoToastPaciente';
import { PATIENT_TOAST_DURATION_MS } from '../../utilitarios/mensagensPaciente';

export default function HostToastPaciente({ posicao = 'top' }) {
  const [toast, setToast] = useState(null);

  useEffect(() => subscribeToastPaciente(setToast), []);

  return (
    <ToastPaciente
      tipo={toast?.tipo || 'aviso'}
      texto={toast?.texto || ''}
      subtexto={toast?.subtexto || ''}
      carregando={Boolean(toast?.carregando)}
      onFechar={fecharToastPaciente}
      autoOcultarMs={toast?.carregando ? 0 : PATIENT_TOAST_DURATION_MS}
      posicao={posicao}
    />
  );
}
