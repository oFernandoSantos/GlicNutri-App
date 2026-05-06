import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  createProntuarioNota,
  fetchNutriProntuario,
} from '../../servicos/servicoProntuarioNutri';
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
  const [activeTab, setActiveTab] = useState('timeline'); // timeline | plan | notes

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
      setTimeline(prontuario?.timeline || []);
      setMealPlan(activePlan || null);
      setPlanTitle(String(activePlan?.titulo || 'Plano alimentar'));
      setPlanDescription(String(activePlan?.descricao || ''));
    } catch (error) {
      console.log('Erro ao carregar prontuario:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar o prontuario do paciente.');
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
        Alert.alert('Atencao', 'Nutricionista sem identificador.');
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
      Alert.alert('Sucesso', 'Plano alimentar salvo e publicado para o paciente.');
    } catch (error) {
      console.log('Erro ao salvar plano:', error);
      Alert.alert('Erro', error?.message || 'Nao foi possivel salvar o plano.');
    }
  }

  async function handleAddNote() {
    try {
      if (!nutricionistaId) {
        Alert.alert('Atencao', 'Nutricionista sem identificador.');
        return;
      }
      if (!noteText.trim()) {
        Alert.alert('Atencao', 'Digite uma nota.');
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
      Alert.alert('Erro', error?.message || 'Nao foi possivel salvar a nota.');
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
        ) : null}

        <View style={styles.tabRow}>
          {[
            { key: 'timeline', label: 'Registros' },
            { key: 'plan', label: 'Plano' },
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
    gap: 10,
  },
  tabButton: {
    flex: 1,
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
});

