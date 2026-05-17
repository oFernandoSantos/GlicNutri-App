import React, { useState } from 'react';
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

function buildLogTxtCompleto(item) {
  const linhas = [
    'GlicNutri - Log completo',
    '========================',
    '',
    `SEQ: ${formatDetailValue(item?.seq)}`,
    `Usuario: ${formatDetailValue(item?.usuario)}`,
    `Programa: ${formatDetailValue(item?.programa || item?.modulo)}`,
    `Descricao: ${formatDetailValue(item?.descricao)}`,
    `Historico / Acao: ${formatDetailValue(item?.historico || item?.acao)}`,
    `Data/Hora: ${formatDetailValue(item?.dataHoraFormatada || item?.dataHora || item?.createdAt)}`,
    `Origem: ${formatDetailValue(item?.origem)}`,
    `Status: ${formatDetailValue(item?.status)}`,
    `Entidade: ${formatDetailValue(item?.entidade || item?.entity)}`,
    `ID da entidade: ${formatDetailValue(item?.entidadeId || item?.entityId)}`,
    '',
    'Complemento',
    '-----------',
    formatDetailValue(buildComplementoComDispositivo(item)),
    '',
    'Arquivo',
    '-------',
    formatDetailValue(item?.path),
    '',
    'Detalhes tecnicos',
    '-----------------',
    formatDetailValue(item?.detalhes || item?.details),
    '',
    'Dispositivo',
    '-----------',
    formatDetailValue(item?.dispositivo || item?.dispositivoResumo),
    '',
    'Stack / erro',
    '------------',
    formatDetailValue(item?.stack),
    '',
    'Payload completo',
    '----------------',
    formatDetailValue(item),
  ];

  return linhas.join('\n');
}

function buildTxtFileName(item) {
  const base = [
    'glicnutri-log',
    item?.seq,
    item?.programa || item?.modulo,
    item?.historico || item?.acao,
  ]
    .filter(Boolean)
    .join('-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `${base || 'glicnutri-log'}.txt`;
}

function baixarTxtNoWeb(fileName, content) {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof Blob === 'undefined') {
    return false;
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
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

  function handleVoltar() {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('AdminLogsSistema', { usuarioLogado: adminUser });
  }

  function handleExportarTxt() {
    if (!log) return;
    const txt = buildLogTxtCompleto(log);
    const fileName = buildTxtFileName(log);

    if (!baixarTxtNoWeb(fileName, txt)) {
      setExportText(txt);
    }
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
        <View>
          <TouchableOpacity style={styles.secondaryActionButtonSolo} onPress={handleExportarTxt} disabled={!log}>
            <Ionicons name="document-text-outline" size={17} color={adminTheme.colors.text} />
            <Text style={styles.secondaryActionButtonText}>Baixar .txt</Text>
          </TouchableOpacity>
        </View>

        {!log ? (
          <SectionCard style={styles.stateCard}>
            <Text style={styles.stateText}>Nao foi possivel abrir os detalhes deste registro.</Text>
          </SectionCard>
        ) : (
          <>
            <SectionCard style={styles.detailCard}>
              <Text style={styles.cardTitle}>Dados do registro</Text>
              <View style={styles.detailGrid}>
                <DetailItem label="Numero do registro" value={log.seq} />
                <DetailItem label="Usuario" value={log.usuario} />
                <DetailItem label="Programa" value={log.programa || log.modulo} />
                <DetailItem label="Historico / Acao" value={log.historico || log.acao} />
                <DetailItem label="Status" value={log.status} />
                <DetailItem label="Data e hora" value={log.dataHoraFormatada || log.dataHora || log.createdAt} />
                <DetailItem label="Origem" value={log.origem} />
                <DetailItem label="Entidade" value={log.entidade || log.entity} />
                <DetailItem label="ID da entidade" value={log.entidadeId || log.entityId} />
                <DetailItem label="Complemento" value={buildComplementoComDispositivo(log)} />
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
    borderRadius: adminTheme.radius.xl,
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
  secondaryActionButtonSolo: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panelMuted,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    minHeight: 42,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
  },
  secondaryActionButtonText: {
    color: adminTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
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
    borderRadius: adminTheme.radius.lg,
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
    borderRadius: adminTheme.radius.lg,
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
