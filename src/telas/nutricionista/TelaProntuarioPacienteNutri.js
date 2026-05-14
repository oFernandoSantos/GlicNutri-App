import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../servicos/configSupabase';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import EstadoErroCarregamento from '../../componentes/comum/EstadoErroCarregamento';
import MensagemInline from '../../componentes/comum/MensagemInline';
import {
  createProntuarioNota,
  fetchNutriProntuario,
} from '../../servicos/servicoProntuarioNutri';
import { mlPredict } from '../../servicos/servicoMlLocal';
import { buildTypicalDayFeaturesForMl } from '../../servicos/servicoAgregacaoFeaturesMl';
import {
  rankDietTemplatesFromMlPrediction,
  buildProntuarioNotaSugestaoDieta,
} from '../../servicos/servicoSugestaoDietaMl';
import { getDietaById } from '../../constantes/dietasReferenciaNutricional';
import {
  disableOtherMealPlansForPatient,
  fetchActiveMealPlanForPatient,
  upsertMealPlan,
} from '../../servicos/servicoPlanoAlimentar';

function SectionCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function formatTimelineTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function getNutriId(usuarioLogado) {
  return usuarioLogado?.id_nutricionista_uuid || usuarioLogado?.id || null;
}

export default function TelaProntuarioPacienteNutri({ navigation, route }) {
  const { usuarioLogado, pacienteId, paciente } = route.params || {};
  const nutricionistaId = useMemo(() => getNutriId(usuarioLogado), [usuarioLogado]);
  const effectivePacienteId = pacienteId || paciente?.id_paciente_uuid || null;

  const [loading, setLoading] = useState(true);
  const [patientRow, setPatientRow] = useState(paciente || null);
  const [timeline, setTimeline] = useState([]);
  const [mealPlan, setMealPlan] = useState(null);
  const [planTitle, setPlanTitle] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [noteText, setNoteText] = useState('');
  const [activeTab, setActiveTab] = useState('timeline'); // timeline | plan | diets | notes
  const [loadError, setLoadError] = useState(null);
  const [mensagemBanner, setMensagemBanner] = useState(null);
  const [prontuarioBundle, setProntuarioBundle] = useState({
    glucoseReadings: [],
    meals: [],
    medications: [],
  });
  const [janelaDias, setJanelaDias] = useState(14);
  const [agregadoMl, setAgregadoMl] = useState(null);
  const [rankingDietas, setRankingDietas] = useState(null);
  const [mlCarregando, setMlCarregando] = useState(false);
  const [dietaSelecionadaId, setDietaSelecionadaId] = useState(null);
  const [comentarioDieta, setComentarioDieta] = useState('');

  const canLoad = Boolean(effectivePacienteId);

  const load = useCallback(async () => {
    if (!effectivePacienteId) return;

    try {
      setLoading(true);

      const [patientResp, prontuario, activePlan] = await Promise.all([
        supabase
          .from('paciente')
          .select('*')
          .eq('id_paciente_uuid', effectivePacienteId)
          .maybeSingle(),
        fetchNutriProntuario({
          pacienteId: effectivePacienteId,
          nutricionistaId,
          limit: 220,
        }),
        fetchActiveMealPlanForPatient(effectivePacienteId),
      ]);

      if (patientResp?.error) {
        throw patientResp.error;
      }

      setPatientRow(patientResp?.data || null);
      setProntuarioBundle({
        glucoseReadings: prontuario?.glucoseReadings || [],
        meals: prontuario?.meals || [],
        medications: prontuario?.medications || [],
      });
      setTimeline(prontuario?.timeline || []);
      setMealPlan(activePlan || null);
      setPlanTitle(String(activePlan?.titulo || 'Plano alimentar'));
      setPlanDescription(String(activePlan?.descricao || ''));
      setLoadError(null);
    } catch (error) {
      console.log('Erro ao carregar prontuario:', error);
      setLoadError(
        'Não foi possível carregar o prontuário. Verifique a conexão e tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  }, [effectivePacienteId, nutricionistaId]);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', () => load());
    return unsubscribe;
  }, [navigation, load]);

  async function handleSavePlan() {
    try {
      if (!nutricionistaId) {
        setMensagemBanner({ tipo: 'aviso', texto: 'Nutricionista sem identificador.' });
        return;
      }

      const saved = await upsertMealPlan({
        id: mealPlan?.id,
        nutricionistaId,
        pacienteId: effectivePacienteId,
        titulo: planTitle,
        descricao: planDescription,
        metas: mealPlan?.metas || null,
        inicioEm: mealPlan?.inicio_em || null,
        fimEm: mealPlan?.fim_em || null,
        ativo: true,
        actor: usuarioLogado,
      });

      await disableOtherMealPlansForPatient({
        pacienteId: effectivePacienteId,
        exceptId: saved?.id,
        actor: usuarioLogado,
      });

      setMealPlan(saved);
      setMensagemBanner({
        tipo: 'sucesso',
        texto: 'Plano alimentar salvo e publicado para o paciente.',
      });
    } catch (error) {
      console.log('Erro ao salvar plano:', error);
      setMensagemBanner({
        tipo: 'erro',
        texto:
          error?.message ||
          'Não foi possível salvar o plano. Verifique a conexão e tente novamente.',
      });
    }
  }

  async function handleRodarMlDietas() {
    try {
      setMlCarregando(true);
      setMensagemBanner(null);
      const agg = buildTypicalDayFeaturesForMl({
        ...prontuarioBundle,
        windowDays: janelaDias,
      });
      setAgregadoMl(agg);
      const pred = await mlPredict(agg.features);
      const ranked = rankDietTemplatesFromMlPrediction(pred, agg.features);
      setRankingDietas(ranked);
      setDietaSelecionadaId(ranked.primaryId);
    } catch (error) {
      console.log('Erro ML dietas:', error);
      setMensagemBanner({
        tipo: 'erro',
        texto:
          error?.message ||
          'Nao foi possivel contatar a API de ML. Inicie uvicorn (porta 8001) ou verifique a rede.',
      });
    } finally {
      setMlCarregando(false);
    }
  }

  async function handleSalvarSugestaoDietaProntuario() {
    try {
      if (!nutricionistaId) {
        setMensagemBanner({ tipo: 'aviso', texto: 'Nutricionista sem identificador.' });
        return;
      }
      const dieta = getDietaById(dietaSelecionadaId);
      if (!dieta) {
        setMensagemBanner({ tipo: 'aviso', texto: 'Selecione um padrao alimentar na lista.' });
        return;
      }
      const texto = buildProntuarioNotaSugestaoDieta({
        dietaSelecionada: dieta,
        rankedSnapshot: rankingDietas,
        comentarioNutri: comentarioDieta,
        windowDays: agregadoMl?.janelaDias ?? janelaDias,
        diasComDados: agregadoMl?.diasComDados ?? 0,
      });
      await createProntuarioNota({
        nutricionistaId,
        pacienteId: effectivePacienteId,
        consultaId: null,
        texto,
      });
      setComentarioDieta('');
      await load();
      setActiveTab('timeline');
      setMensagemBanner({
        tipo: 'sucesso',
        texto: 'Sugestao registrada no prontuario como nota.',
      });
    } catch (error) {
      setMensagemBanner({
        tipo: 'erro',
        texto: error?.message || 'Nao foi possivel salvar a sugestao.',
      });
    }
  }

  async function handleAddNote() {
    try {
      if (!nutricionistaId) {
        setMensagemBanner({ tipo: 'aviso', texto: 'Nutricionista sem identificador.' });
        return;
      }
      if (!noteText.trim()) {
        setMensagemBanner({ tipo: 'aviso', texto: 'Digite uma nota.' });
        return;
      }
      await createProntuarioNota({
        nutricionistaId,
        pacienteId: effectivePacienteId,
        consultaId: null,
        texto: noteText,
      });
      setNoteText('');
      await load();
      setActiveTab('timeline');
    } catch (error) {
      setMensagemBanner({
        tipo: 'erro',
        texto:
          error?.message ||
          'Não foi possível salvar a nota. Verifique a conexão e tente novamente.',
      });
    }
  }

  const headerName = patientRow?.nome_completo || 'Paciente';
  const headerMeta = patientRow?.email_pac || patientRow?.cpf_paciente || '';

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

      <ScrollView
        style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
        contentContainerStyle={[styles.content, Platform.OS === 'web' && styles.webContent]}
        showsVerticalScrollIndicator={false}
      >
        {mensagemBanner?.texto ? (
          <MensagemInline
            tipo={mensagemBanner.tipo || 'aviso'}
            texto={mensagemBanner.texto}
            onFechar={() => setMensagemBanner(null)}
            autoOcultarMs={mensagemBanner.tipo === 'sucesso' ? 4000 : 0}
          />
        ) : null}

        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color={patientTheme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title} numberOfLines={1}>
              {headerName}
            </Text>
            {headerMeta ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {headerMeta}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={load} disabled={loading}>
            <Ionicons name="refresh-outline" size={20} color={patientTheme.colors.text} />
          </TouchableOpacity>
        </View>

        {!canLoad ? (
          <SectionCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Paciente nao identificado</Text>
            <Text style={styles.emptyText}>
              Abra este prontuario a partir da lista de pacientes.
            </Text>
          </SectionCard>
        ) : null}

        {loading ? (
          <SectionCard style={styles.loadingCard}>
            <ActivityIndicator color={patientTheme.colors.primaryDark} />
            <Text style={styles.loadingText}>Carregando prontuario...</Text>
          </SectionCard>
        ) : loadError ? (
          <EstadoErroCarregamento onTentarNovamente={load} loading={loading} />
        ) : null}

        {!loadError ? (
        <>
        <View style={styles.tabRow}>
          {[
            { key: 'timeline', label: 'Registros' },
            { key: 'plan', label: 'Plano' },
            { key: 'diets', label: 'Dietas' },
            { key: 'notes', label: 'Notas' },
          ].map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, active && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'timeline' ? (
          timeline.length ? (
            timeline.map((evt) => (
              <SectionCard key={evt.id} style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {evt.title}
                  </Text>
                  <Text style={styles.eventTime}>{formatTimelineTime(evt.occurredAt)}</Text>
                </View>
                {evt.subtitle ? <Text style={styles.eventSubtitle}>{evt.subtitle}</Text> : null}
                <View style={styles.eventBadgeRow}>
                  <Text style={styles.eventBadge}>
                    {String(evt.kind || '').toUpperCase()}
                  </Text>
                </View>
              </SectionCard>
            ))
          ) : (
            <SectionCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Sem registros ainda</Text>
              <Text style={styles.emptyText}>
                Assim que o paciente registrar glicemia, refeicoes e medicacoes, aparecem aqui.
              </Text>
            </SectionCard>
          )
        ) : null}

        {activeTab === 'diets' ? (
          <SectionCard>
            <Text style={styles.blockTitle}>Sugestao de padroes alimentares</Text>
            <Text style={styles.hintText}>
              O modelo do GlicNutri (mesmo da Previsao IA) estima risco de dia com glicemia media elevada e
              agrupa padroes; esta aba traduz isso em padrões dietéticos de referência. A decisão final é sempre
              do nutricionista.
            </Text>

            <Text style={styles.blockTitle}>Janela de dados (dias)</Text>
            <View style={styles.chipRow}>
              {[7, 14, 30].map((d) => {
                const on = janelaDias === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.chip, on && styles.chipActive]}
                    onPress={() => setJanelaDias(d)}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextActive]}>{d} d</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.secondaryButton, mlCarregando && styles.buttonDisabled]}
              onPress={handleRodarMlDietas}
              disabled={mlCarregando}
            >
              {mlCarregando ? (
                <ActivityIndicator color={patientTheme.colors.primaryDark} />
              ) : (
                <>
                  <Ionicons name="analytics-outline" size={18} color={patientTheme.colors.primaryDark} />
                  <Text style={styles.secondaryButtonText}>Analisar com ML e ordenar dietas</Text>
                </>
              )}
            </TouchableOpacity>

            {agregadoMl ? (
              <View style={styles.metricsBox}>
                <Text style={styles.metricsTitle}>Medias diarias na janela (entrada do modelo)</Text>
                <Text style={styles.metricsLine}>
                  Dias com dados: {agregadoMl.diasComDados} / janela {agregadoMl.janelaDias} dias
                </Text>
                <Text style={styles.metricsLine}>
                  Leituras/dia: {agregadoMl.features.n_leituras_glicemia.toFixed(2)} | Carbos (g/dia):{' '}
                  {agregadoMl.features.carbs_sum_g.toFixed(1)} | kcal/dia:{' '}
                  {agregadoMl.features.kcal_sum.toFixed(0)}
                </Text>
                <Text style={styles.metricsLine}>
                  Refeicoes IA/dia: {agregadoMl.features.n_refeicoes_ia.toFixed(2)} | Eventos medicacao/dia:{' '}
                  {agregadoMl.features.n_eventos_medicacao.toFixed(2)}
                </Text>
              </View>
            ) : null}

            {rankingDietas?.mlResumo ? (
              <View style={styles.metricsBox}>
                <Text style={styles.metricsTitle}>Saida do modelo</Text>
                <Text style={styles.metricsLine}>
                  P(glicemia media elevada):{' '}
                  {(Number(rankingDietas.mlResumo.prob_glucose_elevada) * 100).toFixed(1)}%
                </Text>
                <Text style={styles.metricsLine}>
                  Glicemia media prevista:{' '}
                  {Number(rankingDietas.mlResumo.glucose_mean_previsto_mg_dl).toFixed(1)} mg/dL | Cluster:{' '}
                  {rankingDietas.mlResumo.cluster_id}
                </Text>
              </View>
            ) : null}

            {rankingDietas?.ranked?.length ? (
              <>
                <Text style={[styles.blockTitle, { marginTop: 14 }]}>Ordenacao sugerida (editavel)</Text>
                {rankingDietas.ranked.map((d) => {
                  const sel = dietaSelecionadaId === d.id;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.dietOption, sel && styles.dietOptionSelected]}
                      onPress={() => setDietaSelecionadaId(d.id)}
                    >
                      <View style={styles.dietOptionHeader}>
                        <Ionicons
                          name={sel ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={sel ? patientTheme.colors.primaryDark : patientTheme.colors.textMuted}
                        />
                        <Text style={styles.dietOptionTitle}>{d.titulo}</Text>
                        <Text style={styles.dietScore}>{d.score.toFixed(2)}</Text>
                      </View>
                      <Text style={styles.dietOptionBody}>{d.resumo}</Text>
                      <Text style={styles.dietOptionHint}>{d.quandoConsiderar}</Text>
                    </TouchableOpacity>
                  );
                })}

                <Text style={[styles.blockTitle, { marginTop: 8 }]}>Observacoes (opcional)</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline, { minHeight: 100 }]}
                  value={comentarioDieta}
                  onChangeText={setComentarioDieta}
                  placeholder="Ajustes clinicos, restricoes, proxima revisao..."
                  placeholderTextColor={patientTheme.colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />

                <TouchableOpacity style={styles.primaryButton} onPress={handleSalvarSugestaoDietaProntuario}>
                  <Ionicons name="document-text-outline" size={18} color={patientTheme.colors.onPrimary} />
                  <Text style={styles.primaryButtonText}>Registrar selecao no prontuario</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.hintText}>
                Toque em &quot;Analisar com ML&quot; para gerar a ordenacao. Sem API local, use a Previsao IA no
                paciente para confirmar se o servidor responde.
              </Text>
            )}
          </SectionCard>
        ) : null}

        {activeTab === 'plan' ? (
          <SectionCard>
            <Text style={styles.blockTitle}>Titulo</Text>
            <TextInput
              style={styles.input}
              value={planTitle}
              onChangeText={setPlanTitle}
              placeholder="Plano alimentar"
              placeholderTextColor={patientTheme.colors.textMuted}
            />

            <Text style={styles.blockTitle}>Descricao</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={planDescription}
              onChangeText={setPlanDescription}
              placeholder="Escreva as orientacoes do paciente aqui..."
              placeholderTextColor={patientTheme.colors.textMuted}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleSavePlan}>
              <Ionicons name="save-outline" size={18} color={patientTheme.colors.onPrimary} />
              <Text style={styles.primaryButtonText}>Salvar e publicar</Text>
            </TouchableOpacity>
          </SectionCard>
        ) : null}

        {activeTab === 'notes' ? (
          <SectionCard>
            <Text style={styles.blockTitle}>Nova nota</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Escreva uma observacao clinica, conduta, ajustes..."
              placeholderTextColor={patientTheme.colors.textMuted}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleAddNote}>
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={patientTheme.colors.onPrimary}
              />
              <Text style={styles.primaryButtonText}>Salvar nota</Text>
            </TouchableOpacity>
          </SectionCard>
        ) : null}

        <View style={{ height: 26 }} />
        </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: patientTheme.colors.background },
  containerWeb: { minHeight: '100%', overflow: 'visible' },
  scroll: { flex: 1 },
  webScroll: { overflowY: 'visible', overflowX: 'hidden' },
  content: { padding: patientTheme.spacing.screen, paddingBottom: 32, flexGrow: 1 },
  webContent: { minHeight: '100%' },
  card: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, fontWeight: '900', color: patientTheme.colors.text },
  subtitle: { marginTop: 4, color: patientTheme.colors.textMuted, fontWeight: '600' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  loadingCard: { marginTop: 16, alignItems: 'center', gap: 10 },
  loadingText: { color: patientTheme.colors.textMuted, fontWeight: '600' },
  emptyCard: { marginTop: 16, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: patientTheme.colors.text },
  emptyText: { marginTop: 8, textAlign: 'center', color: patientTheme.colors.textMuted, lineHeight: 20 },
  tabRow: {
    marginTop: 18,
    marginBottom: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tabButton: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    minHeight: 44,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  tabButtonActive: { backgroundColor: patientTheme.colors.primaryDark },
  tabText: { fontWeight: '900', color: patientTheme.colors.textMuted },
  tabTextActive: { color: patientTheme.colors.onPrimary },
  eventCard: { marginBottom: 12 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  eventTitle: { flex: 1, fontWeight: '900', color: patientTheme.colors.text },
  eventTime: { color: patientTheme.colors.textMuted, fontWeight: '800', fontSize: 12 },
  eventSubtitle: { marginTop: 10, color: patientTheme.colors.textMuted, lineHeight: 20 },
  eventBadgeRow: { marginTop: 12 },
  eventBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primarySoft,
    color: patientTheme.colors.primaryDark,
    fontWeight: '900',
    fontSize: 11,
  },
  blockTitle: { marginTop: 4, marginBottom: 8, fontWeight: '900', color: patientTheme.colors.text },
  input: {
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.backgroundSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: patientTheme.colors.text,
    marginBottom: 12,
  },
  inputMultiline: { minHeight: 160 },
  primaryButton: {
    marginTop: 6,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: { color: patientTheme.colors.onPrimary, fontWeight: '900' },
  hintText: {
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: '600',
    fontSize: 13,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  chipActive: { backgroundColor: patientTheme.colors.primarySoft },
  chipText: { fontWeight: '800', color: patientTheme.colors.textMuted },
  chipTextActive: { color: patientTheme.colors.primaryDark },
  secondaryButton: {
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    borderWidth: 2,
    borderColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  secondaryButtonText: { color: patientTheme.colors.primaryDark, fontWeight: '900' },
  buttonDisabled: { opacity: 0.55 },
  metricsBox: {
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  metricsTitle: { fontWeight: '900', color: patientTheme.colors.text, marginBottom: 6 },
  metricsLine: { color: patientTheme.colors.textMuted, fontWeight: '600', fontSize: 12, marginTop: 4 },
  dietOption: {
    borderWidth: 1,
    borderColor: patientTheme.colors.backgroundSoft,
    borderRadius: patientTheme.radius.lg,
    padding: 12,
    marginBottom: 10,
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  dietOptionSelected: {
    borderColor: patientTheme.colors.primaryDark,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  dietOptionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dietOptionTitle: { flex: 1, fontWeight: '900', color: patientTheme.colors.text },
  dietScore: { fontWeight: '900', color: patientTheme.colors.textMuted, fontSize: 12 },
  dietOptionBody: { marginTop: 8, color: patientTheme.colors.text, lineHeight: 20, fontWeight: '600' },
  dietOptionHint: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});

