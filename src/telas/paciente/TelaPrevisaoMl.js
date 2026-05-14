import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { patientTheme, patientShadow } from '../../temas/temaVisualPaciente';
import { mlHealthcheck, mlPredict } from '../../servicos/servicoMlLocal';
import MensagemInline from '../../componentes/comum/MensagemInline';

function toNumber(value) {
  const normalized = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(normalized) ? normalized : 0;
}

function formatProb(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return '--';
  return `${Math.round(v * 100)}%`;
}

function riskLabel(prob) {
  if (!Number.isFinite(prob)) return 'Indisponível';
  if (prob < 0.25) return 'Baixo';
  if (prob < 0.6) return 'Médio';
  return 'Alto';
}

export default function TelaPrevisaoMl({ route }) {
  const usuarioLogado = route?.params?.usuarioLogado || null;

  const [host, setHost] = useState('');
  const [port, setPort] = useState('8001');

  const [form, setForm] = useState({
    n_leituras_glicemia: '4',
    carbs_sum_g: '95',
    kcal_sum: '850',
    protein_sum_g: '40',
    fat_sum_g: '30',
    n_refeicoes_ia: '2',
    n_eventos_medicacao: '1',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [mensagemTopo, setMensagemTopo] = useState(null);

  const connectionOptions = useMemo(
    () => ({
      host: host?.trim() ? host.trim() : undefined,
      port: toNumber(port) || 8001,
    }),
    [host, port]
  );

  async function handleTestConnection() {
    try {
      setLoading(true);
      const res = await mlHealthcheck(connectionOptions);
      setMensagemTopo({
        tipo: 'sucesso',
        texto: `Conexão OK — servidor respondeu: ${res?.status || 'ok'}`,
      });
    } catch (error) {
      setMensagemTopo({
        tipo: 'erro',
        texto: `Não consegui conectar: ${error?.message || error}. Dica: emulador Android usa 10.0.2.2; no celular use o IP do PC.`,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePredict() {
    try {
      setLoading(true);
      setResult(null);

      const payload = {
        n_leituras_glicemia: toNumber(form.n_leituras_glicemia),
        carbs_sum_g: toNumber(form.carbs_sum_g),
        kcal_sum: toNumber(form.kcal_sum),
        protein_sum_g: toNumber(form.protein_sum_g),
        fat_sum_g: toNumber(form.fat_sum_g),
        n_refeicoes_ia: toNumber(form.n_refeicoes_ia),
        n_eventos_medicacao: toNumber(form.n_eventos_medicacao),
      };

      const res = await mlPredict(payload, connectionOptions);
      setResult(res);
    } catch (error) {
      setMensagemTopo({
        tipo: 'erro',
        texto: error?.message || String(error) || 'Erro ao prever.',
      });
    } finally {
      setLoading(false);
    }
  }

  const prob = Number(result?.prob_glucose_elevada);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {mensagemTopo?.texto ? (
          <MensagemInline
            tipo={mensagemTopo.tipo || 'aviso'}
            texto={mensagemTopo.texto}
            onFechar={() => setMensagemTopo(null)}
          />
        ) : null}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="analytics-outline" size={22} color={patientTheme.colors.primaryDark} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Previsão (Machine Learning)</Text>
            <Text style={styles.subtitle}>
              Teste local: o app chama sua API `uvicorn` e mostra a probabilidade de glicemia elevada.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Conexão</Text>
          <Text style={styles.cardHelper}>
            - Emulador Android: host padrão é 10.0.2.2{'\n'}
            - iOS/Web: 127.0.0.1{'\n'}
            - Celular real: use o IP do seu PC na mesma rede
          </Text>

          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.label}>Host (opcional)</Text>
              <TextInput
                value={host}
                onChangeText={setHost}
                placeholder="127.0.0.1"
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={[styles.field, styles.fieldPort]}>
              <Text style={styles.label}>Porta</Text>
              <TextInput
                value={port}
                onChangeText={setPort}
                placeholder="8001"
                style={styles.input}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.buttonOutline]}
            activeOpacity={0.85}
            onPress={handleTestConnection}
            disabled={loading}
          >
            <Text style={styles.buttonOutlineText}>Testar conexão (/health)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dados do dia</Text>
          <Text style={styles.cardHelper}>
            Para testes, preencha valores resumidos do seu dia (igual ao endpoint `/predict`).
          </Text>

          {Object.entries({
            n_leituras_glicemia: 'Leituras de glicemia (n)',
            carbs_sum_g: 'Carboidratos (g)',
            kcal_sum: 'Calorias (kcal)',
            protein_sum_g: 'Proteínas (g)',
            fat_sum_g: 'Gorduras (g)',
            n_refeicoes_ia: 'Refeições (n)',
            n_eventos_medicacao: 'Eventos de medicação (n)',
          }).map(([key, label]) => (
            <View key={key} style={styles.fieldFull}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                value={form[key]}
                onChangeText={(text) => setForm((prev) => ({ ...prev, [key]: text }))}
                style={styles.input}
                keyboardType="numeric"
              />
            </View>
          ))}

          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.85}
            onPress={handlePredict}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={patientTheme.colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Gerar previsão</Text>
            )}
          </TouchableOpacity>
        </View>

        {result ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Resultado</Text>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Risco (prob.)</Text>
              <Text style={styles.resultValue}>{formatProb(prob)} ({riskLabel(prob)})</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Classe</Text>
              <Text style={styles.resultValue}>{String(result?.classe_glucose_elevada ?? '--')}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Glicemia média prevista</Text>
              <Text style={styles.resultValue}>
                {Number.isFinite(Number(result?.glucose_mean_previsto_mg_dl))
                  ? `${Number(result.glucose_mean_previsto_mg_dl).toFixed(1)} mg/dL`
                  : '--'}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Cluster</Text>
              <Text style={styles.resultValue}>{String(result?.cluster_id ?? '--')}</Text>
            </View>

            <Text style={styles.smallPrint}>
              Usuário logado: {usuarioLogado?.email_pac || usuarioLogado?.email || '—'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: patientTheme.colors.background,
  },
  content: {
    padding: patientTheme.spacing.screen,
    paddingTop: 18,
    paddingBottom: 42,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: patientTheme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: patientTheme.colors.text,
  },
  subtitle: {
    marginTop: 6,
    color: patientTheme.colors.textMuted,
    lineHeight: 18,
  },
  card: {
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.xl,
    padding: patientTheme.spacing.card,
    marginTop: 12,
    ...patientShadow,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: patientTheme.colors.text,
  },
  cardHelper: {
    marginTop: 8,
    color: patientTheme.colors.textMuted,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  field: {
    flex: 1,
  },
  fieldPort: {
    maxWidth: 110,
  },
  fieldFull: {
    marginTop: 12,
  },
  label: {
    fontSize: 12,
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 10 : 12,
    backgroundColor: '#ffffff',
    color: patientTheme.colors.text,
  },
  button: {
    marginTop: 16,
    backgroundColor: patientTheme.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: patientTheme.colors.onPrimary,
    fontWeight: '800',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: patientTheme.colors.primary,
  },
  buttonOutlineText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '800',
  },
  resultRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  resultLabel: {
    color: patientTheme.colors.textMuted,
    fontWeight: '700',
  },
  resultValue: {
    color: patientTheme.colors.text,
    fontWeight: '900',
  },
  smallPrint: {
    marginTop: 14,
    color: patientTheme.colors.textMuted,
    fontSize: 11,
  },
});

