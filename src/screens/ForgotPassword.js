import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { supabase } from '../services/supabaseConfig';
import SeletorPerfil from '../components/SeletorPerfil';

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

export default function ForgotPassword({ navigation }) {
  const [role, setRole] = useState('Paciente');
  const [identificador, setIdentificador] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleResetPassword() {
    if (!identificador || !novaSenha || !confirmarSenha) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }

    if (novaSenha.length < 6) {
      Alert.alert('Senha inválida', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const tabela = role === 'Paciente' ? 'paciente' : 'nutricionista';
      const colunaDoc = role === 'Paciente' ? 'cpf_paciente' : 'crm_numero';
      const colunaSenha = role === 'Paciente' ? 'senha_pac' : 'senha_nutri';

      const idLimpo =
        role === 'Paciente'
          ? identificador.replace(/\D/g, '')
          : identificador.trim().toUpperCase();

      const { data, error } = await supabase
        .from(tabela)
        .update({ [colunaSenha]: novaSenha })
        .eq(colunaDoc, idLimpo)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        Alert.alert('Não encontrado', 'Nenhum usuário foi localizado com esse documento.');
        return;
      }

      Alert.alert('Sucesso', 'Senha atualizada com sucesso.', [
        { text: 'Ir para login', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      console.error('Erro ao redefinir senha:', err);
      Alert.alert('Erro', err.message || 'Não foi possível atualizar a senha.');
    } finally {
      setLoading(false);
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
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.backButton}
          >
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.title}>Recuperar senha</Text>

            <SeletorPerfil
              role={role}
              onChangeRole={(perfil) => {
                setRole(perfil);
                setIdentificador('');
              }}
            />

            <Text style={styles.label}>{role === 'Paciente' ? 'CPF' : 'CRN/UF'}</Text>
            <TextInput
              style={styles.input}
              value={identificador}
              onChangeText={setIdentificador}
              placeholder={role === 'Paciente' ? '00000000000' : '12345/PR'}
              placeholderTextColor="#999"
              keyboardType={role === 'Paciente' ? 'numeric' : 'default'}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Nova senha</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={novaSenha}
              onChangeText={setNovaSenha}
              placeholder="Digite a nova senha"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Confirmar nova senha</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              placeholder="Repita a nova senha"
              placeholderTextColor="#999"
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Salvar nova senha</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    color: '#333',
    ...softGreenBorder,
  },
  button: {
    backgroundColor: '#4fdfa3',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    opacity: 1,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
