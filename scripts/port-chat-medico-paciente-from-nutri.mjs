import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = path.join(__dirname, '../src/telas/paciente');
const srcPath = path.join(base, 'TelaChatNutricionistaDetalhePaciente.js');
const outPath = path.join(base, 'TelaChatMedicoDetalhePaciente.js');

let s = fs.readFileSync(srcPath, 'utf8');

s = s.replace(
  /import \{[\s\S]*?savePatientNutritionistChat,[\s\S]*?\} from '\.\.\/\.\.\/servicos\/servicoDadosPaciente';/,
  `import {
  fetchPatientById,
  getPatientDisplayName,
  getPatientId,
} from '../../servicos/servicoDadosPaciente';
import {
  fetchPatientMedicoChatThread,
  mergeMedicoChatMessageIntoThread,
  normalizeMedicoThreadEntry,
  savePatientMedicoChat,
} from '../../servicos/servicoChatMedico';
import { mapMedicoRealtimeChatRowToThreadEntry } from '../../servicos/servicoMensagensChatMedico';
import { getMedicoById } from '../../servicos/servicoMedicos';`
);

s = s.replace(
  /import \{[\s\S]*?replaceCachedPatientChat,[\s\S]*?\} from '\.\.\/\.\.\/servicos\/cacheExperienciaPaciente';\n/,
  ''
);
s = s.replace(/import \{ getNutritionistById \}[^;]+;\n/, '');
s = s.replace(
  /export default function TelaChatNutricionistaDetalhePaciente/,
  'export default function TelaChatMedicoDetalhePaciente'
);

const reps = [
  ['routeNutritionist', 'routeMedico'],
  ['routeInitialNutritionist', 'routeInitialMedico'],
  ['nutritionistThread', 'medicoThread'],
  ['setNutritionist', 'setMedico'],
  ['nutritionist,', 'medico,'],
  ['nutritionist?', 'medico?'],
  ['nutritionistName', 'medicoName'],
  ['nutritionistMeta', 'medicoMeta'],
  ['Nutritionist', 'Medico'],
  ['nutricionista', 'medico'],
  ['nome_completo_nutri', 'nome_completo_medico'],
  ['nome_nutri', 'nome_medico'],
  ['nutricionista_id', 'medico_id'],
  ['fetchPatientChatThreadEnriched', 'fetchPatientMedicoChatThread'],
  ['savePatientNutritionistChat', 'savePatientMedicoChat'],
  ['mergeChatMessageIntoThread', 'mergeMedicoChatMessageIntoThread'],
  ['mapRealtimeChatRowToThreadEntry', 'mapMedicoRealtimeChatRowToThreadEntry'],
  ['table: \'mensagem_chat\'', "table: 'mensagem_chat_medico'"],
  ['patient-chat-', 'patient-medico-chat-'],
  ['message.role === \'nutri\'', "message.role === 'medico'"],
  ['item?.role === \'nutri\'', "item?.role === 'medico'"],
  ['buildFallbackNutritionist', 'buildFallbackMedico'],
  ['Acompanhamento nutricional', 'Acompanhamento medico'],
  ['sua nutricionista', 'seu medico'],
  ['nutricionista:', 'medico:'],
  ['CRN', 'CRM'],
  ['styles.messageRowNutri', 'styles.messageRowMedico'],
  ['styles.bubbleNutri', 'styles.bubbleMedico'],
];

for (const [a, b] of reps) s = s.split(a).join(b);

s = s.replace(/getNutritionistById/g, 'getMedicoById');
s = s.replace(/invalidatePatientChatCache\([^)]+\);\n/g, '');
s = s.replace(/replaceCachedPatientChat\([\s\S]*?\}\);\n/g, '');
s = s.replace(/getCachedPatientChat\([^)]+\)/g, 'null');
s = s.replace(/createDefaultAppState\(\)/g, '{ medicoThread: [] }');
s = s.replace(/extractObjectiveAndAppState[\s\S]*?clinicalObjectiveText = parsedObjective.objectiveText[^;]+;/g, '');
s = s.replace(/setClinicalObjective\([^)]+\);\n/g, '');
s = s.replace(/clinicalObjective/g, 'clinicalObjectiveUnused');

s = s.replace(
  /        const medicoThread = await fetchPatientMedicoChatThread\(patientId, \{[\s\S]*?\}\);/,
  `        const resolvedMedicoId =
          routeMedico?.id_medico_uuid ||
          patientRow?.id_medico_uuid ||
          null;

        const medicoThread = await fetchPatientMedicoChatThread(patientId, resolvedMedicoId, {
          patientContext: usuarioLogado,
          patientName: patientNamePreview,
          medicoName: medicoNamePreview,
          limit: 200,
          rpcActor: patientActor,
        });`
);

s = s.replace(
  /const medicoNamePreview =[\s\S]*?'Nutricionista';/,
  `const medicoNamePreview =
          routeInitialMedico?.nome_completo_medico ||
          routeInitialMedico?.nome_medico ||
          'Medico';`
);

fs.writeFileSync(outPath, s);
console.log('OK', outPath);
