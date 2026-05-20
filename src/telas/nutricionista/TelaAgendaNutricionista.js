import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LayoutNutricionista from '../../componentes/nutricionista/LayoutNutricionista';
import {
  AvatarBadge,
  FilterTabs,
  RiskBadge,
  SectionCard,
  nutriDesktopStyles,
} from '../../componentes/nutricionista/NutriDesktopUI';
import {
  getNutritionistPatientById,
  nutritionistScheduleDays,
  nutritionistScheduleSummary,
} from '../../dados/dadosNutricionistaMock';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';

export default function TelaAgendaNutricionista({ navigation, route }) {
  const { usuarioLogado } = route.params || {};
  const [selectedDay, setSelectedDay] = useState('hoje');
  const [localStatus, setLocalStatus] = useState({});

  const dayItems = useMemo(() => {
    return nutritionistScheduleDays[selectedDay] || [];
  }, [selectedDay]);

  function updateStatus(consultaId, nextStatus) {
    setLocalStatus((current) => ({ ...current, [consultaId]: nextStatus }));
  }

  return (
    <LayoutNutricionista
      navigation={navigation}
      route={route}
      usuarioLogado={usuarioLogado}
      title="Agenda"
      subtitle="Consultas do dia, blocos de tempo e acoes imediatas de confirmacao."
      showTabBar={route?.name === 'NutricionistaAgenda'}
    >
      <View style={nutriDesktopStyles.pageGap}>
        <View style={styles.summaryRow}>
          {nutritionistScheduleSummary.map((item) => (
            <SectionCard key={item.id} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryHelper}>{item.helper}</Text>
            </SectionCard>
          ))}
        </View>

        <View>
          <Text style={nutriDesktopStyles.sectionTitle}>Visualizacao do dia</Text>
          <Text style={nutriDesktopStyles.sectionHelper}>
            Alterna entre os atendimentos de hoje e amanha para agir sem sobrecarga.
          </Text>
        </View>

        <FilterTabs
          items={[
            { value: 'hoje', label: 'Hoje' },
            { value: 'amanha', label: 'Amanha' },
          ]}
          active={selectedDay}
          onChange={setSelectedDay}
          compact
        />

        <View style={styles.consultList}>
          {dayItems.map((consulta) => {
            const patient = getNutritionistPatientById(consulta.patientId);
            const status = localStatus[consulta.id] || consulta.status;

            return (
              <SectionCard key={consulta.id} style={styles.consultCard}>
                <View style={styles.consultTop}>
                  <View style={styles.consultIdentity}>
                    <AvatarBadge name={consulta.patientName} size={48} subtle />
                    <View style={styles.consultCopy}>
                      <Text style={styles.consultName}>{consulta.patientName}</Text>
                      <Text style={styles.consultMeta}>
                        {consulta.type} · {consulta.mode}
                      </Text>
                      {patient ? <Text style={styles.consultMetaSecondary}>{patient.specialtyTag}</Text> : null}
                    </View>
                  </View>

                  <View style={styles.consultSide}>
                    <Text style={styles.consultTime}>{consulta.time}</Text>
                    <RiskBadge risk={status} />
                  </View>
                </View>

                {patient ? (
                  <View style={styles.contextBox}>
                    <View style={styles.contextItem}>
                      <Text style={styles.contextLabel}>Glicose</Text>
                      <Text style={styles.contextValue}>{patient.latestGlucose} mg/dL</Text>
                    </View>
                    <View style={styles.contextItem}>
                      <Text style={styles.contextLabel}>Adesao</Text>
                      <Text style={styles.contextValue}>{patient.adherence}%</Text>
                    </View>
                    <View style={styles.contextItem}>
                      <Text style={styles.contextLabel}>Alertas</Text>
                      <Text style={styles.contextValue}>{patient.alerts}</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.primaryAction}
                    onPress={() =>
                      navigation.navigate('NutriConsultaNutri', {
                        usuarioLogado,
                        consultaId: consulta.id,
                        pacienteId: consulta.patientId,
                      })
                    }
                    activeOpacity={0.9}
                  >
                    <Ionicons name="videocam-outline" size={18} color={patientTheme.colors.onPrimary} />
                    <Text style={styles.primaryActionText}>Iniciar consulta</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={() => updateStatus(consulta.id, 'Confirmada')}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color={patientTheme.colors.primaryDark} />
                    <Text style={styles.secondaryActionText}>Confirmar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelAction}
                    onPress={() => updateStatus(consulta.id, 'Cancelada')}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="close-circle-outline" size={18} color="#c55b5b" />
                    <Text style={styles.cancelActionText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </SectionCard>
            );
          })}
        </View>
      </View>
    </LayoutNutricionista>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minHeight: 126,
  },
  summaryLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '800',
  },
  summaryValue: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  summaryHelper: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    lineHeight: 20,
  },
  consultList: {
    gap: 12,
  },
  consultCard: {
    gap: 14,
  },
  consultTop: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    gap: 12,
  },
  consultIdentity: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  consultCopy: {
    flex: 1,
    minWidth: 0,
  },
  consultName: {
    fontSize: 18,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  consultMeta: {
    marginTop: 4,
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  consultMetaSecondary: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
  },
  consultSide: {
    alignItems: Platform.OS === 'web' ? 'flex-end' : 'flex-start',
    gap: 8,
  },
  consultTime: {
    fontSize: 28,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  contextBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  contextItem: {
    flex: 1,
    minWidth: 120,
    backgroundColor: patientTheme.colors.background,
    borderRadius: patientTheme.radius.lg,
    padding: 12,
    ...patientShadow,
  },
  contextLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  contextValue: {
    marginTop: 6,
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 10,
  },
  primaryAction: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '900',
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...patientShadow,
  },
  secondaryActionText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '900',
  },
  cancelAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: '#fff2f2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancelActionText: {
    color: '#c55b5b',
    fontWeight: '900',
  },
});
