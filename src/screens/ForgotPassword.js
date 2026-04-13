import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SeletorPerfil from '../components/SeletorPerfil';
import BotaoVoltar from '../components/BotaoVoltar';
import CampoSenha from '../components/CampoSenha';
import { inputFocusBorder } from '../theme/inputFocusTheme';
import {
  confirmarCodigoRecuperacaoSenha,
  solicitarCodigoRecuperacaoSenha,
} from '../services/passwordRecoveryService';
import {
  getPasswordValidationMessage,
  passwordRequirements,
} from '../utils/passwordRequirements';

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

const camposIniciaisErro = {
  email: '',
  novaSenha: '',
  confirmarSenha: '',
};

export default function ForgotPassword({ navigation }) {
  const [role, setRole] = useState('Paciente');
  const [email, setEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [modalCodigoVisible, setModalCodigoVisible] = useState(false);
  const [feedbackSucesso, setFeedbackSucesso] = useState('');
  const [fieldErrors, setFieldErrors] = useState(camposIniciaisErro);
  const [codigoErro, setCodigoErro] = useState('');
  const [novaSenhaFocada, setNovaSenhaFocada] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const [loading, setLoading] = useState(false);
  const [validandoCodigo, setValidandoCodigo] = useState(false);

  const senhaRecuperacaoValida = passwordRequirements.every((item) =>
    item.test(novaSenha)
  );
  const confirmacaoNovaSenhaValida =
    confirmarSenha.trim() !== '' && novaSenha === confirmarSenha;
  const podeEnviarCodigo =
    validarEmail(email) &&
    senhaRecuperacaoValida &&
    confirmacaoNovaSenhaValida &&
    !loading;

  function validarEmail(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim().toLowerCase());
  }

  function validarFormularioSenha() {
    const emailLimpo = email.trim().toLowerCase();
    const proximosErros = {
      email: '',
      novaSenha: '',
      confirmarSenha: '',
    };

    if (!emailLimpo) {
      proximosErros.email = 'Informe o e-mail cadastrado.';
    } else if (!validarEmail(emailLimpo)) {
      proximosErros.email = 'Digite um e-mail valido.';
    }

    proximosErros.novaSenha = getPasswordValidationMessage(
      novaSenha,
      'Informe a nova senha.'
    );

    if (!confirmarSenha) {
      proximosErros.confirmarSenha = 'Confirme a nova senha.';
    } else if (novaSenha !== confirmarSenha) {
      proximosErros.confirmarSenha = 'As senhas nao coincidem.';
    }

    setFieldErrors(proximosErros);

    if (Object.values(proximosErros).some(Boolean)) {
      return null;
    }

    return emailLimpo;
  }

  function limparErroCampo(campo) {
    setFieldErrors((atual) => ({ ...atual, [campo]: '' }));
  }

  function renderPasswordRequirements() {
    return (
      <View style={styles.requirementsBox}>
        {passwordRequirements.map((item) => {
          const ativo = item.test(novaSenha);

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
  }

  function irParaLogin() {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }

  async function handleEnviarCodigo({ reenviar = false } = {}) {
    setFeedbackSucesso('');
    setCodigoErro('');
    const emailLimpo = validarFormularioSenha();

    if (!emailLimpo) return;

    setLoading(true);

    try {
      await solicitarCodigoRecuperacaoSenha({
        role,
        email: emailLimpo,
      });

      setCodigo('');
      setModalCodigoVisible(true);

      if (reenviar) {
        Alert.alert('Codigo reenviado', 'Confira o e-mail cadastrado.');
      }
    } catch (err) {
      console.error('Erro ao enviar codigo de recuperacao:', err);
      const mensagemErro = err.message || 'Nao foi possivel enviar o codigo.';

      if (
        mensagemErro.toLowerCase().includes('e-mail') ||
        mensagemErro.toLowerCase().includes('conta')
      ) {
        setFieldErrors((atual) => ({ ...atual, email: mensagemErro }));
      } else {
        Alert.alert('Erro', mensagemErro);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmarCodigo() {
    const emailLimpo = validarFormularioSenha();
    const codigoLimpo = codigo.replace(/\D/g, '');

    if (!emailLimpo) return;

    if (codigoLimpo.length !== 6) {
      setCodigoErro('Codigo invalido. Digite os 6 digitos enviados por e-mail.');
      return;
    }

    setCodigoErro('');
    setValidandoCodigo(true);

    try {
      await confirmarCodigoRecuperacaoSenha({
        role,
        email: emailLimpo,
        code: codigoLimpo,
        newPassword: novaSenha,
      });

      setModalCodigoVisible(true);
      setEmail('');
      setNovaSenha('');
      setConfirmarSenha('');
      setCodigo('');
      setNovaSenhaFocada(false);
      setFeedbackSucesso('Codigo validado com sucesso. Voce ja pode fazer login.');
    } catch (err) {
      console.error('Erro ao confirmar codigo de recuperacao:', err);
      const mensagemErro =
        err.message || 'Codigo invalido. Confira o codigo enviado por e-mail.';

      if (mensagemErro.toLowerCase().includes('senha')) {
        setModalCodigoVisible(false);
        setFieldErrors((atual) => ({ ...atual, novaSenha: mensagemErro }));
      } else {
        setCodigoErro(mensagemErro);
      }
    } finally {
      setValidandoCodigo(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
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
            <Text style={styles.title}>Recuperar senha</Text>

            <SeletorPerfil
              role={role}
              onChangeRole={(perfil) => {
                setRole(perfil);
                setEmail('');
                setCodigo('');
                setCodigoErro('');
                setFieldErrors(camposIniciaisErro);
                setFeedbackSucesso('');
                setModalCodigoVisible(false);
                setNovaSenhaFocada(false);
              }}
            />

            <Text style={styles.label}>E-mail cadastrado</Text>
            <TextInput
              style={[
                styles.input,
                fieldErrors.email ? styles.inputError : null,
                focusedField === 'email' ? styles.inputFocused : null,
              ]}
              value={email}
              onChangeText={(valor) => {
                setEmail(valor);
                setFeedbackSucesso('');
                limparErroCampo('email');
              }}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField('')}
              placeholder="email@exemplo.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {fieldErrors.email ? (
              <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>
            ) : null}
            <Text style={styles.hint}>
              Enviaremos um codigo de verificacao para este e-mail.
            </Text>

            <Text style={styles.label}>Nova senha</Text>
            <CampoSenha
              wrapperStyle={styles.passwordInputWrapper}
              inputStyle={styles.passwordInput}
              invalid={!!fieldErrors.novaSenha}
              invalidStyle={styles.inputError}
              value={novaSenha}
              onChangeText={(valor) => {
                setNovaSenha(valor);
                setFeedbackSucesso('');
                limparErroCampo('novaSenha');
              }}
              placeholder="Digite a nova senha"
              placeholderTextColor="#999"
              autoComplete="new-password"
              textContentType="newPassword"
              onFocus={() => setNovaSenhaFocada(true)}
              onBlur={() => setNovaSenhaFocada(false)}
            />
            {fieldErrors.novaSenha ? (
              <Text style={styles.fieldErrorText}>{fieldErrors.novaSenha}</Text>
            ) : null}
            {novaSenhaFocada ? renderPasswordRequirements() : null}

            <Text style={styles.label}>Confirmar nova senha</Text>
            <CampoSenha
              wrapperStyle={styles.passwordInputWrapper}
              inputStyle={styles.passwordInput}
              invalid={!!fieldErrors.confirmarSenha}
              invalidStyle={styles.inputError}
              value={confirmarSenha}
              onChangeText={(valor) => {
                setConfirmarSenha(valor);
                setFeedbackSucesso('');
                limparErroCampo('confirmarSenha');
              }}
              placeholder="Repita a nova senha"
              placeholderTextColor="#999"
              autoComplete="new-password"
              textContentType="newPassword"
            />
            {fieldErrors.confirmarSenha ? (
              <Text style={styles.fieldErrorText}>{fieldErrors.confirmarSenha}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.button,
                !podeEnviarCodigo ? styles.buttonInactive : null,
              ]}
              onPress={() => handleEnviarCodigo()}
              disabled={!podeEnviarCodigo}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Enviar codigo por e-mail</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={modalCodigoVisible}
        transparent
        animationType="fade"
        onRequestClose={feedbackSucesso ? irParaLogin : () => setModalCodigoVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {feedbackSucesso ? (
              <>
                <Text style={styles.modalTitle}>Validado com sucesso</Text>
                <Text style={styles.modalText}>{feedbackSucesso}</Text>

                <TouchableOpacity style={styles.button} onPress={irParaLogin}>
                  <Text style={styles.buttonText}>Ir para login</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Codigo enviado</Text>
                <Text style={styles.modalText}>
                  Digite o codigo de 6 digitos enviado para {email.trim().toLowerCase()}.
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    styles.codeInput,
                    codigoErro ? styles.inputError : null,
                    focusedField === 'codigo' ? styles.inputFocused : null,
                  ]}
                  value={codigo}
                  onChangeText={(valor) => {
                    setCodigo(valor.replace(/\D/g, '').slice(0, 6));
                    setCodigoErro('');
                  }}
                  onFocus={() => setFocusedField('codigo')}
                  onBlur={() => setFocusedField('')}
                  placeholder="000000"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  maxLength={6}
                />
                {codigoErro ? (
                  <Text style={styles.codeErrorText}>{codigoErro}</Text>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.button,
                    (validandoCodigo || loading) && styles.buttonDisabled,
                  ]}
                  onPress={handleConfirmarCodigo}
                  disabled={validandoCodigo || loading}
                >
                  {validandoCodigo ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.buttonText}>Salvar</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => handleEnviarCodigo({ reenviar: true })}
                  disabled={validandoCodigo || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#4fdfa3" />
                  ) : (
                    <Text style={styles.secondaryButtonText}>Reenviar codigo</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalCodigoVisible(false)}
                  disabled={validandoCodigo}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: '#ffffff' },
  keyboard: { flex: 1, minHeight: 0 },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { flexGrow: 1, padding: 20 },
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4fdfa3',
    textAlign: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    color: '#333',
    ...softGreenBorder,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputFocused: {
    ...inputFocusBorder,
  },
  passwordInputWrapper: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 15,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    position: 'relative',
    ...softGreenBorder,
  },
  passwordInput: {
    color: '#333',
    paddingHorizontal: 14,
    paddingRight: 48,
    paddingVertical: 14,
  },
  fieldErrorText: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
    marginTop: -10,
  },
  hint: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
    marginTop: -8,
  },
  requirementsBox: {
    marginBottom: 16,
    marginTop: -8,
  },
  requirementItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginBottom: 5,
  },
  requirementText: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 17,
  },
  requirementTextActive: {
    color: '#159365',
    fontWeight: '700',
  },
  codeErrorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
    marginTop: -8,
    textAlign: 'center',
  },
  codeInput: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  button: {
    backgroundColor: 'rgb(79, 223, 163)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    opacity: 1,
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
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 22,
  },
  modalTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalText: {
    color: '#4B5563',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  secondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4fdfa3',
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#159365',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
});
