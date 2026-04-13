import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../services/supabaseConfig';
import {
  buildGooglePatientFallback,
  syncGooglePatientRecord,
} from '../services/googlePatientSync';
import SeletorPerfil from '../components/SeletorPerfil';
import CampoSenha from '../components/CampoSenha';
import { inputFocusBorder } from '../theme/inputFocusTheme';

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

const googleLogo = {
  uri: 'https://img.icons8.com/?size=100&id=xoyhGXWmHnqX&format=png&color=000000',
};

export default function LoginScreen({ navigation, route, session }) {
  const roleInicial =
    route?.params?.roleInicial === 'Nutricionista' ? 'Nutricionista' : 'Paciente';

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

  function formatarCpf(valor) {
    const numeros = valor.replace(/\D/g, '').slice(0, 11);

    return numeros
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }

  function formatarCrn(valor) {
    const textoLimpo = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const numeros = textoLimpo.replace(/[A-Z]/g, '').slice(0, 5);
    const uf = textoLimpo.replace(/\d/g, '').slice(0, 2);

    if (!numeros) {
      return '';
    }

    return uf ? `${numeros}/${uf}` : numeros;
  }

  function identificadorPareceEmail(valor, perfil = role) {
    const valorLimpo = valor.trim();

    if (!valorLimpo) return false;
    if (valorLimpo.includes('@')) return true;

    if (perfil === 'Paciente') {
      return /[A-Za-z]/.test(valorLimpo);
    }

    if (/^[A-Za-z]/.test(valorLimpo)) return true;
    if (/[._+\-]/.test(valorLimpo)) return true;
    if (/^\d+$/.test(valorLimpo)) return false;

    const valorSemEspacos = valorLimpo.replace(/\s/g, '');
    const crnParcial = /^\d{0,5}\/?[A-Za-z]{0,2}$/.test(valorSemEspacos);

    return !crnParcial && /[A-Za-z]/.test(valorLimpo);
  }

  function formatarIdentificadorLogin(valor, perfil = role) {
    if (identificadorPareceEmail(valor, perfil)) {
      return valor.replace(/\s/g, '').toLowerCase();
    }

    return perfil === 'Paciente' ? formatarCpf(valor) : formatarCrn(valor);
  }

  function obterMaxLengthIdentificador() {
    if (identificadorPareceEmail(identificador, role)) {
      return undefined;
    }

    return role === 'Paciente' ? 14 : 8;
  }

  function validarCpfParaLogin(valor) {
    return valor.replace(/\D/g, '').length === 11;
  }

  function validarCrnParaLogin(valor) {
    return /^\d{5}\/[A-Z]{2}$/.test(valor.trim().toUpperCase());
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
    const ehEmail = identificadorPareceEmail(identificadorLimpo, role);

    if (!identificadorLimpo) {
      proximosErros.identificador =
        role === 'Paciente'
          ? 'Preencha o CPF ou e-mail.'
          : 'Preencha o CRN/UF ou e-mail.';
    } else if (ehEmail && !validarEmail(identificadorLimpo)) {
      proximosErros.identificador = 'Digite um e-mail valido para continuar.';
    } else if (
      role === 'Paciente' &&
      !ehEmail &&
      !validarCpfParaLogin(identificadorLimpo)
    ) {
      proximosErros.identificador = 'Digite um CPF valido para acessar como paciente.';
    } else if (
      role === 'Nutricionista' &&
      !ehEmail &&
      !validarCrnParaLogin(identificadorLimpo)
    ) {
      proximosErros.identificador =
        'Digite o CRN no formato 12345/SP para acessar como nutricionista.';
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
    setErrorMessage('');
    const proximoValor = formatarIdentificadorLogin(valor, role);

    setIdentificador(proximoValor);
    setFieldErrors((atual) => ({
      ...atual,
      identificador: validarCamposLogin({
        identificadorValor: proximoValor,
        senhaValor: senha,
      }).identificador,
    }));
  }

  function normalizarIdentificadorLogin(valor, perfil) {
    const valorBase = valor.trim();
    const ehEmail = identificadorPareceEmail(valorBase, perfil);
    const documentoNormalizado = ehEmail
      ? ''
      : perfil === 'Paciente'
        ? valorBase.replace(/\D/g, '')
        : formatarCrn(valorBase);

    return {
      original: valorBase,
      documento: documentoNormalizado,
      email: valorBase.toLowerCase(),
      ehEmail,
    };
  }

  async function buscarUsuarioPorCredenciais(
    perfil,
    identificadorInformado,
    senhaInformada
  ) {
    const tabela = perfil === 'Paciente' ? 'paciente' : 'nutricionista';
    const colunaDoc = perfil === 'Paciente' ? 'cpf_paciente' : 'crm_numero';
    const colunaEmail = perfil === 'Paciente' ? 'email_pac' : 'email_acesso';
    const colunaSenha = perfil === 'Paciente' ? 'senha_pac' : 'senha_nutri';

    const identificadorNormalizado = normalizarIdentificadorLogin(
      identificadorInformado,
      perfil
    );
    const senhaNormalizada = senhaInformada.trim();
    const filtrosDocumento = identificadorNormalizado.ehEmail
      ? []
      : [
          identificadorNormalizado.documento,
          identificadorNormalizado.original,
        ].filter(Boolean);
    const candidatos = [];

    function adicionarCandidatos(registros) {
      (registros || []).forEach((item) => {
        const chave =
          item?.id_paciente_uuid ||
          item?.id_nutricionista_uuid ||
          item?.email_pac ||
          item?.email_acesso ||
          item?.cpf_paciente ||
          item?.crm_numero;

        if (!candidatos.some((existente) => {
          const chaveExistente =
            existente?.id_paciente_uuid ||
            existente?.id_nutricionista_uuid ||
            existente?.email_pac ||
            existente?.email_acesso ||
            existente?.cpf_paciente ||
            existente?.crm_numero;

          return chaveExistente === chave;
        })) {
          candidatos.push(item);
        }
      });
    }

    for (const valorDocumento of filtrosDocumento) {
      const { data, error } = await supabase
        .from(tabela)
        .select('*')
        .eq(colunaDoc, valorDocumento);

      if (error) {
        throw error;
      }

      adicionarCandidatos(data);

      const usuarioEncontrado = (data || []).find(
        (item) => String(item?.[colunaSenha] || '').trim() === senhaNormalizada
      );

      if (usuarioEncontrado) {
        return {
          usuario: usuarioEncontrado,
          motivo: '',
        };
      }
    }

    if (identificadorNormalizado.ehEmail) {
      const { data, error } = await supabase
        .from(tabela)
        .select('*')
        .ilike(colunaEmail, identificadorNormalizado.email);

      if (error) {
        throw error;
      }

      adicionarCandidatos(data);

      const usuarioEncontrado = (data || []).find(
        (item) => String(item?.[colunaSenha] || '').trim() === senhaNormalizada
      );

      if (usuarioEncontrado) {
        return {
          usuario: usuarioEncontrado,
          motivo: '',
        };
      }
    }

    return {
      usuario: null,
      motivo: candidatos.length > 0 ? 'senha_incorreta' : 'usuario_nao_encontrado',
    };
  }

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    async function verificarSessaoAtual() {
      try {
        const { data, error } = await supabase.auth.getSession();

        console.log('Sessao atual ao abrir Login =>', {
          hasSession: !!data?.session,
          userId: data?.session?.user?.id || null,
          error: error?.message || null,
        });

        if (data?.session?.user && !googleSessionHandledRef.current) {
          googleSessionHandledRef.current = true;
          await finalizarLoginGoogleComUsuario(data.session.user);
        }
      } catch (error) {
        console.log('Erro ao verificar sessao atual =>', error);
        googleSessionHandledRef.current = false;
      }
    }

    verificarSessaoAtual();
  }, [navigation]);

  useEffect(() => {
    if (!session?.user) {
      googleSessionHandledRef.current = false;
      return;
    }

    if (!googleSessionHandledRef.current) {
      googleSessionHandledRef.current = true;
      finalizarLoginGoogleComUsuario(session.user).catch((error) => {
        console.log('Erro ao sincronizar sessao Google =>', error);
        googleSessionHandledRef.current = false;
      });
    }
  }, [session, navigation]);

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
      const { usuario, motivo } = await buscarUsuarioPorCredenciais(
        role,
        identificador,
        senha
      );

      if (!usuario) {
        setFieldErrors({
          identificador:
            motivo === 'senha_incorreta'
              ? ''
              : role === 'Paciente'
                ? 'Paciente nao encontrado. Confira o CPF ou e-mail informado.'
                : 'Nutricionista nao encontrado. Confira o CRN ou e-mail informado.',
          senha:
            motivo === 'senha_incorreta'
              ? 'Senha incorreta. Confira a senha digitada e tente novamente.'
              : '',
        });
        return;
      }

      if (role === 'Paciente' && usuario.excluido) {
        setFieldErrors({
          identificador: 'Este paciente foi excluido e nao pode mais acessar a plataforma.',
          senha: '',
        });
        Alert.alert(
          'Acesso bloqueado',
          'Este paciente foi excluido e nao pode mais acessar a plataforma.'
        );
        return;
      }

      const rotaDestino =
        role === 'Paciente' ? 'HomePaciente' : 'HomeNutricionista';

      navigation.reset({
        index: 0,
        routes: [
          {
            name: rotaDestino,
            params: { usuarioLogado: usuario },
          },
        ],
      });
    } catch (error) {
      console.log('Erro login comum =>', error);
      setErrorMessage('Ocorreu um erro inesperado ao validar seu acesso.');
      Alert.alert('Erro', 'Ocorreu um erro inesperado ao validar seu acesso.');
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

  async function finalizarLoginGoogleComUsuario(user) {
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
    console.log('Linking.parse =>', parsed);

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

  async function handleGoogleLogin() {
    try {
      googleSessionHandledRef.current = false;
      setGoogleLoading(true);

      const redirectTo =
        Platform.OS === 'web'
          ? window.location.origin
          : AuthSession.makeRedirectUri({
              scheme: 'glicnutri',
              path: 'auth/callback',
            });

      console.log('redirectTo =>', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (error) {
        console.log('Erro OAuth Google =>', error);
        Alert.alert('Erro no Google', error.message);
        return;
      }

      if (!data?.url) {
        Alert.alert('Erro', 'Nao foi possivel iniciar o login com Google.');
        return;
      }

      if (Platform.OS === 'web') {
        window.location.href = data.url;
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      console.log('Resultado OAuth =>', result);

      if (result.type === 'cancel') {
        googleSessionHandledRef.current = false;
        return;
      }

      if (result.type !== 'success' || !result.url) {
        Alert.alert('Erro', 'Nao foi possivel concluir o login com Google.');
        return;
      }

      const returnedUrl = result.url;
      console.log('URL retorno =>', returnedUrl);

      let { accessToken, refreshToken } = extrairTokensDaUrl(returnedUrl);

      console.log('accessToken =>', accessToken ? 'SIM' : 'NAO');
      console.log('refreshToken =>', refreshToken ? 'SIM' : 'NAO');

      if (accessToken && refreshToken) {
        const { data: sessionSetData, error: setSessionError } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

        console.log('setSession =>', {
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

      console.log('Sessao final =>', {
        hasSession: !!finalSessionData?.session,
        userId: finalSessionData?.session?.user?.id || null,
        error: finalSessionError?.message || null,
      });

      if (finalSessionData?.session?.user) {
        googleSessionHandledRef.current = true;
        await finalizarLoginGoogleComUsuario(finalSessionData.session.user);
        return;
      }

      Alert.alert(
        'Atencao',
        'O Google voltou para o app, mas o Supabase nao criou a sessao.'
      );
    } catch (error) {
      console.log('Erro login Google =>', error);
      googleSessionHandledRef.current = false;
      Alert.alert('Erro', 'Falha ao entrar com Google.');
    } finally {
      setGoogleLoading(false);
    }
  }

  const containerStyle = {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#ffffff',
  };

  const scrollStyle = {
    flex: 1,
    minHeight: 0,
  };

  const cardStyle = {
    backgroundColor: '#f4f4f4',
    borderRadius: 24,
    padding: 25,
    ...softGreenBorder,
  };

  const loginBrandStyle = {
    color: '#5afcb8',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 20,
    height: 40,
    lineHeight: 40,
  };

  const titleStyle = {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#4fdfa3',
    textAlign: 'center',
  };

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

  return (
    <ScrollView
      style={[
        scrollStyle,
        Platform.OS === 'web' && {
          height: '100vh',
          maxHeight: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
        },
      ]}
      contentContainerStyle={[
        containerStyle,
        Platform.OS === 'web' && {
          flexGrow: 0,
          minHeight: '100%',
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      <Text style={loginBrandStyle}>GlicNutri</Text>

      <View style={cardStyle}>
        <Text style={titleStyle}>Bem-vindo</Text>

        <SeletorPerfil
          role={role}
          onChangeRole={(perfil) => {
            setRole(perfil);
            setIdentificador('');
            setSenha('');
            setErrorMessage('');
            limparErrosCamposLogin();
          }}
        />

        <Text style={labelStyle}>
          {role === 'Paciente' ? 'CPF ou e-mail' : 'CRN/UF ou e-mail'}
        </Text>
        <TextInput
          style={[
            inputStyle,
            fieldErrors.identificador ? inputErrorStyle : null,
            focusedField === 'identificador' ? inputFocusBorder : null,
          ]}
          placeholder={
            role === 'Paciente'
              ? '000.000.000-00 ou email@exemplo.com'
              : '12345/SP ou email@exemplo.com'
          }
          placeholderTextColor="#95a5a6"
          value={identificador}
          onChangeText={handleChangeIdentificador}
          keyboardType="default"
          autoCapitalize={
            role === 'Nutricionista' &&
            identificador.trim() &&
            !identificadorPareceEmail(identificador, role)
              ? 'characters'
              : 'none'
          }
          maxLength={obterMaxLengthIdentificador()}
          onFocus={() => setFocusedField('identificador')}
          onBlur={() => setFocusedField('')}
        />
        {fieldErrors.identificador ? (
          <Text style={fieldErrorTextStyle}>{fieldErrors.identificador}</Text>
        ) : null}

        <Text style={labelStyle}>Senha</Text>
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
        />
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
          onPress={() => navigation.navigate('ForgotPassword')}
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
      </View>
    </ScrollView>
  );
}
