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
  Image,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AuthSession from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseConfig';
import {
  buildGooglePatientFallback,
  syncGooglePatientRecord,
} from '../services/googlePatientSync';
import SeletorPerfil from '../components/SeletorPerfil';
import BotaoVoltar from '../components/BotaoVoltar';
import CampoSenha from '../components/CampoSenha';
import { inputFocusBorder } from '../theme/inputFocusTheme';
import {
  isValidNutritionistAccessCode,
  normalizeNutritionistAccessCode,
} from '../config/nutritionistAccessConfig';
import {
  getPasswordValidationMessage,
  passwordRequirements,
} from '../utils/passwordRequirements';
import {
  confirmarCodigoValidacaoEmailCadastro,
  solicitarCodigoValidacaoEmailCadastro,
} from '../services/emailVerificationService';

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

const googleLogo = {
  uri: 'https://img.icons8.com/?size=100&id=xoyhGXWmHnqX&format=png&color=000000',
};

function createCadastroFieldErrors() {
  return {
    nome: '',
    documento: '',
    genero: '',
    email: '',
    senha: '',
    confirmarSenha: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    aceitouLgpd: '',
    codigoAcessoNutricionista: '',
  };
}

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
  const [modalValidacaoEmailVisible, setModalValidacaoEmailVisible] = useState(false);
  const [codigoValidacaoEmail, setCodigoValidacaoEmail] = useState('');
  const [erroCodigoValidacaoEmail, setErroCodigoValidacaoEmail] = useState('');
  const [validandoEmailCadastro, setValidandoEmailCadastro] = useState(false);
  const [codigoAcessoPendenteCadastro, setCodigoAcessoPendenteCadastro] = useState('');
  const [emailPendenteCadastro, setEmailPendenteCadastro] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [senhaFocada, setSenhaFocada] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [codigoAcessoNutricionista, setCodigoAcessoNutricionista] = useState('');
  const [aceitouLgpd, setAceitouLgpd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [feedbackCadastro, setFeedbackCadastro] = useState(null);
  const [modalCadastroSucessoVisible, setModalCadastroSucessoVisible] = useState(false);
  const [mensagemCadastroSucesso, setMensagemCadastroSucesso] = useState('');
  const [fieldErrors, setFieldErrors] = useState(createCadastroFieldErrors);

  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');

  const scrollViewRef = useRef(null);
  const googleSessionHandledRef = useRef(false);
  const opcoesGenero = ['Masculino', 'Feminino', 'Diverso'];
  const isPaciente = role === 'Paciente';
  const senhaCadastroValida = passwordRequirements.every((item) => item.test(senha));
  const confirmacaoSenhaValida = confirmarSenha.trim() !== '' && senha === confirmarSenha;

  useEffect(() => {
    setRole(roleInicial);
    setFeedbackCadastro(null);
    limparErrosCamposCadastro();
  }, [roleInicial]);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    async function verificarSessaoAtual() {
      try {
        const { data, error } = await supabase.auth.getSession();

        console.log('Sessao atual ao abrir Cadastro =>', {
          hasSession: !!data?.session,
          userId: data?.session?.user?.id || null,
          error: error?.message || null,
        });

        if (data?.session?.user && !googleSessionHandledRef.current) {
          googleSessionHandledRef.current = true;
          await finalizarCadastroGoogleComUsuario(data.session.user);
        }
      } catch (error) {
        console.log('Erro ao verificar sessao atual no cadastro =>', error);
        googleSessionHandledRef.current = false;
      }
    }

    if (isPaciente) {
      verificarSessaoAtual();
    }
  }, [isPaciente, navigation]);

  function limparErrosCamposCadastro() {
    setFieldErrors(createCadastroFieldErrors());
  }

  const formularioValido = isPaciente
    ? nome.trim() !== '' &&
      documento.trim() !== '' &&
      genero.trim() !== '' &&
      email.trim() !== '' &&
      senhaCadastroValida &&
      confirmacaoSenhaValida &&
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
      senhaCadastroValida &&
      confirmacaoSenhaValida &&
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
    setSenhaFocada(false);
    setFocusedField('');
    setCodigoAcessoNutricionista('');
    setAceitouLgpd(false);
    setCep('');
    setLogradouro('');
    setNumero('');
    setBairro('');
    setCidade('');
    setUf('');
    setErroCodigoAcesso('');
    setModalValidacaoEmailVisible(false);
    setCodigoValidacaoEmail('');
    setErroCodigoValidacaoEmail('');
    setValidandoEmailCadastro(false);
    setCodigoAcessoPendenteCadastro('');
    setEmailPendenteCadastro('');
    setModalCadastroSucessoVisible(false);
    setMensagemCadastroSucesso('');
    limparErrosCamposCadastro();
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

  const formatarNome = (valor) =>
    valor.replace(/(^|\s)(\S)/g, (_, espaco, letra) =>
      `${espaco}${letra.toLocaleUpperCase('pt-BR')}`
    );

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

  const validarCampoCadastro = (
    campo,
    {
      exigirCodigoAcesso = true,
      codigoAcessoInformado = codigoAcessoNutricionista,
      overrides = {},
    } = {}
  ) => {
    const nomeValor = overrides.nome ?? nome;
    const documentoValor = overrides.documento ?? documento;
    const generoValor = overrides.genero ?? genero;
    const emailValor = overrides.email ?? email;
    const senhaValor = overrides.senha ?? senha;
    const confirmarSenhaValor = overrides.confirmarSenha ?? confirmarSenha;
    const cepValor = overrides.cep ?? cep;
    const logradouroValor = overrides.logradouro ?? logradouro;
    const numeroValor = overrides.numero ?? numero;
    const bairroValor = overrides.bairro ?? bairro;
    const cidadeValor = overrides.cidade ?? cidade;
    const ufValor = overrides.uf ?? uf;
    const aceitouLgpdValor = overrides.aceitouLgpd ?? aceitouLgpd;

    const nomeLimpo = nomeValor.trim();
    const documentoBruto = documentoValor.trim();
    const documentoFormatado = isPaciente
      ? documentoValor.replace(/\D/g, '')
      : formatarCrn(documentoValor);
    const emailLimpo = emailValor.trim().toLowerCase();
    const cepBruto = cepValor.trim();
    const cepLimpo = cepValor.replace(/\D/g, '');
    const codigoAcessoNormalizado = normalizeNutritionistAccessCode(codigoAcessoInformado);

    switch (campo) {
      case 'nome':
        return !nomeLimpo ? 'Informe o nome completo.' : '';
      case 'documento':
        if (!documentoBruto) {
          return `Informe ${isPaciente ? 'o CPF' : 'o CRN/UF'}.`;
        }
        if (!isPaciente && !validarCrn(documentoFormatado)) {
          return 'Digite o CRN no formato 12345/SP.';
        }
        if (isPaciente && !validarCpf(documentoFormatado)) {
          return 'Digite um CPF valido.';
        }
        return '';
      case 'genero':
        return isPaciente && !generoValor ? 'Selecione o genero do paciente.' : '';
      case 'email':
        if (!emailLimpo) return 'Informe o e-mail.';
        return !validarEmail(emailLimpo) ? 'Digite um e-mail valido.' : '';
      case 'senha':
        return getPasswordValidationMessage(senhaValor, 'Informe a senha.');
      case 'confirmarSenha':
        if (!confirmarSenhaValor) return 'Confirme a senha.';
        return senhaValor !== confirmarSenhaValor ? 'As senhas nao coincidem.' : '';
      case 'cep':
        if (!isPaciente) return '';
        if (!cepBruto) return 'Informe o CEP do paciente.';
        return !validarCep(cepLimpo) ? 'Digite um CEP valido com 8 numeros.' : '';
      case 'logradouro':
        return isPaciente && !logradouroValor.trim() ? 'Informe o logradouro.' : '';
      case 'numero':
        return isPaciente && !numeroValor.trim() ? 'Informe o numero.' : '';
      case 'bairro':
        return isPaciente && !bairroValor.trim() ? 'Informe o bairro.' : '';
      case 'cidade':
        return isPaciente && !cidadeValor.trim() ? 'Informe a cidade.' : '';
      case 'uf':
        return isPaciente && !ufValor.trim() ? 'Informe a UF.' : '';
      case 'aceitouLgpd':
        return !aceitouLgpdValor
          ? 'Voce precisa aceitar os termos de LGPD para continuar.'
          : '';
      case 'codigoAcessoNutricionista':
        if (isPaciente || !exigirCodigoAcesso) return '';
        if (!codigoAcessoNormalizado) {
          return 'Informe o codigo de acesso da empresa para cadastrar a nutricionista.';
        }
        return !isValidNutritionistAccessCode(codigoAcessoNormalizado)
          ? 'Codigo de acesso invalido. Use o codigo fornecido pela empresa.'
          : '';
      default:
        return '';
    }
  };

  const obterErrosFormularioCadastro = (opcoes = {}) => {
    const erros = createCadastroFieldErrors();
    const campos = isPaciente
      ? [
          'nome',
          'documento',
          'genero',
          'email',
          'senha',
          'confirmarSenha',
          'cep',
          'logradouro',
          'numero',
          'bairro',
          'cidade',
          'uf',
          'aceitouLgpd',
        ]
      : [
          'nome',
          'documento',
          'email',
          'senha',
          'confirmarSenha',
          'aceitouLgpd',
          ...(opcoes.exigirCodigoAcesso === false ? [] : ['codigoAcessoNutricionista']),
        ];

    campos.forEach((campo) => {
      erros[campo] = validarCampoCadastro(campo, opcoes);
    });

    return erros;
  };

  const temErrosCadastro = (erros) => Object.values(erros).some(Boolean);

  const atualizarErroCampoCadastro = (campo, opcoes = {}) => {
    setFieldErrors((atual) => {
      if (!atual[campo]) {
        return atual;
      }

      return {
        ...atual,
        [campo]: validarCampoCadastro(campo, opcoes),
      };
    });
  };

  const atualizarErrosCamposCadastro = (campos, opcoes = {}) => {
    setFieldErrors((atual) => {
      const proximoEstado = { ...atual };

      campos.forEach((campo) => {
        if (proximoEstado[campo]) {
          proximoEstado[campo] = validarCampoCadastro(campo, opcoes);
        }
      });

      return proximoEstado;
    });
  };

  const buscarEnderecoPorCep = async () => {
    const cepLimpo = normalizarCep();

    if (!isPaciente || cepLimpo.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (data.erro) {
        setFeedbackCadastro(null);
        setFieldErrors((atual) => ({
          ...atual,
          cep: 'CEP invalido.',
        }));
        return;
      }

      const logradouroViaCep = data.logradouro || '';
      const bairroViaCep = data.bairro || '';
      const cidadeViaCep = data.localidade || '';
      const ufViaCep = (data.uf || '').toUpperCase();

      setLogradouro(logradouroViaCep);
      setBairro(bairroViaCep);
      setCidade(cidadeViaCep);
      setUf(ufViaCep);
      atualizarErrosCamposCadastro(['logradouro', 'bairro', 'cidade', 'uf'], {
        overrides: {
          logradouro: logradouroViaCep,
          bairro: bairroViaCep,
          cidade: cidadeViaCep,
          uf: ufViaCep,
        },
      });
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

  const tratarErroCadastro = (mensagemErro) => {
    if (mensagemErro.includes('CPF')) {
      setFieldErrors((atual) => ({ ...atual, documento: mensagemErro }));
      return;
    }

    if (mensagemErro.includes('CRN/UF')) {
      setFieldErrors((atual) => ({ ...atual, documento: mensagemErro }));
      return;
    }

    const erroCampoEmail =
      (mensagemErro.startsWith('Ja existe') && mensagemErro.includes('e-mail')) ||
      mensagemErro === 'E-mail invalido.' ||
      mensagemErro === 'Digite um e-mail valido.';

    if (erroCampoEmail) {
      setFieldErrors((atual) => ({ ...atual, email: mensagemErro }));
      return;
    }

    exibirFeedback('erro', mensagemErro);
    Alert.alert('Erro no cadastro', mensagemErro);
  };

  const solicitarValidacaoEmailCadastro = async (
    codigoAcessoInformado = codigoAcessoNutricionista,
    { reenviar = false } = {}
  ) => {
    const emailLimpo = email.trim().toLowerCase();
    const documentoFormatado = normalizarDocumento();
    const codigoAcessoNormalizado = normalizeNutritionistAccessCode(codigoAcessoInformado);

    setFeedbackCadastro(null);
    setErroCodigoValidacaoEmail('');
    setLoading(true);
    let abriuModalValidacao = false;

    try {
      if (isPaciente) {
        await verificarDuplicidadePaciente(documentoFormatado, emailLimpo);
      } else {
        await verificarDuplicidadeNutricionista(documentoFormatado, emailLimpo);
      }

      setCodigoAcessoPendenteCadastro(codigoAcessoNormalizado);
      setEmailPendenteCadastro(emailLimpo);
      setCodigoValidacaoEmail('');
      setModalValidacaoEmailVisible(true);
      abriuModalValidacao = true;

      await solicitarCodigoValidacaoEmailCadastro({
        role,
        email: emailLimpo,
      });

      if (reenviar) {
        setErroCodigoValidacaoEmail('');
        Alert.alert('Codigo reenviado', 'Confira o e-mail informado.');
      }
    } catch (err) {
      const mensagemErro = err.message || 'Nao foi possivel enviar o codigo de validacao.';

      if (reenviar || abriuModalValidacao || modalValidacaoEmailVisible) {
        setErroCodigoValidacaoEmail(mensagemErro);
      } else {
        tratarErroCadastro(mensagemErro);
      }
    } finally {
      setLoading(false);
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
    const erroSenha = getPasswordValidationMessage(senha, 'Informe a senha.');
    if (erroSenha) return erroSenha;
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

  const handleCadastro = async (
    codigoAcessoInformado = codigoAcessoNutricionista,
    { emailValidado = false } = {}
  ) => {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();
    const documentoFormatado = normalizarDocumento();
    const cepLimpo = normalizarCep();
    const codigoAcessoNormalizado = normalizeNutritionistAccessCode(codigoAcessoInformado);

    setFeedbackCadastro(null);
    const errosFormulario = obterErrosFormularioCadastro({
      codigoAcessoInformado: codigoAcessoNormalizado,
    });
    setFieldErrors(errosFormulario);

    if (!isPaciente) {
      setErroCodigoAcesso(errosFormulario.codigoAcessoNutricionista || '');
    }

    if (temErrosCadastro(errosFormulario)) {
      return;
    }

    if (!isPaciente) {
      limparErrosCamposCadastro();
      setErroCodigoAcesso('');
      setCodigoAcessoNutricionista(codigoAcessoNormalizado);
      setModalCodigoAcessoVisible(false);
    }

    if (!emailValidado) {
      await solicitarValidacaoEmailCadastro(codigoAcessoNormalizado);
      return;
    }

    setLoading(true);

    try {
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

        console.log('Nutricionista salvo com sucesso:', data);
      }

      const mensagemSucesso =
        isPaciente
          ? 'Paciente cadastrado com sucesso.'
          : 'Nutricionista cadastrado com sucesso.';

      limparFormulario();
      setMensagemCadastroSucesso(
        `${mensagemSucesso} E-mail validado com sucesso. Voce ja pode fazer login.`
      );
      setModalCadastroSucessoVisible(true);
    } catch (err) {
      console.error('Erro detalhado:', err);
      const mensagemErro = err.message || 'Nao foi possivel concluir o cadastro.';
      tratarErroCadastro(mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  const handlePressCadastrar = () => {
    setFeedbackCadastro(null);
    const errosFormulario = obterErrosFormularioCadastro({
      exigirCodigoAcesso: false,
    });
    setFieldErrors(errosFormulario);

    if (temErrosCadastro(errosFormulario)) {
      return;
    }

    if (isPaciente) {
      handleCadastro();
      return;
    }

    setErroCodigoAcesso('');
    setFieldErrors((atual) => ({ ...atual, codigoAcessoNutricionista: '' }));
    setModalCodigoAcessoVisible(true);
  };

  const handleConfirmarCodigoAcesso = () => {
    const codigoNormalizado = normalizeNutritionistAccessCode(codigoAcessoNutricionista);
    setErroCodigoAcesso('');
    setFieldErrors((atual) => ({ ...atual, codigoAcessoNutricionista: '' }));
    setCodigoAcessoNutricionista(codigoNormalizado);
    handleCadastro(codigoNormalizado);
  };

  const handleCancelarValidacaoEmailCadastro = () => {
    setModalValidacaoEmailVisible(false);
    setCodigoValidacaoEmail('');
    setErroCodigoValidacaoEmail('');
    setEmailPendenteCadastro('');
    setCodigoAcessoPendenteCadastro('');
    setValidandoEmailCadastro(false);
  };

  const handleReenviarCodigoValidacaoEmailCadastro = async () => {
    await solicitarValidacaoEmailCadastro(
      codigoAcessoPendenteCadastro || codigoAcessoNutricionista,
      { reenviar: true }
    );
  };

  const handleConfirmarValidacaoEmailCadastro = async () => {
    const codigoLimpo = codigoValidacaoEmail.replace(/\D/g, '');
    const emailLimpo = email.trim().toLowerCase();
    const emailValidado = emailPendenteCadastro || emailLimpo;

    if (codigoLimpo.length !== 6) {
      setErroCodigoValidacaoEmail('Digite o codigo de 6 digitos enviado por e-mail.');
      return;
    }

    setErroCodigoValidacaoEmail('');
    setValidandoEmailCadastro(true);

    try {
      await confirmarCodigoValidacaoEmailCadastro({
        role,
        email: emailValidado,
        code: codigoLimpo,
      });

      if (emailLimpo !== emailValidado) {
        setErroCodigoValidacaoEmail(
          'O e-mail do formulario mudou. Solicite um novo codigo para validar o e-mail atual.'
        );
        return;
      }

      setModalValidacaoEmailVisible(false);
      setCodigoValidacaoEmail('');
      setErroCodigoValidacaoEmail('');

      await handleCadastro(
        codigoAcessoPendenteCadastro || codigoAcessoNutricionista,
        { emailValidado: true }
      );
    } catch (err) {
      setErroCodigoValidacaoEmail(
        err?.message || 'Codigo invalido. Confira o codigo enviado por e-mail.'
      );
    } finally {
      setValidandoEmailCadastro(false);
    }
  };

  const renderFieldError = (campo) =>
    fieldErrors[campo] ? (
      <Text style={styles.fieldErrorText}>{fieldErrors[campo]}</Text>
    ) : null;

  const renderPasswordRequirements = () => (
    <View style={styles.requirementsBox}>
      {passwordRequirements.map((item) => {
        const ativo = item.test(senha);

        return (
          <View key={item.key} style={styles.requirementItem}>
            <Ionicons
              name={ativo ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={ativo ? '#159365' : '#9CA3AF'}
            />
            <Text
              style={[
                styles.requirementText,
                ativo ? styles.requirementTextActive : null,
              ]}
            >
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );

  const getInputStyle = (campo, hasError, extraStyle = null) => [
    styles.input,
    extraStyle,
    hasError ? styles.inputError : null,
    focusedField === campo ? styles.inputFocused : null,
  ];

  const focarCampo = (campo) => setFocusedField(campo);

  const desfocarCampo = (campo, callback) => {
    setFocusedField((atual) => (atual === campo ? '' : atual));

    if (typeof callback === 'function') {
      callback();
    }
  };

  async function sincronizarPacienteGoogle(user) {
    try {
      return (await syncGooglePatientRecord(user)) || buildGooglePatientFallback(user);
    } catch (error) {
      console.log('Erro ao sincronizar paciente Google no cadastro =>', error);
      throw error;
    }
  }

  async function finalizarCadastroGoogleComUsuario(user) {
    const pacienteGoogle = await sincronizarPacienteGoogle(user);

    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'HomePaciente',
          params: {
            usuarioLogado: pacienteGoogle || user,
            loginSocial: true,
          },
        },
      ],
    });
  }

  function extrairTokensDaUrl(url) {
    let accessToken = null;
    let refreshToken = null;

    const parsed = Linking.parse(url);
    console.log('Linking.parse cadastro =>', parsed);

    if (parsed?.queryParams?.access_token) {
      accessToken = parsed.queryParams.access_token;
      refreshToken = parsed.queryParams.refresh_token;
    }

    if ((!accessToken || !refreshToken) && url.includes('#')) {
      const hashPart = url.split('#')[1];
      const hashParams = new URLSearchParams(hashPart);
      accessToken = accessToken || hashParams.get('access_token');
      refreshToken = refreshToken || hashParams.get('refresh_token');
    }

    return { accessToken, refreshToken };
  }

  async function handleGoogleCadastro() {
    if (!isPaciente) return;

    try {
      googleSessionHandledRef.current = false;
      setFeedbackCadastro(null);
      setGoogleLoading(true);

      const redirectTo =
        Platform.OS === 'web'
          ? window.location.origin
          : AuthSession.makeRedirectUri({
              scheme: 'glicnutri',
              path: 'auth/callback',
            });

      console.log('redirectTo cadastro =>', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) {
        console.log('Erro OAuth Google no cadastro =>', error);
        Alert.alert('Erro no Google', error.message);
        return;
      }

      if (!data?.url) {
        Alert.alert('Erro', 'Nao foi possivel iniciar o cadastro com Google.');
        return;
      }

      if (Platform.OS === 'web') {
        window.location.href = data.url;
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      console.log('Resultado OAuth cadastro =>', result);

      if (result.type === 'cancel') {
        googleSessionHandledRef.current = false;
        return;
      }

      if (result.type !== 'success' || !result.url) {
        Alert.alert('Erro', 'Nao foi possivel concluir o cadastro com Google.');
        return;
      }

      const returnedUrl = result.url;
      console.log('URL retorno cadastro =>', returnedUrl);

      let { accessToken, refreshToken } = extrairTokensDaUrl(returnedUrl);

      console.log('accessToken cadastro =>', accessToken ? 'SIM' : 'NAO');
      console.log('refreshToken cadastro =>', refreshToken ? 'SIM' : 'NAO');

      if (accessToken && refreshToken) {
        const { data: sessionSetData, error: setSessionError } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

        console.log('setSession cadastro =>', {
          hasSession: !!sessionSetData?.session,
          userId: sessionSetData?.session?.user?.id || null,
          error: setSessionError?.message || null,
        });

        if (setSessionError) {
          Alert.alert('Erro', setSessionError.message);
          return;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 800));

      const { data: finalSessionData, error: finalSessionError } =
        await supabase.auth.getSession();

      console.log('Sessao final cadastro =>', {
        hasSession: !!finalSessionData?.session,
        userId: finalSessionData?.session?.user?.id || null,
        error: finalSessionError?.message || null,
      });

      if (finalSessionData?.session?.user) {
        googleSessionHandledRef.current = true;
        await finalizarCadastroGoogleComUsuario(finalSessionData.session.user);
        return;
      }

      Alert.alert(
        'Atencao',
        'O Google voltou para o app, mas o Supabase nao criou a sessao.'
      );
    } catch (error) {
      console.log('Erro cadastro Google =>', error);
      googleSessionHandledRef.current = false;
      Alert.alert('Erro', 'Falha ao cadastrar com Google.');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS === 'web' && styles.webScrollContent,
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

            <SeletorPerfil role={role} onChangeRole={trocarPerfil} />

            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={getInputStyle('nome', fieldErrors.nome)}
              value={nome}
              onChangeText={(valor) => {
                const nomeFormatado = formatarNome(valor);
                setNome(nomeFormatado);
                setFeedbackCadastro(null);
                atualizarErroCampoCadastro('nome', {
                  overrides: { nome: nomeFormatado },
                });
              }}
              onFocus={() => focarCampo('nome')}
              onBlur={() => desfocarCampo('nome')}
              placeholder="Ex: Joao Silva"
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
            {renderFieldError('nome')}

            <Text style={styles.label}>{isPaciente ? 'CPF' : 'CRN/UF'}</Text>
            <TextInput
              style={getInputStyle('documento', fieldErrors.documento)}
              value={documento}
              onChangeText={(valor) => {
                if (isPaciente) {
                  setDocumento(formatarCpf(valor));
                } else {
                  setDocumento(formatarCrn(valor));
                }
                setFeedbackCadastro(null);
                atualizarErroCampoCadastro('documento', {
                  overrides: { documento: isPaciente ? formatarCpf(valor) : formatarCrn(valor) },
                });
              }}
              placeholder={isPaciente ? '000.000.000-00' : '12345/SP'}
              placeholderTextColor="#999"
              keyboardType={isPaciente ? 'numeric' : 'default'}
              autoCapitalize="characters"
              maxLength={isPaciente ? 14 : 8}
              onFocus={() => focarCampo('documento')}
              onBlur={() => desfocarCampo('documento')}
            />
            {renderFieldError('documento')}

            {isPaciente ? (
              <>
                <Text style={styles.label}>CEP</Text>
                <TextInput
                  style={getInputStyle('cep', fieldErrors.cep)}
                  value={cep}
                  onChangeText={(valor) => {
                    const cepFormatado = formatarCep(valor);
                    setCep(cepFormatado);
                    setFeedbackCadastro(null);
                    atualizarErroCampoCadastro('cep', {
                      overrides: { cep: cepFormatado },
                    });
                  }}
                  onFocus={() => focarCampo('cep')}
                  onBlur={() => desfocarCampo('cep', buscarEnderecoPorCep)}
                  placeholder="00000-000"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={9}
                />
                {renderFieldError('cep')}

                <Text style={styles.label}>Logradouro</Text>
                <TextInput
                  style={getInputStyle('logradouro', fieldErrors.logradouro)}
                  value={logradouro}
                  onChangeText={(valor) => {
                    setLogradouro(valor);
                    atualizarErroCampoCadastro('logradouro', {
                      overrides: { logradouro: valor },
                    });
                  }}
                  onFocus={() => focarCampo('logradouro')}
                  onBlur={() => desfocarCampo('logradouro')}
                  placeholder="Rua, avenida..."
                  placeholderTextColor="#999"
                />
                {renderFieldError('logradouro')}

                <Text style={styles.label}>Numero</Text>
                <TextInput
                  style={getInputStyle('numero', fieldErrors.numero)}
                  value={numero}
                  onChangeText={(valor) => {
                    setNumero(valor);
                    atualizarErroCampoCadastro('numero', {
                      overrides: { numero: valor },
                    });
                  }}
                  onFocus={() => focarCampo('numero')}
                  onBlur={() => desfocarCampo('numero')}
                  placeholder="123"
                  placeholderTextColor="#999"
                />
                {renderFieldError('numero')}

                <Text style={styles.label}>Bairro</Text>
                <TextInput
                  style={getInputStyle('bairro', fieldErrors.bairro)}
                  value={bairro}
                  onChangeText={(valor) => {
                    setBairro(valor);
                    atualizarErroCampoCadastro('bairro', {
                      overrides: { bairro: valor },
                    });
                  }}
                  onFocus={() => focarCampo('bairro')}
                  onBlur={() => desfocarCampo('bairro')}
                  placeholder="Seu bairro"
                  placeholderTextColor="#999"
                />
                {renderFieldError('bairro')}

                <View style={styles.row}>
                  <View style={styles.cityContainer}>
                    <Text style={styles.label}>Cidade</Text>
                    <TextInput
                      style={getInputStyle('cidade', fieldErrors.cidade)}
                      value={cidade}
                      onChangeText={(valor) => {
                        setCidade(valor);
                        atualizarErroCampoCadastro('cidade', {
                          overrides: { cidade: valor },
                        });
                      }}
                      onFocus={() => focarCampo('cidade')}
                      onBlur={() => desfocarCampo('cidade')}
                      placeholder="Sua cidade"
                      placeholderTextColor="#999"
                    />
                    {renderFieldError('cidade')}
                  </View>

                  <View style={styles.ufContainer}>
                    <Text style={styles.label}>UF</Text>
                    <TextInput
                      style={getInputStyle('uf', fieldErrors.uf)}
                      value={uf}
                      onChangeText={(valor) => {
                        setUf(valor.toUpperCase());
                        atualizarErroCampoCadastro('uf', {
                          overrides: { uf: valor.toUpperCase() },
                        });
                      }}
                      onFocus={() => focarCampo('uf')}
                      onBlur={() => desfocarCampo('uf')}
                      placeholder="SP"
                      placeholderTextColor="#999"
                      maxLength={2}
                      autoCapitalize="characters"
                    />
                    {renderFieldError('uf')}
                  </View>
                </View>
              </>
            ) : null}

            <Text style={styles.label}>
              {isPaciente ? 'Genero' : 'Genero (opcional)'}
            </Text>
            <TouchableOpacity
              style={[
                styles.inputPicker,
                fieldErrors.genero ? styles.inputPickerError : null,
              ]}
              onPress={() => setModalVisible(true)}
            >
              <Text style={{ color: genero ? '#333' : '#999' }}>
                {genero || 'Selecione'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#999" />
            </TouchableOpacity>
            {renderFieldError('genero')}

            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={getInputStyle('email', fieldErrors.email)}
              value={email}
              onChangeText={(valor) => {
                setEmail(valor);
                atualizarErroCampoCadastro('email', {
                  overrides: { email: valor },
                });
              }}
              onFocus={() => focarCampo('email')}
              onBlur={() => desfocarCampo('email')}
              autoCapitalize="none"
              placeholder="exemplo@email.com"
              keyboardType="email-address"
              placeholderTextColor="#999"
            />
            {renderFieldError('email')}
            <Text style={styles.helperText}>
              Enviaremos um codigo para validar este e-mail antes de criar a conta.
            </Text>

            <Text style={styles.label}>Senha</Text>
            <CampoSenha
              wrapperStyle={styles.passwordInputWrapper}
              inputStyle={styles.passwordInput}
              invalid={!!fieldErrors.senha}
              invalidStyle={styles.inputError}
              value={senha}
              onChangeText={(valor) => {
                setSenha(valor);
                atualizarErroCampoCadastro('senha', {
                  overrides: { senha: valor },
                });
                atualizarErroCampoCadastro('confirmarSenha', {
                  overrides: { senha: valor },
                });
              }}
              placeholder="Crie uma senha"
              placeholderTextColor="#999"
              autoComplete="new-password"
              textContentType="newPassword"
              onFocus={() => setSenhaFocada(true)}
              onBlur={() => setSenhaFocada(false)}
            />
            {renderFieldError('senha')}
            {senhaFocada ? renderPasswordRequirements() : null}

            <Text style={styles.label}>Confirmar Senha</Text>
            <CampoSenha
              wrapperStyle={styles.passwordInputWrapper}
              inputStyle={styles.passwordInput}
              invalid={!!fieldErrors.confirmarSenha}
              invalidStyle={styles.inputError}
              value={confirmarSenha}
              onChangeText={(valor) => {
                setConfirmarSenha(valor);
                atualizarErroCampoCadastro('confirmarSenha', {
                  overrides: { confirmarSenha: valor },
                });
              }}
              placeholder="Repita a senha"
              placeholderTextColor="#999"
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {renderFieldError('confirmarSenha')}

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => {
                setAceitouLgpd(!aceitouLgpd);
                atualizarErroCampoCadastro('aceitouLgpd', {
                  overrides: { aceitouLgpd: !aceitouLgpd },
                });
              }}
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
            {fieldErrors.aceitouLgpd ? (
              <Text style={styles.checkboxErrorText}>{fieldErrors.aceitouLgpd}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.button,
                (!formularioValido || googleLoading) ? styles.buttonInactive : null,
              ]}
              onPress={handlePressCadastrar}
              disabled={!formularioValido || googleLoading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Cadastrar</Text>
              )}
            </TouchableOpacity>

            {isPaciente ? (
              <>
                <View style={styles.dividerContainer}>
                  <View style={styles.divider} />
                  <Text style={styles.dividerText}>ou</Text>
                  <View style={styles.divider} />
                </View>

                <TouchableOpacity
                  style={[
                    styles.googleButton,
                    googleLoading ? styles.googleButtonLoading : null,
                  ]}
                  onPress={handleGoogleCadastro}
                  disabled={googleLoading || loading}
                >
                  {googleLoading ? (
                    <ActivityIndicator color="#333" />
                  ) : (
                    <View style={styles.googleButtonContent}>
                      <View style={styles.googleBadge}>
                        <Image
                          source={googleLogo}
                          style={styles.googleLogo}
                          resizeMode="contain"
                        />
                      </View>
                      <Text style={styles.googleButtonText}>
                        Continuar com Google
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            ) : null}

            {feedbackCadastro?.tipo === 'erro' ? (
              <View
                style={[
                  styles.feedbackBox,
                  styles.feedbackBoxErro,
                ]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    styles.feedbackTextErro,
                  ]}
                >
                  {feedbackCadastro.texto}
                </Text>
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
                        atualizarErroCampoCadastro('genero', {
                          overrides: { genero: item },
                        });
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
                    style={getInputStyle(
                      'codigoAcessoNutricionista',
                      erroCodigoAcesso || fieldErrors.codigoAcessoNutricionista
                    )}
                    value={codigoAcessoNutricionista}
                    onChangeText={(valor) =>
                      {
                        setCodigoAcessoNutricionista(
                          normalizeNutritionistAccessCode(valor)
                        );
                        setErroCodigoAcesso('');
                        atualizarErroCampoCadastro('codigoAcessoNutricionista', {
                          codigoAcessoInformado: normalizeNutritionistAccessCode(valor),
                        });
                      }
                    }
                    placeholder="Digite o codigo"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    onFocus={() => focarCampo('codigoAcessoNutricionista')}
                    onBlur={() => desfocarCampo('codigoAcessoNutricionista')}
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
                        setFieldErrors((atual) => ({
                          ...atual,
                          codigoAcessoNutricionista: '',
                        }));
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

        <Modal
          visible={modalValidacaoEmailVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCancelarValidacaoEmailCadastro}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.emailModalCard}>
              <Text style={styles.emailModalTitle}>Codigo enviado</Text>
              <Text style={styles.emailModalText}>
                Digite o codigo de 6 digitos enviado para{' '}
                {emailPendenteCadastro || email.trim().toLowerCase()}.
              </Text>

              <TextInput
                style={getInputStyle(
                  'codigoValidacaoEmail',
                  erroCodigoValidacaoEmail,
                  styles.codeInput
                )}
                value={codigoValidacaoEmail}
                onChangeText={(valor) => {
                  setCodigoValidacaoEmail(valor.replace(/\D/g, '').slice(0, 6));
                  setErroCodigoValidacaoEmail('');
                }}
                onFocus={() => focarCampo('codigoValidacaoEmail')}
                onBlur={() => desfocarCampo('codigoValidacaoEmail')}
                placeholder="000000"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading && !validandoEmailCadastro}
              />

              {erroCodigoValidacaoEmail ? (
                <Text style={styles.codeErrorText}>{erroCodigoValidacaoEmail}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.emailModalPrimaryButton,
                  (validandoEmailCadastro || loading) && styles.buttonDisabled,
                ]}
                onPress={handleConfirmarValidacaoEmailCadastro}
                disabled={validandoEmailCadastro || loading}
              >
                {validandoEmailCadastro ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Cadastrar</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.emailModalSecondaryButton}
                onPress={handleReenviarCodigoValidacaoEmailCadastro}
                disabled={validandoEmailCadastro || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#4fdfa3" />
                ) : (
                  <Text style={styles.emailModalSecondaryButtonText}>
                    Reenviar codigo
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.emailModalCancelButton}
                onPress={handleCancelarValidacaoEmailCadastro}
                disabled={validandoEmailCadastro}
              >
                <Text style={styles.emailModalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={modalCadastroSucessoVisible} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.emailModalCard}>
                  <Ionicons
                    name="checkmark-circle"
                    size={46}
                    color="#159365"
                    style={styles.modalSuccessIcon}
                  />
                  <Text style={styles.emailModalTitle}>Cadastro validado</Text>
                  <Text style={styles.emailModalText}>
                    {mensagemCadastroSucesso}
                  </Text>

                  <TouchableOpacity
                    style={styles.emailModalPrimaryButton}
                    onPress={() => {
                      setModalCadastroSucessoVisible(false);
                      navigation.navigate('Login', {
                        roleInicial: role,
                      });
                    }}
                  >
                    <Text style={styles.buttonText}>Ir para login</Text>
                  </TouchableOpacity>
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
    borderRadius: 15,
    padding: 12,
    marginBottom: 15,
    color: '#333',
    backgroundColor: '#ffffff',
    ...softGreenBorder,
  },
  codeInput: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  inputError: {
    borderColor: '#d96666',
  },
  inputFocused: {
    ...inputFocusBorder,
  },
  passwordInputWrapper: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 15,
    marginBottom: 15,
    backgroundColor: '#ffffff',
    position: 'relative',
    ...softGreenBorder,
  },
  passwordInput: {
    color: '#333',
    paddingHorizontal: 12,
    paddingRight: 48,
    paddingVertical: 12,
  },
  fieldErrorText: {
    marginTop: -8,
    marginBottom: 12,
    color: '#c35a5a',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  helperText: {
    marginTop: -8,
    marginBottom: 14,
    color: '#686d71',
    fontSize: 12,
    lineHeight: 17,
  },
  requirementsBox: {
    marginBottom: 14,
    marginTop: -7,
  },
  requirementItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginBottom: 5,
  },
  requirementText: {
    color: '#686d71',
    fontSize: 12,
    lineHeight: 17,
  },
  requirementTextActive: {
    color: '#159365',
    fontWeight: '700',
  },
  inputPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 15,
    padding: 12,
    marginBottom: 15,
    backgroundColor: '#ffffff',
    ...softGreenBorder,
  },
  inputPickerError: {
    borderColor: '#d96666',
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
  checkboxErrorText: {
    marginTop: -6,
    marginBottom: 12,
    color: '#c35a5a',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  button: {
    backgroundColor: 'rgb(79, 223, 163)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    opacity: 1,
    marginTop: 10,
    transitionDuration: '0s',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonInactive: {
    backgroundColor: 'rgb(174, 182, 191)',
    opacity: 1,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
    lineHeight: 20,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 4,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#7f8c8d',
    fontSize: 12,
    fontWeight: '600',
  },
  googleButton: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dcdcdc',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    ...softGreenBorder,
  },
  googleButtonLoading: {
    opacity: 0.7,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  googleLogo: {
    width: 18,
    height: 18,
  },
  googleButtonText: {
    color: '#3c4043',
    fontWeight: '600',
    fontSize: 15,
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
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#f4f4f4',
    width: '85%',
    borderRadius: 15,
    padding: 20,
    ...softGreenBorder,
  },
  emailModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 22,
  },
  emailModalTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  emailModalText: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  codeErrorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
    marginTop: -8,
    textAlign: 'center',
  },
  emailModalPrimaryButton: {
    backgroundColor: 'rgb(79, 223, 163)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    opacity: 1,
    transitionDuration: '0s',
  },
  emailModalSecondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4fdfa3',
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 10,
  },
  emailModalSecondaryButtonText: {
    color: '#159365',
    fontSize: 15,
    fontWeight: '700',
  },
  emailModalCancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  emailModalCancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
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
  modalInfoBox: {
    alignItems: 'center',
    backgroundColor: '#e9fbf3',
    borderColor: '#4fdfa3',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalInfoText: {
    color: '#256f51',
    fontSize: 14,
    fontWeight: '700',
  },
  modalSuccessIcon: {
    alignSelf: 'center',
    marginBottom: 8,
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
  modalActionDisabled: {
    opacity: 0.6,
  },
  modalConfirmButton: {
    alignSelf: 'stretch',
    flex: 0,
    marginTop: 10,
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
