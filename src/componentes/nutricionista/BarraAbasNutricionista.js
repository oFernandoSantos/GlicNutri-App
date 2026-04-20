import React from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

export const NUTRI_TAB_BAR_HEIGHT = 64;
export const NUTRI_TAB_BAR_SPACE = 8;

const abasPrincipais = [
  { rota: 'NutricionistaAgenda', rotulo: 'Agenda', icone: 'calendar-outline' },
  { rota: 'GerenciarPacientes', rotulo: 'Pacientes', icone: 'people-outline' },
  { rota: 'HomeNutricionista', rotulo: 'Início', icone: 'home-outline' },
  { rota: 'NutricionistaMensagens', rotulo: 'Mensagens', icone: 'chatbubbles-outline' },
  { rota: 'NutricionistaRelatorios', rotulo: 'Relatorios', icone: 'bar-chart-outline' },
];

const rodapeWebFixo = Platform.OS === 'web' ? { position: 'fixed', zIndex: 850 } : null;

export default function BarraAbasNutricionista({
  navigation,
  rotaAtual,
  usuarioLogado,
}) {
  function navegar(rota) {
    if (rotaAtual === rota) {
      return;
    }

    navigation.navigate(rota, { usuarioLogado });
  }

  return (
    <View style={[styles.areaFixa, rodapeWebFixo]}>
      <View style={styles.barra}>
        {abasPrincipais.map((aba) => {
          const ativo = rotaAtual === aba.rota;

          return (
            <TouchableOpacity
              key={aba.rota}
              style={styles.aba}
              onPress={() => navegar(aba.rota)}
            >
              <Ionicons
                name={aba.icone}
                size={22}
                color={ativo ? patientTheme.colors.primaryDark : '#98A2A7'}
              />
              <Text style={[styles.rotuloAba, ativo && styles.rotuloAbaAtivo]}>
                {aba.rotulo}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  areaFixa: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    zIndex: 40,
    elevation: 14,
    backgroundColor: patientTheme.colors.background,
    borderTopWidth: 1,
    borderTopColor: '#ffffff',
  },
  barra: {
    width: '100%',
    minHeight: NUTRI_TAB_BAR_HEIGHT,
    paddingTop: 2,
    paddingBottom: 4,
    paddingHorizontal: 6,
    backgroundColor: patientTheme.colors.background,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...patientShadow,
    borderColor: '#ffffff',
  },
  aba: {
    flex: 1,
    height: 44,
    marginHorizontal: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  rotuloAba: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: '#98A2A7',
  },
  rotuloAbaAtivo: {
    color: patientTheme.colors.primaryDark,
  },
});
