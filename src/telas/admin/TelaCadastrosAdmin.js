import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { RolagemModalTeclado } from '../../componentes/comum/RolagemComTeclado';
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
const CADASTROS_LIMIT = 50000;
const CADASTROS_PAGE_SIZE = 10;
const CADASTROS_TOP_OFFSET = 82;
const CADASTRO_TYPE_CONFIG = {
  paciente: {
    table: 'paciente',
    idColumn: 'id_paciente_uuid',
    nameField: 'nome_completo',
    emailField: 'email_pac',
    documentField: 'cpf_paciente',
    documentLabel: 'CPF',
    deleteMode: 'logical',
  },
  nutricionista: {
    table: 'nutricionista',
    idColumn: 'id_nutricionista_uuid',
    nameField: 'nome_completo_nutri',
    emailField: 'email_acesso',
    documentField: 'crm_numero',
    documentLabel: 'CRN',
    deleteMode: 'inactive',
  },
  medico: {
    table: 'medico',
    idColumn: 'id_medico_uuid',
    nameField: 'nome_completo_medico',
    emailField: 'email_medico',
    documentField: 'crm_medico',
    documentLabel: 'CRM',
    deleteMode: 'inactive',
  },
  admin: {
    table: 'administrador',
    idColumn: 'id_admin_uuid',
    nameField: 'nome_completo_admin',
    emailField: 'email_acesso',
    documentField: null,
    documentLabel: '',
    deleteMode: 'inactive',
  },
};
const createTypeOptions = [
  { value: 'paciente', label: 'Paciente' },
  { value: 'nutricionista', label: 'Nutricionista' },
  { value: 'medico', label: 'Medico' },
  { value: 'admin', label: 'Admin' },
];

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
  const config = CADASTRO_TYPE_CONFIG[tipo] || {};
  const id = row?.[config.idColumn] || row?.id || `${tipo}-${pickName(row)}`;

  return {
    id,
    tipo,
    nome: pickName(row),
    email: row?.email_pac || row?.email_acesso || row?.email_medico || row?.email || '',
    documento: row?.cpf_paciente || row?.crm_numero || row?.crm_medico || '',
    status: row?.excluido === true || row?.ativo === false ? 'Inativo' : 'Ativo',
    table: config.table || null,
    idColumn: config.idColumn || null,
    nameField: config.nameField || null,
    emailField: config.emailField || null,
    documentField: config.documentField || null,
    documentLabel: config.documentLabel || '',
    deleteMode: config.deleteMode || 'inactive',
    row,
  };
}

function formatarCpf(valor) {
  const cpfLimpo = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (cpfLimpo.length !== 11) {
    return valor || '';
  }

  return cpfLimpo
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

function formatarCep(valor) {
  const cepLimpo = String(valor || '').replace(/\D/g, '').slice(0, 8);
  if (cepLimpo.length <= 5) {
    return cepLimpo;
  }
  return cepLimpo.replace(/^(\d{5})(\d)/, '$1-$2');
}

function formatarData(valor) {
  const clean = String(valor || '').replace(/\D/g, '').slice(0, 8);
  return clean
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
}

function formatarDataBancoParaTela(valor) {
  const data = String(valor || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!data) {
    return '';
  }
  const [, ano, mes, dia] = data;
  return `${dia}/${mes}/${ano}`;
}

function formatarDataTelaParaBanco(valor) {
  const clean = String(valor || '').replace(/\D/g, '');
  if (!clean) return null;
  if (clean.length !== 8) return '';
  const dia = clean.slice(0, 2);
  const mes = clean.slice(2, 4);
  const ano = clean.slice(4, 8);
  return `${ano}-${mes}-${dia}`;
}

async function countRows(table, modifier) {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (modifier) query = modifier(query);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function fetchAdminCount() {
  const { data, error } = await supabase.rpc('contar_administradores');

  if (error) {
    throw error;
  }

  return Number(data) || 0;
}

async function fetchCadastroRows(table, tipo) {
  const { data, error } = await supabase.from(table).select('*').limit(CADASTROS_LIMIT);
  if (error) throw error;
  return (data || []).map((row) => mapCadastro(row, tipo));
}

function CadastroRow({ item, onEdit, onDelete, actionLoadingId }) {
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
          <View style={styles.rowInlineActions}>
            <Text style={[styles.statusMinimal, item.status === 'Ativo' ? styles.statusMinimalActive : styles.statusMinimalInactive]}>
              {item.status}
            </Text>
            <TouchableOpacity
              style={styles.rowInlineButton}
              onPress={() => onEdit(item)}
              accessibilityLabel={`Editar ${item.nome}`}
            >
              <Ionicons name="create-outline" size={16} color={adminTheme.colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rowInlineButton}
              onPress={() => onDelete(item)}
              disabled={actionLoadingId === item.id}
              accessibilityLabel={`Apagar ${item.nome}`}
            >
              {actionLoadingId === item.id ? (
                <ActivityIndicator size="small" color={adminTheme.colors.danger} />
              ) : (
                <Ionicons name="trash-outline" size={16} color={adminTheme.colors.danger} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {[
            item.tipo,
            item.email || 'email nao informado',
            item.tipo === 'paciente'
              ? formatarCpf(item.documento) || 'CPF nao informado'
              : item.documento || 'documento nao informado',
          ].join(' | ')}
        </Text>
      </View>
    </View>
  );
}

const cadastroFilterOptions = [
  { value: 'todos', label: 'TODOS' },
  { value: 'paciente', label: 'PACIENTE' },
  { value: 'nutricionista', label: 'NUTRICIONISTA' },
  { value: 'medico', label: 'MEDICO' },
  { value: 'admin', label: 'ADMIN' },
];

export default function TelaCadastrosAdmin({ navigation, route, usuarioLogado, onAdminLogout }) {
  const adminUser = usuarioLogado || route?.params?.usuarioLogado || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [state, setState] = useState(initialState);
  const [hasLoadedCadastros, setHasLoadedCadastros] = useState(false);
  const [loadedCount, setLoadedCount] = useState(CADASTROS_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedCadastro, setSelectedCadastro] = useState(null);
  const [savingCadastro, setSavingCadastro] = useState(false);
  const [deletingCadastroId, setDeletingCadastroId] = useState(null);
  const [formError, setFormError] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creatingCadastro, setCreatingCadastro] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({
    tipo: 'paciente',
    nome: '',
    email: '',
    documento: '',
    senha: '',
    telefone: '',
    dataNascimento: '',
    sexo: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    ativo: true,
  });
  const [editForm, setEditForm] = useState({
    nome: '',
    email: '',
    documento: '',
    senha: '',
    telefone: '',
    dataNascimento: '',
    sexo: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    ativo: true,
  });
  const scrollMetricsRef = useRef({
    viewportHeight: 0,
    contentHeight: 0,
    offsetY: 0,
  });

  function fecharModalEdicao() {
    setEditModalVisible(false);
    setSelectedCadastro(null);
    setFormError('');
    setEditForm({
      nome: '',
      email: '',
      documento: '',
      senha: '',
      telefone: '',
      dataNascimento: '',
      sexo: '',
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
      ativo: true,
    });
  }

  function fecharModalExclusao() {
    setDeleteModalVisible(false);
    setSelectedCadastro(null);
  }

  function abrirModalCriacao() {
    setCreateForm({
      tipo: 'paciente',
      nome: '',
      email: '',
      documento: '',
      senha: '',
      telefone: '',
      dataNascimento: '',
      sexo: '',
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
      ativo: true,
    });
    setCreateError('');
    setCreateModalVisible(true);
  }

  function fecharModalCriacao() {
    setCreateModalVisible(false);
    setCreateError('');
    setCreateForm({
      tipo: 'paciente',
      nome: '',
      email: '',
      documento: '',
      senha: '',
      telefone: '',
      dataNascimento: '',
      sexo: '',
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      uf: '',
      ativo: true,
    });
  }

  function abrirModalEdicao(item) {
    setSelectedCadastro(item);
    setEditForm({
      nome: item?.nome || '',
      email: item?.email || '',
      documento: item?.documento || '',
      senha: '',
      telefone: item?.row?.telefone || '',
      dataNascimento: formatarDataBancoParaTela(item?.row?.data_nascimento),
      sexo: item?.row?.sexo_biologico || '',
      cep: formatarCep(item?.row?.cep || ''),
      logradouro: item?.row?.logradouro || '',
      numero: item?.row?.numero || '',
      bairro: item?.row?.bairro || '',
      cidade: item?.row?.cidade || '',
      uf: String(item?.row?.uf || '').toUpperCase(),
      ativo: item?.status !== 'Inativo',
    });
    setFormError('');
    setEditModalVisible(true);
  }

  function abrirModalExclusao(item) {
    setSelectedCadastro(item);
    setDeleteModalVisible(true);
  }

  async function salvarCadastroEditado() {
    if (!selectedCadastro?.table || !selectedCadastro?.idColumn) {
      setFormError('Cadastro sem identificador valido para editar.');
      return;
    }

    const nome = String(editForm.nome || '').trim();
    const email = String(editForm.email || '').trim().toLowerCase();
    const documento = String(editForm.documento || '').trim();
    const senha = String(editForm.senha || '').trim();

    if (!nome) {
      setFormError('Informe o nome para salvar as alteracoes.');
      return;
    }

    if (email && !email.includes('@')) {
      setFormError('Informe um e-mail valido.');
      return;
    }

    const payload = {
      [selectedCadastro.nameField]: nome,
      [selectedCadastro.emailField]: email || null,
    };

    if (selectedCadastro.documentField) {
      payload[selectedCadastro.documentField] = documento || null;
    }

    if (selectedCadastro.tipo === 'paciente') {
      payload.excluido = editForm.ativo ? false : true;
      payload.data_exclusao = editForm.ativo ? null : new Date().toISOString();
    }

    if (selectedCadastro.tipo === 'paciente') {
      const dataNascimento = formatarDataTelaParaBanco(editForm.dataNascimento);
      if (editForm.dataNascimento && !dataNascimento) {
        setFormError('Informe uma data valida no formato DD/MM/AAAA.');
        return;
      }

      payload.sexo_biologico = String(editForm.sexo || '').trim() || null;
      payload.telefone = String(editForm.telefone || '').trim() || null;
      payload.data_nascimento = dataNascimento;
      payload.cep = String(editForm.cep || '').replace(/\D/g, '') || null;
      payload.logradouro = String(editForm.logradouro || '').trim() || null;
      payload.numero = String(editForm.numero || '').trim() || null;
      payload.bairro = String(editForm.bairro || '').trim() || null;
      payload.cidade = String(editForm.cidade || '').trim() || null;
      payload.uf = String(editForm.uf || '').trim().toUpperCase() || null;
    } else {
      payload.ativo = Boolean(editForm.ativo);

      if (selectedCadastro.tipo === 'nutricionista') {
        const dataNascimento = formatarDataTelaParaBanco(editForm.dataNascimento);
        if (editForm.dataNascimento && !dataNascimento) {
          setFormError('Informe uma data valida no formato DD/MM/AAAA.');
          return;
        }
        payload.data_nascimento = dataNascimento;
        if (senha) {
          payload.senha_nutri = senha;
        }
      }

      if (selectedCadastro.tipo === 'medico' && senha) {
        payload.senha_medico = senha;
      }

      if (selectedCadastro.tipo === 'admin' && senha) {
        payload.senha_admin = senha;
      }
    }

    try {
      setSavingCadastro(true);
      setFormError('');

      const { error } = await supabase
        .from(selectedCadastro.table)
        .update(payload)
        .eq(selectedCadastro.idColumn, selectedCadastro.id);

      if (error) {
        throw error;
      }

      await registrarLogAuditoria({
        actor: adminUser,
        actorType: 'admin',
        action: 'admin_edita_cadastro',
        entity: selectedCadastro.tipo,
        entityId: selectedCadastro.id,
        origin: 'admin_cadastros',
        status: 'sucesso',
        details: {
          tipoCadastro: selectedCadastro.tipo,
          camposAtualizados: Object.keys(payload),
        },
      });

      fecharModalEdicao();
      await carregar({ isRefresh: true });
    } catch (error) {
      setFormError(
        String(error?.message || '').trim() || 'Nao foi possivel editar o cadastro agora.'
      );
    } finally {
      setSavingCadastro(false);
    }
  }

  async function confirmarExclusaoCadastro() {
    if (!selectedCadastro?.table || !selectedCadastro?.idColumn) {
      return;
    }

    try {
      setDeletingCadastroId(selectedCadastro.id);

      const payload =
        selectedCadastro.deleteMode === 'logical'
          ? {
              excluido: true,
              data_exclusao: new Date().toISOString(),
            }
          : {
              ativo: false,
            };

      const { error } = await supabase
        .from(selectedCadastro.table)
        .update(payload)
        .eq(selectedCadastro.idColumn, selectedCadastro.id);

      if (error) {
        throw error;
      }

      await registrarLogAuditoria({
        actor: adminUser,
        actorType: 'admin',
        action: 'admin_exclui_cadastro',
        entity: selectedCadastro.tipo,
        entityId: selectedCadastro.id,
        origin: 'admin_cadastros',
        status: 'sucesso',
        details: {
          tipoCadastro: selectedCadastro.tipo,
          modoExclusao: selectedCadastro.deleteMode,
        },
      });

      fecharModalExclusao();
      await carregar({ isRefresh: true });
    } catch (error) {
      setFormError(
        String(error?.message || '').trim() || 'Nao foi possivel apagar o cadastro agora.'
      );
    } finally {
      setDeletingCadastroId(null);
    }
  }

  async function criarNovoCadastro() {
    const tipoCadastro = createForm.tipo;
    const nome = String(createForm.nome || '').trim();
    const email = String(createForm.email || '').trim().toLowerCase();
    const documento = String(createForm.documento || '').trim();
    const senha = String(createForm.senha || '').trim();
    const telefone = String(createForm.telefone || '').trim();
    const dataNascimento = formatarDataTelaParaBanco(createForm.dataNascimento);
    const sexo = String(createForm.sexo || '').trim();
    const cep = String(createForm.cep || '').replace(/\D/g, '');
    const logradouro = String(createForm.logradouro || '').trim();
    const numero = String(createForm.numero || '').trim();
    const bairro = String(createForm.bairro || '').trim();
    const cidade = String(createForm.cidade || '').trim();
    const uf = String(createForm.uf || '').trim().toUpperCase();

    if (!nome || !email) {
      setCreateError('Preencha nome e e-mail para criar o cadastro.');
      return;
    }

    if (!email.includes('@')) {
      setCreateError('Informe um e-mail valido.');
      return;
    }

    if (senha.length < 8) {
      setCreateError(
        tipoCadastro === 'medico'
          ? 'A senha do medico precisa ter pelo menos 8 caracteres.'
          : 'A senha precisa ter pelo menos 8 caracteres.'
      );
      return;
    }

    if (tipoCadastro !== 'admin' && !documento) {
      setCreateError('Preencha o documento para esse tipo de acesso.');
      return;
    }

    if (createForm.dataNascimento && !dataNascimento) {
      setCreateError('Informe uma data valida no formato DD/MM/AAAA.');
      return;
    }

    let table = 'paciente';
    let entityIdField = 'id_paciente_uuid';
    let payload = {};

    if (tipoCadastro === 'paciente') {
      table = 'paciente';
      entityIdField = 'id_paciente_uuid';
      payload = {
        nome_completo: nome,
        email_pac: email,
        cpf_paciente: documento,
        senha_pac: senha,
        sexo_biologico: sexo || null,
        telefone: telefone || null,
        data_nascimento: dataNascimento,
        cep: cep || '00000000',
        logradouro: logradouro || 'Nao informado',
        numero: numero || '0',
        bairro: bairro || 'Nao informado',
        cidade: cidade || 'Nao informada',
        uf: uf || 'NI',
        excluido: false,
        data_exclusao: null,
      };
    } else if (tipoCadastro === 'nutricionista') {
      table = 'nutricionista';
      entityIdField = 'id_nutricionista_uuid';
      payload = {
        nome_completo_nutri: nome,
        email_acesso: email,
        crm_numero: documento,
        senha_nutri: senha,
        telefone: telefone || null,
        data_nascimento: dataNascimento,
        ativo: Boolean(createForm.ativo),
      };
    } else if (tipoCadastro === 'medico') {
      table = 'medico';
      entityIdField = 'id_medico_uuid';
      payload = {
        nome_completo_medico: nome,
        email_medico: email,
        crm_medico: documento,
        senha_medico: senha,
        telefone: telefone || null,
        data_nascimento: dataNascimento,
        ativo: Boolean(createForm.ativo),
      };
    } else {
      table = 'administrador';
      entityIdField = 'id_admin_uuid';
      payload = {
        nome_completo_admin: nome,
        email_acesso: email,
        senha_admin: senha,
        telefone: telefone || null,
        data_nascimento: dataNascimento,
        ativo: Boolean(createForm.ativo),
      };
    }

    try {
      setCreatingCadastro(true);
      setCreateError('');

      const { data, error } = await supabase
        .from(table)
        .insert([payload])
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      await registrarLogAuditoria({
        actor: adminUser,
        actorType: 'admin',
        action: 'admin_cria_cadastro',
        entity: tipoCadastro,
        entityId: data?.[entityIdField] || null,
        origin: 'admin_cadastros',
        status: 'sucesso',
        details: {
          tipoCadastro,
          email,
        },
      });

      fecharModalCriacao();
      await carregar({ isRefresh: true });
    } catch (error) {
      setCreateError(
        String(error?.message || '').trim() || 'Nao foi possivel criar o cadastro agora.'
      );
    } finally {
      setCreatingCadastro(false);
    }
  }

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
      setLoadError('');

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
        countRows('paciente'),
        countRows('nutricionista'),
        countRows('medico'),
        fetchAdminCount(),
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
    } catch (error) {
      setLoadError(
        String(error?.message || '').trim() ||
          'Nao foi possivel carregar todos os cadastros do banco.'
      );
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
      readerBackAction: () => {
        if (navigation.canGoBack?.()) {
          navigation.goBack();
          return;
        }
        navigation.navigate('AdminHome', { usuarioLogado: adminUser });
      },
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
  const visibleRegistros = useMemo(
    () => registros.slice(0, Math.min(loadedCount, registros.length)),
    [loadedCount, registros]
  );
  const hasMoreRegistros = visibleRegistros.length < registros.length;

  function loadMoreRegistrosIfNeeded() {
    if (!hasMoreRegistros || loading || refreshing || loadingMore) {
      return;
    }

    const { viewportHeight, contentHeight, offsetY } = scrollMetricsRef.current;
    if (!viewportHeight || !contentHeight) {
      return;
    }

    const distanceToBottom = contentHeight - (offsetY + viewportHeight);
    if (distanceToBottom <= 160) {
      setLoadingMore(true);
      setLoadedCount((current) => Math.min(current + CADASTROS_PAGE_SIZE, registros.length));
    }
  }

  function handleResultadosScroll(event) {
    const metrics = event?.nativeEvent;
    if (!metrics) {
      return;
    }

    scrollMetricsRef.current = {
      viewportHeight: metrics.layoutMeasurement.height || 0,
      contentHeight: metrics.contentSize.height || 0,
      offsetY: metrics.contentOffset.y || 0,
    };

    loadMoreRegistrosIfNeeded();
  }

  function handleResultadosLayout(event) {
    scrollMetricsRef.current = {
      ...scrollMetricsRef.current,
      viewportHeight: event?.nativeEvent?.layout?.height || 0,
    };
    loadMoreRegistrosIfNeeded();
  }

  function handleResultadosContentSizeChange(_width, height) {
    scrollMetricsRef.current = {
      ...scrollMetricsRef.current,
      contentHeight: height || 0,
    };
    loadMoreRegistrosIfNeeded();
  }

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

  useEffect(() => {
    setLoadedCount(CADASTROS_PAGE_SIZE);
    setLoadingMore(false);
    scrollMetricsRef.current = {
      viewportHeight: 0,
      contentHeight: 0,
      offsetY: 0,
    };
  }, [query, tipo, state]);

  useEffect(() => {
    if (!loadingMore) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setLoadingMore(false);
      loadMoreRegistrosIfNeeded();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadingMore, loadedCount, registros.length]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return undefined;
    }

    const previousBodyOverflow = document.body?.style?.overflow;
    const previousHtmlOverflow = document.documentElement?.style?.overflow;

    if (document.body) {
      document.body.style.overflow = 'hidden';
    }
    if (document.documentElement) {
      document.documentElement.style.overflow = 'hidden';
    }

    return () => {
      if (document.body) {
        document.body.style.overflow = previousBodyOverflow || '';
      }
      if (document.documentElement) {
        document.documentElement.style.overflow = previousHtmlOverflow || '';
      }
    };
  }, []);

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

      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharModalCriacao}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <RolagemModalTeclado
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalTitle}>Cadastrar novo usuario</Text>
              <Text style={styles.modalSubtitle}>
                Escolha o tipo de acesso e preencha os dados do novo cadastro.
              </Text>

              <View style={styles.modalTypeRow}>
                {createTypeOptions.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.modalTypeChip,
                      createForm.tipo === item.value && styles.modalTypeChipActive,
                    ]}
                    onPress={() =>
                      setCreateForm((current) => ({
                        ...current,
                        tipo: item.value,
                        documento: '',
                        senha: '',
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.modalTypeChipText,
                        createForm.tipo === item.value && styles.modalTypeChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Nome</Text>
              <TextInput
                value={createForm.nome}
                onChangeText={(value) => setCreateForm((current) => ({ ...current, nome: value }))}
                placeholder="Nome completo"
                placeholderTextColor={adminTheme.colors.textMuted}
                style={styles.modalInput}
              />

              <Text style={styles.modalLabel}>E-mail</Text>
              <TextInput
                value={createForm.email}
                onChangeText={(value) => setCreateForm((current) => ({ ...current, email: value }))}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="email@dominio.com"
                placeholderTextColor={adminTheme.colors.textMuted}
                style={styles.modalInput}
              />

              {createForm.tipo !== 'admin' ? (
                <>
                  <Text style={styles.modalLabel}>
                    {createForm.tipo === 'paciente'
                      ? 'CPF'
                      : createForm.tipo === 'nutricionista'
                        ? 'CRN'
                        : 'CRM'}
                  </Text>
                  <TextInput
                    value={createForm.documento}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({ ...current, documento: value }))
                    }
                    placeholder={
                      createForm.tipo === 'paciente'
                        ? 'CPF do paciente'
                        : createForm.tipo === 'nutricionista'
                          ? 'CRN do nutricionista'
                          : 'CRM do medico'
                    }
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />
                </>
              ) : null}

              {createForm.tipo === 'paciente' || createForm.tipo === 'nutricionista' || createForm.tipo === 'admin' ? (
                <>
                  <Text style={styles.modalLabel}>Senha</Text>
                  <TextInput
                    value={createForm.senha}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({ ...current, senha: value }))
                    }
                    secureTextEntry
                    placeholder="Senha de acesso"
                    placeholderTextColor={adminTheme.colors.textMuted}
                  style={styles.modalInput}
                />
              </>
            ) : null}

              {createForm.tipo === 'paciente' ? (
                <>
                  <Text style={styles.modalLabel}>Telefone</Text>
                  <TextInput
                    value={createForm.telefone}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({ ...current, telefone: value }))
                    }
                    placeholder="Telefone com DDD"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Data de nascimento</Text>
                  <TextInput
                    value={createForm.dataNascimento}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({
                        ...current,
                        dataNascimento: formatarData(value),
                      }))
                    }
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Sexo biologico</Text>
                  <TextInput
                    value={createForm.sexo}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({ ...current, sexo: value }))
                    }
                    placeholder="Sexo biologico"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>CEP</Text>
                  <TextInput
                    value={createForm.cep}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({ ...current, cep: formatarCep(value) }))
                    }
                    placeholder="00000-000"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Logradouro</Text>
                  <TextInput
                    value={createForm.logradouro}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({ ...current, logradouro: value }))
                    }
                    placeholder="Logradouro"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Numero</Text>
                  <TextInput
                    value={createForm.numero}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({ ...current, numero: value }))
                    }
                    placeholder="Numero"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Bairro</Text>
                  <TextInput
                    value={createForm.bairro}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({ ...current, bairro: value }))
                    }
                    placeholder="Bairro"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Cidade</Text>
                  <TextInput
                    value={createForm.cidade}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({ ...current, cidade: value }))
                    }
                    placeholder="Cidade"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>UF</Text>
                  <TextInput
                    value={createForm.uf}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({
                        ...current,
                        uf: String(value || '').toUpperCase().slice(0, 2),
                      }))
                    }
                    placeholder="UF"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />
                </>
              ) : null}

              {createForm.tipo !== 'paciente' ? (
                <>
                  <Text style={styles.modalLabel}>Telefone</Text>
                  <TextInput
                    value={createForm.telefone}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({ ...current, telefone: value }))
                    }
                    placeholder="Telefone"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Data de nascimento</Text>
                  <TextInput
                    value={createForm.dataNascimento}
                    onChangeText={(value) =>
                      setCreateForm((current) => ({
                        ...current,
                        dataNascimento: formatarData(value),
                      }))
                    }
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Status</Text>
                  <View style={styles.modalTypeRow}>
                    <TouchableOpacity
                      style={[
                        styles.modalTypeChip,
                        createForm.ativo === true && styles.modalTypeChipActive,
                      ]}
                      onPress={() => setCreateForm((current) => ({ ...current, ativo: true }))}
                    >
                      <Text
                        style={[
                          styles.modalTypeChipText,
                          createForm.ativo === true && styles.modalTypeChipTextActive,
                        ]}
                      >
                        Ativo
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalTypeChip,
                        createForm.ativo === false && styles.modalTypeChipActive,
                      ]}
                      onPress={() => setCreateForm((current) => ({ ...current, ativo: false }))}
                    >
                      <Text
                        style={[
                          styles.modalTypeChipText,
                          createForm.ativo === false && styles.modalTypeChipTextActive,
                        ]}
                      >
                        Inativo
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {createError ? <Text style={styles.modalError}>{createError}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalGhostButton} onPress={fecharModalCriacao}>
                  <Text style={styles.modalGhostButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalPrimaryButton, creatingCadastro && styles.modalPrimaryButtonDisabled]}
                  onPress={criarNovoCadastro}
                  disabled={creatingCadastro}
                >
                  {creatingCadastro ? (
                    <ActivityIndicator color={adminTheme.colors.onPrimary} />
                  ) : (
                    <Text style={styles.modalPrimaryButtonText}>Cadastrar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </RolagemModalTeclado>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharModalEdicao}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <RolagemModalTeclado
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalHeaderTextWrap}>
                  <Text style={styles.modalTitle}>Editar cadastro</Text>
                  <Text style={styles.modalSubtitle}>
                    Atualize os dados de {selectedCadastro?.tipo || 'usuario'}.
                  </Text>
                </View>
                <View style={styles.modalStatusWrap}>
                  <Text style={styles.modalStatusLabel}>Status</Text>
                  <View style={styles.modalStatusRow}>
                    <TouchableOpacity
                      style={[
                        styles.modalStatusChip,
                        editForm.ativo === true && styles.modalTypeChipActive,
                      ]}
                      onPress={() => setEditForm((current) => ({ ...current, ativo: true }))}
                    >
                      <Text
                        style={[
                          styles.modalTypeChipText,
                          editForm.ativo === true && styles.modalTypeChipTextActive,
                        ]}
                      >
                        Ativo
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalStatusChip,
                        editForm.ativo === false && styles.modalTypeChipActive,
                      ]}
                      onPress={() => setEditForm((current) => ({ ...current, ativo: false }))}
                    >
                      <Text
                        style={[
                          styles.modalTypeChipText,
                          editForm.ativo === false && styles.modalTypeChipTextActive,
                        ]}
                      >
                        Inativo
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={styles.modalLabel}>Nome</Text>
              <TextInput
                value={editForm.nome}
                onChangeText={(value) => setEditForm((current) => ({ ...current, nome: value }))}
                placeholder="Nome completo"
                placeholderTextColor={adminTheme.colors.textMuted}
                style={styles.modalInput}
              />

              <Text style={styles.modalLabel}>E-mail</Text>
              <TextInput
                value={editForm.email}
                onChangeText={(value) => setEditForm((current) => ({ ...current, email: value }))}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="email@dominio.com"
                placeholderTextColor={adminTheme.colors.textMuted}
                style={styles.modalInput}
              />

              {selectedCadastro?.documentField ? (
                <>
                  <Text style={styles.modalLabel}>{selectedCadastro.documentLabel}</Text>
                  <TextInput
                    value={editForm.documento}
                    onChangeText={(value) =>
                      setEditForm((current) => ({ ...current, documento: value }))
                    }
                    placeholder={selectedCadastro.documentLabel}
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />
                </>
              ) : null}

            {selectedCadastro?.tipo === 'paciente' ? (
              <>
                <Text style={styles.modalLabel}>Telefone</Text>
                <TextInput
                  value={editForm.telefone}
                  onChangeText={(value) =>
                      setEditForm((current) => ({ ...current, telefone: value }))
                    }
                    placeholder="Telefone com DDD"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Data de nascimento</Text>
                  <TextInput
                    value={editForm.dataNascimento}
                    onChangeText={(value) =>
                      setEditForm((current) => ({
                        ...current,
                        dataNascimento: formatarData(value),
                      }))
                    }
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Sexo biologico</Text>
                  <TextInput
                    value={editForm.sexo}
                    onChangeText={(value) =>
                      setEditForm((current) => ({ ...current, sexo: value }))
                    }
                    placeholder="Sexo biologico"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>CEP</Text>
                  <TextInput
                    value={editForm.cep}
                    onChangeText={(value) =>
                      setEditForm((current) => ({ ...current, cep: formatarCep(value) }))
                    }
                    placeholder="00000-000"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Logradouro</Text>
                  <TextInput
                    value={editForm.logradouro}
                    onChangeText={(value) =>
                      setEditForm((current) => ({ ...current, logradouro: value }))
                    }
                    placeholder="Logradouro"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Numero</Text>
                  <TextInput
                    value={editForm.numero}
                    onChangeText={(value) =>
                      setEditForm((current) => ({ ...current, numero: value }))
                    }
                    placeholder="Numero"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Bairro</Text>
                  <TextInput
                    value={editForm.bairro}
                    onChangeText={(value) =>
                      setEditForm((current) => ({ ...current, bairro: value }))
                    }
                    placeholder="Bairro"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>Cidade</Text>
                  <TextInput
                    value={editForm.cidade}
                    onChangeText={(value) =>
                      setEditForm((current) => ({ ...current, cidade: value }))
                    }
                    placeholder="Cidade"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />

                  <Text style={styles.modalLabel}>UF</Text>
                  <TextInput
                    value={editForm.uf}
                    onChangeText={(value) =>
                      setEditForm((current) => ({
                        ...current,
                        uf: String(value || '').toUpperCase().slice(0, 2),
                      }))
                    }
                    placeholder="UF"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />
                </>
              ) : null}

              {selectedCadastro?.tipo === 'nutricionista' ? (
                <>
                  <Text style={styles.modalLabel}>Data de nascimento</Text>
                  <TextInput
                    value={editForm.dataNascimento}
                    onChangeText={(value) =>
                      setEditForm((current) => ({
                        ...current,
                        dataNascimento: formatarData(value),
                      }))
                    }
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />
                </>
              ) : null}

              {selectedCadastro?.tipo === 'nutricionista' || selectedCadastro?.tipo === 'admin' || selectedCadastro?.tipo === 'medico' ? (
                <>
                  <Text style={styles.modalLabel}>Nova senha</Text>
                  <TextInput
                    value={editForm.senha}
                    onChangeText={(value) =>
                      setEditForm((current) => ({ ...current, senha: value }))
                    }
                    secureTextEntry
                    placeholder="Preencha apenas se quiser trocar"
                    placeholderTextColor={adminTheme.colors.textMuted}
                    style={styles.modalInput}
                  />
                </>
              ) : null}

              {formError ? <Text style={styles.modalError}>{formError}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalGhostButton} onPress={fecharModalEdicao}>
                  <Text style={styles.modalGhostButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalPrimaryButton, savingCadastro && styles.modalPrimaryButtonDisabled]}
                  onPress={salvarCadastroEditado}
                  disabled={savingCadastro}
                >
                  {savingCadastro ? (
                    <ActivityIndicator color={adminTheme.colors.onPrimary} />
                  ) : (
                    <Text style={styles.modalPrimaryButtonText}>Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </RolagemModalTeclado>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharModalExclusao}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmar exclusao</Text>
            <Text style={styles.modalSubtitle}>
              Deseja apagar o cadastro de {selectedCadastro?.nome || 'este usuario'}?
            </Text>
            <Text style={styles.modalWarning}>
              Essa acao atualiza o banco de dados e pede confirmacao antes de concluir.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalGhostButton} onPress={fecharModalExclusao}>
                <Text style={styles.modalGhostButtonText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDangerButton}
                onPress={confirmarExclusaoCadastro}
                disabled={deletingCadastroId === selectedCadastro?.id}
              >
                {deletingCadastroId === selectedCadastro?.id ? (
                  <ActivityIndicator color={adminTheme.colors.onPrimary} />
                ) : (
                  <Text style={styles.modalPrimaryButtonText}>Apagar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.scroll}>
        <View style={styles.scrollContent}>
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

            {loadError ? <Text style={styles.loadError}>{loadError}</Text> : null}

            <View style={styles.filters}>
              {cadastroFilterOptions.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.filter, tipo === item.value && styles.filterActive]}
                  onPress={() => setTipo(item.value)}
                >
                  <Text style={[styles.filterText, tipo === item.value && styles.filterTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.searchBox}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => setQuery((current) => current)}
                placeholder="Buscar por nome, email, CPF ou CRM"
                placeholderTextColor={adminTheme.colors.textMuted}
                style={styles.searchInput}
              />
              <TouchableOpacity
                style={styles.searchAction}
                onPress={() => setQuery((current) => current)}
                accessibilityLabel="Confirmar pesquisa"
              >
                <Ionicons name="search-outline" size={18} color={adminTheme.colors.onPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.panel}>
              <View style={styles.panelTopRow}>
                <View style={styles.panelTopSpacer} />
                {registros.length ? (
                  <Text style={styles.resultHint}>
                    Mostrando {visibleRegistros.length} de {registros.length} cadastros
                  </Text>
                ) : (
                  <View />
                )}
                <TouchableOpacity style={styles.addButton} onPress={abrirModalCriacao}>
                  <Ionicons name="person-add-outline" size={16} color={adminTheme.colors.primary} />
                  <Text style={styles.addButtonText}>Cadastrar novo usuario</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.resultsCard}>
                <ScrollView
                  style={styles.resultsScroll}
                  contentContainerStyle={styles.resultsScrollContent}
                  onLayout={handleResultadosLayout}
                  onScroll={handleResultadosScroll}
                  onScrollEndDrag={handleResultadosScroll}
                  onMomentumScrollEnd={handleResultadosScroll}
                  onContentSizeChange={handleResultadosContentSizeChange}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
                >
                  {registros.length ? visibleRegistros.map((item) => (
                    <CadastroRow
                      key={`${item.tipo}-${item.id}`}
                      item={item}
                      onEdit={abrirModalEdicao}
                      onDelete={abrirModalExclusao}
                      actionLoadingId={deletingCadastroId}
                    />
                  )) : (
                    <Text style={styles.emptyText}>Nenhum cadastro encontrado.</Text>
                  )}
                  {loadingMore ? (
                    <View style={styles.loadingMoreWrap}>
                      <ActivityIndicator color={adminTheme.colors.primary} />
                      <Text style={styles.loadingText}>Carregando mais cadastros...</Text>
                    </View>
                  ) : null}
                </ScrollView>
              </View>
            </View>
          </>
        )}
        </View>
      </View>

      <BarraAbasAdmin navigation={navigation} rotaAtual="AdminCadastros" usuarioLogado={adminUser} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: adminTheme.colors.background },
  containerWeb: {
    bottom: 0,
    height: '100dvh',
    left: 0,
    maxHeight: '100dvh',
    minHeight: '100%',
    overflow: 'hidden',
    position: 'fixed',
    right: 0,
    top: 0,
    width: '100vw',
  },
  scroll: { flex: 1, minHeight: 0, overflow: 'hidden' },
  scrollContent: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: adminTheme.spacing.screen,
    paddingTop: CADASTROS_TOP_OFFSET,
    paddingBottom: ADMIN_TAB_BAR_HEIGHT + ADMIN_TAB_BAR_SPACE + 30,
  },
  loadingCard: { alignItems: 'center', gap: 10, marginTop: 22 },
  loadingText: { color: adminTheme.colors.textMuted, fontWeight: '800' },
  loadError: {
    color: adminTheme.colors.danger,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  metricCard: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.panelStrong,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: 'center',
    minWidth: 140,
    minHeight: 110,
    paddingHorizontal: 16,
    paddingVertical: 18,
    ...adminShadow,
  },
  metricValue: { color: adminTheme.colors.text, fontSize: 32, fontWeight: '500', textAlign: 'center' },
  metricLabel: { color: adminTheme.colors.text, fontSize: 15, fontWeight: '500', marginTop: 8, textAlign: 'center' },
  panel: {
    backgroundColor: adminTheme.colors.panel,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    flex: 1,
    marginTop: 20,
    minHeight: 0,
    padding: 16,
    ...adminShadow,
  },
  panelTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelTopSpacer: {
    minWidth: 1,
  },
  searchBox: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    position: 'relative',
  },
  searchInput: {
    color: adminTheme.colors.text,
    fontSize: 14,
    paddingRight: 46,
    width: '100%',
    ...(Platform.OS === 'web'
      ? {
          outlineColor: 'transparent',
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none',
        }
      : null),
  },
  searchAction: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 6,
    width: 36,
  },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  filter: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: 14,
  },
  filterActive: { backgroundColor: adminTheme.colors.primary, borderColor: adminTheme.colors.primary },
  filterText: { color: adminTheme.colors.text, fontSize: 11, fontWeight: '900' },
  filterTextActive: { color: adminTheme.colors.onPrimary },
  resultsCard: {
    marginTop: 10,
    borderRadius: adminTheme.radius.xl,
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  resultsScroll: {
    flex: 1,
    minHeight: 0,
  },
  resultsScrollContent: {
    flexGrow: 1,
    paddingBottom: 6,
  },
  row: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  rowTitleLine: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 24 },
  rowTitle: { color: adminTheme.colors.text, flex: 1, fontSize: 14, fontWeight: '900', lineHeight: 18 },
  rowMeta: { color: adminTheme.colors.textMuted, fontSize: 12, fontWeight: '700', lineHeight: 16, marginTop: 0 },
  rowInlineActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginLeft: 10,
    marginTop: 6,
    minHeight: 24,
  },
  rowInlineButton: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  statusMinimal: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: 2,
  },
  statusMinimalActive: {
    color: adminTheme.colors.success,
  },
  statusMinimalInactive: {
    color: adminTheme.colors.danger,
  },
  emptyText: { color: adminTheme.colors.textMuted, fontSize: 13, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  loadingMoreWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  resultHint: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.onPrimary,
    borderColor: adminTheme.colors.primary,
    borderWidth: 1,
    borderRadius: adminTheme.radius.pill,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
  },
  addButtonText: {
    color: adminTheme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 8, 7, 0.78)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: adminTheme.colors.panelStrong,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.xl,
    borderWidth: 1,
    maxHeight: '86%',
    maxWidth: 720,
    padding: 18,
    width: '100%',
    ...adminShadow,
  },
  modalScroll: {
    maxHeight: '100%',
  },
  modalScrollContent: {
    paddingBottom: 6,
  },
  modalTitle: {
    color: adminTheme.colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  modalHeaderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  modalHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  modalSubtitle: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 6,
  },
  modalStatusWrap: {
    alignItems: 'flex-end',
    minWidth: 170,
  },
  modalStatusLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalStatusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalStatusChip: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 78,
    paddingHorizontal: 12,
  },
  modalLabel: {
    color: adminTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 16,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.lg,
    borderWidth: 1,
    color: adminTheme.colors.text,
    fontSize: 14,
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    ...(Platform.OS === 'web'
      ? {
          outlineColor: 'transparent',
          outlineStyle: 'none',
          outlineWidth: 0,
          boxShadow: 'none',
        }
      : null),
  },
  modalError: {
    color: adminTheme.colors.danger,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 14,
  },
  modalWarning: {
    color: adminTheme.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 22,
  },
  modalGhostButton: {
    alignItems: 'center',
    borderColor: adminTheme.colors.panelBorder,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 120,
    paddingHorizontal: 18,
  },
  modalGhostButtonText: {
    color: adminTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  modalPrimaryButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 120,
    paddingHorizontal: 18,
  },
  modalPrimaryButtonDisabled: {
    opacity: 0.7,
  },
  modalDangerButton: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.danger,
    borderRadius: adminTheme.radius.pill,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 120,
    paddingHorizontal: 18,
  },
  modalPrimaryButtonText: {
    color: adminTheme.colors.onPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  modalTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  modalTypeChip: {
    alignItems: 'center',
    backgroundColor: adminTheme.colors.background,
    borderColor: adminTheme.colors.primary,
    borderRadius: adminTheme.radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  modalTypeChipActive: {
    backgroundColor: adminTheme.colors.primary,
  },
  modalTypeChipText: {
    color: adminTheme.colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  modalTypeChipTextActive: {
    color: adminTheme.colors.onPrimary,
  },
  accessText: { color: adminTheme.colors.text, margin: 20 },
});
