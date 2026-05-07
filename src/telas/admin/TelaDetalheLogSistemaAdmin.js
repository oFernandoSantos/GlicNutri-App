import React, { useMemo, useState } from 'react';
import {
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
import BarraAbasAdmin, {
  ADMIN_TAB_BAR_HEIGHT,
  ADMIN_TAB_BAR_SPACE,
} from '../../componentes/admin/BarraAbasAdmin';
import { adminShadow, adminTheme } from '../../temas/temaVisualAdmin';
import { isAdminUser } from '../../servicos/servicoAdmin';

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

function formatDetailValue(value) {
  if (value == null || value === '') return '-';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_error) {
      return String(value);
    }
  }
  return String(value);
}

function buildComplementoComDispositivo(item) {
  const complemento = String(item?.complemento || '');
  const dispositivo = String(item?.dispositivoResumo || '').trim();

  if (!dispositivo) return complemento;
  return complemento ? `${complemento} | Dispositivo: ${dispositivo}` : `Dispositivo: ${dispositivo}`;
}

function buildExportPreview(item) {
  const header = 'SEQ;Usuario;Programa;Descricao;Acao;Data/Hora;Complemento;Origem;Status;Entidade;Arquivo';
  const row = [
    item?.seq,
    item?.usuario,
    item?.programa || item?.modulo,
    item?.descricao,
    item?.historico || item?.acao,
    item?.dataHoraFormatada || item?.dataHora || item?.createdAt,
    buildComplementoComDispositivo(item),
    item?.origem,
    item?.status,
    item?.entidade || item?.entity,
    item?.path,
  ]
    .map((value) => `"${String(value || '').replace(/"/g, '""')}"`)
    .join(';');

  return [header, row].join('\n');
}

function DetailItem({ label, value, mono = false, wide = false }) {
  return (
    <View style={[styles.detailItem, wide && styles.detailItemWide]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.detailValueMono]} selectable>
        {formatDetailValue(value)}
      </Text>
    </View>
  );
}

export default function TelaDetalheLogSistemaAdmin({ navigation, route, usuarioLogado }) {
  const adminUser = usuarioLogado || route?.params?.usuarioLogado || null;
  const log = route?.params?.log || null;
  const [exportText, setExportText] = useState('');

  const titulo = useMemo(() => {
    if (!log) return 'Registro nao encontrado';
    return `${log.historico || log.acao || 'LOG'} - ${log.programa || log.modulo || 'Sistema'}`;
  }, [log]);

  function handleVoltar() {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('AdminLogsSistema', { usuarioLogado: adminUser });
  }

  function handleExportarRegistro() {
    if (!log) return;
    setExportText(buildExportPreview(log));
  }

  if (!isAdminUser(adminUser)) {
    return (
      <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
        <StatusBar barStyle="light-content" backgroundColor={adminTheme.colors.background} />
        <SectionCard style={styles.accessCard}>
          <Text style={styles.accessTitle}>Acesso negado</Text>
          <Text style={styles.accessText}>Entre com um perfil administrador para consultar este registro.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleVoltar}>
            <Text style={styles.primaryButtonText}>Voltar</Text>
          </TouchableOpacity>
        </SectionCard>
      </View>
    );
  }

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="light-content" backgroundColor={adminTheme.colors.background} />

      <ScrollView
        style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
        contentContainerStyle={[styles.scrollContent, Platform.OS === 'web' && styles.webScrollContent]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleVoltar}>
            <Ionicons name="arrow-back-outline" size={18} color={adminTheme.colors.text} />
            <Text style={styles.backButtonText}>Voltar para logs</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{titulo}</Text>
            <Text style={styles.headerSubtitle}>
              {log?.dataHoraFormatada || log?.dataHora || log?.createdAt || 'Data nao informada'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleExportarRegistro} disabled={!log}>
              <Ionicons name="download-outline" size={17} color={adminTheme.colors.onPrimary} />
              <Text style={styles.actionButtonText}>Exportar registro</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!log ? (
          <SectionCard style={styles.stateCard}>
            <Text style={styles.stateText}>Nao foi possivel abrir os detalhes deste registro.</Text>
          </SectionCard>
        ) : (
          <>
            <SectionCard style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Ionicons name="pulse-outline" size={28} color={adminTheme.colors.primary} />
              </View>
              <View style={styles.summaryContent}>
                <Text style={styles.summaryLabel}>Registro {log.seq || '-'}</Text>
                <Text style={styles.summaryTitle}>{log.descricao || 'Acao do sistema'}</Text>
                <Text style={styles.summaryText}>{buildComplementoComDispositivo(log) || '-'}</Text>
              </View>
            </SectionCard>

            <SectionCard style={styles.detailCard}>
              <Text style={styles.cardTitle}>Dados do registro</Text>
              <View style={styles.detailGrid}>
                <DetailItem label="Usuario" value={log.usuario} />
                <DetailItem label="Programa" value={log.programa || log.modulo} />
                <DetailItem label="Historico / Acao" value={log.historico || log.acao} />
                <DetailItem label="Status" value={log.status} />
                <DetailItem label="Data e hora" value={log.dataHoraFormatada || log.dataHora || log.createdAt} />
                <DetailItem label="Origem" value={log.origem} />
                <DetailItem label="Entidade" value={log.entidade || log.entity} />
                <DetailItem label="ID da entidade" value={log.entidadeId || log.entityId} />
                <DetailItem label="Complemento" value={buildComplementoComDispositivo(log)} wide />
              </View>
            </SectionCard>

            <SectionCard style={styles.detailCard}>
              <Text style={styles.cardTitle}>Informacoes tecnicas</Text>
              <View style={styles.detailGrid}>
                <DetailItem label="Arquivo" value={log.path} mono wide />
                <DetailItem label="Detalhes" value={log.detalhes || log.details} mono wide />
                <DetailItem label="Dispositivo" value={log.dispositivo || log.dispositivoResumo} mono wide />
                <DetailItem label="Stack / erro" value={log.stack} mono wide />
              </View>
            </SectionCard>
          </>
        )}

        {exportText ? (
          <SectionCard style={styles.exportCard}>
            <View style={styles.exportHeader}>
              <Text style={styles.exportTitle}>Exportacao do registro</Text>
              <TouchableOpacity style={styles.clearExportButton} onPress={() => setExportText('')}>
                <Ionicons name="close-outline" size={18} color={adminTheme.colors.danger} />
                <Text style={styles.clearExportButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.exportTextArea}
              value={exportText}
              multiline
              editable={false}
              selectTextOnFocus
            />
          </SectionCard>
        ) : null}
      </ScrollView>

      <BarraAbasAdmin
        navigation={navigation}
        rotaAtual="AdminLogsSistema"
        usuarioLogado={adminUser}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: adminTheme.colors.background,
  },
  containerWeb: {
    minHeight: '100%',
    overflow: 'visible',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  webScroll: {
    overflowX: 'hidden',
    overflowY: 'visible',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: adminTheme.spacing.screen,
    paddingTop: 6,
    paddingBottom: ADMIN_TAB_BAR_HEIGHT + ADMIN_TAB_BAR_SPACE + 26,
  },
  webScrollContent: {
    flexGrow: 0,
    minHeight: '100%',
  },
  sectionCard: {
    backgroundColor: adminTheme.colors.panel,
    borderRadius: 8,
    padding: adminTheme.spacing.card,
    ...adminShadow,
  },
  accessCard: {
    margin: 18,
  },
  accessTitle: {
    color: adminTheme.colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  accessText: {
    color: adminTheme.colors.textMuted,
    marginTop: 8,
  },
  headerBar: {
    backgroundColor: adminTheme.colors.panelStrong,
    borderColor: adminTheme.colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 34,
  },
  backButtonText: {
    color: adminTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 7,
  },
  headerTitleWrap: {
    marginTop: 10,
    marginBottom: 14,
  },
  headerTitle: {
    color: adminTheme.colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  headerSubtitle: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    marginTop: 5,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    minHeight: 42,
    paddingHorizontal: 14,
  },
  actionButtonText: {
    color: adminTheme.colors.onPrimary,
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 7,
  },
  stateCard: {
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
  },
  stateText: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panelMuted,
    borderColor: adminTheme.colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  summaryTitle: {
    color: adminTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  summaryText: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  detailCard: {
    marginBottom: 12,
  },
  cardTitle: {
    color: adminTheme.colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  detailItem: {
    backgroundColor: adminTheme.colors.background,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 220,
    padding: 12,
  },
  detailItemWide: {
    flexBasis: '100%',
  },
  detailLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: adminTheme.colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  detailValueMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  exportCard: {
    marginTop: 0,
  },
  exportHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  exportTitle: {
    color: adminTheme.colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  clearExportButton: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 34,
  },
  clearExportButtonText: {
    color: adminTheme.colors.danger,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 4,
  },
  exportTextArea: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    color: adminTheme.colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
    minHeight: 180,
    padding: 12,
    textAlignVertical: 'top',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 44,
  },
  primaryButtonText: {
    color: adminTheme.colors.onPrimary,
    fontWeight: '900',
  },
});
