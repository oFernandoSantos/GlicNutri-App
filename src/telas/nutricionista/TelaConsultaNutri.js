import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
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

function SectionCard({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export default function TelaConsultaNutri({ navigation, route }) {
  const { usuarioLogado, consultaId, pacienteId, scheduledAt } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [consulta, setConsulta] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [mensagemAcao, setMensagemAcao] = useState(null);
  const loadGuardRef = React.useRef(criarGuardiaoCarregamentoInicial());

  const effectivePacienteId = pacienteId || consulta?.paciente_id || null;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      if (!consultaId) {
        setConsulta(null);
        return;
      }
      const { data, error } = await supabase
        .from('consulta')
        .select('*')
        .eq('id', consultaId)
        .maybeSingle();
      if (error) throw error;
      setConsulta(data || null);
      setLoadError(null);
    } catch (error) {
      console.log('Erro carregar consulta:', error);
      setLoadError(
        'Não foi possível carregar a consulta. Verifique a conexão e tente novamente.'
      );
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
  const meetLink = consulta ? resolveMeetLink({ consulta, nutricionista: usuarioLogado }) : '';

  async function markStatus(nextStatus) {
    try {
      if (!consultaId) return;
      await updateConsultaStatus({
        consultaId,
        status: nextStatus,
        actor: usuarioLogado,
        origin: 'consulta_nutricionista',
      });
      await load();
    } catch (error) {
      setMensagemAcao(
        error?.message ||
          'Não foi possível atualizar a consulta. Verifique a conexão e tente novamente.'
      );
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
            tipo="erro"
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
            <SectionCard style={styles.meetCard}>
              <View style={styles.meetHeader}>
                <View style={styles.meetIcon}>
                  <Ionicons name="videocam" size={22} color={patientTheme.colors.onPrimary} />
                </View>
                <View style={styles.meetCopy}>
                  <Text style={styles.meetTitle}>Sala Google Meet</Text>
                  <Text style={styles.meetLink} numberOfLines={1}>
                    {meetLink || 'Link indisponivel'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.primaryButton, styles.meetButton]}
                onPress={handleAbrirMeet}
                disabled={!meetLink}
              >
                <Text style={styles.primaryButtonText}>Entrar no Meet</Text>
              </TouchableOpacity>
            </SectionCard>

            <SectionCard style={styles.statusCard}>
              <Text style={styles.statusTitle}>Status: {status}</Text>
              <View style={styles.statusActions}>
                <TouchableOpacity style={styles.primaryButton} onPress={() => markStatus('confirmed')}>
                  <Text style={styles.primaryButtonText}>Confirmar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => markStatus('done')}>
                  <Text style={styles.secondaryButtonText}>Finalizar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dangerButton} onPress={() => markStatus('cancelled')}>
                  <Text style={styles.dangerButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </SectionCard>
          </>
        )}

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
            <Text style={styles.emptyTitle}>Paciente nao identificado</Text>
            <Text style={styles.emptyText}>Nao foi possivel abrir o prontuario desta consulta.</Text>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: patientTheme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  loadingCard: { marginTop: 16, alignItems: 'center', gap: 10 },
  loadingText: { color: patientTheme.colors.textMuted, fontWeight: '700' },
  meetCard: { marginTop: 16, gap: 14, backgroundColor: patientTheme.colors.primarySoft },
  meetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meetIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meetCopy: { flex: 1, minWidth: 0 },
  meetTitle: { color: patientTheme.colors.primaryDark, fontSize: 15, fontWeight: '900' },
  meetLink: { marginTop: 4, color: patientTheme.colors.text, fontSize: 12, fontWeight: '800' },
  meetButton: { alignSelf: 'flex-start' },
  statusCard: { marginTop: 16 },
  statusTitle: { fontWeight: '900', color: patientTheme.colors.text, fontSize: 16 },
  statusActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  primaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
  },
  primaryButtonText: { color: patientTheme.colors.onPrimary, fontWeight: '900' },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.backgroundSoft,
  },
  secondaryButtonText: { color: patientTheme.colors.text, fontWeight: '900' },
  dangerButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: '#fff4f4',
    borderWidth: 1,
    borderColor: '#f0d2d2',
  },
  dangerButtonText: { color: '#d96666', fontWeight: '900' },
  emptyCard: { marginTop: 16, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: patientTheme.colors.text },
  emptyText: { marginTop: 8, textAlign: 'center', color: patientTheme.colors.textMuted, lineHeight: 20 },
});

