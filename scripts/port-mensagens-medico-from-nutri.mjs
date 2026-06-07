import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = path.join(__dirname, '../src/telas');
const srcPath = path.join(base, 'nutricionista/TelaMensagensNutricionista.js');
const outPath = path.join(base, 'medico/TelaMensagensMedico.js');

let s = fs.readFileSync(srcPath, 'utf8');

// Layout + tabs
s = s.replace(
  /import LayoutNutricionista from[^;]+;/,
  "import LayoutMedico from '../../componentes/medico/LayoutMedico';"
);
s = s.replace(
  /import \{ NUTRI_TAB_BAR_HEIGHT, NUTRI_TAB_BAR_SPACE \}[^;]+;/,
  "import { MEDICO_TAB_BAR_HEIGHT, MEDICO_TAB_BAR_SPACE } from '../../componentes/medico/BarraAbasMedico';"
);
s = s.replace(
  /import \{ nutriTheme as patientTheme, nutriShadow as patientShadow \}[^;]+;/,
  "import { medicoTheme as patientTheme, medicoShadow as patientShadow } from '../../temas/temaVisualNutricionista';"
);

// Drop supabase + nutri data layer
s = s.replace(/import \{ supabase \}[^;]+;\n/, '');
s = s.replace(
  /import \{\n  buildNutritionistThreadPreview,[\s\S]*?savePatientNutritionistChat,\n\} from '\.\.\/\.\.\/servicos\/servicoDadosPaciente';\n/,
  `import {
  buildMedicoThreadPreview,
  fetchCachedMedicoChatInbox,
  fetchMedicoChatInboxForPatientIds,
  fetchMedicoChatThreadForPatient,
  fetchMedicoChatSummary,
  invalidateMedicoChatInboxCache,
  isMedicoProfessionalRole,
  mergeMedicoChatMessageIntoThread,
  normalizeMedicoThreadEntry,
  savePatientMedicoChat,
} from '../../servicos/servicoChatMedico';\n`
);
s = s.replace(/import \{ fetchNutritionistChatSummary \}[^;]+;\n/, '');
s = s.replace(
  /import \{\n  fetchCachedNutriChatInbox,[\s\S]*?\} from '\.\.\/\.\.\/servicos\/cacheExperienciaPaciente';\n/,
  ''
);
s = s.replace(
  /import \{\n  getNutritionistId,[\s\S]*?\} from '\.\.\/\.\.\/servicos\/servicoVinculosNutricionista';/,
  `import {
  getMedicoId,
  listPatientsByDoctor,
} from '../../servicos/servicoVinculosMedico';`
);
s = s.replace(/markNutriChatRead/g, 'markMedicoChatRead');
s = s.replace(/loadNutriChatReadAtForPatients/g, 'loadMedicoChatReadAtForPatients');
s = s.replace(/import \{ garantirSessaoRpcClinicaComPerfil \}[^;]+;\n/, '');
s = s.replace(/import \{ carregarSessaoNutricionista \}[^;]+;\n/, '');

s = s.replace(
  /export default function TelaMensagensNutricionista/,
  'export default function TelaMensagensMedico'
);

const wordReps = [
  ['LayoutNutricionista', 'LayoutMedico'],
  ['NUTRI_TAB_BAR_HEIGHT', 'MEDICO_TAB_BAR_HEIGHT'],
  ['NUTRI_TAB_BAR_SPACE', 'MEDICO_TAB_BAR_SPACE'],
  ['NutricionistaMensagens', 'MedicoMensagens'],
  ['NutriProntuarioPaciente', 'MedicoProntuarioPaciente'],
  ['nutricionistaId', 'medicoId'],
  ['getNutritionistId', 'getMedicoId'],
  ['listPatientsByNutritionist', 'listPatientsByDoctor'],
  ['buildNutritionistThreadPreview', 'buildMedicoThreadPreview'],
  ['normalizeNutritionistThreadEntry', 'normalizeMedicoThreadEntry'],
  ['fetchNutritionistChatInboxForPatientIds', 'fetchMedicoChatInboxForPatientIds'],
  ['fetchNutritionistChatThreadForPatient', 'fetchMedicoChatThreadForPatient'],
  ['fetchNutritionistChatSummary', 'fetchMedicoChatSummary'],
  ['savePatientNutritionistChat', 'savePatientMedicoChat'],
  ['fetchCachedNutriChatInbox', 'fetchCachedMedicoChatInbox'],
  ['invalidateNutriChatInboxCache', 'invalidateMedicoChatInboxCache'],
  ['nutriReadAtByPatientId', 'medicoReadAtByPatientId'],
  ['nutriReadAtRef', 'medicoReadAtRef'],
  ['nutritionistName', 'medicoName'],
  ['nome_completo_nutri', 'nome_completo_medico'],
  ['nome_nutri', 'nome_medico'],
  ['mergeChatMessageIntoThread', 'mergeMedicoChatMessageIntoThread'],
  ['nutritionistThread', 'medicoThread'],
  ['id_nutricionista_uuid', 'id_medico_uuid'],
];

for (const [a, b] of wordReps) s = s.split(a).join(b);

// sessao nutri block
s = s.replace(
  /  const \[nutriSessaoPersistida, setNutriSessaoPersistida\] = useState\(null\);\n\n  useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);\n\n/,
  ''
);

// buildChatItems param
s = s.replace(/nutriReadAtByPatientId = \{\}/g, 'medicoReadAtByPatientId = {}');
s = s.replace(/nutriReadAtByPatientId\[patient\.id\]/g, 'medicoReadAtByPatientId[patient.id]');

// RPC actor -> medico actor (no RPC)
s = s.replace(
  /  const buildChatRpcActor = useCallback\(\(\) => \{[\s\S]*?\}, \[[^\]]+\]\);\n\n  const ensureChatRpcSession = useCallback\(async \(\) => \{[\s\S]*?\}, \[buildChatRpcActor\]\);\n/,
  `  const buildChatActor = useCallback(() => {
    const resolvedMedicoId = medicoId || getMedicoId(usuarioLogado);
    return {
      tipo_perfil: 'medico',
      id_medico_uuid: resolvedMedicoId,
      email_acesso:
        usuarioLogado?.email_acesso ||
        usuarioLogado?.email ||
        usuarioLogado?.email_medico ||
        '',
    };
  }, [medicoId, usuarioLogado]);

  const ensureChatSession = useCallback(async () => {
    const actor = buildChatActor();
    if (!actor.id_medico_uuid) {
      throw new Error('Medico sem identificador para abrir o chat.');
    }
    return actor;
  }, [buildChatActor]);

`
);

s = s.replace(/buildChatRpcActor/g, 'buildChatActor');
s = s.replace(/ensureChatRpcSession/g, 'ensureChatSession');
s = s.replace(/\brpcActor\b/g, 'chatActor');

// Remove realtime supabase subscription
s = s.replace(
  /  useEffect\(\(\) => \{\n    if \(!medicoId\) return undefined;\n\n    const channel = supabase[\s\S]*?  \}, \[loadActiveThread, medicoId, usuarioLogado\]\);\n\n/,
  ''
);

// Thread role checks
s = s.replace(/message\.role === 'nutri'/g, 'isMedicoProfessionalRole(message.role)');
s = s.replace(/role: 'nutri'/g, "role: 'medico'");
s = s.replace(/id: `nutri-/g, 'id: `medico-');

// fetch thread without rpcActor param
s = s.replace(
  /fetchMedicoChatThreadForPatient\(patientId, medicoId, \{\n          patientName,\n          chatActor,\n          limit: 200,\n        \}\)/,
  'fetchMedicoChatThreadForPatient(patientId, medicoId, { patientName, limit: 200 })'
);

// inbox fetch - drop 4th sessionActor arg
s = s.replace(
  /fetchMedicoChatInboxForPatientIds\(\n            patientIds,\n            medicoId,\n            patientsByIdRef\.current,\n            sessionActor\n          \)/,
  'fetchMedicoChatInboxForPatientIds(patientIds, medicoId, patientsByIdRef.current)'
);

// summary with patient ids
s = s.replace(
  /const summary = await fetchMedicoChatSummary\(medicoId\);/,
  'const summary = await fetchMedicoChatSummary(medicoId, patients.map((p) => p.id));'
);
s = s.replace(
  /fetchMedicoChatSummary\(medicoId\)\.then\(\(summary\) => \{/,
  'fetchMedicoChatSummary(medicoId, (patientsRef.current || []).map((p) => p.id)).then((summary) => {'
);

// save chat
s = s.replace(
  /const saved = await savePatientMedicoChat\(\{[\s\S]*?newMessage: \{[\s\S]*?\},\n      \}\);/,
  `const saved = await savePatientMedicoChat({
        patientId: chatSnapshot.patientId,
        medicoId: medicoId || chatActor.id_medico_uuid,
        thread: optimisticThread,
        medicoName,
        patientName: chatSnapshot.patientName,
        newMessage: {
          ...nextMessage,
          medicoName,
          patientName: chatSnapshot.patientName,
        },
      });`
);

s = s.replace(
  /const savedThread = ensureArray\(saved\?\.appState\?\.medicoThread\)\.length\n        \? saved\.appState\.medicoThread\n        : optimisticThread;/,
  `const savedThread = ensureArray(saved?.thread || saved?.appState?.medicoThread).length
        ? saved.thread || saved.appState.medicoThread
        : optimisticThread;`
);

// drop patient cache replace block (nutri-only)
s = s.replace(
  /      replaceCachedPatientChat\(chatSnapshot\.patientId, \{[\s\S]*?\}\);\n      invalidateMedicoChatInboxCache\(chatActor\.id_medico_uuid\);/,
  '      invalidateMedicoChatInboxCache(medicoId || chatActor.id_medico_uuid);'
);

// Error strings
s = s.replace(/Nutricionista sem identificador/g, 'Medico sem identificador');
s = s.replace(/Sua conta de nutricionista/g, 'Sua conta de medico');
s = s.replace(/conversas da nutricionista/g, 'conversas do medico');
s = s.replace(/resposta da nutricionista/g, 'resposta do medico');
s = s.replace(/Sessao RPC do chat \(nutri\)/g, 'Sessao do chat (medico)');
s = s.replace(/'Nutricionista'/g, "'Medico'");

// nextMessage nutritionistName -> medicoName in normalize call
s = s.replace(/nutritionistName:/g, 'medicoName:');

// loadInbox: always load previews when patients exist (no session gate)
s = s.replace(
  /if \(patients\.length && chatActor\) \{/,
  'if (patients.length) {'
);

// session error on load - medico local chat doesn't need RPC
s = s.replace(
  /        let chatActor = null;\n        let sessionLoadError = '';\n\n        try \{\n          chatActor = await ensureChatSession\(\);\n        \} catch \(sessionError\) \{\n          sessionLoadError =[\s\S]*?console\.log\('Sessao do chat \(medico\):', sessionLoadError\);\n        \}\n/,
  '        const chatActor = await ensureChatSession().catch(() => null);\n        let sessionLoadError = chatActor ? \'\' : \'Medico sem identificador para abrir o chat.\';\n'
);

fs.writeFileSync(outPath, s);
console.log('OK', outPath);
