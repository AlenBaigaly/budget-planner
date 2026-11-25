/**
 * AQSHA Budget Planner - Production Ready Core Application Logic
 * 100% Opaque Solid 3D Cards, Dynamic Card Management, BCC Deposits, Goals, Limits, PWA & CSV
 */

import {
  BCC_DEPOSIT_TYPES,
  calculateMaturityDate,
  getDaysRemaining,
  calculateDepositForecast,
  calculateMonthlyInterestAccrual,
  validateDepositWithdrawal
} from './bcc-deposits.js';

import {
  drawPixelPieChart,
  calculateMonthComparison,
  MODERN_PALETTE
} from './analytics.js';

import {
  initFirebase,
  loginWithGoogle,
  logoutUser,
  onAuthChanged,
  onCloudDataChanged,
  onSyncStatusChanged,
  syncStateToCloud
} from './firebase-config.js?v=aqsha_sync_v4';

import Tesseract from '../vendor/tesseract.esm.min.js';

import {
  initializeStateStorage,
  saveStateToIndexedDB
} from './storage.js?v=aqsha_sync_v4';

import {
  ensureSyncSchema,
  mergeStates,
  prepareLocalStateForSave
} from './state-sync.js?v=aqsha_sync_v5';

import { bankAdapters, unsupportedFileMessage } from './imports/adapters.js';
import { chooseAdapter, findDuplicates, markOwnTransfers } from './imports/core.js';

// Keep the established key so the existing planner data is available right
// away after the redesign. The AQSHA key is only a fallback for local drafts.
const STORAGE_KEY = 'budget_planner_state_v1';
const AQSHA_STORAGE_KEY = 'aqsha_budget_state_v2';
let applyingRemoteState = false;
let storageReady = false;
let lastPersistedState = null;

// Bank-card themes inspired by the visual language of the real products.
// They are illustrations only: no real card details or numbers are displayed.
const CARD_THEMES = {
  avtobys: {
    kind: 'transport',
    bgStyle: 'background: radial-gradient(circle at 92% 14%, rgba(75,184,224,.34) 0 3px, transparent 4px) 0 0/36px 36px, linear-gradient(122deg, #123D8B 0%, #0A2B69 55%, #061A48 100%) !important; background-color: #0A2B69 !important; color: #FFFFFF !important; border: 1px solid #2A77C8 !important;',
    bankName: '<div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-[#F6921E]"></span><span class="font-black text-sm tracking-tight text-white lowercase">avtobys</span></div>',
    sub: '<span class="text-[9px] font-black tracking-[.14em] text-[#A8E5FF]">TRANSPORT</span>',
    text: '#FFFFFF',
    muted: 'rgba(218,242,255,.78)',
    decor: '<div style="position:absolute;right:-28px;bottom:-72px;width:250px;height:160px;border-radius:50%;border:15px solid rgba(246,146,30,.85);transform:rotate(-21deg)"></div><div style="position:absolute;right:-45px;bottom:-84px;width:264px;height:174px;border-radius:50%;border:5px solid rgba(105,205,239,.9);transform:rotate(-21deg)"></div>'
  },
  kaspi: {
    bgStyle: 'background: radial-gradient(circle at 88% 8%, rgba(255,255,255,.58), transparent 26%), linear-gradient(118deg, #F7E5A6 0%, #D9AD45 38%, #AA7418 69%, #6E4710 100%) !important; background-color: #D9AD45 !important; color: #30220E !important; border: 1px solid #C18D29 !important;',
    bankName: '<div class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 rounded-full bg-[#3B290F] flex items-center justify-center"><div class="w-1.5 h-1.5 rounded-full bg-[#ECCA71]"></div></div><span class="font-extrabold text-sm tracking-tight text-[#30220E]">kaspi.kz</span></div>',
    sub: '<span class="text-xs font-black italic tracking-wider text-[#30220E]">VISA</span>',
    text: '#30220E',
    muted: 'rgba(48,34,14,.70)',
    decor: '<div style="position:absolute;right:-48px;bottom:-92px;width:230px;height:230px;border-radius:50%;border:30px solid rgba(77,46,5,.13)"></div>'
  },
  bcc_iron: {
    bgStyle: 'background: repeating-linear-gradient(0deg, rgba(255,255,255,.09) 0 1px, rgba(0,0,0,.08) 1px 3px), linear-gradient(122deg, #E3E7E5 0%, #9BA09F 24%, #464B4B 54%, #111415 78%, #5E6463 100%) !important; background-color: #575D5C !important; color: #FFFFFF !important; border: 1px solid #C3C8C5 !important;',
    bankName: '<span class="font-black text-sm text-white tracking-tight">BCC</span> <span class="text-white/70 font-medium text-[10px]">Банк ЦентрКредит</span>',
    sub: '<span class="text-xs font-black italic tracking-widest text-white">VISA</span><div class="text-[8px] uppercase tracking-widest text-white/65 font-semibold -mt-1">Infinite</div>',
    text: '#FFFFFF',
    muted: 'rgba(255,255,255,.72)',
    decor: '<div style="position:absolute;left:-46px;top:32px;width:160px;height:160px;transform:rotate(45deg);border:28px solid rgba(255,255,255,.12);border-radius:25px"></div>'
  },
  bcc_karta: {
    bgStyle: 'background: radial-gradient(circle at 18% 20%, rgba(187,223,187,.25) 0 3px, transparent 4px) 0 0/24px 24px, linear-gradient(135deg, #1B634B 0%, #0E4937 46%, #062E23 100%) !important; background-color: #0E4937 !important; color: #FFFFFF !important; border: 1px solid #4D8C6E !important;',
    bankName: '<span class="font-black text-sm text-white">BCC</span> <span class="text-[11px] text-emerald-100 font-medium">#картакарта</span>',
    sub: '<div class="flex -space-x-2"><div class="w-4 h-4 rounded-full bg-red-500 opacity-90"></div><div class="w-4 h-4 rounded-full bg-amber-400 opacity-90"></div></div>',
    text: '#FFFFFF',
    muted: 'rgba(255,255,255,.74)',
    decor: '<div style="position:absolute;right:-38px;top:12px;width:186px;height:186px;opacity:.23;background:repeating-conic-gradient(from 45deg, #D7E9B8 0 7deg, transparent 7deg 14deg);border-radius:50%"></div>'
  },
  halyk: {
    bgStyle: 'background: linear-gradient(135deg, #00664F 0%, #004D3C 50%, #003328 100%) !important; background-color: #004D3C !important; color: #FFFFFF !important; border: 1px solid #008265 !important;',
    bankName: '<span class="font-extrabold text-sm tracking-tight text-emerald-200">HALYK BANK</span>',
    sub: '<span class="text-xs font-bold text-emerald-100">VISA</span>'
  },
  forte: {
    bgStyle: 'background: linear-gradient(135deg, #5A1236 0%, #3E0C25 50%, #250616 100%) !important; background-color: #3E0C25 !important; color: #FFFFFF !important; border: 1px solid #7A1A4A !important;',
    bankName: '<span class="font-extrabold text-sm tracking-tight text-pink-200">ForteBank</span>',
    sub: '<span class="text-xs font-bold text-pink-100">VISA</span>'
  },
  jusan: {
    bgStyle: 'background: linear-gradient(135deg, #2B2D33 0%, #1F2024 50%, #121315 100%) !important; background-color: #1F2024 !important; color: #FFFFFF !important; border: 1px solid #E05A2B !important;',
    bankName: '<span class="font-extrabold text-sm tracking-tight text-amber-200">Jusan Bank</span>',
    sub: '<span class="text-xs font-bold text-amber-100">Mastercard</span>'
  },
  custom_ocean: {
    bgStyle: 'background: linear-gradient(135deg, #1E3A8A 0%, #172554 100%) !important; background-color: #172554 !important; color: #FFFFFF !important; border: 1px solid #2563EB !important;',
    bankName: '<span class="font-bold text-sm text-white">Bank Card</span>',
    sub: '<span class="text-xs font-bold text-white">VISA</span>'
  },
  custom_gold: {
    bgStyle: 'background: linear-gradient(135deg, #854D0E 0%, #422006 100%) !important; background-color: #422006 !important; color: #FFFFFF !important; border: 1px solid #CA8A04 !important;',
    bankName: '<span class="font-bold text-sm text-amber-200">Platinum Card</span>',
    sub: '<span class="text-xs font-bold text-amber-100">VISA</span>'
  }
};

function getCardTheme(account) {
  if (account?.preset === 'avtobys' || /\bavtobys\b/i.test(account?.name || '')) return CARD_THEMES.avtobys;
  return CARD_THEMES[account?.preset] || CARD_THEMES.kaspi;
}

// Initial state for Kazakhstan
const INITIAL_STATE = {
  accounts: [
    {
      id: 'acc_card_iron',
      name: 'BCC #IronCard',
      preset: 'bcc_iron',
      type: 'card',
      currency: '₸',
      maskedNumber: '•••• 7183',
      holderName: 'ALEN S.',
      paymentSystem: 'VISA',
      initialBalance: 385200,
      icon: '💳'
    },
    {
      id: 'acc_card_kartakarta',
      name: 'BCC #картакарта',
      preset: 'bcc_karta',
      type: 'card',
      currency: '₸',
      maskedNumber: '•••• 3391',
      holderName: 'BCC.KZ',
      paymentSystem: 'Mastercard',
      initialBalance: 500000,
      isCreditLimit: true,
      icon: '💳'
    },
    {
      id: 'acc_card_kaspi',
      name: 'Kaspi Gold',
      preset: 'kaspi',
      type: 'card',
      currency: '₸',
      maskedNumber: '•••• 4920',
      holderName: 'ALEN S.',
      paymentSystem: 'VISA',
      initialBalance: 185000,
      icon: '💳'
    },
    {
      id: 'acc_cash',
      name: 'Наличные',
      type: 'cash',
      currency: '₸',
      initialBalance: 45000,
      icon: '💵'
    },
    {
      id: 'acc_bcc_goal',
      name: 'BCC «Моя цель»',
      type: 'deposit',
      subType: 'my_goal',
      currency: '₸',
      initialBalance: 300000,
      effectiveRate: 18.06,
      nominalRate: 16.7,
      termMonths: 3,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      icon: '🏦'
    },
    {
      id: 'acc_bcc_champ',
      name: 'BCC «Чемпион»',
      type: 'deposit',
      subType: 'champion',
      currency: '₸',
      initialBalance: 500000,
      effectiveRate: 15.17,
      nominalRate: 14.2,
      termMonths: 6,
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      icon: '🏆'
    }
  ],
  categories: [
    { id: 'cat_food', name: 'Продукты (Magnum, Galmart)', icon: '🛒', color: '#465948', type: 'expense' },
    { id: 'cat_dining', name: 'Кафе, рестораны & Wolt', icon: '☕', color: '#B87A4A', type: 'expense' },
    { id: 'cat_transport', name: 'Такси & АЗС (inDrive, Compass)', icon: '🚕', color: '#8E6D55', type: 'expense' },
    { id: 'cat_home', name: 'Аренда & ЖКХ (Алсеко)', icon: '🏠', color: '#5A5C61', type: 'expense' },
    { id: 'cat_shopping', name: 'Покупки & Одежда', icon: '🛍️', color: '#7E151E', type: 'expense' },
    { id: 'cat_health', name: 'Аптека & Здоровье', icon: '💊', color: '#9E9B93', type: 'expense' },
    { id: 'cat_leisure', name: 'Подписки & Отдых (Яндекс, Spotify)', icon: '🎬', color: '#3E4F41', type: 'expense' },
    { id: 'cat_salary', name: 'Зарплата', icon: '💼', color: '#10B981', type: 'income' },
    { id: 'cat_invest', name: 'Вознаграждение по депозитам', icon: '📈', color: '#194C38', type: 'income' },
    { id: 'cat_other', name: 'Прочее', icon: '📦', color: '#6B7280', type: 'expense' }
  ],
  limits: {
    monthlyTotalLimit: 250000,
    categoryLimits: {
      cat_food: 70000,
      cat_dining: 40000,
      cat_transport: 35000,
      cat_home: 50000,
      cat_shopping: 30000,
      cat_leisure: 15000
    }
  },
  goals: [
    {
      id: 'goal_laptop',
      title: 'Ноутбук для работы',
      targetAmount: 500000,
      linkedAccounts: ['acc_bcc_goal'],
      icon: '💻'
    },
    {
      id: 'goal_cushion',
      title: 'Подушка безопасности',
      targetAmount: 2000000,
      linkedAccounts: ['acc_bcc_champ', 'acc_card_iron'],
      icon: '🛡️'
    },
    {
      id: 'goal_vacation',
      title: 'Отпуск в Грузии',
      targetAmount: 450000,
      linkedAccounts: ['acc_card_kaspi', 'acc_cash'],
      icon: '✈️'
    }
  ],
  recurring: [
    {
      id: 'rec_salary',
      name: 'Основная зарплата (ТОО TechKZ)',
      amount: 450000,
      type: 'income',
      accountId: 'acc_card_iron',
      categoryId: 'cat_salary',
      dayOfMonth: 10,
      icon: '💼'
    },
    {
      id: 'rec_rent',
      name: 'Аренда жилья',
      amount: 150000,
      type: 'expense',
      accountId: 'acc_card_iron',
      categoryId: 'cat_home',
      dayOfMonth: 5,
      icon: '🏠'
    },
    {
      id: 'rec_yandex',
      name: 'Подписка Яндекс Плюс',
      amount: 1499,
      type: 'expense',
      accountId: 'acc_card_kaspi',
      categoryId: 'cat_leisure',
      dayOfMonth: 18,
      icon: '🎵'
    },
    {
      id: 'rec_telecom',
      name: 'Мобильная связь Kcell/Activ',
      amount: 4990,
      type: 'expense',
      accountId: 'acc_card_kaspi',
      categoryId: 'cat_leisure',
      dayOfMonth: 25,
      icon: '📱'
    }
  ],
  transactions: [
    {
      id: 'tx_1',
      type: 'expense',
      amount: 1850,
      date: new Date().toISOString().split('T')[0],
      time: '11:24',
      accountId: 'acc_card_kaspi',
      categoryId: 'cat_dining',
      note: 'Coffee Boom Almaty'
    },
    {
      id: 'tx_2',
      type: 'expense',
      amount: 2800,
      date: new Date().toISOString().split('T')[0],
      time: '09:10',
      accountId: 'acc_card_kaspi',
      categoryId: 'cat_transport',
      note: 'inDrive (ул. Достык → Абая)'
    },
    {
      id: 'tx_3',
      type: 'expense',
      amount: 18490,
      date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '19:45',
      accountId: 'acc_card_iron',
      categoryId: 'cat_food',
      note: 'Magnum Supermarket (кэшбэк ₸370)'
    },
    {
      id: 'tx_4',
      type: 'expense',
      amount: 6400,
      date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '13:20',
      accountId: 'acc_card_kaspi',
      categoryId: 'cat_dining',
      note: 'Wolt Delivery'
    },
    {
      id: 'tx_5',
      type: 'income',
      amount: 450000,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '10:00',
      accountId: 'acc_card_iron',
      categoryId: 'cat_salary',
      note: 'Зарплата (ТОО TechKZ)'
    },
    {
      id: 'tx_6',
      type: 'transfer',
      amount: 50000,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '21:05',
      accountId: 'acc_card_iron',
      toAccountId: 'acc_bcc_goal',
      categoryId: '',
      note: 'Пополнение депозита «Моя цель»'
    },
    {
      id: 'tx_7',
      type: 'expense',
      amount: 14500,
      date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '17:15',
      accountId: 'acc_card_kaspi',
      categoryId: 'cat_transport',
      note: 'АЗС Compass (АИ-95)'
    }
  ],
  debts: []
};

let state = loadState();

function normalizeState(rawState) {
  const raw = rawState && typeof rawState === 'object' ? rawState : {};
  const normalized = Object.assign({}, JSON.parse(JSON.stringify(INITIAL_STATE)), raw);

  normalized.accounts = Array.isArray(raw.accounts) ? raw.accounts : normalized.accounts;
  normalized.categories = Array.isArray(raw.categories) ? raw.categories : normalized.categories;
  normalized.transactions = Array.isArray(raw.transactions) ? raw.transactions : normalized.transactions;
  normalized.recurring = Array.isArray(raw.recurring) ? raw.recurring : normalized.recurring;
  normalized.goals = Array.isArray(raw.goals) ? raw.goals : normalized.goals;
  normalized.debts = Array.isArray(raw.debts) ? raw.debts : [];
  normalized.limits = raw.limits || normalized.limits;
  normalized.closedDeposits = Array.isArray(raw.closedDeposits) ? raw.closedDeposits : [];

  // All supported BCC deposits in AQSHA are replenishable. Older records were
  // created before product rules existed, so explicitly restore this rule.
  // The only difference here is partial withdrawal: it is unavailable for
  // «Моя цель» and available for «Чемпион».
  normalized.accounts = normalized.accounts.map((account) => {
    if (account.type !== 'deposit' || !(account.isBCC || account.bank === 'bcc' || ['my_goal', 'champion'].includes(account.subType))) return account;
    const preset = account.subType === 'champion' ? BCC_DEPOSIT_TYPES.CHAMPION : BCC_DEPOSIT_TYPES.MY_GOAL;
    return {
      ...account,
      allowsWithdrawal: typeof account.allowsWithdrawal === 'boolean' ? account.allowsWithdrawal : preset.allowsWithdrawal,
      allowsReplenishment: true,
      minBalance: Number.isFinite(Number(account.minBalance)) ? Number(account.minBalance) : preset.minBalance
    };
  });

  normalized.goals = normalized.goals.map((goal) => ({
    ...goal,
    linkedAccounts: goal.linkedAccounts || goal.linkedAccountIds || []
  }));
  normalized.transactions = normalized.transactions.map((transaction) => ({
    ...transaction,
    time: transaction.time || (transaction.createdAt
      ? new Date(transaction.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      : '')
  }));

  return ensureSyncSchema(normalized, raw.lastUpdated || new Date().toISOString());
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(AQSHA_STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(INITIAL_STATE));
    const parsed = normalizeState(JSON.parse(raw));

    // Ensure accounts have solid preset mapping
    if (parsed.accounts) {
      parsed.accounts.forEach(acc => {
        if (acc.type === 'card' && !CARD_THEMES[acc.preset]) {
          if ((acc.name || '').toLowerCase().includes('kaspi')) acc.preset = 'kaspi';
          else if ((acc.name || '').toLowerCase().includes('iron')) acc.preset = 'bcc_iron';
          else if ((acc.name || '').toLowerCase().includes('карта')) acc.preset = 'bcc_karta';
          else if ((acc.name || '').toLowerCase().includes('halyk')) acc.preset = 'halyk';
          else acc.preset = 'kaspi';
        }
      });
    }

    return parsed;
  } catch (err) {
    console.warn('Error loading state from localStorage:', err);
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }
}

function saveState() {
  try {
    state = prepareLocalStateForSave(state, lastPersistedState);
    lastPersistedState = JSON.parse(JSON.stringify(state));
    saveStateToIndexedDB(state).catch((err) => {
      console.warn('Ошибка сохранения в IndexedDB:', err);
      window.showToast?.('Не удалось сохранить данные на устройстве. Освободи место в браузере.', '⚠️');
    });
    if (storageReady && !applyingRemoteState) syncStateToCloud(state);
  } catch (err) {
    console.warn('Error scheduling state save:', err);
  }
}

function getAccountBalances() {
  const balances = {};
  state.accounts.forEach(acc => {
    balances[acc.id] = acc.initialBalance || 0;
  });

  state.transactions.forEach(tx => {
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      if (balances[tx.accountId] !== undefined) {
        balances[tx.accountId] += amount;
      }
    } else if (tx.type === 'expense') {
      if (balances[tx.accountId] !== undefined) {
        balances[tx.accountId] -= amount;
      }
    } else if (tx.type === 'transfer') {
      if (balances[tx.accountId] !== undefined) {
        balances[tx.accountId] -= amount;
      }
      if (tx.toAccountId && balances[tx.toAccountId] !== undefined) {
        balances[tx.toAccountId] += amount;
      }
    }
  });

  return balances;
}

function formatMoney(amount) {
  const parsed = Number(amount);
  const num = Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
  return num.toLocaleString('ru-RU', {
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function parseKazakhstanAmount(value) {
  const raw = String(value ?? '').trim().replace(/[\s\u00A0]/g, '').replace(/[^\d,.-]/g, '');
  if (!raw) return NaN;
  const commaIndex = raw.lastIndexOf(',');
  const dotIndex = raw.lastIndexOf('.');
  const decimalIndex = Math.max(commaIndex, dotIndex);
  const integerPart = (decimalIndex === -1 ? raw : raw.slice(0, decimalIndex)).replace(/[,.]/g, '');
  const fractionPart = decimalIndex === -1 ? '' : raw.slice(decimalIndex + 1).replace(/[,.]/g, '');
  const normalized = `${integerPart || '0'}${fractionPart ? `.${fractionPart}` : ''}`;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : NaN;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

// -------------------------------------------------------------
// TOAST NOTIFICATIONS
// -------------------------------------------------------------
window.showToast = function(msg, icon = '✓') {
  const toastBox = document.getElementById('toast-box');
  const toastMsg = document.getElementById('toast-msg');
  const toastIcon = document.getElementById('toast-icon');

  if (!toastBox || !toastMsg) return;

  toastMsg.innerText = msg;
  if (toastIcon) toastIcon.innerText = icon;

  toastBox.classList.remove('opacity-0', 'translate-y-3', 'pointer-events-none');
  toastBox.classList.add('opacity-100', 'translate-y-0');

  setTimeout(() => {
    toastBox.classList.add('opacity-0', 'translate-y-3', 'pointer-events-none');
    toastBox.classList.remove('opacity-100', 'translate-y-0');
  }, 2800);
};

// -------------------------------------------------------------
// DYNAMIC 3D BANK CARDS STACK LOGIC (100% OPAQUE & GLITCH-FREE)
// -------------------------------------------------------------
let activeBankCardIdx = 0;

function renderCardsDeck() {
  const container = document.getElementById('deck-wrapper');
  if (!container) return;

  const cardAccounts = state.accounts.filter(a => a.type === 'card');
  const balances = getAccountBalances();

  if (cardAccounts.length === 0) {
    container.innerHTML = `
      <div class="h-[220px] w-full flex flex-col items-center justify-center border-2 border-dashed border-[#DFDAD0] rounded-3xl p-6 text-center text-xs text-[#7E7B73] bg-[#FAF9F5]">
        <span class="text-3xl mb-2">💳</span>
        <div class="font-bold text-[#171717]">Нет добавленных карт</div>
        <p class="text-[11px] mt-1 mb-3">Добавьте Kaspi, BCC, Halyk или другую карту</p>
        <button onclick="openAddCardModal()" class="px-4 py-2 bg-[#171717] hover:bg-black text-white font-semibold rounded-full shadow-xs transition">
          + Добавить карту
        </button>
      </div>
    `;
    const label = document.getElementById('active-card-name');
    if (label) label.innerText = 'Нет карт';
    const dots = document.getElementById('deck-dots');
    if (dots) dots.innerHTML = '';
    return;
  }

  if (activeBankCardIdx >= cardAccounts.length) {
    activeBankCardIdx = 0;
  }

  const html = cardAccounts.map((acc, index) => {
    const relPos = (index - activeBankCardIdx + cardAccounts.length) % cardAccounts.length;
    let posClass = 'card-pos-hidden';
    if (relPos === 0) posClass = 'card-pos-0';
    else if (relPos === 1) posClass = 'card-pos-1';
    else if (relPos === 2) posClass = 'card-pos-2';

    const presetTheme = getCardTheme(acc);
    const cardBal = balances[acc.id] || 0;
    const isTransportCard = presetTheme.kind === 'transport';

    return `
      <div id="card-elem-${index}" onclick="selectCard(${index})"
           class="bank-card ${posClass}${relPos === 0 ? ' card-enter' : ''}"
           style="${presetTheme.bgStyle}">
        ${presetTheme.decor || ''}

        <div class="relative z-10 flex justify-between items-start">
          <div class="flex items-center gap-1.5">${presetTheme.bankName}</div>
          <div>${presetTheme.sub}</div>
        </div>

        <div class="relative z-10 flex justify-between items-center my-3.5">
          ${isTransportCard ? '<div class="text-[10px] font-black uppercase tracking-[.12em] text-white/90">Транспортная карта</div>' : `<div class="flex items-center gap-3"><div class="emv-chip"></div><svg class="w-5 h-5 opacity-80" style="color:${presetTheme.text || '#FFFFFF'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 16.5a5 5 0 0 1 0-9"></path><path d="M12 19a8.5 8.5 0 0 0 0-14"></path></svg></div>`}
          <div class="text-base font-bold tracking-tight ${isTransportCard ? '' : 'font-mono-card'}" style="color:${presetTheme.text || '#FFFFFF'}">${isTransportCard ? 'Стандартная' : acc.name}</div>
        </div>

        <div class="relative z-10 mt-2">
          <div class="text-[10px] font-medium uppercase tracking-wider" style="color:${presetTheme.muted || 'rgba(255,255,255,.70)'}">
            ${isTransportCard ? 'Баланс поездок' : (acc.isCreditLimit ? 'Кредитный лимит' : 'Баланс карты')}
          </div>
          <div class="text-2xl font-black tracking-tight" style="color:${presetTheme.text || '#FFFFFF'}">₸${formatMoney(cardBal)}</div>
          <div class="flex justify-between items-end mt-1 text-[11px] font-mono-card" style="color:${presetTheme.muted || 'rgba(255,255,255,.80)'}">
            <span>${isTransportCard ? 'Бесконтактная оплата' : '•••• ••••'}</span>
            <span class="text-[9px] uppercase tracking-widest">${isTransportCard ? escapeHtml(acc.name) : (acc.holderName || 'CARDHOLDER')}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  // Update dots & active name
  const cur = cardAccounts[activeBankCardIdx];
  const nameLabel = document.getElementById('active-card-name');
  if (nameLabel && cur) nameLabel.innerText = cur.name;

  const dotsContainer = document.getElementById('deck-dots');
  if (dotsContainer) {
    dotsContainer.innerHTML = cardAccounts.map((_, i) => {
      const isActive = i === activeBankCardIdx;
      return `<span class="${isActive ? 'w-3 h-2.5 bg-[#171717]' : 'w-2 h-2 bg-[#D4CEBF]'} rounded-full transition-all cursor-pointer" onclick="selectCard(${i})"></span>`;
    }).join('');
  }
}

window.selectCard = function(idx) {
  const cardAccounts = state.accounts.filter(a => a.type === 'card');
  if (activeBankCardIdx === idx) {
    window.cycleCardNext();
  } else {
    activeBankCardIdx = idx;
    renderCardsDeck();
  }
};

window.cycleCardNext = function() {
  const cardAccounts = state.accounts.filter(a => a.type === 'card');
  if (cardAccounts.length === 0) return;
  activeBankCardIdx = (activeBankCardIdx + 1) % cardAccounts.length;
  renderCardsDeck();
};

window.cycleCardPrev = function() {
  const cardAccounts = state.accounts.filter(a => a.type === 'card');
  if (cardAccounts.length === 0) return;
  activeBankCardIdx = (activeBankCardIdx - 1 + cardAccounts.length) % cardAccounts.length;
  renderCardsDeck();
};

// -------------------------------------------------------------
// ADD NEW CARD MODAL & LIVE PREVIEW
// -------------------------------------------------------------
window.openAddCardModal = function() {
  document.getElementById('modal-add-card').classList.remove('hidden');
  window.updateCardModalPreview();
};

window.updateCardModalPreview = function() {
  const preset = document.getElementById('card-preset').value;
  const name = document.getElementById('card-name').value || 'Моя Карта';
  const number = document.getElementById('card-number').value || '8824';
  const holder = document.getElementById('card-holder').value || 'ALEN S.';
  const balance = Number(document.getElementById('card-balance').value) || 0;

  const previewCard = document.getElementById('preview-card');
  if (!previewCard) return;

  const presetTheme = CARD_THEMES[preset] || CARD_THEMES.kaspi;
  const isTransportCard = presetTheme.kind === 'transport';
  previewCard.style = presetTheme.bgStyle;

  document.getElementById('preview-bank-logo').innerHTML = presetTheme.bankName;
  document.getElementById('preview-ps-logo').innerHTML = presetTheme.sub;
  document.getElementById('preview-card-title').innerText = isTransportCard ? 'Стандартная' : name;
  document.getElementById('preview-balance').innerText = `₸${formatMoney(balance)}`;
  document.getElementById('preview-number').innerText = isTransportCard ? 'Бесконтактная оплата' : `•••• ${number.slice(-4)}`;
  document.getElementById('preview-holder').innerText = isTransportCard ? name : holder.toUpperCase();
  document.getElementById('preview-card-middle').innerHTML = isTransportCard
    ? '<div class="text-[10px] font-black uppercase tracking-[.12em] text-white/90">Транспортная карта</div>'
    : '<div class="flex items-center gap-3"><div class="emv-chip"></div><svg class="w-5 h-5 text-white/80 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 16.5a5 5 0 0 1 0-9"></path><path d="M12 19a8.5 8.5 0 0 0 0-14"></path></svg></div>';
};

window.handleFormAddCard = function(e) {
  e.preventDefault();
  const preset = document.getElementById('card-preset').value;
  const name = document.getElementById('card-name').value.trim();
  const number = document.getElementById('card-number').value.trim();
  const holder = document.getElementById('card-holder').value.trim() || 'ALEN S.';
  const ps = document.getElementById('card-ps').value;
  const balance = Number(document.getElementById('card-balance').value) || 0;

  if (!name || !number) {
    alert('Пожалуйста, заполните название и номер карты');
    return;
  }

  const newCard = {
    id: 'acc_card_' + Date.now(),
    name: name,
    preset: preset,
    type: 'card',
    currency: '₸',
    maskedNumber: '•••• ' + number.slice(-4),
    holderName: holder.toUpperCase(),
    paymentSystem: ps,
    initialBalance: balance,
    icon: '💳'
  };

  state.accounts.push(newCard);
  saveState();

  const cardAccounts = state.accounts.filter(a => a.type === 'card');
  activeBankCardIdx = cardAccounts.length - 1;

  e.target.reset();
  window.closeModal('modal-add-card');
  renderAll();
  window.showToast(`Карта «${name}» добавлена в стек!`, '💳');
};

window.deleteActiveCard = function() {
  const cardAccounts = state.accounts.filter(a => a.type === 'card');
  if (cardAccounts.length === 0) return;

  const target = cardAccounts[activeBankCardIdx];
  if (!confirm(`Удалить карту «${target.name}»?\n\nОперации по ней останутся в журнале, но карта перестанет участвовать в общем балансе.`)) {
    return;
  }

  state.accounts = state.accounts.filter(a => a.id !== target.id);
  activeBankCardIdx = 0;
  saveState();
  renderAll();
  window.showToast(`Карта «${target.name}» удалена`, '🗑️');
};

function getAccountTransactionDelta(accountId) {
  return state.transactions.reduce((delta, transaction) => {
    const amount = Number(transaction.amount) || 0;
    if (transaction.type === 'income' && transaction.accountId === accountId) return delta + amount;
    if (transaction.type === 'expense' && transaction.accountId === accountId) return delta - amount;
    if (transaction.type === 'transfer') {
      if (transaction.accountId === accountId) delta -= amount;
      if (transaction.toAccountId === accountId) delta += amount;
    }
    return delta;
  }, 0);
}

window.openEditActiveCardModal = function() {
  const cardAccounts = state.accounts.filter((account) => account.type === 'card');
  const card = cardAccounts[activeBankCardIdx];
  if (!card) {
    window.showToast('Сначала добавь карту', '💳');
    return;
  }

  document.getElementById('edit-card-id').value = card.id;
  document.getElementById('edit-card-preset').value = getCardTheme(card) === CARD_THEMES.avtobys ? 'avtobys' : (CARD_THEMES[card.preset] ? card.preset : 'kaspi');
  document.getElementById('edit-card-name').value = card.name || '';
  document.getElementById('edit-card-balance').value = getAccountBalances()[card.id] ?? 0;
  document.getElementById('modal-edit-card').classList.remove('hidden');
};

window.handleFormEditCard = function(event) {
  event.preventDefault();
  const cardId = document.getElementById('edit-card-id').value;
  const card = state.accounts.find((account) => account.id === cardId && account.type === 'card');
  const name = document.getElementById('edit-card-name').value.trim();
  const targetBalance = Number(document.getElementById('edit-card-balance').value);

  if (!card || !name || !Number.isFinite(targetBalance)) {
    window.showToast('Заполни название и текущий баланс карты', '⚠️');
    return;
  }

  card.preset = document.getElementById('edit-card-preset').value;
  card.name = name;
  // The shown amount is initial balance plus all saved movements. This keeps
  // the operation history while allowing the user to reconcile real balance.
  card.initialBalance = targetBalance - getAccountTransactionDelta(card.id);
  card.updatedAt = new Date().toISOString();

  saveState();
  window.closeModal('modal-edit-card');
  renderAll();
  window.showToast(`Карта «${name}» обновлена`, '✓');
};

// -------------------------------------------------------------
// BCC DEPOSITS
// -------------------------------------------------------------
function depositPreset(key) {
  return key === 'bcc_champ' ? BCC_DEPOSIT_TYPES.CHAMPION : BCC_DEPOSIT_TYPES.MY_GOAL;
}

function makeTimestamp() {
  const now = new Date();
  return { date: now.toISOString().split('T')[0], time: now.toTimeString().slice(0, 5), createdAt: now.toISOString() };
}

function normalizeOperationTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let match = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 3 || digits.length === 4) {
      match = [raw, digits.slice(0, -2), digits.slice(-2)];
    }
  }
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function depositAccounts() {
  return state.accounts.filter((account) => account.type === 'deposit');
}

function accountOptions(accounts) {
  return accounts.map((account) => `<option value="${account.id}">${account.icon || '💳'} ${account.name} — ₸${formatMoney(getAccountBalances()[account.id] || 0)}</option>`).join('');
}

function closeDeposit(deposit, balance, destinationAccountId = '') {
  const timestamp = makeTimestamp();
  if (balance > 0) {
    state.transactions.unshift({
      id: `tx_${Date.now()}`,
      type: 'transfer',
      amount: balance,
      accountId: deposit.id,
      toAccountId: destinationAccountId,
      categoryId: '',
      note: `Закрытие вклада «${deposit.name}»`,
      ...timestamp
    });
  }
  state.closedDeposits = [...(state.closedDeposits || []), { ...deposit, closedAt: timestamp.date, finalBalance: Math.max(0, balance) }];
  state.accounts = state.accounts.filter((account) => account.id !== deposit.id);
  saveState();
  renderAll();
  window.showToast(balance > 0 ? 'Вклад закрыт, деньги переведены' : 'Вклад с нулевым остатком закрыт', '✓');
}

window.applyDepositPreset = function() {
  const preset = depositPreset(document.getElementById('deposit-input-preset').value);
  document.getElementById('deposit-input-name').value = preset.name;
  document.getElementById('deposit-input-term').value = preset.termMonths;
  document.getElementById('deposit-input-rate').value = preset.nominalRate;
  document.getElementById('deposit-input-effective-rate').value = preset.effectiveRate;
};

window.openDepositModal = function(presetKey = 'bcc_goal') {
  const sourceAccounts = state.accounts.filter((account) => account.type !== 'deposit');
  if (!sourceAccounts.length) {
    window.showToast('Сначала добавь обычный счёт, с которого будут переведены деньги.', '⚠️');
    return;
  }
  const key = presetKey === 'bcc_champ' ? 'bcc_champ' : 'bcc_goal';
  document.getElementById('deposit-input-preset').value = key;
  document.getElementById('deposit-input-source').innerHTML = accountOptions(sourceAccounts);
  document.getElementById('deposit-input-amount').value = '';
  window.applyDepositPreset();
  document.getElementById('modal-deposit').classList.remove('hidden');
};

window.handleDepositForm = function(event) {
  event.preventDefault();
  const presetKey = document.getElementById('deposit-input-preset').value;
  const preset = depositPreset(presetKey);
  const amount = Number(document.getElementById('deposit-input-amount').value);
  const sourceId = document.getElementById('deposit-input-source').value;
  const source = state.accounts.find((account) => account.id === sourceId);
  const name = document.getElementById('deposit-input-name').value.trim();
  const termMonths = Number(document.getElementById('deposit-input-term').value);
  if (!source || !name || amount <= 0 || termMonths <= 0) return;
  if ((getAccountBalances()[sourceId] || 0) < amount && !confirm('На счёте сейчас меньше указанной суммы. Открыть вклад всё равно?')) return;
  const timestamp = makeTimestamp();
  const id = `acc_deposit_${Date.now()}`;
  const account = {
    id, name, type: 'deposit', isBCC: true, subType: presetKey === 'bcc_champ' ? 'champion' : 'my_goal', bank: 'bcc', currency: '₸', icon: preset.icon,
    initialBalance: 0, nominalRate: Number(document.getElementById('deposit-input-rate').value) || preset.nominalRate,
    effectiveRate: Number(document.getElementById('deposit-input-effective-rate').value) || preset.effectiveRate,
    termMonths, startDate: timestamp.date, endDate: calculateMaturityDate(timestamp.date, termMonths).toISOString().split('T')[0],
    allowsWithdrawal: preset.allowsWithdrawal, allowsReplenishment: preset.allowsReplenishment, minBalance: preset.minBalance || 0
  };
  state.accounts.push(account);
  state.transactions.unshift({ id: `tx_${Date.now()}`, type: 'transfer', amount, accountId: sourceId, toAccountId: id, categoryId: '', note: `Открытие вклада «${name}»`, ...timestamp });
  saveState(); renderAll(); window.closeModal('modal-deposit');
  window.showToast(`Вклад «${name}» открыт`, '🏦');
};

window.openDepositAction = function(depositId, kind) {
  const deposit = state.accounts.find((account) => account.id === depositId && account.type === 'deposit');
  if (!deposit) return;
  const balances = getAccountBalances();
  const candidates = state.accounts.filter((account) => account.type !== 'deposit');
  const balance = balances[depositId] || 0;
  // Zero-balance deposits need no destination and should not make the user
  // go through an empty transfer form.
  if (kind === 'close' && balance <= 0) {
    closeDeposit(deposit, balance);
    return;
  }
  if (!candidates.length) { window.showToast('Нужен обычный счёт для перевода денег.', '⚠️'); return; }
  if (kind === 'withdraw') {
    const check = validateDepositWithdrawal(deposit, 1, balances[depositId] || 0);
    if (!check.allowed) { window.showToast(check.reason, '⚠️'); return; }
  }
  const labels = { topup: ['Пополнить вклад', 'Счёт списания', 'Перевести на вклад'], withdraw: ['Снять с вклада', 'Счёт зачисления', 'Снять деньги'], close: ['Закрыть вклад', 'Счёт зачисления', 'Закрыть и перевести остаток'] };
  const [title, accountLabel, submit] = labels[kind];
  document.getElementById('deposit-action-kind').value = kind;
  document.getElementById('deposit-action-id').value = depositId;
  document.getElementById('deposit-action-title').innerText = title;
  document.getElementById('deposit-action-account-label').innerText = accountLabel;
  document.getElementById('deposit-action-submit').innerText = submit;
  document.getElementById('deposit-action-account').innerHTML = candidates.length ? accountOptions(candidates) : '<option value="">Счёт не нужен: остаток ₸0</option>';
  document.getElementById('deposit-action-info').innerText = `Вклад «${deposit.name}». Текущий остаток: ₸${formatMoney(balance)}.`;
  const amount = document.getElementById('deposit-action-amount');
  const amountRow = document.getElementById('deposit-action-amount-row');
  amountRow.classList.toggle('hidden', kind === 'close');
  amount.required = kind !== 'close';
  amount.value = kind === 'close' ? String(Math.max(0, balance)) : '';
  document.getElementById('modal-deposit-action').classList.remove('hidden');
};

window.handleDepositAction = function(event) {
  event.preventDefault();
  const kind = document.getElementById('deposit-action-kind').value;
  const depositId = document.getElementById('deposit-action-id').value;
  const otherAccountId = document.getElementById('deposit-action-account').value;
  const deposit = state.accounts.find((account) => account.id === depositId && account.type === 'deposit');
  const other = state.accounts.find((account) => account.id === otherAccountId);
  const balance = getAccountBalances()[depositId] || 0;
  const amount = kind === 'close' ? balance : parseKazakhstanAmount(document.getElementById('deposit-action-amount').value);
  if (!deposit) return;
  if (kind === 'close') {
    if (balance > 0 && !other) { window.showToast('Выбери счёт, на который перевести остаток.', '⚠️'); return; }
    closeDeposit(deposit, balance, otherAccountId);
    window.closeModal('modal-deposit-action');
    return;
  }
  if (!other || amount <= 0) return;
  if (kind === 'topup' && !deposit.allowsReplenishment) { window.showToast('Этот вклад нельзя пополнять по его условиям.', '⚠️'); return; }
  if (kind === 'withdraw') {
    const check = validateDepositWithdrawal(deposit, amount, balance);
    if (!check.allowed) { window.showToast(check.reason, '⚠️'); return; }
  }
  const timestamp = makeTimestamp();
  const fromId = kind === 'topup' ? otherAccountId : depositId;
  const toId = kind === 'topup' ? depositId : otherAccountId;
  const note = kind === 'topup' ? `Пополнение вклада «${deposit.name}»` : `Снятие с вклада «${deposit.name}»`;
  state.transactions.unshift({ id: `tx_${Date.now()}`, type: 'transfer', amount, accountId: fromId, toAccountId: toId, categoryId: '', note, ...timestamp });
  saveState(); renderAll(); window.closeModal('modal-deposit-action');
  window.showToast(kind === 'topup' ? 'Вклад пополнен' : 'Деньги переведены на счёт', '✓');
};

function renderDeposits() {
  const balances = getAccountBalances();
  const deposits = depositAccounts();
  const total = deposits.reduce((sum, item) => sum + Math.max(0, balances[item.id] || 0), 0);
  const monthly = deposits.reduce((sum, item) => sum + calculateMonthlyInterestAccrual(balances[item.id] || 0, item.nominalRate || 0), 0);
  const avgRate = total ? deposits.reduce((sum, item) => sum + (balances[item.id] || 0) * Number(item.effectiveRate || item.nominalRate || 0), 0) / total : 0;
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value; };
  setText('sidebar-deposit-count', String(deposits.length));
  setText('capital-deposits-summary-badge', `${deposits.length} активных`);
  setText('dep-stat-total', `₸${formatMoney(total)}`); setText('dep-stat-count', `${deposits.length} активных договоров`);
  setText('dep-stat-monthly', `+₸${formatMoney(monthly)}`); setText('dep-stat-avg-rate', `${avgRate.toFixed(2)}%`);
  const card = (deposit, compact = false) => {
    const balance = balances[deposit.id] || 0;
    const days = getDaysRemaining(deposit.endDate || calculateMaturityDate(deposit.startDate, deposit.termMonths).toISOString().split('T')[0]);
    const forecast = calculateDepositForecast({ principal: balance, nominalRate: deposit.nominalRate, termMonths: deposit.termMonths, startDate: deposit.startDate });
    return `<article class="bg-[#FAF9F5] border border-[#DFDAD0] rounded-3xl p-${compact ? '4' : '6'} shadow-xs"><div class="flex justify-between gap-3"><div><div class="text-[10px] font-bold text-[#465948] uppercase">BCC ${deposit.subType === 'champion' ? '«Чемпион»' : '«Моя цель»'}</div><h3 class="font-bold ${compact ? 'text-sm' : 'text-lg'} text-[#171717] mt-1">${deposit.icon || '🏦'} ${deposit.name}</h3></div><div class="text-right"><div class="text-[10px] text-[#7E7B73]">Остаток</div><div class="font-black ${compact ? 'text-lg' : 'text-2xl'}">₸${formatMoney(balance)}</div></div></div>${compact ? '' : `<div class="grid grid-cols-3 gap-2 mt-4 text-[11px]"><div class="bg-white border border-[#ECE7DC] rounded-xl p-2.5"><span class="text-[#7E7B73]">ГЭСВ</span><b class="block mt-1">${deposit.effectiveRate || deposit.nominalRate}%</b></div><div class="bg-white border border-[#ECE7DC] rounded-xl p-2.5"><span class="text-[#7E7B73]">Доход / мес.</span><b class="block mt-1 text-emerald-700">+₸${formatMoney(calculateMonthlyInterestAccrual(balance, deposit.nominalRate || 0))}</b></div><div class="bg-white border border-[#ECE7DC] rounded-xl p-2.5"><span class="text-[#7E7B73]">Осталось</span><b class="block mt-1">${days > 0 ? `${days} дн.` : 'Срок истёк'}</b></div></div><div class="text-[11px] text-[#7E7B73] mt-3">Прогноз к концу срока: <b class="text-[#171717]">₸${formatMoney(forecast.finalAmount)}</b></div>`}<div class="flex flex-wrap gap-2 mt-4"><button onclick="openDepositAction('${deposit.id}','topup')" class="px-3 py-1.5 bg-[#465948] text-white text-[11px] font-bold rounded-xl">+ Пополнить</button><button onclick="openDepositAction('${deposit.id}','withdraw')" class="px-3 py-1.5 bg-white border border-[#DFDAD0] text-[11px] font-bold rounded-xl">Снять</button><button onclick="triggerAccrueInterest('${deposit.id}')" class="px-3 py-1.5 bg-[#EAE6DC] text-[11px] font-bold rounded-xl">Начислить %</button><button onclick="openDepositAction('${deposit.id}','close')" class="px-3 py-1.5 text-red-700 bg-red-50 text-[11px] font-bold rounded-xl">Закрыть</button></div></article>`;
  };
  const full = document.getElementById('deposits-cards-grid'); if (full) full.innerHTML = deposits.length ? deposits.map((item) => card(item)).join('') : '<div class="lg:col-span-2 py-10 text-center text-xs text-[#7E7B73]">Нет активных вкладов. Нажми «Открыть вклад».</div>';
  const compact = document.getElementById('capital-deposits-container'); if (compact) compact.innerHTML = deposits.slice(0, 2).map((item) => card(item, true)).join('') || '<div class="text-xs text-[#7E7B73] py-4">Вкладов пока нет.</div>';
  const closed = state.closedDeposits || []; const closedSection = document.getElementById('deposits-closed-section');
  if (closedSection) { closedSection.classList.toggle('hidden', !closed.length); setText('dep-closed-count', `${closed.length} закрытых`); const closedList = document.getElementById('deposits-closed-list'); if (closedList) closedList.innerHTML = closed.map((item) => `<div class="bg-white border border-[#E8E4DA] rounded-xl px-4 py-3 text-xs flex justify-between"><span>${item.icon || '🏦'} ${item.name}</span><span class="text-[#7E7B73]">${item.closedAt} · ₸${formatMoney(item.finalBalance)}</span></div>`).join(''); }
}

function bindDepositCalculator() {
  ['calc-input-amount', 'calc-input-term', 'calc-input-rate', 'calc-input-topup'].forEach((id) => document.getElementById(id)?.addEventListener('input', renderDepositCalculator));
  renderDepositCalculator();
}
function renderDepositCalculator() {
  const value = (id) => Number(document.getElementById(id)?.value) || 0;
  const forecast = calculateDepositForecast({ principal: value('calc-input-amount'), termMonths: value('calc-input-term'), nominalRate: value('calc-input-rate'), monthlyTopUp: value('calc-input-topup') });
  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
  setText('calc-res-final', `₸${formatMoney(forecast.finalAmount)}`); setText('calc-res-profit', `+₸${formatMoney(forecast.totalReward)}`); setText('calc-res-monthly', `+₸${formatMoney(forecast.termMonths ? forecast.totalReward / forecast.termMonths : 0)} / мес`);
}
window.applyCalculatorToDepositModal = function() { window.openDepositModal(); document.getElementById('deposit-input-amount').value = document.getElementById('calc-input-amount').value; document.getElementById('deposit-input-term').value = document.getElementById('calc-input-term').value; document.getElementById('deposit-input-rate').value = document.getElementById('calc-input-rate').value; };

// -------------------------------------------------------------
// RENDERERS: CAPITAL WORKSPACE
// -------------------------------------------------------------
function renderCapitalWorkspace() {
  const balances = getAccountBalances();

  // Total available capital
  let totalAvailable = 0;
  state.accounts.forEach(acc => {
    if (!acc.isCreditLimit) {
      totalAvailable += (balances[acc.id] || 0);
    }
  });
  const elAvail = document.getElementById('hero-total-available');
  if (elAvail) elAvail.innerText = `₸${formatMoney(totalAvailable)}`;
  const elHeaderNet = document.getElementById('header-net-worth');
  if (elHeaderNet) elHeaderNet.innerText = `₸${formatMoney(totalAvailable)}`;

  // Cards Deck (Always fully opaque)
  renderCardsDeck();

  // Cash
  const elCash = document.getElementById('val-cash');
  if (elCash) elCash.innerText = `₸${formatMoney(balances['acc_cash'] || 0)}`;

  // BCC Deposits
  const elGoal = document.getElementById('deposit-val-goal');
  if (elGoal) elGoal.innerText = `₸${formatMoney(balances['acc_bcc_goal'] || 0)}`;

  const elChamp = document.getElementById('deposit-val-champ');
  if (elChamp) elChamp.innerText = `₸${formatMoney(balances['acc_bcc_champ'] || 0)}`;

  const goalAcc = state.accounts.find(a => a.id === 'acc_bcc_goal');
  if (goalAcc) {
    const est = calculateMonthlyInterestAccrual(balances['acc_bcc_goal'] || 0, goalAcc.nominalRate || 16.7);
    const elInterest = document.getElementById('deposit-interest-calc');
    if (elInterest) elInterest.innerText = `+ ₸${formatMoney(est)} / мес`;
  }

  // Monthly Spending
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthExpenses = state.transactions
    .filter(tx => tx.type === 'expense' && (tx.date || '').startsWith(currentMonthPrefix))
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const heroMonthSpent = document.getElementById('hero-month-spent');
  if (heroMonthSpent) heroMonthSpent.innerText = formatMoney(monthExpenses);

  // Remaining budget
  const limit = state.limits.monthlyTotalLimit || 250000;
  const remaining = Math.max(0, limit - monthExpenses);
  const spentPercent = Math.min(100, Math.round((monthExpenses / limit) * 100));

  const elRem = document.getElementById('hero-remaining-budget');
  if (elRem) elRem.innerText = formatMoney(remaining);

  const elBar = document.getElementById('hero-budget-bar');
  if (elBar) elBar.style.width = `${spentPercent}%`;

  const elPercent = document.getElementById('hero-budget-percent');
  if (elPercent) elPercent.innerText = `Потрачено ${spentPercent}%`;

  const elLimit = document.getElementById('hero-budget-limit');
  if (elLimit) elLimit.innerText = `Лимит: ₸${formatMoney(limit)}`;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate());
  const dailyAllowance = Math.round(remaining / daysLeft);

  const elDailyAllow = document.getElementById('hero-budget-daily-allowance');
  if (elDailyAllow) elDailyAllow.innerText = `Доступно: ~₸${formatMoney(dailyAllowance)} / день (${daysLeft} дн.)`;

  const dailyRate = Math.round(monthExpenses / Math.max(1, now.getDate()));
  const elDailyRate = document.getElementById('hero-daily-rate');
  if (elDailyRate) elDailyRate.innerText = `₸${formatMoney(dailyRate)} / день`;

  // Upcoming 7 days calendar
  renderUpcomingCalendar();
  renderRecentHomeTransactions();
}

function getNextRecurringDate(dayOfMonth, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const makeDate = (year, month) => new Date(year, month, Math.min(Math.max(1, Number(dayOfMonth) || 1), new Date(year, month + 1, 0).getDate()));
  let candidate = makeDate(today.getFullYear(), today.getMonth());
  if (candidate < today) candidate = makeDate(today.getFullYear(), today.getMonth() + 1);
  return candidate;
}

function getUpcomingRecurringPayments(days, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return (state.recurring || [])
    .map((recurring) => {
      const dueDate = getNextRecurringDate(recurring.dayOfMonth, today);
      const daysUntil = Math.round((dueDate - today) / 86400000);
      return { ...recurring, dueDate, daysUntil };
    })
    .filter((recurring) => recurring.daysUntil >= 0 && recurring.daysUntil <= days)
    .sort((a, b) => a.dueDate - b.dueDate);
}

function renderUpcomingCalendar() {
  const container = document.getElementById('upcoming-7d-list');
  if (!container) return;

  const now = new Date();
  const upcoming = getUpcomingRecurringPayments(7, now);
  const upcoming30Days = getUpcomingRecurringPayments(30, now);

  const sum7d = upcoming
    .filter(r => r.type === 'expense')
    .reduce((acc, r) => acc + Number(r.amount || 0), 0);

  const sum30d = upcoming30Days
    .filter(r => r.type === 'expense')
    .reduce((acc, r) => acc + Number(r.amount || 0), 0);

  const el7d = document.getElementById('upcoming-7d-sum');
  if (el7d) el7d.innerText = `₸${formatMoney(sum7d)}`;

  const el30d = document.getElementById('upcoming-30d-sum');
  if (el30d) el30d.innerText = `₸${formatMoney(sum30d)}`;

  if (upcoming.length === 0) {
    container.innerHTML = `
      <div class="py-4 text-center text-xs text-[#8E8B83]">
        Нет списаний на ближайшие 7 дней 🏖️
      </div>
    `;
    return;
  }

  container.innerHTML = upcoming.map(r => {
    const acc = state.accounts.find(a => a.id === r.accountId);
    const accName = acc ? acc.name : '';
    const isIncome = r.type === 'income';

    return `
      <div class="flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#ECE8DC] text-xs">
        <div class="flex items-center gap-2.5">
          <span class="w-6 h-6 rounded-lg bg-[#FAF9F5] flex items-center justify-center text-xs">${r.icon || '📅'}</span>
          <div>
            <div class="font-bold text-[#171717]">${r.name}</div>
            <div class="text-[10px] text-[#7E7B73]">${r.daysUntil === 0 ? 'Сегодня' : `Через ${r.daysUntil} дн.`} • ${accName}</div>
          </div>
        </div>
        <div class="text-right flex items-center gap-2">
          <div class="font-bold ${isIncome ? 'text-emerald-700' : 'text-[#171717]'}">
            ${isIncome ? '+' : '-'}₸${formatMoney(r.amount)}
          </div>
          <button onclick="executeRecurringPayment('${r.id}')" title="Провести сейчас" class="px-2 py-1 bg-[#EAE6DC] hover:bg-[#DDD8CD] text-[10px] font-bold rounded-lg transition">
            ✓
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function getTransactionDateTime(transaction) {
  const date = String(transaction.date || '');
  const time = /^\d{2}:\d{2}$/.test(transaction.time || '') ? transaction.time : '00:00';
  const parsed = new Date(`${date}T${time}:00`);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const created = new Date(transaction.createdAt || 0);
  return Number.isNaN(created.getTime()) ? new Date(0) : created;
}

function renderRecentHomeTransactions() {
  const container = document.getElementById('recent-home-tx-list');
  if (!container) return;
  const recent = [...(state.transactions || [])]
    .sort((a, b) => getTransactionDateTime(b) - getTransactionDateTime(a))
    .slice(0, 5);

  if (!recent.length) {
    container.innerHTML = '<div class="py-6 text-center text-xs text-[#8E8B83]">Операций пока нет</div>';
    return;
  }

  container.innerHTML = recent.map((transaction) => {
    const category = state.categories.find((item) => item.id === transaction.categoryId);
    const account = state.accounts.find((item) => item.id === transaction.accountId);
    const destination = state.accounts.find((item) => item.id === transaction.toAccountId);
    const isIncome = transaction.type === 'income';
    const isTransfer = transaction.type === 'transfer';
    const dateTime = getTransactionDateTime(transaction);
    const label = transaction.note || category?.name || (isTransfer ? 'Перевод между счетами' : 'Операция');
    const accountLabel = isTransfer
      ? `${account?.name || 'Счёт'} → ${destination?.name || 'Счёт'}`
      : account?.name || 'Счёт не указан';
    const amountLabel = isTransfer ? `⇄₸${formatMoney(transaction.amount)}` : `${isIncome ? '+' : '-'}₸${formatMoney(transaction.amount)}`;
    const amountClass = isTransfer ? 'text-[#465948]' : (isIncome ? 'text-emerald-700' : 'text-red-700');
    return `<div class="flex items-center justify-between gap-3 py-3 text-xs">
      <div class="flex min-w-0 items-center gap-2.5"><span class="w-2 h-2 shrink-0 rounded-full ${isTransfer ? 'bg-[#465948]' : (isIncome ? 'bg-emerald-500' : 'bg-red-400')}"></span><div class="min-w-0"><div class="truncate font-bold text-[#171717]">${escapeHtml(label)}</div><div class="mt-0.5 truncate text-[10px] text-[#7E7B73]">${dateTime.toLocaleDateString('ru-RU')} · ${dateTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · ${escapeHtml(accountLabel)}</div></div></div>
      <div class="shrink-0 font-bold ${amountClass}">${amountLabel}</div>
    </div>`;
  }).join('');
}

// -------------------------------------------------------------
// RENDERERS: OPERATIONS WORKSPACE
// -------------------------------------------------------------
let currentTxTypeFilter = 'all';

window.filterTxType = function(type, btn) {
  currentTxTypeFilter = type;
  document.querySelectorAll('.tx-filter-btn').forEach(b => {
    b.classList.remove('bg-white', 'text-[#171717]', 'shadow-xs');
    b.classList.add('text-[#6B6860]');
  });
  if (btn) {
    btn.classList.add('bg-white', 'text-[#171717]', 'shadow-xs');
    btn.classList.remove('text-[#6B6860]');
  }
  renderOperationsFeed();
};

window.switchScreen = function(screen, focusId = null) {
  const screens = ['capital', 'deposits', 'operations', 'debts', 'plan'];
  const selected = screens.includes(screen) ? screen : 'capital';

  screens.forEach((name) => {
    const pane = document.getElementById(`workspace-${name}`);
    if (pane) pane.classList.toggle('hidden', name !== selected);

    ['nav', 'mob-nav'].forEach((prefix) => {
      const button = document.getElementById(`${prefix}-${name}`);
      if (button) button.classList.toggle('active', name === selected);
    });
  });

  if (selected === 'operations' && focusId === 'tab-recurring') window.setOpsMode('recurring');
  if (focusId && focusId !== 'tab-recurring') document.getElementById(focusId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

let currentOpsMode = 'feed';

window.setOpsMode = function(mode) {
  currentOpsMode = mode === 'recurring' ? 'recurring' : 'feed';
  const isRecurring = currentOpsMode === 'recurring';
  document.getElementById('ops-view-feed')?.classList.toggle('hidden', isRecurring);
  document.getElementById('ops-view-recurring')?.classList.toggle('hidden', !isRecurring);

  ['feed', 'recurring'].forEach((name) => {
    const button = document.getElementById(`subnav-ops-${name}`);
    if (!button) return;
    const active = name === currentOpsMode;
    button.classList.toggle('bg-white', active);
    button.classList.toggle('text-[#171717]', active);
    button.classList.toggle('shadow-xs', active);
    button.classList.toggle('text-[#6B6860]', !active);
  });
};

function renderRecurringPayments() {
  const recurring = state.recurring || [];
  const expenseTotal = recurring.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const incomeTotal = recurring.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenseEl = document.getElementById('rec-total-sum');
  const incomeEl = document.getElementById('rec-income-sum');
  if (expenseEl) expenseEl.innerText = `₸${formatMoney(expenseTotal)}`;
  if (incomeEl) incomeEl.innerText = `₸${formatMoney(incomeTotal)}`;

  const list = document.getElementById('recurring-items-list');
  if (!list) return;
  if (!recurring.length) {
    list.innerHTML = '<div class="py-8 text-center text-xs text-[#7E7B73]">Регулярных платежей пока нет</div>';
    return;
  }
  list.innerHTML = [...recurring].sort((a, b) => Number(a.dayOfMonth || 0) - Number(b.dayOfMonth || 0)).map((item) => {
    const account = state.accounts.find((accountItem) => accountItem.id === item.accountId);
    const income = item.type === 'income';
    return `<div class="flex items-center justify-between gap-4 py-3 text-xs">
      <div><div class="font-bold text-[#171717]">${item.icon || '📅'} ${item.name}</div><div class="text-[#7E7B73] mt-1">${item.dayOfMonth}-е число • ${account?.name || 'Счёт не выбран'}</div></div>
      <div class="text-right"><div class="font-bold ${income ? 'text-emerald-700' : 'text-[#171717]'}">${income ? '+' : '-'}₸${formatMoney(item.amount)}</div><button onclick="executeRecurringPayment('${item.id}')" class="mt-1 px-2 py-1 rounded-lg bg-[#EAE6DC] hover:bg-[#DDD8CD] font-bold">Провести</button></div>
    </div>`;
  }).join('');
}

window.renderOperationsFeed = function() {
  const container = document.getElementById('full-tx-feed');
  if (!container) return;

  const accFilter = document.getElementById('filter-account') ? document.getElementById('filter-account').value : 'all';
  const categoryFilter = document.getElementById('filter-category') ? document.getElementById('filter-category').value : 'all';
  const searchVal = document.getElementById('filter-search') ? document.getElementById('filter-search').value.toLowerCase().trim() : '';

  let list = [...state.transactions];

  if (currentTxTypeFilter !== 'all') {
    list = list.filter(tx => tx.type === currentTxTypeFilter);
  }
  if (accFilter !== 'all') {
    list = list.filter(tx => tx.accountId === accFilter || tx.toAccountId === accFilter);
  }
  if (categoryFilter !== 'all') list = list.filter(tx => tx.categoryId === categoryFilter);
  if (searchVal) {
    list = list.filter(tx => (tx.note || '').toLowerCase().includes(searchVal));
  }

  if (list.length === 0) {
    container.innerHTML = `<div class="py-12 text-center text-xs text-[#8E8B83]">Операций по выбранным фильтрам не найдено</div>`;
    return;
  }

  // Group by date
  const groups = {};
  list.sort((a, b) => new Date(b.date + ' ' + (b.time || '00:00')) - new Date(a.date + ' ' + (a.time || '00:00'))).forEach(tx => {
    const d = tx.date || 'Без даты';
    if (!groups[d]) groups[d] = [];
    groups[d].push(tx);
  });

  let html = '';
  Object.keys(groups).forEach(dateStr => {
    const items = groups[dateStr];
    const dayTotalExpense = items.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0);

    html += `
      <div class="mb-5 last:mb-0">
        <div class="flex justify-between items-center text-xs text-[#7E7B73] px-1 font-medium mb-2">
          <span>${dateStr}</span>
          <span>${dayTotalExpense > 0 ? '-₸' + formatMoney(dayTotalExpense) : ''}</span>
        </div>
        <div class="bg-white border border-[#EDE9DF] rounded-2xl divide-y divide-[#F1EDE4] overflow-hidden">
    `;

    items.forEach(tx => {
      const acc = state.accounts.find(a => a.id === tx.accountId);
      const cat = state.categories.find(c => c.id === tx.categoryId);
      const isIncome = tx.type === 'income';
      const isTransfer = tx.type === 'transfer';

      let dotColor = '#9E9B93';
      let sign = '-';
      let amountColor = 'text-[#171717]';

      if (isIncome) {
        dotColor = '#10B981';
        sign = '+';
        amountColor = 'text-emerald-700 font-extrabold';
      } else if (isTransfer) {
        dotColor = '#465948';
        sign = '⇄';
        amountColor = 'text-[#465948] font-bold';
      }

      html += `
        <div class="flex items-center justify-between p-3.5 hover:bg-[#FAF9F5] transition">
          <div class="flex items-center gap-3">
            <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${dotColor}"></span>
            <div>
              <div class="font-bold text-sm text-[#171717]">${escapeHtml(tx.note || 'Операция')}</div>
              <div class="text-[11px] text-[#7E7B73]">${tx.time || ''} • ${acc ? acc.name : ''} ${cat ? '• ' + cat.name : ''}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm font-bold ${amountColor}">${sign}₸${formatMoney(tx.amount)}</div>
            <button onclick="deleteTransaction('${tx.id}')" class="text-[10px] text-neutral-400 hover:text-red-600 transition">Удалить</button>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
  });

  container.innerHTML = html;
}

// -------------------------------------------------------------
// RENDERERS: DEBTS
// -------------------------------------------------------------
function formatDebtLoanDate(date, kind) {
  if (!date) return 'Дата займа не указана';
  const loanDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(loanDate.getTime())) return 'Дата займа не указана';
  const label = loanDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${kind === 'payable' ? 'Взял' : 'Дал'} ${label}`;
}

function renderDebts() {
  const debts = Array.isArray(state.debts) ? state.debts : [];
  const active = debts.filter((debt) => debt.status !== 'paid');
  const payable = active.filter((debt) => debt.kind === 'payable').reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
  const receivable = active.filter((debt) => debt.kind === 'receivable').reduce((sum, debt) => sum + Number(debt.amount || 0), 0);

  const payableTotal = document.getElementById('debts-payable-total');
  const receivableTotal = document.getElementById('debts-receivable-total');
  const activeCount = document.getElementById('debts-active-count');
  const sidebarCount = document.getElementById('sidebar-debt-count');
  if (payableTotal) payableTotal.innerText = `₸${formatMoney(payable)}`;
  if (receivableTotal) receivableTotal.innerText = `₸${formatMoney(receivable)}`;
  if (activeCount) activeCount.innerText = `${active.length} ${active.length === 1 ? 'активный' : 'активных'}`;
  if (sidebarCount) sidebarCount.innerText = String(active.length);

  const list = document.getElementById('debts-list');
  if (!list) return;
  if (!active.length) {
    list.innerHTML = '<div class="border border-dashed border-[#DFDAD0] rounded-2xl py-10 px-5 text-center"><div class="text-3xl mb-2">🤝</div><div class="font-bold text-sm text-[#171717]">Нет активных долгов</div><p class="text-xs text-[#7E7B73] mt-1">Добавь долг, чтобы не держать его в голове.</p></div>';
    return;
  }

  list.innerHTML = [...active].sort((a, b) => String(b.loanDate || b.createdAt || '').localeCompare(String(a.loanDate || a.createdAt || ''))).map((debt) => {
    const payableDebt = debt.kind === 'payable';
    const account = state.accounts.find((item) => item.id === debt.accountId);
    const loanDate = debt.loanDate || (debt.createdAt ? debt.createdAt.slice(0, 10) : '');
    return `<article class="border border-[#DFDAD0] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div class="flex items-start gap-3"><span class="w-10 h-10 rounded-2xl ${payableDebt ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'} flex items-center justify-center text-lg">${payableDebt ? '↗' : '↙'}</span><div><div class="flex flex-wrap items-center gap-2"><h3 class="font-bold text-sm text-[#171717]">${escapeHtml(debt.person)}</h3><span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${payableDebt ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}">${payableDebt ? 'Я должен' : 'Мне должны'}</span></div><p class="text-xs text-[#7E7B73] mt-1">${formatDebtLoanDate(loanDate, debt.kind)}${account ? ` · ${escapeHtml(account.name)}` : ''}</p>${debt.note ? `<p class="text-[11px] text-[#7E7B73] mt-1">${escapeHtml(debt.note)}</p>` : ''}</div></div><div class="flex items-center gap-2 sm:text-right"><div class="font-black text-lg ${payableDebt ? 'text-red-700' : 'text-emerald-700'} mr-auto sm:mr-2">₸${formatMoney(debt.amount)}</div><button onclick="markDebtPaid('${debt.id}')" class="px-3 py-2 bg-[#465948] hover:bg-[#38483a] text-white text-[11px] font-bold rounded-xl">Погашен</button><button onclick="deleteDebt('${debt.id}')" class="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded-xl" aria-label="Удалить долг">Удалить</button></div></article>`;
  }).join('');
}

window.openAddDebtModal = function() {
  const account = document.getElementById('debt-account');
  if (account) account.innerHTML = `<option value="">Не выбирать</option>${state.accounts.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}`;
  document.getElementById('debt-kind').value = 'payable';
  document.getElementById('debt-person').value = '';
  document.getElementById('debt-amount').value = '';
  document.getElementById('debt-loan-date').value = makeTimestamp().date;
  document.getElementById('debt-note').value = '';
  document.getElementById('modal-debt').classList.remove('hidden');
};

window.handleDebtForm = function(event) {
  event.preventDefault();
  const person = document.getElementById('debt-person').value.trim();
  const amount = Number(document.getElementById('debt-amount').value);
  if (!person || !Number.isFinite(amount) || amount <= 0) return;
  if (!Array.isArray(state.debts)) state.debts = [];
  state.debts.unshift({ id: `debt_${Date.now()}`, kind: document.getElementById('debt-kind').value, person, amount, loanDate: document.getElementById('debt-loan-date').value, accountId: document.getElementById('debt-account').value, note: document.getElementById('debt-note').value.trim(), status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  saveState();
  renderAll();
  window.closeModal('modal-debt');
  window.showToast('Долг добавлен', '🤝');
};

window.markDebtPaid = function(id) {
  const debt = (state.debts || []).find((item) => item.id === id);
  if (!debt) return;
  debt.status = 'paid';
  debt.paidAt = new Date().toISOString();
  debt.updatedAt = debt.paidAt;
  saveState();
  renderAll();
  window.showToast('Долг отмечен как погашенный', '✓');
};

window.deleteDebt = function(id) {
  const debt = (state.debts || []).find((item) => item.id === id);
  if (!debt || !confirm(`Удалить долг «${debt.person}»?`)) return;
  state.debts = state.debts.filter((item) => item.id !== id);
  saveState();
  renderAll();
  window.showToast('Долг удалён', '🗑️');
};

// -------------------------------------------------------------
// RENDERERS: PLAN, GOALS & ANALYTICS
// -------------------------------------------------------------
function renderPlanWorkspace() {
  const balances = getAccountBalances();

  // Goals
  const goalsContainer = document.getElementById('goals-cards-grid');
  if (goalsContainer) {
    const goals = state.goals || [];
    if (goals.length === 0) {
      goalsContainer.innerHTML = `<div class="py-4 text-center text-xs text-[#8E8B83]">Нет активных целей</div>`;
    } else {
      goalsContainer.innerHTML = goals.map(g => {
        let currentVal = 0;
        (g.linkedAccounts || []).forEach(accId => {
          currentVal += (balances[accId] || 0);
        });
        const pct = Math.min(100, Math.round((currentVal / (g.targetAmount || 1)) * 100));

        return `
          <div class="bg-white border border-[#EDE9DF] p-4 rounded-2xl space-y-2">
            <div class="flex justify-between items-start">
              <div class="flex items-center gap-2">
                <span class="text-lg">${g.icon || '🎯'}</span>
                <div>
                  <div class="font-bold text-sm text-[#171717]">${g.title}</div>
                  <div class="text-[10px] text-[#7E7B73]">₸${formatMoney(currentVal)} из ₸${formatMoney(g.targetAmount)}</div>
                </div>
              </div>
              <span class="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">${pct}%</span>
            </div>
            <div class="w-full bg-[#EAE6DC] h-1.5 rounded-full overflow-hidden">
              <div class="bg-[#465948] h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Category Limits
  const limitsContainer = document.getElementById('category-limits-grid');
  if (limitsContainer) {
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const catLimits = state.limits.categoryLimits || {};

    limitsContainer.innerHTML = Object.keys(catLimits).map(catId => {
      const cat = state.categories.find(c => c.id === catId);
      const limitVal = catLimits[catId] || 0;

      const spentVal = state.transactions
        .filter(t => t.categoryId === catId && t.type === 'expense' && (t.date || '').startsWith(currentMonthPrefix))
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const pct = Math.min(100, Math.round((spentVal / (limitVal || 1)) * 100));
      const remaining = Math.max(0, limitVal - spentVal);

      return `
        <div class="p-3 bg-white border border-[#EDE9DF] rounded-2xl space-y-1.5">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-[#171717]">${cat ? cat.name : 'Категория'}</span>
            <span class="text-[#7E7B73]">₸${formatMoney(spentVal)} / ₸${formatMoney(limitVal)}</span>
          </div>
          <div class="w-full bg-[#EAE6DC] h-2 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500 ${pct > 85 ? 'bg-[#7E151E]' : 'bg-[#465948]'}" style="width: ${pct}%"></div>
          </div>
          <div class="flex justify-between text-[10px] text-[#7E7B73]">
            <span>${pct}% потрачено</span>
            <span class="text-emerald-700 font-medium">Осталось ₸${formatMoney(remaining)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Canvas Charts
  renderAnalyticsChart();
}

function renderAnalyticsChart() {
  const canvas = document.getElementById('analyticsPieChart');
  if (!canvas) return;

  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const catMap = {};
  let totalExpenses = 0;
  let totalIncome = 0;

  state.transactions.forEach(t => {
    if ((t.date || '').startsWith(currentMonthPrefix)) {
      const amt = Number(t.amount || 0);
      if (t.type === 'expense') {
        totalExpenses += amt;
        catMap[t.categoryId] = (catMap[t.categoryId] || 0) + amt;
      } else if (t.type === 'income') {
        totalIncome += amt;
      }
    }
  });

  const chartData = Object.keys(catMap).map((catId, index) => {
    const cat = state.categories.find(c => c.id === catId);
    return {
      label: cat ? cat.name : 'Прочее',
      value: catMap[catId],
      color: cat ? cat.color : MODERN_PALETTE[index % MODERN_PALETTE.length]
    };
  });

  drawPixelPieChart(canvas, chartData);

  // Top breakdown list
  const listContainer = document.getElementById('analytics-top-categories');
  if (listContainer) {
    listContainer.innerHTML = chartData.sort((a, b) => b.value - a.value).slice(0, 4).map(item => {
      const pct = totalExpenses > 0 ? Math.round((item.value / totalExpenses) * 100) : 0;
      return `
        <div>
          <div class="flex justify-between text-xs font-semibold mb-1">
            <span>${item.label}</span>
            <span>${pct}% • ₸${formatMoney(item.value)}</span>
          </div>
          <div class="w-full bg-[#EAE6DC] h-2 rounded-full overflow-hidden">
            <div class="h-full rounded-full" style="width: ${pct}%; background-color: ${item.color}"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Savings rate
  const savings = Math.max(0, totalIncome - totalExpenses);
  const savingsRate = totalIncome > 0 ? Math.min(100, Math.round((savings / totalIncome) * 100)) : 0;

  const elRate = document.getElementById('analytics-savings-rate');
  if (elRate) elRate.innerText = `${savingsRate}% сбережений`;
}

// -------------------------------------------------------------
// MODALS & USER ACTIONS
// -------------------------------------------------------------
let currentModalTxType = 'expense';
let statementImportDraft = [];

function getLocalDateValue(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function getLocalTimeValue(date = new Date()) {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function setReceiptImportStatus(message, tone = 'muted') {
  const el = document.getElementById('receipt-import-status');
  if (!el) return;
  el.className = `min-h-4 text-[11px] ${tone === 'error' ? 'text-red-700' : tone === 'success' ? 'text-emerald-700' : 'text-[#7E7B73]'}`;
  el.textContent = message;
}

function parseReceiptDate(text) {
  const isoMatch = text.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  const match = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (!match) return getLocalDateValue();
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function guessReceiptCategory(text, type) {
  if (type === 'income') {
    return /зарплат|оклад|стипенд/i.test(text) ? 'cat_salary' : 'cat_invest';
  }
  if (/taxi|такси|indrive|yandex go|яндекс go|азс|заправ/i.test(text)) return 'cat_transport';
  if (/magnum|galmart|продукт|супермаркет|market/i.test(text)) return 'cat_food';
  if (/wolt|glovo|кафе|coffee|ресторан/i.test(text)) return 'cat_dining';
  if (/аптек|clinic|медиц|health/i.test(text)) return 'cat_health';
  if (/аренд|жкх|коммун|alser|алсеко/i.test(text)) return 'cat_home';
  if (/spotify|netflix|подписк|кино|отдых/i.test(text)) return 'cat_leisure';
  if (/одежд|магазин|покупк|wildberries|ozon/i.test(text)) return 'cat_shopping';
  return 'cat_other';
}

function parseReceiptText(rawText) {
  const text = rawText.replace(/\u00a0/g, ' ').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  const amountPatterns = [
    /(?:сумма(?:\s+(?:платежа|перевода|операции))?|итого|к оплате|оплачено|зачислено|списано)[^\d]{0,28}(\d[\d ]*(?:[,.]\d{1,2})?)\s*(?:₸|тг|тенге)/i,
    /(\d[\d ]*(?:[,.]\d{1,2})?)\s*(?:₸|тг|тенге)/i
  ];
  const amountMatch = amountPatterns.map((pattern) => text.match(pattern)).find(Boolean);
  const amount = amountMatch ? Number(amountMatch[1].replace(/\s/g, '').replace(',', '.')) : 0;
  const isIncome = /(?:зачислен|поступлен|пополнен|получен)/i.test(text) && !/(?:не зачислен|отклонен)/i.test(text);
  const looksLikeExternalTransfer = /(?:перевод|получател|на карту|по номеру|номер телефона|p2p)/i.test(text);
  const type = isIncome ? 'income' : 'expense';
  const labelledLine = text.split('\n').map((line) => line.trim()).find((line) => /(?:получател|магазин|наименование|назначение|комментарий|merchant)/i.test(line) && line.length < 110);
  const usefulLine = text.split('\n').map((line) => line.trim()).find((line) => line.length >= 3 && line.length <= 80 && !/(?:квитанц|bcc|банк|сумма|₸|тг|тенге|дата|время|чек|операц|успеш)/i.test(line));
  let note = (labelledLine || usefulLine || (looksLikeExternalTransfer ? 'Перевод из BCC' : 'Оплата из BCC'))
    .replace(/^(?:получател(?:ь)?|магазин|наименование|назначение|комментарий|merchant)\s*[:—-]?\s*/i, '')
    .slice(0, 110);
  if (looksLikeExternalTransfer && !/^Перевод/i.test(note)) note = `Перевод: ${note}`;
  // A dot is deliberately excluded here: in a receipt "22.11.2026" is a date,
  // not 22:11. BCC/Kaspi display time with a colon.
  const timeMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  return {
    amount,
    type,
    categoryId: guessReceiptCategory(text, type),
    date: parseReceiptDate(text),
    time: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : getLocalTimeValue(),
    note: note || (type === 'income' ? 'Поступление из BCC' : 'Оплата из BCC'),
    looksLikeExternalTransfer
  };
}

window.openReceiptImportModal = function() {
  const input = document.getElementById('receipt-import-file');
  const text = document.getElementById('receipt-import-text');
  if (input) input.value = '';
  if (text) text.value = '';
  setReceiptImportStatus('');
  document.getElementById('modal-receipt-import')?.classList.remove('hidden');
};

function renderStatementPreview() {
  const container = document.getElementById('statement-import-preview');
  const confirmButton = document.getElementById('statement-import-confirm');
  if (!container || !confirmButton) return;
  if (!statementImportDraft.length) {
    container.innerHTML = '<p class="text-[11px] text-[#7E7B73]">После выбора выписки здесь появятся найденные операции.</p>';
    confirmButton.disabled = true;
    return;
  }
  container.innerHTML = statementImportDraft.map((operation, index) => {
    const options = state.categories.filter((cat) => cat.type === operation.type).map((cat) => `<option value="${cat.id}" ${cat.id === operation.categoryId ? 'selected' : ''}>${cat.icon || '🏷️'} ${cat.name}</option>`).join('');
    return `<label class="block p-2 border-b border-[#ECE8DC] text-[11px] ${operation.duplicate ? 'opacity-50' : ''}"><div class="flex gap-2"><input type="checkbox" data-import-include="${index}" ${operation.duplicate ? 'disabled' : 'checked'}><div class="min-w-0 flex-1"><b class="block truncate">${escapeHtml(operation.description || 'Операция без описания')}</b><span class="text-[#7E7B73]">${operation.date} · ${operation.bank}${operation.isOwnTransfer ? ' · свой перевод' : ''}</span><select data-import-category="${index}" class="mt-1 w-full bg-white border border-[#DFDAD0] rounded-lg px-2 py-1 text-[10px]">${options}</select></div><b class="${operation.type === 'income' ? 'text-emerald-700' : 'text-red-700'}">${operation.type === 'income' ? '+' : '-'}${formatMoney(operation.amount)} ₸</b></div>${operation.duplicate ? '<span class="text-amber-700">Дубликат — пропущен</span>' : ''}</label>`;
  }).join('');
  confirmButton.disabled = !statementImportDraft.some((item) => !item.duplicate);
}

window.openStatementImportModal = function() {
  const file = document.getElementById('statement-import-file');
  const account = document.getElementById('statement-import-account');
  if (file) file.value = '';
  if (account) account.innerHTML = state.accounts.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
  statementImportDraft = [];
  renderStatementPreview();
  document.getElementById('modal-statement-import')?.classList.remove('hidden');
};

window.handleStatementFile = async function(event) {
  const file = event.target.files?.[0];
  const status = document.getElementById('statement-import-status');
  if (!file || !status) return;
  const adapter = chooseAdapter(file, bankAdapters);
  if (!adapter) { status.textContent = unsupportedFileMessage(file); status.className = 'text-[11px] text-red-700'; return; }
  try {
    status.textContent = 'Читаю выписку только в этом браузере…';
    const accountId = document.getElementById('statement-import-account')?.value || '';
    const parsed = await adapter.parse(file);
    const categorized = parsed.map((item) => ({ ...item, categoryId: guessReceiptCategory(item.description, item.type) }));
    statementImportDraft = findDuplicates(markOwnTransfers(categorized, state.accounts), state.transactions, accountId);
    renderStatementPreview();
    status.textContent = `Найдено операций: ${statementImportDraft.length}. Проверь строки и категории.`;
    status.className = 'text-[11px] text-emerald-700';
  } catch (error) {
    status.textContent = error.message || 'Не удалось прочитать выписку.';
    status.className = 'text-[11px] text-red-700';
  }
};

window.confirmStatementImport = function() {
  const accountId = document.getElementById('statement-import-account')?.value;
  const included = statementImportDraft.filter((item, index) => document.querySelector(`[data-import-include="${index}"]`)?.checked && !item.duplicate);
  if (!accountId || !included.length) return;
  included.forEach((item, index) => {
    const originalIndex = statementImportDraft.indexOf(item);
    const categoryId = document.querySelector(`[data-import-category="${originalIndex}"]`)?.value || item.categoryId;
    const ownTransfer = item.isOwnTransfer;
    state.transactions.unshift({ id: `import_${Date.now()}_${index}`, type: ownTransfer ? 'transfer' : item.type, amount: item.amount, date: item.date, time: item.time || '', accountId, toAccountId: ownTransfer ? accountId : '', categoryId: ownTransfer ? '' : categoryId, note: item.description || 'Импорт из выписки', importFingerprint: item.fingerprint, importSource: item.bank, currency: item.currency || 'KZT', importedAt: new Date().toISOString() });
  });
  saveState(); renderAll(); window.closeModal('modal-statement-import');
  window.showToast(`Импортировано: ${included.length}`, '✓');
};

window.handleReceiptFile = async function(event) {
  const file = event.target.files?.[0];
  const textArea = document.getElementById('receipt-import-text');
  if (!file || !textArea) return;

  if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
    textArea.value = await file.text();
    setReceiptImportStatus('Текст квитанции добавлен. Нажми «Распознать».', 'success');
    return;
  }
  if (!file.type.startsWith('image/')) {
    setReceiptImportStatus('Выбери скриншот/фото или .txt. PDF можно открыть и сохранить как скриншот.', 'error');
    return;
  }
  if (!Tesseract?.recognize) {
    setReceiptImportStatus('Модуль распознавания ещё загружается. Подожди несколько секунд и выбери фото снова.', 'error');
    return;
  }

  try {
    setReceiptImportStatus('Распознаю текст на этом устройстве…');
    const result = await Tesseract.recognize(file, 'rus+eng', {
      workerPath: './vendor/tesseract-worker.min.js',
      logger: (message) => {
        if (message.status === 'recognizing text' && typeof message.progress === 'number') {
          setReceiptImportStatus(`Распознаю текст на этом устройстве: ${Math.round(message.progress * 100)}%`);
        }
      }
    });
    textArea.value = result.data.text.trim();
    setReceiptImportStatus('Готово. Проверь распознанный текст и нажми «Распознать».', 'success');
  } catch (error) {
    console.warn('Receipt OCR failed:', error);
    setReceiptImportStatus('Не получилось прочитать фото. Вставь текст из «Поделиться квитанцией» вручную.', 'error');
  }
};

window.prepareReceiptImport = function() {
  const rawText = document.getElementById('receipt-import-text')?.value || '';
  if (rawText.trim().length < 3) {
    setReceiptImportStatus('Добавь фото квитанции или вставь её текст.', 'error');
    return;
  }
  const draft = parseReceiptText(rawText);
  if (!draft.amount) {
    setReceiptImportStatus('Не нашёл сумму в тенге. Впиши её в поле операции после импорта.', 'error');
  }
  window.closeModal('modal-receipt-import');
  window.openModal('tx', draft.type);
  document.getElementById('input-tx-amount').value = draft.amount || '';
  document.getElementById('input-tx-note').value = draft.note;
  document.getElementById('input-tx-date').value = draft.date;
  document.getElementById('input-tx-time').value = draft.time;
  const category = document.getElementById('input-tx-category');
  if (category && [...category.options].some((option) => option.value === draft.categoryId)) category.value = draft.categoryId;
  window.showToast(draft.looksLikeExternalTransfer
    ? 'Перевод другому человеку отмечен как расход — выбери свой счёт списания и проверь данные.'
    : 'Черновик операции заполнен. Проверь данные и нажми «Сохранить».', '⌁');
};

window.openModal = function(modalType, subType = 'expense', preselectedAcc = null) {
  if (modalType === 'tx') {
    window.setModalTxType(subType);
    populateSelectAccounts(preselectedAcc);
    populateSelectCategories();
    document.getElementById('modal-tx').classList.remove('hidden');
    const dateInput = document.getElementById('input-tx-date');
    const timeInput = document.getElementById('input-tx-time');
    if (dateInput && !dateInput.value) dateInput.value = getLocalDateValue();
    if (timeInput && !timeInput.value) timeInput.value = getLocalTimeValue();
    document.getElementById('input-tx-amount').focus();
  } else if (modalType === 'rec') {
    populateSelectAccounts();
    document.getElementById('modal-rec').classList.remove('hidden');
  }
};

window.closeModal = function(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('hidden');
};

window.setModalTxType = function(type) {
  currentModalTxType = type;
  const toAccRow = document.getElementById('modal-tx-to-account-row');
  const catRow = document.getElementById('modal-tx-category-row');
  const title = document.getElementById('modal-tx-title');
  const accountLabel = document.getElementById('input-tx-account-label');

  ['expense', 'income', 'transfer'].forEach(t => {
    const btn = document.getElementById('modal-type-' + t);
    if (btn) {
      if (t === type) {
        btn.className = "py-1.5 rounded-lg bg-white text-[#171717] shadow-xs font-semibold";
      } else {
        btn.className = "py-1.5 rounded-lg text-[#666]";
      }
    }
  });

  if (type === 'transfer') {
    toAccRow.classList.remove('hidden');
    catRow.classList.add('hidden');
    title.innerText = 'Перевод между счетами';
    if (accountLabel) accountLabel.innerText = 'Счёт списания';
  } else if (type === 'income') {
    toAccRow.classList.add('hidden');
    catRow.classList.remove('hidden');
    title.innerText = 'Новый доход';
    if (accountLabel) accountLabel.innerText = 'Счёт пополнения';
  } else {
    toAccRow.classList.add('hidden');
    catRow.classList.remove('hidden');
    title.innerText = 'Новый расход';
    if (accountLabel) accountLabel.innerText = 'Счёт списания';
  }

  populateSelectCategories();
};

function populateSelectAccounts(preselectedId = null) {
  const selFrom = document.getElementById('input-tx-account');
  const selTo = document.getElementById('input-tx-to-account');
  const selRec = document.getElementById('rec-input-account');
  const selGoal = document.getElementById('goal-input-account');
  const filterAcc = document.getElementById('filter-account');

  const options = state.accounts.map(acc => {
    return `<option value="${acc.id}" ${acc.id === preselectedId ? 'selected' : ''}>${acc.name} (${acc.currency || '₸'})</option>`;
  }).join('');

  if (selFrom) selFrom.innerHTML = options;
  if (selTo) selTo.innerHTML = options;
  if (selRec) selRec.innerHTML = options;
  if (selGoal) selGoal.innerHTML = options;
  if (filterAcc) {
    filterAcc.innerHTML = `<option value="all">Все счета</option>` + options;
  }
}

function populateSelectCategories() {
  const selCat = document.getElementById('input-tx-category');
  const filterCat = document.getElementById('filter-category');
  const visibleCategories = state.categories.filter((cat) => cat.type === currentModalTxType);
  const options = visibleCategories.map(cat => {
    return `<option value="${cat.id}">${cat.icon || '🏷️'} ${cat.name}</option>`;
  }).join('');

  if (selCat) selCat.innerHTML = options;
  if (filterCat) {
    const selected = filterCat.value || 'all';
    filterCat.innerHTML = '<option value="all">Все категории</option>' + state.categories.map((cat) => `<option value="${cat.id}">${cat.icon || '🏷️'} ${cat.name}</option>`).join('');
    filterCat.value = [...filterCat.options].some((option) => option.value === selected) ? selected : 'all';
  }
}

function updateAuthButton(user) {
  document.querySelectorAll('[data-google-auth]').forEach((button) => {
    button.dataset.signedIn = user ? 'true' : 'false';
    button.innerText = user ? `Выйти: ${user.displayName || user.email || 'Google'}` : 'Войти через Google';
  });
  const description = document.getElementById('google-auth-description');
  if (description) {
    description.textContent = user
      ? `Данные привязаны к аккаунту ${user.email || user.displayName || 'Google'} и синхронизируются между устройствами.`
      : 'Войди через Google, чтобы синхронизировать данные между телефоном и компьютером.';
  }
}

function updateSyncStatus(status) {
  const labels = { local: 'Локально', syncing: 'Синхронизация…', synced: 'Синхронизировано', offline: 'Офлайн', error: 'Ошибка синка' };
  const colors = { local: 'text-[#7E7B73]', syncing: 'text-amber-700', synced: 'text-emerald-700', offline: 'text-[#7E7B73]', error: 'text-red-700' };
  document.querySelectorAll('[data-sync-status]').forEach((el) => {
    el.className = `text-[10px] font-semibold ${colors[status] || colors.local}`;
    el.textContent = labels[status] || labels.local;
  });
}

window.toggleGoogleAuth = async function() {
  try {
    const button = document.querySelector('[data-google-auth]');
    if (button && button.dataset.signedIn === 'true') {
      await logoutUser();
      return;
    }
    await loginWithGoogle();
  } catch (error) {
    window.showToast(`Не удалось выполнить вход: ${error.message}`, '⚠️');
  }
};

window.handleFormTransaction = function(e) {
  e.preventDefault();
  const amount = Number(document.getElementById('input-tx-amount').value);
  const note = document.getElementById('input-tx-note').value;
  const accountId = document.getElementById('input-tx-account').value;
  const toAccountId = document.getElementById('input-tx-to-account').value;
  const categoryId = document.getElementById('input-tx-category').value;
  const date = document.getElementById('input-tx-date').value || getLocalDateValue();
  const timeInput = document.getElementById('input-tx-time');
  const enteredTime = normalizeOperationTime(timeInput?.value);
  if (enteredTime === null) {
    window.showToast('Укажи время в формате 22:07 или 2207.', '⚠️');
    timeInput?.focus();
    return;
  }
  const time = enteredTime || getLocalTimeValue();

  if (!amount || !note) return;

  const newTx = {
    id: 'tx_' + Date.now(),
    type: currentModalTxType,
    amount: amount,
    date,
    time,
    accountId: accountId,
    toAccountId: currentModalTxType === 'transfer' ? toAccountId : '',
    categoryId: currentModalTxType !== 'transfer' ? categoryId : '',
    note: note
  };

  state.transactions.unshift(newTx);
  saveState();

  e.target.reset();
  window.closeModal('modal-tx');
  renderAll();
  window.showToast(`Операция на ₸${formatMoney(amount)} записана!`);
};

window.deleteTransaction = function(txId) {
  if (!confirm('Удалить эту операцию?')) return;
  state.transactions = state.transactions.filter(t => t.id !== txId);
  saveState();
  renderAll();
  window.showToast('Операция удалена', '🗑️');
};

window.handleFormRecurring = function(e) {
  e.preventDefault();
  const name = document.getElementById('rec-input-name').value;
  const amount = Number(document.getElementById('rec-input-amount').value);
  const day = Number(document.getElementById('rec-input-day').value);
  const accountId = document.getElementById('rec-input-account').value;

  if (!name || !amount) return;

  const newRec = {
    id: 'rec_' + Date.now(),
    name: name,
    amount: amount,
    type: 'expense',
    accountId: accountId,
    dayOfMonth: day,
    icon: '💳'
  };

  if (!state.recurring) state.recurring = [];
  state.recurring.push(newRec);
  saveState();

  e.target.reset();
  window.closeModal('modal-rec');
  renderAll();
  window.showToast(`Подписка «${name}» добавлена!`);
};

window.executeRecurringPayment = function(recId) {
  const rec = (state.recurring || []).find(r => r.id === recId);
  if (!rec) return;

  const newTx = {
    id: 'tx_' + Date.now(),
    type: rec.type,
    amount: rec.amount,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    accountId: rec.accountId,
    categoryId: rec.categoryId,
    note: `[Регулярный] ${rec.name}`
  };

  state.transactions.unshift(newTx);
  saveState();
  renderAll();
  window.showToast(`Проведено: ${rec.name} (₸${formatMoney(rec.amount)})`);
};

// Goals & Limits Modals
window.openAddGoalModal = function() {
  populateSelectAccounts();
  document.getElementById('modal-goal').classList.remove('hidden');
};

window.handleFormAddGoal = function(e) {
  e.preventDefault();
  const title = document.getElementById('goal-input-title').value;
  const amount = Number(document.getElementById('goal-input-amount').value);
  const accId = document.getElementById('goal-input-account').value;

  if (!title || !amount) return;

  const newGoal = {
    id: 'goal_' + Date.now(),
    title: title,
    targetAmount: amount,
    linkedAccounts: [accId],
    icon: '🎯'
  };

  if (!state.goals) state.goals = [];
  state.goals.push(newGoal);
  saveState();

  e.target.reset();
  window.closeModal('modal-goal');
  renderAll();
  window.showToast(`Цель «${title}» создана!`, '🎯');
};

window.openSetLimitsModal = function() {
  document.getElementById('limit-input-total').value = state.limits.monthlyTotalLimit || 250000;
  document.getElementById('modal-limits').classList.remove('hidden');
};

window.handleFormSetLimits = function(e) {
  e.preventDefault();
  const val = Number(document.getElementById('limit-input-total').value);
  if (!val) return;

  state.limits.monthlyTotalLimit = val;
  saveState();

  window.closeModal('modal-limits');
  renderAll();
  window.showToast(`Новый лимит: ₸${formatMoney(val)}`, '⚖️');
};

// BCC Interest
window.triggerAccrueInterest = function(accountId) {
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc) return;

  const balances = getAccountBalances();
  const curBal = balances[accountId] || 0;
  const est = calculateMonthlyInterestAccrual(curBal, acc.nominalRate || 16.7);

  document.getElementById('interest-account-id').value = accountId;
  document.getElementById('input-interest-amount').value = est;
  document.getElementById('modal-interest').classList.remove('hidden');
};

window.handleConfirmAccrueInterest = function(e) {
  e.preventDefault();
  const accId = document.getElementById('interest-account-id').value;
  const amount = Number(document.getElementById('input-interest-amount').value);
  const acc = state.accounts.find(a => a.id === accId);

  if (!amount || !acc) return;

  const newTx = {
    id: 'tx_' + Date.now(),
    type: 'income',
    amount: amount,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    accountId: accId,
    categoryId: 'cat_invest',
    note: `Вознаграждение по депозиту ${acc.name}`
  };

  state.transactions.unshift(newTx);
  saveState();

  window.closeModal('modal-interest');
  renderAll();
  window.showToast(`Начислено +₸${formatMoney(amount)} на ${acc.name}!`, '💰');
};

// -------------------------------------------------------------
// SETTINGS, BACKUP, CSV & CLEAR
// -------------------------------------------------------------
window.openSettingsModal = function() {
  document.getElementById('modal-settings').classList.remove('hidden');
};

window.exportJsonBackup = function() {
  const jsonStr = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aqsha_budget_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast('Резервная копия скачана!', '💾');
};

window.exportCsvOperations = function() {
  const headers = ['Дата', 'Время', 'Тип', 'Сумма (KZT)', 'Счет', 'Категория', 'Заметка'];
  const rows = state.transactions.map(t => {
    const acc = state.accounts.find(a => a.id === t.accountId);
    const cat = state.categories.find(c => c.id === t.categoryId);
    return [
      `"${t.date || ''}"`,
      `"${t.time || ''}"`,
      `"${t.type || ''}"`,
      t.amount || 0,
      `"${acc ? acc.name : ''}"`,
      `"${cat ? cat.name : ''}"`,
      `"${(t.note || '').replace(/"/g, '""')}"`
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aqsha_operations_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast('CSV-отчёт выгружен!', '📊');
};

window.importJsonBackup = function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed && parsed.accounts && parsed.transactions) {
        state = parsed;
        saveState();
        renderAll();
        window.closeModal('modal-settings');
        window.showToast('Резервная копия успешно восстановлена!', '✅');
      } else {
        alert('Некорректный формат файла бэкапа');
      }
    } catch (err) {
      alert('Ошибка при чтении JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
};

window.clearToCleanState = function() {
  if (!confirm('Вы уверены, что хотите очистить все операции и начать вести свой личный учёт с нуля?')) return;

  state.transactions = [];
  state.recurring = [];
  saveState();
  renderAll();
  window.closeModal('modal-settings');
  window.showToast('Все операции очищены. Готово к реальному учёту!', '✨');
};

window.resetToDefaults = function() {
  if (!confirm('Сбросить все данные к исходным демо-данным Казахстана?')) return;
  state = JSON.parse(JSON.stringify(INITIAL_STATE));
  saveState();
  renderAll();
  window.closeModal('modal-settings');
  window.showToast('Демо-данные загружены!', '🔄');
};

// -------------------------------------------------------------
// INITIALIZATION & PWA SERVICE WORKER
// -------------------------------------------------------------
function renderAll() {
  populateSelectAccounts();
  populateSelectCategories();
  renderCapitalWorkspace();
  renderDeposits();
  renderOperationsFeed();
  renderRecurringPayments();
  renderDebts();
  renderPlanWorkspace();
  const txCount = document.getElementById('sidebar-tx-count');
  if (txCount) txCount.innerText = String((state.transactions || []).length);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderAll();
  bindDepositCalculator();

  const transactionTimeInput = document.getElementById('input-tx-time');
  transactionTimeInput?.addEventListener('blur', () => {
    const normalized = normalizeOperationTime(transactionTimeInput.value);
    if (normalized) transactionTimeInput.value = normalized;
  });

  onAuthChanged((user) => {
    updateAuthButton(user);
    updateSyncStatus(user ? 'syncing' : 'local');
  });

  onCloudDataChanged((event) => {
    if (event.type === 'remote-state' && event.data) {
      applyingRemoteState = true;
      state = mergeStates(state, event.data);
      lastPersistedState = JSON.parse(JSON.stringify(state));
      saveStateToIndexedDB(state).catch((err) => console.warn('Не удалось сохранить облачные данные локально:', err));
      applyingRemoteState = false;
      renderAll();
      updateSyncStatus('synced');
    }
    if (event.type === 'missing-remote-state' && storageReady) syncStateToCloud(state, 0);
  });

  onSyncStatusChanged(updateSyncStatus);

  // Start cloud auth only after local data are loaded, so an empty first render
  // cannot overwrite data that already exist in Firebase.
  initializeStateStorage({ normalizeState, initialState: INITIAL_STATE })
    .then((result) => {
      state = normalizeState(result.state);
      lastPersistedState = JSON.parse(JSON.stringify(state));
      storageReady = true;
      renderAll();
      if (result.migrated) {
        window.showToast('Данные перенесены в защищённое локальное хранилище. Старая копия сохранена.', '💾');
      }
    })
    .catch((err) => {
      console.warn('IndexedDB is unavailable:', err);
      window.showToast('Браузер не дал доступ к локальному хранилищу. Проверь настройки сайта.', '⚠️');
    })
    .finally(() => initFirebase());

  window.addEventListener('offline', () => updateSyncStatus('offline'));
  window.addEventListener('online', () => updateSyncStatus('syncing'));
});

renderAll();
