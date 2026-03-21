import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  StyleSheet 
} from 'react-native';
import { supabase } from '../services/supabaseConfig'; 

export default function LoginScreen({ navigation }) {
  const [role, setRole] = useState('Paciente');
  const [identificador, setIdentificador] = useState(''); 
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!identificador || !senha) {
      Alert.alert("Erro", "Preencha todos os campos!");
      return;
    }

    setLoading(true);

    try {
      const tabela = role === 'Paciente' ? 'paciente' : 'nutricionista';
      const colunaDoc = role === 'Paciente' ? 'cpf_paciente' : 'crm_numero'; 
      const colunaSenha = role === 'Paciente' ? 'senha_pac' : 'senha_nutri';

      // Importante: Verifique se no seu banco o CPF está com pontos ou apenas números
      const identificadorLimpo = role === 'Paciente' 
        ? identificador.replace(/\D/g, '') 
        : identificador.trim();

      const { data, error } = await supabase
        .from(tabela)
        .select('*')
        .eq(colunaDoc, identificadorLimpo) 
        .eq(colunaSenha, senha)
        .maybeSingle();

      if (error) {
        Alert.alert("Erro de Conexão", "Erro ao validar dados no servidor.");
      } else if (!data) {
        Alert.alert("Falha no Login", `${role} não encontrado ou senha incorreta.`);
      } else {
        const rotaDestino = role === 'Paciente' ? 'HomePaciente' : 'HomeNutricionista';
        // replace impede que o usuário volte para a tela de login pelo botão "voltar"
        navigation.replace(rotaDestino, { usuarioLogado: data });
      }

    } catch (err) {
      Alert.alert("Erro Crítico", "Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.title}>Bem-vindo ao GlicNutri</Text>

        <View style={styles.selectorContainer}>
          {['Paciente', 'Nutricionista'].map((perfil) => (
            <TouchableOpacity
              key={perfil}
              style={[
                styles.selectorButton, 
                { 
                  borderColor: role === perfil ? '#27ae60' : '#DDD', 
                  backgroundColor: role === perfil ? '#27ae60' : 'transparent' 
                }
              ]}
              onPress={() => {
                setRole(perfil);
                setIdentificador(''); 
              }}
            >
              <Text style={{ color: role === perfil ? '#FFF' : '#27ae60', fontWeight: 'bold' }}>
                {perfil}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{role === 'Paciente' ? 'CPF' : 'CRM/UF'}</Text>
        <TextInput 
          style={styles.input} 
          placeholder={role === 'Paciente' ? '000.000.000-00' : '12345/SP'}
          placeholderTextColor="#95a5a6"
          value={identificador}
          onChangeText={setIdentificador}
          keyboardType={role === 'Paciente' ? 'numeric' : 'default'}
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput 
          style={styles.input} 
          placeholder="********" 
          placeholderTextColor="#95a5a6"
          secureTextEntry 
          value={senha}
          onChangeText={setSenha}
        />

        <TouchableOpacity 
          style={{ alignSelf: 'flex-end', marginBottom: 25, padding: 5 }}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.linkText}>Esqueci minha senha</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.mainButton, { opacity: loading ? 0.7 : 1 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Acessar Conta</Text>}
        </TouchableOpacity>

        <TouchableOpacity 
          style={{ marginTop: 20, alignItems: 'center' }}
          onPress={() => navigation.navigate('Cadastro')}
        >
          <Text style={{ color: '#7f8c8d' }}>
            Não tem conta? <Text style={styles.boldGreen}>Cadastre-se</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#F8F9FA' },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 25, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, marginTop: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#2c3e50', textAlign: 'center' },
  selectorContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  selectorButton: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 20, borderWidth: 1, marginHorizontal: 5 },
  label: { fontSize: 14, color: '#34495e', marginBottom: 5, fontWeight: '600' },
  input: { backgroundColor: '#FDFDFD', borderWidth: 1, borderColor: '#DDD', borderRadius: 15, paddingHorizontal: 15, height: 45, marginBottom: 15, color: '#333' },
  mainButton: { backgroundColor: '#27ae60', borderRadius: 20, padding: 16, alignItems: 'center' },
  buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  linkText: { color: '#27ae60', fontSize: 13, fontWeight: '600' },
  boldGreen: { color: '#27ae60', fontWeight: 'bold' }
});