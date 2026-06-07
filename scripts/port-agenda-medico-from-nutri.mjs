import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = path.join(__dirname, '../src/telas');
const srcPath = path.join(base, 'nutricionista/TelaAgendaNutricionista.js');
const outPath = path.join(base, 'medico/TelaAgendaMedico.js');

let s = fs.readFileSync(srcPath, 'utf8');

s = s.replace(
  /import LayoutNutricionista from[^;]+;/,
  "import LayoutMedico from '../../componentes/medico/LayoutMedico';"
);
s = s.replace(
  /import \{\n  getNutritionistId,[\s\S]*?\} from '\.\.\/\.\.\/servicos\/servicoVinculosNutricionista';/,
  `import {
  getMedicoId,
  listConsultasMedicoComPaciente,
  listPatientsByDoctor,
} from '../../servicos/servicoVinculosMedico';`
);
s = s.replace(/import \{ carregarSessaoNutricionista \}[^;]+;\n/, '');
s = s.replace(
  /import \{\n  listFollowUpRequestsByNutritionist,[\s\S]*?\} from '\.\.\/\.\.\/servicos\/servicoSolicitacoesAcompanhamento';/,
  `import {
  listFollowUpRequestsByDoctor,
  updateDoctorFollowUpRequestStatus,
} from '../../servicos/servicoSolicitacoesAcompanhamento';`
);
s = s.replace(
  /import \{\n  generateSlotsForNextDays,[\s\S]*?\} from '\.\.\/\.\.\/servicos\/servicoAgendaNutri';/,
  `import { generateSlotsForNextDays } from '../../servicos/servicoAgendaNutri';
import { listMedicoAvailability } from '../../servicos/servicoAgendaMedico';`
);
s = s.replace(/  createConsulta,/, '  createConsultaMedico,');
s = s.replace(
  /import \{ nutriTheme as patientTheme \}/,
  'import { medicoTheme as patientTheme }'
);
s = s.replace(
  'import PainelDisponibilidadeAgendaProfissional',
  "import BotaoAcaoMedico from '../../componentes/medico/BotaoAcaoMedico';\nimport PainelDisponibilidadeAgendaProfissional"
);
s = s.replace(
  /export default function TelaAgendaNutricionista/,
  'export default function TelaAgendaMedico'
);

const reps = [
  ['LayoutNutricionista', 'LayoutMedico'],
  ['NutricionistaAgenda', 'MedicoAgenda'],
  ['nutricionistaId', 'medicoId'],
  ['setNutricionistaId', 'setMedicoId'],
  ['getNutritionistId', 'getMedicoId'],
  ['resolveNutritionistId', 'getMedicoId'],
  ['listConsultasNutricionistaComPaciente', 'listConsultasMedicoComPaciente'],
  ['listFollowUpRequestsByNutritionist', 'listFollowUpRequestsByDoctor'],
  ['updateFollowUpRequestStatus', 'updateDoctorFollowUpRequestStatus'],
  ['listPatientsByNutritionist', 'listPatientsByDoctor'],
  ['listNutriAvailability', 'listMedicoAvailability'],
  ['nutriAvailability', 'medicoAvailability'],
  ['setNutriAvailability', 'setMedicoAvailability'],
  ['nutriAgendaSlots', 'medicoAgendaSlots'],
  ['createConsulta(', 'createConsultaMedico('],
  ['nutricionista:', 'medico:'],
  ['variant="nutri"', 'variant="medico"'],
  ["origin: 'agenda_nutricionista'", "origin: 'agenda_medico'"],
  ['agenda_nutricionista', 'agenda_medico'],
  ['Erro ao carregar agenda do nutricionista', 'Erro ao carregar agenda do medico'],
  ['Erro ao criar consulta pelo nutricionista', 'Erro ao criar consulta pelo medico'],
];

for (const [a, b] of reps) s = s.split(a).join(b);

s = s.replace(
  /  useEffect\(\(\) => \{[\s\S]*?resolverNutricionistaId[\s\S]*?\}, \[usuarioLogado\]\);\n\n/,
  ''
);

s = s.replace(
  /const \[medicoId, setMedicoId\] = useState\(\(\) => getMedicoId\(usuarioLogado\)\);/,
  'const medicoId = useMemo(() => getMedicoId(usuarioLogado), [usuarioLogado]);'
);

s = s.replace(/        convenio: form\.convenio,\n/, '');

if (!s.includes('RefreshControl')) {
  s = s.replace('Modal,\n  Platform,', 'Modal,\n  Platform,\n  RefreshControl,');
  s = s.replace(
    'const [loading, setLoading] = useState(true);',
    'const [loading, setLoading] = useState(true);\n  const [refreshing, setRefreshing] = useState(false);'
  );
  s = s.replace(
    `  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);`,
    `  async function handleRefresh() {
    setRefreshing(true);
    await loadAgenda();
    setRefreshing(false);
  }

  useEffect(() => {
    loadAgenda();
  }, [loadAgenda]);`
  );
  s = s.replace(
    "showTabBar={route?.name === 'MedicoAgenda'}",
    `showTabBar={route?.name === 'MedicoAgenda'}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[patientTheme.colors.primaryDark]}
        />
      }`
  );
}

s = s.replace(
  /<TouchableOpacity\s+style=\{\[\s*styles\.greenCenterButton,\s*styles\.createSubmitButton[\s\S]*?<\/TouchableOpacity>/,
  `<BotaoAcaoMedico
          label="Agendar consulta"
          icon="calendar"
          onPress={handleCriarConsulta}
          disabled={!canCreateConsulta}
          loading={savingConsulta}
          style={[styles.createSubmitButton, !canCreateConsulta && styles.disabledButton]}
        />`
);

s = s.replace(
  /<TouchableOpacity\s+style=\{styles\.greenCenterButton\}[\s\S]*?Agendar Consulta[\s\S]*?<\/TouchableOpacity>/,
  `<BotaoAcaoMedico
                    label="Agendar consulta"
                    icon="calendar-outline"
                    onPress={() => setShowCreateForm(true)}
                    compact
                  />`
);

s = s.replace(/confirmPrimaryButton:/g, 'confirmPrimaryButtonMedico:');
s = s.replace(/styles\.confirmPrimaryButton/g, 'styles.confirmPrimaryButtonMedico');

if (!s.includes('actionPrimary')) {
  s = s.replace(
    /confirmPrimaryButtonMedico: \{\n    minHeight: 44,/,
    `confirmPrimaryButtonMedico: {
    backgroundColor: patientTheme.colors.actionPrimary,
    borderColor: patientTheme.colors.actionPrimary,
    minHeight: 44,`
  );
  s = s.replace(
    /inlineActionButton: \{\n    minHeight: 28,[\s\S]*?backgroundColor: patientTheme\.colors\.primary,/,
    `inlineActionButton: {
    minHeight: 28,
    minWidth: 28,
    borderRadius: patientTheme.radius.pill,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: patientTheme.colors.actionPrimary,
    borderWidth: 0,`
  );
  s = s.replace(
    /primaryHeaderButton: \{\n    minHeight: 34,[\s\S]*?backgroundColor: patientTheme\.colors\.primary,/,
    `primaryHeaderButton: {
    minHeight: 34,
    borderRadius: patientTheme.radius.lg,
    backgroundColor: patientTheme.colors.actionPrimary,
    borderWidth: 0,`
  );
}

fs.writeFileSync(outPath, s);
console.log('OK', outPath);
