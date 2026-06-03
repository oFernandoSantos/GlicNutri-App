import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BotaoAgendamento, CartaoAgendamento } from '../agendamento/uiAgendamento';
import { ConsultaStatusBadge } from '../comum/ui';
import { patientTheme } from '../../temas/temaVisualPaciente';
import {
  abrirLinkGoogleMeet,
  formatConsultaDateTime,
  listConsultasByPaciente,
} from '../../servicos/servicoConsultas';
import { normalizeGoogleMeetUrl, resolveMeetLink } from '../../servicos/servicoGoogleMeet';
import { mostrarToastPaciente, mostrarToastPacienteErro } from '../../servicos/servicoToastPaciente';

const STATUS_ATIVOS = new Set(['scheduled', 'confirmed']);

function isConsultaAtiva(consulta) {
  const status = String(consulta?.status || 'scheduled').toLowerCase();
  return STATUS_ATIVOS.has(status);
}

function isConsultaFutura(consulta) {
  const when = new Date(consulta?.scheduled_at);
  if (Number.isNaN(when.getTime())) return true;
  return when.getTime() >= Date.now() - 60 * 60 * 1000;
}

export default function SecaoMeetConsultasProfissional({
  patientId,
  profissionalId,
  profissionalTipo = 'nutricionista',
  profissional,
}) {
  const [consultas, setConsultas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [abrindoId, setAbrindoId] = useState(null);

  const linkPadraoProfissional = useMemo(
    () => resolveMeetLink({ consulta: null, profissional }),
    [profissional]
  );

  const carregarConsultas = useCallback(async () => {
    if (!patientId || !profissionalId) {
      setConsultas([]);
      return;
    }

    try {
      setLoading(true);
      const todas = await listConsultasByPaciente(patientId, { limit: 80 });
      const filtroId =
        profissionalTipo === 'medico' ? 'medico_id' : 'nutricionista_id';

      const doProfissional = (todas || [])
        .filter((item) => String(item?.[filtroId] || '') === String(profissionalId))
        .filter(isConsultaAtiva)
        .filter(isConsultaFutura)
        .sort(
          (a, b) =>
            new Date(a?.scheduled_at).getTime() - new Date(b?.scheduled_at).getTime()
        );

      setConsultas(doProfissional);
    } catch (error) {
      console.log('Erro ao carregar consultas para Meet:', error);
      setConsultas([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, profissionalId, profissionalTipo]);

  useEffect(() => {
    carregarConsultas();
  }, [carregarConsultas]);

  async function handleEntrarMeet(consulta) {
    const link = resolveMeetLink({ consulta, profissional });
    try {
      setAbrindoId(consulta?.id || 'padrao');
      await abrirLinkGoogleMeet(link);
    } catch (error) {
      mostrarToastPacienteErro(error, 'Não foi possível abrir o Google Meet.');
    } finally {
      setAbrindoId(null);
    }
  }

  function renderLinkField(label, link, consulta = null) {
    const normalizado = normalizeGoogleMeetUrl(link);
    const consultaId = consulta?.id || 'padrao';

    return (
      <View style={styles.linkBlock} key={consultaId}>
        {label ? <Text style={styles.linkLabel}>{label}</Text> : null}
        <View style={styles.linkField}>
          <Ionicons name="videocam-outline" size={18} color={patientTheme.colors.primaryDark} />
          <Text style={styles.linkText} selectable numberOfLines={2}>
            {normalizado || 'Link ainda não disponível'}
          </Text>
        </View>
        <BotaoAgendamento
          label="Entrar no Google Meet"
          icon="open-outline"
          onPress={() => handleEntrarMeet(consulta)}
          loading={abrindoId === consultaId}
          disabled={!normalizado}
          style={styles.meetButton}
        />
      </View>
    );
  }

  return (
    <CartaoAgendamento style={[styles.card, styles.cardWhite]}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Google Meet</Text>
          <Text style={styles.subtitle}>
            Links das suas consultas com este profissional.
          </Text>
        </View>
        {loading ? <ActivityIndicator color={patientTheme.colors.primaryDark} /> : null}
      </View>

      {loading ? (
        <Text style={styles.hint}>Carregando links...</Text>
      ) : consultas.length ? (
        consultas.map((consulta) => {
          const meetLink = resolveMeetLink({ consulta, profissional });
          return (
            <View key={consulta.id} style={styles.consultaItem}>
              <View style={styles.consultaTop}>
                <Text style={styles.consultaData}>
                  {formatConsultaDateTime(consulta.scheduled_at)}
                </Text>
                <ConsultaStatusBadge status={consulta.status} />
              </View>
              {consulta.tipo_consulta ? (
                <Text style={styles.consultaMeta}>{consulta.tipo_consulta}</Text>
              ) : null}
              {renderLinkField('Link da consulta', meetLink, consulta)}
            </View>
          );
        })
      ) : (
        <>
          <Text style={styles.empty}>
            Nenhuma consulta futura com este profissional. Após agendar, o link aparece aqui.
          </Text>
          {linkPadraoProfissional
            ? renderLinkField('Link padrão do profissional', linkPadraoProfissional, null)
            : (
              <View style={styles.awaitBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={patientTheme.colors.textMuted}
                />
                <Text style={styles.awaitText}>
                  O link do Meet é liberado quando a consulta for confirmada.
                </Text>
              </View>
            )}
        </>
      )}
    </CartaoAgendamento>
  );
}

const OUTLINE = '#E8ECF0';

const styles = StyleSheet.create({
  card: {
    gap: 12,
    marginBottom: 14,
  },
  cardWhite: {
    backgroundColor: '#FFFFFF',
    borderColor: OUTLINE,
    borderWidth: 1,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: patientTheme.colors.text,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: patientTheme.colors.textMuted,
  },
  hint: {
    fontSize: 12,
    color: patientTheme.colors.textMuted,
  },
  empty: {
    fontSize: 13,
    lineHeight: 19,
    color: patientTheme.colors.textMuted,
  },
  consultaItem: {
    borderTopWidth: 1,
    borderTopColor: patientTheme.colors.border,
    gap: 8,
    paddingTop: 12,
  },
  consultaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  consultaData: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  consultaMeta: {
    fontSize: 12,
    color: patientTheme.colors.textMuted,
  },
  linkBlock: {
    gap: 8,
  },
  linkLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  linkField: {
    alignItems: 'center',
    backgroundColor: '#FAFBFC',
    borderColor: OUTLINE,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: patientTheme.colors.primaryDark,
    fontWeight: '600',
  },
  meetButton: {
    marginTop: 0,
  },
  awaitBox: {
    alignItems: 'flex-start',
    backgroundColor: '#FAFBFC',
    borderColor: OUTLINE,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  awaitText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: patientTheme.colors.textMuted,
  },
});
