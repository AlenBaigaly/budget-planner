/**
 * Budget Planner - Core Application Logic
 * Disciplined Personal Finance Management for Kazakhstan
 */

import {
  BCC_DEPOSIT_TYPES,
  calculateMaturityDate,
  getDaysRemaining,
  calculateDepositForecast,
  validateDepositWithdrawal,
  calculateMonthlyInterestAccrual,
  calculateNextPayoutDate
} from './bcc-deposits.js?v=24';

import {
  drawPixelPieChart,
  drawPixelBarChart,
  calculateMonthComparison,
  MODERN_PALETTE
} from './analytics.js?v=24';

import {
  initFirebase,
  loginWithGoogle,
  logoutUser,
  getCurrentUser,
  onAuthChanged,
  onCloudDataChanged,
  syncStateToCloud,
  getSavedFirebaseConfig,
  saveFirebaseConfig,
  clearFirebaseConfig,
  parseFirebaseConfigInput
} from './firebase-config.js?v=24';

// Realistic default state for personal finance in Kazakhstan
const DEFAULT_STATE = {
  accounts: [
    {
      id: 'acc_cash',
      name: 'Наличные',
      type: 'cash',
      currency: '₸',
      initialBalance: 45000,
      excludeFromTotal: false,
      icon: '💵'
    },
    {
      id: 'acc_card_kaspi',
      name: 'Kaspi Gold',
      type: 'card',
      currency: '₸',
      initialBalance: 185000,
      excludeFromTotal: false,
      icon: '💳'
    },
    {
      id: 'acc_bcc_goal',
      name: 'BCC «Моя цель»',
      type: 'deposit',
      isBCC: true,
      subType: 'my_goal',
      currency: '₸',
      initialBalance: 300000,
      excludeFromTotal: false,
      icon: '🏦',
      nominalRate: 16.7,
      effectiveRate: 18.06,
      termMonths: 3,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      monthlyTopUp: 50000
    },
    {
      id: 'acc_bcc_champ',
      name: 'BCC «Чемпион»',
      type: 'deposit',
      isBCC: true,
      subType: 'champion',
      currency: '₸',
      initialBalance: 500000,
      excludeFromTotal: false,
      icon: '🏆',
      nominalRate: 14.2,
      effectiveRate: 15.17,
      termMonths: 6,
      startDate: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      monthlyTopUp: 20000,
      minBalance: 1000
    }
  ],
  categories: [
    { id: 'cat_food', name: 'Еда и продукты', icon: '🛒', color: '#f59e0b', type: 'expense' },
    { id: 'cat_transport', name: 'Транспорт', icon: '🚕', color: '#3b82f6', type: 'expense' },
    { id: 'cat_home', name: 'Аренда и ЖКХ', icon: '🏠', color: '#f97316', type: 'expense' },
    { id: 'cat_shopping', name: 'Покупки', icon: '🛍️', color: '#ec4899', type: 'expense' },
    { id: 'cat_leisure', name: 'Отдых и подписки', icon: '🎬', color: '#8b5cf6', type: 'expense' },
    { id: 'cat_salary', name: 'Зарплата', icon: '💼', color: '#10b981', type: 'income' },
    { id: 'cat_stipend', name: 'Стипендия', icon: '🎓', color: '#06b6d4', type: 'income' },
    { id: 'cat_freelance', name: 'Подработка', icon: '💻', color: '#14b8a6', type: 'income' },
    { id: 'cat_invest', name: 'Вознаграждение по депозитам', icon: '📈', color: '#f59e0b', type: 'income' },
    { id: 'cat_other', name: 'Прочее', icon: '📦', color: '#64748b', type: 'expense' }
  ],
  limits: {
    monthlyTotalLimit: 250000,
    categoryLimits: {
      cat_food: 70000,
      cat_transport: 25000,
      cat_home: 50000,
      cat_shopping: 40000,
      cat_leisure: 25000
    }
  },
  transactions: [
    {
      id: 'tx_1',
      type: 'income',
      amount: 450000,
      date: new Date().toISOString().split('T')[0],
      accountId: 'acc_card_kaspi',
      categoryId: 'cat_salary',
      note: 'Основная зарплата',
      status: 'confirmed',
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx_2',
      type: 'expense',
      amount: 32500,
      date: new Date().toISOString().split('T')[0],
      accountId: 'acc_card_kaspi',
      categoryId: 'cat_food',
      note: 'Супермаркет Magnum',
      status: 'confirmed',
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx_3',
      type: 'expense',
      amount: 4500,
      date: new Date().toISOString().split('T')[0],
      accountId: 'acc_cash',
      categoryId: 'cat_transport',
      note: 'Яндекс Такси',
      status: 'confirmed',
      createdAt: new Date().toISOString()
    },
    {
      id: 'tx_4',
      type: 'transfer',
      amount: 50000,
      date: new Date().toISOString().split('T')[0],
      accountId: 'acc_card_kaspi',
      toAccountId: 'acc_bcc_goal',
      categoryId: '',
      note: 'Пополнение депозита «Моя цель»',
      status: 'confirmed',
      createdAt: new Date().toISOString()
    }
  ],
  recurring: [
    {
      id: 'rec_1',
      name: 'Основная зарплата',
      amount: 450000,
      type: 'income',
      accountId: 'acc_card_kaspi',
      categoryId: 'cat_salary',
      period: 'monthly',
      dayOfMonth: 10,
      status: 'active'
    },
    {
      id: 'rec_2',
      name: 'Аренда жилья',
      amount: 150000,
      type: 'expense',
      accountId: 'acc_card_kaspi',
      categoryId: 'cat_home',
      period: 'monthly',
      dayOfMonth: 5,
      status: 'active'
    },
    {
      id: 'rec_3',
      name: 'Подписка Яндекс Плюс',
      amount: 1499,
      type: 'expense',
      accountId: 'acc_card_kaspi',
      categoryId: 'cat_leisure',
      period: 'monthly',
      dayOfMonth: 18,
      status: 'active'
    }
  ],
  goals: [
    {
      id: 'goal_1',
      title: 'Ноутбук для работы',
      targetAmount: 500000,
      currentAmount: 0,
      linkedAccountIds: ['acc_bcc_goal'],
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: 'Новый рабочий ноутбук'
    },
    {
      id: 'goal_2',
      title: 'Подушка безопасности',
      targetAmount: 1000000,
      currentAmount: 0,
      linkedAccountIds: ['acc_bcc_champ', 'acc_cash'],
      deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: 'Неприкосновенный резервный фонд'
    }
  ],
  activityLog: [
    {
      id: 'act_init',
      timestamp: new Date().toISOString(),
      text: 'Инициализация приложения Budget Planner',
      type: 'info'
    }
  ],
  settings: {
    currency: '₸',
    activeTab: 'dashboard',
    periodView: 'month',
    selectedYear: new Date().getFullYear(),
    selectedMonth: new Date().getMonth() + 1
  }
};

const STORAGE_KEY = 'budget_planner_state_v1';

function compareTransactionsNewest(first, second) {
  const dateComparison = String(second.date || '').localeCompare(String(first.date || ''));
  if (dateComparison !== 0) return dateComparison;
  return String(second.createdAt || second.id || '').localeCompare(String(first.createdAt || first.id || ''));
}

function formatTransactionTime(transaction) {
  if (!transaction.createdAt) return '';

  const createdAt = new Date(transaction.createdAt);
  if (Number.isNaN(createdAt.getTime())) return '';

  return createdAt.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTransactionMeta(transaction, accountLabel) {
  return [transaction.date, formatTransactionTime(transaction), accountLabel]
    .filter(Boolean)
    .join(' • ');
}

class BudgetApp {
  constructor() {
    this.state = this.loadState();
    this.editingTxId = null;
    this.editingAccountId = null;
    this.editingGoalId = null;
    this.editingRecurringId = null;
    this.pendingConfirmAction = null;
    this.init();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('gemini_budget_pixel_v1_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_STATE,
          ...parsed,
          recurring: parsed.recurring || DEFAULT_STATE.recurring,
          activityLog: parsed.activityLog || DEFAULT_STATE.activityLog
        };
      }
    } catch (e) {
      console.warn('Failed to parse saved state:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      syncStateToCloud(this.state);
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }

  logActivity(text, type = 'info') {
    const entry = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      text,
      type
    };
    if (!this.state.activityLog) this.state.activityLog = [];
    this.state.activityLog.unshift(entry);
    // Keep last 150 events
    if (this.state.activityLog.length > 150) {
      this.state.activityLog = this.state.activityLog.slice(0, 150);
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `pixel-toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  confirmAction(title, desc, onConfirm) {
    const modal = document.getElementById('modal-confirm-action');
    const titleEl = document.getElementById('modal-confirm-title');
    const descEl = document.getElementById('modal-confirm-desc');
    const btnOk = document.getElementById('btn-confirm-proceed');

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;

    btnOk.onclick = () => {
      modal.classList.remove('active');
      if (typeof onConfirm === 'function') onConfirm();
    };

    modal.classList.add('active');
  }

  // Account Balance Computation
  calculateAccountBalance(accountId) {
    const acc = this.state.accounts.find((a) => a.id === accountId);
    if (!acc) return 0;

    let balance = Number(acc.initialBalance) || 0;

    this.state.transactions.forEach((tx) => {
      // Only confirmed transactions alter account balance
      if (tx.status === 'planned') return;

      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income' && tx.accountId === accountId) {
        balance += amt;
      } else if (tx.type === 'expense' && tx.accountId === accountId) {
        balance -= amt;
      } else if (tx.type === 'transfer') {
        if (tx.accountId === accountId) {
          balance -= amt;
        }
        if (tx.toAccountId === accountId) {
          balance += amt;
        }
      }
    });

    return balance;
  }

  getTotalBalance() {
    return this.state.accounts
      .filter((a) => !a.excludeFromTotal)
      .reduce((sum, a) => sum + this.calculateAccountBalance(a.id), 0);
  }

  getFilteredTransactions(periodOverride = null) {
    const view = periodOverride?.view || this.state.settings.periodView;
    const year = periodOverride?.year || this.state.settings.selectedYear;
    const month = periodOverride?.month || this.state.settings.selectedMonth;

    return this.state.transactions.filter((tx) => {
      if (!tx.date) return false;
      const [txY, txM] = tx.date.split('-').map(Number);
      if (view === 'year') {
        return txY === year;
      }
      return txY === year && txM === month;
    });
  }

  validateDepositDebit(accountId, amount) {
    const account = this.state.accounts.find((item) => item.id === accountId);
    if (!account || account.type !== 'deposit' || !account.isBCC) {
      return { allowed: true };
    }

    return validateDepositWithdrawal(
      account,
      amount,
      this.calculateAccountBalance(account.id)
    );
  }

  getNextMonthlyDate(dayOfMonth, referenceDate = new Date()) {
    const requestedDay = Math.max(1, Math.min(31, Number(dayOfMonth) || 1));
    const today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);

    const inMonth = (year, month) => {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(requestedDay, lastDay));
    };

    let nextDate = inMonth(today.getFullYear(), today.getMonth());
    if (nextDate < today) {
      nextDate = inMonth(today.getFullYear(), today.getMonth() + 1);
    }
    return nextDate;
  }

  init() {
    this.bindEvents();
    this.setupFirebaseListeners();
    this.render();
  }

  async setupFirebaseListeners() {
    onAuthChanged((user) => {
      this.updateAuthUI(user);
    });

    onCloudDataChanged((event) => {
      if (event?.type === 'remote-state' && event.data?.transactions) {
        // Do not call saveState: writing an incoming Firestore snapshot back
        // to Firestore creates an endless sync echo between devices.
        const { lastUpdated, ...cloudState } = event.data;
        this.state = {
          ...DEFAULT_STATE,
          ...cloudState,
          recurring: cloudState.recurring || [],
          activityLog: cloudState.activityLog || []
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        this.render();
        this.showToast('Данные синхронизированы из облака', 'success');
      } else if (event?.type === 'missing-remote-state') {
        // First sign-in: create the user's initial cloud backup.
        syncStateToCloud(this.state, 0);
      }
    });

    const cfg = getSavedFirebaseConfig();
    if (cfg) {
      try {
        await initFirebase(cfg);
      } catch (e) {
        console.log('Firebase offline mode active');
      }
    }
  }

  updateAuthUI(user) {
    const authBtn = document.getElementById('btn-google-auth');
    const authStatus = document.getElementById('user-auth-status');
    if (!authBtn || !authStatus) return;

    if (user) {
      authBtn.textContent = 'Выйти';
      authBtn.className = 'pixel-btn pixel-btn-red pixel-btn-sm';
      authStatus.innerHTML = `<span style="color:var(--accent-green)">●</span> ${user.displayName || user.email}`;
    } else {
      authBtn.textContent = 'Google Вход';
      authBtn.className = 'pixel-btn pixel-btn-cyan pixel-btn-sm';
      authStatus.innerHTML = '<span style="color:var(--text-dim)">Локально (оффлайн)</span>';
    }
  }

  bindEvents() {
    // Navigation Tabs (Desktop & Mobile)
    document.querySelectorAll('.nav-link, .mobile-nav-btn, .more-nav-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = btn.dataset.tab;
        const subtab = btn.dataset.subtab;
        if (tab === 'more') {
          document.getElementById('more-sheet')?.classList.add('active');
          return;
        }
        if (tab) {
          document.getElementById('more-sheet')?.classList.remove('active');
          this.switchTab(tab);
          if (tab === 'planning' && subtab) {
            this.switchPlanningSubTab(subtab);
          }
        }
      });
    });

    // Sub-tab switcher in Planning tab
    document.querySelectorAll('.sub-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sub = btn.dataset.subtab;
        if (sub) this.switchPlanningSubTab(sub);
      });
    });

    // Close More Sheet on outside click
    document.getElementById('more-sheet')?.addEventListener('click', (e) => {
      if (e.target.id === 'more-sheet') {
        e.target.classList.remove('active');
      }
    });

    // Period switcher
    document.getElementById('btn-period-prev')?.addEventListener('click', () => this.shiftPeriod(-1));
    document.getElementById('btn-period-next')?.addEventListener('click', () => this.shiftPeriod(1));
    document.getElementById('btn-period-toggle')?.addEventListener('click', () => this.togglePeriodView());

    // Google Auth
    document.getElementById('btn-google-auth')?.addEventListener('click', async () => {
      const user = getCurrentUser();
      if (user) {
        this.confirmAction('Выход из аккаунта', 'Вы уверены, что хотите выйти из Google аккаунта?', async () => {
          await logoutUser();
          this.showToast('Вы вышли из системы', 'info');
        });
      } else {
        const cfg = getSavedFirebaseConfig();
        if (!cfg) {
          this.openModal('modal-firebase-settings');
        } else {
          try {
            await loginWithGoogle();
            this.showToast('Успешный вход через Google', 'success');
          } catch (err) {
            this.showToast(`Ошибка входа: ${err.message}`, 'error');
          }
        }
      }
    });

    // Modals close buttons
    document.querySelectorAll('.modal-close, [data-modal-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const overlay = btn.closest('.modal-overlay');
        if (overlay) overlay.classList.remove('active');
      });
    });

    document.querySelectorAll('.modal-overlay').forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    });

    // Quick Action Buttons
    document.getElementById('btn-quick-add-tx')?.addEventListener('click', () => {
      this.openTransactionModal();
    });

    document.getElementById('btn-quick-add-acc')?.addEventListener('click', () => {
      this.openAccountModal();
    });

    document.getElementById('btn-quick-add-rec')?.addEventListener('click', () => {
      this.openRecurringModal();
    });

    // Bind all forms
    this.bindTransactionForm();
    this.bindAccountForm();
    this.bindGoalForm();
    this.bindLimitsForm();
    this.bindCategoryForm();
    this.bindRecurringForm();
    this.bindDepositInterestForm();
    this.bindSettingsForm();
    this.bindBackupRestore();
  }

  shiftPeriod(direction) {
    if (this.state.settings.periodView === 'month') {
      let m = this.state.settings.selectedMonth + direction;
      let y = this.state.settings.selectedYear;
      if (m > 12) {
        m = 1;
        y += 1;
      } else if (m < 1) {
        m = 12;
        y -= 1;
      }
      this.state.settings.selectedMonth = m;
      this.state.settings.selectedYear = y;
    } else {
      this.state.settings.selectedYear += direction;
    }
    this.saveState();
    this.render();
  }

  togglePeriodView() {
    this.state.settings.periodView = this.state.settings.periodView === 'month' ? 'year' : 'month';
    this.saveState();
    this.render();
  }

  switchTab(tabId) {
    this.state.settings.activeTab = tabId;

    // Desktop nav
    document.querySelectorAll('.desktop-nav .nav-link').forEach((btn) => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Mobile nav (5 items)
    document.querySelectorAll('.mobile-nav .mobile-nav-btn').forEach((btn) => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('active');
      } else if (btn.dataset.tab !== 'more') {
        btn.classList.remove('active');
      }
    });

    // Sections
    document.querySelectorAll('.tab-content').forEach((section) => {
      if (section.id === `tab-${tabId}`) {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.renderTabContent(tabId);
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  // --- RENDERING ---
  render() {
    this.renderPeriodHeader();
    this.renderDashboard();
    this.renderTabContent(this.state.settings.activeTab);
  }

  renderPeriodHeader() {
    const label = document.getElementById('current-period-label');
    const toggleBtn = document.getElementById('btn-period-toggle');
    if (!label) return;

    const monthNames = [
      'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
    ];

    if (this.state.settings.periodView === 'month') {
      label.textContent = `${monthNames[this.state.settings.selectedMonth - 1]} ${this.state.settings.selectedYear}`;
      if (toggleBtn) toggleBtn.textContent = 'Месяц';
    } else {
      label.textContent = `${this.state.settings.selectedYear} год`;
      if (toggleBtn) toggleBtn.textContent = 'Год';
    }
  }

  renderTabContent(tabId) {
    switch (tabId) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'transactions':
        this.renderTransactionsList();
        break;
      case 'accounts':
        this.renderAccountsTab();
        break;
      case 'budget':
        this.renderBudgetLimitsTab();
        break;
      case 'deposits':
        this.renderDepositsTab();
        break;
      case 'goals':
        this.renderGoalsTab();
        break;
      case 'planning':
      case 'recurring':
      case 'calendar':
      case 'activity':
        this.renderPlanningTab();
        if (tabId !== 'planning') {
          this.switchPlanningSubTab(tabId);
        }
        break;
      case 'analytics':
        this.renderAnalyticsTab();
        break;
      case 'settings':
        this.renderSettingsTab();
        break;
    }
  }

  switchPlanningSubTab(subTabName) {
    this.currentPlanningSubTab = subTabName;
    document.querySelectorAll('.sub-tab-btn').forEach((b) => {
      if (b.dataset.subtab === subTabName) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    document.querySelectorAll('.planning-subview').forEach((view) => {
      if (view.id === `subtab-view-${subTabName}`) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    });

    if (subTabName === 'calendar') this.renderCalendarTab();
    else if (subTabName === 'recurring') this.renderRecurringTab();
    else if (subTabName === 'activity') this.renderActivityTab();
  }

  renderPlanningTab() {
    this.switchPlanningSubTab(this.currentPlanningSubTab || 'calendar');
  }

  // 1. DASHBOARD
  renderDashboard() {
    const txs = this.getFilteredTransactions();

    const income = txs
      .filter((t) => t.type === 'income' && t.status !== 'planned')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const expense = txs
      .filter((t) => t.type === 'expense' && t.status !== 'planned')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const plannedExpense = txs
      .filter((t) => t.type === 'expense' && t.status === 'planned')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const netRemaining = income - expense;
    const totalNetWorth = this.getTotalBalance();

    // Calculate Safe-to-Spend / Free cash until end of month:
    // Net remaining minus mandatory future obligations for the rest of this month
    const curDay = new Date().getDate();
    let pendingFutureObligations = 0;
    (this.state.recurring || []).filter((r) => r.status === 'active' && r.type === 'expense').forEach((r) => {
      if (r.dayOfMonth >= curDay) {
        pendingFutureObligations += Number(r.amount);
      }
    });
    txs.filter((t) => t.type === 'expense' && t.status === 'planned').forEach((t) => {
      const d = Number((t.date || '').split('-')[2]) || curDay;
      if (d >= curDay) {
        pendingFutureObligations += Number(t.amount);
      }
    });

    const freeToSpend = netRemaining - pendingFutureObligations;

    // Summary Cards
    const elIncome = document.getElementById('dash-income');
    const elExpense = document.getElementById('dash-expense');
    const elRemaining = document.getElementById('dash-remaining');
    const elFree = document.getElementById('dash-free-to-spend');
    const elFreeSub = document.getElementById('dash-free-sub');
    const elNetWorth = document.getElementById('dash-networth');

    if (elIncome) elIncome.textContent = `+${income.toLocaleString('ru-RU')} ₸`;
    if (elExpense) elExpense.textContent = `-${expense.toLocaleString('ru-RU')} ₸`;
    if (elRemaining) {
      elRemaining.textContent = `${netRemaining >= 0 ? '+' : ''}${netRemaining.toLocaleString('ru-RU')} ₸`;
      elRemaining.style.color = netRemaining >= 0 ? 'var(--accent-amber)' : 'var(--accent-red)';
    }
    if (elFree) {
      elFree.textContent = `${freeToSpend >= 0 ? '+' : ''}${freeToSpend.toLocaleString('ru-RU')} ₸`;
      elFree.style.color = freeToSpend >= 0 ? '#38bdf8' : 'var(--accent-red)';
    }
    if (elFreeSub) {
      elFreeSub.textContent = `Обязательства: ${pendingFutureObligations.toLocaleString('ru-RU')} ₸`;
    }
    if (elNetWorth) elNetWorth.textContent = `${totalNetWorth.toLocaleString('ru-RU')} ₸`;

    // Alerts
    this.renderAlerts(expense);

    // Accounts Overview, Allocation & Recent Transactions
    this.renderDashboardAccounts();
    this.renderDashboardAllocation();
    this.renderDashboardRecentTxs();

    // Goals Preview
    this.renderDashboardGoals();

    // Upcoming Payments strip
    this.renderDashboardUpcomingPayments();
  }

  renderDashboardAllocation() {
    const bar = document.getElementById('dash-accounts-allocation');
    const legend = document.getElementById('dash-allocation-legend');
    if (!bar || !legend) return;

    let cashSum = 0;
    let cardSum = 0;
    let depositSum = 0;

    this.state.accounts.forEach((acc) => {
      if (acc.excludeFromTotal) return;
      const bal = this.calculateAccountBalance(acc.id);
      if (acc.type === 'cash') cashSum += Math.max(0, bal);
      else if (acc.type === 'card' || acc.type === 'savings') cardSum += Math.max(0, bal);
      else if (acc.type === 'deposit') depositSum += Math.max(0, bal);
    });

    const total = cashSum + cardSum + depositSum;
    if (total <= 0) {
      bar.innerHTML = '<div class="allocation-segment" style="width: 100%; background: var(--border-color);"></div>';
      legend.innerHTML = '<span>Нет средств на активных счетах</span>';
      return;
    }

    const pctCash = Math.round((cashSum / total) * 100);
    const pctCard = Math.round((cardSum / total) * 100);
    const pctDeposit = Math.max(0, 100 - pctCash - pctCard);

    bar.innerHTML = `
      <div class="allocation-segment" style="width: ${pctCash}%; background: #10b981;" title="Наличные: ${pctCash}%"></div>
      <div class="allocation-segment" style="width: ${pctCard}%; background: #3b82f6;" title="Карты: ${pctCard}%"></div>
      <div class="allocation-segment" style="width: ${pctDeposit}%; background: #f59e0b;" title="Депозиты BCC: ${pctDeposit}%"></div>
    `;

    legend.innerHTML = `
      <div class="allocation-legend-item"><span class="allocation-dot" style="background:#10b981;"></span> Наличные: <strong>${pctCash}%</strong> (${cashSum.toLocaleString('ru-RU')} ₸)</div>
      <div class="allocation-legend-item"><span class="allocation-dot" style="background:#3b82f6;"></span> Карты: <strong>${pctCard}%</strong> (${cardSum.toLocaleString('ru-RU')} ₸)</div>
      <div class="allocation-legend-item"><span class="allocation-dot" style="background:#f59e0b;"></span> Депозиты BCC: <strong>${pctDeposit}%</strong> (${depositSum.toLocaleString('ru-RU')} ₸)</div>
    `;
  }

  renderDashboardRecentTxs() {
    const container = document.getElementById('dash-recent-transactions');
    if (!container) return;

    const recent = [...this.state.transactions]
      .sort(compareTransactionsNewest)
      .slice(0, 4);

    if (recent.length === 0) {
      container.innerHTML = '<div class="text-dim text-center" style="padding:10px;">Нет недавних операций</div>';
      return;
    }

    container.innerHTML = recent.map((tx) => {
      const cat = this.state.categories.find((c) => c.id === tx.categoryId);
      const acc = this.state.accounts.find((a) => a.id === tx.accountId);
      const isIncome = tx.type === 'income';
      const isTransfer = tx.type === 'transfer';

      let sign = isIncome ? '+' : isTransfer ? '⇄' : '-';
      let colorClass = isIncome ? 'income' : isTransfer ? 'transfer' : 'expense';

      return `
        <div class="tx-item" style="padding: 7px 10px;">
          <div class="tx-left">
            <span style="font-size: 16px;">${cat?.icon || (isTransfer ? '🔁' : '💵')}</span>
            <div class="tx-details">
              <span class="tx-title" style="font-size: 12px;">${tx.note || cat?.name || (isTransfer ? 'Перевод' : 'Операция')}</span>
              <span class="tx-meta" style="font-size: 10px;">${formatTransactionMeta(tx, acc?.name || 'Счёт')}</span>
            </div>
          </div>
          <div class="tx-amount ${colorClass}" style="font-size: 13px;">${sign}${Number(tx.amount).toLocaleString('ru-RU')} ₸</div>
        </div>
      `;
    }).join('');
  }

  renderAlerts(currentExpense) {
    const container = document.getElementById('dash-alerts-container');
    if (!container) return;

    const alerts = [];

    // Total monthly limit check
    const totalLimit = Number(this.state.limits.monthlyTotalLimit) || 0;
    if (totalLimit > 0 && currentExpense > totalLimit) {
      const diff = currentExpense - totalLimit;
      alerts.push({
        type: 'danger',
        icon: '⚠️',
        title: 'Превышен общий лимит расходов',
        desc: `Лимит ${totalLimit.toLocaleString('ru-RU')} ₸ превышен на ${diff.toLocaleString('ru-RU')} ₸`
      });
    }

    // Category limits
    const txs = this.getFilteredTransactions();
    const catExpenses = {};
    txs.filter((t) => t.type === 'expense' && t.status !== 'planned').forEach((t) => {
      catExpenses[t.categoryId] = (catExpenses[t.categoryId] || 0) + Number(t.amount);
    });

    Object.entries(this.state.limits.categoryLimits || {}).forEach(([catId, limit]) => {
      const spent = catExpenses[catId] || 0;
      if (limit > 0 && spent > limit) {
        const cat = this.state.categories.find((c) => c.id === catId);
        alerts.push({
          type: 'danger',
          icon: '🛑',
          title: `Лимит превышен: ${cat?.name || 'Категория'}`,
          desc: `Потрачено ${spent.toLocaleString('ru-RU')} ₸ из лимита ${limit.toLocaleString('ru-RU')} ₸`
        });
      }
    });

    // Deposit maturity alerts
    this.state.accounts.filter((a) => a.type === 'deposit' && a.startDate && a.termMonths).forEach((dep) => {
      const maturity = calculateMaturityDate(dep.startDate, dep.termMonths);
      const daysLeft = getDaysRemaining(maturity.toISOString().split('T')[0]);
      if (daysLeft >= 0 && daysLeft <= 14) {
        alerts.push({
          type: 'warning',
          icon: '⏳',
          title: `Окончание депозита: ${dep.name}`,
          desc: `Вклад завершится через ${daysLeft} ${this.declOfNum(daysLeft, ['день', 'дня', 'дней'])} (${maturity.toLocaleDateString('ru-RU')})`
        });
      } else if (daysLeft < 0) {
        alerts.push({
          type: 'info',
          icon: '🔔',
          title: `Срок депозита завершён: ${dep.name}`,
          desc: `Вклад подошёл к концу срока. Рекомендуется переоформить или пролонгировать в BCC.`
        });
      }
    });

    if (alerts.length === 0) {
      container.innerHTML = '';
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');
    container.innerHTML = alerts.map((a) => `
      <div class="pixel-alert ${a.type}">
        <span class="alert-icon">${a.icon}</span>
        <div class="alert-content">
          <div class="alert-title">${a.title}</div>
          <div>${a.desc}</div>
        </div>
      </div>
    `).join('');
  }

  declOfNum(n, titles) {
    return titles[(n % 100 > 4 && n % 100 < 20) ? 2 : [2, 0, 1, 1, 1, 2][(n % 10 < 5) ? Math.abs(n) % 10 : 5]];
  }

  renderDashboardAccounts() {
    const container = document.getElementById('dash-accounts-list');
    if (!container) return;

    if (this.state.accounts.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">💳</div>
          <div class="empty-state-title">Нет добавленных счетов</div>
          <div class="empty-state-desc">Создайте наличные, карту Kaspi или вклад BCC, чтобы вести учёт денег.</div>
          <button class="pixel-btn pixel-btn-amber pixel-btn-sm" onclick="app.openAccountModal()">+ Создать первый счёт</button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.state.accounts.map((acc) => {
      const balance = this.calculateAccountBalance(acc.id);
      const typeLabel = {
        cash: 'Наличные',
        card: 'Банковская карта',
        savings: 'Накопительный',
        deposit: acc.isBCC ? 'BCC Депозит' : 'Депозит'
      }[acc.type] || 'Счёт';

      return `
        <div class="account-pill ${acc.excludeFromTotal ? 'excluded' : ''}" data-acc-id="${acc.id}">
          <div class="account-info">
            <span class="account-icon">${acc.icon || '💰'}</span>
            <div>
              <div class="account-name">${acc.name}</div>
              <div class="account-type-tag">${typeLabel} ${acc.excludeFromTotal ? '(вне баланса)' : ''}</div>
            </div>
          </div>
          <div class="account-balance">
            ${balance.toLocaleString('ru-RU')} ₸
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.account-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        this.openAccountHistoryModal(pill.dataset.accId);
      });
    });
  }

  renderDashboardGoals() {
    const container = document.getElementById('dash-goals-list');
    if (!container) return;

    if (this.state.goals.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">🎯</div>
          <div class="empty-state-title">Нет активных целей</div>
          <div class="empty-state-desc">Установите финансовую цель — например, «Ноутбук» или «Отпуск».</div>
          <button class="pixel-btn pixel-btn-amber pixel-btn-sm" onclick="app.openGoalModal()">+ Поставить цель</button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.state.goals.slice(0, 3).map((goal) => {
      let current = Number(goal.currentAmount) || 0;
      if (goal.linkedAccountIds && goal.linkedAccountIds.length > 0) {
        current = goal.linkedAccountIds.reduce((sum, accId) => sum + this.calculateAccountBalance(accId), 0);
      }
      const target = Number(goal.targetAmount) || 1;
      const pct = Math.min(100, Math.round((current / target) * 100));
      const remaining = Math.max(0, target - current);

      return `
        <div style="margin-bottom: 12px;">
          <div class="d-flex justify-between" style="font-size: 13px; margin-bottom: 4px;">
            <span style="font-weight: 600; color: #fff;">${goal.title}</span>
            <span class="amount-mono" style="font-weight: 700; color: ${pct >= 100 ? 'var(--accent-green)' : 'var(--accent-amber)'};">${pct}%</span>
          </div>
          <div class="pixel-progress">
            <div class="pixel-progress-bar ${pct >= 100 ? '' : 'warning'}" style="width: ${pct}%"></div>
          </div>
          <div class="d-flex justify-between amount-mono" style="font-size: 11px; color: var(--text-dim); margin-top: 3px;">
            <span>Накоплено: ${current.toLocaleString('ru-RU')} ₸</span>
            <span>Осталось: ${remaining.toLocaleString('ru-RU')} ₸</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderDashboardUpcomingPayments() {
    const container = document.getElementById('dash-upcoming-payments');
    if (!container) return;

    const upcoming = [];
    const now = new Date();

    // Check recurring expenses coming up in next 30 days
    (this.state.recurring || []).filter((r) => r.status === 'active').forEach((rec) => {
      const dueDay = rec.dayOfMonth || 1;
      const dueDate = this.getNextMonthlyDate(dueDay, now);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const daysUntil = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));

      upcoming.push({
        id: rec.id,
        name: rec.name,
        amount: rec.amount,
        type: rec.type,
        daysUntil,
        dayOfMonth: dueDay
      });
    });

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    if (upcoming.length === 0) {
      container.innerHTML = '<div class="text-dim text-center" style="padding:10px;">Нет запланированных платежей</div>';
      return;
    }

    container.innerHTML = upcoming.slice(0, 3).map((item) => `
      <div class="timeline-row">
        <div class="d-flex align-center gap-2">
          <span class="timeline-date-badge">${item.dayOfMonth}-е число</span>
          <span>${item.name}</span>
        </div>
        <div class="d-flex align-center gap-2">
          <span class="amount-mono" style="font-weight: 600; color: ${item.type === 'income' ? 'var(--accent-green)' : 'var(--accent-red)'}">
            ${item.type === 'income' ? '+' : '-'}${Number(item.amount).toLocaleString('ru-RU')} ₸
          </span>
          <span class="status-badge planned">через ${item.daysUntil} дн.</span>
        </div>
      </div>
    `).join('');
  }

  // 2. TRANSACTIONS
  renderTransactionsList() {
    const listEl = document.getElementById('tx-full-list');
    if (!listEl) return;

    this.populateFilterDropdowns();

    const accFilter = document.getElementById('filter-tx-account')?.value || 'all';
    const catFilter = document.getElementById('filter-tx-category')?.value || 'all';
    const statusFilter = document.getElementById('filter-tx-status')?.value || 'all';
    const searchFilter = document.getElementById('filter-tx-search')?.value.toLowerCase().trim() || '';

    let txs = this.getFilteredTransactions();

    if (accFilter !== 'all') {
      txs = txs.filter((t) => t.accountId === accFilter || t.toAccountId === accFilter);
    }
    if (catFilter !== 'all') {
      txs = txs.filter((t) => t.categoryId === catFilter);
    }
    if (statusFilter !== 'all') {
      txs = txs.filter((t) => (t.status || 'confirmed') === statusFilter);
    }
    if (searchFilter) {
      txs = txs.filter((t) => (t.note || '').toLowerCase().includes(searchFilter));
    }

    txs.sort(compareTransactionsNewest);

    if (txs.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">🧾</div>
          <div class="empty-state-title">Нет операций</div>
          <div class="empty-state-desc">По выбранным фильтрам записей не найдено. Запишите расход или доход.</div>
          <button class="pixel-btn pixel-btn-green pixel-btn-sm" onclick="app.openTransactionModal()">+ Добавить операцию</button>
        </div>
      `;
      return;
    }

    const today = new Date();
    const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = [yesterday.getFullYear(), String(yesterday.getMonth() + 1).padStart(2, '0'), String(yesterday.getDate()).padStart(2, '0')].join('-');
    const renderTransaction = (tx) => {
      const cat = this.state.categories.find((c) => c.id === tx.categoryId);
      const accFrom = this.state.accounts.find((a) => a.id === tx.accountId);
      const accTo = this.state.accounts.find((a) => a.id === tx.toAccountId);
      const isPlanned = tx.status === 'planned';

      let icon = '💵';
      let title = tx.note || 'Операция';
      let metaStr = '';
      let amountClass = 'expense';
      let sign = '-';

      if (tx.type === 'income') {
        icon = cat?.icon || '📈';
        title = cat?.name || tx.note || 'Доход';
        metaStr = formatTransactionMeta(tx, accFrom?.name || 'Удалённый счёт');
        amountClass = 'income';
        sign = '+';
      } else if (tx.type === 'expense') {
        icon = cat?.icon || '🛒';
        title = cat?.name || tx.note || 'Расход';
        metaStr = formatTransactionMeta(tx, accFrom?.name || 'Удалённый счёт');
        amountClass = 'expense';
        sign = '-';
      } else if (tx.type === 'transfer') {
        icon = '🔁';
        title = 'Перевод между счетами';
        metaStr = formatTransactionMeta(tx, `${accFrom?.name || 'Удалённый счёт'} ➔ ${accTo?.name || 'Удалённый счёт'}`);
        amountClass = 'transfer';
        sign = '⇄';
      }

      return `
        <div class="tx-item ${isPlanned ? 'planned' : ''}" data-tx-id="${tx.id}">
          <div class="tx-left">
            <div class="tx-category-icon">${icon}</div>
            <div class="tx-details">
              <div class="tx-title">${title} ${tx.note && tx.type !== 'transfer' ? `(${tx.note})` : ''}</div>
              <div class="tx-meta">
                <span>${metaStr}</span>
                <span class="status-badge ${isPlanned ? 'planned' : 'confirmed'}">
                  ${isPlanned ? 'Запланирован' : 'Подтверждён'}
                </span>
              </div>
            </div>
          </div>
          <div class="d-flex align-center gap-2">
            <div class="tx-amount ${amountClass}">${sign}${Number(tx.amount).toLocaleString('ru-RU')} ₸</div>
            <div class="tx-actions">
              ${isPlanned ? `<button class="pixel-btn pixel-btn-sm pixel-btn-green btn-confirm-tx" title="Подтвердить проведение">✓</button>` : ''}
              <button class="pixel-btn pixel-btn-sm btn-edit-tx" title="Редактировать">✎</button>
              <button class="pixel-btn pixel-btn-sm pixel-btn-red btn-del-tx" title="Удалить">✕</button>
            </div>
          </div>
        </div>
      `;
    };

    const groups = txs.reduce((result, tx) => {
      (result[tx.date] ||= []).push(tx);
      return result;
    }, {});

    const formatDay = (date) => {
      const [year, month, day] = date.split('-').map(Number);
      const dateName = new Date(year, month - 1, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      if (date === todayKey) return `Сегодня — ${dateName}`;
      if (date === yesterdayKey) return `Вчера — ${dateName}`;
      return dateName;
    };

    listEl.innerHTML = Object.entries(groups).map(([date, dayTxs]) => {
      const confirmed = dayTxs.filter((tx) => tx.status !== 'planned');
      const income = confirmed.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const expense = confirmed.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const hasFlow = income > 0 || expense > 0;

      return `
        <section class="tx-day-group">
          <div class="tx-day-header">
            <div>
              <strong>${formatDay(date)}</strong>
            </div>
            <div class="tx-day-totals">
              ${income > 0 ? `<b class="income">+${income.toLocaleString('ru-RU')} ₸</b>` : ''}
              ${expense > 0 ? `<b class="expense">−${expense.toLocaleString('ru-RU')} ₸</b>` : ''}
              ${!hasFlow ? '<em>Переводы</em>' : ''}
            </div>
          </div>
          <div class="tx-day-items">${dayTxs.map(renderTransaction).join('')}</div>
        </section>
      `;
    }).join('');

    // Event listeners
    listEl.querySelectorAll('.btn-confirm-tx').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.tx-item').dataset.txId;
        this.confirmTransaction(id);
      });
    });

    listEl.querySelectorAll('.btn-edit-tx').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.tx-item').dataset.txId;
        this.openTransactionModal(id);
      });
    });

    listEl.querySelectorAll('.btn-del-tx').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.tx-item').dataset.txId;
        this.confirmAction('Удаление операции', 'Вы действительно хотите удалить эту операцию?', () => {
          this.deleteTransaction(id);
        });
      });
    });
  }

  confirmTransaction(id) {
    const tx = this.state.transactions.find((t) => t.id === id);
    if (!tx) return;

    if (tx.type === 'expense' || tx.type === 'transfer') {
      const validation = this.validateDepositDebit(tx.accountId, tx.amount);
      if (!validation.allowed) {
        this.showToast(validation.reason, 'error');
        return;
      }
    }

    tx.status = 'confirmed';
    this.logActivity(`Подтверждена операция: ${tx.note || tx.type} (${Number(tx.amount).toLocaleString('ru-RU')} ₸)`);
    this.saveState();
    this.render();
    this.showToast('Операция подтверждена и зачислена на баланс', 'success');
  }

  populateFilterDropdowns() {
    const accSelect = document.getElementById('filter-tx-account');
    const catSelect = document.getElementById('filter-tx-category');

    if (accSelect && accSelect.children.length <= 1) {
      accSelect.innerHTML = '<option value="all">Все счета</option>' +
        this.state.accounts.map((a) => `<option value="${a.id}">${a.name}</option>`).join('');
    }

    if (catSelect && catSelect.children.length <= 1) {
      catSelect.innerHTML = '<option value="all">Все категории</option>' +
        this.state.categories.map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    }
  }

  deleteTransaction(id) {
    const tx = this.state.transactions.find((t) => t.id === id);
    this.state.transactions = this.state.transactions.filter((t) => t.id !== id);
    this.logActivity(`Удалена операция ${tx ? `${Number(tx.amount).toLocaleString('ru-RU')} ₸ (${tx.note || tx.type})` : ''}`, 'warning');
    this.saveState();
    this.render();
    this.showToast('Операция удалена', 'info');
  }

  // Transaction Modal
  openTransactionModal(txId = null) {
    this.editingTxId = txId;
    const title = document.getElementById('modal-tx-title');
    const typeGroup = document.getElementById('tx-type-group');
    const accFrom = document.getElementById('tx-input-account');
    const accTo = document.getElementById('tx-input-to-account');
    const accToRow = document.getElementById('tx-row-to-account');
    const accountLabel = document.getElementById('tx-account-label');
    const catSelect = document.getElementById('tx-input-category');
    const catRow = document.getElementById('tx-row-category');
    const amtInput = document.getElementById('tx-input-amount');
    const dateInput = document.getElementById('tx-input-date');
    const noteInput = document.getElementById('tx-input-note');
    const statusSelect = document.getElementById('tx-input-status');

    accFrom.innerHTML = this.state.accounts.map((a) => `<option value="${a.id}">${a.icon || '💰'} ${a.name} (${this.calculateAccountBalance(a.id).toLocaleString('ru-RU')} ₸)</option>`).join('');
    accTo.innerHTML = accFrom.innerHTML;
    const populateCategories = (type, preferredCategoryId = '') => {
      const categories = this.state.categories.filter((category) => category.type === type);
      catSelect.innerHTML = categories.map((category) => `<option value="${category.id}">${category.icon} ${category.name}</option>`).join('');
      if (categories.some((category) => category.id === preferredCategoryId)) {
        catSelect.value = preferredCategoryId;
      }
    };

    let currentType = 'expense';

    if (txId) {
      const tx = this.state.transactions.find((t) => t.id === txId);
      if (tx) {
        title.textContent = 'Редактировать операцию';
        currentType = tx.type;
        amtInput.value = tx.amount;
        dateInput.value = tx.date;
        accFrom.value = tx.accountId;
        if (tx.toAccountId) accTo.value = tx.toAccountId;
        if (tx.categoryId) catSelect.dataset.preferredCategoryId = tx.categoryId;
        noteInput.value = tx.note || '';
        if (statusSelect) statusSelect.value = tx.status || 'confirmed';
      }
    } else {
      title.textContent = 'Новая операция';
      amtInput.value = '';
      dateInput.value = new Date().toISOString().split('T')[0];
      noteInput.value = '';
      if (statusSelect) statusSelect.value = 'confirmed';
    }

    const updateTypeUI = (type) => {
      currentType = type;
      typeGroup.querySelectorAll('.type-toggle-btn').forEach((b) => {
        if (b.dataset.type === type) {
          b.className = `type-toggle-btn active ${type}`;
        } else {
          b.className = 'type-toggle-btn';
        }
      });

      if (type === 'transfer') {
        accToRow.classList.remove('hidden');
        catRow.classList.add('hidden');
        if (accountLabel) accountLabel.textContent = 'Счёт списания (отправитель)';
      } else {
        accToRow.classList.add('hidden');
        catRow.classList.remove('hidden');
        if (accountLabel) accountLabel.textContent = type === 'income' ? 'Счёт зачисления' : 'Счёт списания';
        populateCategories(type, catSelect.dataset.preferredCategoryId || catSelect.value);
        catSelect.dataset.preferredCategoryId = '';
      }
    };

    typeGroup.querySelectorAll('.type-toggle-btn').forEach((b) => {
      b.onclick = () => updateTypeUI(b.dataset.type);
    });

    updateTypeUI(currentType);
    this.openModal('modal-transaction');
  }

  bindTransactionForm() {
    const form = document.getElementById('form-transaction');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();

      const activeTypeBtn = document.querySelector('#tx-type-group .type-toggle-btn.active');
      const type = activeTypeBtn ? activeTypeBtn.dataset.type : 'expense';
      const amount = parseFloat(document.getElementById('tx-input-amount').value);
      const date = document.getElementById('tx-input-date').value;
      const accountId = document.getElementById('tx-input-account').value;
      const toAccountId = document.getElementById('tx-input-to-account').value;
      const categoryId = document.getElementById('tx-input-category').value;
      const note = document.getElementById('tx-input-note').value.trim();
      const status = document.getElementById('tx-input-status')?.value || 'confirmed';

      if (isNaN(amount) || amount <= 0) {
        this.showToast('Укажите корректную сумму операции!', 'error');
        return;
      }

      if (type === 'transfer' && accountId === toAccountId) {
        this.showToast('Счёт списания и счёт зачисления должны отличаться!', 'error');
        return;
      }

      // Check BCC deposit withdrawal validation against the live balance.
      if ((type === 'expense' || type === 'transfer') && status === 'confirmed') {
        const validation = this.validateDepositDebit(accountId, amount);
        if (!validation.allowed) {
          this.showToast(validation.reason, 'error');
          return;
        }
      }

      if ((type === 'expense' || type === 'transfer') && status === 'confirmed') {
        const sourceAcc = this.state.accounts.find((a) => a.id === accountId);
        if (sourceAcc && sourceAcc.type !== 'deposit' && this.calculateAccountBalance(accountId) - amount < 0) {
          this.showToast('Внимание: после операции остаток на счёте станет отрицательным.', 'warning');
        }
      }

      if (this.editingTxId) {
        const idx = this.state.transactions.findIndex((t) => t.id === this.editingTxId);
        if (idx !== -1) {
          this.state.transactions[idx] = {
            ...this.state.transactions[idx],
            type,
            amount,
            date,
            accountId,
            toAccountId: type === 'transfer' ? toAccountId : null,
            categoryId: type !== 'transfer' ? categoryId : null,
            note,
            status
          };
          this.logActivity(`Изменена операция ${amount.toLocaleString('ru-RU')} ₸ (${note || type})`);
          this.showToast('Операция обновлена', 'success');
        }
      } else {
        const newTx = {
          id: 'tx_' + Date.now(),
          type,
          amount,
          date,
          accountId,
          toAccountId: type === 'transfer' ? toAccountId : null,
          categoryId: type !== 'transfer' ? categoryId : null,
          note,
          status,
          createdAt: new Date().toISOString()
        };
        this.state.transactions.push(newTx);
        this.logActivity(`Добавлена операция ${amount.toLocaleString('ru-RU')} ₸ (${note || type})`);
        this.showToast('Операция добавлена', 'success');
      }

      this.saveState();
      this.closeModal('modal-transaction');
      this.render();
    });

    ['filter-tx-account', 'filter-tx-category', 'filter-tx-status', 'filter-tx-search'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => {
        this.renderTransactionsList();
      });
    });
  }

  // 3. ACCOUNTS
  renderAccountsTab() {
    const container = document.getElementById('accounts-full-list');
    const totalEl = document.getElementById('accounts-total-balance');
    if (!container) return;

    if (totalEl) {
      totalEl.textContent = `${this.getTotalBalance().toLocaleString('ru-RU')} ₸`;
    }

    if (this.state.accounts.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">💳</div>
          <div class="empty-state-title">Нет добавленных счетов</div>
          <div class="empty-state-desc">Создайте первый счёт для учёта наличных или банковских карт.</div>
          <button class="pixel-btn pixel-btn-amber pixel-btn-sm" onclick="app.openAccountModal()">+ Создать счёт</button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.state.accounts.map((acc) => {
      const balance = this.calculateAccountBalance(acc.id);
      const typeLabel = {
        cash: 'Наличные',
        card: 'Банковская карта',
        savings: 'Накопительный счёт',
        deposit: acc.isBCC ? `BCC Депозит (${acc.subType === 'my_goal' ? 'Моя цель' : 'Чемпион'})` : 'Депозит'
      }[acc.type] || 'Счёт';

      return `
        <div class="pixel-card ${acc.excludeFromTotal ? 'excluded' : ''}" style="margin-bottom: 12px;">
          <div class="d-flex justify-between align-center">
            <div class="d-flex align-center gap-2">
              <span style="font-size: 24px;">${acc.icon || '💰'}</span>
              <div>
                <div style="font-size: 14px; font-weight: 600; color: #fff;">${acc.name}</div>
                <div style="font-size: 12px; color: var(--text-dim);">${typeLabel} ${acc.excludeFromTotal ? '• Вне общего баланса' : ''}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="account-balance" style="font-size: 16px; color: #fff;">${balance.toLocaleString('ru-RU')} ₸</div>
              <div class="amount-mono" style="font-size: 11px; color: var(--text-dim);">Начальный: ${Number(acc.initialBalance).toLocaleString('ru-RU')} ₸</div>
            </div>
          </div>
          <div class="d-flex justify-between align-center mt-2" style="border-top: 1px solid var(--border-color); padding-top: 8px;">
            <button class="pixel-btn pixel-btn-sm btn-view-acc-history" data-id="${acc.id}">История операций</button>
            <div class="d-flex gap-2">
              <button class="pixel-btn pixel-btn-sm btn-edit-acc" data-id="${acc.id}">Настроить</button>
              <button class="pixel-btn pixel-btn-sm pixel-btn-red btn-del-acc" data-id="${acc.id}">✕</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-view-acc-history').forEach((btn) => {
      btn.addEventListener('click', () => this.openAccountHistoryModal(btn.dataset.id));
    });
    container.querySelectorAll('.btn-edit-acc').forEach((btn) => {
      btn.addEventListener('click', () => this.openAccountModal(btn.dataset.id));
    });
    container.querySelectorAll('.btn-del-acc').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const acc = this.state.accounts.find((a) => a.id === id);
        const transactionCount = this.state.transactions.filter((tx) => tx.accountId === id || tx.toAccountId === id).length;
        const goalCount = this.state.goals.filter((goal) => (goal.linkedAccountIds || []).includes(id)).length;
        const recurringCount = (this.state.recurring || []).filter((rec) => rec.accountId === id).length;

        this.confirmAction('Удаление счёта',
          `Удалить «${acc?.name}»? Операции (${transactionCount}) останутся в истории без счёта, цели (${goalCount}) будут отвязаны, а регулярные платежи (${recurringCount}) — поставлены на паузу.`,
          () => {
          // Keep the financial history, but remove references to the deleted account.
          this.state.transactions = this.state.transactions.map((tx) => ({
            ...tx,
            accountId: tx.accountId === id ? null : tx.accountId,
            toAccountId: tx.toAccountId === id ? null : tx.toAccountId
          }));
          this.state.goals = this.state.goals.map((goal) => ({
            ...goal,
            linkedAccountIds: (goal.linkedAccountIds || []).filter((accountId) => accountId !== id)
          }));
          this.state.recurring = (this.state.recurring || []).map((rec) => (
            rec.accountId === id ? { ...rec, accountId: null, status: 'paused' } : rec
          ));
          this.state.accounts = this.state.accounts.filter((a) => a.id !== id);
          this.logActivity(`Удалён счёт: ${acc?.name}`, 'warning');
          this.saveState();
          this.render();
          this.showToast('Счёт удалён. Связанные записи сохранены.', 'info');
        });
      });
    });
  }

  openAccountModal(accId = null) {
    this.editingAccountId = accId;
    const title = document.getElementById('modal-acc-title');
    const nameInput = document.getElementById('acc-input-name');
    const typeSelect = document.getElementById('acc-input-type');
    const balInput = document.getElementById('acc-input-balance');
    const iconInput = document.getElementById('acc-input-icon');
    const excludeCheckbox = document.getElementById('acc-input-exclude');

    if (accId) {
      const acc = this.state.accounts.find((a) => a.id === accId);
      if (acc) {
        title.textContent = 'Настройки счёта';
        nameInput.value = acc.name;
        typeSelect.value = acc.type;
        balInput.value = acc.initialBalance;
        iconInput.value = acc.icon || '💳';
        excludeCheckbox.checked = !!acc.excludeFromTotal;
      }
    } else {
      title.textContent = 'Создать новый счёт';
      nameInput.value = '';
      typeSelect.value = 'card';
      balInput.value = '0';
      iconInput.value = '💳';
      excludeCheckbox.checked = false;
    }

    this.openModal('modal-account');
  }

  bindAccountForm() {
    const form = document.getElementById('form-account');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('acc-input-name').value.trim();
      const type = document.getElementById('acc-input-type').value;
      const initialBalance = parseFloat(document.getElementById('acc-input-balance').value) || 0;
      const icon = document.getElementById('acc-input-icon').value.trim() || '💰';
      const excludeFromTotal = document.getElementById('acc-input-exclude').checked;
      const isBCCDeposit = type === 'deposit';

      if (!name) return;

      if (this.editingAccountId) {
        const idx = this.state.accounts.findIndex((a) => a.id === this.editingAccountId);
        if (idx !== -1) {
          this.state.accounts[idx] = {
            ...this.state.accounts[idx],
            name,
            type,
            initialBalance,
            icon,
            excludeFromTotal,
            isBCC: isBCCDeposit,
            ...(isBCCDeposit ? {
              subType: this.state.accounts[idx].subType || 'my_goal',
              termMonths: this.state.accounts[idx].termMonths || 3,
              nominalRate: this.state.accounts[idx].nominalRate || 16.7,
              effectiveRate: this.state.accounts[idx].effectiveRate || 18.06,
              startDate: this.state.accounts[idx].startDate || new Date().toISOString().split('T')[0],
              monthlyTopUp: this.state.accounts[idx].monthlyTopUp || 0,
              allowsWithdrawal: this.state.accounts[idx].allowsWithdrawal ?? false,
              minBalance: this.state.accounts[idx].minBalance || 0
            } : {})
          };
          this.logActivity(`${isBCCDeposit ? 'Настроен BCC депозит' : 'Обновлён счёт'}: ${name}`);
          this.showToast(isBCCDeposit ? 'Счёт перенесён в BCC-депозиты' : 'Счёт обновлён', 'success');
        }
      } else {
        const newAcc = {
          id: 'acc_' + Date.now(),
          name,
          type,
          currency: '₸',
          initialBalance,
          icon,
          excludeFromTotal,
          isBCC: isBCCDeposit,
          ...(isBCCDeposit ? {
            subType: 'my_goal',
            termMonths: 3,
            nominalRate: 16.7,
            effectiveRate: 18.06,
            startDate: new Date().toISOString().split('T')[0],
            monthlyTopUp: 0,
            allowsWithdrawal: false,
            minBalance: 0
          } : {})
        };
        this.state.accounts.push(newAcc);
        this.logActivity(`Создан новый счёт: ${name}`);
        this.showToast('Новый счёт создан', 'success');
      }

      this.saveState();
      this.closeModal('modal-account');
      this.render();
    });
  }

  openAccountHistoryModal(accId) {
    const acc = this.state.accounts.find((a) => a.id === accId);
    if (!acc) return;

    const modal = document.getElementById('modal-acc-history');
    const title = document.getElementById('modal-acc-history-title');
    const listEl = document.getElementById('modal-acc-history-list');

    title.textContent = `История: ${acc.name}`;

    const accTxs = this.state.transactions.filter((t) => t.accountId === accId || t.toAccountId === accId);
    accTxs.sort(compareTransactionsNewest);

    if (accTxs.length === 0) {
      listEl.innerHTML = '<div class="text-center text-dim" style="padding: 20px;">По этому счёту ещё нет операций</div>';
    } else {
      listEl.innerHTML = accTxs.map((tx) => {
        let sign = '-';
        let colorClass = 'expense';
        let detail = tx.note || 'Операция';

        if (tx.type === 'income') {
          sign = '+';
          colorClass = 'income';
        } else if (tx.type === 'transfer') {
          if (tx.toAccountId === accId) {
            sign = '+';
            colorClass = 'income';
            detail = `Перевод из ${this.state.accounts.find((a) => a.id === tx.accountId)?.name || 'счёта'}`;
          } else {
            sign = '-';
            colorClass = 'expense';
            detail = `Перевод на ${this.state.accounts.find((a) => a.id === tx.toAccountId)?.name || 'счёт'}`;
          }
        }

        return `
          <div class="tx-item" style="padding: 8px 10px;">
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #fff;">${detail}</div>
              <div style="font-size: 11px; color: var(--text-dim);">${[tx.date, formatTransactionTime(tx)].filter(Boolean).join(' • ')}</div>
            </div>
            <div class="tx-amount ${colorClass}">${sign}${Number(tx.amount).toLocaleString('ru-RU')} ₸</div>
          </div>
        `;
      }).join('');
    }

    this.openModal('modal-acc-history');
  }

  // 4. BUDGET & LIMITS
  renderBudgetLimitsTab() {
    const container = document.getElementById('budget-limits-list');
    const totalLimitInput = document.getElementById('input-total-monthly-limit');
    const totalSpentEl = document.getElementById('budget-total-spent');
    const totalLimitDisplay = document.getElementById('budget-total-limit-display');
    const totalProgressBar = document.getElementById('budget-total-progress-bar');
    const totalPercentEl = document.getElementById('budget-total-percent');

    if (!container) return;

    const txs = this.getFilteredTransactions();
    const currentMonthExpenses = txs.filter((t) => t.type === 'expense' && t.status !== 'planned');

    const totalSpent = currentMonthExpenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalLimit = Number(this.state.limits.monthlyTotalLimit) || 0;

    if (totalLimitInput) totalLimitInput.value = totalLimit;
    if (totalSpentEl) totalSpentEl.textContent = `${totalSpent.toLocaleString('ru-RU')} ₸`;
    if (totalLimitDisplay) totalLimitDisplay.textContent = `${totalLimit.toLocaleString('ru-RU')} ₸`;

    const totalPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
    if (totalPercentEl) totalPercentEl.textContent = `${totalPct}%`;

    if (totalProgressBar) {
      totalProgressBar.style.width = `${Math.min(100, totalPct)}%`;
      totalProgressBar.className = `pixel-progress-bar ${totalPct > 100 ? 'danger' : totalPct >= 75 ? 'warning' : ''}`;
    }

    const catExpenses = {};
    currentMonthExpenses.forEach((t) => {
      catExpenses[t.categoryId] = (catExpenses[t.categoryId] || 0) + Number(t.amount);
    });

    const order = this.state.settings?.budgetCategoryOrder || [];
    const expenseCategories = this.state.categories
      .filter((c) => c.type === 'expense')
      .sort((left, right) => {
        const leftIndex = order.indexOf(left.id);
        const rightIndex = order.indexOf(right.id);
        if (leftIndex === -1 && rightIndex === -1) return 0;
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      });

    container.innerHTML = expenseCategories.map((cat, index) => {
      const limit = Number(this.state.limits.categoryLimits[cat.id]) || 0;
      const spent = catExpenses[cat.id] || 0;
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const remaining = limit - spent;

      return `
        <div class="pixel-card" style="margin-bottom: 10px; padding: 12px;">
          <div class="d-flex justify-between align-center">
            <div class="d-flex align-center gap-2">
              <span style="font-size: 18px;">${cat.icon}</span>
              <span style="font-size: 13px; font-weight: 600; color: #fff;">${cat.name}</span>
            </div>
            <div class="d-flex align-center gap-2">
              <div class="category-order-buttons" aria-label="Порядок категории ${cat.name}">
                <button class="category-order-btn btn-move-category" data-id="${cat.id}" data-direction="up" title="Переместить выше" aria-label="Переместить ${cat.name} выше" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="category-order-btn btn-move-category" data-id="${cat.id}" data-direction="down" title="Переместить ниже" aria-label="Переместить ${cat.name} ниже" ${index === expenseCategories.length - 1 ? 'disabled' : ''}>↓</button>
              </div>
              <div class="amount-mono" style="font-size: 12px; font-weight: 700; color: ${pct > 100 ? 'var(--accent-red)' : pct >= 75 ? 'var(--accent-amber)' : 'var(--accent-green)'}">
                ${pct}%
              </div>
            </div>
          </div>

          <div class="pixel-progress-wrap">
            <div class="pixel-progress">
              <div class="pixel-progress-bar ${pct > 100 ? 'danger' : pct >= 75 ? 'warning' : ''}" style="width: ${Math.min(100, pct)}%"></div>
            </div>
          </div>

          <div class="d-flex justify-between align-center amount-mono" style="font-size: 12px; margin-top: 4px;">
            <span>Потрачено: <strong class="text-red">${spent.toLocaleString('ru-RU')} ₸</strong></span>
            <span>Лимит: <strong>${limit > 0 ? limit.toLocaleString('ru-RU') + ' ₸' : '—'}</strong></span>
            <span>${remaining >= 0 ? `Осталось: <span class="text-green">${remaining.toLocaleString('ru-RU')} ₸</span>` : `Превышено: <span class="text-red">${Math.abs(remaining).toLocaleString('ru-RU')} ₸</span>`}</span>
          </div>

          <div class="d-flex justify-between align-center mt-2">
            <input type="number" step="any" class="pixel-input cat-limit-input amount-mono" data-cat-id="${cat.id}" value="${limit || ''}" placeholder="Лимит в ₸" style="max-width: 140px; font-size: 12px; padding: 4px 8px;">
            <button class="pixel-btn pixel-btn-sm btn-save-cat-limit" data-cat-id="${cat.id}">Сохранить</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-save-cat-limit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const catId = btn.dataset.catId;
        const input = container.querySelector(`.cat-limit-input[data-cat-id="${catId}"]`);
        const val = parseFloat(input.value) || 0;
        this.state.limits.categoryLimits[catId] = val;
        this.saveState();
        this.render();
        this.showToast('Лимит сохранён', 'success');
      });
    });

    container.querySelectorAll('.btn-move-category').forEach((btn) => {
      btn.addEventListener('click', () => {
        const currentOrder = expenseCategories.map((category) => category.id);
        const index = currentOrder.indexOf(btn.dataset.id);
        const targetIndex = btn.dataset.direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= currentOrder.length) return;
        [currentOrder[index], currentOrder[targetIndex]] = [currentOrder[targetIndex], currentOrder[index]];
        this.state.settings = { ...this.state.settings, budgetCategoryOrder: currentOrder };
        this.saveState();
        this.render();
      });
    });
  }

  bindLimitsForm() {
    document.getElementById('btn-save-total-limit')?.addEventListener('click', () => {
      const val = parseFloat(document.getElementById('input-total-monthly-limit').value) || 0;
      this.state.limits.monthlyTotalLimit = val;
      this.saveState();
      this.render();
      this.showToast('Общий лимит обновлён', 'success');
    });
  }

  // 5. BCC DEPOSITS
  renderDepositsTab() {
    const container = document.getElementById('deposits-cards-container');
    if (!container) return;

    const bccDeposits = this.state.accounts.filter((a) => a.type === 'deposit');

    if (bccDeposits.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">🏦</div>
          <div class="empty-state-title">Нет депозитов BCC</div>
          <div class="empty-state-desc">Добавьте вклад «Моя цель» (16.7%) или «Чемпион» (14.2%) для расчёта капитализации.</div>
          <button class="pixel-btn pixel-btn-amber pixel-btn-sm" onclick="app.openDepositModal()">+ Открыть депозит BCC</button>
        </div>
      `;
      return;
    }

    container.innerHTML = bccDeposits.map((dep) => {
      const balance = this.calculateAccountBalance(dep.id);
      const isMyGoal = dep.subType === 'my_goal';
      const termMonths = dep.termMonths || (isMyGoal ? 3 : 6);
      const nominalRate = dep.nominalRate || (isMyGoal ? 16.7 : 14.2);
      const effectiveRate = dep.effectiveRate || (isMyGoal ? 18.06 : 15.17);
      const startDate = dep.startDate || new Date().toISOString().split('T')[0];
      const maturity = calculateMaturityDate(startDate, termMonths);
      const maturityStr = maturity.toLocaleDateString('ru-RU');
      const daysLeft = getDaysRemaining(maturity.toISOString().split('T')[0]);
      const nextPayout = calculateNextPayoutDate(startDate);

      const forecast = calculateDepositForecast({
        principal: balance,
        nominalRate,
        termMonths,
        monthlyTopUp: dep.monthlyTopUp || 0,
        startDate
      });

      const nextMonthInterest = calculateMonthlyInterestAccrual(nominalRate, balance);

      const accruedInterestSoFar = this.state.transactions
        .filter((t) => t.accountId === dep.id && t.categoryId === 'cat_invest' && t.type === 'income')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

      return `
        <div class="bcc-card" data-dep-id="${dep.id}">
          <div class="d-flex justify-between align-center">
            <div>
              <span class="deposit-badge">${isMyGoal ? 'BCC «МОЯ ЦЕЛЬ»' : 'BCC «ЧЕМПИОН»'}</span>
              <h3 style="font-size: 15px; font-weight: 700; color: #fff;">${dep.name}</h3>
            </div>
            <div class="text-right">
              <div class="account-balance" style="font-size: 18px; color: var(--accent-amber);">${balance.toLocaleString('ru-RU')} ₸</div>
              <div style="font-size: 11px; color: var(--text-dim);">Текущий остаток</div>
            </div>
          </div>

          <div class="rates-badge-group">
            <div class="rate-badge">Срок: <strong>${termMonths} мес.</strong></div>
            <div class="rate-badge">Ставка: <strong>${nominalRate}%</strong></div>
            <div class="rate-badge">ГЭСВ: <strong>${effectiveRate}%</strong></div>
            <div class="rate-badge">Осталось: <strong style="color: ${daysLeft <= 14 ? 'var(--accent-red)' : 'var(--accent-green)'}">${daysLeft >= 0 ? `${daysLeft} дн.` : 'Завершён'}</strong></div>
          </div>

          <div class="form-row two-col" style="margin: 10px 0; font-size: 13px; background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div>
              <div>Дата открытия: <strong class="date-mono">${new Date(startDate).toLocaleDateString('ru-RU')}</strong></div>
              <div>Дата окончания: <strong class="date-mono" style="color: #fff;">${maturityStr}</strong></div>
              <div>Частичное снятие: <strong style="color: ${dep.allowsWithdrawal ? 'var(--accent-green)' : 'var(--accent-red)'}">${dep.allowsWithdrawal ? 'Доступно (от 1 000 ₸)' : 'Недоступно'}</strong></div>
            </div>
            <div>
              <div>Уже начислено %: <strong class="text-green amount-mono">+${accruedInterestSoFar.toLocaleString('ru-RU')} ₸</strong></div>
              <div>Ожидаемый доход к концу: <strong class="text-amber amount-mono">+${forecast.totalReward.toLocaleString('ru-RU')} ₸</strong></div>
              <div>Итоговая выплата: <strong class="text-amber amount-mono">${forecast.finalAmount.toLocaleString('ru-RU')} ₸</strong></div>
            </div>
          </div>

          <div class="disclaimer-box">
            ${forecast.disclaimer}
          </div>

          <div class="d-flex justify-between align-center mt-4" style="flex-wrap: wrap; gap: 8px;">
            <div class="d-flex gap-2">
              <button class="pixel-btn pixel-btn-sm pixel-btn-amber btn-accrue-interest" data-id="${dep.id}">
                💰 Зачислить %
              </button>
              <button class="pixel-btn pixel-btn-sm pixel-btn-green btn-topup-dep" data-id="${dep.id}">
                + Пополнить
              </button>
            </div>
            <div class="d-flex gap-2">
              <button class="pixel-btn pixel-btn-sm btn-dep-schedule" data-id="${dep.id}">График</button>
              <button class="pixel-btn pixel-btn-sm btn-edit-dep" data-id="${dep.id}">Настроить</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind deposit actions
    container.querySelectorAll('.btn-accrue-interest').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openDepositInterestModal(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-topup-dep').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openTopUpModal(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-dep-schedule').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openDepositScheduleModal(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-edit-dep').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openDepositModal(btn.dataset.id);
      });
    });
  }

  openDepositModal(depId = null) {
    this.editingAccountId = depId;
    const title = document.getElementById('modal-deposit-title');
    const nameInput = document.getElementById('dep-input-name');
    const iconInput = document.getElementById('dep-input-icon');
    const sourceRow = document.getElementById('dep-source-row');
    const sourceSelect = document.getElementById('dep-input-source-account');
    const typeSelect = document.getElementById('dep-input-type');
    const amountInput = document.getElementById('dep-input-amount');
    const termInput = document.getElementById('dep-input-term');
    const nomRateInput = document.getElementById('dep-input-nom-rate');
    const effRateInput = document.getElementById('dep-input-eff-rate');
    const dateInput = document.getElementById('dep-input-start-date');
    const topupInput = document.getElementById('dep-input-topup');

    const applyPreset = (typeKey) => {
      const preset = BCC_DEPOSIT_TYPES[typeKey === 'my_goal' ? 'MY_GOAL' : 'CHAMPION'];
      if (!depId) {
        nameInput.value = preset.name;
        termInput.value = preset.defaultTermMonths;
        nomRateInput.value = preset.defaultNominalRate;
        effRateInput.value = preset.defaultEffectiveRate;
      }
    };

    typeSelect.onchange = () => applyPreset(typeSelect.value);

    if (depId) {
      const dep = this.state.accounts.find((a) => a.id === depId);
      if (dep) {
        title.textContent = 'Настройки депозита BCC';
        nameInput.value = dep.name;
        iconInput.value = dep.icon || (dep.subType === 'champion' ? '🏆' : '🏦');
        typeSelect.value = dep.subType || 'my_goal';
        amountInput.value = dep.initialBalance;
        termInput.value = dep.termMonths;
        nomRateInput.value = dep.nominalRate;
        effRateInput.value = dep.effectiveRate;
        dateInput.value = dep.startDate || new Date().toISOString().split('T')[0];
        topupInput.value = dep.monthlyTopUp || 0;
        sourceRow.classList.add('hidden');
        sourceSelect.required = false;
      }
    } else {
      title.textContent = 'Открыть депозит BCC';
      typeSelect.value = 'my_goal';
      applyPreset('my_goal');
      iconInput.value = '🏦';
      amountInput.value = '100000';
      dateInput.value = new Date().toISOString().split('T')[0];
      topupInput.value = '0';
      const sourceAccounts = this.state.accounts.filter((account) => account.type !== 'deposit');
      sourceSelect.innerHTML = '<option value="">Выберите счёт списания</option>';
      sourceAccounts.forEach((account) => {
        const option = document.createElement('option');
        option.value = account.id;
        option.textContent = `${account.icon || '💳'} ${account.name} — ${this.calculateAccountBalance(account.id).toLocaleString('ru-RU')} ₸`;
        sourceSelect.appendChild(option);
      });
      sourceRow.classList.remove('hidden');
      sourceSelect.required = true;
    }

    this.openModal('modal-deposit');
  }

  openDepositInterestModal(depId) {
    const dep = this.state.accounts.find((a) => a.id === depId);
    if (!dep) return;

    const balance = this.calculateAccountBalance(dep.id);
    const suggested = calculateMonthlyInterestAccrual(dep.nominalRate, balance);

    document.getElementById('interest-modal-dep-name').textContent = dep.name;
    document.getElementById('interest-modal-balance').textContent = `${balance.toLocaleString('ru-RU')} ₸`;
    document.getElementById('interest-modal-rate').textContent = `${dep.nominalRate}% годовых`;
    document.getElementById('interest-input-amount').value = suggested;
    document.getElementById('interest-input-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('interest-modal-dep-id').value = depId;

    this.openModal('modal-deposit-interest');
  }

  bindDepositInterestForm() {
    document.getElementById('btn-confirm-accrue-interest')?.addEventListener('click', () => {
      const depId = document.getElementById('interest-modal-dep-id').value;
      const amount = parseFloat(document.getElementById('interest-input-amount').value);
      const date = document.getElementById('interest-input-date').value;
      const dep = this.state.accounts.find((a) => a.id === depId);

      if (!dep || isNaN(amount) || amount <= 0) {
        this.showToast('Укажите корректную сумму вознаграждения!', 'error');
        return;
      }

      const tx = {
        id: 'tx_interest_' + Date.now(),
        type: 'income',
        amount,
        date,
        accountId: depId,
        categoryId: 'cat_invest',
        note: `Вознаграждение банка по вкладу «${dep.name}»`,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };

      this.state.transactions.push(tx);
      this.logActivity(`Зачислены проценты по вкладу «${dep.name}»: +${amount.toLocaleString('ru-RU')} ₸`);
      this.saveState();
      this.closeModal('modal-deposit-interest');
      this.render();
      this.showToast(`Вознаграждение +${amount.toLocaleString('ru-RU')} ₸ успешно зачислено!`, 'success');
    });
  }

  getDepositBalanceHistory(dep) {
    const openingDate = dep.startDate || new Date().toISOString().split('T')[0];
    const dailyChanges = new Map([[openingDate, Number(dep.initialBalance) || 0]]);

    this.state.transactions
      .filter((tx) => tx.status !== 'planned' && (tx.accountId === dep.id || tx.toAccountId === dep.id))
      .forEach((tx) => {
        const date = tx.date || openingDate;
        const amount = Number(tx.amount) || 0;
        let change = 0;
        if (tx.type === 'income' && tx.accountId === dep.id) change = amount;
        if (tx.type === 'expense' && tx.accountId === dep.id) change = -amount;
        if (tx.type === 'transfer') {
          if (tx.accountId === dep.id) change -= amount;
          if (tx.toAccountId === dep.id) change += amount;
        }
        dailyChanges.set(date, (dailyChanges.get(date) || 0) + change);
      });

    const points = [];
    let balance = 0;
    [...dailyChanges.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .forEach(([date, change]) => {
        balance += change;
        points.push({ date, balance, change });
      });

    const today = new Date().toISOString().split('T')[0];
    if (points.length && points[points.length - 1].date !== today) {
      points.push({ date: today, balance, change: 0 });
    }
    return points;
  }

  buildDepositBalanceChart(points) {
    if (!points.length) return '<div class="empty-state-desc">Пока нет данных для графика.</div>';

    const width = 480;
    const height = 190;
    const padding = { top: 20, right: 20, bottom: 32, left: 58 };
    const values = points.map((point) => point.balance);
    const minValue = Math.min(0, ...values);
    const maxValue = Math.max(1, ...values);
    const valueRange = Math.max(1, maxValue - minValue);
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const coordinates = points.map((point, index) => {
      const x = padding.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
      const y = padding.top + plotHeight - ((point.balance - minValue) / valueRange) * plotHeight;
      return { ...point, x, y };
    });
    const polyline = coordinates.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const formatShortDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const grid = [0, 0.5, 1].map((fraction) => {
      const y = padding.top + plotHeight - fraction * plotHeight;
      const label = minValue + fraction * valueRange;
      return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="deposit-chart-grid" /><text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" class="deposit-chart-label">${Math.round(label / 1000)}k</text>`;
    }).join('');
    const pointsMarkup = coordinates.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" class="deposit-chart-dot"><title>${formatShortDate(point.date)}: ${point.balance.toLocaleString('ru-RU')} ₸</title></circle>`).join('');
    const firstLabel = formatShortDate(points[0].date);
    const lastLabel = formatShortDate(points[points.length - 1].date);

    return `
      <svg class="deposit-balance-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Изменение остатка депозита">
        ${grid}
        <polyline points="${polyline}" class="deposit-chart-line" />
        ${pointsMarkup}
        <text x="${padding.left}" y="${height - 9}" class="deposit-chart-label">${firstLabel}</text>
        <text x="${width - padding.right}" y="${height - 9}" text-anchor="end" class="deposit-chart-label">${lastLabel}</text>
      </svg>`;
  }

  openDepositScheduleModal(depId) {
    const dep = this.state.accounts.find((a) => a.id === depId);
    if (!dep) return;

    const modal = document.getElementById('modal-dep-schedule');
    const title = document.getElementById('modal-dep-schedule-title');
    const body = document.getElementById('modal-dep-schedule-body');

    title.textContent = `Движение депозита: ${dep.name}`;
    const balance = this.calculateAccountBalance(dep.id);
    const history = this.getDepositBalanceHistory(dep);

    const forecast = calculateDepositForecast({
      principal: balance,
      nominalRate: dep.nominalRate,
      termMonths: dep.termMonths,
      monthlyTopUp: dep.monthlyTopUp,
      startDate: dep.startDate
    });

    body.innerHTML = `
      <div class="deposit-history-panel">
        <div class="deposit-history-title">Изменение остатка по реальным операциям</div>
        ${this.buildDepositBalanceChart(history)}
        <div class="deposit-history-caption">Точки появляются при открытии, пополнении, начислении процентов или снятии. Наведи на точку, чтобы увидеть дату и сумму.</div>
      </div>
      <div style="margin-bottom: 12px; font-size: 13px;">
        <div style="color: var(--text-muted); margin-bottom: 6px;">Прогноз по ставке BCC</div>
        <div>Текущая сумма: <strong class="amount-mono">${balance.toLocaleString('ru-RU')} ₸</strong></div>
        <div>Номинальная ставка: <strong>${dep.nominalRate}% годовых</strong></div>
        <div>Ожидаемый доход за срок: <strong class="text-green amount-mono">+${forecast.totalReward.toLocaleString('ru-RU')} ₸</strong></div>
        <div>Итоговая выплата: <strong class="text-amber amount-mono">${forecast.finalAmount.toLocaleString('ru-RU')} ₸</strong></div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-muted);">
            <th style="padding: 6px;">#</th>
            <th style="padding: 6px;">Дата</th>
            <th style="padding: 6px;">Начислено</th>
            <th style="padding: 6px;">Пополнение</th>
            <th style="padding: 6px; text-align: right;">Остаток</th>
          </tr>
        </thead>
        <tbody>
          ${forecast.schedule.map((s) => `
            <tr style="border-bottom: 1px solid var(--border-color);" class="amount-mono">
              <td style="padding: 6px;">${s.month}</td>
              <td style="padding: 6px;">${s.date}</td>
              <td style="padding: 6px; color: var(--accent-green);">+${s.interestAccrued.toLocaleString('ru-RU')} ₸</td>
              <td style="padding: 6px;">+${s.topUp.toLocaleString('ru-RU')} ₸</td>
              <td style="padding: 6px; text-align: right; font-weight: 600;">${s.endBalance.toLocaleString('ru-RU')} ₸</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    this.openModal('modal-dep-schedule');
  }

  openTopUpModal(depId) {
    const dep = this.state.accounts.find((a) => a.id === depId);
    if (!dep) return;

    this.openTransactionModal();
    setTimeout(() => {
      document.querySelector('#tx-type-group .type-toggle-btn[data-type="transfer"]')?.click();
      const toAcc = document.getElementById('tx-input-to-account');
      if (toAcc) toAcc.value = depId;
      document.getElementById('tx-input-note').value = `Пополнение ${dep.name}`;
    }, 50);
  }

  // 6. SAVINGS GOALS (Supports MULTIPLE LINKED ACCOUNTS)
  renderGoalsTab() {
    const container = document.getElementById('goals-cards-container');
    if (!container) return;

    if (this.state.goals.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🎯</div>
          <div class="empty-state-title">Нет активных целей</div>
          <div class="empty-state-desc">Поставьте цель — например, «Ноутбук — 500 000 ₸» с привязкой к счетам.</div>
          <button class="pixel-btn pixel-btn-amber pixel-btn-sm" onclick="app.openGoalModal()">+ Создать цель</button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.state.goals.map((goal) => {
      let current = Number(goal.currentAmount) || 0;
      let linkedNames = [];

      if (goal.linkedAccountIds && goal.linkedAccountIds.length > 0) {
        current = goal.linkedAccountIds.reduce((sum, accId) => sum + this.calculateAccountBalance(accId), 0);
        linkedNames = goal.linkedAccountIds
          .map((id) => this.state.accounts.find((a) => a.id === id)?.name)
          .filter(Boolean);
      }

      const target = Number(goal.targetAmount) || 1;
      const pct = Math.min(100, Math.round((current / target) * 100));
      const remaining = Math.max(0, target - current);

      let monthlyNeed = 0;
      if (goal.deadline) {
        const daysLeft = getDaysRemaining(goal.deadline);
        const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30.4));
        monthlyNeed = remaining > 0 ? Math.round(remaining / monthsLeft) : 0;
      }

      const isAchieved = current >= target;

      return `
        <div class="goal-card ${isAchieved ? 'glow-green' : ''}">
          <div>
            <div class="goal-header">
              <span class="goal-title">${goal.title}</span>
              <span class="status-badge ${isAchieved ? 'confirmed' : 'planned'}">
                ${isAchieved ? 'Достигнута! 🎉' : `${pct}%`}
              </span>
            </div>

            <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 6px;">
              ${goal.description || 'Без описания'}
            </div>

            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">
              Привязка: <strong style="color: #fff;">${linkedNames.length > 0 ? linkedNames.join(', ') : 'Ручной учёт'}</strong>
            </div>

            <div class="pixel-progress-wrap">
              <div class="pixel-progress">
                <div class="pixel-progress-bar ${isAchieved ? '' : 'warning'}" style="width: ${pct}%"></div>
              </div>
            </div>

            <div class="goal-numbers amount-mono">
              <span class="text-green">${current.toLocaleString('ru-RU')} ₸</span>
              <span class="text-amber">Цель: ${target.toLocaleString('ru-RU')} ₸</span>
            </div>

            <div class="d-flex justify-between amount-mono" style="font-size: 11px; color: var(--text-dim);">
              <span>Осталось: ${remaining.toLocaleString('ru-RU')} ₸</span>
              <span>Срок: ${goal.deadline ? new Date(goal.deadline).toLocaleDateString('ru-RU') : '—'}</span>
            </div>

            ${!isAchieved && monthlyNeed > 0 ? `
              <div class="goal-monthly-calc">
                <span>Нужно откладывать:</span>
                <strong class="amount-mono">${monthlyNeed.toLocaleString('ru-RU')} ₸ / мес</strong>
              </div>
            ` : ''}
          </div>

          <div class="d-flex justify-between align-center mt-4">
            <button class="pixel-btn pixel-btn-sm pixel-btn-amber btn-topup-goal" data-id="${goal.id}">+ Пополнить</button>
            <div class="d-flex gap-2">
              <button class="pixel-btn pixel-btn-sm btn-edit-goal" data-id="${goal.id}">✎</button>
              <button class="pixel-btn pixel-btn-sm pixel-btn-red btn-del-goal" data-id="${goal.id}">✕</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-topup-goal').forEach((btn) => {
      btn.addEventListener('click', () => {
        const goal = this.state.goals.find((g) => g.id === btn.dataset.id);
        if (goal?.linkedAccountIds?.length > 0) {
          this.openTopUpModal(goal.linkedAccountIds[0]);
        } else {
          const amt = prompt(`На сколько пополнить цель «${goal.title}» в ₸?`);
          if (amt && !isNaN(parseFloat(amt))) {
            goal.currentAmount = (Number(goal.currentAmount) || 0) + parseFloat(amt);
            this.logActivity(`Пополнена вручную цель «${goal.title}»: +${parseFloat(amt).toLocaleString('ru-RU')} ₸`);
            this.saveState();
            this.render();
            this.showToast('Цель пополнена', 'success');
          }
        }
      });
    });

    container.querySelectorAll('.btn-edit-goal').forEach((btn) => {
      btn.addEventListener('click', () => this.openGoalModal(btn.dataset.id));
    });

    container.querySelectorAll('.btn-del-goal').forEach((btn) => {
      btn.addEventListener('click', () => {
        const goal = this.state.goals.find((g) => g.id === btn.dataset.id);
        this.confirmAction('Удаление цели', `Удалить цель «${goal?.title}»?`, () => {
          this.state.goals = this.state.goals.filter((g) => g.id !== btn.dataset.id);
          this.logActivity(`Удалена цель: ${goal?.title}`, 'warning');
          this.saveState();
          this.render();
          this.showToast('Цель удалена', 'info');
        });
      });
    });

    document.getElementById('btn-add-goal')?.addEventListener('click', () => {
      this.openGoalModal();
    });
  }

  openGoalModal(goalId = null) {
    this.editingGoalId = goalId;
    const title = document.getElementById('modal-goal-title');
    const nameInput = document.getElementById('goal-input-name');
    const targetInput = document.getElementById('goal-input-target');
    const currentInput = document.getElementById('goal-input-current');
    const dateInput = document.getElementById('goal-input-date');
    const descInput = document.getElementById('goal-input-desc');
    const accountsChecklist = document.getElementById('goal-accounts-checklist');

    let selectedAccIds = [];

    if (goalId) {
      const g = this.state.goals.find((item) => item.id === goalId);
      if (g) {
        title.textContent = 'Редактировать цель';
        nameInput.value = g.title;
        targetInput.value = g.targetAmount;
        currentInput.value = g.currentAmount || 0;
        dateInput.value = g.deadline || '';
        descInput.value = g.description || '';
        selectedAccIds = g.linkedAccountIds || (g.linkedAccountId ? [g.linkedAccountId] : []);
      }
    } else {
      title.textContent = 'Новая цель накоплений';
      nameInput.value = '';
      targetInput.value = '500000';
      currentInput.value = '0';
      dateInput.value = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      descInput.value = '';
      selectedAccIds = [];
    }

    // Render account checkboxes
    if (accountsChecklist) {
      accountsChecklist.innerHTML = this.state.accounts.map((acc) => `
        <label class="goal-acc-checkbox-label">
          <input type="checkbox" value="${acc.id}" class="goal-acc-cb" ${selectedAccIds.includes(acc.id) ? 'checked' : ''}>
          <span>${acc.icon || '💰'} ${acc.name} (${this.calculateAccountBalance(acc.id).toLocaleString('ru-RU')} ₸)</span>
        </label>
      `).join('');
    }

    this.openModal('modal-goal');
  }

  bindGoalForm() {
    const form = document.getElementById('form-goal');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('goal-input-name').value.trim();
      const targetAmount = parseFloat(document.getElementById('goal-input-target').value);
      const currentAmount = parseFloat(document.getElementById('goal-input-current').value) || 0;
      const deadline = document.getElementById('goal-input-date').value;
      const description = document.getElementById('goal-input-desc').value.trim();

      const linkedAccountIds = Array.from(document.querySelectorAll('.goal-acc-cb:checked')).map((cb) => cb.value);

      if (!title || isNaN(targetAmount) || targetAmount <= 0) {
        this.showToast('Заполните корректное название и целевую сумму!', 'error');
        return;
      }

      if (this.editingGoalId) {
        const idx = this.state.goals.findIndex((g) => g.id === this.editingGoalId);
        if (idx !== -1) {
          this.state.goals[idx] = {
            ...this.state.goals[idx],
            title,
            targetAmount,
            currentAmount,
            deadline,
            description,
            linkedAccountIds
          };
          this.logActivity(`Обновлена цель накоплений: ${title}`);
          this.showToast('Цель обновлена', 'success');
        }
      } else {
        const newGoal = {
          id: 'goal_' + Date.now(),
          title,
          targetAmount,
          currentAmount,
          deadline,
          description,
          linkedAccountIds,
          createdAt: new Date().toISOString()
        };
        this.state.goals.push(newGoal);
        this.logActivity(`Создана новая цель: ${title}`);
        this.showToast('Новая цель создана', 'success');
      }

      this.saveState();
      this.closeModal('modal-goal');
      this.render();
    });
  }

  // 7. RECURRING TRANSACTIONS
  renderRecurringTab() {
    const container = document.getElementById('recurring-list-container');
    if (!container) return;

    if (!this.state.recurring || this.state.recurring.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">🔄</div>
          <div class="empty-state-title">Нет регулярных операций</div>
          <div class="empty-state-desc">Добавьте зарплату, аренду, стипендию или подписки, чтобы они напоминали о себе вовремя.</div>
          <button class="pixel-btn pixel-btn-amber pixel-btn-sm" onclick="app.openRecurringModal()">+ Добавить платёж</button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.state.recurring.map((rec) => {
      const acc = this.state.accounts.find((a) => a.id === rec.accountId);
      const cat = this.state.categories.find((c) => c.id === rec.categoryId);
      const isIncome = rec.type === 'income';

      return `
        <div class="tx-item" data-rec-id="${rec.id}">
          <div class="tx-left">
            <div class="tx-category-icon">${cat?.icon || (isIncome ? '💼' : '🔄')}</div>
            <div class="tx-details">
              <div class="tx-title">${rec.name}</div>
              <div class="tx-meta">
                <span>${rec.dayOfMonth}-е число каждого месяца</span>
                <span>• ${acc?.name || 'Счёт удалён — выберите новый'}</span>
                <span class="status-badge ${rec.status === 'active' ? 'confirmed' : 'planned'}">
                  ${rec.status === 'active' ? 'Активен' : 'На паузе'}
                </span>
              </div>
            </div>
          </div>
          <div class="d-flex align-center gap-2">
            <div class="tx-amount ${isIncome ? 'income' : 'expense'}">
              ${isIncome ? '+' : '-'}${Number(rec.amount).toLocaleString('ru-RU')} ₸
            </div>
            <div class="tx-actions">
              <button class="pixel-btn pixel-btn-sm pixel-btn-green btn-execute-recurring" data-id="${rec.id}" title="Провести операцию сейчас">
                ✓
              </button>
              <button class="pixel-btn pixel-btn-sm btn-edit-recurring" data-id="${rec.id}">✎</button>
              <button class="pixel-btn pixel-btn-sm pixel-btn-red btn-del-recurring" data-id="${rec.id}">✕</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind recurring actions
    container.querySelectorAll('.btn-execute-recurring').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.executeRecurring(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-edit-recurring').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openRecurringModal(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-del-recurring').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const rec = this.state.recurring.find((r) => r.id === id);
        this.confirmAction('Удаление регулярного платежа', `Удалить регулярный платёж «${rec?.name}»?`, () => {
          this.state.recurring = this.state.recurring.filter((r) => r.id !== id);
          this.logActivity(`Удалён регулярный платёж: ${rec?.name}`, 'warning');
          this.saveState();
          this.render();
          this.showToast('Платёж удалён', 'info');
        });
      });
    });
  }

  executeRecurring(recId) {
    const rec = this.state.recurring.find((r) => r.id === recId);
    if (!rec) return;

    if (!rec.accountId || !this.state.accounts.some((account) => account.id === rec.accountId)) {
      this.showToast('У регулярного платежа нет счёта. Откройте «✎» и выберите новый.', 'warning');
      return;
    }

    if (rec.type === 'expense') {
      const validation = this.validateDepositDebit(rec.accountId, rec.amount);
      if (!validation.allowed) {
        this.showToast(validation.reason, 'error');
        return;
      }
    }

    const tx = {
      id: 'tx_rec_' + Date.now(),
      type: rec.type,
      amount: rec.amount,
      date: new Date().toISOString().split('T')[0],
      accountId: rec.accountId,
      categoryId: rec.categoryId,
      note: `Регулярный платёж: ${rec.name}`,
      status: 'confirmed',
      createdAt: new Date().toISOString()
    };

    this.state.transactions.push(tx);
    this.logActivity(`Проведён регулярный платёж «${rec.name}» (${rec.amount.toLocaleString('ru-RU')} ₸)`);
    this.saveState();
    this.render();
    this.showToast(`Платёж «${rec.name}» успешно проведён!`, 'success');
  }

  openRecurringModal(recId = null) {
    this.editingRecurringId = recId;
    const title = document.getElementById('modal-recurring-title');
    const nameInput = document.getElementById('rec-input-name');
    const amtInput = document.getElementById('rec-input-amount');
    const typeSelect = document.getElementById('rec-input-type');
    const accSelect = document.getElementById('rec-input-account');
    const catSelect = document.getElementById('rec-input-category');
    const dayInput = document.getElementById('rec-input-day');

    accSelect.innerHTML = this.state.accounts.map((a) => `<option value="${a.id}">${a.icon || '💰'} ${a.name}</option>`).join('');
    catSelect.innerHTML = this.state.categories.map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

    if (recId) {
      const rec = this.state.recurring.find((r) => r.id === recId);
      if (rec) {
        title.textContent = 'Редактировать регулярный платёж';
        nameInput.value = rec.name;
        amtInput.value = rec.amount;
        typeSelect.value = rec.type;
        accSelect.value = rec.accountId;
        catSelect.value = rec.categoryId;
        dayInput.value = rec.dayOfMonth || 1;
      }
    } else {
      title.textContent = 'Новый регулярный платёж';
      nameInput.value = '';
      amtInput.value = '50000';
      typeSelect.value = 'expense';
      dayInput.value = 10;
    }

    this.openModal('modal-recurring');
  }

  bindRecurringForm() {
    const form = document.getElementById('form-recurring');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('rec-input-name').value.trim();
      const amount = parseFloat(document.getElementById('rec-input-amount').value);
      const type = document.getElementById('rec-input-type').value;
      const accountId = document.getElementById('rec-input-account').value;
      const categoryId = document.getElementById('rec-input-category').value;
      const dayOfMonth = parseInt(document.getElementById('rec-input-day').value, 10) || 1;

      if (!name || isNaN(amount) || amount <= 0) {
        this.showToast('Заполните корректное название и сумму!', 'error');
        return;
      }

      if (this.editingRecurringId) {
        const idx = this.state.recurring.findIndex((r) => r.id === this.editingRecurringId);
        if (idx !== -1) {
          this.state.recurring[idx] = {
            ...this.state.recurring[idx],
            name,
            amount,
            type,
            accountId,
            categoryId,
            dayOfMonth
          };
          this.logActivity(`Обновлён регулярный платёж: ${name}`);
          this.showToast('Платёж обновлён', 'success');
        }
      } else {
        const newRec = {
          id: 'rec_' + Date.now(),
          name,
          amount,
          type,
          accountId,
          categoryId,
          period: 'monthly',
          dayOfMonth,
          status: 'active'
        };
        if (!this.state.recurring) this.state.recurring = [];
        this.state.recurring.push(newRec);
        this.logActivity(`Создан регулярный платёж: ${name}`);
        this.showToast('Регулярный платёж добавлен', 'success');
      }

      this.saveState();
      this.closeModal('modal-recurring');
      this.render();
    });
  }

  // 8. PAYMENT CALENDAR
  renderCalendarTab() {
    const container = document.getElementById('calendar-timeline-container');
    const need7El = document.getElementById('calc-need-7d');
    const need30El = document.getElementById('calc-need-30d');
    if (!container) return;

    const timelineItems = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Recurring items upcoming in 30 days
    (this.state.recurring || []).filter((r) => r.status === 'active').forEach((rec) => {
      const targetDate = this.getNextMonthlyDate(rec.dayOfMonth, now);
      const daysUntil = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));

      timelineItems.push({
        id: rec.id,
        name: rec.name,
        amount: rec.amount,
        type: rec.type,
        dateStr: targetDate.toISOString().split('T')[0],
        daysUntil,
        source: 'recurring'
      });
    });

    // 2. Planned transactions
    this.state.transactions.filter((t) => t.status === 'planned' && t.date).forEach((tx) => {
      const txD = new Date(tx.date);
      const daysUntil = Math.ceil((txD - now) / (1000 * 60 * 60 * 24));
      timelineItems.push({
        id: tx.id,
        name: tx.note || 'Запланированная операция',
        amount: tx.amount,
        type: tx.type,
        dateStr: tx.date,
        daysUntil,
        source: 'planned'
      });
    });

    timelineItems.sort((a, b) => a.daysUntil - b.daysUntil);

    // Sum required for next 7 and 30 days
    let sum7 = 0;
    let sum30 = 0;
    timelineItems.forEach((item) => {
      if (item.type === 'expense') {
        if (item.daysUntil >= 0 && item.daysUntil <= 7) sum7 += Number(item.amount);
        if (item.daysUntil >= 0 && item.daysUntil <= 30) sum30 += Number(item.amount);
      }
    });

    if (need7El) need7El.textContent = `${sum7.toLocaleString('ru-RU')} ₸`;
    if (need30El) need30El.textContent = `${sum30.toLocaleString('ru-RU')} ₸`;

    if (timelineItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-title">Нет предстоящих платежей</div>
          <div class="empty-state-desc">Добавьте регулярные платежи или запланированные операции, чтобы видеть календарь расходов.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = timelineItems.map((item) => `
      <div class="timeline-row">
        <div>
          <div style="font-weight: 600; color: #fff;">${item.name}</div>
          <div style="font-size: 11px; color: var(--text-dim);">${item.dateStr} (${item.daysUntil >= 0 ? `через ${item.daysUntil} дн.` : 'просрочен'})</div>
        </div>
        <div class="d-flex align-center gap-2">
          <div class="amount-mono" style="font-size: 14px; font-weight: 600; color: ${item.type === 'income' ? 'var(--accent-green)' : 'var(--accent-red)'}">
            ${item.type === 'income' ? '+' : '-'}${Number(item.amount).toLocaleString('ru-RU')} ₸
          </div>
          <span class="status-badge planned">${item.source === 'recurring' ? 'Регулярный' : 'Запланирован'}</span>
        </div>
      </div>
    `).join('');
  }

  // 9. ANALYTICS
  renderAnalyticsTab() {
    const pieCanvas = document.getElementById('chart-categories-pie');
    const pieLegend = document.getElementById('chart-categories-legend');
    const currentTxs = this.getFilteredTransactions();
    const currentExpenses = currentTxs.filter((t) => t.type === 'expense' && t.status !== 'planned');

    const catSums = {};
    currentExpenses.forEach((t) => {
      catSums[t.categoryId] = (catSums[t.categoryId] || 0) + Number(t.amount);
    });

    const pieData = Object.entries(catSums).map(([catId, val]) => {
      const cat = this.state.categories.find((c) => c.id === catId);
      return {
        label: cat?.name || 'Другое',
        icon: cat?.icon || '📦',
        value: val,
        color: cat?.color || '#ef4444'
      };
    }).sort((a, b) => b.value - a.value);

    drawPixelPieChart(pieCanvas, pieData);

    if (pieLegend) {
      const totalExp = pieData.reduce((s, d) => s + d.value, 0);
      pieLegend.innerHTML = pieData.map((d) => {
        const pct = totalExp > 0 ? Math.round((d.value / totalExp) * 100) : 0;
        return `
          <div class="legend-item">
            <span class="legend-color-box" style="background: ${d.color};"></span>
            <span>${d.icon} ${d.label}: <strong class="amount-mono">${d.value.toLocaleString('ru-RU')} ₸</strong> (${pct}%)</span>
          </div>
        `;
      }).join('');
    }

    const barCanvas = document.getElementById('chart-monthly-bars');
    const monthsData = [];
    const monthShortNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const monthNamesFull = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    const projectionYear = this.state.settings.selectedYear;
    const projectionMonth = this.state.settings.selectedMonth;
    const projectionTitle = document.getElementById('chart-projection-title');

    for (let i = 0; i < 6; i++) {
      const d = new Date(projectionYear, projectionMonth - 1 + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;

      const txs = this.state.transactions.filter((t) => {
        if (!t.date) return false;
        const [ty, tm] = t.date.split('-').map(Number);
        return ty === y && tm === m && (i === 0 ? t.status !== 'planned' : t.status === 'planned');
      });

      const recurringForMonth = i === 0 ? [] : (this.state.recurring || []).filter((rec) => rec.status === 'active');
      const inc = txs.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
        + recurringForMonth.filter((rec) => rec.type === 'income').reduce((s, rec) => s + Number(rec.amount || 0), 0);
      const exp = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0)
        + recurringForMonth.filter((rec) => rec.type === 'expense').reduce((s, rec) => s + Number(rec.amount || 0), 0);

      monthsData.push({
        label: monthShortNames[m - 1],
        income: inc,
        expense: exp,
        isForecast: i > 0
      });
    }

    drawPixelBarChart(barCanvas, monthsData);
    if (projectionTitle) {
      const lastDate = new Date(projectionYear, projectionMonth - 1 + 5, 1);
      projectionTitle.textContent = `Доходы и расходы: ${monthNamesFull[projectionMonth - 1]} ${projectionYear} — ${monthNamesFull[lastDate.getMonth()]} ${lastDate.getFullYear()}`;
    }

    // Monthly peaks show the days on which the most money actually moved.
    const selectedYear = this.state.settings.selectedYear;
    const selectedMonth = this.state.settings.selectedMonth;
    const peaksTitle = document.getElementById('analytics-peaks-title');
    const peaksContainer = document.getElementById('analytics-peaks');
    const monthlyFlow = this.state.transactions
      .filter((tx) => {
        const [year, month] = (tx.date || '').split('-').map(Number);
        return year === selectedYear && month === selectedMonth && tx.status !== 'planned' && (tx.type === 'income' || tx.type === 'expense');
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    if (peaksTitle) peaksTitle.textContent = `Пики — ${monthNamesFull[selectedMonth - 1]} ${selectedYear}`;
    if (peaksContainer) {
      const dailyTotals = Object.values(monthlyFlow.reduce((days, tx) => {
        if (!days[tx.date]) days[tx.date] = { date: tx.date, income: 0, expense: 0 };
        days[tx.date][tx.type] += Number(tx.amount || 0);
        return days;
      }, {}));
      const topExpenseDays = dailyTotals.filter((day) => day.expense > 0).sort((a, b) => b.expense - a.expense).slice(0, 3);
      const topIncomeDays = dailyTotals.filter((day) => day.income > 0).sort((a, b) => b.income - a.income).slice(0, 3);
      const formatDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      const peakCard = (title, days, type) => {
        const colorClass = type === 'income' ? 'income' : 'expense';
        const peak = days[0];
        if (!peak) return `<div class="peak-card ${colorClass}"><span>${title}</span><strong>Нет операций</strong><small>В этом месяце пока пусто</small></div>`;
        const max = peak[type];
        return `
          <div class="peak-card ${colorClass}">
            <span>${title}</span>
            <strong class="amount-mono">${type === 'income' ? '+' : '-'}${max.toLocaleString('ru-RU')} ₸</strong>
            <small>${formatDate(peak.date)}</small>
          </div>
        `;
      };
      const dayRows = (days, type) => {
        const max = days[0]?.[type] || 1;
        if (!days.length) return '<div class="text-dim">Нет данных</div>';
        return days.map((day) => `
          <div class="peak-row ${type}">
            <span>${formatDate(day.date)}</span>
            <div class="peak-track"><div class="peak-fill" style="width:${Math.round((day[type] / max) * 100)}%"></div></div>
            <strong class="amount-mono">${day[type].toLocaleString('ru-RU')} ₸</strong>
          </div>
        `).join('');
      };
      peaksContainer.innerHTML = `
        <div class="peaks-summary">
          ${peakCard('Самый большой расход', topExpenseDays, 'expense')}
          ${peakCard('Самый большой доход', topIncomeDays, 'income')}
        </div>
        <div class="peaks-lists">
          <div><div class="peaks-list-title">Топ дней по расходам</div>${dayRows(topExpenseDays, 'expense')}</div>
          <div><div class="peaks-list-title">Топ дней по доходам</div>${dayRows(topIncomeDays, 'income')}</div>
        </div>
      `;
    }

    // Month over Month comparison
    const curYear = this.state.settings.selectedYear;
    const curMonth = this.state.settings.selectedMonth;

    let prevMonth = curMonth - 1;
    let prevYear = curYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear -= 1;
    }

    const curMonthTxs = this.state.transactions.filter((t) => {
      const [y, m] = (t.date || '').split('-').map(Number);
      return y === curYear && m === curMonth && t.status !== 'planned';
    });

    const prevMonthTxs = this.state.transactions.filter((t) => {
      const [y, m] = (t.date || '').split('-').map(Number);
      return y === prevYear && m === prevMonth && t.status !== 'planned';
    });

    const comparison = calculateMonthComparison(curMonthTxs, prevMonthTxs);
    const compBox = document.getElementById('analytics-month-diff-box');
    if (compBox) {
      compBox.innerHTML = `
        <div class="form-row two-col" style="font-size: 13px;">
          <div style="background: var(--bg-card-subtle); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="color: var(--text-muted); font-size: 12px;">Расходы по сравнению с прошлым месяцем:</div>
            <div class="amount-mono" style="font-size: 14px; font-weight: 700; color: ${comparison.isExpenseHigher ? 'var(--accent-red)' : 'var(--accent-green)'}; margin: 4px 0;">
              ${comparison.isExpenseHigher ? '▲ Больше на' : '▼ Меньше на'} ${Math.abs(comparison.diffExpense).toLocaleString('ru-RU')} ₸ (${comparison.pctExpense}%)
            </div>
            <div class="amount-mono" style="font-size: 11px; color: var(--text-dim);">Текущий: ${comparison.currentExpense.toLocaleString('ru-RU')} ₸ | Прошлый: ${comparison.prevExpense.toLocaleString('ru-RU')} ₸</div>
          </div>
          <div style="background: var(--bg-card-subtle); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="color: var(--text-muted); font-size: 12px;">Доходы по сравнению с прошлым месяцем:</div>
            <div class="amount-mono" style="font-size: 14px; font-weight: 700; color: ${comparison.isIncomeHigher ? 'var(--accent-green)' : 'var(--accent-red)'}; margin: 4px 0;">
              ${comparison.isIncomeHigher ? '▲ Больше на' : '▼ Меньше на'} ${Math.abs(comparison.diffIncome).toLocaleString('ru-RU')} ₸ (${comparison.pctIncome}%)
            </div>
            <div class="amount-mono" style="font-size: 11px; color: var(--text-dim);">Текущий: ${comparison.currentIncome.toLocaleString('ru-RU')} ₸ | Прошлый: ${comparison.prevIncome.toLocaleString('ru-RU')} ₸</div>
          </div>
        </div>
      `;
    }
  }

  // 10. ACTIVITY LOG TAB
  renderActivityTab() {
    const container = document.getElementById('activity-log-container');
    if (!container) return;

    if (!this.state.activityLog || this.state.activityLog.length === 0) {
      container.innerHTML = '<div class="text-dim text-center" style="padding:20px;">Журнал пуст</div>';
      return;
    }

    container.innerHTML = this.state.activityLog.map((item) => `
      <div class="activity-log-item">
        <div>
          <span style="color: #fff;">${item.text}</span>
        </div>
        <div class="amount-mono" style="font-size: 11px; color: var(--text-dim);">
          ${new Date(item.timestamp).toLocaleString('ru-RU')}
        </div>
      </div>
    `).join('');
  }

  // 11. SETTINGS TAB
  renderSettingsTab() {
    const listEl = document.getElementById('settings-categories-list');
    if (!listEl) return;

    listEl.innerHTML = this.state.categories.map((c) => `
      <div class="tx-item" style="padding: 6px 10px;">
        <div class="d-flex align-center gap-2">
          <span>${c.icon}</span>
          <span style="font-size: 13px; font-weight: 600;">${c.name}</span>
          <span class="status-badge ${c.type === 'income' ? 'confirmed' : 'planned'}">${c.type === 'income' ? 'Доход' : 'Расход'}</span>
        </div>
        <button class="pixel-btn pixel-btn-sm pixel-btn-red btn-del-cat" data-id="${c.id}">✕</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.btn-del-cat').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const cat = this.state.categories.find((c) => c.id === id);
        this.confirmAction('Удаление категории', `Удалить категорию «${cat?.name}»?`, () => {
          this.state.categories = this.state.categories.filter((c) => c.id !== id);
          this.logActivity(`Удалена категория: ${cat?.name}`, 'warning');
          this.saveState();
          this.render();
          this.showToast('Категория удалена', 'info');
        });
      });
    });

    const cfg = getSavedFirebaseConfig();
    const fbInput = document.getElementById('firebase-config-json');
    if (fbInput && cfg) {
      fbInput.value = JSON.stringify(cfg, null, 2);
    }
  }

  bindCategoryForm() {
    const form = document.getElementById('form-add-category');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('cat-input-name').value.trim();
      const icon = document.getElementById('cat-input-icon').value.trim() || '🏷️';
      const type = document.getElementById('cat-input-type').value;
      const color = document.getElementById('cat-input-color').value;

      if (!name) return;

      const newCat = {
        id: 'cat_' + Date.now(),
        name,
        icon,
        type,
        color
      };

      this.state.categories.push(newCat);
      this.logActivity(`Создана категория: ${name}`);
      this.saveState();
      this.render();
      document.getElementById('cat-input-name').value = '';
      this.showToast('Категория добавлена', 'success');
    });
  }

  bindSettingsForm() {
    document.getElementById('btn-save-firebase-cfg')?.addEventListener('click', async () => {
      const raw = document.getElementById('firebase-config-json')?.value.trim();
      if (!raw) {
        clearFirebaseConfig();
        this.showToast('Конфиг Firebase очищен. Включён локальный режим.', 'info');
        return;
      }
      try {
        const parsed = parseFirebaseConfigInput(raw);
        saveFirebaseConfig(parsed);
        await initFirebase(parsed);
        this.showToast('Конфигурация Firebase успешно сохранена!', 'success');
      } catch (err) {
        this.showToast(`Ошибка конфигурации Firebase: ${err.message}`, 'error');
      }
    });
  }

  // Backup & Restore
  bindBackupRestore() {
    const exportHandler = () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.state, null, 2));
      const downloadAnchor = document.createElement('a');
      const filename = `budget_planner_backup_${new Date().toISOString().split('T')[0]}.json`;
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.logActivity('Создана резервная копия данных (JSON)');
      this.showToast('Резервная копия скачана в JSON', 'success');
    };

    document.getElementById('btn-export-json')?.addEventListener('click', exportHandler);
    document.getElementById('btn-quick-export')?.addEventListener('click', exportHandler);

    const fileInput = document.getElementById('input-import-json');
    document.getElementById('btn-import-json')?.addEventListener('click', () => fileInput?.click());
    document.getElementById('btn-quick-import')?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (!imported.accounts || !imported.transactions) {
            throw new Error('Некорректный формат файла резервной копии');
          }
          this.confirmAction('Восстановление данных', 'Восстановить все данные из резервной копии? Текущие данные будут заменены.', () => {
            this.state = imported;
            this.logActivity('Данные восстановлены из резервной копии JSON');
            this.saveState();
            this.render();
            this.showToast('Данные успешно восстановлены из копии', 'success');
          });
        } catch (err) {
          this.showToast(`Ошибка восстановления: ${err.message}`, 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new BudgetApp();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('ServiceWorker registered'))
        .catch((err) => console.warn('ServiceWorker error:', err));
    });
  }
});
