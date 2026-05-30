import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { nutriTheme as patientTheme, nutriShadow as patientShadow } from '../../temas/temaVisualNutricionista';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import EstadoErroCarregamento from '../../componentes/comum/EstadoErroCarregamento';
import MensagemInline from '../../componentes/comum/MensagemInline';
import { supabase } from '../../servicos/configSupabase';
import TelaProntuarioPacienteNutri from './TelaProntuarioPacienteNutri';
import {
  abrirLinkGoogleMeet,
  updateConsultaStatus,
  formatConsultaDateTime,
} from '../../servicos/servicoConsultas';
import { resolveMeetLink } from '../../servicos/servicoGoogleMeet';
import { criarGuardiaoCarregamentoInicial } from '../../utilitarios/carregamentoTela';
import { finalizarConsultaComConduta } from '../../servicos/servicoProntuarioCompleto';
import { getNutritionistId } from '../../servicos/servicoVinculosNutricionista';

function SectionCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function StatusBadge({ status }) {
  const map = {
    scheduled: { label: 'Agendada',           bg: '#e8f4f8', text: '#2c7a9e' },
    confirmed: { label: 'Confirmada',          bg: '#e8f8e8', text: '#2e7d32' },
    done:      { label: 'Realizada',           bg: '#f0f8e8', text: '#558b2f' },
    cancelled: { label: 'Cancelada',           bg: '#fef0f0', text: '#c62828' },
    no_show:   { label: 'Não compareceu',      bg: '#fff8e1', text: '#e65100' },
  };
  const s = map[status] || { label: status, bg: '#f5f5f5', text: '#555' };
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
      <Text style={{ color: s.text, fontWeight: '900', fontSize: 13 }}>{s.label}</Text>
    </View>
  );
}

export default function TelaConsultaNutri({ navigation, route }) {
  const { usuarioLogado, consultaId, pacienteId, scheduledAt } = route.params || {};
  const nutricionistaId = useMemo(() => getNutritionistId(usuarioLogado), [usuarioLogado]);

  const [loading, setLoading] = useState(true);
  const [consulta, setConsulta] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [mensagemAcao, setMensagemAcao] = useState(null);
  const [savingAction, setSavingAction] = useState(false);

  // Formulário de conduta (exibido quando status = done ou ao finalizar)
  const [showConductaForm, setShowConductaForm] = useState(false);
  const [conduta, setConduta] = useState('');
  const [proximosPassos, setProximosPassos] = useState('');
  const [duracaoMin, setDuracaoMin] = useState('');
  const [notaEvolucao, setNotaEvolucao] = useState('');

  const loadGuardRef = React.useRef(criarGuardiaoCarregamentoInicial());

  const effectivePacienteId = pacienteId || consulta?.paciente_id || null;
  const meetLink = consulta ? resolveMeetLink({ consulta, nutricionista: usuarioLogado }) : '';

  const load = useCallback(async () => {
    try {
      setLoading(true);
      if (!consultaId) { setConsulta(null); return; }
      const { data, error } = await supabase
        .from('consulta')
        .select('*')
        .eq('id', consultaId)
        .maybeSingle();
      if (error) throw error;
      setConsulta(data || null);
      setLoadError(null);

      // Pré-popula campos se já tiver conduta salva
      if (data?.conduta) setConduta(data.conduta);
      if (data?.proximos_passos) setProximosPassos(data.proximos_passos);
      if (data?.duracao_minutos) setDuracaoMin(String(data.duracao_minutos));

      // Abre formulário de conduta automaticamente se já está "done"
      if (data?.status === 'done') setShowConductaForm(true);
    } catch (error) {
      setLoadError('Não foi possível carregar a consulta. Verifique a conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [consultaId]);

  useEffect(() => {
    load();
    loadGuardRef.current.marcarCarregado();
    const unsubscribe = navigation.addListener('focus', () => {
      if (loadGuardRef.current.deveIgnorarCarregamentoFocus()) return;
      load();
    });
    return unsubscribe;
  }, [navigation, load]);

  const status = String(consulta?.status || 'scheduled');
  const headerDate = consulta?.scheduled_at || scheduledAt || null;
  const headerText = headerDate ? formatConsultaDateTime(headerDate) : 'Consulta';

  async function markStatus(nextStatus) {
    try {
      setSavingAction(true);
      if (!consultaId) return;
      await updateConsultaStatus({
        consultaId,
        status: nextStatus,
        actor: usuarioLogado,
        origin: 'consulta_nutricionista',
      });
      if (nextStatus === 'done') setShowConductaForm(true);
      await load();
    } catch (error) {
      setMensagemAcao(error?.message || 'Não foi possível atualizar a consulta.');
    } finally {
      setSavingAction(false);
    }
  }

  async function handleAbrirMeet() {
    try {
      await abrirLinkGoogleMeet(meetLink);
    } catch (error) {
      setMensagemAcao(error?.message || 'Não foi possível abrir o Google Meet.');
    }
  }

  async function salvarConduta() {
    if (!consultaId) return;
    try {
      setSavingAction(true);
      setMensagemAcao(null);
      await finalizarConsultaComConduta({
        consultaId,
        conduta,
        proximosPassos,
        duracaoMinutos: duracaoMin ? Number(duracaoMin) : null,
        nutricionistaId,
        pacienteId: effectivePacienteId,
        notaEvolucao,
        actor: usuarioLogado,
      });
      setMensagemAcao('Conduta salva com sucesso.');
      await load();
    } catch (error) {
      setMensagemAcao(error?.message || 'Não foi possível salvar a conduta.');
    } finally {
      setSavingAction(false);
    }
  }

  async function handleAbrirMeet() {
    try {
      await abrirLinkGoogleMeet(meetLink);
    } catch (error) {
      setMensagemAcao(error?.message || 'Nao foi possivel abrir o Google Meet.');
    }
  }

  return (
    <LayoutNutricionista
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Consulta"
      subtitle={headerText}
      rightAction={
        <TouchableOpacity style={styles.iconButton} onPress={load} disabled={loading}>
          <Ionicons name="refresh-outline" size={20} color={patientTheme.colors.text} />
        </TouchableOpacity>
      }
      showTabBar={false}
    >
      {mensagemAcao ? (
        <MensagemInline
          tipo={String(mensagemAcao).includes('sucesso') ? 'sucesso' : 'erro'}
          texto={mensagemAcao}
          onFechar={() => setMensagemAcao(null)}
        />
      ) : null}

      {loading ? (
        <SectionCard style={styles.loadingCard}>
          <ActivityIndicator color={patientTheme.colors.primaryDark} />
          <Text style={styles.loadingText}>Carregando consulta...</Text>
        </SectionCard>
      ) : loadError ? (
        <EstadoErroCarregamento onTentarNovamente={load} loading={loading} />
      ) : (
        <>
          {/* Card Google Meet */}
          {meetLink ? (
            <SectionCard style={styles.meetCard}>
              <View style={styles.meetHeader}>
                <View style={styles.meetIcon}>
                  <Ionicons name="videocam" size={22} color={patientTheme.colors.onPrimary} />
                </View>
                <View style={styles.meetCopy}>
                  <Text style={styles.meetTitle}>Sala Google Meet</Text>
                  <Text style={styles.meetLinkText} numberOfLines={1}>{meetLink}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.primaryButton, styles.meetButton]}
                onPress={handleAbrirMeet}
              >
                <Ionicons name="videocam-outline" size={16} color={patientTheme.colors.onPrimary} />
                <Text style={styles.primaryButtonText}>Entrar no Meet</Text>
              </TouchableOpacity>
            </SectionCard>
          ) : null}

          {/* Status e ações rápidas */}
          <SectionCard style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusTitle}>Status da consulta</Text>
              <StatusBadge status={status} />
            </View>

            {consulta?.scheduled_at ? (
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={patientTheme.colors.textMuted} />
                <Text style={styles.metaText}>{formatConsultaDateTime(consulta.scheduled_at)}</Text>
              </View>
            ) : null}

            {consulta?.motivo ? (
              <View style={styles.metaRow}>
                <Ionicons name="document-text-outline" size={14} color={patientTheme.colors.textMuted} />
                <Text style={styles.metaText}>Motivo: {consulta.motivo}</Text>
              </View>
            ) : null}

            {status !== 'done' && status !== 'cancelled' ? (
              <View style={styles.statusActions}>
                {status !== 'confirmed' ? (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                    onPress={() => markStatus('confirmed')}
                    disabled={savingAction}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color={patientTheme.colors.onPrimary} />
                    <Text style={styles.actionBtnPrimaryText}>Confirmar</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSuccess]}
                  onPress={() => markStatus('done')}
                  disabled={savingAction}
                >
                  <Ionicons name="checkmark-done-outline" size={16} color="#2e7d32" />
                  <Text style={styles.actionBtnSuccessText}>Finalizar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                  onPress={() => markStatus('cancelled')}
                  disabled={savingAction}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#d96666" />
                  <Text style={styles.actionBtnDangerText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {status === 'done' && !showConductaForm ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary, { marginTop: 12 }]}
                onPress={() => setShowConductaForm(true)}
              >
                <Ionicons name="pencil-outline" size={16} color={patientTheme.colors.primaryDark} />
                <Text style={styles.actionBtnSecondaryText}>Registrar / Editar conduta</Text>
              </TouchableOpacity>
            ) : null}
          </SectionCard>

          {/* Formulário de conduta */}
          {showConductaForm ? (
            <SectionCard style={{ marginTop: 14 }}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Conduta e Evolução</Text>
                {status === 'done' ? (
                  <TouchableOpacity onPress={() => setShowConductaForm(false)} style={styles.closeBtn}>
                    <Ionicons name="chevron-up-outline" size={18} color={patientTheme.colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={styles.sectionHelper}>Registre a conduta, próximos passos e evolução desta consulta.</Text>

              <Text style={styles.inputLabel}>Conduta / Resumo da consulta</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={conduta}
                onChangeText={setConduta}
                placeholder="Descreva a conduta nutricional adotada..."
                placeholderTextColor={patientTheme.colors.textMuted}
                multiline
                textAlignVertical="top"
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Próximos passos</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={proximosPassos}
                onChangeText={setProximosPassos}
                placeholder="O que foi combinado para o próximo período..."
                placeholderTextColor={patientTheme.colors.textMuted}
                multiline
                textAlignVertical="top"
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Evolução clínica (SOAP resumido)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={notaEvolucao}
                onChangeText={setNotaEvolucao}
                placeholder="Avaliação clínica nutricional, diagnóstico, plano e orientações..."
                placeholderTextColor={patientTheme.colors.textMuted}
                multiline
                textAlignVertical="top"
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Duração (minutos)</Text>
              <TextInput
                style={styles.input}
                value={duracaoMin}
                onChangeText={setDuracaoMin}
                placeholder="Ex: 45"
                placeholderTextColor={patientTheme.colors.textMuted}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.primaryButton, savingAction && styles.buttonDisabled]}
                onPress={salvarConduta}
                disabled={savingAction}
              >
                {savingAction ? (
                  <ActivityIndicator color={patientTheme.colors.onPrimary} />
                ) : (
                  <Ionicons name="save-outline" size={18} color={patientTheme.colors.onPrimary} />
                )}
                <Text style={styles.primaryButtonText}>Salvar conduta</Text>
              </TouchableOpacity>

              {/* Dados já salvos */}
              {(consulta?.conduta || consulta?.observacoes_nutri) && !conduta ? (
                <View style={styles.savedInfo}>
                  <Text style={styles.savedInfoLabel}>Conduta anterior</Text>
                  <Text style={styles.savedInfoText}>{consulta.conduta || consulta.observacoes_nutri}</Text>
                </View>
              ) : null}
              {consulta?.proximos_passos && !proximosPassos ? (
                <View style={styles.savedInfo}>
                  <Text style={styles.savedInfoLabel}>Próximos passos salvos</Text>
                  <Text style={styles.savedInfoText}>{consulta.proximos_passos}</Text>
                </View>
              ) : null}
            </SectionCard>
          ) : null}
        </>
      )}

      {/* Prontuário do paciente embutido */}
      {effectivePacienteId ? (
        <View style={{ marginTop: 14 }}>
          <TelaProntuarioPacienteNutri
            navigation={navigation}
            route={{
              key: 'embedded-prontuario',
              name: 'NutriProntuarioPaciente',
              params: { usuarioLogado, pacienteId: effectivePacienteId },
            }}
          />
        </View>
      ) : (
        <SectionCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Paciente não identificado</Text>
          <Text style={styles.emptyText}>Não foi possível abrir o prontuário desta consulta.</Text>
        </SectionCard>
      )}
    </LayoutNutricionista>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: patientTheme.colors.background,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  iconButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: patientTheme.colors.background,
    alignItems: 'center', justifyContent: 'center',
    ...patientShadow,
  },
  loadingCard: { marginTop: 16, alignItems: 'center', gap: 10 },
  loadingText: { color: patientTheme.colors.textMuted, fontWeight: '700' },
  meetCard: { marginTop: 16, gap: 14, backgroundColor: patientTheme.colors.surface },
  meetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meetIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetCopy: { flex: 1, minWidth: 0 },
  meetTitle: { color: patientTheme.colors.primaryDark, fontSize: 15, fontWeight: '900' },
  meetLink: { marginTop: 4, color: patientTheme.colors.text, fontSize: 12, fontWeight: '800' },
  meetButton: { alignSelf: 'flex-start' },
  statusCard: { marginTop: 16 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  statusTitle: { fontSize: 16, fontWeight: '900', color: patientTheme.colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  metaText: { color: patientTheme.colors.textMuted, fontSize: 13 },
  statusActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: patientTheme.radius.pill },
  actionBtnPrimary: { backgroundColor: patientTheme.colors.surface, borderWidth: 1, borderColor: patientTheme.colors.surfaceBorder },
  actionBtnPrimaryText: { color: patientTheme.colors.text, fontWeight: '900' },
  actionBtnSuccess: { backgroundColor: '#e8f5e9', borderWidth: 1, borderColor: '#c8e6c9' },
  actionBtnSuccessText: { color: '#2e7d32', fontWeight: '900' },
  actionBtnDanger: { backgroundColor: '#fff4f4', borderWidth: 1, borderColor: '#f0d2d2' },
  actionBtnDangerText: { color: '#d96666', fontWeight: '900' },
  actionBtnSecondary: { backgroundColor: patientTheme.colors.primarySoft },
  actionBtnSecondaryText: { color: patientTheme.colors.text, fontWeight: '900' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: patientTheme.colors.text },
  sectionHelper: { marginTop: 6, color: patientTheme.colors.textMuted, lineHeight: 20, marginBottom: 14 },
  closeBtn: { padding: 6 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: patientTheme.colors.textMuted, marginBottom: 4 },
  input: {
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.background,
    paddingHorizontal: 14, paddingVertical: 12,
    color: patientTheme.colors.text,
    borderWidth: 1, borderColor: patientTheme.colors.border,
    ...patientShadow,
  },
  inputMultiline: { minHeight: 100 },
  primaryButton: {
    marginTop: 14, minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.surface,
    borderWidth: 1,
    borderColor: patientTheme.colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  buttonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: patientTheme.colors.text, fontWeight: '900' },
  savedInfo: {
    marginTop: 14, padding: 12,
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderRadius: patientTheme.radius.lg,
  },
  savedInfoLabel: { fontSize: 11, fontWeight: '800', color: patientTheme.colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  savedInfoText: { color: patientTheme.colors.text, lineHeight: 20 },
  emptyCard: { marginTop: 16, alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: patientTheme.colors.text },
  emptyText: { marginTop: 8, textAlign: 'center', color: patientTheme.colors.textMuted, lineHeight: 20 },
  meetCard: { marginTop: 16, gap: 14, backgroundColor: patientTheme.colors.surface, borderColor: patientTheme.colors.surfaceBorder },
  meetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meetIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: patientTheme.colors.surface, borderWidth: 1, borderColor: patientTheme.colors.surfaceBorder, alignItems: 'center', justifyContent: 'center' },
  meetCopy: { flex: 1, minWidth: 0 },
  meetTitle: { color: patientTheme.colors.primaryDark, fontSize: 15, fontWeight: '900' },
  meetLinkText: { marginTop: 4, color: patientTheme.colors.text, fontSize: 12, fontWeight: '800' },
  meetButton: { alignSelf: 'flex-start', marginTop: 0 },
});
