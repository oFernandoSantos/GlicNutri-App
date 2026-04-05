import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
import {
  isValidNutritionistAccessCode,
  normalizeNutritionistAccessCode,
} from '../config/nutritionistAccessConfig';

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

export default function CadastroScreenFixed({ navigation, route }) {
  const roleInicial =
    route?.params?.roleInicial === 'Nutricionista' ? 'Nutricionista' : 'Paciente';

  const [role, setRole] = useState(roleInicial);
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [genero, setGenero] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCodigoAcessoVisible, setModalCodigoAcessoVisible] = useState(false);
  const [erroCodigoAcesso, setErroCodigoAcesso] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [codigoAcessoNutricionista, setCodigoAcessoNutricionista] = useState('');
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

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd?.({ animated: true });
    }, 50);
  };

  const limparFormulario = () => {
    setNome('');
    setDocumento('');
    setGenero('');
    setEmail('');
    setSenha('');
    setConfirmarSenha('');
    setCodigoAcessoNutricionista('');
    setAceitouLgpd(false);
    setCep('');
    setLogradouro('');
    setNumero('');
    setBairro('');
    setCidade('');
    setUf('');
    setErroCodigoAcesso('');
  };

  const trocarPerfil = (perfil) => {
    setRole(perfil);
    setFeedbackCadastro(null);
    setErroCodigoAcesso('');
    limparFormulario();
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

  const formatarCrn = (valor) => {
    const textoLimpo = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const numeros = textoLimpo.replace(/[A-Z]/g, '').slice(0, 5);
    const uf = textoLimpo.replace(/\d/g, '').slice(0, 2);

    if (!numeros) {
      return '';
    }

    return uf ? `${numeros}/${uf}` : numeros;
  };

  const validarCrn = (crn) => /^\d{5}\/[A-Z]{2}$/.test(crn.trim());

  const normalizarDocumento = () => {
    if (isPaciente) {
      return documento.replace(/\D/g, '');
    }

    return formatarCrn(documento);
  };

  const normalizarCep = () => cep.replace(/\D/g, '');

  const validarEmail = (valor) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim().toLowerCase());

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

  const validarCep = (valorCep) => valorCep.replace(/\D/g, '').length === 8;

  const buscarEnderecoPorCep = async () => {
    const cepLimpo = normalizarCep();

    if (!isPaciente || cepLimpo.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (data.erro) {
        exibirFeedback('erro', 'Nao encontramos esse CEP.');
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

  const verificarDuplicidadePaciente = async (cpfLimpo, emailLimpo) => {
    const { data, error } = await supabase
      .from('paciente')
      .select('id_paciente_uuid, cpf_paciente, email_pac')
      .or(`cpf_paciente.eq.${cpfLimpo},email_pac.eq.${emailLimpo}`);

    if (error) throw error;

    if ((data || []).some((item) => item.cpf_paciente === cpfLimpo)) {
      throw new Error('Ja existe um paciente cadastrado com esse CPF.');
    }

    if ((data || []).some((item) => item.email_pac === emailLimpo)) {
      throw new Error('Ja existe um paciente cadastrado com esse e-mail.');
    }
  };

  const verificarDuplicidadeNutricionista = async (crnLimpo, emailLimpo) => {
    const { data, error } = await supabase
      .from('nutricionista')
      .select('id_nutricionista_uuid, crm_numero, email_acesso')
      .or(`crm_numero.eq.${crnLimpo},email_acesso.eq.${emailLimpo}`);

    if (error) throw error;

    if ((data || []).some((item) => item.crm_numero === crnLimpo)) {
      throw new Error('Ja existe um nutricionista cadastrado com esse CRN/UF.');
    }

    if ((data || []).some((item) => item.email_acesso === emailLimpo)) {
      throw new Error('Ja existe um nutricionista cadastrado com esse e-mail.');
    }
  };

  const validarFormulario = ({
    nomeLimpo,
    emailLimpo,
    documentoFormatado,
    cepLimpo,
    exigirCodigoAcesso = true,
    codigoAcessoInformado = codigoAcessoNutricionista,
  }) => {
    const codigoAcessoNormalizado = normalizeNutritionistAccessCode(codigoAcessoInformado);

    if (!nomeLimpo) return 'Informe o nome completo.';
    if (!documento.trim()) return `Informe ${isPaciente ? 'o CPF' : 'o CRN/UF'}.`;
    if (!isPaciente && exigirCodigoAcesso && !codigoAcessoNormalizado) {
      return 'Informe o codigo de acesso da empresa para cadastrar a nutricionista.';
    }
    if (isPaciente && !genero) return 'Selecione o genero do paciente.';
    if (!emailLimpo) return 'Informe o e-mail.';
    if (!senha || !confirmarSenha) return 'Preencha a senha e a confirmacao de senha.';
    if (isPaciente && !cep.trim()) return 'Informe o CEP do paciente.';

    if (
      isPaciente &&
      (
        !logradouro.trim() ||
        !numero.trim() ||
        !bairro.trim() ||
        !cidade.trim() ||
        !uf.trim()
      )
    ) {
      return 'Preencha todos os campos de endereco do paciente.';
    }

    if (!aceitouLgpd) return 'Voce precisa aceitar os termos de LGPD para continuar.';
    if (!validarEmail(emailLimpo)) return 'Digite um e-mail valido.';
    if (senha.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (senha !== confirmarSenha) return 'As senhas nao coincidem.';
    if (
      !isPaciente &&
      exigirCodigoAcesso &&
      !isValidNutritionistAccessCode(codigoAcessoNormalizado)
    ) {
      return 'Codigo de acesso invalido. Use o codigo fornecido pela empresa.';
    }
    if (!isPaciente && !validarCrn(documentoFormatado)) {
      return 'Digite o CRN no formato 12345/SP.';
    }
    if (isPaciente && !validarCpf(documentoFormatado)) return 'Digite um CPF valido.';
    if (isPaciente && !validarCep(cepLimpo)) return 'Digite um CEP valido com 8 numeros.';

    return null;
  };

  const handleCadastro = async (codigoAcessoInformado = codigoAcessoNutricionista) => {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();
    const documentoFormatado = normalizarDocumento();
    const cepLimpo = normalizarCep();
    const codigoAcessoNormalizado = normalizeNutritionistAccessCode(codigoAcessoInformado);

    setFeedbackCadastro(null);

    const erroValidacao = validarFormulario({
      nomeLimpo,
      emailLimpo,
      documentoFormatado,
      cepLimpo,
      codigoAcessoInformado: codigoAcessoNormalizado,
    });

    if (erroValidacao) {
      const erroEhDoCodigoAcesso =
        !isPaciente &&
        (
          erroValidacao === 'Informe o codigo de acesso da empresa para cadastrar a nutricionista.' ||
          erroValidacao === 'Codigo de acesso invalido. Use o codigo fornecido pela empresa.'
        );

      if (erroEhDoCodigoAcesso) {
        setErroCodigoAcesso(erroValidacao);
      } else {
        exibirFeedback('erro', erroValidacao);
        Alert.alert('Validacao', erroValidacao);
      }

      return;
    }

    if (!isPaciente) {
      setErroCodigoAcesso('');
      setCodigoAcessoNutricionista(codigoAcessoNormalizado);
      setModalCodigoAcessoVisible(false);
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
      exibirFeedback(
        'sucesso',
        `${role} cadastrado e salvo no banco com sucesso. Agora voce ja pode entrar pela aba ${role}.`,
        { registro: registroCriado }
      );
    } catch (err) {
      console.error('Erro detalhado:', err);
      exibirFeedback('erro', err.message || 'Nao foi possivel concluir o cadastro.');
      Alert.alert('Erro no cadastro', err.message || 'Nao foi possivel concluir o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const handlePressCadastrar = () => {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();
    const documentoFormatado = normalizarDocumento();
    const cepLimpo = normalizarCep();

    setFeedbackCadastro(null);

    const erroValidacao = validarFormulario({
      nomeLimpo,
      emailLimpo,
      documentoFormatado,
      cepLimpo,
      exigirCodigoAcesso: false,
    });

    if (erroValidacao) {
      exibirFeedback('erro', erroValidacao);
      Alert.alert('Validacao', erroValidacao);
      return;
    }

    if (isPaciente) {
      handleCadastro();
      return;
    }

    setErroCodigoAcesso('');
    setModalCodigoAcessoVisible(true);
  };

  const handleConfirmarCodigoAcesso = () => {
    const codigoNormalizado = normalizeNutritionistAccessCode(codigoAcessoNutricionista);
    setErroCodigoAcesso('');
    setCodigoAcessoNutricionista(codigoNormalizado);
    handleCadastro(codigoNormalizado);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          style={[styles.scroll, RNPlatform.OS === 'web' && styles.webScroll]}
          contentContainerStyle={[
            styles.scrollContent,
            RNPlatform.OS === 'web' && styles.webScrollContent,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.backButton}
          >
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.title}>Crie sua conta</Text>

            <SeletorPerfil role={role} onChangeRole={trocarPerfil} />

            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Ex: Joao Silva"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>{isPaciente ? 'CPF' : 'CRN/UF'}</Text>
            <TextInput
              style={styles.input}
              value={documento}
              onChangeText={(valor) => {
                if (isPaciente) {
                  setDocumento(formatarCpf(valor));
                } else {
                  setDocumento(formatarCrn(valor));
                }
              }}
              placeholder={isPaciente ? '000.000.000-00' : '12345/SP'}
              placeholderTextColor="#999"
              keyboardType={isPaciente ? 'numeric' : 'default'}
              autoCapitalize="characters"
              maxLength={isPaciente ? 14 : 8}
            />

            {isPaciente ? (
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

                <Text style={styles.label}>Numero</Text>
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
                      placeholder="SP"
                      placeholderTextColor="#999"
                      maxLength={2}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              </>
            ) : null}

            <Text style={styles.label}>
              {isPaciente ? 'Genero' : 'Genero (opcional)'}
            </Text>
            <TouchableOpacity
              style={styles.inputPicker}
              onPress={() => setModalVisible(true)}
            >
              <Text style={{ color: genero ? '#333' : '#999' }}>
                {genero || 'Selecione'}
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
                Li e aceito os termos de uso e a politica de privacidade conforme a LGPD.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: loading
                    ? '#aeb6bf'
                    : formularioValido
                      ? '#4fdfa3'
                      : '#7bcfae',
                },
              ]}
              onPress={handlePressCadastrar}
              disabled={loading}
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
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Selecione o Genero</Text>

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
                      {genero === item ? (
                        <Ionicons name="checkmark" size={22} color="#27ae60" />
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <Modal visible={modalCodigoAcessoVisible} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => setModalCodigoAcessoVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Codigo de Acesso da Empresa</Text>
                  <Text style={styles.modalDescription}>
                    Digite o codigo fornecido pela empresa para liberar o cadastro da
                    nutricionista.
                  </Text>

                  <TextInput
                    style={styles.input}
                    value={codigoAcessoNutricionista}
                    onChangeText={(valor) =>
                      setCodigoAcessoNutricionista(normalizeNutritionistAccessCode(valor))
                    }
                    placeholder="Digite o codigo"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />

                  {erroCodigoAcesso ? (
                    <View style={styles.modalErrorBox}>
                      <Text style={styles.modalErrorText}>{erroCodigoAcesso}</Text>
                    </View>
                  ) : null}

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalActionButton, styles.modalActionSecondary]}
                      onPress={() => {
                        setErroCodigoAcesso('');
                        setModalCodigoAcessoVisible(false);
                      }}
                    >
                      <Text style={styles.modalActionSecondaryText}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalActionButton, styles.modalActionPrimary]}
                      onPress={handleConfirmarCodigoAcesso}
                    >
                      <Text style={styles.modalActionPrimaryText}>Confirmar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
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
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    marginTop: 10,
    marginBottom: 20,
    ...softGreenBorder,
  },
  backText: {
    color: '#686d71',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#f4f4f4',
    borderRadius: 24,
    padding: 25,
    ...softGreenBorder,
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
  helperText: {
    marginTop: -8,
    marginBottom: 14,
    color: '#686d71',
    fontSize: 12,
    lineHeight: 17,
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
  feedbackBox: {
    marginTop: 14,
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
  modalDescription: {
    color: '#686d71',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalErrorBox: {
    marginTop: -2,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#fff1f0',
    borderWidth: 1,
    borderColor: '#e57373',
  },
  modalErrorText: {
    color: '#b23a48',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
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
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalActionSecondary: {
    backgroundColor: '#ffffff',
    ...softGreenBorder,
  },
  modalActionPrimary: {
    backgroundColor: '#4fdfa3',
  },
  modalActionSecondaryText: {
    color: '#686d71',
    fontWeight: '700',
  },
  modalActionPrimaryText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
