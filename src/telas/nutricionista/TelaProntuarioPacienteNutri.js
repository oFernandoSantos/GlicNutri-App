import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RolagemComTeclado } from '../../componentes/comum/RolagemComTeclado';
import { Ionicons } from '@expo/vector-icons';
import {
  AvatarBadge,
  FilterTabs,
  ProgressBar,
  RiskBadge,
  SectionCard,
  TrendChartCard,
} from '../../componentes/nutricionista/NutriDesktopUI';
import RegistrosPacienteNutriSection from '../../componentes/nutricionista/RegistrosPacienteNutriSection';
import {
  fetchGlucoseReadings,
  fetchPatientById,
  fetchPatientExperience,
  fetchPatientRegistrosForNutri,
  getLatestGlucose,
  resolveCanonicalPatientId,
} from '../../servicos/servicoDadosPaciente';
import { sortRegistrosNewestFirst } from '../../utilitarios/registrosProntuarioNutri';
import { mesclarLimitesDadosPaciente } from '../../servicos/limitesDadosPaciente';
import {
  averageAdherence,
  buildWeeklyAdherenceFromMeals,
} from '../../utilitarios/adesaoNutricional';
import { pickGlucoseReadingsForRecentChart } from '../../utilitarios/dataLocal';
import {
  getCachedGlucoseReadings,
  isGlucoseCacheFresh,
  mergeCachedGlucoseReadings,
} from '../../servicos/centralGlicose';
import { garantirSessaoRpcClinicaComPerfil } from '../../servicos/servicoSessaoRpc';
import { carregarSessaoNutricionista } from '../../servicos/servicoSessaoNutricionista';
import { invalidatePatientExperienceCache } from '../../servicos/cacheExperienciaPaciente';
import {
  disableOtherMealPlansForPatient,
  fetchActiveMealPlanForPatient,
  upsertMealPlan,
} from '../../servicos/servicoPlanoAlimentar';
import {
  getNutritionistId,
  isPatientLinkedToNutritionist,
} from '../../servicos/servicoVinculosNutricionista';
import {
  fetchProntuarioCompleto,
  upsertProntuarioBase,
  addAntropometria,
  addEvolucao,
  upsertMetaClinica,
  fetchConsultasHistorico,
} from '../../servicos/servicoProntuarioCompleto';
import { nutriTheme as patientTheme, nutriShadow as patientShadow } from '../../temas/temaVisualNutricionista';
import { exportNutritionistPatientReport } from '../../servicos/servicoRelatoriosNutricionista';

const detailTabs = [
  { value: 'overview',  label: 'Visão Geral' },
  { value: 'clinico',   label: 'Clínico' },
  { value: 'evolucao',  label: 'Evolução' },
  { value: 'registros', label: 'Registros' },
  { value: 'plan',      label: 'Plano' },
  { value: 'historico', label: 'Consultas' },
  { value: 'goals',     label: 'Metas' },
  { value: 'personal',  label: 'Dados' },
];

function calculateAge(value) {
  const birth = value ? new Date(value) : null;
  if (!birth || Number.isNaN(birth.getTime())) return '--';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : '--';
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('pt-BR');
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function resolverAlturaCm(ultAnt, patient) {
  return ultAnt?.altura_cm || patient?.alturaAtual || patient?.rawData?.altura_cm || null;
}

function calcBmi(pesoKg, alturaCm) {
  const p = Number(pesoKg);
  const a = Number(alturaCm) / 100;
  if (!p || !a) return null;
  return (p / (a * a)).toFixed(1);
}

const GLUCOSE_CHART_FETCH_LIMIT = 120;

function buildGlucose12hSeries(readings = []) {
  const merged = mergeCachedGlucoseReadings(readings);
  return pickGlucoseReadingsForRecentChart(merged, 12).map((reading, index) => ({
    id: reading.id || `glucose-12h-${index}`,
    value: Number(reading.value) || 0,
    label: String(reading.time || '').trim().slice(0, 5) || `${index + 1}`,
    time: reading.time,
  }));
}

function readCachedGlucose12hSeries(patientId) {
  if (!patientId || !isGlucoseCacheFresh(patientId)) return [];
  return buildGlucose12hSeries(getCachedGlucoseReadings(patientId));
}

function normalizePatientForProntuario(patient) {
  if (!patient) return null;
  const raw = patient.raw || patient;
  const name = patient.name || raw.nome_completo || raw.nome_pac || raw.email_pac || 'Paciente';
  const objective =
    patient.objective ||
    raw.objetivo_principal ||
    raw.objetivo ||
    raw.diagnostico_principal ||
    'Acompanhamento';
  const latestGlucose = patient.latestGlucose || raw.glicemia_atual || raw.ultima_glicemia_mgdl || '--';

  return {
    ...patient,
    id: patient.id || raw.id_paciente_uuid,
    name,
    age: patient.age || calculateAge(raw.data_nascimento),
    bmi: patient.bmi || raw.imc_calculado || raw.imc_atual || '--',
    pesoAtual: raw.peso_atual_kg || null,
    alturaAtual: raw.altura_cm || null,
    specialtyTag: patient.specialtyTag || objective,
    risk: patient.risk || 'Baixo',
    latestGlucose,
    trendText: patient.trendText || 'Acompanhe a evolução pelos registros do paciente.',
    adherence: Number(patient.adherence || raw.adesao_percentual || 78),
    alerts: Number(patient.alerts || 0),
    notes: patient.notes || raw.observacoes || 'Paciente vinculado ao acompanhamento nutricional.',
    glucose12h: patient.glucose12h || [],
    planMeals: patient.planMeals || [],
    goals: patient.goals || [],
    recommendations: patient.recommendations || ['Revisar registros recentes', 'Ajustar metas na consulta'],
    comorbidities: patient.comorbidities || [raw.condicoes_saude || raw.comorbidades_texto || 'Não informado'],
    medications: patient.medications || [raw.medicamentos_uso_continuo || 'Não informado'],
    personalData: patient.personalData || {
      email: raw.email_pac || 'Não informado',
      phone: raw.telefone || raw.telefone_paciente || 'Não informado',
      city: raw.cidade || 'Não informado',
    },
    rawData: raw,
  };
}

// ──────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────
export default function TelaProntuarioPacienteNutri({ navigation, route }) {
  const { pacienteId, paciente, usuarioLogado } = route.params || {};
  const nutricionistaId = useMemo(() => getNutritionistId(usuarioLogado), [usuarioLogado]);

  // ── Estado base ──────────────────────────────────────────────────
  const [patientRecord, setPatientRecord] = useState(null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [activeMealPlan, setActiveMealPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState(null);
  const [linkedToNutri, setLinkedToNutri] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [planTitle, setPlanTitle] = useState('Plano alimentar');
  const [mealTitle, setMealTitle] = useState('');
  const [mealTime, setMealTime] = useState('');
  const [mealObjective, setMealObjective] = useState('');
  const [mealFoods, setMealFoods] = useState('');
  const [mealSubstitutions, setMealSubstitutions] = useState('');
  const [mealSummary, setMealSummary] = useState('');
  const [mealDetailsOpen, setMealDetailsOpen] = useState(false);
  const [extraMeals, setExtraMeals] = useState([]);
  const [patientExperience, setPatientExperience] = useState(null);
  const [experienceLoadError, setExperienceLoadError] = useState('');
  const initialChartPatientId =
    pacienteId || paciente?.id || paciente?.raw?.id_paciente_uuid || null;
  const [glucose12hChart, setGlucose12hChart] = useState(() =>
    readCachedGlucose12hSeries(initialChartPatientId)
  );
  const [loadingGlucose12h, setLoadingGlucose12h] = useState(
    () => !readCachedGlucose12hSeries(initialChartPatientId).length
  );
  const glucose12hLoadPatientRef = useRef(null);

  // ── Estado prontuário completo ───────────────────────────────────
  const [prontuarioCompleto, setProntuarioCompleto] = useState(null);
  const [loadingProntuario, setLoadingProntuario] = useState(false);
  const prontuarioLoadSeqRef = useRef(0);
  const prontuarioLoadedPatientRef = useRef(null);
  const experienceLoadedPatientRef = useRef(null);
  const [savingProntuario, setSavingProntuario] = useState(false);
  const [prontuarioMsg, setProntuarioMsg] = useState(null);

  // Formulário prontuário base
  const [pQueixa, setPQueixa] = useState('');
  const [pHistorico, setPHistorico] = useState('');
  const [pDiagnosticos, setPDiagnosticos] = useState('');
  const [pAlergias, setPAlergias] = useState('');
  const [pComorbidades, setPComorbidades] = useState('');
  const [pTipoDiabetes, setPTipoDiabetes] = useState('');
  const [pObservacoes, setPObservacoes] = useState('');
  const [editProntuario, setEditProntuario] = useState(false);

  // Formulário antropometria
  const [antPeso, setAntPeso] = useState('');
  const [antAltura, setAntAltura] = useState('');
  const [antCirc, setAntCirc] = useState('');
  const [antObs, setAntObs] = useState('');
  const [savingAnt, setSavingAnt] = useState(false);
  const [antMsg, setAntMsg] = useState(null);

  // ── Estado evolução clínica ──────────────────────────────────────
  const [evolucaoSubjetivo, setEvolucaoSubjetivo] = useState('');
  const [evolucaoAvaliacao, setEvolucaoAvaliacao] = useState('');
  const [evolucaoPlano, setEvolucaoPlano] = useState('');
  const [evolucaoOrientacoes, setEvolucaoOrientacoes] = useState('');
  const [savingEvolucao, setSavingEvolucao] = useState(false);
  const [evolucaoMsg, setEvolucaoMsg] = useState(null);

  // ── Estado registros do paciente ─────────────────────────────────
  const [glicemias, setGlicemias] = useState([]);
  const [medicacoes, setMedicacoes] = useState([]);
  const [insulinas, setInsulinas] = useState([]);
  const [refeicoes, setRefeicoes] = useState([]);
  const [loadingRegistros, setLoadingRegistros] = useState(false);
  const [registrosLoadError, setRegistrosLoadError] = useState('');
  const loadRegistrosRef = useRef(null);
  const [nutriSessaoPersistida, setNutriSessaoPersistida] = useState(null);

  useEffect(() => {
    let active = true;
    carregarSessaoNutricionista()
      .then((sessao) => {
        if (active) setNutriSessaoPersistida(sessao || null);
      })
      .catch(() => {
        if (active) setNutriSessaoPersistida(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const nutriRpcActor = useMemo(() => {
    const base = nutriSessaoPersistida || usuarioLogado || {};
    const resolvedNutriId =
      nutricionistaId || getNutritionistId(base) || getNutritionistId(usuarioLogado);
    const email =
      base?.email_acesso ||
      usuarioLogado?.email_acesso ||
      base?.email ||
      usuarioLogado?.email ||
      base?.email_nutri ||
      usuarioLogado?.email_nutri ||
      '';
    return {
      tipo_perfil: 'nutricionista',
      id_nutricionista_uuid: resolvedNutriId,
      email_acesso: email,
      email,
      nome_completo_nutri:
        base?.nome_completo_nutri || usuarioLogado?.nome_completo_nutri || null,
    };
  }, [nutriSessaoPersistida, nutricionistaId, usuarioLogado]);

  // ── Estado histórico de consultas ────────────────────────────────
  const [consultasHistorico, setConsultasHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [reportPeriod, setReportPeriod] = useState('7days');
  const [reportMode, setReportMode] = useState('visual');
  const [exportingReport, setExportingReport] = useState(false);

  // ── Estado metas clínicas ────────────────────────────────────────
  const [editMeta, setEditMeta] = useState(false);
  const [metaHba1c, setMetaHba1c] = useState('');
  const [metaGlicemia, setMetaGlicemia] = useState('');
  const [metaCalorias, setMetaCalorias] = useState('');
  const [metaCarbo, setMetaCarbo] = useState('');
  const [metaProt, setMetaProt] = useState('');
  const [metaGord, setMetaGord] = useState('');
  const [metaObs, setMetaObs] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaMsg, setMetaMsg] = useState(null);

  // ──────────────────────────────────────────────────────────────────
  // Efeitos
  // ──────────────────────────────────────────────────────────────────

  // Carregar dados base do paciente
  useEffect(() => {
    let active = true;
    if (paciente || !pacienteId) { setPatientRecord(null); return; }
    async function load() {
      try {
        setLoadingPatient(true);
        const data = await fetchPatientById(pacienteId);
        if (active) setPatientRecord(data || null);
      } catch (_) {
        if (active) setPatientRecord(null);
      } finally {
        if (active) setLoadingPatient(false);
      }
    }
    load();
    return () => { active = false; };
  }, [paciente, pacienteId]);

  const [resolvedPatientId, setResolvedPatientId] = useState(
    () => pacienteId || paciente?.id || paciente?.raw?.id_paciente_uuid || null
  );

  useEffect(() => {
    let active = true;
    const seed = paciente?.raw || patientRecord || paciente;
    const candidate = pacienteId || paciente?.id || patientRecord?.id_paciente_uuid;
    if (!candidate) return;

    resolveCanonicalPatientId(candidate, {
      patientContext: nutriRpcActor,
      currentPatient: seed,
    })
      .then((canonical) => {
        if (active) setResolvedPatientId(canonical || candidate);
      })
      .catch(() => {
        if (active) setResolvedPatientId(candidate);
      });

    return () => {
      active = false;
    };
  }, [nutriRpcActor, paciente, pacienteId, patientRecord]);

  const chartPatientId = useMemo(
    () =>
      resolvedPatientId ||
      pacienteId ||
      paciente?.id ||
      paciente?.raw?.id_paciente_uuid ||
      null,
    [resolvedPatientId, pacienteId, paciente]
  );

  const loadGlucose12hChart = useCallback(
    async (patientId, { force = false } = {}) => {
      if (!patientId) return;
      if (!force && glucose12hLoadPatientRef.current === patientId) return;

      const hasCachedSeries = readCachedGlucose12hSeries(patientId).length > 0;
      if (!hasCachedSeries) setLoadingGlucose12h(true);

      try {
        if (!nutriRpcActor?.id_nutricionista_uuid) return;
        await garantirSessaoRpcClinicaComPerfil(nutriRpcActor).catch(() => {});
        const readings = await fetchGlucoseReadings(
          patientId,
          GLUCOSE_CHART_FETCH_LIMIT,
          nutriRpcActor
        );
        glucose12hLoadPatientRef.current = patientId;
        setGlucose12hChart(buildGlucose12hSeries(readings));
      } catch (_) {
        glucose12hLoadPatientRef.current = patientId;
        if (!readCachedGlucose12hSeries(patientId).length) {
          setGlucose12hChart([]);
        }
      } finally {
        setLoadingGlucose12h(false);
      }
    },
    [nutriRpcActor]
  );

  useEffect(() => {
    if (!chartPatientId || !nutriRpcActor?.id_nutricionista_uuid) return;
    if (glucose12hLoadPatientRef.current === chartPatientId) return;
    loadGlucose12hChart(chartPatientId);
  }, [chartPatientId, loadGlucose12hChart, nutriRpcActor?.id_nutricionista_uuid]);

  // Carregar experiência do paciente (glicemia, medicação, refeições para visão geral e registros)
  useEffect(() => {
    let active = true;
    if (!chartPatientId || !nutriRpcActor?.id_nutricionista_uuid) return;

    const limites = mesclarLimitesDadosPaciente('prontuario', { includeHidden: true });
    const forceRefresh = experienceLoadedPatientRef.current !== chartPatientId;

    async function load() {
      try {
        setExperienceLoadError('');
        if (nutriRpcActor?.id_nutricionista_uuid) {
          await garantirSessaoRpcClinicaComPerfil(nutriRpcActor).catch(() => {});
        }
        const exp = await fetchPatientExperience(chartPatientId, {
          ...limites,
          skipChat: true,
          patientContext: nutriRpcActor,
          currentPatient:
            patientRecord ||
            paciente?.raw ||
            (paciente?.id ? { id_paciente_uuid: paciente.id } : { id_paciente_uuid: chartPatientId }),
          forceRefresh,
        });
        if (!active) return;
        experienceLoadedPatientRef.current = chartPatientId;
        setPatientExperience(exp);
      } catch (error) {
        if (!active) return;
        experienceLoadedPatientRef.current = null;
        setPatientExperience(null);
        setExperienceLoadError(
          error?.message || 'Nao foi possivel carregar os dados clinicos deste paciente.'
        );
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [chartPatientId, nutriRpcActor, paciente, paciente?.id, paciente?.raw, patientRecord]);

  const currentPatient = useMemo(() => {
    const base = normalizePatientForProntuario(paciente || patientRecord || null);
    if (!base) return null;

    const mergedGlucose = patientExperience
      ? mergeCachedGlucoseReadings(patientExperience.glucoseReadings || [])
      : [];
    const experienceGlucose12h = patientExperience ? buildGlucose12hSeries(mergedGlucose) : [];
    const glucose12h = experienceGlucose12h.length ? experienceGlucose12h : glucose12hChart;
    const latestGlucose = getLatestGlucose(mergedGlucose);

    if (!patientExperience) {
      return {
        ...base,
        glucose12h,
        latestGlucose: latestGlucose?.value ?? base.latestGlucose,
        trendText: latestGlucose?.value
          ? `Última leitura: ${latestGlucose.value} mg/dL`
          : base.trendText,
      };
    }

    const { items } = buildWeeklyAdherenceFromMeals(patientExperience.appState?.mealEntries, 3);
    const adherence = averageAdherence(items);

    return {
      ...base,
      adherence: adherence || base.adherence,
      latestGlucose: latestGlucose?.value ?? base.latestGlucose,
      glucose12h,
      trendText: latestGlucose?.value ? `Última leitura: ${latestGlucose.value} mg/dL` : base.trendText,
    };
  }, [paciente, patientExperience, patientRecord, glucose12hChart]);

  const effectivePacienteId = useMemo(
    () => resolvedPatientId || pacienteId || currentPatient?.id || null,
    [resolvedPatientId, pacienteId, currentPatient]
  );

  // Carregar plano alimentar
  useEffect(() => {
    let active = true;
    if (!effectivePacienteId || !nutricionistaId) return;
    async function load() {
      try {
        setLoadingPlan(true);
        const [vinculado, plano] = await Promise.all([
          isPatientLinkedToNutritionist({ pacienteId: effectivePacienteId, nutricionistaId }),
          fetchActiveMealPlanForPatient(effectivePacienteId),
        ]);
        if (!active) return;
        setLinkedToNutri(vinculado);
        setActiveMealPlan(plano || null);
        setPlanTitle(plano?.titulo || 'Plano alimentar');
        const refeicoesSalvas = Array.isArray(plano?.metas?.planSections)
          ? plano.metas.planSections
          : Array.isArray(plano?.metas?.refeicoes) ? plano.metas.refeicoes : [];
        setExtraMeals(refeicoesSalvas);
      } catch (error) {
        if (active) setPlanMessage({ tipo: 'erro', texto: 'Não foi possível carregar o plano alimentar.' });
      } finally {
        if (active) setLoadingPlan(false);
      }
    }
    load();
    return () => { active = false; };
  }, [effectivePacienteId, nutricionistaId]);

  // Carregar prontuário completo (lazy — só quando tab clinico/evolucao/goals for aberto)
  const loadProntuario = useCallback(async ({ force = false } = {}) => {
    if (!effectivePacienteId) return;
    const seq = ++prontuarioLoadSeqRef.current;
    const showLoader = force ? false : prontuarioLoadedPatientRef.current !== effectivePacienteId;
    try {
      if (showLoader) setLoadingProntuario(true);
      const resultado = await fetchProntuarioCompleto(effectivePacienteId);
      if (seq !== prontuarioLoadSeqRef.current) return;
      prontuarioLoadedPatientRef.current = effectivePacienteId;
      setProntuarioCompleto(resultado);
      // Preenche formulário com dados existentes
      if (resultado?.prontuario) {
        const p = resultado.prontuario;
        setPQueixa(p.queixa_principal || '');
        setPHistorico(p.historico_doenca_atual || '');
        setPDiagnosticos((p.diagnosticos_cid || []).join(', '));
        setPAlergias((p.alergias || []).join(', '));
        setPComorbidades((p.comorbidades || []).join(', '));
        setPTipoDiabetes(p.tipo_diabetes || '');
        setPObservacoes(p.observacoes_gerais || '');
      }
      if (resultado?.ultimaAntropometria) {
        const a = resultado.ultimaAntropometria;
        const alturaRegistrada =
          a.altura_cm || patientRecord?.altura_cm || paciente?.raw?.altura_cm || null;
        setAntPeso(String(a.peso_kg || patientRecord?.peso_atual_kg || paciente?.raw?.peso_atual_kg || ''));
        setAntAltura(String(alturaRegistrada || ''));
        setAntCirc(String(a.circunferencia_abdominal_cm || ''));
      } else {
        const alturaRegistrada = patientRecord?.altura_cm || paciente?.raw?.altura_cm || null;
        const pesoRegistrado = patientRecord?.peso_atual_kg || paciente?.raw?.peso_atual_kg || null;
        if (pesoRegistrado) setAntPeso(String(pesoRegistrado));
        if (alturaRegistrada) setAntAltura(String(alturaRegistrada));
      }
      if (resultado?.metaAtiva) {
        const m = resultado.metaAtiva;
        setMetaHba1c(String(m.meta_hba1c_pct || ''));
        setMetaGlicemia(String(m.meta_glicemia_jejum_mgdl || ''));
        setMetaCalorias(String(m.meta_calorias_dia || ''));
        setMetaCarbo(String(m.meta_carboidratos_g || ''));
        setMetaProt(String(m.meta_proteinas_g || ''));
        setMetaGord(String(m.meta_gorduras_g || ''));
        setMetaObs(m.observacao || '');
      }
    } catch (_) {
      if (seq !== prontuarioLoadSeqRef.current) return;
      prontuarioLoadedPatientRef.current = null;
      setProntuarioCompleto(null);
    } finally {
      if (seq === prontuarioLoadSeqRef.current) setLoadingProntuario(false);
    }
  }, [
    effectivePacienteId,
    paciente?.raw?.altura_cm,
    paciente?.raw?.peso_atual_kg,
    patientRecord?.altura_cm,
    patientRecord?.peso_atual_kg,
  ]);

  useEffect(() => {
    prontuarioLoadSeqRef.current += 1;
    prontuarioLoadedPatientRef.current = null;
    experienceLoadedPatientRef.current = null;
    if (effectivePacienteId) {
      invalidatePatientExperienceCache(effectivePacienteId);
    }
    setPatientExperience(null);
    setExperienceLoadError('');
    setProntuarioCompleto(null);
    setLoadingProntuario(false);
  }, [effectivePacienteId]);

  // Carregar registros (lazy) — mesmos limites do histórico do paciente
  const patientRecordForRpc = useMemo(() => {
    const raw = paciente?.raw || patientRecord || null;
    if (raw?.id_paciente_uuid) return raw;
    if (effectivePacienteId) {
      return { id_paciente_uuid: effectivePacienteId };
    }
    return null;
  }, [effectivePacienteId, paciente, patientRecord]);

  const reloadPatientExperience = useCallback(async () => {
    if (!chartPatientId) return;
    const limites = mesclarLimitesDadosPaciente('prontuario', { includeHidden: true });
    try {
      setExperienceLoadError('');
      if (nutriRpcActor?.id_nutricionista_uuid) {
        await garantirSessaoRpcClinicaComPerfil(nutriRpcActor);
      }
      invalidatePatientExperienceCache(chartPatientId);
      glucose12hLoadPatientRef.current = null;
      await loadGlucose12hChart(chartPatientId, { force: true });
      const exp = await fetchPatientExperience(chartPatientId, {
        ...limites,
        skipChat: true,
        patientContext: nutriRpcActor,
        currentPatient:
          patientRecord ||
          paciente?.raw ||
          (paciente?.id ? { id_paciente_uuid: paciente.id } : { id_paciente_uuid: chartPatientId }),
        forceRefresh: true,
      });
      experienceLoadedPatientRef.current = chartPatientId;
      setPatientExperience(exp);
    } catch (error) {
      experienceLoadedPatientRef.current = null;
      setPatientExperience(null);
      setExperienceLoadError(
        error?.message || 'Nao foi possivel carregar os dados clinicos deste paciente.'
      );
    }
  }, [
    chartPatientId,
    loadGlucose12hChart,
    nutriRpcActor,
    paciente,
    paciente?.id,
    paciente?.raw,
    patientRecord,
  ]);

  const loadRegistros = useCallback(async () => {
    if (!effectivePacienteId) return;
    if (!nutriRpcActor?.id_nutricionista_uuid) {
      setRegistrosLoadError('Nutricionista sem identificador. Saia e entre novamente.');
      return;
    }
    if (!nutriRpcActor?.email_acesso && !nutriRpcActor?.email) {
      setRegistrosLoadError(
        'E-mail da nutricionista nao encontrado na sessao. Saia e entre novamente.'
      );
      return;
    }

    const limites = mesclarLimitesDadosPaciente('prontuario', { includeHidden: true });
    try {
      setLoadingRegistros(true);
      setRegistrosLoadError('');

      if (nutriRpcActor?.id_nutricionista_uuid) {
        await garantirSessaoRpcClinicaComPerfil(nutriRpcActor);
      }

      const resultado = await fetchPatientRegistrosForNutri(effectivePacienteId, {
        rpcActor: nutriRpcActor,
        limits: limites,
        experience: patientExperience,
        currentPatient: patientRecordForRpc,
        forceRefresh: !patientExperience,
      });
      setGlicemias(sortRegistrosNewestFirst(resultado.glicemias || []));
      setMedicacoes(sortRegistrosNewestFirst(resultado.medicacoes || []));
      setInsulinas(sortRegistrosNewestFirst(resultado.insulinas || []));
      setRefeicoes(sortRegistrosNewestFirst(resultado.refeicoes || []));
      setRegistrosLoadError(resultado.error || '');
    } catch (error) {
      setGlicemias([]);
      setMedicacoes([]);
      setInsulinas([]);
      setRefeicoes([]);
      setRegistrosLoadError(
        error?.message || 'Nao foi possivel carregar os registros deste paciente.'
      );
    } finally {
      setLoadingRegistros(false);
    }
  }, [
    effectivePacienteId,
    nutriRpcActor,
    patientExperience,
    patientRecordForRpc,
  ]);

  useEffect(() => {
    loadRegistrosRef.current = loadRegistros;
  }, [loadRegistros]);

  // Carregar histórico de consultas (lazy)
  const loadHistorico = useCallback(async () => {
    if (!effectivePacienteId) return;
    try {
      setLoadingHistorico(true);
      const hist = await fetchConsultasHistorico(effectivePacienteId, nutricionistaId, 30);
      setConsultasHistorico(hist);
    } catch (_) {
      setConsultasHistorico([]);
    } finally {
      setLoadingHistorico(false);
    }
  }, [effectivePacienteId, nutricionistaId]);

  useEffect(() => {
    setGlicemias([]);
    setMedicacoes([]);
    setInsulinas([]);
    setRefeicoes([]);
    setRegistrosLoadError('');
  }, [effectivePacienteId]);

  // Lazy load por tab
  useEffect(() => {
    const tabPrecisaProntuario =
      activeTab === 'clinico' || activeTab === 'goals' || activeTab === 'evolucao';
    if (tabPrecisaProntuario && effectivePacienteId) {
      const jaCarregouPaciente = prontuarioLoadedPatientRef.current === effectivePacienteId;
      if (!jaCarregouPaciente) loadProntuario();
    }
    if (activeTab === 'registros' && effectivePacienteId) {
      loadRegistrosRef.current?.();
    }
    if (activeTab === 'historico' && consultasHistorico.length === 0) loadHistorico();
  }, [activeTab, effectivePacienteId, loadHistorico, loadProntuario, consultasHistorico.length]);

  useEffect(() => {
    if (
      activeTab !== 'registros' ||
      !effectivePacienteId ||
      !patientExperience ||
      !nutriRpcActor?.id_nutricionista_uuid
    ) {
      return;
    }
    loadRegistrosRef.current?.();
  }, [activeTab, effectivePacienteId, nutriRpcActor?.id_nutricionista_uuid, patientExperience]);

  const allMeals = useMemo(() => [...(currentPatient?.planMeals || []), ...extraMeals], [currentPatient, extraMeals]);

  // ──────────────────────────────────────────────────────────────────
  // Handlers plano alimentar
  // ──────────────────────────────────────────────────────────────────
  function buildDraftMeal(index = extraMeals.length) {
    if (!mealTitle.trim() || !mealTime.trim() || !mealSummary.trim()) return null;
    const foods = mealFoods.split(',').map(i => i.trim()).filter(Boolean);
    const substitutions = mealSubstitutions.split('\n').map(line => {
      const [anchor, rawOpts] = line.split(':');
      return { anchor: String(anchor || '').trim(), options: String(rawOpts || '').split(',').map(i => i.trim()).filter(Boolean) };
    }).filter(i => i.anchor && i.options.length);
    return { id: `extra-${index + 1}`, title: mealTitle.trim(), time: mealTime.trim(), objective: mealObjective.trim() || mealSummary.trim(), foods: foods.length ? foods : [mealSummary.trim()], substitutions, summary: mealSummary.trim() };
  }

  function clearMealDraft() {
    setMealTitle(''); setMealTime(''); setMealObjective('');
    setMealFoods(''); setMealSubstitutions(''); setMealSummary('');
  }

  function addMeal() {
    const draft = buildDraftMeal(extraMeals.length);
    if (!draft) return;
    setExtraMeals(curr => [...curr, draft]);
    clearMealDraft();
  }

  function removeMeal(id) {
    setExtraMeals(curr => curr.filter(m => m.id !== id));
  }

  function buildPlanDescription(meals) {
    return meals.map(m => {
      const foods = Array.isArray(m.foods) ? m.foods.join(', ') : m.summary || '';
      return `${m.time || '--:--'} - ${m.title || 'Refeição'}: ${foods}`;
    }).join('\n');
  }

  function normalizePlanSections(meals) {
    return meals.map((m, i) => ({
      id: m.id || `meal-${i + 1}`,
      title: m.title || 'Refeição', time: m.time || '--:--',
      objective: m.objective || m.summary || '',
      foods: Array.isArray(m.foods) && m.foods.length ? m.foods : [m.summary || 'Orientação alimentar'],
      substitutions: Array.isArray(m.substitutions) ? m.substitutions : [],
      summary: m.summary || '',
    }));
  }

  async function saveMealPlan() {
    const draftMeal = buildDraftMeal(allMeals.length);
    const mealsToSave = draftMeal ? [...allMeals, draftMeal] : allMeals;
    if (!linkedToNutri) { setPlanMessage({ tipo: 'erro', texto: 'Paciente não vinculado ao seu perfil.' }); return; }
    if (!mealsToSave.length) { setPlanMessage({ tipo: 'erro', texto: 'Adicione ao menos uma refeição.' }); return; }
    try {
      setSavingPlan(true); setPlanMessage(null);
      const planSections = normalizePlanSections(mealsToSave);
      const saved = await upsertMealPlan({
        id: activeMealPlan?.id, nutricionistaId, pacienteId: effectivePacienteId,
        titulo: planTitle, descricao: buildPlanDescription(planSections),
        metas: { planSections, refeicoes: planSections, totalRefeicoes: planSections.length },
        ativo: true, actor: usuarioLogado,
      });
      await disableOtherMealPlansForPatient({ pacienteId: effectivePacienteId, exceptId: saved?.id, actor: usuarioLogado });
      setActiveMealPlan(saved);
      setExtraMeals(Array.isArray(saved?.metas?.planSections) ? saved.metas.planSections : planSections);
      if (draftMeal) clearMealDraft();
      setPlanMessage({ tipo: 'sucesso', texto: 'Plano alimentar salvo.' });
    } catch (error) {
      setPlanMessage({ tipo: 'erro', texto: error?.message || 'Não foi possível salvar o plano.' });
    } finally {
      setSavingPlan(false);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Handlers prontuário
  // ──────────────────────────────────────────────────────────────────
  async function saveProntuario() {
    if (!effectivePacienteId) return;
    try {
      setSavingProntuario(true); setProntuarioMsg(null);
      await upsertProntuarioBase({
        pacienteId: effectivePacienteId,
        queixaPrincipal: pQueixa,
        historicoDomencaAtual: pHistorico,
        diagnosticosCid: pDiagnosticos.split(',').map(s => s.trim()).filter(Boolean),
        alergias: pAlergias.split(',').map(s => s.trim()).filter(Boolean),
        comorbidades: pComorbidades.split(',').map(s => s.trim()).filter(Boolean),
        tipoDiabetes: pTipoDiabetes,
        observacoesGerais: pObservacoes,
        actor: usuarioLogado,
      });
      setProntuarioMsg({ tipo: 'sucesso', texto: 'Prontuário salvo.' });
      setEditProntuario(false);
      await loadProntuario({ force: true });
    } catch (error) {
      setProntuarioMsg({ tipo: 'erro', texto: error?.message || 'Erro ao salvar prontuário.' });
    } finally {
      setSavingProntuario(false);
    }
  }

  async function saveAntropometria() {
    if (!effectivePacienteId) return;
    try {
      setSavingAnt(true); setAntMsg(null);
      await addAntropometria({
        pacienteId: effectivePacienteId,
        nutricionistaId,
        pesoKg: antPeso || null,
        alturaCm: antAltura || null,
        circAbdominalCm: antCirc || null,
        observacao: antObs,
        actor: usuarioLogado,
      });
      setAntMsg({ tipo: 'sucesso', texto: 'Aferição salva.' });
      await loadProntuario({ force: true });
    } catch (error) {
      setAntMsg({ tipo: 'erro', texto: error?.message || 'Erro ao salvar aferição.' });
    } finally {
      setSavingAnt(false);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Handlers evolução clínica
  // ──────────────────────────────────────────────────────────────────
  async function saveEvolucao() {
    if (!effectivePacienteId || !nutricionistaId) return;
    if (!evolucaoSubjetivo && !evolucaoAvaliacao && !evolucaoPlano) {
      setEvolucaoMsg({ tipo: 'erro', texto: 'Preencha ao menos um campo da evolução.' }); return;
    }
    try {
      setSavingEvolucao(true); setEvolucaoMsg(null);
      await addEvolucao({
        pacienteId: effectivePacienteId,
        nutricionistaId,
        subjetivo: evolucaoSubjetivo,
        avaliacao: evolucaoAvaliacao,
        plano: evolucaoPlano,
        orientacoes: evolucaoOrientacoes,
        actor: usuarioLogado,
      });
      setEvolucaoSubjetivo(''); setEvolucaoAvaliacao('');
      setEvolucaoPlano(''); setEvolucaoOrientacoes('');
      setEvolucaoMsg({ tipo: 'sucesso', texto: 'Evolução registrada.' });
      await loadProntuario({ force: true });
    } catch (error) {
      setEvolucaoMsg({ tipo: 'erro', texto: error?.message || 'Erro ao registrar evolução.' });
    } finally {
      setSavingEvolucao(false);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Handlers metas clínicas
  // ──────────────────────────────────────────────────────────────────
  async function saveMeta() {
    if (!effectivePacienteId || !nutricionistaId) return;
    try {
      setSavingMeta(true); setMetaMsg(null);
      await upsertMetaClinica({
        pacienteId: effectivePacienteId,
        nutricionistaId,
        metaHba1c: metaHba1c || null,
        metaGlicemiaJejum: metaGlicemia || null,
        metaCalorias: metaCalorias || null,
        metaCarboidratos: metaCarbo || null,
        metaProteinas: metaProt || null,
        metaGorduras: metaGord || null,
        observacao: metaObs,
        actor: usuarioLogado,
      });
      setMetaMsg({ tipo: 'sucesso', texto: 'Metas salvas.' });
      setEditMeta(false);
      await loadProntuario({ force: true });
    } catch (error) {
      setMetaMsg({ tipo: 'erro', texto: error?.message || 'Erro ao salvar metas.' });
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleExportPatientReport() {
    if (!currentPatient) return;
    try {
      setExportingReport(true);
      const result = await exportNutritionistPatientReport(
        {
          usuarioLogado,
          patient: {
            ...(currentPatient.rawData || {}),
            ...currentPatient,
            id_paciente_uuid: currentPatient.id,
            nome_completo: currentPatient.name,
            data_nascimento: currentPatient.rawData?.data_nascimento,
            peso_atual_kg: currentPatient.pesoAtual || currentPatient.rawData?.peso_atual_kg,
            altura_cm: currentPatient.rawData?.altura_cm,
            imc_calculado: currentPatient.bmi !== '--' ? currentPatient.bmi : currentPatient.rawData?.imc_calculado,
          },
          period: reportPeriod,
        },
        { mode: reportMode, format: 'pdf' }
      );
      if (result?.ok) {
        Alert.alert(
          'Relatório do paciente',
          Platform.OS === 'web'
            ? 'O PDF foi baixado para o seu dispositivo.'
            : 'O PDF foi gerado. Escolha onde salvar ou compartilhar.'
        );
      }
    } catch (error) {
      Alert.alert('Relatório do paciente', error?.message || 'Não foi possível emitir o relatório.');
    } finally {
      setExportingReport(false);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Renderização
  // ──────────────────────────────────────────────────────────────────
  if (loadingPatient && !currentPatient) {
    return (
      <View style={styles.emptyWrap}>
        <ActivityIndicator color={patientTheme.colors.primaryDark} />
        <Text style={styles.emptyTitle}>Carregando paciente...</Text>
      </View>
    );
  }

  if (!currentPatient) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Paciente não encontrado</Text>
      </View>
    );
  }

  const ultAnt = prontuarioCompleto?.ultimaAntropometria;
  const alturaRegistrada = resolverAlturaCm(ultAnt, currentPatient);
  const pesoExibir = ultAnt?.peso_kg || currentPatient?.pesoAtual || '--';
  const alturaExibir = alturaRegistrada || '--';
  const circExibir = ultAnt?.circunferencia_abdominal_cm || '--';
  const imcExibir = ultAnt
    ? (calcBmi(ultAnt.peso_kg, alturaRegistrada) ?? currentPatient.bmi)
    : (calcBmi(currentPatient?.pesoAtual, alturaRegistrada) ?? currentPatient.bmi);
  const metaAtiva = prontuarioCompleto?.metaAtiva;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerShell}>
        <View style={styles.headerCard}>
          <View style={styles.headerMain}>
            <View style={styles.identityRow}>
              <AvatarBadge name={currentPatient.name} size={56} />
              <View style={styles.identityCopy}>
                <Text style={styles.patientName}>{currentPatient.name}</Text>
                <Text style={styles.patientMeta}>
                  {currentPatient.age} anos · IMC {imcExibir} · {currentPatient.specialtyTag}
                </Text>
              </View>
            </View>
            <RiskBadge risk={`${currentPatient.risk} risco`} />
          </View>
          <FilterTabs items={detailTabs} active={activeTab} onChange={setActiveTab} compact scrollable fill />
        </View>
      </View>

      <RolagemComTeclado
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardBottomBase={48}
        showsVerticalScrollIndicator
      >
        {/* ── TAB: VISÃO GERAL ──────────────────────────────────────────── */}
        {activeTab === 'overview' ? (
          <View style={styles.pageGap}>
            {experienceLoadError ? (
              <SectionCard style={styles.experienceErrorCard}>
                <Text style={styles.experienceErrorText}>{experienceLoadError}</Text>
                <TouchableOpacity
                  style={styles.reloadExperienceButton}
                  onPress={reloadPatientExperience}
                >
                  <Text style={styles.reloadExperienceButtonText}>Tentar carregar novamente</Text>
                </TouchableOpacity>
              </SectionCard>
            ) : null}
            <TrendChartCard
              title="Glicemia nas últimas 12h"
              subtitle="Leituras resumidas para detectar subida, estabilidade e pontos de atenção."
              data={currentPatient.glucose12h}
              loading={loadingGlucose12h}
            />
            <View style={styles.overviewStats}>
              <SectionCard style={styles.statCard}>
                <Text style={styles.statLabel}>Glicose atual</Text>
                <Text style={styles.statValue}>{currentPatient.latestGlucose} mg/dL</Text>
                <Text style={styles.statHelper}>{currentPatient.trendText}</Text>
              </SectionCard>
              <SectionCard style={styles.statCard}>
                <Text style={styles.statLabel}>Adesão</Text>
                <Text style={styles.statValue}>{currentPatient.adherence}%</Text>
                <ProgressBar value={currentPatient.adherence} tone={currentPatient.adherence < 70 ? 'danger' : 'success'} />
              </SectionCard>
              <SectionCard style={styles.statCard}>
                <Text style={styles.statLabel}>IMC</Text>
                <Text style={styles.statValue}>{imcExibir}</Text>
                <Text style={styles.statHelper}>Peso: {pesoExibir} kg · Alt: {alturaExibir} cm</Text>
              </SectionCard>
            </View>

            <SectionCard style={styles.reportCard}>
              <Text style={styles.sectionTitle}>Relatório do paciente</Text>
              <Text style={styles.reportHelper}>
                Resumo em PDF com glicose, alimentação, insulina, medicações e alertas automáticos.
              </Text>
              <View style={styles.reportChipRow}>
                {[
                  { id: '7days', label: '7 dias' },
                  { id: '15days', label: '15 dias' },
                  { id: '30days', label: '30 dias' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.reportChip,
                      reportPeriod === item.id && styles.reportChipActive,
                    ]}
                    onPress={() => setReportPeriod(item.id)}
                  >
                    <Text
                      style={[
                        styles.reportChipText,
                        reportPeriod === item.id && styles.reportChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.reportChipRow}>
                {[
                  { id: 'visual', label: 'Resumo visual' },
                  { id: 'full', label: 'Relatório completo' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.reportChip,
                      reportMode === item.id && styles.reportChipActive,
                    ]}
                    onPress={() => setReportMode(item.id)}
                  >
                    <Text
                      style={[
                        styles.reportChipText,
                        reportMode === item.id && styles.reportChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.reportPrimaryButton, exportingReport && styles.reportButtonDisabled]}
                onPress={handleExportPatientReport}
                disabled={exportingReport}
                activeOpacity={0.9}
              >
                {exportingReport ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="document-text-outline" size={18} color="#fff" />
                )}
                <Text style={styles.reportPrimaryButtonText}>Exportar PDF</Text>
              </TouchableOpacity>
            </SectionCard>
          </View>
        ) : null}

        {/* ── TAB: CLÍNICO ─────────────────────────────────────────────── */}
        {activeTab === 'clinico' ? (
          <View style={styles.pageGap}>
            {loadingProntuario && !prontuarioCompleto ? (
              <View style={styles.inlineStatus}>
                <ActivityIndicator color={patientTheme.colors.primaryDark} />
                <Text style={styles.inlineStatusText}>Carregando prontuário...</Text>
              </View>
            ) : null}

            {/* Antropometria */}
            <SectionCard>
              <Text style={styles.sectionTitle}>Antropometria</Text>
              <View style={styles.statsRow}>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatLabel}>Peso</Text>
                  <Text style={styles.miniStatValue}>{pesoExibir} kg</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatLabel}>Altura</Text>
                  <Text style={styles.miniStatValue}>{alturaExibir} cm</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatLabel}>IMC</Text>
                  <Text style={styles.miniStatValue}>{imcExibir}</Text>
                </View>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatLabel}>Circ. Abd.</Text>
                  <Text style={styles.miniStatValue}>{circExibir !== '--' ? `${circExibir} cm` : '--'}</Text>
                </View>
              </View>

              {ultAnt?.data_afericao ? (
                <Text style={styles.helperText}>Última aferição: {formatDate(ultAnt.data_afericao)}</Text>
              ) : null}

              {/* Histórico antropometria */}
              {(prontuarioCompleto?.antropometria || []).length >= 1 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.subLabel}>Histórico</Text>
                  {(prontuarioCompleto.antropometria || []).slice(0, 5).map((a, i) => (
                    <View key={a.id || i} style={styles.historicoRow}>
                      <Text style={styles.historicoData}>{formatDate(a.data_afericao)}</Text>
                      <Text style={styles.historicoValor}>{a.peso_kg ? `${a.peso_kg} kg` : '--'}</Text>
                      <Text style={styles.historicoValor}>IMC {calcBmi(a.peso_kg, a.altura_cm) ?? '--'}</Text>
                      {a.circunferencia_abdominal_cm ? (
                        <Text style={styles.historicoValor}>CA {a.circunferencia_abdominal_cm} cm</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Formulário nova aferição */}
              <Text style={[styles.subLabel, { marginTop: 16 }]}>Nova aferição</Text>
              {antMsg ? <InlineMsg msg={antMsg} /> : null}
              <View style={styles.formRow}>
                <TextInput style={[styles.input, styles.inputFlex]} value={antPeso} onChangeText={setAntPeso} placeholder="Peso (kg)" placeholderTextColor={patientTheme.colors.textMuted} keyboardType="numeric" />
                <TextInput style={[styles.input, styles.inputFlex]} value={antAltura} onChangeText={setAntAltura} placeholder="Altura (cm)" placeholderTextColor={patientTheme.colors.textMuted} keyboardType="numeric" />
                <TextInput style={[styles.input, styles.inputFlex]} value={antCirc} onChangeText={setAntCirc} placeholder="Circ. abd. (cm)" placeholderTextColor={patientTheme.colors.textMuted} keyboardType="numeric" />
              </View>
              <TextInput style={[styles.input, { marginTop: 8 }]} value={antObs} onChangeText={setAntObs} placeholder="Observação" placeholderTextColor={patientTheme.colors.textMuted} />
              <PrimaryButton label="Registrar aferição" icon="body-outline" onPress={saveAntropometria} loading={savingAnt} />
            </SectionCard>

            {/* Dados clínicos */}
            <SectionCard>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Dados Clínicos</Text>
                {!editProntuario ? (
                  <TouchableOpacity onPress={() => setEditProntuario(true)} style={styles.editBtn}>
                    <Ionicons name="pencil-outline" size={16} color={patientTheme.colors.primaryDark} />
                    <Text style={styles.editBtnText}>Editar</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {prontuarioMsg ? <InlineMsg msg={prontuarioMsg} /> : null}

              {!editProntuario ? (
                <View style={styles.fieldList}>
                  <FieldRow label="Tipo de Diabetes" value={prontuarioCompleto?.prontuario?.tipo_diabetes || '--'} />
                  <FieldRow label="Queixa Principal" value={prontuarioCompleto?.prontuario?.queixa_principal || '--'} />
                  <FieldRow label="Histórico da Doença" value={prontuarioCompleto?.prontuario?.historico_doenca_atual || '--'} />
                  <FieldRow label="Diagnósticos/CID" value={(prontuarioCompleto?.prontuario?.diagnosticos_cid || []).join(', ') || '--'} />
                  <FieldRow label="Alergias / Intolerâncias" value={(prontuarioCompleto?.prontuario?.alergias || []).join(', ') || '--'} />
                  <FieldRow label="Comorbidades" value={(prontuarioCompleto?.prontuario?.comorbidades || []).join(', ') || currentPatient.comorbidities?.join(', ') || '--'} />
                  <FieldRow label="Observações" value={prontuarioCompleto?.prontuario?.observacoes_gerais || '--'} />
                </View>
              ) : (
                <View>
                  <LabeledInput label="Tipo de Diabetes" value={pTipoDiabetes} onChange={setPTipoDiabetes} placeholder="Ex: DM2, DM1, LADA..." />
                  <LabeledInput label="Queixa Principal" value={pQueixa} onChange={setPQueixa} placeholder="Queixa principal do paciente" multiline />
                  <LabeledInput label="Histórico da Doença" value={pHistorico} onChange={setPHistorico} placeholder="Histórico da doença atual" multiline />
                  <LabeledInput label="Diagnósticos/CID (separados por vírgula)" value={pDiagnosticos} onChange={setPDiagnosticos} placeholder="Ex: E11.9, E66.0" />
                  <LabeledInput label="Alergias / Intolerâncias (separadas por vírgula)" value={pAlergias} onChange={setPAlergias} placeholder="Ex: lactose, glúten" />
                  <LabeledInput label="Comorbidades (separadas por vírgula)" value={pComorbidades} onChange={setPComorbidades} placeholder="Ex: hipertensão, dislipidemia" />
                  <LabeledInput label="Observações gerais" value={pObservacoes} onChange={setPObservacoes} placeholder="Observações clínicas relevantes" multiline />
                  <View style={styles.formRow}>
                    <PrimaryButton label="Salvar prontuário" icon="save-outline" onPress={saveProntuario} loading={savingProntuario} />
                    <SecondaryButton label="Cancelar" onPress={() => { setEditProntuario(false); setProntuarioMsg(null); }} />
                  </View>
                </View>
              )}
            </SectionCard>
          </View>
        ) : null}

        {/* ── TAB: EVOLUÇÃO CLÍNICA ─────────────────────────────────────── */}
        {activeTab === 'evolucao' ? (
          <View style={styles.pageGap}>
            {/* Novo registro SOAP */}
            <SectionCard>
              <Text style={styles.sectionTitle}>Registrar Evolução Clínica</Text>
              <Text style={styles.sectionHelper}>Registro SOAP para acompanhamento da consulta.</Text>
              {evolucaoMsg ? <InlineMsg msg={evolucaoMsg} /> : null}
              <LabeledInput label="S — Subjetivo (queixa do paciente)" value={evolucaoSubjetivo} onChange={setEvolucaoSubjetivo} placeholder="O que o paciente relatou..." multiline />
              <LabeledInput label="A — Avaliação clínica / Diagnóstico nutricional" value={evolucaoAvaliacao} onChange={setEvolucaoAvaliacao} placeholder="Avaliação do nutricionista..." multiline />
              <LabeledInput label="P — Plano / Conduta" value={evolucaoPlano} onChange={setEvolucaoPlano} placeholder="Conduta e intervenção planejada..." multiline />
              <LabeledInput label="O — Orientações" value={evolucaoOrientacoes} onChange={setEvolucaoOrientacoes} placeholder="Orientações dadas ao paciente..." multiline />
              <PrimaryButton label="Registrar evolução" icon="document-text-outline" onPress={saveEvolucao} loading={savingEvolucao} />
            </SectionCard>

            {/* Histórico de evoluções */}
            <SectionCard>
              <Text style={styles.sectionTitle}>Histórico de Evoluções</Text>
              {loadingProntuario && !prontuarioCompleto ? (
                <ActivityIndicator color={patientTheme.colors.primaryDark} style={{ marginTop: 12 }} />
              ) : (prontuarioCompleto?.evolucao || []).length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma evolução registrada ainda.</Text>
              ) : (
                (prontuarioCompleto.evolucao || []).map((ev, i) => (
                  <View key={ev.id || i} style={styles.evolucaoCard}>
                    <Text style={styles.evolucaoData}>{formatDateTime(ev.created_at)}</Text>
                    {ev.subjetivo ? <EvolRow label="Subjetivo" text={ev.subjetivo} /> : null}
                    {ev.avaliacao ? <EvolRow label="Avaliação" text={ev.avaliacao} /> : null}
                    {ev.plano ? <EvolRow label="Plano" text={ev.plano} /> : null}
                    {ev.orientacoes_gerais || ev.orientacoes ? <EvolRow label="Orientações" text={ev.orientacoes_gerais || ev.orientacoes} /> : null}
                  </View>
                ))
              )}
            </SectionCard>
          </View>
        ) : null}

        {/* ── TAB: REGISTROS DO PACIENTE ────────────────────────────────── */}
        {activeTab === 'registros' ? (
          <RegistrosPacienteNutriSection
            glicemias={glicemias}
            medicacoes={medicacoes}
            insulinas={insulinas}
            refeicoes={refeicoes}
            loadingRegistros={loadingRegistros}
            loadError={registrosLoadError}
            pacienteId={effectivePacienteId}
            navigation={navigation}
            patientName={currentPatient?.name}
            usuarioLogado={usuarioLogado}
            onReloadRegistros={loadRegistros}
          />
        ) : null}

        {/* ── TAB: PLANO ALIMENTAR ──────────────────────────────────────── */}
        {activeTab === 'plan' ? (
          <View style={styles.pageGap}>
            <SectionCard>
              <Text style={styles.sectionTitle}>Plano alimentar atual</Text>
              <Text style={styles.sectionHelper}>Refine refeições e horários diretamente no prontuário.</Text>
              {loadingPlan ? (
                <View style={styles.inlineStatus}>
                  <ActivityIndicator color={patientTheme.colors.primaryDark} />
                  <Text style={styles.inlineStatusText}>Carregando plano...</Text>
                </View>
              ) : null}
              {planMessage ? <InlineMsg msg={planMessage} /> : null}
              {!linkedToNutri && !loadingPlan ? (
                <View style={styles.messageBoxError}>
                  <Text style={styles.messageTextError}>Paciente não vinculado ao seu perfil. O plano só pode ser criado para pacientes vinculados.</Text>
                </View>
              ) : null}
              <TextInput style={[styles.input, styles.planTitleInput]} value={planTitle} onChangeText={setPlanTitle} placeholder="Título do plano" placeholderTextColor={patientTheme.colors.textMuted} />
              <View style={styles.mealList}>
                {allMeals.map(meal => (
                  <View key={meal.id} style={styles.mealCard}>
                    <View style={styles.mealTop}>
                      <Text style={styles.mealTime}>{meal.time}</Text>
                      <Text style={styles.mealTitle}>{meal.title}</Text>
                      <TouchableOpacity onPress={() => removeMeal(meal.id)} style={{ marginLeft: 'auto' }}>
                        <Ionicons name="trash-outline" size={16} color={patientTheme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.mealSummary}>{meal.objective || meal.summary}</Text>
                    {Array.isArray(meal.foods) && meal.foods.length ? (
                      <Text style={styles.mealSummary}>Alimentos: {meal.foods.join(', ')}</Text>
                    ) : null}
                    {Array.isArray(meal.substitutions) && meal.substitutions.length ? (
                      <Text style={styles.mealSummary}>Substituições: {meal.substitutions.map(s => `${s.anchor}: ${s.options.join(', ')}`).join(' | ')}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
              <PrimaryButton label={activeMealPlan?.id ? 'Atualizar plano' : 'Salvar plano'} icon="save-outline" onPress={saveMealPlan} loading={savingPlan} disabled={!linkedToNutri} variant="brand" />
            </SectionCard>

            <SectionCard>
              <Text style={styles.sectionTitle}>Adicionar refeição</Text>
              <View style={styles.formRow}>
                <TextInput style={[styles.input, styles.inputFlex]} value={mealTitle} onChangeText={setMealTitle} placeholder="Nome da refeição" placeholderTextColor={patientTheme.colors.textMuted} />
                <TextInput style={[styles.input, styles.timeInput]} value={mealTime} onChangeText={setMealTime} placeholder="08:00" placeholderTextColor={patientTheme.colors.textMuted} />
              </View>
              <TouchableOpacity
                style={styles.mealDetailsToggle}
                onPress={() => setMealDetailsOpen((open) => !open)}
                activeOpacity={0.85}
              >
                <Text style={styles.mealDetailsToggleText}>
                  {mealDetailsOpen ? 'Ocultar detalhes opcionais' : 'Mostrar detalhes opcionais'}
                </Text>
                <Ionicons
                  name={mealDetailsOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color={patientTheme.colors.primaryDark}
                />
              </TouchableOpacity>
              {mealDetailsOpen ? (
                <>
                  <TextInput style={[styles.input, styles.inputMultiline, { marginTop: 10 }]} value={mealObjective} onChangeText={setMealObjective} placeholder="Objetivo da refeição" placeholderTextColor={patientTheme.colors.textMuted} multiline textAlignVertical="top" />
                  <TextInput style={[styles.input, styles.inputMultiline, { marginTop: 10 }]} value={mealFoods} onChangeText={setMealFoods} placeholder="Alimentos separados por vírgula" placeholderTextColor={patientTheme.colors.textMuted} multiline textAlignVertical="top" />
                  <TextInput style={[styles.input, styles.inputMultiline, { marginTop: 10 }]} value={mealSubstitutions} onChangeText={setMealSubstitutions} placeholder="Substituições. Ex.: Arroz integral: quinoa, batata-doce" placeholderTextColor={patientTheme.colors.textMuted} multiline textAlignVertical="top" />
                  <TextInput style={[styles.input, styles.inputMultiline, { marginTop: 10 }]} value={mealSummary} onChangeText={setMealSummary} placeholder="Descreva o que foi proposto" placeholderTextColor={patientTheme.colors.textMuted} multiline textAlignVertical="top" />
                </>
              ) : null}
              <PrimaryButton label="Adicionar refeição" icon="add-circle-outline" onPress={addMeal} variant="brandText" />
            </SectionCard>
          </View>
        ) : null}

        {/* ── TAB: HISTÓRICO DE CONSULTAS ───────────────────────────────── */}
        {activeTab === 'historico' ? (
          <SectionCard>
            <Text style={styles.sectionTitle}>Histórico de Consultas</Text>
            {loadingHistorico ? (
              <View style={styles.inlineStatus}>
                <ActivityIndicator color={patientTheme.colors.primaryDark} />
                <Text style={styles.inlineStatusText}>Carregando consultas...</Text>
              </View>
            ) : consultasHistorico.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma consulta encontrada para este paciente.</Text>
            ) : (
              consultasHistorico.map((c, i) => (
                <View key={c.id || i} style={styles.consultaCard}>
                  <View style={styles.consultaHeader}>
                    <Text style={styles.consultaData}>{formatDateTime(c.scheduled_at)}</Text>
                    <StatusBadge status={c.status} />
                  </View>
                  {c.motivo ? <Text style={styles.consultaMeta}>Motivo: {c.motivo}</Text> : null}
                  {c.observacoes_nutri || c.conduta ? (
                    <Text style={styles.consultaMeta}>Conduta: {c.conduta || c.observacoes_nutri}</Text>
                  ) : null}
                  {c.proximos_passos ? (
                    <Text style={styles.consultaMeta}>Próximos passos: {c.proximos_passos}</Text>
                  ) : null}
                  {c.duracao_minutos ? (
                    <Text style={styles.consultaMeta}>Duração: {c.duracao_minutos} min</Text>
                  ) : null}
                </View>
              ))
            )}
          </SectionCard>
        ) : null}

        {/* ── TAB: METAS ───────────────────────────────────────────────── */}
        {activeTab === 'goals' ? (
          <View style={styles.pageGap}>
            <SectionCard>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Metas Clínicas e Nutricionais</Text>
                {!editMeta ? (
                  <TouchableOpacity onPress={() => setEditMeta(true)} style={styles.editBtn}>
                    <Ionicons name="pencil-outline" size={16} color={patientTheme.colors.primaryDark} />
                    <Text style={styles.editBtnText}>{metaAtiva ? 'Atualizar' : 'Definir'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {metaMsg ? <InlineMsg msg={metaMsg} /> : null}

              {!editMeta ? (
                <View style={styles.fieldList}>
                  {metaAtiva ? (
                    <>
                      <FieldRow label="HbA1c alvo" value={metaAtiva.meta_hba1c_pct ? `${metaAtiva.meta_hba1c_pct}%` : '--'} />
                      <FieldRow label="Glicemia em jejum" value={metaAtiva.meta_glicemia_jejum_mgdl ? `${metaAtiva.meta_glicemia_jejum_mgdl} mg/dL` : '--'} />
                      <FieldRow label="Calorias/dia" value={metaAtiva.meta_calorias_dia ? `${metaAtiva.meta_calorias_dia} kcal` : '--'} />
                      <FieldRow label="Carboidratos" value={metaAtiva.meta_carboidratos_g ? `${metaAtiva.meta_carboidratos_g} g` : '--'} />
                      <FieldRow label="Proteínas" value={metaAtiva.meta_proteinas_g ? `${metaAtiva.meta_proteinas_g} g` : '--'} />
                      <FieldRow label="Gorduras" value={metaAtiva.meta_gorduras_g ? `${metaAtiva.meta_gorduras_g} g` : '--'} />
                      {metaAtiva.observacao ? <FieldRow label="Observação" value={metaAtiva.observacao} /> : null}
                      <Text style={[styles.helperText, { marginTop: 8 }]}>Vigente desde {formatDate(metaAtiva.vigente_desde)}</Text>
                    </>
                  ) : (
                    <Text style={styles.emptyText}>Nenhuma meta clínica definida ainda.</Text>
                  )}
                </View>
              ) : (
                <View>
                  <LabeledInput label="HbA1c alvo (%)" value={metaHba1c} onChange={setMetaHba1c} placeholder="Ex: 7.0" keyboardType="numeric" />
                  <LabeledInput label="Glicemia em jejum alvo (mg/dL)" value={metaGlicemia} onChange={setMetaGlicemia} placeholder="Ex: 100" keyboardType="numeric" />
                  <LabeledInput label="Calorias/dia (kcal)" value={metaCalorias} onChange={setMetaCalorias} placeholder="Ex: 1800" keyboardType="numeric" />
                  <View style={styles.formRow}>
                    <LabeledInput label="Carbo (g)" value={metaCarbo} onChange={setMetaCarbo} placeholder="Ex: 200" keyboardType="numeric" style={styles.inputFlex} />
                    <LabeledInput label="Prot. (g)" value={metaProt} onChange={setMetaProt} placeholder="Ex: 90" keyboardType="numeric" style={styles.inputFlex} />
                    <LabeledInput label="Gord. (g)" value={metaGord} onChange={setMetaGord} placeholder="Ex: 60" keyboardType="numeric" style={styles.inputFlex} />
                  </View>
                  <LabeledInput label="Observação" value={metaObs} onChange={setMetaObs} placeholder="Orientações adicionais sobre as metas..." multiline />
                  <View style={styles.formRow}>
                    <PrimaryButton label="Salvar metas" icon="save-outline" onPress={saveMeta} loading={savingMeta} />
                    <SecondaryButton label="Cancelar" onPress={() => { setEditMeta(false); setMetaMsg(null); }} />
                  </View>
                </View>
              )}
            </SectionCard>

            {/* Metas de adesão (legacy) */}
            <SectionCard>
              <Text style={styles.sectionTitle}>Metas de Adesão</Text>
              <Text style={styles.sectionHelper}>
                Indicadores calculados a partir dos registros recentes do paciente.
              </Text>
              {patientExperience ? (
                <View style={styles.goalList}>
                  <View style={styles.goalItem}>
                    <View style={styles.goalTop}>
                      <Text style={styles.goalLabel}>Adesão ao plano alimentar</Text>
                      <Text style={styles.goalValue}>{currentPatient.adherence}%</Text>
                    </View>
                    <ProgressBar
                      value={currentPatient.adherence}
                      tone={currentPatient.adherence < 70 ? 'warning' : 'success'}
                    />
                  </View>
                </View>
              ) : (
                <Text style={styles.helperText}>Sem dados de adesão calculados ainda.</Text>
              )}
            </SectionCard>
          </View>
        ) : null}

        {/* ── TAB: DADOS PESSOAIS ───────────────────────────────────────── */}
        {activeTab === 'personal' ? (
          <View style={styles.pageGap}>
            <SectionCard>
              <Text style={styles.sectionTitle}>Comorbidades</Text>
              <View style={styles.infoList}>
                {(currentPatient.comorbidities || []).map((item, index) => (
                  <View key={`comorb-${index}`} style={styles.infoCard}>
                    <Text style={styles.infoCardText}>{item}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>
            <SectionCard>
              <Text style={styles.sectionTitle}>Medicamentos</Text>
              <View style={styles.infoList}>
                {(currentPatient.medications || []).map((item, index) => (
                  <View key={`med-${index}`} style={styles.infoCard}>
                    <Text style={styles.infoCardText}>{item}</Text>
                  </View>
                ))}
              </View>
            </SectionCard>
            <SectionCard>
              <Text style={styles.sectionTitle}>Contato</Text>
              <View style={styles.personalRow}>
                <Text style={styles.personalLabel}>Email</Text>
                <Text style={styles.personalValue}>{currentPatient.personalData.email}</Text>
              </View>
              <View style={styles.personalRow}>
                <Text style={styles.personalLabel}>Telefone</Text>
                <Text style={styles.personalValue}>{currentPatient.personalData.phone}</Text>
              </View>
              <View style={styles.personalRow}>
                <Text style={styles.personalLabel}>Cidade</Text>
                <Text style={styles.personalValue}>{currentPatient.personalData.city}</Text>
              </View>
            </SectionCard>
          </View>
        ) : null}
      </RolagemComTeclado>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────────

function PrimaryButton({ label, icon, onPress, loading, disabled, style, variant }) {
  const isBrand = variant === 'brand';
  const isBrandText = variant === 'brandText';
  const accentColor = isBrand ? patientTheme.colors.onPrimary : patientTheme.colors.text;
  const iconColor = isBrandText ? patientTheme.colors.primary : accentColor;

  return (
    <TouchableOpacity
      style={[
        styles.primaryButton,
        isBrand && styles.primaryButtonBrand,
        (disabled || loading) && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={accentColor} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={iconColor} />
      ) : null}
      <Text
        style={[
          styles.primaryButtonText,
          isBrand && styles.primaryButtonBrandText,
          isBrandText && styles.primaryButtonBrandTextOnly,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function LabeledInput({ label, value, onChange, placeholder, multiline, keyboardType, style }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, style]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={patientTheme.colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

function FieldRow({ label, value }) {
  return (
    <View style={styles.personalRow}>
      <Text style={styles.personalLabel}>{label}</Text>
      <Text style={styles.personalValue}>{value || '--'}</Text>
    </View>
  );
}

function EvolRow({ label, text }) {
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={styles.evolLabel}>{label}</Text>
      <Text style={styles.evolText}>{text}</Text>
    </View>
  );
}

function InlineMsg({ msg }) {
  if (!msg) return null;
  return (
    <View style={[styles.messageBox, msg.tipo === 'erro' && styles.messageBoxError]}>
      <Text style={[styles.messageText, msg.tipo === 'erro' && styles.messageTextError]}>{msg.texto}</Text>
    </View>
  );
}

function StatusBadge({ status }) {
  const map = {
    scheduled: { label: 'Agendada', color: '#e8f4f8', text: '#2c7a9e' },
    confirmed: { label: 'Confirmada', color: patientTheme.colors.primarySoft, text: patientTheme.colors.primaryDark },
    done: { label: 'Realizada', color: '#f0f8e8', text: '#558b2f' },
    cancelled: { label: 'Cancelada', color: '#fef0f0', text: '#c62828' },
    no_show: { label: 'Não compareceu', color: '#fff8e1', text: '#e65100' },
  };
  const s = map[status] || { label: status, color: '#f5f5f5', text: '#555' };
  return (
    <View style={{ backgroundColor: s.color, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: s.text, fontWeight: '800', fontSize: 12 }}>{s.label}</Text>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────
// Estilos
// ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: patientTheme.colors.background },
  headerShell: { paddingHorizontal: patientTheme.spacing.screen, paddingTop: 16, paddingBottom: 8 },
  headerCard: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: patientTheme.colors.surface,
    borderRadius: patientTheme.radius.card,
    borderColor: patientTheme.colors.border,
    padding: patientTheme.spacing.card,
    gap: 14,
    ...patientShadow,
  },
  headerMain: { flexDirection: Platform.OS === 'web' ? 'row' : 'column', justifyContent: 'space-between', gap: 12 },
  identityRow: { flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 },
  identityCopy: { flex: 1, minWidth: 0 },
  patientName: { fontSize: 24, fontWeight: '900', color: patientTheme.colors.text },
  patientMeta: { marginTop: 6, color: patientTheme.colors.textMuted, lineHeight: 20 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: patientTheme.spacing.screen, paddingBottom: 28, gap: 14 },
  pageGap: { width: '100%', alignSelf: 'stretch', gap: 14 },
  overviewStats: { flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 12 },
  reportCard: { gap: 10 },
  experienceErrorCard: {
    borderColor: patientTheme.colors.dangerBorder || '#f5c2c7',
    backgroundColor: patientTheme.colors.dangerBg || '#fff5f5',
  },
  experienceErrorText: {
    color: patientTheme.colors.danger || '#b42318',
    fontSize: 13,
    lineHeight: 18,
  },
  reloadExperienceButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: patientTheme.radius.pill,
    backgroundColor: patientTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reloadExperienceButtonText: {
    color: patientTheme.colors.onPrimary || '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  reportHelper: { color: patientTheme.colors.textMuted, fontSize: 13, lineHeight: 18 },
  reportChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reportChip: {
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: patientTheme.colors.background,
  },
  reportChipActive: {
    backgroundColor: patientTheme.colors.surface,
    borderColor: patientTheme.colors.surfaceBorder,
  },
  reportChipText: { color: patientTheme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  reportChipTextActive: { color: patientTheme.colors.primaryDark },
  reportPrimaryButton: {
    marginTop: 4,
    minHeight: 46,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  reportPrimaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  reportButtonDisabled: { opacity: 0.65 },
  statCard: { flex: 1, minHeight: 120 },
  statLabel: { color: patientTheme.colors.textMuted, fontSize: 12, textTransform: 'uppercase', fontWeight: '800' },
  statValue: { marginTop: 10, marginBottom: 10, fontSize: 24, fontWeight: '900', color: patientTheme.colors.text },
  statHelper: { marginTop: 4, color: patientTheme.colors.textMuted, lineHeight: 18, fontSize: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: patientTheme.colors.text },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionHelper: { marginTop: 6, color: patientTheme.colors.textMuted, lineHeight: 20, marginBottom: 14 },
  subLabel: { fontSize: 12, fontWeight: '800', color: patientTheme.colors.textMuted, textTransform: 'uppercase', marginBottom: 8 },
  helperText: { color: patientTheme.colors.textMuted, fontSize: 12 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: patientTheme.colors.textMuted, marginBottom: 4 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: patientTheme.colors.backgroundSoft },
  editBtnText: { fontSize: 12, fontWeight: '800', color: patientTheme.colors.text },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  miniStat: {
    flex: 1,
    minWidth: 70,
    padding: 10,
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderRadius: patientTheme.radius.lg,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
    alignItems: 'center',
  },
  miniStatLabel: { fontSize: 11, fontWeight: '700', color: patientTheme.colors.textMuted },
  miniStatValue: { fontSize: 18, fontWeight: '900', color: patientTheme.colors.text, marginTop: 4 },
  historicoRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: patientTheme.colors.border, flexWrap: 'wrap' },
  historicoData: { fontSize: 12, color: patientTheme.colors.textMuted, minWidth: 80 },
  historicoValor: { fontSize: 13, fontWeight: '700', color: patientTheme.colors.text },
  fieldList: { gap: 0 },
  formRow: { flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 10, marginBottom: 10 },
  input: { borderRadius: patientTheme.radius.lg, backgroundColor: patientTheme.colors.background, paddingHorizontal: 14, paddingVertical: 12, color: patientTheme.colors.text, borderWidth: 1, borderColor: patientTheme.colors.border, ...patientShadow },
  inputFlex: { flex: 1 },
  timeInput: { width: Platform.OS === 'web' ? 120 : '100%' },
  inputMultiline: { minHeight: 90 },
  planTitleInput: { marginBottom: 12 },
  primaryButton: { marginTop: 12, minHeight: 48, borderRadius: patientTheme.radius.pill, backgroundColor: patientTheme.colors.surface, borderWidth: 1, borderColor: patientTheme.colors.surfaceBorder, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryButtonBrand: {
    backgroundColor: patientTheme.colors.primary,
    borderColor: patientTheme.colors.primaryDark,
  },
  buttonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: patientTheme.colors.text, fontWeight: '900' },
  primaryButtonBrandText: { color: patientTheme.colors.onPrimary },
  primaryButtonBrandTextOnly: { color: patientTheme.colors.primary },
  secondaryButton: { marginTop: 12, minHeight: 48, borderRadius: patientTheme.radius.pill, backgroundColor: patientTheme.colors.backgroundSoft, alignItems: 'center', justifyContent: 'center', flex: 1 },
  secondaryButtonText: { color: patientTheme.colors.text, fontWeight: '900' },
  messageBox: { backgroundColor: patientTheme.colors.background, borderWidth: 1, borderColor: patientTheme.colors.border, borderRadius: patientTheme.radius.lg, marginBottom: 12, padding: 12 },
  messageBoxError: { backgroundColor: '#fff4f4', borderColor: '#f0d2d2', borderRadius: patientTheme.radius.lg, borderWidth: 1, marginBottom: 12, padding: 12 },
  messageText: { color: patientTheme.colors.primaryDark, fontWeight: '800', lineHeight: 20 },
  messageTextError: { color: patientTheme.colors.danger, fontWeight: '800', lineHeight: 20 },
  mealDetailsToggle: {
    marginTop: 12,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.backgroundSoft,
    borderWidth: 1,
    borderColor: patientTheme.colors.border,
  },
  mealDetailsToggleText: {
    color: patientTheme.colors.primaryDark,
    fontWeight: '800',
    fontSize: 13,
  },
  mealList: { gap: 10 },
  mealCard: { padding: 14, borderRadius: patientTheme.radius.lg, backgroundColor: patientTheme.colors.background, borderWidth: 1, borderColor: patientTheme.colors.border, ...patientShadow },
  mealTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  mealTime: { width: 54, color: patientTheme.colors.primaryDark, fontWeight: '900' },
  mealTitle: { flex: 1, color: patientTheme.colors.text, fontWeight: '900' },
  mealSummary: { marginTop: 8, color: patientTheme.colors.textMuted, lineHeight: 20 },
  goalList: { gap: 12, marginTop: 14 },
  goalItem: { padding: 14, borderRadius: patientTheme.radius.lg, backgroundColor: patientTheme.colors.background, borderWidth: 1, borderColor: patientTheme.colors.border, ...patientShadow },
  goalTop: { marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  goalLabel: { flex: 1, color: patientTheme.colors.text, fontWeight: '800' },
  goalValue: { color: patientTheme.colors.text, fontWeight: '900' },
  infoList: { gap: 10, marginTop: 14 },
  infoCard: { padding: 14, borderRadius: patientTheme.radius.lg, backgroundColor: patientTheme.colors.background, borderWidth: 1, borderColor: patientTheme.colors.border, ...patientShadow },
  infoCardText: { color: patientTheme.colors.text, fontWeight: '700' },
  personalRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: patientTheme.colors.border },
  personalLabel: { color: patientTheme.colors.textMuted, fontSize: 12, textTransform: 'uppercase', fontWeight: '800' },
  personalValue: { marginTop: 6, color: patientTheme.colors.text, fontWeight: '800' },
  evolucaoCard: { borderWidth: 1, borderColor: patientTheme.colors.border, borderRadius: patientTheme.radius.lg, padding: 14, marginTop: 12, ...patientShadow },
  evolucaoData: { fontSize: 12, fontWeight: '800', color: patientTheme.colors.textMuted, marginBottom: 6 },
  evolLabel: { fontSize: 11, fontWeight: '800', color: patientTheme.colors.primaryDark, textTransform: 'uppercase' },
  evolText: { color: patientTheme.colors.text, lineHeight: 20, marginTop: 2 },
  consultaCard: { borderWidth: 1, borderColor: patientTheme.colors.border, borderRadius: patientTheme.radius.lg, padding: 14, marginTop: 12, ...patientShadow },
  consultaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  consultaData: { fontWeight: '800', color: patientTheme.colors.text },
  consultaMeta: { color: patientTheme.colors.textMuted, lineHeight: 20, marginTop: 4 },
  inlineStatus: { alignItems: 'center', flexDirection: 'row', gap: 8, marginVertical: 12 },
  inlineStatusText: { color: patientTheme.colors.textMuted, fontWeight: '700' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontWeight: '900', color: patientTheme.colors.text },
  emptyText: { color: patientTheme.colors.textMuted, marginTop: 12, lineHeight: 20 },
});
