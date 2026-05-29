import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../servicos/configSupabase';
import {
  buildGooglePatientFallback,
  syncGooglePatientRecord,
} from '../../servicos/sincronizarPacienteGoogle';
import { sanitizeSensitivePatientData } from '../../servicos/servicoDadosPaciente';
import {
  maybeCompleteGoogleOAuthSession,
  startGoogleOAuth,
} from '../../servicos/servicoOAuthGoogle';
import { hasPatientOnboardingSeen } from '../../servicos/servicoOnboardingPaciente';
import {
  limparSessaoAdmin,
  salvarSessaoAdmin,
  sanitizeAdminUser,
} from '../../servicos/servicoAdmin';
import {
  limparSessaoNutricionista,
  salvarSessaoNutricionista,
} from '../../servicos/servicoSessaoNutricionista';
import {
  limparSessaoMedico,
  salvarSessaoMedico,
  sanitizeMedicoUser,
} from '../../servicos/servicoSessaoMedico';
import { salvarSessaoPaciente } from '../../servicos/servicoSessaoPaciente';
import {
  emitirSessaoRpcOAuthPaciente,
  emitirSessaoRpcPosCredencial,
  limparRpcSessionToken,
} from '../../servicos/servicoSessaoRpc';
import { patientAppAlreadyActive } from '../../utilitarios/navegacaoPaciente';
import { registrarLogAuditoria } from '../../servicos/servicoAuditoria';
import SeletorPerfil from '../../componentes/comum/SeletorPerfil';
import CampoSenha from '../../componentes/comum/CampoSenha';
import { inputFocusBorder } from '../../temas/temaFocoCampo';
import { useKeyboardAwareScroll } from '../../utilitarios/rolagemComTeclado';
import { getPrivacyPolicyUrl } from '../../constantes/configPublicaApp';

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

const AUTH_WEB_MAX_WIDTH = 440;

const googleLogo = {
  uri: 'https://img.icons8.com/?size=100&id=xoyhGXWmHnqX&format=png&color=000000',
};

const ROLE_PROFISSIONAL = 'Profissional da Saúde';

export default function TelaLogin({ navigation, route, session }) {
  const isAdminAccess = route?.params?.roleInicial === 'Admin';
  const roleInicial =
    route?.params?.roleInicial === 'Admin'
      ? 'Admin'
      : route?.params?.roleInicial === 'Nutricionista' ||
          route?.params?.roleInicial === 'Medico' ||
          route?.params?.roleInicial === ROLE_PROFISSIONAL
        ? ROLE_PROFISSIONAL
      : 'Paciente';

  const [role, setRole] = useState(roleInicial);
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    identificador: '',
    senha: '',
  });
  const [focusedField, setFocusedField] = useState('');
  const googleSessionHandledRef = useRef(false);
  const {
    scrollViewRef,
    registerScrollContainer,
    registerFieldLayout,
    scrollToField,
  } = useKeyboardAwareScroll({ topOffset: 115 });

  useEffect(() => {
    setRole(roleInicial);
    setErrorMessage('');
    limparErrosCamposLogin();
  }, [roleInicial]);

  function limparErrosCamposLogin() {
    setFieldErrors({
      identificador: '',
      senha: '',
    });
  }

  function focarCampoLogin(campo) {
    setFocusedField(campo);
    scrollToField(campo);
  }

  function desfocarCampoLogin(campo) {
    setFocusedField((atual) => (atual === campo ? '' : atual));
  }

  function validarEmail(valor) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(valor.trim().toLowerCase());
  }

  function validarCamposLogin({
    identificadorValor = identificador,
    senhaValor = senha,
  } = {}) {
    const proximosErros = {
      identificador: '',
      senha: '',
    };
    const identificadorLimpo = identificadorValor.trim();
    const senhaLimpa = senhaValor.trim();

    if (!identificadorLimpo) {
      proximosErros.identificador =
        role === ROLE_PROFISSIONAL
          ? 'Informe o e-mail cadastrado.'
          : 'Informe o e-mail cadastrado.';
    } else if (
      role === ROLE_PROFISSIONAL
        ? !validarEmail(identificadorLimpo)
        : !validarEmail(identificadorLimpo)
    ) {
      proximosErros.identificador =
        role === ROLE_PROFISSIONAL
          ? 'Digite um e-mail valido para continuar.'
          : 'Digite um e-mail valido para continuar.';
    }

    if (!senhaLimpa) {
      proximosErros.senha = 'Preencha a senha.';
    }

    return proximosErros;
  }

  function temErrosCamposLogin(erros) {
    return Object.values(erros).some(Boolean);
  }

  function handleChangeIdentificador(valor) {
    const emailMinusculo = valor.toLowerCase();

    setErrorMessage('');
    setIdentificador(emailMinusculo);
    setFieldErrors((atual) => ({
      ...atual,
      identificador:
        emailMinusculo.trim() || atual.identificador
          ? validarCamposLogin({
              identificadorValor: emailMinusculo,
              senhaValor: senha,
            }).identificador
          : '',
    }));
  }

  async function buscarUsuarioPorCredenciais(
    perfil,
    identificadorInformado,
    senhaInformada
  ) {
    if (perfil === ROLE_PROFISSIONAL) {
      const medicoResult = await buscarUsuarioPorCredenciais(
        'Medico',
        identificadorInformado,
        senhaInformada
      );

      if (medicoResult.usuario) {
        return medicoResult;
      }

      const nutriResult = await buscarUsuarioPorCredenciais(
        'Nutricionista',
        identificadorInformado,
        senhaInformada
      );

      if (nutriResult.usuario) {
        return nutriResult;
      }

      return {
        usuario: null,
        motivo:
          medicoResult.motivo === 'senha_incorreta' || nutriResult.motivo === 'senha_incorreta'
            ? 'senha_incorreta'
            : 'usuario_nao_encontrado',
      };
    }

    if (perfil === 'Medico') {
      const { data, error } = await supabase.rpc('verificar_login_medico', {
        p_identificador: identificadorInformado.trim(),
        p_senha: senhaInformada,
      });
      if (error) throw error;
      const usuarioEncontrado = Array.isArray(data) ? data[0] : data;
      if (usuarioEncontrado) {
        return {
          usuario: sanitizeMedicoUser({ ...usuarioEncontrado, tipo_perfil: 'medico' }),
          motivo: '',
        };
      }
      return { usuario: null, motivo: 'usuario_nao_encontrado' };
    }

    const tabela =
      perfil === 'Paciente'
        ? 'paciente'
        : perfil === 'Nutricionista'
          ? 'nutricionista'
          : 'administrador';
    const colunaEmail =
      perfil === 'Paciente' ? 'email_pac' : 'email_acesso';
    const colunaId =
      perfil === 'Paciente'
        ? 'id_paciente_uuid'
        : perfil === 'Nutricionista'
          ? 'id_nutricionista_uuid'
          : 'id_admin_uuid';
    const funcaoLogin =
      perfil === 'Paciente'
        ? 'verificar_login_paciente'
        : perfil === 'Nutricionista'
          ? 'verificar_login_nutricionista'
          : 'verificar_login_admin';

    const emailNormalizado = identificadorInformado.trim().toLowerCase();
    const senhaNormalizada = senhaInformada.trim();

    async function verificarExistenciaUsuario() {
      const { data, error } = await supabase
        .from(tabela)
        .select(colunaId)
        .ilike(colunaEmail, emailNormalizado)
        .limit(1);

      if (error) throw error;

      return (data || []).length > 0;
    }

    try {
      const { data, error } = await supabase.rpc(funcaoLogin, {
        p_identificador: emailNormalizado,
        p_senha: senhaNormalizada,
      });

      if (error) throw error;

      const usuarioEncontrado = Array.isArray(data) ? data[0] : data;

      if (usuarioEncontrado) {
        const usuarioSanitizado =
          perfil === 'Admin'
            ? sanitizeAdminUser({
                ...usuarioEncontrado,
                tipo_perfil: 'admin',
              })
            : sanitizeSensitivePatientData({
                ...usuarioEncontrado,
                tipo_perfil: perfil.toLowerCase(),
              });

        return {
          usuario: usuarioSanitizado,
          motivo: '',
        };
      }

      return {
        usuario: null,
        motivo: (await verificarExistenciaUsuario())
          ? 'senha_incorreta'
          : 'usuario_nao_encontrado',
      };
    } catch (error) {
      const mensagem = String(error?.message || '').toLowerCase();
      const funcaoNaoExiste =
        mensagem.includes(funcaoLogin.toLowerCase()) ||
        mensagem.includes('could not find the function') ||
        mensagem.includes('schema cache') ||
        mensagem.includes('does not exist');

      if (funcaoNaoExiste) {
        throw new Error(
          'A verificacao segura de senha nao esta disponivel no banco. Aplique a migracao de hash antes de liberar login por senha.'
        );
      }

      throw error;
    }
  }

  async function buscarAdminPorCredenciais(identificadorInformado, senhaInformada) {
    const emailNormalizado = identificadorInformado.trim().toLowerCase();
    const senhaNormalizada = senhaInformada.trim();

    try {
      const { data, error } = await supabase.rpc('verificar_login_admin', {
        p_identificador: emailNormalizado,
        p_senha: senhaNormalizada,
      });

      if (error) throw error;

      const usuarioEncontrado = Array.isArray(data) ? data[0] : data;

      if (!usuarioEncontrado) {
        return null;
      }

      return sanitizeAdminUser({
        ...usuarioEncontrado,
        tipo_perfil: 'admin',
      });
    } catch (error) {
      const mensagem = String(error?.message || '').toLowerCase();
      const funcaoNaoExiste =
        mensagem.includes('verificar_login_admin') ||
        mensagem.includes('could not find the function') ||
        mensagem.includes('schema cache') ||
        mensagem.includes('does not exist');

      if (funcaoNaoExiste) {
        return null;
      }

      throw error;
    }
  }

  useEffect(() => {
    maybeCompleteGoogleOAuthSession();
  }, []);

  async function handleLogin() {
    const errosFormulario = validarCamposLogin();
    setFieldErrors(errosFormulario);

    if (temErrosCamposLogin(errosFormulario)) {
      setErrorMessage('');
      return;
    }

    limparErrosCamposLogin();
    setErrorMessage('');
    setLoading(true);

    try {
      let { usuario, motivo } = await buscarUsuarioPorCredenciais(
        role,
        identificador,
        senha
      );

      if (!usuario) {
        const adminUser = await buscarAdminPorCredenciais(identificador, senha);

        if (adminUser) {
          usuario = adminUser;
          motivo = '';
        }
      }

      if (!usuario) {
        registrarLogAuditoria({
          actor: null,
          actorType: role === 'Paciente' ? 'paciente' : 'anonimo',
          action: 'login_falha_credencial',
          entity: 'sessao',
          entityId: null,
          origin: 'login',
          status: 'falha',
          details: {
            motivo: motivo || 'credencial_invalida',
            perfilSelecionado: role,
          },
        });
        setFieldErrors({
          identificador:
            motivo === 'senha_incorreta'
              ? ''
              : role === 'Paciente'
                ? 'Paciente nao encontrado. Confira o e-mail informado.'
                : role === ROLE_PROFISSIONAL
                  ? 'Profissional da saúde nao encontrado. Confira o e-mail informado.'
                  : 'Administrador nao encontrado. Confira o e-mail informado.',
          senha:
            motivo === 'senha_incorreta'
              ? 'Senha incorreta. Confira a senha digitada e tente novamente.'
              : '',
        });
        return;
      }

      await limparSessaoAdmin();
      await limparSessaoNutricionista();
      await limparSessaoMedico();
      await limparRpcSessionToken();

      if (usuario.tipo_perfil === 'admin') {
        const adminUser = await salvarSessaoAdmin(usuario);

        await registrarLogAuditoria({
          actor: adminUser,
          actorType: 'admin',
          action: 'login_sucesso_admin',
          entity: 'sessao',
          entityId: adminUser?.id_admin_uuid || null,
          origin: 'login',
          status: 'sucesso',
          details: { metodo: 'email_senha' },
        });

        if (route?.params?.onAdminLogin) {
          route.params.onAdminLogin(adminUser);
        }

        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'AdminHome',
              params: { usuarioLogado: adminUser },
            },
          ],
        });
        return;
      }

      if (role === 'Paciente' && usuario.excluido) {
        registrarLogAuditoria({
          actor: usuario,
          actorType: 'paciente',
          action: 'login_falha_paciente_excluido',
          entity: 'sessao',
          entityId: usuario?.id_paciente_uuid || null,
          origin: 'login',
          status: 'falha',
          details: { motivo: 'paciente_excluido' },
        });
        setFieldErrors({
          identificador: 'Este paciente foi excluido e nao pode mais acessar a plataforma.',
          senha: '',
        });
        setErrorMessage('Acesso bloqueado: este paciente foi excluído e não pode mais acessar.');
        return;
      }

      const perfilResolvido = usuario?.tipo_perfil;
      const perfilLogin =
        perfilResolvido === 'medico'
          ? 'Medico'
          : perfilResolvido === 'nutricionista'
            ? 'Nutricionista'
            : 'Paciente';
      const actorTipo =
        perfilResolvido === 'medico'
          ? 'medico'
          : perfilResolvido === 'nutricionista'
            ? 'nutricionista'
            : 'paciente';
      const loginOkAction =
        perfilResolvido === 'medico'
          ? 'login_sucesso_medico'
          : perfilResolvido === 'nutricionista'
            ? 'login_sucesso_nutricionista'
            : 'login_sucesso_paciente';
      const sessaoEntityId =
        perfilResolvido === 'paciente'
          ? usuario?.id_paciente_uuid || null
          : perfilResolvido === 'medico'
            ? usuario?.id_medico_uuid || null
            : usuario?.id_nutricionista_uuid || null;

      await registrarLogAuditoria({
        actor: usuario,
        actorType: actorTipo,
        action: loginOkAction,
        entity: 'sessao',
        entityId: sessaoEntityId,
        origin: 'login',
        status: 'sucesso',
        details: { metodo: 'email_senha' },
      });

      let usuarioSessao = usuario;

      if (perfilResolvido === 'nutricionista') {
        usuarioSessao = await salvarSessaoNutricionista(usuario);
        if (route?.params?.onNutriLogin) {
          route.params.onNutriLogin(usuarioSessao);
        }
      } else if (perfilResolvido === 'medico') {
        usuarioSessao = await salvarSessaoMedico(usuario);
        if (route?.params?.onMedicoLogin) {
          route.params.onMedicoLogin(usuarioSessao);
        }
      } else if (role === 'Paciente') {
        usuarioSessao = await salvarSessaoPaciente(usuario);
        if (route?.params?.onPatientLogin) {
          route.params.onPatientLogin(usuarioSessao);
        }
      }

      if (usuario?.tipo_perfil !== 'admin') {
        const rpcToken = await emitirSessaoRpcPosCredencial({
          role: perfilLogin,
          identificador,
          senha,
        });
        if (!rpcToken) {
          setErrorMessage(
            'Login ok, mas sessao clinica nao iniciou. Saia e entre novamente antes de registrar dados.'
          );
        }
      }

      const rotaDestino =
        perfilResolvido === 'paciente' && !(await hasPatientOnboardingSeen(usuario))
          ? 'PacienteOnboarding'
          : perfilResolvido === 'paciente'
            ? 'HomePaciente'
            : perfilResolvido === 'medico'
              ? 'HomeMedico'
              : 'HomeNutricionista';

      navigation.reset({
        index: 0,
        routes: [
          {
            name: rotaDestino,
            params: { usuarioLogado: usuarioSessao },
          },
        ],
      });
    } catch (error) {
      console.log('Erro login comum =>', error);
      registrarLogAuditoria({
        actor: null,
        actorType: 'anonimo',
        action: 'login_falha_erro',
        entity: 'sessao',
        entityId: null,
        origin: 'login',
        status: 'falha',
        details: {
          codigo: 'erro_inesperado',
          perfilSelecionado: role,
        },
      });
      setErrorMessage('Ocorreu um erro inesperado ao validar seu acesso.');
    } finally {
      setLoading(false);
    }
  }

  async function sincronizarPacienteGoogle(user) {
    try {
      return (await syncGooglePatientRecord(user)) || buildGooglePatientFallback(user);
    } catch (error) {
      console.log('Erro ao sincronizar paciente Google =>', error);
      throw error;
    }
  }

  async function finalizarLoginGoogleComUsuario(user, auditOptions = {}) {
    if (patientAppAlreadyActive(navigation)) {
      return;
    }

    const pacienteGoogle = await sincronizarPacienteGoogle(user);
    const usuarioPaciente = (await salvarSessaoPaciente(pacienteGoogle || user)) || pacienteGoogle || user;
    await emitirSessaoRpcOAuthPaciente();

    if (route?.params?.onPatientLogin) {
      route.params.onPatientLogin(usuarioPaciente);
    }
    const rotaDestino = (await hasPatientOnboardingSeen(usuarioPaciente))
      ? 'HomePaciente'
      : 'PacienteOnboarding';

    if (auditOptions.auditLogin === true) {
      await registrarLogAuditoria({
        actor: usuarioPaciente,
        actorType: 'paciente',
        action: 'login_sucesso_google',
        entity: 'sessao',
        entityId: usuarioPaciente?.id_paciente_uuid || null,
        origin: 'login_google',
        status: 'sucesso',
        details: { metodo: 'oauth_google', provedor: 'google' },
      });
    }

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

  async function handleGoogleLogin() {
    try {
      googleSessionHandledRef.current = false;
      setGoogleLoading(true);
      setErrorMessage('');

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
        await finalizarLoginGoogleComUsuario(finalSession.user, { auditLogin: true });
        return;
      }

      registrarLogAuditoria({
        actor: null,
        actorType: 'paciente',
        action: 'login_falha_google_sessao',
        entity: 'sessao',
        entityId: null,
        origin: 'login_google',
        status: 'falha',
        details: { motivo: 'sessao_supabase_ausente' },
      });
      setErrorMessage(
        'O Google voltou para o app, mas o Supabase não criou a sessão. Tente novamente.'
      );
      AppLogger.erro(MODULOS_LOG_SISTEMA.LOGIN, 'Tela de autenticacao', null, {
        usuario: 'paciente_google',
        complemento: 'Google retornou para o app sem sessao Supabase',
      });
    } catch (error) {
      console.log('Erro login Google =>', error);
      registrarLogAuditoria({
        actor: null,
        actorType: 'paciente',
        action: 'login_falha_google',
        entity: 'sessao',
        entityId: null,
        origin: 'login_google',
        status: 'falha',
        details: { motivo: 'excecao', codigo: 'oauth_erro' },
      });
      googleSessionHandledRef.current = false;
      setErrorMessage(error?.message || 'Falha ao entrar com Google. Verifique a conexão.');
    } finally {
      setGoogleLoading(false);
    }
  }

  const containerStyle = {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 180,
    backgroundColor: '#ffffff',
  };

  const webContentContainerStyle = {
    alignItems: 'center',
    flexGrow: 0,
    minHeight: '100%',
  };

  const webAuthBoxStyle = {
    maxWidth: AUTH_WEB_MAX_WIDTH,
    width: '100%',
  };

  const scrollStyle = {
    flex: 1,
    minHeight: 0,
  };

  const safeAreaStyle = {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#ffffff',
  };

  const keyboardStyle = {
    flex: 1,
    minHeight: 0,
  };

  const cardStyle = {
    backgroundColor: '#f4f4f4',
    borderRadius: 24,
    padding: 25,
    width: '100%',
    ...softGreenBorder,
  };

  const titleStyle = {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: isAdminAccess ? '#091413' : '#4fdfa3',
    textAlign: 'center',
  };

  const adminHeaderStyle = isAdminAccess
    ? {
        backgroundColor: '#4fdfa3',
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 20,
      }
    : null;

  const labelStyle = {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 5,
    fontWeight: '600',
  };

  const inputStyle = {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#686d71',
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 45,
    marginBottom: 15,
    color: '#333',
    ...softGreenBorder,
  };

  const inputErrorStyle = {
    borderColor: '#d96666',
  };

  const passwordInputWrapperStyle = {
    ...inputStyle,
    paddingHorizontal: 0,
    paddingVertical: 0,
    position: 'relative',
  };

  const passwordInputStyle = {
    color: '#333',
    height: '100%',
    paddingHorizontal: 15,
    paddingRight: 48,
  };

  const errorBoxStyle = {
    marginTop: -4,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff4f4',
    borderWidth: 1,
    borderColor: '#f0d2d2',
  };

  const errorTextStyle = {
    color: '#c35a5a',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  };

  const fieldErrorTextStyle = {
    marginTop: -8,
    marginBottom: 12,
    color: '#c35a5a',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  };

  const forgotPasswordButtonStyle = {
    alignSelf: 'flex-end',
    marginBottom: 25,
    padding: 5,
  };

  const linkTextStyle = {
    color: '#4fdfa3',
    fontSize: 13,
    fontWeight: '600',
  };

  const mainButtonStyle = {
    backgroundColor: '#4fdfa3',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    opacity: loading ? 0.7 : 1,
  };

  const googleButtonStyle = {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dcdcdc',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    opacity: googleLoading ? 0.7 : 1,
    ...softGreenBorder,
  };

  const dividerContainerStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 4,
  };

  const dividerStyle = {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  };

  const dividerTextStyle = {
    marginHorizontal: 10,
    color: '#7f8c8d',
    fontSize: 12,
    fontWeight: '600',
  };

  const googleButtonTextStyle = {
    color: '#3c4043',
    fontWeight: '600',
    fontSize: 15,
  };

  const googleButtonContentStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const googleBadgeStyle = {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  };

  const googleLogoStyle = {
    width: 18,
    height: 18,
  };

  const buttonTextStyle = {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
  };

  const registerButtonStyle = {
    marginTop: 20,
    alignItems: 'center',
  };

  const registerTextStyle = {
    color: '#7f8c8d',
  };

  const boldGreenStyle = {
    color: '#4fdfa3',
    fontWeight: 'bold',
  };

  const profissionalSelecionado = role === ROLE_PROFISSIONAL;
  const identificadorLabel = profissionalSelecionado ? 'E-mail cadastrado' : 'E-mail cadastrado';
  const identificadorPlaceholder = profissionalSelecionado ? 'email@exemplo.com' : 'email@exemplo.com';

  return (
    <SafeAreaView edges={Platform.OS === 'web' ? undefined : []} style={safeAreaStyle}>
      <KeyboardAvoidingView
        style={keyboardStyle}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={[
            scrollStyle,
            Platform.OS === 'web' && {
              minHeight: '100vh',
              overflowY: 'visible',
              overflowX: 'hidden',
            },
          ]}
          contentContainerStyle={[
            containerStyle,
            Platform.OS === 'web' && {
              flexGrow: 0,
              minHeight: '100%',
            },
            Platform.OS === 'web' && webContentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
      <View
        onLayout={registerScrollContainer}
        style={[
          cardStyle,
          Platform.OS === 'web' && webAuthBoxStyle,
        ]}
      >
        <View style={adminHeaderStyle}>
          <Text style={titleStyle}>{isAdminAccess ? 'Acesso Admin' : 'Bem-vindo'}</Text>
        </View>

        <SeletorPerfil
          role={role}
          opcoes={['Paciente', { value: ROLE_PROFISSIONAL, label: 'Profissional da Saúde' }]}
          onChangeRole={(perfil) => {
            setRole(perfil);
            setIdentificador('');
            setSenha('');
            setErrorMessage('');
            limparErrosCamposLogin();
          }}
        />

        <Text style={labelStyle}>{identificadorLabel}</Text>
        <TextInput
          style={[
            inputStyle,
            fieldErrors.identificador ? inputErrorStyle : null,
            focusedField === 'identificador' ? inputFocusBorder : null,
          ]}
          placeholder={identificadorPlaceholder}
          placeholderTextColor="#999"
          value={identificador}
          onChangeText={handleChangeIdentificador}
          onLayout={registerFieldLayout('identificador')}
          onFocus={() => focarCampoLogin('identificador')}
          onBlur={() => desfocarCampoLogin('identificador')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
        />
        {fieldErrors.identificador ? (
          <Text style={fieldErrorTextStyle}>{fieldErrors.identificador}</Text>
        ) : null}

        <Text style={labelStyle}>Senha</Text>
        <View onLayout={registerFieldLayout('senha')}>
          <CampoSenha
            wrapperStyle={passwordInputWrapperStyle}
            inputStyle={passwordInputStyle}
            invalid={!!fieldErrors.senha}
            invalidStyle={inputErrorStyle}
            placeholder="********"
            placeholderTextColor="#95a5a6"
            value={senha}
            onChangeText={(valor) => {
              setSenha(valor);
              setErrorMessage('');
              setFieldErrors((atual) => ({
                ...atual,
                senha: validarCamposLogin({
                  identificadorValor: identificador,
                  senhaValor: valor,
                }).senha,
              }));
            }}
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            onFocus={() => focarCampoLogin('senha')}
            onBlur={() => desfocarCampoLogin('senha')}
          />
        </View>
        {fieldErrors.senha ? (
          <Text style={fieldErrorTextStyle}>{fieldErrors.senha}</Text>
        ) : null}

        {errorMessage ? (
          <View style={errorBoxStyle}>
            <Text style={errorTextStyle}>{errorMessage}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={forgotPasswordButtonStyle}
          onPress={() => navigation.navigate('ForgotPassword', { roleInicial: role })}
        >
          <Text style={linkTextStyle}>Esqueci minha senha</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={mainButtonStyle}
          onPress={handleLogin}
          disabled={loading || googleLoading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={buttonTextStyle}>Acessar Conta</Text>
          )}
        </TouchableOpacity>

        {role === 'Paciente' ? (
          <>
            <View style={dividerContainerStyle}>
              <View style={dividerStyle} />
              <Text style={dividerTextStyle}>ou</Text>
              <View style={dividerStyle} />
            </View>

            <TouchableOpacity
              style={googleButtonStyle}
              onPress={handleGoogleLogin}
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                <ActivityIndicator color="#333" />
              ) : (
                <View style={googleButtonContentStyle}>
                  <View style={googleBadgeStyle}>
                    <Image source={googleLogo} style={googleLogoStyle} resizeMode="contain" />
                  </View>
                  <Text style={googleButtonTextStyle}>Continuar com Google</Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        <TouchableOpacity
          style={registerButtonStyle}
          onPress={() => navigation.navigate('Cadastro', { roleInicial: role })}
        >
          <Text style={registerTextStyle}>
            Nao tem conta? <Text style={boldGreenStyle}>Cadastre-se</Text>
          </Text>
        </TouchableOpacity>

        {getPrivacyPolicyUrl() ? (
          <TouchableOpacity
            style={{ marginTop: 18, alignSelf: 'center' }}
            onPress={() => Linking.openURL(getPrivacyPolicyUrl())}
          >
            <Text style={[linkTextStyle, { textAlign: 'center' }]}>Privacidade e dados (LGPD)</Text>
          </TouchableOpacity>
        ) : null}
      </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
