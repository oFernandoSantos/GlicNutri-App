import { DIETAS_REFERENCIA_NUTRICIONAL } from '../constantes/dietasReferenciaNutricional';

/**
 * Ordena padrões alimentares com base na saída do modelo /predict (classificação, regressão, cluster)
 * e no vetor de features do dia típico. O cluster KMeans não tem rótulo clínico fixo — usa-se como
 * fator secundário de diversificação na pontuação, com peso menor.
 */
export function rankDietTemplatesFromMlPrediction(prediction, features) {
  if (!prediction || !features) {
    return { ranked: [], primaryId: null, rationaleCodes: [] };
  }

  const prob = Number(prediction.prob_glucose_elevada) || 0;
  const cls = Number(prediction.classe_glucose_elevada) || 0;
  const regG = Number(prediction.glucose_mean_previsto_mg_dl) || 0;
  const cluster = Number(prediction.cluster_id);
  const carbs = Number(features.carbs_sum_g) || 0;
  const kcal = Number(features.kcal_sum) || 0;
  const nLeituras = Number(features.n_leituras_glicemia) || 0;
  const nRefeicoes = Number(features.n_refeicoes_ia) || 0;

  const altoRiscoGlic = prob >= 0.42 || cls === 1 || regG >= 145;
  const carbAltos = carbs >= 220;
  const carbModerados = carbs >= 130 && carbs < 220;
  const poucasLeituras = nLeituras < 1.5;
  const desorganizadoRefeicoes = nRefeicoes > 0 && nRefeicoes < 2 && kcal > 1800;

  const rationaleCodes = [];
  if (altoRiscoGlic) rationaleCodes.push('modelo_indica_risco_glicemia_elevada');
  if (carbAltos) rationaleCodes.push('media_diaria_carboidratos_elevada');
  if (carbModerados) rationaleCodes.push('carboidratos_moderados');
  if (poucasLeituras) rationaleCodes.push('poucas_leituras_glicemia');
  if (desorganizadoRefeicoes) rationaleCodes.push('refeicoes_irregulares_ou_concentradas');

  const scoreMap = {};

  DIETAS_REFERENCIA_NUTRICIONAL.forEach((d) => {
    let s = 1;
    switch (d.id) {
      case 'contagem_carboidratos':
        if (altoRiscoGlic || carbAltos || carbModerados) s += 4;
        if (poucasLeituras) s += 0.5;
        break;
      case 'prato_metodo':
        if (altoRiscoGlic || carbModerados) s += 3.2;
        if (!carbAltos) s += 0.8;
        break;
      case 'distribuicao_horarios':
        if (desorganizadoRefeicoes || carbAltos) s += 2.5;
        break;
      case 'mediterranea':
        s += 2.2;
        if (altoRiscoGlic) s += 1;
        break;
      case 'dash':
        s += 1.6;
        if (altoRiscoGlic) s += 1.2;
        break;
      case 'baixo_carboidrato_moderado':
        if (carbAltos && altoRiscoGlic) s += 3;
        else if (carbAltos) s += 1.5;
        else s -= 0.5;
        break;
      case 'vegetariana_flexivel':
        if (carbAltos && !altoRiscoGlic) s += 1.8;
        s += 0.6;
        break;
      default:
        break;
    }

    // Cluster: leve modulação (evita todos receberem mesma ordem quando empate)
    const clusterMod = Number.isFinite(cluster) ? (cluster % 3) * 0.08 : 0;
    if ((cluster % 3) === 0 && d.id === 'mediterranea') s += 0.15;
    if ((cluster % 3) === 1 && d.id === 'dash') s += 0.15;
    if ((cluster % 3) === 2 && d.id === 'vegetariana_flexivel') s += 0.15;
    s += clusterMod;

    scoreMap[d.id] = s;
  });

  const ranked = [...DIETAS_REFERENCIA_NUTRICIONAL]
    .map((d) => ({
      ...d,
      score: scoreMap[d.id] || 0,
    }))
    .sort((a, b) => b.score - a.score);

  return {
    ranked,
    primaryId: ranked[0]?.id || null,
    rationaleCodes,
    mlResumo: {
      prob_glucose_elevada: prob,
      classe_glucose_elevada: cls,
      glucose_mean_previsto_mg_dl: regG,
      cluster_id: cluster,
    },
  };
}

export function buildProntuarioNotaSugestaoDieta({
  dietaSelecionada,
  rankedSnapshot,
  comentarioNutri,
  windowDays,
  diasComDados,
}) {
  const linhas = [];
  linhas.push('=== Sugestao de padrao alimentar (registro do nutricionista) ===');
  linhas.push(`Padrao indicado neste registro: ${dietaSelecionada?.titulo || '(nao especificado)'}`);
  if (dietaSelecionada?.resumo) linhas.push(`Resumo: ${dietaSelecionada.resumo}`);
  if (comentarioNutri?.trim()) linhas.push(`Observacoes do nutricionista: ${comentarioNutri.trim()}`);

  if (rankedSnapshot?.mlResumo) {
    const m = rankedSnapshot.mlResumo;
    linhas.push('');
    linhas.push('--- Apoio por modelo de ML (GlicNutri, nao substitui julgamento clinico) ---');
    linhas.push(
      `Prob. dia com glicemia media elevada (>=150 mg/dL): ${(Number(m.prob_glucose_elevada) * 100).toFixed(1)}%`
    );
    linhas.push(`Classe binaria (modelo): ${m.classe_glucose_elevada}`);
    linhas.push(`Glicemia media prevista (regressao): ${Number(m.glucose_mean_previsto_mg_dl).toFixed(1)} mg/dL`);
    linhas.push(`Cluster comportamental (KMeans): ${m.cluster_id}`);
  }

  if (rankedSnapshot?.rationaleCodes?.length) {
    linhas.push(`Sinais usados na ordenacao: ${rankedSnapshot.rationaleCodes.join(', ')}`);
  }

  linhas.push('');
  linhas.push(
    `Contexto numerico: media dos ultimos ${windowDays} dias com registro (${diasComDados} dia(s) com dados na janela).`
  );
  linhas.push(
    'Aviso: decisao final e responsabilidade do nutricionista; o app apenas organiza dados e exibe saidas de modelo estatistico.'
  );

  return linhas.join('\n');
}
