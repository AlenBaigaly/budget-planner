import { parseGenericCsv } from './generic-csv.js';
import { parseBccPdf } from './bcc-pdf.js';

const ext = (file) => (file?.name || '').split('.').pop().toLowerCase();
const textFile = (file) => ['csv', 'txt'].includes(ext(file));

function factory(id, bank, keywords) {
  return {
    id, bank,
    canHandle(file) { return textFile(file) && keywords.some((keyword) => file.name.toLowerCase().includes(keyword)); },
    async parse(file) { return parseGenericCsv(await file.text(), bank); }
  };
}

export const bankAdapters = [
  {
    id: 'bcc-pdf', bank: 'BCC',
    canHandle(file) { return ext(file) === 'pdf'; },
    parse: parseBccPdf
  },
  factory('kaspi-csv', 'Kaspi', ['kaspi']),
  factory('bcc-csv', 'BCC', ['bcc', 'центркредит']),
  {
    id: 'generic-csv', bank: 'Неизвестный банк',
    canHandle: textFile,
    async parse(file) { return parseGenericCsv(await file.text(), 'Неизвестный банк'); }
  }
];

export function unsupportedFileMessage(file) {
  const extension = ext(file);
  if (['xlsx', 'xls'].includes(extension)) return `Формат .${extension} будет подключён после добавления локальных библиотек и проверки образца выписки.`;
  return 'Поддерживаются CSV/TXT с таблицей операций. Формат файла не распознан.';
}
