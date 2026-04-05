import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { temaPaciente, sombraPaciente } from '../theme/temaPaciente';

export const PATIENT_TAB_BAR_HEIGHT = 64;
export const PATIENT_TAB_BAR_SPACE = 4;

const abasPrincipais = [
  { rota: 'PacienteDiario', rotulo: 'Diario', biblioteca: 'ion', icone: 'book-outline' },
  {
    rota: 'PacienteMonitoramento',
    rotulo: 'Glicose',
    biblioteca: 'ion',
    icone: 'pulse-outline',
  },
  {
    rota: 'HomePaciente',
    rotulo: 'Inicio',
    biblioteca: 'ion',
    icone: 'home-outline',
  },
  {
    rota: 'PacienteAssistente',
    rotulo: 'IA',
    biblioteca: 'ion',
    icone: 'sparkles-outline',
  },
  {
    rota: 'PacientePlano',
    rotulo: 'Plano',
    biblioteca: 'material',
    icone: 'food-apple-outline',
  },
];

function IconeAba({ aba, ativo }) {
  const cor = ativo ? temaPaciente.cores.primariaForte : '#98A2A7';

  if (aba.biblioteca === 'material') {
    return <MaterialCommunityIcons name={aba.icone} size={22} color={cor} />;
  }

  return <Ionicons name={aba.icone} size={22} color={cor} />;
}

export default function BarraAbasPaciente({ navigation, rotaAtual, usuarioLogado }) {
  function navegar(rota) {
    if (rotaAtual === rota) {
      return;
    }

    navigation.navigate(rota, { usuarioLogado });
  }

  return (
    <View style={styles.areaFixa}>
      <View style={styles.barra}>
        {abasPrincipais.map((aba) => {
          const ativo = rotaAtual === aba.rota;

          return (
            <TouchableOpacity
              key={aba.rota}
              style={styles.aba}
              onPress={() => navegar(aba.rota)}
            >
              <IconeAba aba={aba} ativo={ativo} />
              <Text
                style={[
                  styles.rotuloAba,
                  ativo && styles.rotuloAbaAtivo,
                ]}
              >
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
    width: '100%',
    zIndex: 40,
    elevation: 14,
    backgroundColor: temaPaciente.cores.fundo,
    borderTopWidth: 1,
    borderTopColor: temaPaciente.cores.borda,
  },
  barra: {
    width: '100%',
    minHeight: PATIENT_TAB_BAR_HEIGHT,
    paddingTop: 2,
    paddingBottom: 4,
    paddingHorizontal: 6,
    backgroundColor: temaPaciente.cores.fundo,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...sombraPaciente,
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
    color: temaPaciente.cores.primariaForte,
  },
});
