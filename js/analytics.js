/**
 * Modern Analytics & Charts Engine
 * Smooth Canvas Visualizations for Expenses, Income, Deposits and Trends
 */

export const MODERN_PALETTE = [
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f43f5e', // rose
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#eab308'  // yellow
];

/**
 * Draws a modern doughnut chart on an HTML5 canvas
 */
export function drawPixelPieChart(canvas, dataItems) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement.clientWidth || 300;
  const height = 260;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const total = dataItems.reduce((acc, item) => acc + item.value, 0);

  if (total <= 0 || dataItems.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Нет данных о расходах', width / 2, height / 2);
    return;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) - 22;
  const innerRadius = radius * 0.58;

  const sliceMeta = [];
  let activeIndex = -1;

  const drawChart = () => {
    ctx.clearRect(0, 0, width, height);
    let startAngle = -Math.PI / 2;

    dataItems.forEach((item, index) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    const color = item.color || MODERN_PALETTE[index % MODERN_PALETTE.length];
    const isActive = index === activeIndex;
    const middleAngle = startAngle + sliceAngle / 2;
    const popOut = isActive ? 8 : 0;
    const outerRadius = radius + (isActive ? 5 : 0);
    const offsetX = Math.cos(middleAngle) * popOut;
    const offsetY = Math.sin(middleAngle) * popOut;

    ctx.beginPath();
    ctx.arc(centerX + offsetX, centerY + offsetY, outerRadius, startAngle, endAngle);
    ctx.arc(centerX + offsetX, centerY + offsetY, innerRadius, endAngle, startAngle, true);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    // Subtle clean border between slices
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0e1118';
    ctx.stroke();

    sliceMeta[index] = { startAngle, endAngle };

    startAngle = endAngle;
    });

    // Center cutout circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius - 1, 0, Math.PI * 2);
    ctx.fillStyle = '#121620';
    ctx.fill();
    ctx.strokeStyle = '#212638';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center text changes to the highlighted category.
    const activeItem = dataItems[activeIndex];
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(activeItem ? activeItem.label.toUpperCase().slice(0, 18) : 'ВСЕГО ТРАТ', centerX, centerY - 8);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 16px Inter, -apple-system, sans-serif';
    const shownValue = activeItem ? activeItem.value : total;
    const totalStr = shownValue > 999999 ? `${(shownValue / 1000000).toFixed(2)} млн ₸` : `${Math.round(shownValue).toLocaleString('ru-RU')} ₸`;
    ctx.fillText(totalStr, centerX, centerY + 14);
  };

  const findSlice = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - centerX;
    const y = event.clientY - rect.top - centerY;
    const distance = Math.hypot(x, y);
    if (distance < innerRadius || distance > radius + 14) return -1;

    let angle = Math.atan2(y, x);
    if (angle < -Math.PI / 2) angle += Math.PI * 2;
    return sliceMeta.findIndex(({ startAngle, endAngle }) => angle >= startAngle && angle <= endAngle);
  };

  canvas.onmousemove = (event) => {
    const nextActiveIndex = findSlice(event);
    if (nextActiveIndex === activeIndex) return;
    activeIndex = nextActiveIndex;
    canvas.style.cursor = activeIndex >= 0 ? 'pointer' : 'default';
    const item = dataItems[activeIndex];
    canvas.title = item ? `${item.label}: ${Number(item.value).toLocaleString('ru-RU')} ₸` : '';
    drawChart();
  };

  canvas.onmouseleave = () => {
    if (activeIndex < 0) return;
    activeIndex = -1;
    canvas.style.cursor = 'default';
    canvas.title = '';
    drawChart();
  };

  drawChart();
}

/**
 * Draws a modern monthly comparison bar chart (Income vs Expense)
 */
export function drawPixelBarChart(canvas, monthsData, { labelEvery = 1 } = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement.clientWidth || 320;
  const height = 260;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  if (!monthsData || monthsData.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '14px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Нет операций за период', width / 2, height / 2);
    return;
  }

  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // Find max value for Y axis scale
  let maxVal = 1000;
  monthsData.forEach((d) => {
    maxVal = Math.max(maxVal, d.income || 0, d.expense || 0);
  });
  maxVal = Math.ceil(maxVal * 1.15);

  // Draw grid lines
  ctx.strokeStyle = '#1e2436';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);

  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const yVal = (maxVal / steps) * i;
    const yPos = paddingTop + chartH - (i / steps) * chartH;

    ctx.beginPath();
    ctx.moveTo(paddingLeft, yPos);
    ctx.lineTo(paddingLeft + chartW, yPos);
    ctx.stroke();

    // Y Axis label
    ctx.fillStyle = '#64748b';
    ctx.font = '11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    const label = yVal >= 1000000 ? `${(yVal / 1000000).toFixed(1)}M` : yVal >= 1000 ? `${Math.round(yVal / 1000)}k` : `${Math.round(yVal)}`;
    ctx.fillText(label, paddingLeft - 8, yPos + 4);
  }
  ctx.setLineDash([]);

  // Draw bottom axis
  ctx.strokeStyle = '#283048';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartH);
  ctx.lineTo(paddingLeft + chartW, paddingTop + chartH);
  ctx.stroke();

  // Draw Bars
  const barGroupWidth = chartW / monthsData.length;
  const barWidth = Math.max(2, Math.min(22, (barGroupWidth - 5) / 2));

  // Helper for drawing rounded bar tops
  const drawRoundedBar = (x, y, w, h, fillStyle) => {
    if (h <= 0) return;
    const r = Math.min(4, w / 2, h);
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  };

  monthsData.forEach((item, index) => {
    const groupCenter = paddingLeft + index * barGroupWidth + barGroupWidth / 2;

    const incH = Math.max(0, ((item.income || 0) / maxVal) * chartH);
    const expH = Math.max(0, ((item.expense || 0) / maxVal) * chartH);

    // Income Bar (Green)
    const incX = groupCenter - barWidth - 3;
    const incY = paddingTop + chartH - incH;
    drawRoundedBar(incX, incY, barWidth, incH, '#10b981');

    // Expense Bar (Rose)
    const expX = groupCenter + 3;
    const expY = paddingTop + chartH - expH;
    drawRoundedBar(expX, expY, barWidth, expH, '#f43f5e');

    // Date/month label. Daily charts show a label every few days to stay readable.
    if (index % labelEvery === 0 || index === monthsData.length - 1) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 11px Inter, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label || item.month, groupCenter, height - 12);
    }
  });
}

/**
 * Calculates month-over-month differences
 */
export function calculateMonthComparison(currentMonthTxs, previousMonthTxs) {
  const currentExpense = currentMonthTxs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const prevExpense = previousMonthTxs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const currentIncome = currentMonthTxs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const prevIncome = previousMonthTxs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const diffExpense = currentExpense - prevExpense;
  const pctExpense = prevExpense > 0 ? ((diffExpense / prevExpense) * 100).toFixed(1) : (currentExpense > 0 ? '+100' : '0');

  const diffIncome = currentIncome - prevIncome;
  const pctIncome = prevIncome > 0 ? ((diffIncome / prevIncome) * 100).toFixed(1) : (currentIncome > 0 ? '+100' : '0');

  return {
    currentExpense,
    prevExpense,
    diffExpense,
    pctExpense,
    isExpenseHigher: diffExpense > 0,
    currentIncome,
    prevIncome,
    diffIncome,
    pctIncome,
    isIncomeHigher: diffIncome > 0
  };
}
