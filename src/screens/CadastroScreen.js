import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  StyleSheet,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabaseConfig'; 

export default function CadastroScreen({ navigation }) {
  const [role, setRole] = useState('Paciente');
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState(''); 
  const [genero, setGenero] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const opcoesGenero = ['Masculino', 'Feminino', 'Diverso'];

 const handleCadastro = async () => {
    if (!nome || !documento || !email || !senha || !confirmarSenha || !genero) {
      Alert.alert("Atenção", "Preencha todos os campos!");
      return;
    }

    if (senha !== confirmarSenha) {
      Alert.alert("Erro", "As senhas não coincidem!");
      return;
    }

    setLoading(true);
    try {
      const tabela = role === 'Paciente' ? 'paciente' : 'nutricionista';
      
      let objetoCadastro = {};

      if (role === 'Paciente') {
        objetoCadastro = {
          nome_completo: nome.trim(),
          cpf_paciente: documento.trim(),
          email_pac: email.trim().toLowerCase(),
          senha_pac: senha,
          sexo_biologico: genero 
        };
      } else {
        // AJUSTADO PARA AS COLUNAS DA SUA IMAGEM:
        objetoCadastro = {
          nome_completo_nutri: nome.trim(),
          crm_numero: documento.trim(),
          email_acesso: email.trim().toLowerCase(),
          senha_nutri: senha,
          // Como não existe 'genero_nutri' na sua tabela nutri, 
          // vamos enviar o gênero para 'especialidade_principal' 
          // ou você deve criar a coluna 'genero_nutri' no Supabase.
          especialidade_principal: genero 
        };
      }

      const { error } = await supabase
        .from(tabela)
        .insert([objetoCadastro]);

      if (error) throw error;

      Alert.alert("Sucesso!", `${role} cadastrado!`);
      navigation.navigate('Login');
      
    } catch (err) {
      console.error("Erro detalhado:", err);
      Alert.alert("Erro no Cadastro", "Verifique se a coluna 'genero_nutri' existe no seu banco ou se o nome das colunas mudou.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>Crie sua conta</Text>

          {/* SELETOR DE PERFIL */}
          <View style={styles.selectorContainer}>
            {['Paciente', 'Nutricionista'].map((perfil) => (
              <TouchableOpacity
                key={perfil}
                style={[styles.selectorButton, role === perfil && styles.selectorActive]}
                onPress={() => {
                  setRole(perfil);
                  setDocumento('');
                }}
              >
                <Text style={{ color: role === perfil ? '#FFF' : '#27ae60', fontWeight: 'bold' }}>{perfil}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Nome Completo</Text>
          <TextInput 
            style={styles.input} 
            value={nome} 
            onChangeText={setNome} 
            placeholder="Ex: João Silva" 
            placeholderTextColor="#999" 
          />

          <Text style={styles.label}>{role === 'Paciente' ? 'CPF' : 'CRN/UF'}</Text>
          <TextInput 
            style={styles.input} 
            value={documento} 
            onChangeText={setDocumento} 
            placeholder={role === 'Paciente' ? "000.000.000-00" : "12345/PR"} 
            placeholderTextColor="#999"
            keyboardType={role === 'Paciente' ? 'numeric' : 'default'}
          />

          <Text style={styles.label}>Gênero</Text>
          <TouchableOpacity 
            style={styles.inputPicker} 
            onPress={() => setModalVisible(true)}
          >
            <Text style={{ color: genero ? '#333' : '#999' }}>
              {genero || "Selecione seu gênero"}
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
            style={[styles.button, { opacity: loading ? 0.7 : 1 }]} 
            onPress={handleCadastro} 
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>CADASTRAR</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL DE GÊNERO */}
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
                {genero === item && <Ionicons name="checkmark" size={22} color="#27ae60" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scroll: { padding: 20 },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#2c3e50', textAlign: 'center' },
  selectorContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  selectorButton: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#DDD', marginHorizontal: 5 },
  selectorActive: { backgroundColor: '#27ae60', borderColor: '#27ae60' },
  label: { fontSize: 14, color: '#34495e', marginBottom: 5, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 12, marginBottom: 15, color: '#333', backgroundColor: '#FFF' },
  inputPicker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 10, padding: 12, marginBottom: 15, backgroundColor: '#FFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFF', width: '85%', borderRadius: 15, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  modalItemText: { fontSize: 16, color: '#444' },
  button: { backgroundColor: '#27ae60', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});