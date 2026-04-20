import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PatientScreenLayout from '../../componentes/paciente/LayoutPaciente';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import {
  createDefaultAppState,
  fetchPatientExperience,
  getPatientId,
} from '../../servicos/servicoDadosPaciente';

export default function PacientePlanoScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const canResolvePatient = useMemo(
    () =>
      Boolean(
        patientId ||
        usuarioLogado?.id_paciente_uuid ||
        usuarioLogado?.cpf_paciente ||
        usuarioLogado?.email_pac ||
        usuarioLogado?.email ||
        usuarioLogado?.id
      ),
    [patientId, usuarioLogado]
  );
  const [expandedFood, setExpandedFood] = useState(null);
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [objectiveText, setObjectiveText] = useState('');
  const [appState, setAppState] = useState(createDefaultAppState());

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);

        if (!canResolvePatient) {
          if (!active) return;
          setAppState(createDefaultAppState());
          return;
        }

        const experience = await fetchPatientExperience(patientId, {
          patientContext: usuarioLogado,
        });

        if (!active) return;

        setPatient(experience.patient);
        setObjectiveText(experience.clinicalObjective);
        setAppState(experience.appState);
      } catch (error) {
        console.log('Erro ao carregar plano:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [patientId, canResolvePatient]);

  const planSections = appState.planSections || [];

  return (
    <PatientScreenLayout
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
    >
      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={patientTheme.colors.primaryDark} />
          <Text style={styles.loadingText}>Carregando plano do Supabase...</Text>
        </View>
      ) : null}

      {planSections.map((section) => (
        <View key={section.id} style={styles.planCard}>
          <View style={styles.planHeader}>
            <View>
              <Text style={styles.planTitle}>{section.title}</Text>
              <Text style={styles.planTime}>{section.time}</Text>
            </View>
            <View style={styles.planObjectivePill}>
              <Text style={styles.planObjectiveText}>{section.objective}</Text>
            </View>
          </View>

          {section.foods.map((food) => {
            const substitution = section.substitutions.find((item) => item.anchor === food);
            const expandedKey = `${section.id}-${food}`;
            const isExpanded = expandedFood === expandedKey;

            return (
              <View key={food} style={styles.foodBlock}>
                <TouchableOpacity
                  style={styles.foodRow}
                  onPress={() => setExpandedFood(isExpanded ? null : expandedKey)}
                >
                  <Text style={styles.foodText}>{food}</Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={patientTheme.colors.textMuted}
                  />
                </TouchableOpacity>

                {isExpanded && substitution ? (
                  <View style={styles.substitutionBox}>
                    {substitution.options.map((option) => (
                      <Text key={option} style={styles.substitutionText}>
                        - {option}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </PatientScreenLayout>
  );
}

const styles = StyleSheet.create({
  planCard: {
    marginTop: 16,
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  planHeader: {
    marginBottom: 14,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  planTime: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontSize: 13,
  },
  planObjectivePill: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: patientTheme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  planObjectiveText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  foodBlock: {
    marginTop: 8,
  },
  foodRow: {
    borderRadius: 16,
    backgroundColor: patientTheme.colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foodText: {
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
  substitutionBox: {
    marginTop: 8,
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#f7fafc',
  },
  substitutionText: {
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  loadingCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    alignItems: 'center',
    ...patientShadow,
  },
  loadingText: {
    marginTop: 10,
    color: patientTheme.colors.textMuted,
  },
});
