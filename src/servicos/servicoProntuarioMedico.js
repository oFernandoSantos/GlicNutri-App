/**
 * Escopo médico: diabetes, glicose, medicação, insulina, prontuário clínico.
 * Não inclui plano alimentar nem histórico alimentar (escopo nutricionista).
 */
import { supabase } from './configSupabase';
import { enrichRpcClinicalParams } from './servicoSessaoRpc';
import {
  fetchGlucoseReadings,
  fetchMedicationEntries,
  fetchPatientById,
} from './servicoDadosPaciente';
import {
  fetchProntuarioBase,
  upsertProntuarioBase,
  fetchEvolucaoHistorico,
  addEvolucao,
  fetchAntropometriaHistorico,
  addAntropometria,
} from './servicoProntuarioCompleto';
import { isPatientLinkedToDoctor } from './servicoVinculosMedico';

export async function assertMedicoPatientAccess({ pacienteId, medicoId }) {
  const ok = await isPatientLinkedToDoctor({ pacienteId, medicoId });
  if (!ok) {
    throw new Error('Este paciente não está vinculado ao seu perfil médico.');
  }
}

export async function fetchProntuarioClinicoMedico(pacienteId, medicoId) {
  await assertMedicoPatientAccess({ pacienteId, medicoId });

  const [patient, prontuario, antropometria, evolucao, glicemias, medicacoes] = await Promise.all([
    fetchPatientById(pacienteId).catch(() => null),
    fetchProntuarioBase(pacienteId).catch(() => null),
    fetchAntropometriaHistorico(pacienteId, 10).catch(() => []),
    fetchEvolucaoHistorico(pacienteId, 30).catch(() => []),
    fetchGlucoseReadings(pacienteId, 60).catch(() => []),
    fetchMedicationEntries(pacienteId, 60).catch(() => []),
  ]);

  const allMeds = medicacoes || [];
  const insulinas = allMeds.filter(
    (m) => m.tipo_registro === 'insulin' || m.medicationKind === 'insulin'
  );
  const medicamentos = allMeds.filter(
    (m) => m.tipo_registro !== 'insulin' && m.medicationKind !== 'insulin'
  );

  const evolucaoMedico = (evolucao || []).filter(
    (e) => e.medico_id === medicoId || !e.nutricionista_id
  );

  return {
    patient,
    prontuario,
    antropometria,
    ultimaAntropometria: antropometria[0] || null,
    evolucao: evolucaoMedico,
    glicemias: glicemias || [],
    medicamentos,
    insulinas,
  };
}

export async function saveProntuarioClinicoMedico({
  pacienteId,
  medicoId,
  tipoDiabetes,
  anoDiagnosticoDiabetes,
  usaInsulina,
  esquemaInsulina,
  diagnosticosCid,
  comorbidades,
  alergias,
  queixaPrincipal,
  historicoDomencaAtual,
  observacoesGerais,
  actor,
}) {
  await assertMedicoPatientAccess({ pacienteId, medicoId });
  return upsertProntuarioBase({
    pacienteId,
    tipoDiabetes,
    anoDiagnosticoDiabetes,
    usaInsulina,
    esquemaInsulina,
    diagnosticosCid: Array.isArray(diagnosticosCid)
      ? diagnosticosCid
      : String(diagnosticosCid || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    comorbidades: Array.isArray(comorbidades)
      ? comorbidades
      : String(comorbidades || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    alergias: Array.isArray(alergias)
      ? alergias
      : String(alergias || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    queixaPrincipal,
    historicoDomencaAtual,
    observacoesGerais,
    actor,
  });
}

export async function saveEvolucaoMedico({
  pacienteId,
  medicoId,
  consultaId,
  subjetivo,
  avaliacao,
  plano,
  orientacoes,
  actor,
}) {
  await assertMedicoPatientAccess({ pacienteId, medicoId });

  const { data, error } = await supabase.rpc(
    'registrar_evolucao_prontuario',
    await enrichRpcClinicalParams(
      {
        p_paciente_id: pacienteId,
        p_nutricionista_id: null,
        p_medico_id: medicoId,
        p_consulta_id: consultaId || null,
        p_subjetivo: subjetivo || null,
        p_avaliacao: avaliacao || null,
        p_plano: plano || null,
        p_orientacoes: orientacoes || null,
      },
      pacienteId
    )
  );

  if (error) {
    return addEvolucao({
      pacienteId,
      medicoId,
      consultaId,
      subjetivo,
      avaliacao,
      plano,
      orientacoes,
      actor,
    });
  }

  return Array.isArray(data) ? data[0] : data;
}

export async function saveAntropometriaMedico(params) {
  await assertMedicoPatientAccess({
    pacienteId: params.pacienteId,
    medicoId: params.medicoId,
  });
  return addAntropometria({
    ...params,
    medicoId: params.medicoId,
    nutricionistaId: null,
  });
}

export { fetchProntuarioBase, fetchEvolucaoHistorico };
