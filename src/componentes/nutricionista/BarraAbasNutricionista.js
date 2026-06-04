import React, { useEffect, useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sombraPaciente, temaPaciente } from '../../temas/temaPaciente';
import { navigateNutriTab } from '../../utilitarios/navegacaoAbas';

export const NUTRI_TAB_BAR_HEIGHT = 64;
export const NUTRI_TAB_BAR_SPACE = 14;
/** Mesmas cores do rodapé do acesso paciente (BarraAbasPaciente). */
const TAB_HIGHLIGHT_COLOR = temaPaciente.cores.primaria;
const TAB_ACTIVE_BACKGROUND = '#FFFFFF';
const TAB_BAR_FOOTER_BG = temaPaciente.cores.fundo;

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
              style={styles.aba}
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
              <View style={styles.abaInner}>
                <View style={[styles.iconeAbaWrap, ativo && styles.iconeAbaWrapAtivo]}>
                  <View style={[styles.iconeAbaInner, ativo && styles.iconeAbaInnerAtivo]}>
                    <Ionicons
                      name={aba.icone}
                      size={ativo ? 24 : 22}
                      color={ativo ? TAB_HIGHLIGHT_COLOR : '#98A2A7'}
                    />
                    {ativo ? <Text style={styles.rotuloAbaDentroAtivo}>{aba.rotulo}</Text> : null}
                  </View>
                </View>
                {!ativo ? <Text style={styles.rotuloAba}>{aba.rotulo}</Text> : null}
              </View>
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
    backgroundColor: TAB_BAR_FOOTER_BG,
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF',
  },
  barra: {
    width: '100%',
    minHeight: 58,
    paddingTop: 1,
    paddingBottom: 3,
    paddingHorizontal: 6,
    backgroundColor: TAB_BAR_FOOTER_BG,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...sombraPaciente,
    borderColor: '#FFFFFF',
    zIndex: 80,
  },
  aba: {
    flex: 1,
    height: 48,
    marginHorizontal: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    overflow: 'visible',
  },
  abaInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeAbaWrap: {
    alignItems: 'center',
    borderRadius: 20,
    height: 34,
    justifyContent: 'center',
    width: 44,
  },
  iconeAbaInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeAbaWrapAtivo: {
    backgroundColor: TAB_ACTIVE_BACKGROUND,
    borderColor: TAB_HIGHLIGHT_COLOR,
    borderWidth: 1.5,
    borderRadius: 34,
    elevation: 8,
    height: 68,
    justifyContent: 'center',
    marginTop: -13,
    shadowColor: TAB_HIGHLIGHT_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    width: 68,
  },
  iconeAbaInnerAtivo: {
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    transform: [{ translateY: -2 }],
  },
  rotuloAba: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '500',
    color: '#8B95A1',
  },
  rotuloAbaDentroAtivo: {
    alignSelf: 'center',
    color: TAB_HIGHLIGHT_COLOR,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
    marginTop: 0,
    textAlign: 'center',
  },
});
