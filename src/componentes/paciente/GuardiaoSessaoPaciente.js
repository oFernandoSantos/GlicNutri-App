import React, { useEffect } from 'react';
import { isAdminUser } from '../../servicos/servicoAdmin';
import { isNutriUser } from '../../servicos/servicoSessaoNutricionista';
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
    }
  }, [navigation, usuarioLogado]);

  return children;
}
