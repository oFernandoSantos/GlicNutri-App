import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LayoutMedico from '../../componentes/medico/LayoutMedico';
import { medicoTheme as theme } from '../../temas/temaVisualNutricionista';
import { getMedicoId, listPatientsByDoctor } from '../../servicos/servicoVinculosMedico';

export default function TelaPacientesMedico({ navigation, route }) {
  const { usuarioLogado, onMedicoLogout } = route.params || {};
  const medicoId = useMemo(() => getMedicoId(usuarioLogado), [usuarioLogado]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setPatients(await listPatientsByDoctor(medicoId));
    } catch {
      setError('Não foi possível carregar pacientes.');
    } finally {
      setLoading(false);
    }
  }, [medicoId]);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  return (
    <LayoutMedico
      navigation={navigation}
      usuarioLogado={usuarioLogado}
      onLogout={onMedicoLogout}
      title="Pacientes"
      subtitle="Vinculados ao seu CRM"
    >
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primaryDark} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Nenhum paciente vinculado. Vincule via consulta ou admin.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('MedicoProntuarioPaciente', {
                  usuarioLogado,
                  pacienteId: item.id,
                  paciente: item,
                })
              }
            >
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.age} anos · Glicose: {item.latestGlucose} mg/dL
              </Text>
              <Text style={styles.tag}>{item.specialtyTag}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </LayoutMedico>
  );
}

const styles = StyleSheet.create({
  list: { padding: theme.spacing.screen, gap: 10 },
  card: {
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 10,
  },
  name: { fontSize: 17, fontWeight: '900', color: theme.colors.text },
  meta: { marginTop: 6, color: theme.colors.textMuted },
  tag: { marginTop: 6, color: theme.colors.info, fontWeight: '700', fontSize: 12 },
  empty: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 40 },
  error: { textAlign: 'center', color: theme.colors.danger, marginTop: 40 },
});
