/**
 * BCC & Kazakhstan Deposits Calculation, Presets, and Rules Module
 * Bank CenterCredit (BCC), Kaspi Bank, Halyk Bank, ForteBank, Custom
 */

export const DEPOSIT_PRESETS = {
  bcc_goal: {
    id: 'bcc_goal',
    name: 'BCC «Моя цель»',
    bank: 'bcc',
    bankName: 'Банк ЦентрКредит',
    badgeText: 'BCC',
    badgeBg: '#194C38',
    termMonths: 3,
    nominalRate: 16.7,
    effectiveRate: 18.06,
    currency: '₸',
    allowsWithdrawal: false,
    allowsReplenishment: true,
    minBalance: 0,
    icon: '🏦',
    description: 'Вклад на 3 месяца с максимальной доходностью (18.06% ГЭСВ) без частичного снятия'
  },
  bcc_champ: {
    id: 'bcc_champ',
    name: 'BCC «Чемпион»',
    bank: 'bcc',
    bankName: 'Банк ЦентрКредит',
    badgeText: 'BCC',
    badgeBg: '#194C38',
    termMonths: 6,
    nominalRate: 14.2,
    effectiveRate: 15.17,
    currency: '₸',
    allowsWithdrawal: true,
    allowsReplenishment: true,
    minBalance: 1000,
    icon: '🏆',
    description: 'Гибкий вклад с пополнением и частичным снятием от 1 000 ₸ (15.17% ГЭСВ)'
  },
  kaspi_dep: {
    id: 'kaspi_dep',
    name: 'Kaspi Депозит',
    bank: 'kaspi',
    bankName: 'Kaspi Bank',
    badgeText: 'Kaspi',
    badgeBg: '#82131C',
    termMonths: 12,
    nominalRate: 13.2,
    effectiveRate: 14.0,
    currency: '₸',
    allowsWithdrawal: true,
    allowsReplenishment: true,
    minBalance: 1000,
    icon: '🔴',
    description: 'Свободное снятие и пополнение без ограничений 24/7 (14.0% ГЭСВ)'
  },
  halyk_dep: {
    id: 'halyk_dep',
    name: 'Halyk «Универсальный»',
    bank: 'halyk',
    bankName: 'Halyk Bank',
    badgeText: 'Halyk',
    badgeBg: '#004D3C',
    termMonths: 12,
    nominalRate: 13.6,
    effectiveRate: 14.5,
    currency: '₸',
    allowsWithdrawal: true,
    allowsReplenishment: true,
    minBalance: 1000,
    icon: '🟢',
    description: 'Классический надёжный вклад с капитализацией (14.5% ГЭСВ)'
  },
  forte_dep: {
    id: 'forte_dep',
    name: 'Forte «Сберегательный»',
    bank: 'forte',
    bankName: 'ForteBank',
    badgeText: 'Forte',
    badgeBg: '#3E0C25',
    termMonths: 6,
    nominalRate: 16.2,
    effectiveRate: 17.5,
    currency: '₸',
    allowsWithdrawal: false,
    allowsReplenishment: true,
    minBalance: 0,
    icon: '🟣',
    description: 'Повышенная ставка без частичного снятия на 6 месяцев (17.5% ГЭСВ)'
  },
  custom_dep: {
    id: 'custom_dep',
    name: 'Свой вклад',
    bank: 'custom',
    bankName: 'Свой банк',
    badgeText: 'Вклад',
    badgeBg: '#465948',
    termMonths: 6,
    nominalRate: 15.0,
    effectiveRate: 16.0,
    currency: '₸',
    allowsWithdrawal: true,
    allowsReplenishment: true,
    minBalance: 1000,
    icon: '💰',
    description: 'Индивидуальные параметры ставки, срока и правил снятия'
  }
};

export const BCC_DEPOSIT_TYPES = {
  MY_GOAL: DEPOSIT_PRESETS.bcc_goal,
  CHAMPION: DEPOSIT_PRESETS.bcc_champ
};

/**
 * Returns theme colors and badges for any deposit
 */
export function getDepositTheme(deposit) {
  const bank = deposit.bank || (deposit.subType && deposit.subType.includes('bcc') ? 'bcc' : 'bcc');
  const nameLower = (deposit.name || '').toLowerCase();

  if (bank === 'kaspi' || nameLower.includes('kaspi')) {
    return {
      bankKey: 'kaspi',
      bankName: 'Kaspi Bank',
      badgeText: 'Kaspi',
      badgeBg: '#82131C',
      badgeTextColor: '#FFFFFF',
      accentColor: '#82131C',
      icon: '🔴'
    };
  }
  if (bank === 'halyk' || nameLower.includes('halyk')) {
    return {
      bankKey: 'halyk',
      bankName: 'Halyk Bank',
      badgeText: 'Halyk',
      badgeBg: '#004D3C',
      badgeTextColor: '#FFFFFF',
      accentColor: '#004D3C',
      icon: '🟢'
    };
  }
  if (bank === 'forte' || nameLower.includes('forte')) {
    return {
      bankKey: 'forte',
      bankName: 'ForteBank',
      badgeText: 'Forte',
      badgeBg: '#3E0C25',
      badgeTextColor: '#FFFFFF',
      accentColor: '#3E0C25',
      icon: '🟣'
    };
  }
  if (bank === 'jusan' || nameLower.includes('jusan')) {
    return {
      bankKey: 'jusan',
      bankName: 'Jusan Bank',
      badgeText: 'Jusan',
      badgeBg: '#E05A2B',
      badgeTextColor: '#FFFFFF',
      accentColor: '#E05A2B',
      icon: '🟠'
    };
  }
  if (bank === 'custom') {
    return {
      bankKey: 'custom',
      bankName: 'Банковский вклад',
      badgeText: 'Вклад',
      badgeBg: '#465948',
      badgeTextColor: '#FFFFFF',
      accentColor: '#465948',
      icon: '💰'
    };
  }

  // Default BCC
  return {
    bankKey: 'bcc',
    bankName: 'Банк ЦентрКредит',
    badgeText: 'BCC',
    badgeBg: '#194C38',
    badgeTextColor: '#FFFFFF',
    accentColor: '#194C38',
    icon: '🏦'
  };
}

/**
 * Calculates end date based on start date and months
 */
export function calculateMaturityDate(startDateStr, termMonths) {
  const d = new Date(startDateStr || Date.now());
  if (isNaN(d.getTime())) return new Date();
  const target = new Date(d);
  target.setMonth(target.getMonth() + parseInt(termMonths, 10));
  return target;
}

/**
 * Days remaining until maturity
 */
export function getDaysRemaining(endDateStr) {
  if (!endDateStr) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr);
  end.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates monthly interest payout based on rate and balance (works regardless of argument order)
 */
export function calculateMonthlyInterestAccrual(paramA, paramB) {
  const a = Math.max(0, Number(paramA) || 0);
  const b = Math.max(0, Number(paramB) || 0);
  // (balance * (rate / 100)) / 12 = (a * b) / 1200
  return Math.round((a * b) / 1200);
}

/**
 * Computes next monthly capitalization date
 */
export function calculateNextPayoutDate(startDateStr) {
  if (!startDateStr) return null;
  const start = new Date(startDateStr);
  const now = new Date();
  const targetDay = start.getDate();
  
  const nextPayout = new Date(now.getFullYear(), now.getMonth(), targetDay);
  if (nextPayout < now) {
    nextPayout.setMonth(nextPayout.getMonth() + 1);
  }
  return nextPayout.toISOString().split('T')[0];
}

/**
 * Projects deposit earnings with monthly capitalization and optional monthly replenishment
 */
export function calculateDepositForecast({
  principal,
  nominalRate,
  termMonths,
  monthlyTopUp = 0,
  startDate,
  endDate
}) {
  const p = Math.max(0, Number(principal) || 0);
  const rate = Math.max(0, Number(nominalRate) || 0) / 100;
  const months = Math.max(1, parseInt(termMonths, 10) || 3);
  const topUp = Math.max(0, Number(monthlyTopUp) || 0);

  const monthlyRate = rate / 12;

  let currentSum = p;
  let totalInterest = 0;
  const schedule = [];

  const startD = startDate ? new Date(startDate) : new Date();

  for (let m = 1; m <= months; m++) {
    const interest = currentSum * monthlyRate;
    totalInterest += interest;
    currentSum += interest + topUp;

    const monthDate = new Date(startD);
    monthDate.setMonth(monthDate.getMonth() + m);

    schedule.push({
      month: m,
      date: monthDate.toISOString().split('T')[0],
      interestAccrued: Math.round(interest),
      topUp: Math.round(topUp),
      endBalance: Math.round(currentSum)
    });
  }

  const finalAmount = Math.round(currentSum);
  const totalReward = Math.round(totalInterest);

  const endD = endDate ? new Date(endDate) : calculateMaturityDate(startDate || new Date().toISOString(), months);
  const daysLeft = getDaysRemaining(endD.toISOString().split('T')[0]);

  return {
    principal: p,
    nominalRate: Number(nominalRate),
    termMonths: months,
    totalReward,
    finalAmount,
    monthlyTopUp: topUp,
    daysLeft,
    isNearMaturity: daysLeft <= 14 && daysLeft >= 0,
    isExpired: daysLeft < 0,
    schedule,
    disclaimer: 'Проценты рассчитываются с ежемесячной капитализацией (сложный процент).'
  };
}

/**
 * Validates a withdrawal from any deposit
 */
export function validateDepositWithdrawal(deposit, amount, currentBalance) {
  if (deposit.allowsWithdrawal === false) {
    return {
      allowed: false,
      reason: `По вкладу «${deposit.name}» частичное снятие запрещено условиями договора! Чтобы забрать средства, вклад можно закрыть досрочно.`
    };
  }

  const balance = (currentBalance !== undefined && currentBalance !== null)
    ? Number(currentBalance)
    : (Number(deposit.balance) || Number(deposit.initialBalance) || 0);

  const minBal = Number(deposit.minBalance || 0);
  const amt = Number(amount) || 0;

  if (amt <= 0) {
    return {
      allowed: false,
      reason: 'Укажите корректную сумму для снятия.'
    };
  }

  const remaining = balance - amt;

  if (remaining < minBal) {
    const maxAvailable = Math.max(0, balance - minBal);
    return {
      allowed: false,
      reason: `Недостаточно средств. Неснижаемый остаток: ${minBal.toLocaleString('ru-RU')} ₸. Максимально доступно для снятия: ${maxAvailable.toLocaleString('ru-RU')} ₸.`
    };
  }

  return { allowed: true };
}
