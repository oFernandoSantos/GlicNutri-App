import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MenuLateral from '../components/MenuLateral';
import { supabase } from '../services/supabaseConfig';

const softGreenBorder = {
  borderWidth: 1.5,
  borderColor: '#f4f4f4',
};

export default function HomePaciente({ navigation, route, usuarioLogado: usuarioProp }) {
  const [menuVisivel, setMenuVisivel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saindo, setSaindo] = useState(false);

  const [paciente, setPaciente] = useState(null);
  const [refeicoes, setRefeicoes] = useState([]);
  const [glicemia, setGlicemia] = useState(null);

  const usuarioLogado = usuarioProp || route?.params?.usuarioLogado || null;

  const idPaciente = useMemo(() => {
    return (
      usuarioLogado?.id_paciente_uuid ||
      usuarioLogado?.id ||
      usuarioLogado?.user_metadata?.id_paciente_uuid ||
      null
    );
  }, [usuarioLogado]);

  const nomeBaseUsuario = useMemo(() => {
    return (
      usuarioLogado?.nome_completo ||
      usuarioLogado?.user_metadata?.full_name ||
      usuarioLogado?.user_metadata?.name ||
      usuarioLogado?.email_pac ||
      usuarioLogado?.email ||
      'Paciente'
    );
  }, [usuarioLogado]);

  async function carregarPaciente() {
    if (!usuarioLogado) {
      setPaciente(null);
      return;
    }

    if (!idPaciente) {
      setPaciente({
        nome_completo: nomeBaseUsuario,
        email_pac: usuarioLogado?.email || null,
      });
      return;
    }

    const { data, error } = await supabase
      .from('paciente')
      .select('*')
      .eq('id_paciente_uuid', idPaciente)
      .maybeSingle();

    if (error) {
      console.log('Erro ao buscar paciente:', error.message);
    }

    setPaciente(
      data || {
        ...usuarioLogado,
        id_paciente_uuid: idPaciente,
        nome_completo: nomeBaseUsuario,
        email_pac: usuarioLogado?.email || null,
      }
    );
  }

  async function carregarRefeicoes() {
    if (!idPaciente) {
      setRefeicoes([]);
      return;
    }

    const { data, error } = await supabase
      .from('plano_alimentar_refeicoes')
      .select('*')
      .eq('id_paciente_uuid', idPaciente)
      .order('horario_refeicao', { ascending: true });

    if (error) {
      console.log('Tabela de refeições não encontrada ou sem dados:', error.message);
      setRefeicoes([]);
      return;
    }

    setRefeicoes(data || []);
  }

  async function carregarGlicemia() {
    if (!idPaciente) {
      setGlicemia(null);
      return;
    }

    const { data, error } = await supabase
      .from('registro_glicemia_manual')
      .select('*')
      .eq('id_paciente_uuid', idPaciente)
      .order('data', { ascending: false })
      .order('hora', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('Tabela de glicemia sem dados:', error.message);
      setGlicemia(null);
      return;
    }

    setGlicemia(data || null);
  }

  async function carregarDados() {
    try {
      setLoading(true);
      await Promise.all([
        carregarPaciente(),
        carregarRefeicoes(),
        carregarGlicemia(),
      ]);
    } catch (error) {
      console.log('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleLogout() {
    try {
      setMenuVisivel(false);
      setSaindo(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.log('Erro ao sair:', error.message);
      }

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.log('Erro inesperado no logout:', error);
      Alert.alert('Erro', 'Não foi possível sair da conta.');
    } finally {
      setSaindo(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, [idPaciente]);

  const onRefresh = () => {
    setRefreshing(true);
    carregarDados();
  };

  const nomeUsuario =
    paciente?.nome_completo ||
    usuarioLogado?.nome_completo ||
    usuarioLogado?.user_metadata?.full_name ||
    usuarioLogado?.user_metadata?.name ||
    usuarioLogado?.email_pac ||
    usuarioLogado?.email ||
    'Paciente';

  const emailUsuario =
    paciente?.email_pac ||
    usuarioLogado?.email_pac ||
    usuarioLogado?.email ||
    null;

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.loadingText}>Carregando seus dados...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <MenuLateral
        visivel={menuVisivel}
        aoFechar={() => setMenuVisivel(false)}
        onNavigate={navigation.navigate}
        onLogout={handleLogout}
        usuario={nomeUsuario}
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>
            Glic<Text style={styles.logoDark}>Nutri</Text>
          </Text>
          <Text style={styles.headerSubtitle}>Sua rotina de saúde em um só lugar</Text>
        </View>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setMenuVisivel(true)}
          disabled={saindo}
        >
          <Ionicons name="menu-outline" size={26} color="#22C55E" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={[styles.scroll, Platform.OS === 'web' && styles.webScroll]}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === 'web' && styles.webScrollContent,
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <Text style={styles.greeting}>Olá, {nomeUsuario} 👋</Text>
        <Text style={styles.subtitle}>
          {emailUsuario
            ? `Conta conectada: ${emailUsuario}`
            : 'Acompanhe seu plano nutricional e seus indicadores do dia.'}
        </Text>

        <View style={styles.quickRow}>
          <View style={styles.quickCard}>
            <View style={styles.quickIconGreen}>
              <Ionicons name="pulse-outline" size={20} color="#22C55E" />
            </View>
            <Text style={styles.quickTitle}>Glicose</Text>
            <Text style={styles.quickValue}>
              {glicemia?.valor_glicose_mgd
                ? `${glicemia.valor_glicose_mgd} mg/dL`
                : 'Sem dados'}
            </Text>
          </View>

          <View style={styles.quickCard}>
            <View style={styles.quickIconBlue}>
              <MaterialCommunityIcons name="food-apple-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.quickTitle}>Refeições</Text>
            <Text style={styles.quickValue}>{refeicoes.length}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Plano / refeições</Text>

        {refeicoes.length > 0 ? (
          refeicoes.map((item, index) => (
            <View key={item.id_reflexao_planejada_uuid || item.id || index} style={styles.mealCard}>
              <Text style={styles.mealName}>
                {item.tipo_refeicao || item.nome_refeicao || `Refeição ${index + 1}`}
              </Text>

              <Text style={styles.mealDetails}>
                {item.horario_refeicao || item.hora_refeicao || '--:--'}
              </Text>

              <Text style={styles.mealDesc}>
                {item.descricao_refeicao ||
                  item.alimentos_planejados ||
                  'Sem descrição cadastrada.'}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Nenhuma refeição encontrada no banco.</Text>
          </View>
        )}
      </ScrollView>

      {saindo ? (
        <View style={styles.overlaySaindo}>
          <ActivityIndicator size="large" color="#22C55E" />
          <Text style={styles.saindoTexto}>Saindo...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  header: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f4f4f4',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...softGreenBorder,
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#22C55E',
  },
  logoDark: {
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  webScroll: {
    height: '100vh',
    maxHeight: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 36,
  },
  webScrollContent: {
    flexGrow: 0,
    minHeight: '100%',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickCard: {
    width: '48.5%',
    backgroundColor: '#f4f4f4',
    borderRadius: 20,
    padding: 16,
    ...softGreenBorder,
  },
  quickIconGreen: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#ECFDF3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickIconBlue: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickTitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  quickValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  mealCard: {
    backgroundColor: '#f4f4f4',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    ...softGreenBorder,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  mealDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  mealDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: '#f4f4f4',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    ...softGreenBorder,
  },
  emptyText: {
    color: '#6B7280',
  },
  overlaySaindo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saindoTexto: {
    marginTop: 12,
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
});
