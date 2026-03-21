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

export default function ForgotPassword({ navigation }) {
  const [role, setRole] = useState('Paciente');
  const [identificador, setIdentificador] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleResetPassword() {
    // 1. Validações iniciais
    if (!identificador || !novaSenha || !confirmarSenha) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      Alert.alert("Erro", "As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      // Nomes das tabelas e colunas baseados nos seus prints do Supabase
      const tabela = role === 'Paciente' ? 'paciente' : 'nutricionista';
      const colunaDoc = role === 'Paciente' ? 'cpf_paciente' : 'crm_numero';
      const colunaSenha = role === 'Paciente' ? 'senha_pac' : 'senha_nutri';

      // Limpeza do identificador
      const idLimpo = role === 'Paciente' 
        ? identificador.replace(/\D/g, '') 
        : identificador.trim();

      console.log(`Buscando em ${tabela} por ${colunaDoc}: ${idLimpo}`);

      // 2. Executa o UPDATE diretamente
      // O Supabase só fará o update se encontrar o documento correspondente
      const { data, error, status } = await supabase
        .from(tabela)
        .update({ [colunaSenha]: novaSenha })
        .eq(colunaDoc, idLimpo)
        .select(); // O .select() é crucial para confirmar se houve alteração

      if (error) {
        console.error("Erro Supabase:", error);
        Alert.alert("Erro no Banco", "Verifique as permissões de UPDATE no Supabase.");
        return;
      }

      // 3. Verifica se alguma linha foi realmente alterada
      if (data && data.length > 0) {
        Alert.alert("Sucesso!", "Sua senha foi atualizada. Agora você já pode fazer login.", [
          { text: "Ir para Login", onPress: () => navigation.navigate('Login') }
        ]);
      } else {
        // Se data vier vazio, o CPF/CRM não existe no banco
        Alert.alert(
          "Não encontrado", 
          `O ${role.toLowerCase()} com este documento não foi localizado em nossa base.`
        );
      }

    } catch (err) {
      console.error("Erro Crítico:", err);
      Alert.alert("Erro", "Ocorreu um erro inesperado ao processar sua solicitação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.title}>Recuperar Senha</Text>
        <Text style={styles.subtitle}>Crie uma nova senha de acesso para o seu perfil.</Text>

        {/* SELETOR DE PERFIL */}
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
          placeholder={role === 'Paciente' ? '00000000000' : '12345/SP'}
          placeholderTextColor="#95a5a6"
          value={identificador}
          onChangeText={setIdentificador}
          keyboardType={role === 'Paciente' ? 'numeric' : 'default'}
        />

        <Text style={styles.label}>Nova Senha</Text>
        <TextInput 
          style={styles.input}
          placeholder="Digite a nova senha"
          placeholderTextColor="#95a5a6"
          secureTextEntry
          value={novaSenha}
          onChangeText={setNovaSenha}
        />

        <Text style={styles.label}>Confirmar Nova Senha</Text>
        <TextInput 
          style={styles.input}
          placeholder="Repita a nova senha"
          placeholderTextColor="#95a5a6"
          secureTextEntry
          value={confirmarSenha}
          onChangeText={setConfirmarSenha}
        />

        <TouchableOpacity 
          style={[styles.mainButton, { opacity: loading ? 0.7 : 1 }]} 
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Salvar Nova Senha</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={{ marginTop: 20 }} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Cancelar e Voltar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#F8F9FA', justifyContent: 'center' },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 25, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#7f8c8d', textAlign: 'center', marginBottom: 25, lineHeight: 20 },
  selectorContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  selectorButton: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 20, borderWidth: 1, marginHorizontal: 5 },
  label: { fontSize: 14, color: '#34495e', marginBottom: 5, fontWeight: '600' },
  input: { backgroundColor: '#FDFDFD', borderWidth: 1, borderColor: '#DDD', borderRadius: 15, paddingHorizontal: 15, height: 48, marginBottom: 15, color: '#333' },
  mainButton: { backgroundColor: '#27ae60', borderRadius: 20, padding: 16, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  backText: { color: '#7f8c8d', textAlign: 'center', fontWeight: '600', fontSize: 14 }
});