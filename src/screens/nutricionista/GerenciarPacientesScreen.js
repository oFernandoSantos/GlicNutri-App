import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabaseConfig';
import { patientTheme, patientShadow } from '../../theme/patientTheme';

function SectionCard({ children, style }) {
  return <View style={[styles.sectionCard, style]}>{children}</View>;
}

function getInitials(name) {
  return (name || 'Paciente')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() || '')
    .join('');
}

export default function GerenciarPacientesScreen({ navigation, route }) {
  const { usuarioLogado } = route.params || {};

  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSalvar, setLoadingSalvar] = useState(false);
  const [loadingExcluirId, setLoadingExcluirId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalExclusaoVisible, setModalExclusaoVisible] = useState(false);
  const [pacienteParaExcluir, setPacienteParaExcluir] = useState(null);

  const [editandoId, setEditandoId] = useState(null);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [genero, setGenero] = useState('');
  const [email, setEmail] = useState('');
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

  const exibirCpf = (valor) => {
    const cpfLimpo = String(valor || '').replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return valor || 'Não informado';
    return cpfLimpo
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  };

  const validarEmail = (valor) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(valor.trim().toLowerCase());
  };

  const validarCep = (valor) => {
    const cepLimpo = valor.replace(/\D/g, '');
    return cepLimpo.length === 8;
  };

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
    setCep('');
    setLogradouro('');
    setNumero('');
    setBairro('');
    setCidade('');
    setUf('');
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
      Alert.alert('Erro', 'Não foi possível carregar os pacientes.');
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
    setEditandoId(getPacienteId(paciente));
    setNome(paciente.nome_completo || '');
    setCpf(formatarCpf(String(paciente.cpf_paciente || '')));
    setGenero(paciente.sexo_biologico || '');
    setEmail(paciente.email_pac || '');
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
        Alert.alert('CEP inválido', 'Não encontramos esse CEP.');
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

    const conflitos = (data || []).filter(
      (item) => item.id_paciente_uuid !== idAtual
    );

    if (conflitos.length > 0) {
      const cpfExistente = conflitos.some((item) => item.cpf_paciente === cpfLimpo);
      const emailExistente = conflitos.some((item) => item.email_pac === emailLimpo);

      if (cpfExistente) {
        throw new Error('Já existe outro paciente cadastrado com esse CPF.');
      }

      if (emailExistente) {
        throw new Error('Já existe outro paciente cadastrado com esse e-mail.');
      }
    }
  };

  const salvarEdicao = async () => {
    const nomeLimpo = nome.trim();
    const cpfLimpo = cpf.replace(/\D/g, '');
    const emailLimpo = email.trim().toLowerCase();
    const cepLimpo = cep.replace(/\D/g, '');
    const generoLimpo = genero.trim();
    const ufLimpo = uf.trim().toUpperCase();

    if (
      !nomeLimpo ||
      !cpfLimpo ||
      !generoLimpo ||
      !emailLimpo ||
      !cepLimpo ||
      !logradouro.trim() ||
      !numero.trim() ||
      !bairro.trim() ||
      !cidade.trim() ||
      !ufLimpo
    ) {
      Alert.alert('Atenção', 'Preencha todos os campos do paciente.');
      return;
    }

    if (!validarCpf(cpfLimpo)) {
      Alert.alert('CPF inválido', 'Digite um CPF válido.');
      return;
    }

    if (!validarEmail(emailLimpo)) {
      Alert.alert('E-mail inválido', 'Digite um e-mail válido.');
      return;
    }

    if (!validarCep(cepLimpo)) {
      Alert.alert('CEP inválido', 'Digite um CEP válido com 8 números.');
      return;
    }

    try {
      setLoadingSalvar(true);

      await verificarDuplicidadeEdicao(editandoId, cpfLimpo, emailLimpo);

      const payload = {
        nome_completo: nomeLimpo,
        cpf_paciente: cpfLimpo,
        sexo_biologico: generoLimpo,
        email_pac: emailLimpo,
        cep: cepLimpo,
        logradouro: logradouro.trim(),
        numero: numero.trim(),
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        uf: ufLimpo,
      };

      const { error } = await supabase
        .from('paciente')
        .update(payload)
        .eq('id_paciente_uuid', editandoId);

      if (error) throw error;

      Alert.alert('Sucesso', 'Paciente atualizado com sucesso.');
      fecharModal();
      carregarPacientes();
    } catch (error) {
      console.log('Erro ao atualizar paciente:', error);
      Alert.alert('Erro', error.message || 'Não foi possível atualizar o paciente.');
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

      setPacientes((atual) =>
        atual.filter((item) => getPacienteId(item) !== pacienteId)
      );
      setModalExclusaoVisible(false);
      setPacienteParaExcluir(null);

      Alert.alert('Sucesso', 'Paciente excluído logicamente com sucesso.');
      carregarPacientes();
    } catch (error) {
      console.log('Erro ao excluir paciente:', error);
      Alert.alert('Erro', 'Não foi possível excluir o paciente.');
    } finally {
      setLoadingExcluirId(null);
    }
  };

  const confirmarExclusao = (paciente) => {
    setPacienteParaExcluir(paciente);
    setModalExclusaoVisible(true);
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

  return (
    <SafeAreaView style={styles.container}>
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
          <TouchableOpacity style={styles.headerIconButton} onPress={carregarPacientes}>
            <Ionicons
              name="refresh-outline"
              size={20}
              color={patientTheme.colors.text}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.greeting}>Gerenciar pacientes</Text>
        <Text style={styles.headerSubtitle}>
          Carteira ativa de {nomeNutri}. Edite cadastros, revise dados e arquive
          pacientes com o mesmo visual da experiencia do paciente.
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
              <Text style={styles.patientInfo}>
                E-mail: {paciente.email_pac || 'Não informado'}
              </Text>
              <Text style={styles.patientInfo}>
                Gênero: {paciente.sexo_biologico || 'Não informado'}
              </Text>
              <Text style={styles.patientInfo}>
                Endereço: {paciente.logradouro || 'Não informado'}, {paciente.numero || 's/n'} - {paciente.bairro || 'Sem bairro'}
              </Text>
              <Text style={styles.patientInfo}>
                {paciente.cidade || 'Sem cidade'} / {paciente.uf || '--'} • CEP: {formatarCep(String(paciente.cep || '')) || 'Não informado'}
              </Text>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => abrirModalEdicao(paciente)}
                >
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => confirmarExclusao(paciente)}
                  disabled={loadingExcluirId === getPacienteId(paciente)}
                >
                  {loadingExcluirId === getPacienteId(paciente) ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.deleteButtonText}>Excluir</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </SectionCard>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Editar Paciente</Text>

                <TouchableOpacity onPress={fecharModal}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Nome Completo</Text>
              <TextInput
                style={styles.input}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome completo"
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>CPF</Text>
              <TextInput
                style={styles.input}
                value={cpf}
                onChangeText={(valor) => setCpf(formatarCpf(valor))}
                placeholder="000.000.000-00"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={14}
              />

              <Text style={styles.label}>Gênero</Text>
              <View style={styles.genderRow}>
                {opcoesGenero.map((opcao) => {
                  const ativo = genero === opcao;

                  return (
                    <TouchableOpacity
                      key={opcao}
                      style={[styles.genderButton, ativo && styles.genderButtonActive]}
                      onPress={() => setGenero(opcao)}
                    >
                      <Text style={[styles.genderButtonText, ativo && styles.genderButtonTextActive]}>
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
                placeholderTextColor="#999"
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.label}>CEP</Text>
              <TextInput
                style={styles.input}
                value={cep}
                onChangeText={(valor) => setCep(formatarCep(valor))}
                onBlur={buscarEnderecoPorCep}
                placeholder="00000-000"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={9}
              />

              <Text style={styles.label}>Logradouro</Text>
              <TextInput
                style={styles.input}
                value={logradouro}
                onChangeText={setLogradouro}
                placeholder="Rua, avenida..."
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Número</Text>
              <TextInput
                style={styles.input}
                value={numero}
                onChangeText={setNumero}
                placeholder="123"
                placeholderTextColor="#999"
              />

              <Text style={styles.label}>Bairro</Text>
              <TextInput
                style={styles.input}
                value={bairro}
                onChangeText={setBairro}
                placeholder="Bairro"
                placeholderTextColor="#999"
              />

              <View style={styles.row}>
                <View style={styles.cityContainer}>
                  <Text style={styles.label}>Cidade</Text>
                  <TextInput
                    style={styles.input}
                    value={cidade}
                    onChangeText={setCidade}
                    placeholder="Cidade"
                    placeholderTextColor="#999"
                  />
                </View>

                <View style={styles.ufContainer}>
                  <Text style={styles.label}>UF</Text>
                  <TextInput
                    style={styles.input}
                    value={uf}
                    onChangeText={(valor) => setUf(valor.toUpperCase())}
                    placeholder="PR"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                    maxLength={2}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={salvarEdicao}
                disabled={loadingSalvar}
              >
                {loadingSalvar ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Salvar alterações</Text>
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
              Deseja excluir logicamente{' '}
              {pacienteParaExcluir?.nome_completo || 'este paciente'}?
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
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Excluir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF' },

  header: {
    padding: 30,
    backgroundColor: '#27ae60',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerBack: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerBackText: {
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 6,
  },
  welcome: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  subtitle: {
    color: '#E3F2FD',
    fontSize: 16,
    marginTop: 4,
  },

  scroll: {
    flex: 1,
    minHeight: 0,
  },
  webScroll: {
    height: '100vh',
    maxHeight: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  webContent: {
    flexGrow: 0,
    minHeight: '100%',
  },

  cardInfo: {
    backgroundColor: '#f4f4f4',
    padding: 20,
    borderRadius: 15,
    marginTop: 20,
    ...softGreenBorder,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  infoText: {
    color: '#7f8c8d',
    fontSize: 16,
    marginBottom: 6,
  },
  reloadButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
    alignItems: 'center',
  },
  reloadButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },

  loadingContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#7f8c8d',
  },

  emptyCard: {
    backgroundColor: '#f4f4f4',
    padding: 24,
    borderRadius: 16,
    marginTop: 20,
    alignItems: 'center',
    ...softGreenBorder,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emptyText: {
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },

  patientCard: {
    backgroundColor: '#f4f4f4',
    padding: 18,
    borderRadius: 16,
    marginTop: 16,
    ...softGreenBorder,
  },
  patientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
    marginBottom: 10,
  },
  patientInfo: {
    color: '#5f6b73',
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#27ae60',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    maxHeight: '90%',
    backgroundColor: '#f4f4f4',
    borderRadius: 20,
    padding: 20,
    ...softGreenBorder,
  },
  confirmModalContent: {
    backgroundColor: '#f4f4f4',
    borderRadius: 20,
    padding: 22,
    ...softGreenBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  confirmText: {
    color: '#5f6b73',
    fontSize: 15,
    lineHeight: 22,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d7dde2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmCancelText: {
    color: '#5f6b73',
    fontWeight: '700',
  },
  confirmDeleteButton: {
    flex: 1,
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteText: {
    color: '#FFF',
    fontWeight: '700',
  },

  label: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    color: '#333',
    backgroundColor: '#FFFFFF',
    ...softGreenBorder,
  },

  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  genderButton: {
    borderWidth: 1,
    borderColor: '#cfd8dc',
    backgroundColor: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  genderButtonActive: {
    backgroundColor: '#27ae60',
    borderColor: '#27ae60',
  },
  genderButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
  },
  genderButtonTextActive: {
    color: '#FFF',
  },

  row: {
    flexDirection: 'row',
    gap: 10,
  },
  cityContainer: {
    flex: 1,
  },
  ufContainer: {
    width: 80,
  },

  saveButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#e74c3c',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
