import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../servicos/configSupabase';
import { registrarLogAuditoria } from '../../servicos/servicoAuditoria';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import BarraAbasNutricionista, {
  NUTRI_TAB_BAR_HEIGHT,
  NUTRI_TAB_BAR_SPACE,
} from '../../componentes/nutricionista/BarraAbasNutricionista';
import {
  buildPatientClinicalRows,
  buildPatientDataRows,
} from '../../utilitarios/camposPerfilPaciente';

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

function ProfileInfoRow({ label, value }) {
  return (
    <View style={styles.profileInfoRow}>
      <Text style={styles.profileInfoLabel}>{label}</Text>
      <Text style={styles.profileInfoValue}>{value}</Text>
    </View>
  );
}

function getInitials(name) {
  return (name || 'Paciente')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() || '')
    .join('');
}

export default function GerenciarPacientesStyled({ navigation, route }) {
  const { usuarioLogado } = route.params || {};

  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [loadingExcluirId, setLoadingExcluirId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalExclusaoVisible, setModalExclusaoVisible] = useState(false);
  const [modalPerfilVisible, setModalPerfilVisible] = useState(false);
  const [pacienteParaExcluir, setPacienteParaExcluir] = useState(null);
  const [pacientePerfil, setPacientePerfil] = useState(null);
  const [perfilVisao, setPerfilVisao] = useState('patient');
  const [feedbackEdicao, setFeedbackEdicao] = useState(null);

  const [editandoId, setEditandoId] = useState(null);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [genero, setGenero] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');

  const opcoesGenero = ['Masculino', 'Feminino', 'Diverso'];

  const getPacienteId = (paciente) => paciente?.id_paciente_uuid || null;

  const formatarCpf = (valor) => {
    const numeros = valor.replace(/\D/g, '').slice(0, 11);
    return numeros
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  };

  const formatarCep = (valor) => {
    const numeros = valor.replace(/\D/g, '').slice(0, 8);
    return numeros.replace(/^(\d{5})(\d)/, '$1-$2');
  };

  const formatarDataNascimento = (valor) => {
    const numeros = String(valor || '').replace(/\D/g, '').slice(0, 8);
    return numeros
      .replace(/^(\d{2})(\d)/, '$1/$2')
      .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
  };

  const formatarDataNascimentoBanco = (valor) => {
    if (!valor) return '';

    const dataSomente = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dataSomente) {
      const [, ano, mes, dia] = dataSomente;
      return `${dia}/${mes}/${ano}`;
    }

    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';

    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const converterDataNascimentoParaBanco = (valor) => {
    const numeros = String(valor || '').replace(/\D/g, '');

    if (!numeros) return null;
    if (numeros.length !== 8) return '';

    const dia = Number(numeros.slice(0, 2));
    const mes = Number(numeros.slice(2, 4));
    const ano = Number(numeros.slice(4, 8));
    const data = new Date(ano, mes - 1, dia);

    if (
      data.getFullYear() !== ano ||
      data.getMonth() !== mes - 1 ||
      data.getDate() !== dia
    ) {
      return '';
    }

    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  };

  const exibirCpf = (valor) => {
    const cpfLimpo = String(valor || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return valor || 'Nao informado';
    return cpfLimpo
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  };

  const validarEmail = (valor) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(valor.trim().toLowerCase());
  };

  const validarCep = (valor) => valor.replace(/\D/g, '').length === 8;

  const validarCpf = (valor) => {
    const cpfLimpo = valor.replace(/\D/g, '');

    if (cpfLimpo.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpfLimpo)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i += 1) {
      soma += Number(cpfLimpo.charAt(i)) * (10 - i);
    }

    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== Number(cpfLimpo.charAt(9))) return false;

    soma = 0;
    for (let i = 0; i < 10; i += 1) {
      soma += Number(cpfLimpo.charAt(i)) * (11 - i);
    }

    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;

    return resto === Number(cpfLimpo.charAt(10));
  };

  const limparFormulario = () => {
    setEditandoId(null);
    setNome('');
    setCpf('');
    setGenero('');
    setEmail('');
    setTelefone('');
    setDataNascimento('');
    setCep('');
    setLogradouro('');
    setNumero('');
    setBairro('');
    setCidade('');
    setUf('');
    setFeedbackEdicao(null);
  };

  const fecharModal = () => {
    setModalVisible(false);
    limparFormulario();
  };

  const carregarPacientes = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('paciente')
        .select('*')
        .or('excluido.is.null,excluido.eq.false')
        .order('nome_completo', { ascending: true });

      if (error) throw error;

      setPacientes(data || []);
    } catch (error) {
      console.log('Erro ao carregar pacientes:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar os pacientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarPacientes();

    const unsubscribe = navigation.addListener('focus', () => {
      carregarPacientes();
    });

    return unsubscribe;
  }, [navigation, carregarPacientes]);

  const abrirModalEdicao = (paciente) => {
    setFeedbackEdicao(null);
    setEditandoId(getPacienteId(paciente));
    setNome(paciente.nome_completo || '');
    setCpf(formatarCpf(String(paciente.cpf_paciente || '')));
    setGenero(paciente.sexo_biologico || '');
    setEmail(paciente.email_pac || '');
    setTelefone(paciente.telefone || '');
    setDataNascimento(formatarDataNascimentoBanco(paciente.data_nascimento));
    setCep(formatarCep(String(paciente.cep || '')));
    setLogradouro(paciente.logradouro || '');
    setNumero(paciente.numero || '');
    setBairro(paciente.bairro || '');
    setCidade(paciente.cidade || '');
    setUf((paciente.uf || '').toUpperCase());
    setModalVisible(true);
  };

  const buscarEnderecoPorCep = async () => {
    const cepLimpo = cep.replace(/\D/g, '');

    if (cepLimpo.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (data.erro) {
        Alert.alert('CEP invalido', 'Nao encontramos esse CEP.');
        return;
      }

      setLogradouro(data.logradouro || '');
      setBairro(data.bairro || '');
      setCidade(data.localidade || '');
      setUf((data.uf || '').toUpperCase());
    } catch (error) {
      console.log('Erro ao buscar CEP:', error);
    }
  };

  const verificarDuplicidadeEdicao = async (idAtual, cpfLimpo, emailLimpo) => {
    const { data, error } = await supabase
      .from('paciente')
      .select('id_paciente_uuid, cpf_paciente, email_pac')
      .or(`cpf_paciente.eq.${cpfLimpo},email_pac.eq.${emailLimpo}`);

    if (error) throw error;

    const conflitos = (data || []).filter((item) => item.id_paciente_uuid !== idAtual);

    if (conflitos.length > 0) {
      if (conflitos.some((item) => item.cpf_paciente === cpfLimpo)) {
        throw new Error('Ja existe outro paciente cadastrado com esse CPF.');
      }

      if (conflitos.some((item) => item.email_pac === emailLimpo)) {
        throw new Error('Ja existe outro paciente cadastrado com esse e-mail.');
      }
    }
  };

  const salvarEdicao = async () => {
    const nomeLimpo = nome.trim();
    const cpfLimpo = cpf.replace(/\D/g, '');
    const emailLimpo = email.trim().toLowerCase();
    const telefoneLimpo = telefone.trim();
    const dataNascimentoBanco = converterDataNascimentoParaBanco(dataNascimento);
    const cepLimpo = cep.replace(/\D/g, '');
    const generoLimpo = genero.trim();
    const ufLimpo = uf.trim().toUpperCase();

    if (!editandoId) {
      const mensagem = 'Paciente sem identificador para atualizar.';
      setFeedbackEdicao({ tipo: 'erro', texto: mensagem });
      Alert.alert('Erro', mensagem);
      return;
    }

    if (!nomeLimpo || !cpfLimpo || !emailLimpo) {
      const mensagem = 'Preencha nome, CPF e e-mail para salvar as alteracoes.';
      setFeedbackEdicao({ tipo: 'erro', texto: mensagem });
      Alert.alert('Atencao', mensagem);
      return;
    }

    if (!validarCpf(cpfLimpo)) {
      const mensagem = 'Digite um CPF valido.';
      setFeedbackEdicao({ tipo: 'erro', texto: mensagem });
      Alert.alert('CPF invalido', mensagem);
      return;
    }

    if (!validarEmail(emailLimpo)) {
      const mensagem = 'Digite um e-mail valido.';
      setFeedbackEdicao({ tipo: 'erro', texto: mensagem });
      Alert.alert('E-mail invalido', mensagem);
      return;
    }

    if (dataNascimento.trim() && !dataNascimentoBanco) {
      const mensagem = 'Digite uma data de nascimento valida no formato DD/MM/AAAA.';
      setFeedbackEdicao({ tipo: 'erro', texto: mensagem });
      Alert.alert('Data invalida', mensagem);
      return;
    }

    if (cepLimpo && !validarCep(cepLimpo)) {
      const mensagem = 'Digite um CEP valido com 8 numeros.';
      setFeedbackEdicao({ tipo: 'erro', texto: mensagem });
      Alert.alert('CEP invalido', mensagem);
      return;
    }

    try {
      setLoadingSalvar(true);
      setFeedbackEdicao(null);

      await verificarDuplicidadeEdicao(editandoId, cpfLimpo, emailLimpo);

      const { data, error } = await supabase
        .from('paciente')
        .update({
          nome_completo: nomeLimpo,
          cpf_paciente: cpfLimpo,
          sexo_biologico: generoLimpo || null,
          email_pac: emailLimpo,
          telefone: telefoneLimpo || null,
          data_nascimento: dataNascimentoBanco || null,
          cep: cepLimpo || null,
          logradouro: logradouro.trim() || null,
          numero: numero.trim() || null,
          bairro: bairro.trim() || null,
          cidade: cidade.trim() || null,
          uf: ufLimpo || null,
        })
        .eq('id_paciente_uuid', editandoId)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!data?.id_paciente_uuid) {
        throw new Error('O banco nao confirmou a atualizacao do paciente.');
      }

      await registrarLogAuditoria({
        actor: usuarioLogado,
        actorType: 'nutricionista',
        targetPatientId: data.id_paciente_uuid,
        action: 'paciente_atualizado_por_nutricionista',
        entity: 'paciente',
        entityId: data.id_paciente_uuid,
        origin: 'gestao_pacientes',
        details: {
          camposAtualizados: [
            'nome_completo',
            'cpf_paciente',
            'sexo_biologico',
            'email_pac',
            'telefone',
            'data_nascimento',
            'cep',
            'logradouro',
            'numero',
            'bairro',
            'cidade',
            'uf',
          ],
        },
      });

      setPacientes((atual) =>
        atual.map((item) =>
          getPacienteId(item) === data.id_paciente_uuid ? data : item
        )
      );

      setFeedbackEdicao({ tipo: 'sucesso', texto: 'Paciente atualizado com sucesso.' });
      Alert.alert('Sucesso', 'Paciente atualizado com sucesso.');
      fecharModal();
      await carregarPacientes();
    } catch (error) {
      console.log('Erro ao atualizar paciente:', error);
      setFeedbackEdicao({
        tipo: 'erro',
        texto: error.message || 'Nao foi possivel atualizar o paciente.',
      });
      Alert.alert('Erro', error.message || 'Nao foi possivel atualizar o paciente.');
    } finally {
      setLoadingSalvar(false);
    }
  };

  const excluirLogicamente = async (paciente) => {
    const pacienteId = getPacienteId(paciente);

    try {
      if (!pacienteId) {
        throw new Error('Paciente sem identificador para exclusao.');
      }

      setLoadingExcluirId(pacienteId);

      const { data, error } = await supabase
        .from('paciente')
        .update({
          excluido: true,
          data_exclusao: new Date().toISOString(),
        })
        .eq('id_paciente_uuid', pacienteId)
        .select('id_paciente_uuid, excluido, data_exclusao')
        .maybeSingle();

      if (error) throw error;
      if (!data?.id_paciente_uuid || data.excluido !== true) {
        throw new Error('O banco nao confirmou a exclusao logica do paciente.');
      }

      await registrarLogAuditoria({
        actor: usuarioLogado,
        actorType: 'nutricionista',
        targetPatientId: data.id_paciente_uuid,
        action: 'paciente_excluido_logicamente',
        entity: 'paciente',
        entityId: data.id_paciente_uuid,
        origin: 'gestao_pacientes',
        details: {
          dataExclusao: data.data_exclusao,
        },
      });

      setPacientes((atual) => atual.filter((item) => getPacienteId(item) !== pacienteId));
      setModalExclusaoVisible(false);
      setPacienteParaExcluir(null);

      Alert.alert('Sucesso', 'Paciente excluido logicamente com sucesso.');
      carregarPacientes();
    } catch (error) {
      console.log('Erro ao excluir paciente:', error);
      Alert.alert('Erro', 'Nao foi possivel excluir o paciente.');
    } finally {
      setLoadingExcluirId(null);
    }
  };

  const confirmarExclusao = (paciente) => {
    setPacienteParaExcluir(paciente);
    setModalExclusaoVisible(true);
  };

  const abrirModalPerfil = (paciente) => {
    setPacientePerfil(paciente);
    setPerfilVisao('patient');
    setModalPerfilVisible(true);
  };

  const fecharModalPerfil = () => {
    setModalPerfilVisible(false);
    setPacientePerfil(null);
    setPerfilVisao('patient');
  };

  const nomeNutri =
    usuarioLogado?.nome_completo_nutri ||
    usuarioLogado?.nome_nutri ||
    'Nutricionista';

  const totalPacientes = pacientes.length;
  const totalCidades = new Set(
    pacientes
      .map((item) => `${item.cidade || ''}-${item.uf || ''}`)
      .filter((item) => item !== '-')
  ).size;
  const totalCadastrosCompletos = pacientes.filter(
    (item) => item.logradouro && item.numero && item.bairro && item.cidade && item.uf
  ).length;
  const perfilRows =
    perfilVisao === 'patient'
      ? buildPatientDataRows(pacientePerfil || {})
      : buildPatientClinicalRows(pacientePerfil || {});

  return (
    <SafeAreaView style={[styles.container, Platform.OS === 'web' && styles.containerWeb]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={patientTheme.colors.background}
      />

      <ScrollView
        style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
        contentContainerStyle={[
          styles.content,
          Platform.OS === 'web' && styles.webContent,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.headerRow}>
          <View style={styles.headerIconGroup}>
            <TouchableOpacity style={styles.headerIconButton} onPress={carregarPacientes}>
              <Ionicons
                name="refresh-outline"
                size={20}
                color={patientTheme.colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.greeting}>Gerenciar pacientes</Text>
        <Text style={styles.headerSubtitle}>
          Carteira ativa de {nomeNutri}. Edite cadastros, revise dados e arquive
          pacientes com a mesma linguagem visual da experiencia do paciente.
        </Text>

        <SectionCard style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Carteira ativa</Text>
              <Text style={styles.heroValue}>{totalPacientes} pacientes</Text>
            </View>

            <View style={styles.heroBadge}>
              <Ionicons
                name="people-outline"
                size={18}
                color={patientTheme.colors.primaryDark}
              />
              <Text style={styles.heroBadgeText}>Gestao clinica</Text>
            </View>
          </View>

          <Text style={styles.heroHelper}>
            CRN/UF: {usuarioLogado?.crm_numero || 'Nao informado'}
          </Text>
          <Text style={styles.heroHelper}>
            Cadastros com endereco completo: {totalCadastrosCompletos}
          </Text>

          <View style={styles.metricRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Ativos</Text>
              <Text style={styles.metricValue}>{totalPacientes}</Text>
            </View>

            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Cidades</Text>
              <Text style={styles.metricValue}>{totalCidades}</Text>
            </View>
          </View>
        </SectionCard>

        <View style={styles.summaryRow}>
          <SectionCard style={styles.summaryCard}>
            <Ionicons
              name="clipboard-outline"
              size={18}
              color={patientTheme.colors.primaryDark}
            />
            <Text style={styles.summaryLabel}>Prontos para editar</Text>
            <Text style={styles.summaryValue}>{totalPacientes}</Text>
          </SectionCard>

          <SectionCard style={styles.summaryCard}>
            <Ionicons
              name="location-outline"
              size={18}
              color={patientTheme.colors.primaryDark}
            />
            <Text style={styles.summaryLabel}>Cidades atendidas</Text>
            <Text style={styles.summaryValue}>{totalCidades}</Text>
          </SectionCard>

          <SectionCard style={styles.summaryCard}>
            <Ionicons
              name="checkmark-done-outline"
              size={18}
              color={patientTheme.colors.primaryDark}
            />
            <Text style={styles.summaryLabel}>Cadastros completos</Text>
            <Text style={styles.summaryValue}>{totalCadastrosCompletos}</Text>
          </SectionCard>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pacientes ativos</Text>
          <Text style={styles.sectionHelper}>Atualize a lista sempre que precisar.</Text>
        </View>

        {loading ? (
          <SectionCard style={styles.loadingCard}>
            <ActivityIndicator size="large" color={patientTheme.colors.primaryDark} />
            <Text style={styles.loadingText}>Carregando pacientes...</Text>
          </SectionCard>
        ) : pacientes.length === 0 ? (
          <SectionCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum paciente cadastrado</Text>
            <Text style={styles.emptyText}>
              Cadastre um paciente na tela de cadastro para ele aparecer aqui.
            </Text>
          </SectionCard>
        ) : (
          pacientes.map((paciente) => (
            <SectionCard
              key={getPacienteId(paciente) || paciente.email_pac || paciente.cpf_paciente}
              style={styles.patientCard}
            >
              <View style={styles.patientHeader}>
                <View style={styles.patientAvatar}>
                  <Text style={styles.patientAvatarText}>
                    {getInitials(paciente.nome_completo)}
                  </Text>
                </View>

                <View style={styles.patientHeaderCopy}>
                  <Text style={styles.patientName}>
                    {paciente.nome_completo || 'Paciente sem nome'}
                  </Text>
                  <Text style={styles.patientMeta}>
                    {paciente.cidade || 'Cidade nao informada'}
                    {paciente.uf ? ` / ${paciente.uf}` : ''}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={patientTheme.colors.textMuted}
                />
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoPill}>
                  <Ionicons
                    name="card-outline"
                    size={16}
                    color={patientTheme.colors.primaryDark}
                  />
                  <Text style={styles.infoPillText}>
                    CPF: {exibirCpf(paciente.cpf_paciente)}
                  </Text>
                </View>

                <View style={styles.infoPill}>
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={patientTheme.colors.primaryDark}
                  />
                  <Text style={styles.infoPillText}>
                    Genero: {paciente.sexo_biologico || 'Nao informado'}
                  </Text>
                </View>
              </View>

              <Text style={styles.patientInfo}>
                E-mail: {paciente.email_pac || 'Nao informado'}
              </Text>

              <View style={styles.addressCard}>
                <Text style={styles.addressTitle}>Endereco</Text>
                <Text style={styles.addressText}>
                  {paciente.logradouro || 'Nao informado'}, {paciente.numero || 's/n'} -{' '}
                  {paciente.bairro || 'Sem bairro'}
                </Text>
                <Text style={styles.addressText}>
                  {paciente.cidade || 'Sem cidade'} / {paciente.uf || '--'} | CEP:{' '}
                  {formatarCep(String(paciente.cep || '')) || 'Nao informado'}
                </Text>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.profileButton}
                  onPress={() => abrirModalPerfil(paciente)}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={patientTheme.colors.primaryDark}
                  />
                  <Text style={styles.profileButtonText}>Perfil</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => abrirModalEdicao(paciente)}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={patientTheme.colors.text}
                  />
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => confirmarExclusao(paciente)}
                  disabled={loadingExcluirId === getPacienteId(paciente)}
                >
                  {loadingExcluirId === getPacienteId(paciente) ? (
                    <ActivityIndicator color={patientTheme.colors.onPrimary} />
                  ) : (
                    <>
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={patientTheme.colors.onPrimary}
                      />
                      <Text style={styles.deleteButtonText}>Excluir</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </SectionCard>
          ))
        )}
      </ScrollView>

      <Modal visible={modalPerfilVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.profileModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>Perfil completo</Text>
                <Text style={styles.modalSubtitle}>
                  {pacientePerfil?.nome_completo || 'Paciente'} com dados separados para análise.
                </Text>
              </View>

              <TouchableOpacity style={styles.closeButton} onPress={fecharModalPerfil}>
                <Ionicons name="close" size={20} color={patientTheme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.profileTabRow}>
              <TouchableOpacity
                style={[
                  styles.profileTabButton,
                  perfilVisao === 'patient' && styles.profileTabButtonActive,
                ]}
                onPress={() => setPerfilVisao('patient')}
              >
                <Text
                  style={[
                    styles.profileTabText,
                    perfilVisao === 'patient' && styles.profileTabTextActive,
                  ]}
                >
                  Dados do paciente
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.profileTabButton,
                  perfilVisao === 'clinical' && styles.profileTabButtonActive,
                ]}
                onPress={() => setPerfilVisao('clinical')}
              >
                <Text
                  style={[
                    styles.profileTabText,
                    perfilVisao === 'clinical' && styles.profileTabTextActive,
                  ]}
                >
                  Dados clínicos
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.profileModalScroll}
              contentContainerStyle={styles.profileModalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {perfilRows.map((row) => (
                <ProfileInfoRow
                  key={`${perfilVisao}-${row.label}`}
                  label={row.label}
                  value={row.value}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Editar paciente</Text>
                  <Text style={styles.modalSubtitle}>
                    Atualize os dados e confirme o cadastro.
                  </Text>
                </View>

                <TouchableOpacity style={styles.closeButton} onPress={fecharModal}>
                  <Ionicons name="close" size={20} color={patientTheme.colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Nome completo</Text>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome completo"
                placeholderTextColor={patientTheme.colors.textMuted}
              />

              <Text style={styles.label}>CPF</Text>
              <TextInput
                style={styles.input}
                value={cpf}
                onChangeText={(valor) => setCpf(formatarCpf(valor))}
                placeholder="000.000.000-00"
                placeholderTextColor={patientTheme.colors.textMuted}
                keyboardType="numeric"
                maxLength={14}
              />

              <Text style={styles.label}>Genero</Text>
              <View style={styles.genderRow}>
                {opcoesGenero.map((opcao) => {
                  const ativo = genero === opcao;

                  return (
                    <TouchableOpacity
                      key={opcao}
                      style={[styles.genderButton, ativo && styles.genderButtonActive]}
                      onPress={() => setGenero(opcao)}
                    >
                      <Text
                        style={[
                          styles.genderButtonText,
                          ativo && styles.genderButtonTextActive,
                        ]}
                      >
                        {opcao}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="email@exemplo.com"
                placeholderTextColor={patientTheme.colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.label}>Telefone</Text>
              <TextInput
                style={styles.input}
                value={telefone}
                onChangeText={setTelefone}
                placeholder="(00) 00000-0000"
                placeholderTextColor={patientTheme.colors.textMuted}
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Data de nascimento</Text>
              <TextInput
                style={styles.input}
                value={dataNascimento}
                onChangeText={(valor) => setDataNascimento(formatarDataNascimento(valor))}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={patientTheme.colors.textMuted}
                keyboardType="numeric"
                maxLength={10}
              />

              <Text style={styles.label}>CEP</Text>
              <TextInput
                style={styles.input}
                value={cep}
                onChangeText={(valor) => setCep(formatarCep(valor))}
                onBlur={buscarEnderecoPorCep}
                placeholder="00000-000"
                placeholderTextColor={patientTheme.colors.textMuted}
                keyboardType="numeric"
                maxLength={9}
              />

              <Text style={styles.label}>Logradouro</Text>
              <TextInput
                style={styles.input}
                value={logradouro}
                onChangeText={setLogradouro}
                placeholder="Rua, avenida..."
                placeholderTextColor={patientTheme.colors.textMuted}
              />

              <Text style={styles.label}>Numero</Text>
              <TextInput
                style={styles.input}
                value={numero}
                onChangeText={setNumero}
                placeholder="123"
                placeholderTextColor={patientTheme.colors.textMuted}
              />

              <Text style={styles.label}>Bairro</Text>
              <TextInput
                style={styles.input}
                value={bairro}
                onChangeText={setBairro}
                placeholder="Bairro"
                placeholderTextColor={patientTheme.colors.textMuted}
              />

              <View style={styles.formRow}>
                <View style={styles.cityContainer}>
                  <Text style={styles.label}>Cidade</Text>
                  <TextInput
                    style={styles.input}
                    value={cidade}
                    onChangeText={setCidade}
                    placeholder="Cidade"
                    placeholderTextColor={patientTheme.colors.textMuted}
                  />
                </View>

                <View style={styles.ufContainer}>
                  <Text style={styles.label}>UF</Text>
                  <TextInput
                    style={styles.input}
                    value={uf}
                    onChangeText={(valor) => setUf(valor.toUpperCase())}
                    placeholder="SP"
                    placeholderTextColor={patientTheme.colors.textMuted}
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>
              </View>

              {feedbackEdicao ? (
                <View
                  style={[
                    styles.feedbackBox,
                    feedbackEdicao.tipo === 'erro' && styles.feedbackBoxErro,
                  ]}
                >
                  <Text
                    style={[
                      styles.feedbackText,
                      feedbackEdicao.tipo === 'erro' && styles.feedbackTextErro,
                    ]}
                  >
                    {feedbackEdicao.texto}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={salvarEdicao}
                disabled={loadingSalvar}
              >
                {loadingSalvar ? (
                  <ActivityIndicator color={patientTheme.colors.onPrimary} />
                ) : (
                  <Text style={styles.saveButtonText}>Salvar alteracoes</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={fecharModal}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={modalExclusaoVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmTitle}>Excluir paciente</Text>
            <Text style={styles.confirmText}>
              Deseja excluir logicamente {pacienteParaExcluir?.nome_completo || 'este paciente'}?
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => {
                  if (loadingExcluirId) return;
                  setModalExclusaoVisible(false);
                  setPacienteParaExcluir(null);
                }}
              >
                <Text style={styles.confirmCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={() => excluirLogicamente(pacienteParaExcluir)}
                disabled={
                  !pacienteParaExcluir ||
                  loadingExcluirId === getPacienteId(pacienteParaExcluir)
                }
              >
                {loadingExcluirId === getPacienteId(pacienteParaExcluir) ? (
                  <ActivityIndicator color={patientTheme.colors.onPrimary} />
                ) : (
                  <Text style={styles.confirmDeleteText}>Excluir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BarraAbasNutricionista
        navigation={navigation}
        rotaAtual={route?.name || 'GerenciarPacientes'}
        usuarioLogado={usuarioLogado}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: patientTheme.colors.background,
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
    overflowY: 'visible',
    overflowX: 'hidden',
  },
  content: {
    flexGrow: 1,
    padding: patientTheme.spacing.screen,
    paddingBottom: NUTRI_TAB_BAR_HEIGHT + 32 + NUTRI_TAB_BAR_SPACE,
  },
  webContent: {
    flexGrow: 0,
    minHeight: '100%',
  },
  sectionCard: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  headerRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  headerIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: patientTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  greeting: {
    marginTop: 22,
    fontSize: 30,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: patientTheme.colors.textMuted,
  },
  heroCard: {
    marginTop: 22,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroCopy: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    fontSize: 13,
    color: patientTheme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  heroValue: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  heroBadgeText: {
    marginLeft: 6,
    fontSize: 13,
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
  },
  heroHelper: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  metricRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
  },
  metricPill: {
    flex: 1,
    borderRadius: patientTheme.radius.lg,
    padding: 14,
    backgroundColor: patientTheme.colors.backgroundSoft,
    ...patientShadow,
  },
  metricLabel: {
    fontSize: 12,
    color: patientTheme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metricValue: {
    marginTop: 8,
    fontSize: 22,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  summaryRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    minHeight: 118,
  },
  summaryLabel: {
    marginTop: 10,
    fontSize: 13,
    color: patientTheme.colors.textMuted,
  },
  summaryValue: {
    marginTop: 8,
    fontSize: 18,
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  sectionHelper: {
    marginTop: 6,
    fontSize: 13,
    color: patientTheme.colors.textMuted,
  },
  loadingCard: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  loadingText: {
    marginTop: 12,
    color: patientTheme.colors.textMuted,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: patientTheme.colors.textMuted,
    textAlign: 'center',
  },
  patientCard: {
    marginBottom: 12,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  patientAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: patientTheme.colors.primaryDark,
  },
  patientHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  patientMeta: {
    marginTop: 4,
    fontSize: 13,
    color: patientTheme.colors.textMuted,
  },
  infoGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primarySoft,
  },
  infoPillText: {
    marginLeft: 8,
    fontSize: 13,
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
  patientInfo: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    color: patientTheme.colors.textMuted,
  },
  addressCard: {
    marginTop: 14,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.backgroundSoft,
    padding: 14,
    ...patientShadow,
  },
  addressTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: patientTheme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  addressText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: patientTheme.colors.text,
  },
  actionsRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  profileButton: {
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
  profileButtonText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '700',
  },
  editButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...patientShadow,
  },
  editButtonText: {
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  deleteButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: patientTheme.colors.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    maxHeight: '90%',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  modalHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  modalSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: patientTheme.colors.textMuted,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: patientTheme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  profileModalContent: {
    maxHeight: '90%',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    ...patientShadow,
  },
  profileTabRow: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderRadius: patientTheme.radius.lg,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    padding: 6,
    ...patientShadow,
  },
  profileTabButton: {
    alignItems: 'center',
    borderRadius: patientTheme.radius.lg,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 10,
  },
  profileTabButtonActive: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  profileTabText: {
    color: patientTheme.colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileTabTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  profileModalScroll: {
    maxHeight: 520,
  },
  profileModalScrollContent: {
    gap: 10,
    paddingBottom: 4,
  },
  profileInfoRow: {
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderRadius: patientTheme.radius.lg,
    padding: 14,
    ...patientShadow,
  },
  profileInfoLabel: {
    color: patientTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  profileInfoValue: {
    color: patientTheme.colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 6,
  },
  label: {
    marginBottom: 6,
    fontSize: 14,
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
  input: {
    borderRadius: patientTheme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    color: patientTheme.colors.text,
    backgroundColor: patientTheme.colors.backgroundSoft,
    ...patientShadow,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  genderButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.backgroundSoft,
    ...patientShadow,
  },
  genderButtonActive: {
    backgroundColor: patientTheme.colors.primaryDark,
  },
  genderButtonText: {
    color: patientTheme.colors.text,
    fontWeight: '600',
  },
  genderButtonTextActive: {
    color: patientTheme.colors.onPrimary,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cityContainer: {
    flex: 1,
  },
  ufContainer: {
    width: 84,
  },
  feedbackBox: {
    marginTop: 4,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#e9fbf3',
    borderWidth: 1,
    borderColor: '#4fdfa3',
  },
  feedbackBoxErro: {
    backgroundColor: '#fff1f0',
    borderColor: '#e57373',
  },
  feedbackText: {
    color: '#256f51',
    lineHeight: 20,
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackTextErro: {
    color: '#b23a48',
  },
  saveButton: {
    marginTop: 10,
    minHeight: 52,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  cancelButton: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  cancelButtonText: {
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  confirmModalContent: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: 22,
    ...patientShadow,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: patientTheme.colors.text,
  },
  confirmText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: patientTheme.colors.textMuted,
  },
  confirmActions: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 10,
  },
  confirmCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...patientShadow,
  },
  confirmCancelText: {
    color: patientTheme.colors.text,
    fontWeight: '700',
  },
  confirmDeleteButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '700',
  },
});
