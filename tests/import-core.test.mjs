import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicates, normalizeDate, normalizeMoney, parseDelimited } from '../js/imports/core.js';
import { parseGenericCsv } from '../js/imports/generic-csv.js';

test('normalises Kazakhstan money and dates', () => {
  assert.equal(normalizeMoney('1 234,50 ₸'), 1234.5);
  assert.equal(normalizeDate('22.11.2026'), '2026-11-22');
});

test('reads a synthetic semicolon statement without assuming a bank format', () => {
  const rows = parseGenericCsv('Дата;Списание;Зачисление;Описание\n22.11.2026;1 250,00;;MAGNUM\n23.11.2026;;50 000,00;Зарплата');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(({ type, amount, description }) => ({ type, amount, description })), [
    { type: 'expense', amount: 1250, description: 'MAGNUM' },
    { type: 'income', amount: 50000, description: 'Зарплата' }
  ]);
});

test('detects repeated import rows by stable operation fingerprint', () => {
  const operation = { date: '2026-11-22', time: '10:30', amount: 1250, currency: 'KZT', description: 'MAGNUM' };
  const first = findDuplicates([operation], [], 'acc_1')[0];
  const repeated = findDuplicates([operation], [{ importFingerprint: first.fingerprint }], 'acc_1')[0];
  assert.equal(first.duplicate, false);
  assert.equal(repeated.duplicate, true);
});

test('CSV parser respects quoted delimiters', () => {
  const { rows } = parseDelimited('Дата;Сумма;Описание\n22.11.2026;"1 000,00";"Магазин; отдел"');
  assert.equal(rows[1][2], 'Магазин; отдел');
});
