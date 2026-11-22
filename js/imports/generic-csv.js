import { normalizeDate, normalizeMoney, parseDelimited } from './core.js';

const HEADER_ALIASES = {
  date: ['дата', 'date', 'дата операции'],
  time: ['время', 'time'],
  amount: ['сумма', 'amount', 'сумма операции'],
  income: ['зачисление', 'приход', 'income'],
  expense: ['списание', 'расход', 'expense'],
  description: ['описание', 'назначение', 'детали', 'merchant', 'наименование'],
  currency: ['валюта', 'currency']
};

function columnIndex(headers, aliases) {
  return headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));
}

export function parseGenericCsv(text, bank = 'unknown') {
  const { rows } = parseDelimited(text);
  if (rows.length < 2) throw new Error('В выписке не найдены строки операций.');
  const headers = rows[0].map((cell) => cell.toLowerCase().trim());
  const dateIndex = columnIndex(headers, HEADER_ALIASES.date);
  const amountIndex = columnIndex(headers, HEADER_ALIASES.amount);
  const incomeIndex = columnIndex(headers, HEADER_ALIASES.income);
  const expenseIndex = columnIndex(headers, HEADER_ALIASES.expense);
  const descriptionIndex = columnIndex(headers, HEADER_ALIASES.description);
  if (dateIndex < 0 || (amountIndex < 0 && incomeIndex < 0 && expenseIndex < 0)) {
    throw new Error('Не узнал колонки выписки. Нужны как минимум «Дата» и «Сумма»/«Списание»/«Зачисление».');
  }
  const timeIndex = columnIndex(headers, HEADER_ALIASES.time);
  const currencyIndex = columnIndex(headers, HEADER_ALIASES.currency);
  return rows.slice(1).map((row) => {
    const income = incomeIndex >= 0 ? normalizeMoney(row[incomeIndex]) : 0;
    const expense = expenseIndex >= 0 ? normalizeMoney(row[expenseIndex]) : 0;
    const amountRaw = amountIndex >= 0 ? normalizeMoney(row[amountIndex]) : (income || expense);
    const signed = amountIndex >= 0 && /^\s*-/.test(row[amountIndex] || '') ? -amountRaw : amountRaw;
    const type = income > 0 || signed > 0 && expenseIndex < 0 ? 'income' : 'expense';
    return {
      bank, date: normalizeDate(row[dateIndex]), time: timeIndex >= 0 ? row[timeIndex] : '',
      amount: Math.abs(income || expense || signed), type,
      description: descriptionIndex >= 0 ? row[descriptionIndex] : '',
      currency: currencyIndex >= 0 ? (row[currencyIndex] || 'KZT') : 'KZT'
    };
  }).filter((operation) => operation.date && operation.amount);
}
