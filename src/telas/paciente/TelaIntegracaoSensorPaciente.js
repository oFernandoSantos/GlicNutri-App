import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import MensagemInline from '../../componentes/comum/MensagemInline';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  addGlucoseReading,
  fetchGlucoseReadings,
  getPatientId,
  refreshPatientGlucoseReadings,
} from '../../servicos/servicoDadosPaciente';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import {
  getCachedGlucoseReadings,
  mergeCachedGlucoseReadings,
  buildGlucoseFingerprint,
} from '../../servicos/centralGlicose';
import { executarEmLotes } from '../../utilitarios/carregamentoTela';
import {
  clearLibreLinkUpCredentials,
  DEFAULT_LIBRE_API_REGION,
  isLibreViewSyncConfigured,
  loadLibreLinkUpCredentials,
  parseLibreViewExportText,
  saveLibreLinkUpCredentials,
} from '../../servicos/servicoLibreView';
import {
  hasLibreLinkUpLinked,
  startLibreViewAutoSync,
  stopLibreViewAutoSync,
  buildLibreSyncFeedback,
  syncLinkedLibreViewReadings,
} from '../../servicos/servicoLibreViewAutoSync';
import { AppLogger, MODULOS_LOG_SISTEMA } from '../../servicos/servicoLogSistema';
import {
  LIBRE_BLUE,
  LIBRE_BLUE_MUTED,
  LIBRE_BLUE_PLACEHOLDER,
  LIBRE_BLUE_SOFT,
  LIBRE_YELLOW,
} from '../../temas/coresLibre';

const CONTENT_MAX_WIDTH = 520;
const H_PADDING = patientTheme.spacing.screen;
const SECTION_GAP = 12;
const INTEGRACAO_SENSOR_HERO = require('../../../assets/imagens/freestyle-libre2-playstore.png');

function getContentWidth(windowWidth) {
  return Math.min(windowWidth, CONTENT_MAX_WIDTH);
}

function isKnownReading(reading, existingReadings) {
  const fingerprint = buildGlucoseFingerprint(reading);
  return existingReadings.some((item) => buildGlucoseFingerprint(item) === fingerprint);
}

export default function PacienteIntegracaoSensorScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const patientEmail = usuarioLogado?.email_pac || usuarioLogado?.email || '';

  const [libreLinkEmail, setLibreLinkEmail] = useState('');
  const [libreLinkPassword, setLibreLinkPassword] = useState('');
  const [libreLinkLinked, setLibreLinkLinked] = useState(false);
  const [libreLinkSaving, setLibreLinkSaving] = useState(false);
  const [syncingLibreView, setSyncingLibreView] = useState(false);
  const [libreViewImporting, setLibreViewImporting] = useState(false);
  const [libreViewImportText, setLibreViewImportText] = useState('');
  const [libreManualImportVisible, setLibreManualImportVisible] = useState(false);
  const [loadingCredentials, setLoadingCredentials] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = getContentWidth(windowWidth);
  const heroImageSize = Math.min(Math.round(contentWidth * 0.36), 168);

  const loadLinkedState = useCallback(async () => {
    if (!patientId) {
      setLibreLinkLinked(false);
      setLoadingCredentials(false);
      return;
    }

    setLoadingCredentials(true);

    try {
      const linked = await hasLibreLinkUpLinked(patientId);
      setLibreLinkLinked(linked);

      if (linked) {
        const saved = await loadLibreLinkUpCredentials(patientId);
        if (saved?.email) {
          setLibreLinkEmail(saved.email);
        }
      }
    } finally {
      setLoadingCredentials(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadLinkedState();
  }, [loadLinkedState]);

  useLayoutEffect(() => {
    navigation.setOptions({
      readerTitle: 'Integração do sensor',
      readerBackgroundColor: LIBRE_YELLOW,
      readerAccentColor: LIBRE_BLUE,
      cardStyle: { backgroundColor: LIBRE_YELLOW },
    });

    return () => {
      navigation.setOptions({
        readerTitle: null,
        readerBackgroundColor: null,
        readerAccentColor: null,
        cardStyle: undefined,
      });
    };
  }, [navigation]);

  async function importLibreViewReadings(readings, sourceLabel = 'libreview_import') {
    const monitorLimits = mesclarLimitesDadosPaciente('monitoramento');
    const glucoseLimit = monitorLimits.glucoseLimit || 60;
    const existingReadings = mergeCachedGlucoseReadings(
      await fetchGlucoseReadings(patientId, glucoseLimit, usuarioLogado).catch(() => []),
      getCachedGlucoseReadings(patientId)
    );
    const newReadings = readings.filter((reading) => !isKnownReading(reading, existingReadings));

    await executarEmLotes(newReadings, 5, (reading) =>
      addGlucoseReading(patientId, reading.value, {
        date: reading.date,
        time: reading.time,
        actor: usuarioLogado,
        auditSource: sourceLabel,
      })
    );

    await refreshPatientGlucoseReadings(patientId, {
      patientContext: usuarioLogado,
      glucoseLimit,
    });

    return newReadings;
  }

  function handlePickLibreViewFile() {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setFeedback({
        tipo: 'aviso',
        texto: 'No celular, copie e cole o CSV exportado do LibreView no campo abaixo.',
      });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,text/csv,text/plain';
    input.onchange = () => {
      const [file] = Array.from(input.files || []);
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => setLibreViewImportText(String(reader.result || ''));
      reader.readAsText(file);
    };
    input.click();
  }

  async function handleImportLibreViewText() {
    if (!patientId) {
      setFeedback({
        tipo: 'aviso',
        texto: 'Paciente sem identificador para importar o LibreView.',
      });
      return;
    }

    const parsedReadings = parseLibreViewExportText(libreViewImportText);

    if (!parsedReadings.length) {
      setFeedback({
        tipo: 'aviso',
        texto: 'Nao encontramos leituras validas no conteudo do LibreView.',
      });
      return;
    }

    try {
      setLibreViewImporting(true);
      const newReadings = await importLibreViewReadings(parsedReadings, 'libreview_csv_import');
      setLibreViewImportText('');
      setFeedback({
        tipo: 'sucesso',
        texto: newReadings.length
          ? `LibreView: ${newReadings.length} leitura(s) importada(s) do arquivo.`
          : 'Importacao concluida: nenhuma leitura nova encontrada.',
      });
    } catch (error) {
      console.log('Erro ao importar LibreView:', error);
      setFeedback({
        tipo: 'erro',
        texto: 'Nao foi possivel importar o arquivo do LibreView agora.',
      });
      AppLogger.erro(MODULOS_LOG_SISTEMA.GLICEMIA, 'Importacao LibreView', error, {
        usuario: usuarioLogado,
        complemento: 'Falha ao importar CSV/texto do LibreView',
      });
    } finally {
      setLibreViewImporting(false);
    }
  }

  async function handleLinkLibreLinkUp() {
    if (!patientId) {
      setFeedback({
        tipo: 'aviso',
        texto: 'Paciente sem identificador para vincular o sensor.',
      });
      return;
    }

    const email = String(libreLinkEmail || '').trim();
    const password = String(libreLinkPassword || '');

    if (!email || !password) {
      setFeedback({
        tipo: 'aviso',
        texto: 'Informe e-mail e senha da conta LibreLinkUp.',
      });
      return;
    }

    try {
      setLibreLinkSaving(true);
      await saveLibreLinkUpCredentials(patientId, {
        email,
        password,
        region: DEFAULT_LIBRE_API_REGION,
      });

      const result = await syncLinkedLibreViewReadings({
        patientId,
        patientEmail,
        actor: usuarioLogado,
        credentials: { email, password, region: DEFAULT_LIBRE_API_REGION },
        silent: false,
        force: true,
      });

      setLibreLinkLinked(true);
      setLibreLinkPassword('');

      startLibreViewAutoSync({
        patientId,
        patientEmail,
        actor: usuarioLogado,
        runImmediately: false,
      });

      setFeedback({
        tipo: 'sucesso',
        texto: buildLibreSyncFeedback(result, { linking: true }),
      });
    } catch (error) {
      console.log('Erro ao vincular LibreLinkUp:', error);
      setFeedback({
        tipo: 'erro',
        texto:
          error?.message ||
          'Nao foi possivel vincular o LibreLinkUp. Verifique e-mail, senha e compartilhamento.',
      });
    } finally {
      setLibreLinkSaving(false);
    }
  }

  async function handleUnlinkLibreLinkUp() {
    if (!patientId) return;

    await clearLibreLinkUpCredentials(patientId);
    stopLibreViewAutoSync();
    setLibreLinkEmail('');
    setLibreLinkPassword('');
    setLibreLinkLinked(false);
    setFeedback({
      tipo: 'sucesso',
      texto: 'Conta LibreLinkUp desvinculada deste aparelho.',
    });
  }

  async function handleSyncLibreView() {
    if (!patientId) {
      setFeedback({
        tipo: 'aviso',
        texto: 'Paciente sem identificador para sincronizar o sensor.',
      });
      return;
    }

    if (!libreLinkLinked) {
      setFeedback({
        tipo: 'aviso',
        texto: 'Vincule sua conta LibreLinkUp antes de sincronizar.',
      });
      return;
    }

    if (!isLibreViewSyncConfigured()) {
      setFeedback({
        tipo: 'erro',
        texto: 'Sincronizacao indisponivel. Configure EXPO_PUBLIC_SUPABASE_URL no app.',
      });
      return;
    }

    try {
      setSyncingLibreView(true);
      const result = await syncLinkedLibreViewReadings({
        patientId,
        patientEmail,
        actor: usuarioLogado,
        silent: false,
        force: true,
      });

      setFeedback({
        tipo: result?.fetched || result?.imported ? 'sucesso' : 'aviso',
        texto: buildLibreSyncFeedback(result),
      });
    } catch (error) {
      console.log('Erro ao sincronizar LibreView:', error);
      setFeedback({
        tipo: 'erro',
        texto:
          error?.message ||
          'Nao foi possivel sincronizar o LibreView. Verifique a conexao e tente novamente.',
      });
    } finally {
      setSyncingLibreView(false);
    }
  }

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      showTabBar={false}
      keyboardAware
      backgroundColor={LIBRE_YELLOW}
      contentContainerStyle={styles.screenContent}
    >
      <View style={styles.page}>
        <View style={styles.heroSection}>
          <Image
            source={INTEGRACAO_SENSOR_HERO}
            style={[styles.heroImage, { width: heroImageSize, height: heroImageSize }]}
            resizeMode="contain"
          />
          <Text style={styles.heroSubtitle}>
            Conecte seu FreeStyle Libre via LibreLinkUp para importar leituras automaticamente na
            tela de glicose.
          </Text>
          {libreLinkLinked ? (
            <View style={styles.linkedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={LIBRE_BLUE} />
              <Text style={styles.linkedBadgeText}>Sensor vinculado · sync a cada 5 min</Text>
            </View>
          ) : null}
        </View>

        {feedback?.texto ? (
          <View style={styles.section}>
            <MensagemInline
              tipo={feedback.tipo}
              texto={feedback.texto}
              onFechar={() => setFeedback(null)}
            />
          </View>
        ) : null}

        <View style={styles.card}>
        <Text style={styles.cardTitle}>Acesso LibreLinkUp</Text>
        <Text style={styles.cardText}>
          Use o e-mail e a senha da conta LibreLinkUp em que o sensor esta compartilhado. Depois de
          vincular, o app sincroniza sozinho enquanto estiver aberto.
        </Text>

        {loadingCredentials ? (
          <ActivityIndicator color={LIBRE_BLUE} style={styles.loadingIndicator} />
        ) : (
          <>
            <Text style={styles.fieldLabel}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={libreLinkEmail}
              onChangeText={setLibreLinkEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="E-mail LibreLinkUp"
              placeholderTextColor={LIBRE_BLUE_PLACEHOLDER}
              editable={!libreLinkSaving}
            />

            <Text style={styles.fieldLabel}>Senha</Text>
            <TextInput
              style={styles.input}
              value={libreLinkPassword}
              onChangeText={setLibreLinkPassword}
              secureTextEntry
              placeholder={libreLinkLinked ? 'Informe para alterar a senha' : 'Senha LibreLinkUp'}
              placeholderTextColor={LIBRE_BLUE_PLACEHOLDER}
              editable={!libreLinkSaving}
            />

            <TouchableOpacity
              style={[
                styles.primaryButton,
                ((!libreLinkEmail.trim() || !libreLinkPassword) || libreLinkSaving) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleLinkLibreLinkUp}
              disabled={!libreLinkEmail.trim() || !libreLinkPassword || libreLinkSaving}
            >
              {libreLinkSaving ? (
                <ActivityIndicator color={LIBRE_YELLOW} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {libreLinkLinked ? 'Atualizar vinculo' : 'Vincular sensor'}
                </Text>
              )}
            </TouchableOpacity>

            {libreLinkLinked ? (
              <>
                <TouchableOpacity
                  style={[styles.secondaryButton, syncingLibreView && styles.buttonDisabled]}
                  onPress={handleSyncLibreView}
                  disabled={syncingLibreView}
                >
                  {syncingLibreView ? (
                    <ActivityIndicator color={LIBRE_BLUE} />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={18} color={LIBRE_BLUE} />
                      <Text style={styles.secondaryButtonText}>Sincronizar agora</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.unlinkButton} onPress={handleUnlinkLibreLinkUp}>
                  <Text style={styles.unlinkButtonText}>Desvincular conta</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </>
        )}
      </View>

      <View style={[styles.card, styles.cardCompact]}>
        <TouchableOpacity
          style={styles.manualToggle}
          onPress={() => setLibreManualImportVisible((current) => !current)}
        >
          <View style={styles.manualToggleCopy}>
            <Ionicons name="document-text-outline" size={20} color={LIBRE_BLUE} />
            <Text style={styles.manualToggleTitle}>Importacao manual (CSV)</Text>
          </View>
          <Ionicons
            name={libreManualImportVisible ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={LIBRE_BLUE_MUTED}
          />
        </TouchableOpacity>

        {libreManualImportVisible ? (
          <View style={styles.manualSection}>
            <Text style={styles.cardText}>
              Exporte o historico no LibreView e cole o conteudo CSV abaixo, ou escolha o arquivo no
              navegador.
            </Text>

            <TouchableOpacity style={styles.fileButton} onPress={handlePickLibreViewFile}>
              <Ionicons name="document-outline" size={18} color={LIBRE_BLUE} />
              <Text style={styles.fileButtonText}>Escolher arquivo</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.textArea}
              multiline
              value={libreViewImportText}
              onChangeText={setLibreViewImportText}
              placeholder="Cole aqui o conteudo CSV/texto exportado do LibreView..."
              placeholderTextColor={LIBRE_BLUE_PLACEHOLDER}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!libreViewImportText.trim() || libreViewImporting) && styles.buttonDisabled,
              ]}
              onPress={handleImportLibreViewText}
              disabled={!libreViewImportText.trim() || libreViewImporting}
            >
              {libreViewImporting ? (
                <ActivityIndicator color={LIBRE_YELLOW} />
              ) : (
                <Text style={styles.primaryButtonText}>Importar leituras</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.tipCard}>
        <Ionicons name="information-circle-outline" size={20} color={LIBRE_BLUE} />
        <Text style={styles.tipText}>
          Se o login falhar, confirme no app Abbott que os termos foram aceitos e que o sensor esta
          compartilhado com a conta LibreLinkUp informada.
        </Text>
      </View>
      </View>
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    alignItems: 'center',
    flexGrow: 0,
    minHeight: undefined,
    paddingBottom: 24,
    paddingHorizontal: 0,
    paddingTop: 0,
    width: '100%',
  },
  page: {
    alignSelf: 'center',
    maxWidth: CONTENT_MAX_WIDTH,
    paddingHorizontal: H_PADDING,
    width: '100%',
  },
  heroSection: {
    alignItems: 'center',
    backgroundColor: LIBRE_YELLOW,
    paddingBottom: SECTION_GAP,
    paddingTop: 4,
    width: '100%',
  },
  heroImage: {
    alignSelf: 'center',
    backgroundColor: LIBRE_YELLOW,
  },
  heroSubtitle: {
    color: LIBRE_BLUE,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 8,
    opacity: 0.92,
    textAlign: 'center',
    width: '100%',
  },
  linkedBadge: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: patientTheme.radius.pill,
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  linkedBadgeText: {
    color: LIBRE_BLUE,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginBottom: SECTION_GAP,
    width: '100%',
  },
  card: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    marginBottom: SECTION_GAP,
    padding: patientTheme.spacing.card,
    width: '100%',
    ...patientShadow,
  },
  cardCompact: {
    paddingVertical: 16,
  },
  cardTitle: {
    color: LIBRE_BLUE,
    fontSize: 17,
    fontWeight: '800',
  },
  cardText: {
    color: LIBRE_BLUE_SOFT,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  fieldLabel: {
    color: LIBRE_BLUE,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 51, 152, 0.14)',
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    color: LIBRE_BLUE,
    fontSize: 15,
    marginTop: 6,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  loadingIndicator: {
    marginTop: 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: LIBRE_BLUE,
    borderRadius: patientTheme.radius.lg,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 50,
  },
  primaryButtonText: {
    color: LIBRE_YELLOW,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 209, 0, 0.28)',
    borderColor: 'rgba(0, 51, 152, 0.12)',
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 48,
  },
  secondaryButtonText: {
    color: LIBRE_BLUE,
    fontSize: 14,
    fontWeight: '700',
  },
  unlinkButton: {
    alignItems: 'center',
    marginTop: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  unlinkButtonText: {
    color: LIBRE_BLUE_MUTED,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  manualToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  manualToggleCopy: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  manualToggleTitle: {
    color: LIBRE_BLUE,
    fontSize: 15,
    fontWeight: '700',
  },
  manualSection: {
    borderTopColor: 'rgba(0, 51, 152, 0.1)',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  fileButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 209, 0, 0.24)',
    borderRadius: patientTheme.radius.lg,
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fileButtonText: {
    color: LIBRE_BLUE,
    fontSize: 13,
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 51, 152, 0.14)',
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    color: LIBRE_BLUE,
    fontSize: 14,
    marginTop: 10,
    minHeight: 112,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tipCard: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: patientTheme.radius.lg,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
    padding: 14,
    width: '100%',
  },
  tipText: {
    color: LIBRE_BLUE,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    opacity: 0.92,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
