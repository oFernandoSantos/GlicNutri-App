import React, { useEffect, useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nutriTheme as patientTheme, nutriShadow as patientShadow } from '../../temas/temaVisualNutricionista';
import { navigateNutriTab } from '../../utilitarios/navegacaoAbas';

export const NUTRI_TAB_BAR_HEIGHT = 64;
export const NUTRI_TAB_BAR_SPACE = 14;

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
  const insets = useSafeAreaInsets();
  const [rotaVisual, setRotaVisual] = useState(rotaAtual);

  useEffect(() => {
    setRotaVisual(rotaAtual);
  }, [rotaAtual]);

  function navegar(rota) {
    setRotaVisual(rota);

    if (rotaAtual === rota) {
      return;
    }

    navigateNutriTab(navigation, rota, usuarioLogado);
  }

  const bottomOffset = Platform.OS === 'web' ? 0 : Math.max(10, Math.min(insets.bottom || 0, 14));

  return (
    <View style={[styles.areaFixa, rodapeWebFixo]}>
      <View style={[styles.barra, { marginBottom: bottomOffset }]}>
        {abasPrincipais.map((aba) => {
          const ativo = rotaVisual === aba.rota;

          return (
            <Pressable
              key={aba.rota}
              style={[styles.aba, ativo && styles.abaAtiva]}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={`Aba ${aba.rotulo}${ativo ? ', selecionada' : ''}`}
              onPressIn={() => {
                if (rotaAtual !== aba.rota) {
                  navegar(aba.rota);
                }
              }}
              onPress={() => {
                if (rotaAtual !== aba.rota) {
                  navegar(aba.rota);
                }
              }}
            >
              <Ionicons
                name={aba.icone}
                size={22}
                color={ativo ? patientTheme.colors.onPrimary : patientTheme.colors.textMuted}
              />
              <Text style={[styles.rotuloAba, ativo && styles.rotuloAbaAtivo]}>
                {aba.rotulo}
              </Text>
            </Pressable>
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
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderTopWidth: 1,
    borderTopColor: patientTheme.colors.surfaceBorder,
  },
  barra: {
    width: '100%',
    minHeight: NUTRI_TAB_BAR_HEIGHT,
    paddingTop: 7,
    paddingBottom: 7,
    paddingHorizontal: 8,
    backgroundColor: patientTheme.colors.backgroundSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...patientShadow,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  aba: {
    flex: 1,
    height: 50,
    marginHorizontal: 2,
    borderRadius: patientTheme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    backgroundColor: patientTheme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  abaAtiva: {
    backgroundColor: patientTheme.colors.primaryDark,
    borderColor: patientTheme.colors.primaryDark,
    elevation: 3,
    shadowColor: patientTheme.colors.primaryDark,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  rotuloAba: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
  },
  rotuloAbaAtivo: {
    color: patientTheme.colors.onPrimary,
  },
});
