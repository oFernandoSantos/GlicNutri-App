import React, { useState } from 'react';
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

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

export default function CadastroScreen({ navigation }) {
  const [role, setRole] = useState('Paciente');
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [genero, setGenero] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [aceitouLgpd, setAceitouLgpd] = useState(false);
  const [loading, setLoading] = useState(false);

  const opcoesGenero = ['Masculino', 'Feminino', 'Diverso'];

  const formularioValido =
    nome.trim() !== '' &&
    documento.trim() !== '' &&
    genero.trim() !== '' &&
    email.trim() !== '' &&
    senha.trim() !== '' &&
    confirmarSenha.trim() !== '' &&
    aceitouLgpd &&
    !loading;

  const normalizarDocumento = () => {
    if (role === 'Paciente') {
      return documento.replace(/\D/g, '');
    }
    return documento.trim().toUpperCase();
  };

  const handleCadastro = async () => {
    if (!nome || !documento || !email || !senha || !confirmarSenha || !genero) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }

    if (!aceitouLgpd) {
      Alert.alert('Atenção', 'Você precisa aceitar os termos de LGPD para continuar.');
      return;
    }

    if (senha !== confirmarSenha) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const tabela = role === 'Paciente' ? 'paciente' : 'nutricionista';
      const documentoFormatado = normalizarDocumento();

      let objetoCadastro = {};

      if (role === 'Paciente') {
        objetoCadastro = {
          nome_completo: nome.trim(),
          cpf_paciente: documentoFormatado,
          email_pac: email.trim().toLowerCase(),
          senha_pac: senha,
          sexo_biologico: genero,
        };
      } else {
        objetoCadastro = {
          nome_completo_nutri: nome.trim(),
          crm_numero: documentoFormatado,
          email_acesso: email.trim().toLowerCase(),
          senha_nutri: senha,
          genero_nutri: genero,
        };
      }

      const { error } = await supabase.from(tabela).insert([objetoCadastro]);

      if (error) throw error;

      Alert.alert('Sucesso!', `${role} cadastrado com sucesso.`, [
        {
          text: 'Ir para login',
          onPress: () => navigation.navigate('Login'),
        },
      ]);
    } catch (err) {
      console.error('Erro detalhado:', err);
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
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.backButton}
          >
            <Text style={styles.backText}>Voltar</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.title}>Crie sua conta</Text>

            <SeletorPerfil
              role={role}
              onChangeRole={(perfil) => {
                setRole(perfil);
                setDocumento('');
              }}
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
              {role === 'Paciente' ? 'CPF' : 'CRN/UF'}
            </Text>
            <TextInput
              style={styles.input}
              value={documento}
              onChangeText={setDocumento}
              placeholder={role === 'Paciente' ? '00000000000' : '12345/PR'}
              placeholderTextColor="#999"
              keyboardType={role === 'Paciente' ? 'numeric' : 'default'}
              autoCapitalize="characters"
            />

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
