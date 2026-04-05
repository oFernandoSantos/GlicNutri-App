import React, { useEffect, useState } from 'react';
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
import SeletorPerfil from '../components/SeletorPerfil';

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

const googleLogo = {
  uri: 'https://img.icons8.com/?size=100&id=xoyhGXWmHnqX&format=png&color=000000',
};

export default function LoginScreen({ navigation, session }) {
  const [role, setRole] = useState('Paciente');
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function normalizarIdentificadorLogin(valor, perfil) {
    const valorBase = valor.trim();

    return {
      original: valorBase,
      documento:
        perfil === 'Paciente'
          ? valorBase.replace(/\D/g, '')
          : valorBase.toUpperCase(),
      email: valorBase.toLowerCase(),
      ehEmail: valorBase.includes('@'),
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
    const filtrosDocumento = [
      identificadorNormalizado.documento,
      identificadorNormalizado.original,
    ].filter(Boolean);

    for (const valorDocumento of filtrosDocumento) {
      const { data, error } = await supabase
        .from(tabela)
        .select('*')
        .eq(colunaDoc, valorDocumento);

      if (error) {
        throw error;
      }

      const usuarioEncontrado = (data || []).find(
        (item) => String(item?.[colunaSenha] || '').trim() === senhaNormalizada
      );

      if (usuarioEncontrado) {
        return usuarioEncontrado;
      }
    }

    if (identificadorNormalizado.ehEmail) {
      const { data, error } = await supabase
        .from(tabela)
        .select('*')
        .eq(colunaEmail, identificadorNormalizado.email);

      if (error) {
        throw error;
      }

      const usuarioEncontrado = (data || []).find(
        (item) => String(item?.[colunaSenha] || '').trim() === senhaNormalizada
      );

      if (usuarioEncontrado) {
        return usuarioEncontrado;
      }
    }

    return null;
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

        if (data?.session?.user) {
          navigation.reset({
            index: 0,
            routes: [
              {
                name: 'HomePaciente',
                params: {
                  usuarioLogado: data.session.user,
                  loginSocial: true,
                },
              },
            ],
          });
        }
      } catch (error) {
        console.log('Erro ao verificar sessao atual =>', error);
      }
    }

    verificarSessaoAtual();
  }, [navigation]);

  useEffect(() => {
    if (session?.user) {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'HomePaciente',
            params: {
              usuarioLogado: session.user,
              loginSocial: true,
            },
          },
        ],
      });
    }
  }, [session, navigation]);

  async function handleLogin() {
    if (!identificador.trim() || !senha.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos!');
      return;
    }

    setLoading(true);

    try {
      const usuario = await buscarUsuarioPorCredenciais(role, identificador, senha);

      if (!usuario) {
        Alert.alert(
          'Falha no login',
          `${role} nao encontrado ou senha incorreta. Voce pode usar documento ou e-mail.`
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
      Alert.alert('Erro', 'Ocorreu um erro inesperado ao validar seu acesso.');
    } finally {
      setLoading(false);
    }
  }

  async function sincronizarPacienteGoogle(user) {
    try {
      if (!user?.id) return null;

      const nomeGoogle =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Paciente';

      const emailGoogle = user.email?.toLowerCase() || null;

      const { data: pacienteExistente } = await supabase
        .from('paciente')
        .select('*')
        .eq('id_paciente_uuid', user.id)
        .maybeSingle();

      if (pacienteExistente) {
        const { data: atualizado } = await supabase
          .from('paciente')
          .update({
            nome_completo: pacienteExistente.nome_completo || nomeGoogle,
            email_pac: pacienteExistente.email_pac || emailGoogle,
          })
          .eq('id_paciente_uuid', user.id)
          .select('*')
          .maybeSingle();

        return atualizado || pacienteExistente;
      }

      const { data: criado, error: erroInsert } = await supabase
        .from('paciente')
        .insert([
          {
            id_paciente_uuid: user.id,
            nome_completo: nomeGoogle,
            email_pac: emailGoogle,
          },
        ])
        .select('*')
        .maybeSingle();

      if (erroInsert) {
        console.log('Erro ao criar paciente Google =>', erroInsert.message);
        return {
          id_paciente_uuid: user.id,
          nome_completo: nomeGoogle,
          email_pac: emailGoogle,
        };
      }

      return criado;
    } catch (error) {
      console.log('Erro ao sincronizar paciente Google =>', error);
      return {
        id_paciente_uuid: user?.id || null,
        nome_completo:
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.email?.split('@')[0] ||
          'Paciente',
        email_pac: user?.email?.toLowerCase() || null,
      };
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
        await finalizarLoginGoogleComUsuario(finalSessionData.session.user);
        return;
      }

      Alert.alert(
        'Atencao',
        'O Google voltou para o app, mas o Supabase nao criou a sessao.'
      );
    } catch (error) {
      console.log('Erro login Google =>', error);
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

  const backButtonStyle = {
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
  };

  const backTextStyle = {
    color: '#686d71',
    fontWeight: '600',
    fontSize: 14,
  };

  const cardStyle = {
    backgroundColor: '#f4f4f4',
    borderRadius: 24,
    padding: 25,
    ...softGreenBorder,
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
    color: '#686d71',
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
      <TouchableOpacity
        onPress={() => navigation.navigate('Intro')}
        style={backButtonStyle}
      >
        <Text style={backTextStyle}>Voltar</Text>
      </TouchableOpacity>

      <View style={cardStyle}>
        <Text style={titleStyle}>Bem-vindo ao GlicNutri</Text>

        <SeletorPerfil
          role={role}
          onChangeRole={(perfil) => {
            setRole(perfil);
            setIdentificador('');
          }}
        />

        <Text style={labelStyle}>
          {role === 'Paciente' ? 'CPF ou e-mail' : 'CRN/UF ou e-mail'}
        </Text>
        <TextInput
          style={inputStyle}
          placeholder={
            role === 'Paciente'
              ? '000.000.000-00 ou email@exemplo.com'
              : '12345/SP ou email@exemplo.com'
          }
          placeholderTextColor="#95a5a6"
          value={identificador}
          onChangeText={setIdentificador}
          keyboardType="default"
          autoCapitalize="none"
        />

        <Text style={labelStyle}>Senha</Text>
        <TextInput
          style={inputStyle}
          placeholder="********"
          placeholderTextColor="#95a5a6"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
          autoCapitalize="none"
        />

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

        <TouchableOpacity
          style={registerButtonStyle}
          onPress={() => navigation.navigate('Cadastro')}
        >
          <Text style={registerTextStyle}>
            Nao tem conta? <Text style={boldGreenStyle}>Cadastre-se</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
