import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { temaPaciente, sombraPaciente } from '../../temas/temaPaciente';

export const PATIENT_TAB_BAR_HEIGHT = 64;
export const PATIENT_TAB_BAR_SPACE = 14;
const TAB_HIGHLIGHT_COLOR = '#4fdfa3';
const TAB_ACTIVE_BACKGROUND = '#FFFFFF';
const QUICK_MENU_BOTTOM = 232;
const QUICK_ACTION_CIRCLE_SIZE = 54;
const QUICK_ACTION_ITEM_HEIGHT = 84;
const QUICK_ACTION_GAP = 16;
const DOUBLE_TAP_DELAY = 320;
const HEADER_VISIBLE_SPACE = 0;

const abasPrincipais = [
  { rota: 'PacienteDiario', rotulo: 'Alimentação', biblioteca: 'ion', icone: 'restaurant-outline' },
  {
    rota: 'PacienteMonitoramento',
    rotulo: 'Glicose',
    biblioteca: 'ion',
    icone: 'pulse-outline',
  },
  {
    rota: 'HomePaciente',
    rotulo: 'Início',
    biblioteca: 'ion',
    icone: 'home-outline',
  },
  {
    rota: 'PacienteAgendamentos',
    rotulo: 'Consultas',
    biblioteca: 'ion',
    icone: 'calendar-outline',
  },
  {
    rota: 'PacientePlano',
    rotulo: 'Plano',
    biblioteca: 'material',
    icone: 'food-apple-outline',
  },
];

const rodapeWebFixo = Platform.OS === 'web' ? { position: 'fixed', zIndex: 850 } : null;

function IconeAba({ aba, ativo }) {
  const cor = ativo ? TAB_HIGHLIGHT_COLOR : '#98A2A7';
  const tamanho = ativo ? 24 : 22;

  if (aba.biblioteca === 'material') {
    return <MaterialCommunityIcons name={aba.icone} size={tamanho} color={cor} />;
  }

  return <Ionicons name={aba.icone} size={tamanho} color={cor} />;
}

export default function BarraAbasPaciente({ navigation, rotaAtual, usuarioLogado }) {
  const insets = useSafeAreaInsets();
  const { height: alturaTela, width: larguraTela } = useWindowDimensions();
  const [rotaVisual, setRotaVisual] = useState(rotaAtual);
  const [menuRapidoVisivel, setMenuRapidoVisivel] = useState(false);
  const [acaoRapidaEmFoco, setAcaoRapidaEmFoco] = useState(null);
  const larguraBarraRef = useRef(0);
  const inicioArrasteXRef = useRef(0);
  const inicioArrasteYRef = useRef(0);
  const rotaArrastadaRef = useRef(null);
  const arrastePeloCirculoRef = useRef(false);
  const arrasteMovidoRef = useRef(false);
  const direcaoArrasteRef = useRef(null);
  const menuRapidoAbertoNoInicioRef = useRef(false);
  const ultimoToqueInicioRef = useRef(0);

  useEffect(() => {
    setRotaVisual(rotaAtual);
  }, [rotaAtual]);

  function navegar(rota) {
    setMenuRapidoVisivel(false);
    setAcaoRapidaEmFoco(null);
    setRotaVisual(rota);

    if (rotaAtual === rota) {
      return;
    }

    navigation.navigate(rota, { usuarioLogado });
  }

  function obterRotaPelaPosicao(posicaoX) {
    const larguraBarra = larguraBarraRef.current;

    if (!larguraBarra) {
      return null;
    }

    const larguraAba = larguraBarra / abasPrincipais.length;
    const indice = Math.max(
      0,
      Math.min(abasPrincipais.length - 1, Math.floor(posicaoX / larguraAba))
    );

    return abasPrincipais[indice]?.rota || null;
  }

  function atualizarSelecaoPorArraste(posicaoX) {
    const rota = obterRotaPelaPosicao(posicaoX);

    if (!rota) {
      return;
    }

    rotaArrastadaRef.current = rota;
    setRotaVisual(rota);
  }

  function iniciarArrastePeloCirculo(posicaoX, posicaoY, rota) {
    arrastePeloCirculoRef.current = true;
    arrasteMovidoRef.current = false;
    direcaoArrasteRef.current = null;
    inicioArrasteXRef.current = posicaoX;
    inicioArrasteYRef.current = posicaoY;
    rotaArrastadaRef.current = rota;
    atualizarSelecaoPorArraste(posicaoX);
  }

  function moverArrastePeloCirculo(posicaoX, posicaoY, rotaOrigem) {
    if (!arrastePeloCirculoRef.current) {
      return;
    }

    const deslocamentoX = posicaoX - inicioArrasteXRef.current;
    const deslocamentoY = posicaoY - inicioArrasteYRef.current;

    if (!direcaoArrasteRef.current) {
      if (Math.abs(deslocamentoY) > 2 && Math.abs(deslocamentoY) >= Math.abs(deslocamentoX)) {
        direcaoArrasteRef.current = 'vertical';
      } else if (Math.abs(deslocamentoX) > 2 && Math.abs(deslocamentoX) > Math.abs(deslocamentoY)) {
        direcaoArrasteRef.current = 'horizontal';
      } else {
        return;
      }
    }

    arrasteMovidoRef.current = true;

    if (direcaoArrasteRef.current === 'horizontal') {
      setAcaoRapidaEmFoco(null);

      if (
        rotaVisual === 'HomePaciente' &&
        deslocamentoY < -12 &&
        Math.abs(deslocamentoY) > Math.abs(deslocamentoX) * 0.28
      ) {
        direcaoArrasteRef.current = 'vertical';
        setMenuRapidoVisivel(true);
        rotaArrastadaRef.current = 'HomePaciente';
        setAcaoRapidaEmFoco(obterAcaoRapidaPeloCirculo(posicaoX, posicaoY));
        return;
      }

      setMenuRapidoVisivel(false);
      atualizarSelecaoPorArraste(posicaoX);
      return;
    }

    if (deslocamentoY >= 0) {
      setAcaoRapidaEmFoco(null);
      return;
    }

    if (rotaOrigem === 'HomePaciente' && rotaVisual === 'HomePaciente' && menuRapidoVisivel) {
      setAcaoRapidaEmFoco(obterAcaoRapidaPeloCirculo(posicaoX, posicaoY));
      rotaArrastadaRef.current = 'HomePaciente';
      return;
    }

    if (
      rotaOrigem === 'HomePaciente' &&
      rotaVisual === 'HomePaciente' &&
      Math.abs(deslocamentoY) > 2
    ) {
      setMenuRapidoVisivel(true);
      rotaArrastadaRef.current = 'HomePaciente';
      setAcaoRapidaEmFoco(obterAcaoRapidaPeloCirculo(posicaoX, posicaoY));
      return;
    }

    setAcaoRapidaEmFoco(null);
  }

  function finalizarArrastePeloCirculo() {
    if (!arrastePeloCirculoRef.current) {
      return;
    }

    const rotaFinal = rotaArrastadaRef.current;
    rotaArrastadaRef.current = null;
    arrastePeloCirculoRef.current = false;
    arrasteMovidoRef.current = false;
    direcaoArrasteRef.current = null;
    menuRapidoAbertoNoInicioRef.current = false;

    if (rotaFinal) {
      navegar(rotaFinal);
    }
  }

  function acionarMenuRapido(tipo) {
    setMenuRapidoVisivel(false);
    setAcaoRapidaEmFoco(null);

    if (tipo === 'meal') {
      navigation.navigate('RegistroRefeicaoIA', {
        usuarioLogado,
        openMealTimingChoice: true,
      });
      return;
    }

    navigation.navigate('PacienteMonitoramento', {
      usuarioLogado,
      openQuickRegister: tipo,
    });
  }

  function alternarMenuRapidoInicioPorDuploToque() {
    const agora = Date.now();
    const toqueAnterior = ultimoToqueInicioRef.current;
    ultimoToqueInicioRef.current = agora;

    if (agora - toqueAnterior <= DOUBLE_TAP_DELAY) {
      setMenuRapidoVisivel((atual) => !atual);
      setAcaoRapidaEmFoco(null);
      arrasteMovidoRef.current = false;
      return true;
    }

    return false;
  }

  function handlePressInicio() {
    if (menuRapidoVisivel) {
      setMenuRapidoVisivel(false);
      setAcaoRapidaEmFoco(null);
      arrasteMovidoRef.current = false;
      return;
    }

    const abriuOuFechouMenu = alternarMenuRapidoInicioPorDuploToque();

    if (abriuOuFechouMenu) {
      return;
    }

    navegar('HomePaciente');
  }

  const acoesRapidas = [
    {
      id: 'medicine',
      label: '\u0052\u0065\u0067\u0069\u0073\u0074\u0072\u0061\u0072\u0020\u004d\u0065\u0064\u0069\u0063\u0061\u00e7\u00e3\u006f',
      icon: 'pill',
      library: 'material',
    },
    {
      id: 'glucose',
      label: 'Registrar Glicose',
      icon: 'water-outline',
      library: 'ion',
    },
    {
      id: 'meal',
      label: '\u0052\u0065\u0067\u0069\u0073\u0074\u0072\u0061\u0072\u0020\u0041\u006c\u0069\u006d\u0065\u006e\u0074\u0061\u00e7\u00e3\u006f',
      icon: 'camera-outline',
      library: 'material',
    },
    {
      id: 'insulin',
      label: 'Registrar Insulina',
      icon: 'needle',
      library: 'material',
    },
  ];

  function obterAcaoRapidaPeloCirculo(posicaoX, posicaoY) {
    const totalMenu =
      acoesRapidas.length * QUICK_ACTION_ITEM_HEIGHT +
      (acoesRapidas.length - 1) * QUICK_ACTION_GAP;
    const topoMenu = alturaTela - QUICK_MENU_BOTTOM - totalMenu;
    const centroX = larguraBarraRef.current / 2;
    const raioFoco = QUICK_ACTION_CIRCLE_SIZE / 2 + 14;

    for (let indice = 0; indice < acoesRapidas.length; indice += 1) {
      const centroY =
        topoMenu +
        indice * (QUICK_ACTION_ITEM_HEIGHT + QUICK_ACTION_GAP) +
        QUICK_ACTION_CIRCLE_SIZE / 2;
      const distanciaX = Math.abs(posicaoX - centroX);
      const distanciaY = Math.abs(posicaoY - centroY);

      if (distanciaX <= raioFoco && distanciaY <= raioFoco) {
        return acoesRapidas[indice]?.id || null;
      }
    }

    return null;
  }

  const bottomOffset = Platform.OS === 'web' ? 0 : Math.max(10, Math.min(insets.bottom || 0, 14));

  return (
    <View style={[styles.areaFixa, rodapeWebFixo]}>
      {menuRapidoVisivel && rotaVisual === 'HomePaciente' ? (
        <>
          <Pressable
            style={[
              styles.menuRapidoBackdrop,
              {
                width: larguraTela,
                height: Math.max(alturaTela - HEADER_VISIBLE_SPACE + PATIENT_TAB_BAR_HEIGHT, 0),
              },
            ]}
            onPress={() => {
              setMenuRapidoVisivel(false);
              setAcaoRapidaEmFoco(null);
            }}
          >
            <BlurView intensity={42} tint="light" style={styles.menuRapidoBlur}>
              <View style={styles.menuRapidoCinza} />
            </BlurView>
          </Pressable>

          <View style={styles.menuRapido}>
            {acoesRapidas.map((acao, index) => (
              <Pressable
                key={acao.id}
                style={[
                  styles.menuRapidoItem,
                  acaoRapidaEmFoco === acao.id && styles.menuRapidoItemFocado,
                  { transform: [{ translateY: index * -2 }] },
                ]}
                onPressIn={() => setAcaoRapidaEmFoco(acao.id)}
                onPress={() => acionarMenuRapido(acao.id)}
              >
                <View
                  style={[
                    styles.menuRapidoIcone,
                    acaoRapidaEmFoco === acao.id && styles.menuRapidoIconeFocado,
                  ]}
                >
                  {acao.library === 'material' ? (
                    <MaterialCommunityIcons
                      name={acao.icon}
                      size={acaoRapidaEmFoco === acao.id ? 26 : 22}
                      color={acaoRapidaEmFoco === acao.id ? TAB_HIGHLIGHT_COLOR : '#98A2A7'}
                    />
                  ) : (
                    <Ionicons
                      name={acao.icon}
                      size={acaoRapidaEmFoco === acao.id ? 26 : 22}
                      color={acaoRapidaEmFoco === acao.id ? TAB_HIGHLIGHT_COLOR : '#98A2A7'}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.menuRapidoTexto,
                    acaoRapidaEmFoco === acao.id && styles.menuRapidoTextoFocado,
                  ]}
                >
                  {acao.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View
        style={[styles.barra, { marginBottom: bottomOffset }]}
        onLayout={(event) => {
          larguraBarraRef.current = event.nativeEvent.layout.width;
        }}
      >
        {abasPrincipais.map((aba) => {
          const ativo = rotaVisual === aba.rota;

          return (
            <Pressable
              key={aba.rota}
              style={styles.aba}
              onPressIn={() => {
                if (arrastePeloCirculoRef.current) {
                  return;
                }

                setRotaVisual(aba.rota);
              }}
              onPress={() => {
                if (arrasteMovidoRef.current) {
                  arrasteMovidoRef.current = false;
                  return;
                }

                if (aba.rota === 'HomePaciente') {
                  handlePressInicio();
                  return;
                }

                navegar(aba.rota);
              }}
            >
              {() => {
                return (
                  <>
                    <View
                      style={[
                        styles.iconeAbaWrap,
                        ativo && styles.iconeAbaWrapAtivo,
                      ]}
                      onStartShouldSetResponder={() => ativo}
                      onMoveShouldSetResponder={() => ativo}
                      onResponderGrant={(event) => {
                        menuRapidoAbertoNoInicioRef.current = menuRapidoVisivel;
                        iniciarArrastePeloCirculo(
                          event.nativeEvent.pageX,
                          event.nativeEvent.pageY,
                          aba.rota
                        );
                      }}
                      onResponderMove={(event) => {
                        moverArrastePeloCirculo(
                          event.nativeEvent.pageX,
                          event.nativeEvent.pageY,
                          aba.rota
                        );
                      }}
                      onResponderRelease={() => {
                        if (
                          ativo &&
                          aba.rota === 'HomePaciente' &&
                          !arrasteMovidoRef.current
                        ) {
                          rotaArrastadaRef.current = null;
                          arrastePeloCirculoRef.current = false;
                          handlePressInicio();
                          return;
                        }

                        if (ativo && aba.rota === 'HomePaciente' && menuRapidoVisivel) {
                          const acaoFinal = acaoRapidaEmFoco;
                          rotaArrastadaRef.current = null;
                          arrastePeloCirculoRef.current = false;
                          arrasteMovidoRef.current = false;
                          direcaoArrasteRef.current = null;

                          if (acaoFinal) {
                            acionarMenuRapido(acaoFinal);
                            return;
                          }

                          if (menuRapidoAbertoNoInicioRef.current) {
                            setMenuRapidoVisivel(false);
                            setAcaoRapidaEmFoco(null);
                          }

                          menuRapidoAbertoNoInicioRef.current = false;
                          return;
                        }

                        finalizarArrastePeloCirculo();
                      }}
                      onResponderTerminate={() => {
                        rotaArrastadaRef.current = null;
                        arrastePeloCirculoRef.current = false;
                        arrasteMovidoRef.current = false;
                        direcaoArrasteRef.current = null;
                        menuRapidoAbertoNoInicioRef.current = false;
                        setAcaoRapidaEmFoco(null);
                        setRotaVisual(rotaAtual);
                      }}
                    >
                      <View
                        style={[
                          styles.iconeAbaInner,
                          ativo && styles.iconeAbaInnerAtivo,
                        ]}
                      >
                        {ativo && aba.rota === 'HomePaciente' && menuRapidoVisivel ? (
                          <Ionicons name="close" size={24} color={TAB_HIGHLIGHT_COLOR} />
                        ) : (
                          <IconeAba aba={aba} ativo={ativo} />
                        )}
                      </View>
                      {ativo ? (
                        <Text style={styles.rotuloAbaDentroAtivo}>
                          {aba.rota === 'HomePaciente' && menuRapidoVisivel ? 'Fechar' : aba.rotulo}
                        </Text>
                      ) : null}
                    </View>
                    {!ativo ? <Text style={styles.rotuloAba}>{aba.rotulo}</Text> : null}
                  </>
                );
              }}
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
    backgroundColor: temaPaciente.cores.fundo,
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF',
  },
  menuRapidoBackdrop: {
    position: 'absolute',
    left: 0,
    bottom: -PATIENT_TAB_BAR_HEIGHT,
    zIndex: 42,
  },
  menuRapidoBlur: {
    flex: 1,
  },
  menuRapidoCinza: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(72,78,84,0.36)',
  },
  menuRapido: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: QUICK_MENU_BOTTOM,
    gap: QUICK_ACTION_GAP,
    alignItems: 'center',
    zIndex: 70,
  },
  menuRapidoItem: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    minWidth: 170,
    minHeight: QUICK_ACTION_ITEM_HEIGHT,
    paddingVertical: 2,
  },
  menuRapidoItemFocado: {
    opacity: 1,
  },
  menuRapidoTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  menuRapidoTextoFocado: {
    color: TAB_HIGHLIGHT_COLOR,
    fontSize: 16,
  },
  menuRapidoIcone: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 27,
    height: QUICK_ACTION_CIRCLE_SIZE,
    justifyContent: 'center',
    shadowColor: '#1F262C',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    width: QUICK_ACTION_CIRCLE_SIZE,
    elevation: 8,
  },
  menuRapidoIconeFocado: {
    borderColor: TAB_HIGHLIGHT_COLOR,
    borderWidth: 1.5,
    shadowColor: TAB_HIGHLIGHT_COLOR,
    shadowOpacity: 0.58,
    shadowRadius: 12,
    transform: [{ scale: 1.18 }],
  },
  barra: {
    width: '100%',
    minHeight: 58,
    paddingTop: 1,
    paddingBottom: 3,
    paddingHorizontal: 6,
    backgroundColor: temaPaciente.cores.fundo,
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




