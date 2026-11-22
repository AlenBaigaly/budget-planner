import * as pdfjsLib from '../../vendor/pdf.min.mjs';
import { parseBccStatementText } from './bcc-parser.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.mjs';

function groupPageLines(items) {
  const rows = new Map();
  items.forEach((item) => {
    const y = Math.round(item.transform[5]);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push({ text: item.str, x: item.transform[4] });
  });
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text).join(' '));
}

export async function extractPdfText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages = [];
  for (let pageNo = 1; pageNo <= document.numPages; pageNo += 1) {
    const page = await document.getPage(pageNo);
    const content = await page.getTextContent();
    pages.push(groupPageLines(content.items).join('\n'));
  }
  return pages.join('\n');
}

export async function parseBccPdf(file) {
  return parseBccStatementText(await extractPdfText(file));
}
