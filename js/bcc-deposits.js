/**
 * BCC Deposits Calculation and Rules Module
 * Bank CenterCredit (Казахстан) - Модели «Моя цель» и «Чемпион»
 */

export const BCC_DEPOSIT_TYPES = {
  MY_GOAL: {
    id: 'my_goal',
    name: '«Моя цель» (BCC)',
    defaultTermMonths: 3,
    defaultNominalRate: 16.7,
    defaultEffectiveRate: 18.06,
    currency: '₸',
    allowsWithdrawal: false,
    allowsReplenishment: true,
    minBalance: 0,
    withdrawalWarning: 'Частичное снятие недоступно по условиям вклада «Моя цель»!',
    description: 'Вклад на 3 месяца с максимальной доходностью и запретом на частичное снятие'
  },
  CHAMPION: {
    id: 'champion',
    name: '«Чемпион» (BCC)',
    defaultTermMonths: 6,
    defaultNominalRate: 14.2,
    defaultEffectiveRate: 15.17,
    currency: '₸',
    allowsWithdrawal: true,
    allowsReplenishment: true,
    minBalance: 1000,
    withdrawalWarning: 'Внимание: неснижаемый остаток составляет 1 000 ₸. Снятие ниже остатка приведёт к закрытию депозита.',
    description: 'Гибкий депозит с возможностью пополнений и частичных снятий до неснижаемого остатка'
  }
};

/**
 * Calculates end date based on start date and months
 */
export function calculateMaturityDate(startDateStr, termMonths) {
  const d = new Date(startDateStr);
  if (isNaN(d.getTime())) return new Date();
  const target = new Date(d);
  target.setMonth(target.getMonth() + parseInt(termMonths, 10));
  return target;
}

/**
 * Days remaining until maturity
 */
export function getDaysRemaining(endDateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr);
  end.setHours(0, 0, 0, 0);
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates monthly interest payout based on nominal rate and current balance
 */
export function calculateMonthlyInterestAccrual(nominalRate, currentBalance) {
  const p = Math.max(0, Number(currentBalance) || 0);
  const r = Math.max(0, Number(nominalRate) || 0) / 100;
  return Math.round(p * (r / 12));
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
    disclaimer: 'Проценты рассчитываются как прогноз с ежемесячной капитализацией и могут незначительно отличаться от банковской выписки BCC.'
  };
}

/**
 * Validates a withdrawal from a BCC deposit
 */
export function validateDepositWithdrawal(deposit, amount, currentBalance) {
  const typeConfig = deposit.subType === 'my_goal'
    ? BCC_DEPOSIT_TYPES.MY_GOAL
    : BCC_DEPOSIT_TYPES.CHAMPION;
  
  if (!typeConfig.allowsWithdrawal) {
    return {
      allowed: false,
      reason: `По вкладу «${deposit.name}» частичные снятия запрещены условиями банка!`
    };
  }

  // Use dynamic account balance if provided, else fallback to deposit.balance or initialBalance
  const balance = (currentBalance !== undefined && currentBalance !== null)
    ? Number(currentBalance)
    : (Number(deposit.balance) || Number(deposit.initialBalance) || 0);

  const minBal = typeConfig.minBalance || 0;
  const remaining = balance - Number(amount);

  if (remaining < minBal) {
    return {
      allowed: false,
      reason: `Недостаточно средств. Минимальный неснижаемый остаток по вкладу: ${minBal.toLocaleString('ru-RU')} ₸. Доступно к снятию: ${Math.max(0, balance - minBal).toLocaleString('ru-RU')} ₸.`
    };
  }

  return { allowed: true };
}
