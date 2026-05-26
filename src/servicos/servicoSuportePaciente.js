import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { registrarLogAuditoria } from './servicoAuditoria';
import { getPatientDisplayName, getPatientId } from './servicoDadosPaciente';
import { supabase } from './configSupabase';
import {
  REFEICAO_IA_BUCKET,
  escolherImagemRefeicaoDaGaleria,
  tirarFotoRefeicao,
} from './servicoRefeicaoIA';

export { escolherImagemRefeicaoDaGaleria as escolherPrintSuporteDaGaleria };
export { tirarFotoRefeicao as tirarFotoPrintSuporte };

/** E-mail exibido ao paciente e usado no mailto quando não há override no .env */
export const EMAIL_CONTATO_SUPORTE = 'glicnutri.app@gmail.com';

const SUPORTE_EMAIL =
  String(process.env.EXPO_PUBLIC_SUPORTE_EMAIL || '').trim() || EMAIL_CONTATO_SUPORTE;

export const CATEGORIAS_SUPORTE = [
  {
    id: 'bug',
    label: 'Problema no app',
    icon: 'bug-outline',
    exemplo: 'Ex.: registro de glicemia não salvou',
  },
  {
    id: 'duvida',
    label: 'Dúvida de uso',
    icon: 'help-circle-outline',
    exemplo: 'Ex.: como vincular nutricionista',
  },
  {
    id: 'conta',
    label: 'Conta e acesso',
    icon: 'person-outline',
    exemplo: 'Ex.: não consigo entrar no app',
  },
  {
    id: 'dados',
    label: 'Dados incorretos',
    icon: 'document-text-outline',
    exemplo: 'Ex.: informação errada no perfil',
  },
  {
    id: 'sugestao',
    label: 'Sugestão',
    icon: 'bulb-outline',
    exemplo: 'Ex.: melhoria na tela de histórico',
  },
  {
    id: 'outro',
    label: 'Outro',
    icon: 'chatbox-ellipses-outline',
    exemplo: 'Descreva com calma o que aconteceu',
  },
];

export function getCategoriaSuporteLabel(categoriaId) {
  return CATEGORIAS_SUPORTE.find((item) => item.id === categoriaId)?.label || 'Relato';
}

export function gerarProtocoloSuporte() {
  const stamp = Date.now().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const suffix = String(Date.now()).slice(-5);
  return `GLN-${stamp.slice(-5)}${suffix}`;
}

function getVersaoApp() {
  return (
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    Constants.manifest?.version ||
    'dev'
  );
}

export function getEmailSuporteConfigurado() {
  return SUPORTE_EMAIL || EMAIL_CONTATO_SUPORTE;
}

function inferExtension(fileName, mimeType) {
  const fromName = String(fileName || '').split('.').pop()?.toLowerCase();
  if (fromName && ['jpg', 'jpeg', 'png', 'webp'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  if (String(mimeType || '').includes('png')) return 'png';
  return 'jpg';
}

function inferMimeType(fileName, mimeType) {
  const ext = inferExtension(fileName, mimeType);
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Envia print/foto do relato para o Storage (mesmo bucket das refeições, pasta suporte/).
 */
export async function uploadImagemPrintSuporte({ asset, patientId, protocolo }) {
  if (!asset?.uri) {
    throw new Error('Selecione uma imagem antes de enviar.');
  }

  const folder = patientId || 'anon';
  const mimeType = inferMimeType(asset.fileName, asset.mimeType);
  const extension = inferExtension(asset.fileName, mimeType);
  const fileName = `print-${Date.now()}.${extension}`;
  const safeProtocolo = String(protocolo || 'relato').replace(/[^\w-]/g, '');
  const filePath = `suporte/${folder}/${safeProtocolo}/${fileName}`;

  const response = await fetch(asset.uri);
  const body = await response.arrayBuffer();

  const { error } = await supabase.storage.from(REFEICAO_IA_BUCKET).upload(filePath, body, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(
      error?.message || 'Não foi possível enviar a imagem. Verifique a conexão e tente novamente.'
    );
  }

  return {
    bucket: REFEICAO_IA_BUCKET,
    path: filePath,
    storagePath: `storage://${REFEICAO_IA_BUCKET}/${filePath}`,
    mimeType,
  };
}

export function montarUrlEmailSuporte({
  protocolo,
  categoria,
  assunto,
  mensagem,
  usuarioLogado,
  telaAtual,
  printFotoUrl,
}) {
  if (!SUPORTE_EMAIL) {
    return null;
  }

  const nome = getPatientDisplayName(usuarioLogado);
  const emailPaciente =
    usuarioLogado?.email_pac || usuarioLogado?.email || 'não informado';
  const patientId = getPatientId(usuarioLogado) || 'não informado';
  const categoriaLabel = getCategoriaSuporteLabel(categoria);
  const titulo = assunto?.trim() || categoriaLabel;

  const corpo = [
    `Protocolo: ${protocolo}`,
    `Categoria: ${categoriaLabel}`,
    `Assunto: ${titulo}`,
    '',
    'Mensagem do paciente:',
    mensagem.trim(),
    '',
    '---',
    `Paciente: ${nome}`,
    `E-mail: ${emailPaciente}`,
    `ID: ${patientId}`,
    `Tela: ${telaAtual || 'não informada'}`,
    `Plataforma: ${Platform.OS}`,
    `Versão do app: ${getVersaoApp()}`,
    printFotoUrl ? `Print anexado: ${printFotoUrl}` : 'Print anexado: não',
  ].join('\n');

  const subject = encodeURIComponent(`[GlicNutri ${protocolo}] ${titulo}`);
  const body = encodeURIComponent(corpo);

  return `mailto:${SUPORTE_EMAIL}?subject=${subject}&body=${body}`;
}

export async function abrirEmailSuporte(params) {
  const url = montarUrlEmailSuporte(params);
  if (!url) {
    return false;
  }

  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    return false;
  }

  await Linking.openURL(url);
  return true;
}

/**
 * Registra o relato na auditoria (painel Admin → Auditoria).
 * Não há equipe de suporte: um único responsável acompanha esses eventos.
 */
export async function enviarRelatoSuporte({
  categoria,
  assunto,
  mensagem,
  usuarioLogado,
  telaAtual,
  printAsset,
}) {
  const texto = String(mensagem || '').trim();

  if (texto.length < 12) {
    throw new Error('Descreva o problema com pelo menos 12 caracteres.');
  }

  if (!categoria) {
    throw new Error('Escolha o tipo do relato.');
  }

  const protocolo = gerarProtocoloSuporte();
  const patientId = getPatientId(usuarioLogado);
  const categoriaLabel = getCategoriaSuporteLabel(categoria);
  const titulo = String(assunto || '').trim() || categoriaLabel;

  let printFotoUrl = null;
  let avisoPrint = null;

  if (printAsset?.uri) {
    try {
      const upload = await uploadImagemPrintSuporte({
        asset: printAsset,
        patientId,
        protocolo,
      });
      printFotoUrl = upload.storagePath;
    } catch (error) {
      console.log('Erro ao enviar print do suporte:', error);
      avisoPrint =
        error?.message ||
        'O relato foi salvo, mas o print não pôde ser enviado. Tente anexar de novo em outro relato.';
    }
  }

  const audit = await registrarLogAuditoria({
    actor: usuarioLogado,
    actorType: 'paciente',
    targetPatientId: patientId,
    action: 'relato_suporte_paciente',
    entity: 'suporte',
    entityId: protocolo,
    origin: 'suporte_paciente',
    status: 'sucesso',
    details: {
      protocolo,
      categoria,
      categoriaLabel,
      assunto: titulo,
      mensagem: texto,
      telaAtual: telaAtual || null,
      plataforma: Platform.OS,
      versaoApp: getVersaoApp(),
      canal: 'app_paciente',
      destino: 'responsavel_glicnutri',
      possuiPrint: Boolean(printFotoUrl),
      printFotoUrl,
    },
  });

  if (!audit) {
    throw new Error(
      'Não foi possível registrar o relato agora. Verifique a conexão e tente de novo.'
    );
  }

  return {
    protocolo,
    auditPath: audit.path,
    emailDisponivel: Boolean(SUPORTE_EMAIL),
    printFotoUrl,
    avisoPrint,
  };
}
