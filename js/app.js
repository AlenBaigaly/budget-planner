/**
 * AQSHA Budget Planner - Production Ready Core Application Logic
 * 100% Opaque Solid 3D Cards, Dynamic Card Management, BCC Deposits, Goals, Limits, PWA & CSV
 */

import {
  BCC_DEPOSIT_TYPES,
  calculateMaturityDate,
  getDaysRemaining,
  calculateDepositForecast,
  calculateMonthlyInterestAccrual
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
  syncStateToCloud
} from './firebase-config.js';

// Keep the established key so the existing planner data is available right
// away after the redesign. The AQSHA key is only a fallback for local drafts.
const STORAGE_KEY = 'budget_planner_state_v1';
const AQSHA_STORAGE_KEY = 'aqsha_budget_state_v2';
let applyingRemoteState = false;

// Authentic styles & solid opaque backgrounds for all bank presets
const CARD_THEMES = {
  kaspi: {
    bgStyle: 'background: linear-gradient(135deg, #9E1B25 0%, #82131C 50%, #5C0A11 100%) !important; background-color: #82131C !important; color: #FFFFFF !important; border: 1px solid #B32733 !important;',
    bankName: '<div class="flex items-center gap-1.5"><div class="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center"><div class="w-1.5 h-1.5 rounded-full bg-[#82131C]"></div></div><span class="font-extrabold text-sm tracking-tight text-white">kaspi.kz</span></div>',
    sub: '<span class="text-xs font-black italic tracking-wider text-white">VISA</span>'
  },
  bcc_iron: {
    bgStyle: 'background: linear-gradient(135deg, #242629 0%, #1A1B1D 50%, #0E0F10 100%) !important; background-color: #1A1B1D !important; color: #FFFFFF !important; border: 1px solid #3E4044 !important;',
    bankName: '<span class="text-emerald-400 font-black text-sm">BCC</span> <span class="text-neutral-400 font-light text-xs">| Банк ЦентрКредит</span>',
    sub: '<span class="text-xs font-black italic tracking-widest text-white">VISA</span><div class="text-[8px] uppercase tracking-widest text-neutral-400 font-semibold -mt-1">Infinite</div>'
  },
  bcc_karta: {
    bgStyle: 'background: linear-gradient(135deg, #1B5E43 0%, #144A34 50%, #0A291C 100%) !important; background-color: #144A34 !important; color: #FFFFFF !important; border: 1px solid #2B7D5C !important;',
    bankName: '<span class="font-black text-emerald-300 text-sm">BCC</span> <span class="text-[11px] text-emerald-100 font-medium">Кредитная</span>',
    sub: '<div class="flex -space-x-2"><div class="w-4 h-4 rounded-full bg-red-500 opacity-90"></div><div class="w-4 h-4 rounded-full bg-amber-400 opacity-90"></div></div>'
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
  ]
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
  normalized.limits = raw.limits || normalized.limits;

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

  return normalized;
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!applyingRemoteState) syncStateToCloud(state);
  } catch (err) {
    console.warn('Error saving state:', err);
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
  const num = Math.round(Number(amount) || 0);
  return num.toLocaleString('ru-RU');
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

    const presetTheme = CARD_THEMES[acc.preset] || CARD_THEMES.kaspi;
    const cardBal = balances[acc.id] || 0;

    return `
      <div id="card-elem-${index}" onclick="selectCard(${index})"
           class="bank-card ${posClass}"
           style="${presetTheme.bgStyle}">

        <div class="flex justify-between items-start">
          <div class="flex items-center gap-1.5">${presetTheme.bankName}</div>
          <div>${presetTheme.sub}</div>
        </div>

        <div class="flex justify-between items-center my-3.5">
          <div class="flex items-center gap-3">
            <div class="emv-chip"></div>
            <svg class="w-5 h-5 text-white/80 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8.5 16.5a5 5 0 0 1 0-9"></path>
              <path d="M12 19a8.5 8.5 0 0 0 0-14"></path>
            </svg>
          </div>
          <div class="text-base font-bold tracking-tight text-white/95 font-mono-card">
            ${acc.name}
          </div>
        </div>

        <div class="mt-2">
          <div class="text-[10px] text-white/70 font-medium uppercase tracking-wider">
            ${acc.isCreditLimit ? 'Кредитный лимит' : 'Баланс карты'}
          </div>
          <div class="text-2xl font-black text-white tracking-tight">₸${formatMoney(cardBal)}</div>
          <div class="flex justify-between items-end mt-1 text-[11px] text-white/80 font-mono-card">
            <span>${acc.maskedNumber || '•••• ****'}</span>
            <span class="text-[9px] uppercase tracking-widest text-white/80">${acc.holderName || 'CARDHOLDER'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  // Update dots & active name
  const cur = cardAccounts[activeBankCardIdx];
  const nameLabel = document.getElementById('active-card-name');
  if (nameLabel && cur) nameLabel.innerText = `${cur.name} (${cur.maskedNumber || ''})`;

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
  previewCard.style = presetTheme.bgStyle;

  document.getElementById('preview-bank-logo').innerHTML = presetTheme.bankName;
  document.getElementById('preview-ps-logo').innerHTML = presetTheme.sub;
  document.getElementById('preview-card-title').innerText = name;
  document.getElementById('preview-balance').innerText = `₸${formatMoney(balance)}`;
  document.getElementById('preview-number').innerText = `•••• ${number.slice(-4)}`;
  document.getElementById('preview-holder').innerText = holder.toUpperCase();
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
  if (!confirm(`Удалить карту «${target.name}» (${target.maskedNumber})?`)) {
    return;
  }

  state.accounts = state.accounts.filter(a => a.id !== target.id);
  activeBankCardIdx = 0;
  saveState();
  renderAll();
  window.showToast(`Карта «${target.name}» удалена`, '🗑️');
};

// -------------------------------------------------------------
// ACCOUNTS & BCC DEPOSITS — available inside the AQSHA workspace
// -------------------------------------------------------------
function nowForTransaction() {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().slice(0, 5),
    createdAt: now.toISOString()
  };
}

function accountLabel(account) {
  return `${account.icon || '💳'} ${account.name}`;
}

window.openAccountsManager = function() {
  renderAccountsManager();
  document.getElementById('modal-accounts').classList.remove('hidden');
};

function renderAccountsManager() {
  const container = document.getElementById('accounts-manager-list');
  if (!container) return;
  const balances = getAccountBalances();
  container.innerHTML = state.accounts.map((account) => {
    const deposit = account.type === 'deposit';
    const typeLabel = deposit ? `Вклад BCC ${account.subType === 'champion' ? '«Чемпион»' : '«Моя цель»'}` : ({ card: 'Банковская карта', cash: 'Наличные', savings: 'Накопительный счёт' }[account.type] || 'Счёт');
    return `<div class="bg-white border border-[#E6E0D4] rounded-2xl p-3 flex items-center justify-between gap-3">
      <div class="min-w-0"><div class="font-bold text-sm text-[#171717] truncate">${accountLabel(account)}</div><div class="text-[11px] text-[#7E7B73]">${typeLabel} · ₸${formatMoney(balances[account.id] || 0)}</div></div>
      <div class="flex gap-2 shrink-0">${deposit ? `<button onclick="openDepositClose('${account.id}')" class="px-2 py-1.5 rounded-lg bg-[#EAE6DC] text-[10px] font-bold">Закрыть</button>` : `<button onclick="openAccountEditor('${account.id}')" class="px-2 py-1.5 rounded-lg bg-[#EAE6DC] text-[10px] font-bold">Настроить</button>`}<button onclick="deleteManagedAccount('${account.id}')" class="px-2 py-1.5 rounded-lg bg-red-50 text-red-700 text-[10px] font-bold">Удалить</button></div>
    </div>`;
  }).join('') || '<div class="text-center py-8 text-xs text-[#7E7B73]">Счетов пока нет</div>';
}

window.openAccountEditor = function(accountId = '') {
  const account = accountId ? state.accounts.find((item) => item.id === accountId) : null;
  if (account?.type === 'deposit') return;
  document.getElementById('account-editor-title').innerText = account ? 'Настройки счёта' : 'Новый счёт';
  document.getElementById('account-edit-id').value = account?.id || '';
  document.getElementById('account-edit-name').value = account?.name || '';
  document.getElementById('account-edit-type').value = account?.type || 'card';
  document.getElementById('account-edit-icon').value = account?.icon || '💳';
  document.getElementById('account-edit-balance').value = account?.initialBalance ?? 0;
  document.getElementById('account-edit-exclude').checked = Boolean(account?.excludeFromTotal);
  document.getElementById('modal-account-editor').classList.remove('hidden');
};

window.handleAccountSave = function(event) {
  event.preventDefault();
  const id = document.getElementById('account-edit-id').value;
  const name = document.getElementById('account-edit-name').value.trim();
  const type = document.getElementById('account-edit-type').value;
  const icon = document.getElementById('account-edit-icon').value.trim() || '💳';
  const initialBalance = Number(document.getElementById('account-edit-balance').value) || 0;
  const excludeFromTotal = document.getElementById('account-edit-exclude').checked;
  if (!name) return;
  if (id) {
    state.accounts = state.accounts.map((account) => account.id === id ? { ...account, name, type, icon, initialBalance, excludeFromTotal } : account);
  } else {
    state.accounts.push({ id: `acc_${Date.now()}`, name, type, icon, currency: '₸', initialBalance, excludeFromTotal });
  }
  saveState(); renderAll(); renderAccountsManager(); window.closeModal('modal-account-editor');
  window.showToast(id ? 'Счёт изменён' : 'Счёт создан', '✓');
};

window.deleteManagedAccount = function(accountId) {
  const account = state.accounts.find((item) => item.id === accountId);
  if (!account || !confirm(`Удалить «${account.name}»? Операции останутся в журнале, но счёт в них будет отмечен как удалённый.`)) return;
  state.accounts = state.accounts.filter((item) => item.id !== accountId);
  state.goals = (state.goals || []).map((goal) => ({ ...goal, linkedAccounts: (goal.linkedAccounts || []).filter((id) => id !== accountId) }));
  saveState(); renderAll(); renderAccountsManager();
  window.showToast(`«${account.name}» удалён`, '🗑️');
};

function getDepositConfig(subType) {
  return subType === 'champion' ? BCC_DEPOSIT_TYPES.CHAMPION : BCC_DEPOSIT_TYPES.MY_GOAL;
}

window.updateDepositTerms = function() {
  const config = getDepositConfig(document.getElementById('deposit-type').value);
  document.getElementById('deposit-term').value = config.defaultTermMonths;
};

window.openDepositEditor = function() {
  const source = document.getElementById('deposit-source');
  const eligible = state.accounts.filter((account) => account.type !== 'deposit');
  source.innerHTML = eligible.map((account) => `<option value="${account.id}">${accountLabel(account)}</option>`).join('');
  if (!eligible.length) { window.showToast('Сначала создай обычный счёт, с которого перевести деньги', '⚠️'); return; }
  document.getElementById('deposit-name').value = 'Новый вклад BCC';
  document.getElementById('deposit-type').value = 'my_goal';
  window.updateDepositTerms();
  document.getElementById('deposit-amount').value = '';
  document.getElementById('modal-deposit-editor').classList.remove('hidden');
};

window.handleDepositSave = function(event) {
  event.preventDefault();
  const sourceId = document.getElementById('deposit-source').value;
  const source = state.accounts.find((account) => account.id === sourceId);
  const amount = Number(document.getElementById('deposit-amount').value);
  const subType = document.getElementById('deposit-type').value;
  const config = getDepositConfig(subType);
  const termMonths = Number(document.getElementById('deposit-term').value) || config.defaultTermMonths;
  const name = document.getElementById('deposit-name').value.trim();
  if (!source || !name || amount <= 0) return;
  const balances = getAccountBalances();
  if ((balances[sourceId] || 0) < amount && !confirm('На выбранном счёте сейчас меньше этой суммы. Всё равно создать перевод?')) return;
  const id = `acc_deposit_${Date.now()}`;
  const startDate = nowForTransaction().date;
  state.accounts.push({ id, name, type: 'deposit', subType, currency: '₸', icon: subType === 'champion' ? '🏆' : '🏦', initialBalance: 0, nominalRate: config.defaultNominalRate, effectiveRate: config.defaultEffectiveRate, termMonths, startDate, endDate: calculateMaturityDate(startDate, termMonths).toISOString().split('T')[0] });
  state.transactions.unshift({ id: `tx_${Date.now()}`, type: 'transfer', amount, accountId: sourceId, toAccountId: id, categoryId: '', note: `Открытие вклада «${name}»`, ...nowForTransaction() });
  saveState(); renderAll(); renderAccountsManager(); window.closeModal('modal-deposit-editor');
  window.showToast('Вклад открыт, деньги переведены с выбранного счёта', '🏦');
};

window.openDepositClose = function(depositId) {
  const deposit = state.accounts.find((account) => account.id === depositId);
  if (!deposit) return;
  const balances = getAccountBalances();
  const targets = state.accounts.filter((account) => account.id !== depositId && account.type !== 'deposit');
  if (!targets.length) { window.showToast('Нужен обычный счёт, куда вернуть деньги', '⚠️'); return; }
  document.getElementById('close-deposit-id').value = depositId;
  document.getElementById('close-deposit-summary').innerText = `На вкладе «${deposit.name}»: ₸${formatMoney(balances[depositId] || 0)}. Выбери счёт для возврата.`;
  document.getElementById('close-deposit-target').innerHTML = targets.map((account) => `<option value="${account.id}">${accountLabel(account)}</option>`).join('');
  document.getElementById('modal-close-deposit').classList.remove('hidden');
};

window.handleDepositClose = function(event) {
  event.preventDefault();
  const depositId = document.getElementById('close-deposit-id').value;
  const targetId = document.getElementById('close-deposit-target').value;
  const deposit = state.accounts.find((account) => account.id === depositId);
  const target = state.accounts.find((account) => account.id === targetId);
  if (!deposit || !target) return;
  const amount = Math.max(0, getAccountBalances()[depositId] || 0);
  if (amount > 0) state.transactions.unshift({ id: `tx_${Date.now()}`, type: 'transfer', amount, accountId: depositId, toAccountId: targetId, categoryId: '', note: `Закрытие вклада «${deposit.name}»`, ...nowForTransaction() });
  state.accounts = state.accounts.filter((account) => account.id !== depositId);
  state.goals = (state.goals || []).map((goal) => ({ ...goal, linkedAccounts: (goal.linkedAccounts || []).filter((id) => id !== depositId) }));
  saveState(); renderAll(); renderAccountsManager(); window.closeModal('modal-close-deposit');
  window.showToast(`Вклад закрыт: ₸${formatMoney(amount)} переведены на «${target.name}»`, '✓');
};

window.openDepositTopUp = function(depositId) {
  const deposit = state.accounts.find((account) => account.id === depositId);
  if (!deposit) return;
  window.openModal('tx', 'transfer');
  const target = document.getElementById('input-tx-to-account');
  if (target) target.value = depositId;
  document.getElementById('input-tx-note').value = `Пополнение вклада «${deposit.name}»`;
  document.getElementById('input-tx-amount').focus();
};

function renderDepositWorkspace() {
  const container = document.getElementById('deposits-workspace-list');
  if (!container) return;
  const balances = getAccountBalances();
  const deposits = state.accounts.filter((account) => account.type === 'deposit');
  if (!deposits.length) {
    container.innerHTML = `<div class="lg:col-span-2 bg-[#FAF9F5] border border-dashed border-[#DFDAD0] rounded-3xl p-10 text-center"><div class="text-4xl mb-3">🏦</div><div class="font-bold text-[#171717]">Нет открытых вкладов</div><p class="text-xs text-[#7E7B73] mt-2">Открой вклад BCC и выбери, с какого счёта перевести деньги.</p><button onclick="openDepositEditor()" class="mt-4 px-4 py-2 bg-[#171717] text-white text-xs font-semibold rounded-full">Открыть вклад</button></div>`;
    return;
  }
  container.innerHTML = deposits.map((deposit) => {
    const balance = balances[deposit.id] || 0;
    const config = getDepositConfig(deposit.subType);
    const endDate = deposit.endDate || calculateMaturityDate(deposit.startDate || new Date().toISOString().split('T')[0], deposit.termMonths || config.defaultTermMonths).toISOString().split('T')[0];
    const days = getDaysRemaining(endDate);
    const monthInterest = calculateMonthlyInterestAccrual(deposit.nominalRate || config.defaultNominalRate, balance);
    const forecast = calculateDepositForecast({ principal: balance, nominalRate: deposit.nominalRate || config.defaultNominalRate, termMonths: Math.max(1, deposit.termMonths || config.defaultTermMonths), startDate: deposit.startDate });
    return `<article class="bg-[#FAF9F5] border border-[#DFDAD0] rounded-3xl p-6 shadow-xs">
      <div class="flex justify-between gap-4"><div><div class="text-[10px] uppercase font-bold tracking-wider text-[#7E7B73]">BCC ${deposit.subType === 'champion' ? '«Чемпион»' : '«Моя цель»'}</div><h2 class="font-bold text-lg text-[#171717] mt-1">${deposit.icon || '🏦'} ${deposit.name}</h2></div><div class="text-right"><div class="text-[10px] text-[#7E7B73]">Текущий остаток</div><div class="font-black text-xl text-[#171717]">₸${formatMoney(balance)}</div></div></div>
      <div class="grid grid-cols-3 gap-2 mt-5 text-xs"><div class="bg-white border border-[#E8E4DA] rounded-xl p-3"><div class="text-[#7E7B73]">Ставка</div><div class="font-bold mt-1">${deposit.nominalRate || config.defaultNominalRate}%</div></div><div class="bg-white border border-[#E8E4DA] rounded-xl p-3"><div class="text-[#7E7B73]">Доход / мес.</div><div class="font-bold mt-1 text-emerald-700">+₸${formatMoney(monthInterest)}</div></div><div class="bg-white border border-[#E8E4DA] rounded-xl p-3"><div class="text-[#7E7B73]">Осталось</div><div class="font-bold mt-1">${days > 0 ? `${days} дн.` : 'Срок вышел'}</div></div></div>
      <div class="mt-4 text-xs text-[#7E7B73]">Прогноз к концу срока: <b class="text-[#171717]">₸${formatMoney(forecast?.finalAmount || balance)}</b> · окончание ${endDate}</div>
      <div class="mt-5 flex flex-wrap gap-2"><button onclick="openDepositTopUp('${deposit.id}')" class="px-3 py-2 bg-[#465948] text-white text-xs font-semibold rounded-xl">+ Пополнить</button><button onclick="openDepositClose('${deposit.id}')" class="px-3 py-2 bg-[#EAE6DC] hover:bg-[#DED8CB] text-xs font-semibold rounded-xl">Закрыть вклад</button></div>
    </article>`;
  }).join('');
}

// -------------------------------------------------------------
// RENDERERS: CAPITAL WORKSPACE
// -------------------------------------------------------------
function renderCapitalWorkspace() {
  const balances = getAccountBalances();

  // Total available capital
  let totalAvailable = 0;
  state.accounts.forEach(acc => {
    if (!acc.isCreditLimit && !acc.excludeFromTotal) {
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
    const est = calculateMonthlyInterestAccrual(goalAcc.nominalRate || 16.7, balances['acc_bcc_goal'] || 0);
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
}

function renderUpcomingCalendar() {
  const container = document.getElementById('upcoming-7d-list');
  if (!container) return;

  const now = new Date();
  const todayDate = now.getDate();
  const next7Days = todayDate + 7;

  const upcoming = (state.recurring || []).filter(rec => {
    const day = Number(rec.dayOfMonth) || 1;
    return day >= todayDate && day <= next7Days;
  });

  const sum7d = upcoming
    .filter(r => r.type === 'expense')
    .reduce((acc, r) => acc + Number(r.amount || 0), 0);

  const sum30d = (state.recurring || [])
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
            <div class="text-[10px] text-[#7E7B73]">${r.dayOfMonth}-е число • ${accName}</div>
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
  const screens = ['capital', 'deposits', 'operations', 'plan'];
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
              <div class="font-bold text-sm text-[#171717]">${tx.note || 'Операция'}</div>
              <div class="text-[11px] text-[#7E7B73]">${tx.time || ''} • ${acc ? acc.name : ''} ${cat ? '• ' + cat.name : ''}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm font-bold ${amountColor}">${sign}₸${formatMoney(tx.amount)}</div>
            <div class="flex justify-end gap-2 mt-1"><button onclick="editTransaction('${tx.id}')" class="text-[10px] text-[#465948] hover:text-black transition">Изменить</button><button onclick="deleteTransaction('${tx.id}')" class="text-[10px] text-neutral-400 hover:text-red-600 transition">Удалить</button></div>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
  });

  container.innerHTML = html;
}

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

window.openModal = function(modalType, subType = 'expense', preselectedAcc = null) {
  if (modalType === 'tx') {
    const form = document.querySelector('#modal-tx form');
    if (form) form.reset();
    document.getElementById('input-tx-id').value = '';
    window.setModalTxType(subType);
    populateSelectAccounts(preselectedAcc);
    populateSelectCategories();
    const now = new Date();
    document.getElementById('input-tx-date').value = now.toISOString().split('T')[0];
    document.getElementById('input-tx-time').value = now.toTimeString().slice(0, 5);
    document.getElementById('modal-tx').classList.remove('hidden');
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
    return `<option value="${acc.id}" ${acc.id === preselectedId ? 'selected' : ''}>${acc.name} (${acc.maskedNumber || acc.currency})</option>`;
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
  const button = document.getElementById('btn-google-auth');
  if (!button) return;
  button.innerText = user ? `Выйти: ${user.displayName || user.email || 'Google'}` : 'Войти через Google';
}

window.toggleGoogleAuth = async function() {
  try {
    const button = document.getElementById('btn-google-auth');
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
  const existingId = document.getElementById('input-tx-id').value;
  const date = document.getElementById('input-tx-date').value;
  const time = document.getElementById('input-tx-time').value;

  if (!amount || !note) return;

  const existing = existingId ? state.transactions.find((tx) => tx.id === existingId) : null;
  const newTx = {
    id: existingId || 'tx_' + Date.now(),
    type: currentModalTxType,
    amount: amount,
    date: date,
    time: time,
    accountId: accountId,
    toAccountId: currentModalTxType === 'transfer' ? toAccountId : '',
    categoryId: currentModalTxType !== 'transfer' ? categoryId : '',
    note: note,
    createdAt: existing?.createdAt || new Date().toISOString()
  };

  if (existing) state.transactions = state.transactions.map((tx) => tx.id === existingId ? newTx : tx);
  else state.transactions.unshift(newTx);
  saveState();

  e.target.reset();
  window.closeModal('modal-tx');
  renderAll();
  window.showToast(existing ? 'Операция изменена' : `Операция на ₸${formatMoney(amount)} записана!`);
};

window.editTransaction = function(txId) {
  const tx = state.transactions.find((item) => item.id === txId);
  if (!tx) return;
  currentModalTxType = tx.type;
  populateSelectAccounts(tx.accountId);
  window.setModalTxType(tx.type);
  document.getElementById('input-tx-id').value = tx.id;
  document.getElementById('input-tx-amount').value = tx.amount;
  document.getElementById('input-tx-note').value = tx.note || '';
  document.getElementById('input-tx-date').value = tx.date || new Date().toISOString().split('T')[0];
  document.getElementById('input-tx-time').value = (tx.time || '00:00').slice(0, 5);
  document.getElementById('input-tx-account').value = tx.accountId || '';
  if (tx.type === 'transfer') document.getElementById('input-tx-to-account').value = tx.toAccountId || '';
  else document.getElementById('input-tx-category').value = tx.categoryId || '';
  document.getElementById('modal-tx').classList.remove('hidden');
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
  renderDepositWorkspace();
  renderOperationsFeed();
  renderRecurringPayments();
  renderPlanWorkspace();
  const txCount = document.getElementById('sidebar-tx-count');
  if (txCount) txCount.innerText = String((state.transactions || []).length);
  const depositCount = document.getElementById('sidebar-deposit-count');
  if (depositCount) depositCount.innerText = String(state.accounts.filter((account) => account.type === 'deposit').length);
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

  onAuthChanged((user) => {
    const button = document.getElementById('btn-google-auth');
    if (button) button.dataset.signedIn = user ? 'true' : 'false';
    updateAuthButton(user);
  });

  onCloudDataChanged((event) => {
    if (event.type === 'remote-state' && event.data) {
      applyingRemoteState = true;
      state = normalizeState(event.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      applyingRemoteState = false;
      renderAll();
    }
    if (event.type === 'missing-remote-state') syncStateToCloud(state, 0);
  });

  initFirebase();
});

renderAll();
