import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import { formatConsultaDateTime } from '../../servicos/servicoConsultas';
import { normalizeGoogleMeetUrl } from '../../servicos/servicoGoogleMeet';
import { BotaoAgendamento, BadgeStatusConsulta } from './uiAgendamento';

export default function GavetaConsultaProfissional({
  visible,
  consulta,
  paciente,
  onClose,
  onConfirmar,
  onCancelar,
  onIniciar,
  onProntuario,
  loading,
}) {
  const slide = useRef(new Animated.Value(480)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 0 : 480,
      useNativeDriver: true,
      friction: 9,
    }).start();
  }, [visible, slide]);

  if (!visible) return null;

  const nomePaciente = paciente?.nome_completo || 'Paciente';
  const idade = paciente?.data_nascimento
    ? new Date().getFullYear() - new Date(paciente.data_nascimento).getFullYear()
    : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.drawer, { transform: [{ translateY: slide }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{nomePaciente}</Text>
              <Text style={styles.subtitle}>
                {idade ? `${idade} anos` : 'Idade não informada'} · Teleconsulta
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.close}>
              <Ionicons name="close" size={20} color={patientTheme.colors.text} />
            </TouchableOpacity>
          </View>

          <BadgeStatusConsulta status={consulta?.status} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Horário</Text>
              <Text style={styles.infoValue}>
                {formatConsultaDateTime(consulta?.scheduled_at)}
              </Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Duração estimada</Text>
              <Text style={styles.infoValue}>30 minutos</Text>
            </View>
            {consulta?.motivo ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Motivo</Text>
                <Text style={styles.infoValue}>{consulta.motivo}</Text>
              </View>
            ) : null}
            {consulta?.tipo_consulta ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Tipo</Text>
                <Text style={styles.infoValue}>{consulta.tipo_consulta}</Text>
              </View>
            ) : null}
            {consulta?.convenio ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Convênio</Text>
                <Text style={styles.infoValue}>{consulta.convenio}</Text>
              </View>
            ) : null}
            {normalizeGoogleMeetUrl(consulta?.meet_link) ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Google Meet</Text>
                <Text style={styles.infoValue} numberOfLines={2}>
                  {normalizeGoogleMeetUrl(consulta.meet_link)}
                </Text>
              </View>
            ) : null}
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Histórico rápido</Text>
              <Text style={styles.infoValue}>
                Paciente vinculado ao acompanhamento nutricional GlicNutri. Revise glicemia,
                plano alimentar e registros recentes antes da consulta.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <BotaoAgendamento
              label="Entrar no Google Meet"
              icon="videocam-outline"
              onPress={onIniciar}
              loading={loading}
            />
            <BotaoAgendamento
              label="Abrir prontuário"
              variant="ghost"
              icon="document-text-outline"
              onPress={onProntuario}
            />
            <View style={styles.row}>
              <BotaoAgendamento
                label="Confirmar"
                variant="ghost"
                onPress={onConfirmar}
                style={styles.half}
              />
              <BotaoAgendamento
                label="Cancelar"
                variant="danger"
                onPress={onCancelar}
                style={styles.half}
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: patientTheme.colors.overlay,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  drawer: {
    maxHeight: '88%',
    backgroundColor: patientTheme.colors.background,
    borderTopLeftRadius: patientTheme.radius.xl,
    borderTopRightRadius: patientTheme.radius.xl,
    paddingHorizontal: patientTheme.spacing.screen,
    paddingBottom: Platform.OS === 'web' ? 24 : 34,
    paddingTop: 10,
    ...patientShadow,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: patientTheme.colors.border,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: patientTheme.colors.text,
  },
  subtitle: {
    marginTop: 4,
    color: patientTheme.colors.textMuted,
    fontWeight: '600',
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    gap: 10,
    paddingVertical: 14,
  },
  infoCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.lg,
    padding: 14,
    ...patientShadow,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: patientTheme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
  actions: {
    gap: 10,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
  },
});
