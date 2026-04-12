import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Platform as RNPlatform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseConfig';
import SeletorPerfil from '../components/SeletorPerfil';
import BotaoVoltar from '../components/BotaoVoltar';

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

export default function CadastroScreen({ navigation, route }) {
  const roleInicial =
    route?.params?.roleInicial === 'Nutricionista' ? 'Nutricionista' : 'Paciente';

  const [role, setRole] = useState(roleInicial);
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [genero, setGenero] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [aceitouLgpd, setAceitouLgpd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedbackCadastro, setFeedbackCadastro] = useState(null);

  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const scrollViewRef = useRef(null);

  const opcoesGenero = ['Masculino', 'Feminino', 'Diverso'];

  const isPaciente = role === 'Paciente';

  useEffect(() => {
    setRole(roleInicial);
    setFeedbackCadastro(null);
  }, [roleInicial]);

  const formularioValido = isPaciente
    ? nome.trim() !== '' &&
      documento.trim() !== '' &&
      genero.trim() !== '' &&
      email.trim() !== '' &&
      senha.trim() !== '' &&
      confirmarSenha.trim() !== '' &&
      cep.trim() !== '' &&
      logradouro.trim() !== '' &&
      numero.trim() !== '' &&
      bairro.trim() !== '' &&
      cidade.trim() !== '' &&
      uf.trim() !== '' &&
      aceitouLgpd &&
      !loading
    : nome.trim() !== '' &&
      documento.trim() !== '' &&
      email.trim() !== '' &&
      senha.trim() !== '' &&
      confirmarSenha.trim() !== '' &&
      aceitouLgpd &&
      !loading;

  const exibirFeedback = (tipo, texto, extra = {}) => {
    setFeedbackCadastro({
      tipo,
      texto,
      ...extra,
    });

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd?.({ animated: true });
    });
  };

  const limparFormulario = () => {
    setNome('');
    setDocumento('');
    setGenero('');
    setEmail('');
    setSenha('');
    setConfirmarSenha('');
    setAceitouLgpd(false);
    setCep('');
    setLogradouro('');
    setNumero('');
    setBairro('');
    setCidade('');
    setUf('');
  };

  const trocarPerfil = (perfil) => {
    setRole(perfil);
    setFeedbackCadastro(null);
    setDocumento('');
    setCep('');
    setLogradouro('');
    setNumero('');
    setBairro('');
    setCidade('');
    setUf('');
  };

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

  const normalizarDocumento = () => {
    if (isPaciente) {
      return documento.replace(/\D/g, '');
    }
    return documento.trim().toUpperCase();
  };

  const normalizarCep = () => cep.replace(/\D/g, '');

  const validarEmail = (valor) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(valor.trim().toLowerCase());
  };

  const validarCpf = (cpf) => {
    const cpfLimpo = cpf.replace(/\D/g, '');

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

  const validarCep = (valorCep) => {
    const cepLimpo = valorCep.replace(/\D/g, '');
    return cepLimpo.length === 8;
  };

  const buscarEnderecoPorCep = async () => {
    const cepLimpo = normalizarCep();

    if (!isPaciente || cepLimpo.length !== 8) return;

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
      setUf(data.uf || '');
    } catch (error) {
      console.log('Erro ao buscar CEP:', error);
    }
  };

  const verificarDuplicidadePaciente = async (cpfLimpo, emailLimpo) => {
    const { data, error } = await supabase
      .from('paciente')
      .select('id_paciente_uuid, cpf_paciente, email_pac')
      .or(`cpf_paciente.eq.${cpfLimpo},email_pac.eq.${emailLimpo}`);

    if (error) throw error;

    if (data && data.length > 0) {
      const cpfExistente = data.some((item) => item.cpf_paciente === cpfLimpo);
      const emailExistente = data.some((item) => item.email_pac === emailLimpo);

      if (cpfExistente) {
        throw new Error('Já existe um paciente cadastrado com esse CPF.');
      }

      if (emailExistente) {
        throw new Error('Já existe um paciente cadastrado com esse e-mail.');
      }
    }
  };

  const verificarDuplicidadeNutricionista = async (crnLimpo, emailLimpo) => {
    const { data, error } = await supabase
      .from('nutricionista')
      .select('id_nutricionista_uuid, crm_numero, email_acesso')
      .or(`crm_numero.eq.${crnLimpo},email_acesso.eq.${emailLimpo}`);

    if (error) throw error;

    if (data && data.length > 0) {
      const crnExistente = data.some((item) => item.crm_numero === crnLimpo);
      const emailExistente = data.some((item) => item.email_acesso === emailLimpo);

      if (crnExistente) {
        throw new Error('Já existe um nutricionista cadastrado com esse CRN/UF.');
      }

      if (emailExistente) {
        throw new Error('Já existe um nutricionista cadastrado com esse e-mail.');
      }
    }
  };

  const handleCadastro = async () => {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();
    const documentoFormatado = normalizarDocumento();
    const cepLimpo = normalizarCep();

    setFeedbackCadastro(null);

    if (!nomeLimpo || !documento.trim() || !emailLimpo || !senha || !confirmarSenha || !genero) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios.');
      return;
    }

    if (isPaciente) {
      if (
        !cep.trim() ||
        !logradouro.trim() ||
        !numero.trim() ||
        !bairro.trim() ||
        !cidade.trim() ||
        !uf.trim()
      ) {
        Alert.alert('Atenção', 'Preencha todos os campos de endereço.');
        return;
      }
    }

    if (!aceitouLgpd) {
      Alert.alert('Atenção', 'Você precisa aceitar os termos de LGPD para continuar.');
      return;
    }

    if (!validarEmail(emailLimpo)) {
      Alert.alert('E-mail inválido', 'Digite um e-mail válido.');
      return;
    }

    if (senha.length < 6) {
      Alert.alert('Senha inválida', 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (senha !== confirmarSenha) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    if (isPaciente && !validarCpf(documentoFormatado)) {
      Alert.alert('CPF inválido', 'Digite um CPF válido.');
      return;
    }

    if (isPaciente && !validarCep(cepLimpo)) {
      Alert.alert('CEP inválido', 'Digite um CEP válido com 8 números.');
      return;
    }

    setLoading(true);

    try {
      let registroCriado = null;

      if (isPaciente) {
        await verificarDuplicidadePaciente(documentoFormatado, emailLimpo);

        const objetoCadastro = {
          nome_completo: nomeLimpo,
          cpf_paciente: documentoFormatado,
          email_pac: emailLimpo,
          senha_pac: senha,
          sexo_biologico: genero,
          cep: cepLimpo,
          logradouro: logradouro.trim(),
          numero: numero.trim(),
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          uf: uf.trim().toUpperCase(),
          excluido: false,
          data_exclusao: null,
        };

        const { data, error } = await supabase
          .from('paciente')
          .insert([objetoCadastro])
          .select('id_paciente_uuid, nome_completo, email_pac')
          .single();
        if (error) throw error;
        if (!data?.id_paciente_uuid) {
          throw new Error('O paciente nao foi confirmado no banco de dados.');
        }
        registroCriado = data;
        console.log('Paciente salvo com sucesso:', data);
      } else {
        await verificarDuplicidadeNutricionista(documentoFormatado, emailLimpo);

        const objetoCadastro = {
          nome_completo_nutri: nomeLimpo,
          crm_numero: documentoFormatado,
          email_acesso: emailLimpo,
          senha_nutri: senha,
        };

        const { data, error } = await supabase
          .from('nutricionista')
          .insert([objetoCadastro])
          .select('id_nutricionista_uuid, nome_completo_nutri, email_acesso')
          .single();
        if (error) throw error;
        if (!data?.id_nutricionista_uuid) {
          throw new Error('O nutricionista nao foi confirmado no banco de dados.');
        }
        registroCriado = data;
        console.log('Nutricionista salvo com sucesso:', data);
      }

      limparFormulario();
      setFeedbackCadastro({
        tipo: 'sucesso',
        texto: `${role} cadastrado e salvo no banco com sucesso. Agora voce ja pode entrar pela aba ${role}.`,
        registro: registroCriado,
      });
    } catch (err) {
      console.error('Erro detalhado:', err);
      setFeedbackCadastro({
        tipo: 'erro',
        texto: err.message || 'Nao foi possivel concluir o cadastro.',
      });
      Alert.alert(
        'Erro no Cadastro',
        err.message || 'Não foi possível concluir o cadastro.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={[styles.scroll, RNPlatform.OS === 'web' && styles.webScroll]}
          contentContainerStyle={[
            styles.scrollContent,
            RNPlatform.OS === 'web' && styles.webScrollContent,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <BotaoVoltar
            onPress={() => navigation.navigate('Login')}
            style={styles.authBackButton}
          />

          <View style={styles.card}>
            <Text style={styles.title}>Crie sua conta</Text>

            <SeletorPerfil
              role={role}
              onChangeRole={trocarPerfil}
            />

            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Ex: João Silva"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>
              {isPaciente ? 'CPF' : 'CRN/UF'}
            </Text>
            <TextInput
              style={styles.input}
              value={documento}
              onChangeText={(valor) => {
                if (isPaciente) {
                  setDocumento(formatarCpf(valor));
                } else {
                  setDocumento(valor.toUpperCase());
                }
              }}
              placeholder={isPaciente ? '000.000.000-00' : '12345/PR'}
              placeholderTextColor="#999"
              keyboardType={isPaciente ? 'numeric' : 'default'}
              autoCapitalize="characters"
              maxLength={isPaciente ? 14 : 15}
            />

            {isPaciente && (
              <>
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
                  placeholder="Seu bairro"
                  placeholderTextColor="#999"
                />

                <View style={styles.row}>
                  <View style={styles.cityContainer}>
                    <Text style={styles.label}>Cidade</Text>
                    <TextInput
                      style={styles.input}
                      value={cidade}
                      onChangeText={setCidade}
                      placeholder="Sua cidade"
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
                      maxLength={2}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              </>
            )}

            <Text style={styles.label}>Gênero</Text>
            <TouchableOpacity
              style={styles.inputPicker}
              onPress={() => setModalVisible(true)}
            >
              <Text style={{ color: genero ? '#333' : '#999' }}>
                {genero || 'Selecione seu gênero'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#999" />
            </TouchableOpacity>

            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              placeholder="exemplo@email.com"
              keyboardType="email-address"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              placeholder="Crie uma senha"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Confirmar Senha</Text>
            <TextInput
              style={styles.input}
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              secureTextEntry
              placeholder="Repita a senha"
              placeholderTextColor="#999"
            />

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAceitouLgpd(!aceitouLgpd)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={aceitouLgpd ? 'checkbox' : 'square-outline'}
                size={22}
                color={aceitouLgpd ? '#4fdfa3' : '#7f8c8d'}
              />
              <Text style={styles.checkboxText}>
                Li e aceito os termos de uso e a política de privacidade conforme a LGPD.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: formularioValido ? '#4fdfa3' : '#aeb6bf' },
              ]}
              onPress={handleCadastro}
              disabled={!formularioValido}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Cadastrar</Text>
              )}
            </TouchableOpacity>

            {feedbackCadastro ? (
              <View
                style={[
                  styles.feedbackBox,
                  feedbackCadastro.tipo === 'erro' && styles.feedbackBoxErro,
                ]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    feedbackCadastro.tipo === 'erro' && styles.feedbackTextErro,
                  ]}
                >
                  {feedbackCadastro.texto}
                </Text>

                {feedbackCadastro.tipo === 'sucesso' ? (
                  <TouchableOpacity
                    style={styles.feedbackButton}
                    onPress={() =>
                      navigation.navigate('Login', {
                        roleInicial: role,
                      })
                    }
                  >
                    <Text style={styles.feedbackButtonText}>Ir para login</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>

        <Modal visible={modalVisible} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Selecione o Gênero</Text>

              {opcoesGenero.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.modalItem}
                  onPress={() => {
                    setGenero(item);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                  {genero === item && (
                    <Ionicons name="checkmark" size={22} color="#27ae60" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: '#ffffff' },
  keyboard: { flex: 1, minHeight: 0 },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 60 },
  webScroll: {
    height: '100vh',
    maxHeight: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  webScrollContent: {
    flexGrow: 0,
    minHeight: '100%',
  },
  authBackButton: {
    marginTop: 10,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#f4f4f4',
    borderRadius: 24,
    padding: 25,
    ...softGreenBorder,
  },
  feedbackBox: {
    marginBottom: 18,
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
  feedbackButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: '#4fdfa3',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  feedbackButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#4fdfa3',
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 5,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    color: '#333',
    backgroundColor: '#ffffff',
    ...softGreenBorder,
  },
  inputPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    backgroundColor: '#ffffff',
    ...softGreenBorder,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 5,
    marginBottom: 15,
  },
  checkboxText: {
    flex: 1,
    marginLeft: 10,
    color: '#34495e',
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#f4f4f4',
    width: '85%',
    borderRadius: 15,
    padding: 20,
    ...softGreenBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalItemText: {
    fontSize: 16,
    color: '#444',
  },
});
