import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutMedico from '../../componentes/medico/LayoutMedico';
import { medicoTheme as theme } from '../../temas/temaVisualNutricionista';
import { getMedicoId, listPatientsByDoctor } from '../../servicos/servicoVinculosMedico';
import { fetchEvolucaoHistorico, addEvolucao } from '../../servicos/servicoProntuarioCompleto';

function mapEvolucaoToMessage(entry) {
  const text = [entry.orientacoes, entry.avaliacao, entry.plano, entry.subjetivo]
    .filter(Boolean)
    .join('\n');
  return {
    id: entry.id || `${entry.created_at}-${text.slice(0, 12)}`,
    text: text || 'Registro clínico',
    createdAt: entry.created_at,
    fromMedico: Boolean(entry.medico_id),
  };
}

export default function TelaMensagensMedico({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const medicoId = useMemo(() => getMedicoId(usuarioLogado), [usuarioLogado]);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await listPatientsByDoctor(medicoId);
      setPatients(rows);
      if (!activePatient && rows[0]) setActivePatient(rows[0]);
    } finally {
      setLoading(false);
    }
  }, [medicoId, activePatient]);

  const loadThread = useCallback(async (patient) => {
    if (!patient?.id) return;
    const evolucao = await fetchEvolucaoHistorico(patient.id, 40).catch(() => []);
    const thread = (evolucao || [])
      .filter((e) => e.medico_id === medicoId || !e.nutricionista_id)
      .map(mapEvolucaoToMessage)
      .reverse();
    setMessages(thread);
  }, [medicoId]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    if (activePatient) loadThread(activePatient);
  }, [activePatient, loadThread]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || !activePatient?.id) return;
    try {
      setSending(true);
      await addEvolucao({
        pacienteId: activePatient.id,
        medicoId,
        orientacoes: text,
        avaliacao: 'Orientação clínica — diabetes/exames',
        actor: usuarioLogado,
      });
      setDraft('');
      await loadThread(activePatient);
    } finally {
      setSending(false);
    }
  }

  return (
    <LayoutMedico
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title=""
      subtitle=""
      showTabBar={route?.name === 'MedicoMensagens'}
      scrollEnabled={false}
      lockFixedContent
    >
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primaryDark} />
      ) : (
        <View style={styles.shell}>
          <View style={styles.inbox}>
            <Text style={styles.inboxTitle}>Pacientes</Text>
            <FlatList
              data={patients}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.inboxItem, activePatient?.id === item.id && styles.inboxItemActive]}
                  onPress={() => setActivePatient(item)}
                >
                  <Text style={styles.inboxName}>{item.name}</Text>
                  <Text style={styles.inboxMeta}>Glicose: {item.latestGlucose} mg/dL</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>Nenhum paciente vinculado.</Text>}
            />
          </View>

          <View style={styles.chat}>
            <Text style={styles.chatTitle}>{activePatient?.name || 'Selecione um paciente'}</Text>
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.thread}
              renderItem={({ item }) => (
                <View style={[styles.bubble, item.fromMedico && styles.bubbleMedico]}>
                  <Text style={styles.bubbleText}>{item.text}</Text>
                  <Text style={styles.bubbleTime}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : ''}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>Sem mensagens clínicas. Envie orientação sobre diabetes ou exames.</Text>
              }
            />
            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Orientação clínica…"
                multiline
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
                <Ionicons name="send" size={18} color={theme.colors.onPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </LayoutMedico>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', gap: 10, minHeight: 420 },
  inbox: { width: '36%', borderRightWidth: 1, borderRightColor: theme.colors.border, paddingRight: 8 },
  inboxTitle: { fontWeight: '900', marginBottom: 8, color: theme.colors.text },
  inboxItem: { padding: 10, borderRadius: 10, marginBottom: 6, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  inboxItemActive: { borderColor: theme.colors.primaryDark, backgroundColor: theme.colors.primarySoft },
  inboxName: { fontWeight: '800', color: theme.colors.text },
  inboxMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  chat: { flex: 1, minWidth: 0 },
  chatTitle: { fontWeight: '900', marginBottom: 8, color: theme.colors.text },
  thread: { paddingBottom: 12, gap: 8 },
  bubble: { alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: theme.colors.backgroundSoft, padding: 10, borderRadius: 12 },
  bubbleMedico: { alignSelf: 'flex-end', backgroundColor: theme.colors.primarySoft },
  bubbleText: { color: theme.colors.text, lineHeight: 18 },
  bubbleTime: { marginTop: 4, fontSize: 10, color: theme.colors.textMuted },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 8 },
  input: { flex: 1, minHeight: 44, maxHeight: 100, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 10, backgroundColor: '#fff' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 16, fontSize: 13 },
});
