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
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../servicos/configSupabase';
import {
  buildGooglePatientFallback,
  syncGooglePatientRecord,
} from '../../servicos/sincronizarPacienteGoogle';
import {
  maybeCompleteGoogleOAuthSession,
  startGoogleOAuth,
} from '../../servicos/servicoOAuthGoogle';
import { hasPatientOnboardingSeen } from '../../servicos/servicoOnboardingPaciente';
import SeletorPerfil from '../../componentes/comum/SeletorPerfil';
import CampoSenha from '../../componentes/comum/CampoSenha';
import { inputFocusBorder } from '../../temas/temaFocoCampo';
import { useKeyboardAwareScroll } from '../../utilitarios/rolagemComTeclado';
import {
  isValidNutritionistAccessCode,
  normalizeNutritionistAccessCode,
} from '../../configuracoes/configAcessoNutricionista';
import {
  getPasswordValidationMessage,
  passwordRequirements,
} from '../../utilitarios/requisitosSenha';
import { shouldDisableIOSPasswordAutofill } from '../../utilitarios/preenchimentoAutomaticoPlataforma';
import {
  confirmarCodigoValidacaoEmailCadastro,
  solicitarCodigoValidacaoEmailCadastro,
} from '../../servicos/servicoVerificacaoEmail';
import { registrarLogAuditoria } from '../../servicos/servicoAuditoria';

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

const googleLogo = {
  uri: 'https://img.icons8.com/?size=100&id=xoyhGXWmHnqX&format=png&color=000000',
};

const AUTH_WEB_MAX_WIDTH = 440;
const AUTH_ACCENT_GREEN = '#24d393';

function createCadastroFieldErrors() {
  return {
    nome: '',
    documento: '',
    dataNascimento: '',
    genero: '',
    email: '',
    senha: '',
    confirmarSenha: '',
    aceitouLgpd: '',
    codigoAcessoNutricionista: '',
  };
}

export default function TelaCadastroFixed({ navigation, route }) {
  const roleInicial =
    route?.params?.roleInicial === 'Nutricionista' ? 'Nutricionista' : 'Paciente';

  const [role, setRole] = useState(roleInicial);
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [genero, setGenero] = useState('');
  const [cpfInfoAberto, setCpfInfoAberto] = useState(false);
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

  const {
    scrollViewRef,
    registerScrollContainer,
    registerFieldLayout,
    scrollToField,
  } = useKeyboardAwareScroll({ topOffset: 115 });
  const googleSessionHandledRef = useRef(false);
  const opcoesGenero = ['Masculino', 'Feminino', 'Não binário', 'Prefiro não informar'];
  const isPaciente = role === 'Paciente';
  const desativarAutofillIOS = shouldDisableIOSPasswordAutofill();
  const senhaCadastroValida = passwordRequirements.every((item) => item.test(senha));
  const confirmacaoSenhaValida = confirmarSenha.trim() !== '' && senha === confirmarSenha;

  useEffect(() => {
    setRole(roleInicial);
    setFeedbackCadastro(null);
    limparErrosCamposCadastro();
  }, [roleInicial]);

  useEffect(() => {
    maybeCompleteGoogleOAuthSession();
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
      dataNascimento.trim() !== '' &&
      !validarMensagemDataNascimento(dataNascimento) &&
      genero.trim() !== '' &&
      email.trim() !== '' &&
      senhaCadastroValida &&
      confirmacaoSenhaValida &&
      aceitouLgpd &&
      !loading
    : nome.trim() !== '' &&
      documento.trim() !== '' &&
      dataNascimento.trim() !== '' &&
      !validarMensagemDataNascimento(dataNascimento) &&
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
    setDataNascimento('');
    setGenero('');
    setCpfInfoAberto(false);
    setEmail('');
    setSenha('');
    setConfirmarSenha('');
    setSenhaFocada(false);
    setFocusedField('');
    setCodigoAcessoNutricionista('');
    setAceitouLgpd(false);
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

  const formatarDataNascimento = (valor) => {
    const numeros = valor.replace(/\D/g, '').slice(0, 8);

    return numeros
      .replace(/^(\d{2})(\d)/, '$1/$2')
      .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
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

  function obterDataNascimentoValidada(valor) {
    const numeros = valor.replace(/\D/g, '');

    if (numeros.length !== 8) return null;

    const dia = Number(numeros.slice(0, 2));
    const mes = Number(numeros.slice(2, 4));
    const ano = Number(numeros.slice(4, 8));
    const data = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (
      ano < 1900 ||
      data.getFullYear() !== ano ||
      data.getMonth() !== mes - 1 ||
      data.getDate() !== dia ||
      data > hoje
    ) {
      return null;
    }

    return {
      data,
      banco: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    };
  }

  function validarMensagemDataNascimento(valor) {
    const dataLimpa = valor.trim();

    if (!dataLimpa) return 'Informe a data de nascimento.';
    if (dataLimpa.replace(/\D/g, '').length !== 8) {
      return 'Digite a data no formato dd/mm/aaaa.';
    }

    return obterDataNascimentoValidada(dataLimpa)
      ? ''
      : 'Digite uma data de nascimento valida.';
  }

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
    const dataNascimentoValor = overrides.dataNascimento ?? dataNascimento;
    const generoValor = overrides.genero ?? genero;
    const emailValor = overrides.email ?? email;
    const senhaValor = overrides.senha ?? senha;
    const confirmarSenhaValor = overrides.confirmarSenha ?? confirmarSenha;
    const aceitouLgpdValor = overrides.aceitouLgpd ?? aceitouLgpd;

    const nomeLimpo = nomeValor.trim();
    const documentoBruto = documentoValor.trim();
    const documentoFormatado = isPaciente
      ? documentoValor.replace(/\D/g, '')
      : formatarCrn(documentoValor);
    const emailLimpo = emailValor.trim().toLowerCase();
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
      case 'dataNascimento':
        return validarMensagemDataNascimento(dataNascimentoValor);
      case 'genero':
        return isPaciente && !generoValor ? 'Selecione o gênero do paciente.' : '';
      case 'email':
        if (!emailLimpo) return 'Informe o e-mail.';
        return !validarEmail(emailLimpo) ? 'Digite um e-mail valido.' : '';
      case 'senha':
        return getPasswordValidationMessage(senhaValor, 'Informe a senha.');
      case 'confirmarSenha':
        if (!confirmarSenhaValor) return 'Confirme a senha.';
        return senhaValor !== confirmarSenhaValor ? 'As senhas nao coincidem.' : '';
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
          'dataNascimento',
          'genero',
          'email',
          'senha',
          'confirmarSenha',
          'aceitouLgpd',
        ]
      : [
          'nome',
          'documento',
          'dataNascimento',
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

  const campoCadastroTemValor = (campo, overrides = {}) => {
    const valorCampo = {
      nome: overrides.nome ?? nome,
      documento: overrides.documento ?? documento,
      dataNascimento: overrides.dataNascimento ?? dataNascimento,
      genero: overrides.genero ?? genero,
      email: overrides.email ?? email,
      senha: overrides.senha ?? senha,
      confirmarSenha: overrides.confirmarSenha ?? confirmarSenha,
      codigoAcessoNutricionista:
        overrides.codigoAcessoNutricionista ?? codigoAcessoNutricionista,
    }[campo];

    if (campo === 'aceitouLgpd') {
      return true;
    }

    return String(valorCampo || '').trim() !== '';
  };

  const atualizarErroCampoCadastro = (campo, opcoes = {}) => {
    setFieldErrors((atual) => {
      const overrides = { ...(opcoes.overrides || {}) };
      if (
        campo === 'codigoAcessoNutricionista' &&
        opcoes.codigoAcessoInformado !== undefined
      ) {
        overrides.codigoAcessoNutricionista = opcoes.codigoAcessoInformado;
      }
      const deveValidarCampo =
        !!atual[campo] || campoCadastroTemValor(campo, overrides);

      if (!deveValidarCampo) {
        return atual;
      }

      return {
        ...atual,
        [campo]: validarCampoCadastro(campo, opcoes),
      };
    });
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

  const handleCadastro = async (
    codigoAcessoInformado = codigoAcessoNutricionista,
    { emailValidado = false } = {}
  ) => {
    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim().toLowerCase();
    const documentoFormatado = normalizarDocumento();
    const dataNascimentoBanco = obterDataNascimentoValidada(dataNascimento)?.banco || null;
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
          data_nascimento: dataNascimentoBanco,
          cep: '00000000',
          logradouro: 'Nao informado',
          numero: '0',
          bairro: 'Nao informado',
          cidade: 'Nao informada',
          uf: 'NI',
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

        await registrarLogAuditoria({
          actor: data,
          targetPatientId: data.id_paciente_uuid,
          action: 'paciente_cadastrado',
          entity: 'paciente',
          entityId: data.id_paciente_uuid,
          origin: 'cadastro',
          details: {
            metodo: 'email_senha',
            email: data.email_pac,
          },
        });

        console.log('Paciente salvo com sucesso:', data);
      } else {
        await verificarDuplicidadeNutricionista(documentoFormatado, emailLimpo);

        const objetoCadastro = {
          nome_completo_nutri: nomeLimpo,
          crm_numero: documentoFormatado,
          email_acesso: emailLimpo,
          senha_nutri: senha,
          data_nascimento: dataNascimentoBanco,
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

        await registrarLogAuditoria({
          actor: data,
          actorType: 'nutricionista',
          action: 'nutricionista_cadastrado',
          entity: 'nutricionista',
          entityId: data.id_nutricionista_uuid,
          origin: 'cadastro',
          details: {
            metodo: 'email_senha',
            email: data.email_acesso,
          },
        });

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

  const focarCampo = (campo) => {
    setFocusedField(campo);
    scrollToField(campo);
  };

  const desfocarCampo = (campo, callback) => {
    setFocusedField((atual) => (atual === campo ? '' : atual));

    if (typeof callback === 'function') {
      callback();
    }
  };

  const handleChangeEmailCadastro = (valor = '') => {
    const emailMinusculo = String(valor).toLowerCase();

    setEmail(emailMinusculo);
    setFeedbackCadastro(null);
    atualizarErroCampoCadastro('email', {
      overrides: { email: emailMinusculo },
    });
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
    const usuarioPaciente = pacienteGoogle || user;
    const rotaDestino = (await hasPatientOnboardingSeen(usuarioPaciente))
      ? 'HomePaciente'
      : 'PacienteOnboarding';

    navigation.reset({
      index: 0,
      routes: [
        {
          name: rotaDestino,
          params: {
            usuarioLogado: usuarioPaciente,
            loginSocial: true,
          },
        },
      ],
    });
  }

  async function handleGoogleCadastro() {
    if (!isPaciente) return;

    try {
      googleSessionHandledRef.current = false;
      setFeedbackCadastro(null);
      setGoogleLoading(true);

      const { cancelled, redirected, session: googleSession } = await startGoogleOAuth();

      if (cancelled) {
        googleSessionHandledRef.current = false;
        return;
      }

      if (redirected) {
        return;
      }

      const finalSession = googleSession || (await supabase.auth.getSession()).data?.session;

      if (finalSession?.user) {
        googleSessionHandledRef.current = true;
        await finalizarCadastroGoogleComUsuario(finalSession.user);
        return;
      }

      Alert.alert(
        'Atencao',
        'O Google voltou para o app, mas o Supabase nao criou a sessao.'
      );
    } catch (error) {
      console.log('Erro cadastro Google =>', error);
      googleSessionHandledRef.current = false;
      Alert.alert('Erro', error?.message || 'Falha ao cadastrar com Google.');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <SafeAreaView edges={Platform.OS === 'web' ? undefined : []} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
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
          <View
            style={[
              styles.authContent,
              Platform.OS === 'web' && styles.webAuthContentBox,
            ]}
          >
            <View style={styles.card} onLayout={registerScrollContainer}>
            <Text style={styles.title}>Crie sua conta</Text>

            <SeletorPerfil role={role} onChangeRole={trocarPerfil} />

            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={getInputStyle('nome', fieldErrors.nome)}
              value={nome}
              onLayout={registerFieldLayout('nome')}
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
              onLayout={registerFieldLayout('documento')}
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
                <TouchableOpacity
                  style={styles.cpfInfoToggle}
                  onPress={() => setCpfInfoAberto((atual) => !atual)}
                  activeOpacity={0.78}
                >
                  <Text style={styles.cpfInfoToggleText}>
                    Por que perguntamos seu CPF?
                  </Text>
                  <Ionicons
                    name={cpfInfoAberto ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={AUTH_ACCENT_GREEN}
                  />
                </TouchableOpacity>

                {cpfInfoAberto ? (
                  <View style={styles.cpfInfoBox}>
                    <Text style={styles.cpfInfoText}>
                      Solicitamos o CPF, visando promover a interoperabilidade com
                      programas de suporte a pacientes e prontuarios medicos,
                      utilizando-o como chave unica de identificacao. Alinhado as
                      praticas de privacidade e seguranca para seus dados.
                    </Text>
                  </View>
                ) : null}

              </>
            ) : null}

            <Text style={styles.label}>Data de nascimento</Text>
            <TextInput
              style={getInputStyle('dataNascimento', fieldErrors.dataNascimento)}
              value={dataNascimento}
              onLayout={registerFieldLayout('dataNascimento')}
              onChangeText={(valor) => {
                const dataFormatada = formatarDataNascimento(valor);
                setDataNascimento(dataFormatada);
                setFeedbackCadastro(null);
                atualizarErroCampoCadastro('dataNascimento', {
                  overrides: { dataNascimento: dataFormatada },
                });
              }}
              onFocus={() => focarCampo('dataNascimento')}
              onBlur={() => desfocarCampo('dataNascimento')}
              placeholder="dd/mm/aaaa"
              placeholderTextColor="#999"
              keyboardType="numeric"
              maxLength={10}
            />
            {renderFieldError('dataNascimento')}

            <Text style={styles.label}>
              {isPaciente ? 'Gênero' : 'Gênero (opcional)'}
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
              onLayout={registerFieldLayout('email')}
              onChangeText={handleChangeEmailCadastro}
              onChange={
                Platform.OS === 'web'
                  ? (event) =>
                      handleChangeEmailCadastro(
                        event?.nativeEvent?.text ?? event?.target?.value ?? ''
                      )
                  : undefined
              }
              onFocus={() => focarCampo('email')}
              onBlur={() => desfocarCampo('email')}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={desativarAutofillIOS ? 'one-time-code' : 'email'}
              importantForAutofill="no"
              placeholder="exemplo@email.com"
              keyboardType={Platform.OS === 'web' ? 'default' : 'email-address'}
              placeholderTextColor="#999"
              textContentType={desativarAutofillIOS ? 'oneTimeCode' : 'emailAddress'}
            />
            {renderFieldError('email')}
            <Text style={styles.helperText}>
              Enviaremos um codigo para validar este e-mail antes de criar a conta.
            </Text>

            <Text style={styles.label}>Senha</Text>
            <View onLayout={registerFieldLayout('senha')}>
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
                autoComplete={desativarAutofillIOS ? 'one-time-code' : 'new-password'}
                importantForAutofill="no"
                textContentType={desativarAutofillIOS ? 'oneTimeCode' : 'newPassword'}
                onFocus={() => {
                  setSenhaFocada(true);
                  focarCampo('senha');
                }}
                onBlur={() => {
                  setSenhaFocada(false);
                  desfocarCampo('senha');
                }}
              />
            </View>
            {renderFieldError('senha')}
            {senhaFocada ? renderPasswordRequirements() : null}

            <Text style={styles.label}>Confirmar Senha</Text>
            <View onLayout={registerFieldLayout('confirmarSenha')}>
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
                autoComplete={desativarAutofillIOS ? 'one-time-code' : 'new-password'}
                importantForAutofill="no"
                textContentType={desativarAutofillIOS ? 'oneTimeCode' : 'newPassword'}
                onFocus={() => focarCampo('confirmarSenha')}
                onBlur={() => desfocarCampo('confirmarSenha')}
              />
            </View>
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
          </View>
        </ScrollView>

        <Modal visible={modalVisible} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Gênero</Text>
                  <Text style={styles.modalDescription}>Como você se identifica?</Text>

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
          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
          >
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
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={modalValidacaoEmailVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCancelarValidacaoEmailCadastro}
        >
          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
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
                  const codigoLimpo = valor.replace(/\D/g, '').slice(0, 6);
                  setCodigoValidacaoEmail(codigoLimpo);
                  setErroCodigoValidacaoEmail(
                    codigoLimpo && codigoLimpo.length < 6
                      ? 'Digite os 6 digitos enviados por e-mail.'
                      : ''
                  );
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
          </KeyboardAvoidingView>
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
  modalKeyboard: { flex: 1 },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 180 },
  webScroll: {
    minHeight: '100vh',
    overflowY: 'visible',
    overflowX: 'hidden',
  },
  webScrollContent: {
    alignItems: 'center',
    flexGrow: 0,
    minHeight: '100%',
  },
  authContent: {
    width: '100%',
  },
  webAuthContentBox: {
    maxWidth: AUTH_WEB_MAX_WIDTH,
  },
  card: {
    backgroundColor: '#f4f4f4',
    borderRadius: 24,
    padding: 25,
    width: '100%',
    ...softGreenBorder,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: AUTH_ACCENT_GREEN,
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
    borderColor: '#4fdfa3',
    borderRadius: 20,
    borderWidth: 1,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    paddingVertical: 16,
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
  cpfInfoToggle: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    marginTop: -6,
    paddingVertical: 2,
  },
  cpfInfoToggleText: {
    color: AUTH_ACCENT_GREEN,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  cpfInfoBox: {
    backgroundColor: '#f7fefb',
    borderColor: AUTH_ACCENT_GREEN,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 15,
    marginTop: -4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cpfInfoText: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 18,
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
    width: '100%',
    maxWidth: 420,
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4fdfa3',
    alignItems: 'center',
    padding: 16,
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
