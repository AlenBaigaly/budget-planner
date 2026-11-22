/** Bank statement import contracts shared by Kaspi, BCC and future adapters. */

export function normalizeMoney(value) {
  const raw = String(value ?? '').replace(/\u00a0/g, ' ').replace(/[₸₸$€]/g, '').replace(/[^0-9,.-]/g, '');
  if (!raw) return 0;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  const decimalAt = Math.max(comma, dot);
  const normalized = decimalAt >= 0
    ? `${raw.slice(0, decimalAt).replace(/[,.]/g, '')}.${raw.slice(decimalAt + 1).replace(/[,.]/g, '')}`
    : raw.replace(/[,.]/g, '');
  return Number(normalized) || 0;
}

export function normalizeDate(value) {
  const text = String(value || '').trim();
  const iso = text.match(/^(20\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const local = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](20\d{2}|\d{2})/);
  if (!local) return '';
  return `${local[3].length === 2 ? `20${local[3]}` : local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
}

export function parseDelimited(text) {
  const firstLine = String(text || '').split(/\r?\n/).find((line) => line.trim()) || '';
  const delimiter = [';', ',', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]; const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return { delimiter, rows };
}

export function makeOperationFingerprint(operation) {
  const text = [operation.date, operation.time || '', operation.amount, operation.currency || 'KZT', operation.description || '', operation.accountHint || ''] 
    .map((item) => String(item).trim().toLowerCase()).join('|');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `op_${(hash >>> 0).toString(16)}`;
}

export function findDuplicates(operations, transactions, accountId = '') {
  const existing = new Set((transactions || []).map((tx) => tx.importFingerprint).filter(Boolean));
  const seen = new Set();
  return operations.map((operation) => {
    const fingerprint = makeOperationFingerprint({ ...operation, accountHint: accountId || operation.accountHint });
    const normalizedDescription = String(operation.description || '').toLowerCase().replace(/[^a-zа-яё0-9]/gi, '');
    const legacyMatch = (transactions || []).some((tx) => {
      if (tx.accountId && accountId && tx.accountId !== accountId) return false;
      if ((tx.date || '') !== operation.date || Math.abs(Number(tx.amount || 0) - Number(operation.amount || 0)) > 0.009) return false;
      if (tx.type !== operation.type && tx.type !== 'transfer') return false;
      const txText = String(tx.note || '').toLowerCase().replace(/[^a-zа-яё0-9]/gi, '');
      return normalizedDescription.length > 3 && (txText.includes(normalizedDescription) || normalizedDescription.includes(txText));
    });
    const duplicate = existing.has(fingerprint) || seen.has(fingerprint) || legacyMatch;
    seen.add(fingerprint);
    return { ...operation, fingerprint, duplicate };
  });
}

export function markOwnTransfers(operations, accounts) {
  const aliases = (accounts || []).flatMap((account) => [account.name, account.maskedNumber]).filter(Boolean).map((value) => String(value).toLowerCase());
  return operations.map((operation) => {
    const description = String(operation.description || '').toLowerCase();
    const looksLikeTransfer = /перевод|p2p|между счет|пополнение/.test(description);
    const own = looksLikeTransfer && aliases.some((alias) => alias.length > 3 && description.includes(alias));
    return { ...operation, isOwnTransfer: own, type: own ? 'transfer' : operation.type };
  });
}

export function chooseAdapter(file, adapters) {
  return adapters.find((adapter) => adapter.canHandle(file)) || null;
}
