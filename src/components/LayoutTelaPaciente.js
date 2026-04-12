import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import BarraAbasPaciente, { PATIENT_TAB_BAR_SPACE } from './BarraAbasPaciente';
import BotaoVoltar from './BotaoVoltar';
import { temaPaciente, sombraPaciente } from '../theme/temaPaciente';

export default function LayoutTelaPaciente({
  navigation,
  route,
  usuarioLogado,
  titulo,
  subtitulo,
  title,
  subtitle,
  children,
  acaoDireita,
  rightAction,
  mostrarVoltar = true,
  estiloConteudo,
  contentContainerStyle,
  mostrarBarraAbas = true,
  rolavel = true,
}) {
  const tituloTela = titulo || title;
  const subtituloTela = subtitulo || subtitle;
  const acaoCabecalho = acaoDireita || rightAction;

  const cabecalho = (
    <View style={styles.cabecalho}>
      <View style={styles.topoCabecalho}>
        {mostrarVoltar ? (
          <BotaoVoltar navigation={navigation} fallbackRoute="HomePaciente" />
        ) : (
          <View style={styles.insigniaPaciente}>
            <View style={styles.pontoOnline} />
            <Text style={styles.textoInsignia}>Paciente conectado</Text>
          </View>
        )}

        <View style={styles.acaoDireita}>{acaoCabecalho || null}</View>
      </View>

      <View style={styles.cartaoCabecalho}>
        <Text style={styles.titulo}>{tituloTela}</Text>
        {subtituloTela ? <Text style={styles.subtitulo}>{subtituloTela}</Text> : null}
      </View>
    </View>
  );

  const corpo = (
    <View style={[styles.conteudo, estiloConteudo, contentContainerStyle]}>
      {cabecalho}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={temaPaciente.cores.fundo} />

      <View pointerEvents="none" style={styles.decoracao}>
        <View style={styles.bolhaCreme} />
        <View style={styles.bolhaVerde} />
        <View style={styles.bolhaMenta} />
      </View>

      {rolavel ? (
        <ScrollView
          style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
          contentContainerStyle={[
            styles.scrollConteudo,
            mostrarBarraAbas && styles.scrollConteudoComBarra,
            Platform.OS === 'web' && styles.webScrollConteudo,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {corpo}
        </ScrollView>
      ) : (
        <View style={[styles.conteudoFixo, mostrarBarraAbas && styles.conteudoFixoComBarra]}>
          {corpo}
        </View>
      )}

      {mostrarBarraAbas ? (
        <BarraAbasPaciente
          navigation={navigation}
          rotaAtual={route?.name}
          usuarioLogado={usuarioLogado}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    backgroundColor: temaPaciente.cores.fundo,
  },
  decoracao: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 300,
  },
  bolhaCreme: {
    position: 'absolute',
    top: -38,
    left: -24,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: temaPaciente.cores.fundoCreme,
  },
  bolhaVerde: {
    position: 'absolute',
    top: 12,
    right: -18,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: temaPaciente.cores.primariaClara,
  },
  bolhaMenta: {
    position: 'absolute',
    top: 126,
    right: 56,
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: temaPaciente.cores.secundaria,
    opacity: 0.45,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  webScroll: {
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  scrollConteudo: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  scrollConteudoComBarra: {
    paddingBottom: PATIENT_TAB_BAR_SPACE + 18,
  },
  webScrollConteudo: {
    flexGrow: 0,
    minHeight: '100%',
  },
  conteudoFixo: {
    flex: 1,
    minHeight: 0,
    paddingBottom: 32,
  },
  conteudoFixoComBarra: {
    paddingBottom: PATIENT_TAB_BAR_SPACE + 18,
  },
  conteudo: {
    paddingHorizontal: temaPaciente.espacos.tela,
  },
  cabecalho: {
    paddingTop: 8,
    marginBottom: 16,
  },
  topoCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insigniaPaciente: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: temaPaciente.raios.pill,
    backgroundColor: temaPaciente.cores.superficie,
    borderWidth: 1,
    borderColor: temaPaciente.cores.borda,
    flexDirection: 'row',
    alignItems: 'center',
    ...sombraPaciente,
  },
  pontoOnline: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: temaPaciente.cores.primariaForte,
    marginRight: 8,
  },
  textoInsignia: {
    color: temaPaciente.cores.texto,
    fontSize: 13,
    fontWeight: '700',
  },
  acaoDireita: {
    marginLeft: 12,
    minWidth: 44,
    alignItems: 'flex-end',
  },
  cartaoCabecalho: {
    marginTop: 16,
    padding: temaPaciente.espacos.cartao,
    borderRadius: temaPaciente.raios.xl,
    backgroundColor: temaPaciente.cores.superficie,
    borderWidth: 1,
    borderColor: temaPaciente.cores.borda,
    ...sombraPaciente,
  },
  titulo: {
    fontSize: 30,
    fontWeight: '800',
    color: temaPaciente.cores.texto,
  },
  subtitulo: {
    marginTop: 8,
    color: temaPaciente.cores.textoSuave,
    fontSize: 14,
    lineHeight: 21,
  },
});
