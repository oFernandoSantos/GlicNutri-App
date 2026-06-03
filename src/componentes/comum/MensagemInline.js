import { useEffect, useRef } from 'react';
import { mostrarToastPaciente } from '../../servicos/servicoToastPaciente';
import { PATIENT_TOAST_DURATION_MS } from '../../utilitarios/mensagensPaciente';

/**
 * Compat: dispara toast global (4s) em vez de banner inline.
 */
export default function MensagemInline({
  tipo = 'aviso',
  texto,
  subtexto = '',
  onFechar,
  autoOcultarMs = PATIENT_TOAST_DURATION_MS,
}) {
  const ultimoTextoRef = useRef('');

  useEffect(() => {
    const chave = String(texto || '').trim();
    if (!chave) return undefined;

    const assinatura = `${tipo}|${chave}|${subtexto}`;
    if (ultimoTextoRef.current === assinatura) return undefined;
    ultimoTextoRef.current = assinatura;

    mostrarToastPaciente({
      tipo,
      texto: chave,
      subtexto,
    });

    return undefined;
  }, [autoOcultarMs, subtexto, texto, tipo]);

  useEffect(() => {
    if (!texto) {
      ultimoTextoRef.current = '';
      if (typeof onFechar === 'function') {
        onFechar();
      }
    }
  }, [onFechar, texto]);

  return null;
}
