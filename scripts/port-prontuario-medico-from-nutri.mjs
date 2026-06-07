import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = path.join(__dirname, '../src/telas');
const srcPath = path.join(base, 'nutricionista/TelaProntuarioPacienteNutri.js');
const outPath = path.join(base, 'medico/TelaProntuarioPacienteMedico.js');

let s = fs.readFileSync(srcPath, 'utf8');

s = s.replace(
  /import \{ nutriTheme as patientTheme, nutriShadow as patientShadow \}/,
  'import { medicoTheme as patientTheme, medicoShadow as patientShadow }'
);

s = s.replace(
  /import \{\n  getNutritionistId,\n  isPatientLinkedToNutritionist,\n\} from '\.\.\/\.\.\/servicos\/servicoVinculosNutricionista';/,
  `import {
  getMedicoId,
  isPatientLinkedToDoctor,
} from '../../servicos/servicoVinculosMedico';`
);

s = s.replace(
  /import \{ carregarSessaoNutricionista \} from '\.\.\/\.\.\/servicos\/servicoSessaoNutricionista';/,
  `import { carregarSessaoMedico } from '../../servicos/servicoSessaoMedico';
import {
  fetchProntuarioClinicoMedico,
  saveProntuarioClinicoMedico,
  saveEvolucaoMedico,
  saveAntropometriaMedico,
} from '../../servicos/servicoProntuarioMedico';`
);

s = s.replace(
  /export default function TelaProntuarioPacienteNutri/,
  'export default function TelaProntuarioPacienteMedico'
);

const reps = [
  ['nutricionistaId', 'medicoId'],
  ['getNutritionistId', 'getMedicoId'],
  ['isPatientLinkedToNutritionist', 'isPatientLinkedToDoctor'],
  ['carregarSessaoNutricionista', 'carregarSessaoMedico'],
  ['nutriSessaoPersistida', 'medicoSessaoPersistida'],
  ['setNutriSessaoPersistida', 'setMedicoSessaoPersistida'],
  ['nutriRpcActor', 'medicoRpcActor'],
  ['linkedToNutri', 'linkedToMedico'],
  ['NutriProntuarioPaciente', 'MedicoProntuarioPaciente'],
  ["tipo_perfil: 'nutricionista'", "tipo_perfil: 'medico'"],
  ['id_nutricionista_uuid', 'id_medico_uuid'],
  ['nome_completo_nutri', 'nome_completo_medico'],
  ['email_nutri', 'email_medico'],
  ['Nutricionista', 'Medico'],
  ['nutricionista', 'medico'],
  ['Avaliação do nutricionista', 'Avaliação do médico'],
  ['prontuario_nutri', 'prontuario_medico'],
  ['Paciente não vinculado ao seu perfil', 'Paciente não vinculado à sua carteira médica'],
  ['acompanhamento nutricional', 'acompanhamento clínico'],
];

for (const [a, b] of reps) {
  s = s.split(a).join(b);
}

// medicoRpcActor builder
s = s.replace(
  /const medicoRpcActor = useMemo\(\(\) => \{[\s\S]*?\}, \[medicoSessaoPersistida, medicoId, usuarioLogado\]\);/,
  `const medicoRpcActor = useMemo(() => {
    const base = medicoSessaoPersistida || usuarioLogado || {};
    const resolvedMedicoId =
      medicoId || getMedicoId(base) || getMedicoId(usuarioLogado);
    const email =
      base?.email_acesso ||
      usuarioLogado?.email_acesso ||
      base?.email ||
      usuarioLogado?.email ||
      base?.email_medico ||
      usuarioLogado?.email_medico ||
      '';
    return {
      tipo_perfil: 'medico',
      id_medico_uuid: resolvedMedicoId,
      email_acesso: email,
      email,
      nome_completo_medico:
        base?.nome_completo_medico || usuarioLogado?.nome_completo_medico || null,
    };
  }, [medicoSessaoPersistida, medicoId, usuarioLogado]);`
);

// loadProntuario: access check + full prontuario
s = s.replace(
  /const resultado = await fetchProntuarioCompleto\(effectivePacienteId\);/,
  `await fetchProntuarioClinicoMedico(effectivePacienteId, medicoId);
      const resultado = await fetchProntuarioCompleto(effectivePacienteId);`
);

// Hidden medico fields preserved on save
s = s.replace(
  /const \[pObservacoes, setPObservacoes\] = useState\(''\);/,
  `const [pObservacoes, setPObservacoes] = useState('');
  const [pUsaInsulina, setPUsaInsulina] = useState('');
  const [pEsquemaInsulina, setPEsquemaInsulina] = useState('');`
);

s = s.replace(
  /setPObservacoes\(p\.observacoes_gerais \|\| ''\);/,
  `setPObservacoes(p.observacoes_gerais || '');
        setPUsaInsulina(p.usa_insulina ? 'sim' : 'nao');
        setPEsquemaInsulina(p.esquema_insulina || '');`
);

// saveProntuario
s = s.replace(
  /async function saveProntuario\(\) \{[\s\S]*?finally \{\s*setSavingProntuario\(false\);\s*\}\s*\}/,
  `async function saveProntuario() {
    if (!effectivePacienteId || !medicoId) return;
    try {
      setSavingProntuario(true); setProntuarioMsg(null);
      await saveProntuarioClinicoMedico({
        pacienteId: effectivePacienteId,
        medicoId,
        tipoDiabetes: pTipoDiabetes,
        diagnosticosCid: pDiagnosticos,
        comorbidades: pComorbidades,
        alergias: pAlergias,
        queixaPrincipal: pQueixa,
        historicoDomencaAtual: pHistorico,
        usaInsulina: pUsaInsulina === 'sim',
        esquemaInsulina: pEsquemaInsulina,
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
  }`
);

// saveAntropometria
s = s.replace(
  /await addAntropometria\(\{[\s\S]*?actor: usuarioLogado,\s*\}\);/,
  `await saveAntropometriaMedico({
        pacienteId: effectivePacienteId,
        medicoId,
        pesoKg: antPeso || null,
        alturaCm: antAltura || null,
        circAbdominalCm: antCirc || null,
        observacao: antObs,
        actor: usuarioLogado,
      });`
);

// saveEvolucao
s = s.replace(
  /await addEvolucao\(\{[\s\S]*?actor: usuarioLogado,\s*\}\);/,
  `await saveEvolucaoMedico({
        pacienteId: effectivePacienteId,
        medicoId,
        subjetivo: evolucaoSubjetivo,
        avaliacao: evolucaoAvaliacao,
        plano: evolucaoPlano,
        orientacoes: evolucaoOrientacoes,
        actor: usuarioLogado,
      });`
);

// saveMeta: medico actor, null nutri id
s = s.replace(
  /await upsertMetaClinica\(\{[\s\S]*?actor: usuarioLogado,\s*\}\);/,
  `await upsertMetaClinica({
        pacienteId: effectivePacienteId,
        nutricionistaId: null,
        metaHba1c: metaHba1c || null,
        metaGlicemiaJejum: metaGlicemia || null,
        metaCalorias: metaCalorias || null,
        metaCarboidratos: metaCarbo || null,
        metaProteinas: metaProt || null,
        metaGorduras: metaGord || null,
        observacao: metaObs,
        actor: usuarioLogado,
      });`
);

// loadRegistros: medico bundle
s = s.replace(
  /const loadRegistros = useCallback\(async \(\) => \{[\s\S]*?\}, \[[\s\S]*?\]\);/,
  `const loadRegistros = useCallback(async () => {
    if (!effectivePacienteId || !medicoId) return;
    try {
      setLoadingRegistros(true);
      setRegistrosLoadError('');
      const bundle = await fetchProntuarioClinicoMedico(effectivePacienteId, medicoId);
      setGlicemias(sortRegistrosNewestFirst(bundle.glicemias || []));
      setMedicacoes(sortRegistrosNewestFirst(bundle.medicamentos || []));
      setInsulinas(sortRegistrosNewestFirst(bundle.insulinas || []));
      const refeicoesExp = patientExperience?.appState?.mealEntries || [];
      setRefeicoes(sortRegistrosNewestFirst(refeicoesExp));
      setRegistrosLoadError('');
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
  }, [effectivePacienteId, medicoId, patientExperience]);`
);

// meal plan: view-only for medico
s = s.replace(
  /async function saveMealPlan\(\) \{/,
  'async function saveMealPlan() {\n    setPlanMessage({ tipo: \'erro\', texto: \'Plano alimentar é gerenciado pelo nutricionista.\' }); return;'
);

s = s.replace(
  /<PrimaryButton label=\{activeMealPlan\?\.id \? 'Atualizar plano' : 'Salvar plano'\}[^/]+\/>/,
  `<PrimaryButton label={activeMealPlan?.id ? 'Atualizar plano' : 'Salvar plano'} icon="save-outline" onPress={saveMealPlan} loading={savingPlan} disabled />`
);

s = s.replace(
  /<PrimaryButton label="Adicionar refeição"[^/]+\/>/,
  '<PrimaryButton label="Adicionar refeição" icon="add-circle-outline" onPress={addMeal} variant="brandText" disabled />'
);

// filter evolucao to medico entries in display - already in fetchProntuarioClinicoMedico; loadProntuario uses full evolucao - patch load to filter
s = s.replace(
  /setProntuarioCompleto\(resultado\);/,
  `setProntuarioCompleto({
        ...resultado,
        evolucao: (resultado?.evolucao || []).filter(
          (e) => e.medico_id === medicoId || !e.nutricionista_id
        ),
      });`
);

fs.writeFileSync(outPath, s, 'utf8');
console.log('Wrote', outPath);
