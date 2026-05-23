import { Alert, Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

function sanitizeFileName(value) {
  return String(value || 'relatorio')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 120);
}

function downloadOnWeb(fileName, content, mimeType) {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof Blob === 'undefined') {
    return false;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
}

export async function downloadTextFile(fileName, content) {
  const safeName = sanitizeFileName(fileName);
  const body = String(content ?? '');

  if (downloadOnWeb(safeName, body, 'text/plain;charset=utf-8')) {
    return { ok: true, method: 'web-download' };
  }

  try {
    const result = await Share.share({
      title: safeName,
      message: body,
    });

    if (result?.action === Share.dismissedAction) {
      return { ok: false, method: 'share-dismissed' };
    }

    return { ok: true, method: 'share' };
  } catch (error) {
    console.log('Erro ao compartilhar arquivo de texto:', error);
    Alert.alert('Exportação', 'Não foi possível exportar o arquivo neste dispositivo.');
    return { ok: false, method: 'error', error };
  }
}

export async function downloadJsonFile(fileName, data) {
  const safeName = sanitizeFileName(fileName).replace(/\.json$/i, '') + '.json';
  const body = JSON.stringify(data, null, 2);
  return downloadTextFile(safeName, body);
}

export async function downloadCsvFile(fileName, rows = []) {
  const safeName = sanitizeFileName(fileName).replace(/\.csv$/i, '') + '.csv';
  const csvLines = (Array.isArray(rows) ? rows : []).map((row) =>
    (Array.isArray(row) ? row : [])
      .map((cell) => {
        const text = String(cell ?? '').replace(/"/g, '""');
        return `"${text}"`;
      })
      .join(';')
  );
  const body = `\uFEFF${csvLines.join('\n')}`;
  return downloadTextFile(safeName, body);
}

function downloadPdfOnWeb(fileName, base64Data) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return false;
  }

  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
}

export async function downloadPdfDocument(fileName, pdfDoc) {
  const safeName = sanitizeFileName(fileName).replace(/\.pdf$/i, '') + '.pdf';
  const base64 = pdfDoc.output('datauristring').split(',')[1] || '';

  if (!base64) {
    throw new Error('Nao foi possivel gerar o arquivo PDF.');
  }

  if (downloadPdfOnWeb(safeName, base64)) {
    return { ok: true, method: 'web-download' };
  }

  const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!cacheDir) {
    throw new Error('Armazenamento local indisponivel para salvar o PDF.');
  }

  const uri = `${cacheDir}${safeName}`;

  try {
    await FileSystem.writeAsStringAsync(uri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: safeName,
      });
      return { ok: true, method: 'share' };
    }

    Alert.alert(
      'PDF gerado',
      'O arquivo foi salvo no cache do aplicativo. Ative o compartilhamento para exportar em outros apps.'
    );
    return { ok: true, method: 'cache-only', uri };
  } catch (error) {
    console.log('Erro ao exportar PDF:', error);
    Alert.alert('Exportacao', 'Nao foi possivel exportar o PDF neste dispositivo.');
    return { ok: false, method: 'error', error };
  }
}
