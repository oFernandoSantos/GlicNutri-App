import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LayoutMedico from '../../componentes/medico/LayoutMedico';
import { FilterTabs } from '../../componentes/nutricionista/NutriDesktopUI';
import { medicoTheme as theme } from '../../temas/temaVisualNutricionista';
import { getMedicoId } from '../../servicos/servicoVinculosMedico';
import {
  fetchProntuarioClinicoMedico,
  saveProntuarioClinicoMedico,
  saveEvolucaoMedico,
} from '../../servicos/servicoProntuarioMedico';

const tabs = [
  { value: 'clinico', label: 'Clínico' },
  { value: 'glicemia', label: 'Glicemia' },
  { value: 'medicacao', label: 'Medicação' },
  { value: 'insulina', label: 'Insulina' },
  { value: 'evolucao', label: 'Evolução' },
];

function formatDt(v) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function TelaProntuarioPacienteMedico({ navigation, route }) {
  const { usuarioLogado, pacienteId, paciente, onMedicoLogout } = route.params || {};
  const medicoId = useMemo(() => getMedicoId(usuarioLogado), [usuarioLogado]);
  const [tab, setTab] = useState('clinico');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const [tipoDiabetes, setTipoDiabetes] = useState('');
  const [diagnosticos, setDiagnosticos] = useState('');
  const [comorbidades, setComorbidades] = useState('');
  const [usaInsulina, setUsaInsulina] = useState('');
  const [esquemaInsulina, setEsquemaInsulina] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [evolAvaliacao, setEvolAvaliacao] = useState('');
  const [evolPlano, setEvolPlano] = useState('');

  const load = useCallback(async () => {
    if (!pacienteId || !medicoId) return;
    try {
      setLoading(true);
      const result = await fetchProntuarioClinicoMedico(pacienteId, medicoId);
      setData(result);
      const p = result.prontuario;
      if (p) {
        setTipoDiabetes(p.tipo_diabetes || '');
        setDiagnosticos((p.diagnosticos_cid || []).join(', '));
        setComorbidades((p.comorbidades || []).join(', '));
        setUsaInsulina(p.usa_insulina ? 'sim' : 'nao');
        setEsquemaInsulina(p.esquema_insulina || '');
        setObservacoes(p.observacoes_gerais || '');
      }
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e?.message || 'Erro ao carregar prontuário.' });
    } finally {
      setLoading(false);
    }
  }, [pacienteId, medicoId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveClinico() {
    try {
      setSaving(true);
      await saveProntuarioClinicoMedico({
        pacienteId,
        medicoId,
        tipoDiabetes,
        diagnosticosCid: diagnosticos,
        comorbidades,
        usaInsulina: usaInsulina === 'sim',
        esquemaInsulina,
        observacoesGerais: observacoes,
        actor: usuarioLogado,
      });
      setMsg({ tipo: 'ok', texto: 'Prontuário clínico salvo.' });
      await load();
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e?.message || 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  }

  async function saveEvolucao() {
    try {
      setSaving(true);
      await saveEvolucaoMedico({
        pacienteId,
        medicoId,
        avaliacao: evolAvaliacao,
        plano: evolPlano,
        actor: usuarioLogado,
      });
      setEvolAvaliacao('');
      setEvolPlano('');
      setMsg({ tipo: 'ok', texto: 'Evolução registrada.' });
      await load();
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e?.message || 'Erro ao registrar evolução.' });
    } finally {
      setSaving(false);
    }
  }

  const name = paciente?.name || data?.patient?.nome_completo || 'Paciente';

  return (
    <LayoutMedico
      navigation={navigation}
      usuarioLogado={usuarioLogado}
      onLogout={onMedicoLogout}
      title={name}
      subtitle="Prontuário clínico"
    >
      <FilterTabs items={tabs} active={tab} onChange={setTab} compact />
      {msg ? (
        <Text style={[styles.msg, msg.tipo === 'erro' && styles.msgErr]}>{msg.texto}</Text>
      ) : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primaryDark} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {tab === 'clinico' ? (
            <View style={styles.section}>
              <Text style={styles.label}>Tipo diabetes</Text>
              <TextInput style={styles.input} value={tipoDiabetes} onChangeText={setTipoDiabetes} placeholder="DM1, DM2..." />
              <Text style={styles.label}>Diagnósticos (CID)</Text>
              <TextInput style={styles.input} value={diagnosticos} onChangeText={setDiagnosticos} />
              <Text style={styles.label}>Comorbidades</Text>
              <TextInput style={styles.input} value={comorbidades} onChangeText={setComorbidades} />
              <Text style={styles.label}>Usa insulina (sim/nao)</Text>
              <TextInput style={styles.input} value={usaInsulina} onChangeText={setUsaInsulina} />
              <Text style={styles.label}>Esquema insulina</Text>
              <TextInput style={styles.input} value={esquemaInsulina} onChangeText={setEsquemaInsulina} />
              <Text style={styles.label}>Observações clínicas</Text>
              <TextInput style={[styles.input, styles.multiline]} value={observacoes} onChangeText={setObservacoes} multiline />
              <TouchableOpacity style={styles.btn} onPress={saveClinico} disabled={saving}>
                <Text style={styles.btnText}>{saving ? 'Salvando...' : 'Salvar clínico'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {tab === 'glicemia' ? (
            <View style={styles.section}>
              {(data?.glicemias || []).slice(0, 40).map((g, i) => (
                <View key={g.id || i} style={styles.row}>
                  <Text>{formatDt(g.data_hora || g.registered_at || g.created_at)}</Text>
                  <Text style={styles.val}>{g.valor_mgdl || g.value} mg/dL</Text>
                </View>
              ))}
              {!data?.glicemias?.length ? <Text style={styles.empty}>Sem registros.</Text> : null}
            </View>
          ) : null}

          {tab === 'medicacao' ? (
            <View style={styles.section}>
              {(data?.medicamentos || []).slice(0, 40).map((m, i) => (
                <View key={m.id || i} style={styles.row}>
                  <Text>{formatDt(m.data_hora || m.created_at)}</Text>
                  <Text style={styles.val}>{m.nome_medicamento || m.medicationName}</Text>
                </View>
              ))}
              {!data?.medicamentos?.length ? <Text style={styles.empty}>Sem registros.</Text> : null}
            </View>
          ) : null}

          {tab === 'insulina' ? (
            <View style={styles.section}>
              {(data?.insulinas || []).slice(0, 40).map((m, i) => (
                <View key={m.id || i} style={styles.row}>
                  <Text>{formatDt(m.data_hora || m.created_at)}</Text>
                  <Text style={styles.val}>{m.nome_medicamento || m.medicationName}</Text>
                </View>
              ))}
              {!data?.insulinas?.length ? <Text style={styles.empty}>Sem registros.</Text> : null}
            </View>
          ) : null}

          {tab === 'evolucao' ? (
            <View style={styles.section}>
              <Text style={styles.label}>Avaliação clínica</Text>
              <TextInput style={[styles.input, styles.multiline]} value={evolAvaliacao} onChangeText={setEvolAvaliacao} multiline />
              <Text style={styles.label}>Conduta / plano</Text>
              <TextInput style={[styles.input, styles.multiline]} value={evolPlano} onChangeText={setEvolPlano} multiline />
              <TouchableOpacity style={styles.btn} onPress={saveEvolucao} disabled={saving}>
                <Text style={styles.btnText}>Registrar evolução</Text>
              </TouchableOpacity>
              {(data?.evolucao || []).map((ev, i) => (
                <View key={ev.id || i} style={styles.evolCard}>
                  <Text style={styles.evolDate}>{formatDt(ev.created_at)}</Text>
                  {ev.avaliacao ? <Text>{ev.avaliacao}</Text> : null}
                  {ev.plano ? <Text style={styles.muted}>{ev.plano}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </LayoutMedico>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.screen, paddingBottom: 40 },
  section: { gap: 8 },
  label: { fontSize: 12, fontWeight: '800', color: theme.colors.textMuted, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 12,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  btn: {
    marginTop: 12,
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radius.pill,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: theme.colors.onPrimary, fontWeight: '900' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  val: { fontWeight: '800', color: theme.colors.text },
  empty: { color: theme.colors.textMuted, marginTop: 16 },
  evolCard: { marginTop: 12, padding: 12, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  evolDate: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 6 },
  muted: { color: theme.colors.textMuted, marginTop: 4 },
  msg: { marginHorizontal: theme.spacing.screen, marginTop: 8, color: theme.colors.primaryDark, fontWeight: '700' },
  msgErr: { color: theme.colors.danger },
});
