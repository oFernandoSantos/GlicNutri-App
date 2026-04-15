import React, { useEffect, useMemo, useState } from 'react';
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
import BarraAbasPaciente, { PATIENT_TAB_BAR_HEIGHT, PATIENT_TAB_BAR_SPACE } from '../../components/BarraAbasPaciente';
import { patientShadow, patientTheme } from '../../theme/patientTheme';
import {
  fetchPatientById,
  getPatientDisplayName,
  getPatientId,
} from '../../services/patientSupabaseService';
import { buildPatientProfileSections } from '../../utils/patientProfileFields';

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function DrilldownHeader({ title, helper, open, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={styles.drilldownHeader}>
      <View style={styles.drilldownHeaderCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionHelper}>{helper}</Text>
      </View>

      <Ionicons
        name={open ? 'chevron-up' : 'chevron-down'}
        size={20}
        color={patientTheme.colors.primaryDark}
      />
    </TouchableOpacity>
  );
}

export default function PacientePerfilScreen({
  navigation,
  route,
  usuarioLogado: usuarioProp,
}) {
  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;
  const patientId = useMemo(() => getPatientId(usuarioLogado), [usuarioLogado]);
  const fallbackName = useMemo(() => getPatientDisplayName(usuarioLogado), [usuarioLogado]);

  const [paciente, setPaciente] = useState(usuarioLogado || null);
  const [loading, setLoading] = useState(true);
  const [requestField, setRequestField] = useState('');
  const [requestDetails, setRequestDetails] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [focusedRequestField, setFocusedRequestField] = useState('');
  const [openSections, setOpenSections] = useState({
    patient: false,
    clinical: false,
    request: false,
  });

  useEffect(() => {
    let active = true;

    async function carregarPerfil() {
      try {
        setLoading(true);

        const registro = await fetchPatientById(patientId, {
          patientContext: usuarioLogado,
          currentPatient: paciente,
        });

        if (active) {
          setPaciente(registro || usuarioLogado || null);
        }
      } catch (error) {
        console.log('Erro ao carregar perfil do paciente:', error);

        if (active) {
          setPaciente(usuarioLogado || null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    carregarPerfil();

    return () => {
      active = false;
    };
  }, [patientId, usuarioLogado]);

  function submitChangeRequest() {
    const field = requestField.trim();
    const details = requestDetails.trim();

    if (!field || !details) return;

    console.log('Solicitação de alteração enviada para a nutri:', {
      pacienteId: paciente?.id_paciente_uuid || patientId || null,
      paciente: nomePaciente,
      campo: field,
      detalhes: details,
      enviadaEm: new Date().toISOString(),
    });

    setRequestField('');
    setRequestDetails('');
    setRequestSent(true);
  }

  function toggleSection(sectionKey) {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  }

  const sections = useMemo(() => buildPatientProfileSections(paciente || {}), [paciente]);
  const nomePaciente = paciente?.nome_completo || fallbackName;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={patientTheme.colors.primaryDark} />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="dark-content" backgroundColor={patientTheme.colors.background} />

      <ScrollView
        style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && styles.webScrollContent,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greeting}>Perfil do paciente</Text>
        <Text style={styles.headerSubtitle}>
          Dados cadastrais, clínicos e respostas iniciais de {nomePaciente}.
        </Text>

        <SectionCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(nomePaciente || 'P').trim().slice(0, 1).toUpperCase()}
              </Text>
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.heroName}>{nomePaciente}</Text>
              <Text style={styles.heroEmail}>
                {paciente?.email_pac || usuarioLogado?.email || 'E-mail não informado'}
              </Text>
            </View>
          </View>

          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark-outline" size={18} color={patientTheme.colors.primaryDark} />
            <Text style={styles.heroBadgeText}>Perfil clínico protegido</Text>
          </View>
        </SectionCard>

        {sections.map((section) => (
          <SectionCard key={section.key} style={styles.profileSection}>
            <DrilldownHeader
              title={section.title}
              helper={section.helper}
              open={openSections[section.key]}
              onPress={() => toggleSection(section.key)}
            />

            {openSections[section.key] ? (
              <View style={styles.infoList}>
                {section.rows.map((row) => (
                  <InfoRow key={`${section.key}-${row.label}`} label={row.label} value={row.value} />
                ))}
              </View>
            ) : null}
          </SectionCard>
        ))}

        <SectionCard style={styles.requestCard}>
          <DrilldownHeader
            title="Solicitar alteração de dados cadastrais"
            helper="Informe qual dado precisa ser atualizado para a nutri revisar."
            open={openSections.request}
            onPress={() => toggleSection('request')}
          />

          {openSections.request ? (
            <>
              {requestSent ? (
                <View style={styles.requestSuccess}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color={patientTheme.colors.primaryDark}
                  />
                  <Text style={styles.requestSuccessText}>
                    Solicitação registrada para análise da nutri.
                  </Text>
                </View>
              ) : null}

              <Text style={styles.requestLabel}>Dado que deseja alterar</Text>
              <TextInput
                value={requestField}
                onBlur={() => setFocusedRequestField('')}
                onChangeText={(value) => {
                  setRequestField(value);
                  setRequestSent(false);
                }}
                onFocus={() => setFocusedRequestField('field')}
                placeholder="Ex: telefone, peso, alergia, endereço..."
                placeholderTextColor={patientTheme.colors.textMuted}
                style={[
                  styles.requestInput,
                  focusedRequestField === 'field' ? styles.requestInputFocused : null,
                ]}
              />

              <Text style={styles.requestLabel}>O que precisa ser corrigido?</Text>
              <TextInput
                value={requestDetails}
                onBlur={() => setFocusedRequestField('')}
                onChangeText={(value) => {
                  setRequestDetails(value);
                  setRequestSent(false);
                }}
                onFocus={() => setFocusedRequestField('details')}
                placeholder="Descreva o valor correto ou a informação que precisa atualizar."
                placeholderTextColor={patientTheme.colors.textMuted}
                multiline
                style={[
                  styles.requestInput,
                  styles.requestTextArea,
                  focusedRequestField === 'details' ? styles.requestInputFocused : null,
                ]}
              />

              <TouchableOpacity
                style={[
                  styles.requestButton,
                  (!requestField.trim() || !requestDetails.trim()) && styles.requestButtonDisabled,
                ]}
                onPress={submitChangeRequest}
                disabled={!requestField.trim() || !requestDetails.trim()}
              >
                <Text style={styles.requestButtonText}>Enviar solicitação</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </SectionCard>

        <View style={styles.footerSpace} />
      </ScrollView>

      <BarraAbasPaciente
        navigation={navigation}
        rotaAtual={route?.name || 'PacientePerfil'}
        usuarioLogado={usuarioLogado}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: patientTheme.colors.background,
  },
  containerWeb: {
    height: '100%',
    maxHeight: '100%',
    overflow: 'hidden',
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: patientTheme.colors.textMuted,
    marginTop: 12,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  webScroll: {
    height: '100%',
    maxHeight: '100%',
    overflowX: 'hidden',
    overflowY: 'auto',
  },
  scrollContent: {
    flexGrow: 1,
    padding: patientTheme.spacing.screen,
    paddingBottom: PATIENT_TAB_BAR_HEIGHT + 32 + PATIENT_TAB_BAR_SPACE,
  },
  webScrollContent: {
    flexGrow: 0,
    minHeight: '100%',
  },
  greeting: {
    color: patientTheme.colors.text,
    fontSize: 30,
    fontWeight: '700',
    marginTop: 22,
  },
  headerSubtitle: {
    color: patientTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  heroCard: {
    marginTop: 22,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginRight: 14,
    width: 56,
  },
  avatarText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 22,
    fontWeight: '800',
  },
  heroCopy: {
    flex: 1,
  },
  heroName: {
    color: patientTheme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  heroEmail: {
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  heroBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.pill,
    flexDirection: 'row',
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroBadgeText: {
    color: patientTheme.colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  profileSection: {
    marginTop: 16,
  },
  requestCard: {
    marginTop: 16,
  },
  drilldownHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drilldownHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    color: patientTheme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sectionHelper: {
    color: patientTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  requestSuccess: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primarySoft,
    borderRadius: patientTheme.radius.lg,
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    padding: 12,
  },
  requestSuccessText: {
    color: patientTheme.colors.primaryDark,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  requestLabel: {
    color: patientTheme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 16,
  },
  requestInput: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderColor: patientTheme.colors.surfaceBorder,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1.5,
    color: patientTheme.colors.text,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  requestInputFocused: {
    backgroundColor: '#ffffff',
    borderColor: patientTheme.colors.primary,
  },
  requestTextArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  requestButton: {
    alignItems: 'center',
    backgroundColor: patientTheme.colors.primaryDark,
    borderRadius: patientTheme.radius.pill,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 48,
  },
  requestButtonDisabled: {
    backgroundColor: '#c8c8c8',
  },
  requestButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
  },
  infoList: {
    gap: 10,
    marginTop: 16,
  },
  infoRow: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderRadius: patientTheme.radius.lg,
    padding: 14,
    ...patientShadow,
  },
  infoLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 6,
  },
  footerSpace: {
    height: 10,
  },
});
