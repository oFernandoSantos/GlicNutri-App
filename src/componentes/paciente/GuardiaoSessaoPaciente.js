import React, { useEffect } from 'react';
import { isAdminUser } from '../../servicos/servicoAdmin';
import { isNutriUser } from '../../servicos/servicoSessaoNutricionista';
import {
  emitirSessaoRpcOAuthPaciente,
  garantirSessaoRpcClinicaComPerfil,
} from '../../servicos/servicoSessaoRpc';
import {
  hasLibreLinkUpLinked,
  startLibreViewAutoSync,
  stopLibreViewAutoSync,
} from '../../servicos/servicoLibreViewAutoSync';
import { getPatientId } from '../../servicos/servicoDadosPaciente';
/**
 * Impede que sessao de nutricionista ou admin permaneca em telas do paciente.
 */
export default function GuardiaoSessaoPaciente({ navigation, usuarioLogado, children }) {
  useEffect(() => {
    if (!navigation || !usuarioLogado) {
      return;
    }

    if (isAdminUser(usuarioLogado)) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'AdminHome' }],
      });
      return;
    }

    if (isNutriUser(usuarioLogado)) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'HomeNutricionista' }],
      });
      return;
    }

    (async () => {
      let token = await garantirSessaoRpcClinicaComPerfil(usuarioLogado);
      if (!token) {
        token = await emitirSessaoRpcOAuthPaciente(usuarioLogado);
      }
      if (!token && __DEV__) {
        console.log('Sessao RPC clinica indisponivel para o paciente.');
      }
    })();

    const patientId = getPatientId(usuarioLogado);
    if (!patientId) {
      return undefined;
    }

    let active = true;

    hasLibreLinkUpLinked(patientId)
      .then((linked) => {
        if (!active || !linked) {
          stopLibreViewAutoSync();
          return;
        }

        startLibreViewAutoSync({
          patientId,
          patientEmail: usuarioLogado?.email_pac || usuarioLogado?.email || '',
          actor: usuarioLogado,
        });
      })
      .catch(() => {
        stopLibreViewAutoSync();
      });

    return () => {
      active = false;
      stopLibreViewAutoSync();
    };
  }, [navigation, usuarioLogado]);

  return children;
}
