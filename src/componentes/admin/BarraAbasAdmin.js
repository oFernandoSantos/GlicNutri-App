import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { adminShadow, adminTheme } from '../../temas/temaVisualAdmin';

export const ADMIN_TAB_BAR_HEIGHT = 64;
export const ADMIN_TAB_BAR_SPACE = 14;
const TAB_HIGHLIGHT_COLOR = adminTheme.colors.primary;
const TAB_ACTIVE_BACKGROUND = '#0B1A17';

const abasPrincipais = [
  { rota: 'AdminCadastros', rotulo: 'Cadastros', icone: 'person-add-outline' },
  { rota: 'AdminHome', rotulo: 'Inicio', icone: 'home-outline' },
  { rota: 'AdminOperacoes', rotulo: 'Operacoes', icone: 'briefcase-outline' },
  { rota: 'AdminLogsSistema', rotulo: 'Auditoria/Log', icone: 'pulse-outline' },
];

const rodapeWebFixo = Platform.OS === 'web' ? { position: 'fixed', zIndex: 850 } : null;

export default function BarraAbasAdmin({ navigation, rotaAtual, usuarioLogado }) {
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

    navigation.navigate(rota, { usuarioLogado });
  }

  const bottomOffset = Platform.OS === 'web' ? 0 : Math.max(10, Math.min(insets.bottom || 0, 14));

  return (
    <View style={[styles.areaFixa, rodapeWebFixo]}>
      <View style={[styles.barra, { marginBottom: bottomOffset }]}>
        {abasPrincipais.map((aba) => {
          const ativo = rotaVisual === aba.rota;

          return (
            <Pressable key={aba.rota} style={styles.aba} onPress={() => navegar(aba.rota)}>
              <View style={[styles.iconeAbaWrap, ativo && styles.iconeAbaWrapAtivo]}>
                <View style={[styles.iconeAbaInner, ativo && styles.iconeAbaInnerAtivo]}>
                  <Ionicons
                    name={aba.icone}
                    size={ativo ? 24 : 22}
                    color={ativo ? TAB_HIGHLIGHT_COLOR : '#FFFFFF'}
                  />
                  {ativo ? <Text style={styles.rotuloAbaDentroAtivo}>{aba.rotulo}</Text> : null}
                </View>
              </View>
              {!ativo ? <Text style={styles.rotuloAba}>{aba.rotulo}</Text> : null}
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
    backgroundColor: adminTheme.colors.background,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  barra: {
    width: '100%',
    minHeight: ADMIN_TAB_BAR_HEIGHT,
    paddingTop: 1,
    paddingBottom: 3,
    paddingHorizontal: 6,
    backgroundColor: adminTheme.colors.background,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
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
    fontSize: 9,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  rotuloAbaDentroAtivo: {
    alignSelf: 'center',
    color: TAB_HIGHLIGHT_COLOR,
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 9,
    marginTop: 0,
    textAlign: 'center',
  },
});
