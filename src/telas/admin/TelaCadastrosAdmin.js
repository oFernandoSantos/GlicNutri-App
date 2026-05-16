import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
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
import { supabase } from '../../servicos/configSupabase';
import { isAdminUser } from '../../servicos/servicoAdmin';
import { registrarLogAuditoria } from '../../servicos/servicoAuditoria';
import { adminShadow, adminTheme } from '../../temas/temaVisualAdmin';

const initialState = {
  pacientes: [],
  nutricionistas: [],
  medicos: [],
  admins: [],
  totals: {
    pacientes: 0,
    nutricionistas: 0,
    medicos: 0,
    admins: 0,
    excluidos: 0,
  },
};

function buildCadastrosAuditSnapshot(currentState, currentTipo, currentQuery) {
  return {
    filtroTipo: currentTipo || 'todos',
    buscaAtiva: Boolean(String(currentQuery || '').trim()),
    tamanhoBusca: String(currentQuery || '').trim().length,
    totais: {
      pacientes: Number(currentState?.totals?.pacientes) || 0,
      nutricionistas: Number(currentState?.totals?.nutricionistas) || 0,
      medicos: Number(currentState?.totals?.medicos) || 0,
      admins: Number(currentState?.totals?.admins) || 0,
      excluidos: Number(currentState?.totals?.excluidos) || 0,
    },
  };
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function pickName(row) {
  return (
    row?.nome_completo ||
    row?.nome_completo_nutri ||
    row?.nome_nutri ||
    row?.nome_completo_medico ||
    row?.nome_medico ||
    row?.nome_completo_admin ||
    row?.email_pac ||
    row?.email_acesso ||
    row?.email_medico ||
    'Nome nao informado'
  );
}

function mapCadastro(row, tipo) {
  const id =
    row?.id_paciente_uuid ||
    row?.id_nutricionista_uuid ||
    row?.id_medico_uuid ||
    row?.id_admin_uuid ||
    row?.id ||
    `${tipo}-${pickName(row)}`;

  return {
    id,
    tipo,
    nome: pickName(row),
    email: row?.email_pac || row?.email_acesso || row?.email_medico || row?.email || '',
    documento: row?.cpf_paciente || row?.crm_numero || row?.crm_medico || '',
    status: row?.excluido === true || row?.ativo === false ? 'Inativo' : 'Ativo',
  };
}

async function countRows(table, modifier) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (modifier) query = modifier(query);
  const { count, error } = await query;
  if (error) return 0;
  return count || 0;
}

async function fetchCadastroRows(table, tipo) {
  const { data, error } = await supabase.from(table).select('*').limit(20);
  if (error) return [];
  return (data || []).map((row) => mapCadastro(row, tipo));
}

function CadastroRow({ item }) {
  const icon =
    item.tipo === 'paciente'
      ? 'person-outline'
      : item.tipo === 'nutricionista'
        ? 'nutrition-outline'
        : item.tipo === 'medico'
          ? 'medkit-outline'
          : 'shield-checkmark-outline';

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={adminTheme.colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.nome}</Text>
          <Text style={[styles.status, item.status === 'Ativo' ? styles.statusActive : styles.statusInactive]}>
            {item.status}
          </Text>
        </View>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {item.tipo} | {item.email || 'email nao informado'}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{item.documento || 'documento nao informado'}</Text>
      </View>
    </View>
  );
}

export default function TelaCadastrosAdmin({ navigation, route, usuarioLogado, onAdminLogout }) {
  const adminUser = usuarioLogado || route?.params?.usuarioLogado || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [state, setState] = useState(initialState);
  const [hasLoadedCadastros, setHasLoadedCadastros] = useState(false);

  async function handleLogout() {
    if (adminUser) {
      await registrarLogAuditoria({
        actor: adminUser,
        actorType: 'admin',
        action: 'logout_admin',
        entity: 'sessao',
        entityId: adminUser?.id_admin_uuid || null,
        origin: 'admin_cadastros',
        status: 'sucesso',
        details: {},
      });
    }
    await onAdminLogout?.();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  async function carregar({ isRefresh = false } = {}) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [
        pacientes,
        nutricionistas,
        medicos,
        admins,
        totalPacientes,
        totalNutricionistas,
        totalMedicos,
        totalAdmins,
        excluidos,
      ] = await Promise.all([
        fetchCadastroRows('paciente', 'paciente'),
        fetchCadastroRows('nutricionista', 'nutricionista'),
        fetchCadastroRows('medico', 'medico'),
        fetchCadastroRows('administrador', 'admin'),
        countRows('paciente', (q) => q.or('excluido.is.null,excluido.eq.false')),
        countRows('nutricionista'),
        countRows('medico'),
        countRows('administrador'),
        countRows('paciente', (q) => q.eq('excluido', true)),
      ]);

      setState({
        pacientes,
        nutricionistas,
        medicos,
        admins,
        totals: {
          pacientes: totalPacientes,
          nutricionistas: totalNutricionistas,
          medicos: totalMedicos,
          admins: totalAdmins,
          excluidos,
        },
      });
      setHasLoadedCadastros(true);

      if (isAdminUser(adminUser)) {
        await registrarLogAuditoria({
          actor: adminUser,
          actorType: 'admin',
          action: isRefresh ? 'admin_atualiza_cadastros' : 'admin_consulta_cadastros',
          entity: 'painel_cadastros',
          entityId: adminUser?.id_admin_uuid || null,
          origin: 'admin_cadastros',
          status: 'sucesso',
          details: buildCadastrosAuditSnapshot(
            {
              totals: {
                pacientes: totalPacientes,
                nutricionistas: totalNutricionistas,
                medicos: totalMedicos,
                admins: totalAdmins,
                excluidos,
              },
            },
            tipo,
            query
          ),
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }


  useEffect(() => {
    if (isAdminUser(adminUser)) carregar();
  }, [adminUser]);

  useEffect(() => {
    if (route?.params?.foco === 'admin') {
      setTipo('admin');
    }
  }, [route?.params?.foco]);

  useEffect(() => {
    navigation.setOptions({
      readerOnMenuPress: undefined,
      readerMenuDisabled: true,
      readerRightAction: () => carregar({ isRefresh: true }),
      readerRightIcon: 'refresh-outline',
      readerRightLoading: refreshing,
    });
  }, [navigation, adminUser, refreshing]);

  const registros = useMemo(() => {
    const all = [...state.pacientes, ...state.nutricionistas, ...state.medicos, ...state.admins];
    const term = normalizeText(query);
    return all.filter((item) => {
      if (tipo !== 'todos' && item.tipo !== tipo) return false;
      if (!term) return true;
      return normalizeText([item.nome, item.email, item.documento, item.tipo].join(' ')).includes(term);
    });
  }, [query, state, tipo]);

  useEffect(() => {
    if (!hasLoadedCadastros || !isAdminUser(adminUser)) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      registrarLogAuditoria({
        actor: adminUser,
        actorType: 'admin',
        action: 'admin_filtra_cadastros',
        entity: 'painel_cadastros',
        entityId: adminUser?.id_admin_uuid || null,
        origin: 'admin_cadastros',
        status: 'sucesso',
        details: {
          filtroTipo: tipo || 'todos',
          buscaAtiva: Boolean(String(query || '').trim()),
          tamanhoBusca: String(query || '').trim().length,
          totalResultados: registros.length,
        },
      }).catch(() => {});
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [adminUser, hasLoadedCadastros, query, registros.length, tipo]);

  if (!isAdminUser(adminUser)) {
    return (
      <View style={styles.container}>
        <Text style={styles.accessText}>Entre com um perfil administrador.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar barStyle="light-content" backgroundColor={adminTheme.colors.background} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => carregar({ isRefresh: true })} />}
      >
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>Cadastros</Text>
          <Text style={styles.heroTitle}>Controle de usuarios</Text>
          <Text style={styles.heroText}>Consulte pacientes, nutricionistas, medicos e administradores em uma unica tela.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={adminTheme.colors.primary} />
            <Text style={styles.loadingText}>Carregando cadastros...</Text>
          </View>
        ) : (
          <>
            <View style={styles.metricGrid}>
              <View style={styles.metricCard}><Text style={styles.metricValue}>{state.totals.pacientes}</Text><Text style={styles.metricLabel}>Pacientes</Text></View>
              <View style={styles.metricCard}><Text style={styles.metricValue}>{state.totals.nutricionistas}</Text><Text style={styles.metricLabel}>Nutricionistas</Text></View>
              <View style={styles.metricCard}><Text style={styles.metricValue}>{state.totals.medicos}</Text><Text style={styles.metricLabel}>Medicos</Text></View>
              <View style={styles.metricCard}><Text style={styles.metricValue}>{state.totals.admins}</Text><Text style={styles.metricLabel}>Admins</Text></View>
            </View>

            <View style={styles.panel}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={18} color={adminTheme.colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar por nome, email, CPF ou CRM"
                  placeholderTextColor={adminTheme.colors.textMuted}
                  style={styles.searchInput}
                />
              </View>

              <View style={styles.filters}>
                {['todos', 'paciente', 'nutricionista', 'medico', 'admin'].map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.filter, tipo === item && styles.filterActive]}
                    onPress={() => setTipo(item)}
                  >
                    <Text style={[styles.filterText, tipo === item && styles.filterTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>{registros.length} cadastro(s) encontrados</Text>
              {registros.length ? registros.map((item) => (
                <CadastroRow key={`${item.tipo}-${item.id}`} item={item} />
              )) : (
                <Text style={styles.emptyText}>Nenhum cadastro encontrado.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <BarraAbasAdmin navigation={navigation} rotaAtual="AdminCadastros" usuarioLogado={adminUser} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: adminTheme.colors.background },
  containerWeb: { minHeight: '100%', overflow: 'visible' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: adminTheme.spacing.screen,
    paddingTop: 10,
    paddingBottom: ADMIN_TAB_BAR_HEIGHT + ADMIN_TAB_BAR_SPACE + 30,
  },
  hero: {
    backgroundColor: adminTheme.colors.panelStrong,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.xl,
    borderWidth: 1,
    padding: 18,
    ...adminShadow,
  },
  heroKicker: { color: adminTheme.colors.primary, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  heroTitle: { color: adminTheme.colors.text, fontSize: 28, fontWeight: '900', marginTop: 4 },
  heroText: { color: adminTheme.colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  loadingCard: { alignItems: 'center', gap: 10, marginTop: 22 },
  loadingText: { color: adminTheme.colors.textMuted, fontWeight: '800' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  metricCard: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 140,
    padding: 16,
    ...adminShadow,
  },
  metricValue: { color: adminTheme.colors.text, fontSize: 28, fontWeight: '900' },
  metricLabel: { color: adminTheme.colors.textMuted, fontSize: 12, fontWeight: '800', marginTop: 4 },
  panel: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
    ...adminShadow,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 46,
    paddingHorizontal: 12,
  },
  searchInput: { color: adminTheme.colors.text, flex: 1, fontSize: 14, marginLeft: 8, outlineStyle: 'none' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  filter: {
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterActive: { backgroundColor: adminTheme.colors.primary, borderColor: adminTheme.colors.primary },
  filterText: { color: adminTheme.colors.text, fontSize: 12, fontWeight: '900', textTransform: 'capitalize' },
  filterTextActive: { color: adminTheme.colors.onPrimary },
  sectionTitle: { color: adminTheme.colors.text, fontSize: 16, fontWeight: '900', marginTop: 18 },
  row: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    padding: 12,
  },
  rowIcon: {
    alignItems: 'center',
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitleLine: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  rowTitle: { color: adminTheme.colors.text, flex: 1, fontSize: 14, fontWeight: '900' },
  rowMeta: { color: adminTheme.colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 3 },
  status: { borderRadius: adminTheme.radius.pill, fontSize: 11, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  statusActive: { backgroundColor: adminTheme.colors.successSoft, color: adminTheme.colors.success },
  statusInactive: { backgroundColor: adminTheme.colors.dangerSoft, color: adminTheme.colors.danger },
  emptyText: { color: adminTheme.colors.textMuted, fontSize: 13, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  accessText: { color: adminTheme.colors.text, margin: 20 },
});
