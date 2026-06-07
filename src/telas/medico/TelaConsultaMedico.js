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
import LayoutMedico from '../../componentes/medico/LayoutMedico';
import BotaoAcaoMedico from '../../componentes/medico/BotaoAcaoMedico';
import EstadoErroCarregamento from '../../componentes/comum/EstadoErroCarregamento';
import { ConsultaStatusBadge } from '../../componentes/comum/ui';
import { SectionCard } from '../../componentes/nutricionista/NutriDesktopUI';
import { supabase } from '../../servicos/configSupabase';
import {
  abrirLinkGoogleMeet,
  formatConsultaDateTime,
  updateConsultaStatus,
} from '../../servicos/servicoConsultas';
import { resolveMeetLink } from '../../servicos/servicoGoogleMeet';
import { addEvolucao } from '../../servicos/servicoProntuarioCompleto';
import { getMedicoId } from '../../servicos/servicoVinculosMedico';
import { medicoTheme as theme } from '../../temas/temaVisualNutricionista';
import { inputWebFocusReset } from '../../temas/temaFocoCampo';

export default function TelaConsultaMedico({ navigation, route }) {
  const { usuarioLogado, consultaId, pacienteId } = route.params || {};
  const medicoId = useMemo(() => getMedicoId(usuarioLogado), [usuarioLogado]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [consulta, setConsulta] = useState(null);
  const [conduta, setConduta] = useState('');
  const [exames, setExames] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      if (!consultaId) return;
      const { data, error } = await supabase.from('consulta').select('*').eq('id', consultaId).maybeSingle();
      if (error) throw error;
      setConsulta(data || null);
    } catch {
      setLoadError('Não foi possível carregar a consulta. Verifique a conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [consultaId]);

  useEffect(() => {
    load();
  }, [load]);

  const meetLink = consulta ? resolveMeetLink({ consulta, profissional: usuarioLogado }) : '';
  const effectivePacienteId = pacienteId || consulta?.paciente_id;

  async function finalizarConsulta() {
    try {
      setSaving(true);
      await updateConsultaStatus({
        consultaId,
        status: 'done',
        actor: usuarioLogado,
        origin: 'consulta_medico',
      });
      await addEvolucao({
        pacienteId: effectivePacienteId,
        medicoId,
        consultaId,
        avaliacao: conduta || 'Consulta clínica realizada.',
        plano: exames ? `Exames solicitados: ${exames}` : 'Manter monitoramento glicêmico.',
        orientacoes: conduta,
        actor: usuarioLogado,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <LayoutMedico
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Consulta"
      subtitle="Diabetes, medicação e exames"
      showTabBar={false}
    >
      {loading ? (
        <ActivityIndicator style={styles.loader} color={theme.colors.primaryDark} />
      ) : loadError ? (
        <EstadoErroCarregamento mensagem={loadError} onTentarNovamente={load} />
      ) : !consulta ? (
        <Text style={styles.empty}>Consulta não encontrada.</Text>
      ) : (
        <View style={styles.wrap}>
          <SectionCard style={styles.card}>
            <Text style={styles.when}>{formatConsultaDateTime(consulta.scheduled_at)}</Text>
            <ConsultaStatusBadge status={consulta.status} persona="medico" />
            <Text style={styles.meta}>{consulta.motivo || 'Consulta clínica'}</Text>

            {meetLink ? (
              <TouchableOpacity style={styles.meetBtn} onPress={() => abrirLinkGoogleMeet(meetLink)}>
                <Ionicons name="videocam" size={18} color={theme.colors.onPrimary} />
                <Text style={styles.meetText}>Entrar no Google Meet</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() =>
                navigation.navigate('MedicoProntuarioPaciente', {
                  usuarioLogado,
                  pacienteId: effectivePacienteId,
                })
              }
            >
              <Ionicons name="document-text-outline" size={16} color={theme.colors.primaryDark} />
              <Text style={styles.linkText}>Abrir prontuário clínico</Text>
            </TouchableOpacity>
          </SectionCard>

          <SectionCard style={styles.card}>
            <Text style={styles.sectionTitle}>Conduta clínica</Text>
            <Text style={styles.label}>Conduta / evolução clínica</Text>
            <TextInput
              style={[styles.input, styles.area]}
              value={conduta}
              onChangeText={setConduta}
              placeholder="HbA1c, ajuste de insulina, hipoglicemia…"
              multiline
            />
            <Text style={styles.label}>Exames solicitados</Text>
            <TextInput
              style={styles.input}
              value={exames}
              onChangeText={setExames}
              placeholder="Ex.: HbA1c, perfil lipídico, microalbuminúria"
            />
            <BotaoAcaoMedico
              label={saving ? 'Salvando…' : 'Finalizar consulta'}
              onPress={finalizarConsulta}
              disabled={saving}
              loading={saving}
              icon="checkmark-circle-outline"
              style={styles.primaryAction}
            />
          </SectionCard>
        </View>
      )}
    </LayoutMedico>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, paddingBottom: 24 },
  card: { gap: 10 },
  loader: { marginTop: 40 },
  when: { fontSize: 18, fontWeight: '900', color: theme.colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  meta: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 },
  empty: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 40 },
  meetBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radius.pill,
    minHeight: 44,
    marginTop: 4,
  },
  meetText: { color: theme.colors.onPrimary, fontWeight: '800' },
  linkBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 4,
  },
  linkText: { fontWeight: '800', color: theme.colors.primaryDark },
  label: { fontWeight: '800', color: theme.colors.text, marginTop: 8, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 12,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    ...inputWebFocusReset,
  },
  area: { minHeight: 100, textAlignVertical: 'top' },
  primaryAction: { marginTop: 12 },
});
