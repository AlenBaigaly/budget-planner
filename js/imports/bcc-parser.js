/** BCC table parser verified against a downloaded BCC account-statement PDF. */
export function parseBccStatementText(rawText) {
  const text = String(rawText || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');
  if (!/банк центркредит|centercredit|#bccpay/i.test(text)) throw new Error('Это не похоже на выписку BCC.');
  // In BCC's PDF table the "sum in KZT" column may omit its repeated KZT
  // label on the visual line, while the next commission column includes it.
  const pattern = /(20\d{2}-\d{2}-\d{2})\s+(20\d{2}-\d{2}-\d{2})\s+([\s\S]*?)\s+(\d[\d ]*(?:\.\d{2})?)\s*KZT\s+(-?\d[\d ]*(?:\.\d{2})?)\s+\d[\d ]*(?:\.\d{2})?\s*KZT/g;
  const operations = [];
  let match;
  while ((match = pattern.exec(text))) {
    const description = match[3].replace(/\s+/g, ' ').trim();
    const signedAmount = Number(match[5].replace(/\s/g, ''));
    if (!description || !Number.isFinite(signedAmount) || !signedAmount) continue;
    operations.push({ bank: 'BCC', date: match[1], time: '', description, amount: Math.abs(signedAmount), type: signedAmount > 0 ? 'income' : 'expense', currency: 'KZT' });
  }
  if (!operations.length) throw new Error('Не удалось прочитать строки BCC. Проверь, что это полная банковская выписка, а не квитанция.');
  return operations;
}
