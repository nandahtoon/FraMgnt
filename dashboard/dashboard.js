/**
 * dashboard.js — 360° Financial & Sales Analytics Dashboard
 * Renders 360 degree Analysis for Sales, Revenue & Expenses + Module KPIs & Charts
 */

const Dashboard = (() => {
  let _config = null;
  let _charts = {};

  const CHART_PALETTE = [
    '#6C63FF','#00D4AA','#FF9F43','#FF6B6B','#48DBFB',
    '#FF9FF3','#54A0FF','#5F27CD','#01CBC6','#EE5A24'
  ];

  function init(config) {
    _config = config;
  }

  // ──────────────── MAIN RENDER ────────────────

  function render(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const dash = _config.dashboard;

    el.innerHTML = `
      <div class="dashboard-header">
        <div>
          <h2 class="page-title">🌐 360° Financial & Sales Analytics</h2>
          <p class="page-subtitle">Holistic evaluation of Gross Sales, Revenue Streams, Operating Expenses & Profit Margins</p>
        </div>
        <div class="dashboard-controls" style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
          <select id="dash-module-filter" class="form-control dash-module-filter" style="width:auto" onchange="Dashboard.filterModule(this.value)">
            <option value="360-financial" selected>🌐 360° Financial Suite (Sales, Revenue & Expenses)</option>
            <option value="all">📊 All Modules Combined</option>
            ${_config.modules.filter(m => m.enabled).map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join('')}
          </select>
          <button class="btn btn-ghost" onclick="Dashboard.refresh()">🔄 Refresh</button>
        </div>
      </div>

      <!-- 360 / Module KPI Cards -->
      <div class="kpi-grid" id="dash-kpis"></div>

      <!-- 360 / Module Charts Grid -->
      <div class="chart-grid" id="dash-charts"></div>

      <!-- 360 Financial Matrix Section (Appears in 360 Mode) -->
      <div id="dash-360-table-container" style="margin-top:1.5rem"></div>
    `;

    filterModule('360-financial');
  }

  // ──────────────── 360 METRICS COMPUTATION ────────────────

  function _parseDateString(dStr) {
    if (!dStr) return new Date();
    // Handle Excel serial date numbers (e.g., 46214)
    if (!isNaN(dStr) && Number(dStr) > 30000 && Number(dStr) < 70000) {
      const excelEpoch = new Date(1899, 11, 30);
      const days = Number(dStr);
      return new Date(excelEpoch.getTime() + days * 86400000);
    }
    let dObj = new Date(dStr);
    if (isNaN(dObj.getTime())) {
      const match = String(dStr).match(/\d{4}-\d{2}-\d{2}/);
      if (match) dObj = new Date(match[0]);
    }
    return isNaN(dObj.getTime()) ? new Date() : dObj;
  }

  function _getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  function _computeSalesTimeBreakdown(salesItems) {
    const dailyMap = {};
    const weeklyMap = {};
    const monthlyMap = {};

    salesItems.forEach(r => {
      let dStr = String(r.date || r._createdAt || '').trim();
      if (!dStr) return;

      const dObj = _parseDateString(dStr);
      const isoDate = dObj.toISOString().split('T')[0]; // YYYY-MM-DD
      const monthStr = isoDate.slice(0, 7); // YYYY-MM
      const weekNum = _getWeekNumber(dObj);
      const weekStr = `${dObj.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

      const val = parseFloat(r.total_sales || r.total) || 0;
      const qty = parseFloat(r.quantity_sold || r.quantity) || 1;

      // Daily
      dailyMap[isoDate] = dailyMap[isoDate] || { date: isoDate, sales: 0, count: 0, items: 0 };
      dailyMap[isoDate].sales += val;
      dailyMap[isoDate].count += 1;
      dailyMap[isoDate].items += qty;

      // Weekly
      weeklyMap[weekStr] = weeklyMap[weekStr] || { week: weekStr, sales: 0, count: 0, items: 0 };
      weeklyMap[weekStr].sales += val;
      weeklyMap[weekStr].count += 1;
      weeklyMap[weekStr].items += qty;

      // Monthly
      monthlyMap[monthStr] = monthlyMap[monthStr] || { month: monthStr, sales: 0, count: 0, items: 0 };
      monthlyMap[monthStr].sales += val;
      monthlyMap[monthStr].count += 1;
      monthlyMap[monthStr].items += qty;
    });

    const dailyList = Object.keys(dailyMap).sort().map(k => dailyMap[k]);
    const weeklyList = Object.keys(weeklyMap).sort().map(k => weeklyMap[k]);
    const monthlyList = Object.keys(monthlyMap).sort().map(k => monthlyMap[k]);

    const latestDaily = dailyList.length ? dailyList[dailyList.length - 1] : { date: 'Today', sales: 0, count: 0 };
    const latestWeekly = weeklyList.length ? weeklyList[weeklyList.length - 1] : { week: 'This Week', sales: 0, count: 0 };
    const latestMonthly = monthlyList.length ? monthlyList[monthlyList.length - 1] : { month: 'This Month', sales: 0, count: 0 };

    return {
      dailyList,
      weeklyList,
      monthlyList,
      latestDaily,
      latestWeekly,
      latestMonthly
    };
  }

  // ──────────────── FINANCIAL MATRIX METRICS ────────────────

  let _activeHorizon = 'monthly';

  function setHorizon(horizon) {
    _activeHorizon = horizon;
    renderKPIs('360-financial');
    const tableContainer = document.getElementById('dash-360-table-container');
    if (tableContainer) {
      const matrix = _computeFinancialMatrixMetrics();
      tableContainer.innerHTML = _build360TableHTML(matrix);
    }
  }

  function _mapExpenseCategory(r) {
    const cat = String(r.category || r.item_name || '').toLowerCase();
    if (cat.includes('produce') || cat.includes('fruit') || cat.includes('veg') || cat.includes('onion') || cat.includes('berry') || cat.includes('melon') || cat.includes('fresh')) {
      return 'W_Produce';
    }
    if (cat.includes('container') || cat.includes('pack') || cat.includes('box') || cat.includes('tray') || cat.includes('cup') || cat.includes('plastic') || cat.includes('lid') || cat.includes('bag')) {
      return 'W_Container';
    }
    if (cat.includes('gfi') || cat.includes('ingredient') || cat.includes('grocery') || cat.includes('spice') || cat.includes('sauce') || cat.includes('oil') || cat.includes('dressing')) {
      return 'W_GFI';
    }
    if (cat.includes('wage') || cat.includes('labour') || cat.includes('labor') || cat.includes('payroll') || cat.includes('staff') || cat.includes('salary')) {
      return 'Wages/LabourCost';
    }
    return 'W_OtherCost';
  }

  function _emptyBucket(key) {
    return {
      periodKey: key,
      W_Sale: 0,
      W_Deposit: 0,
      W_Produce: 0,
      W_Container: 0,
      W_GFI: 0,
      W_Profits: 0,
      wagesLabourCost: 0,
      W_OtherCost: 0,
      NET_Profits: 0
    };
  }

  function _computeFinancialMatrixMetrics() {
    const salesItems = Store.getAll('sales');
    const purchaseItems = Store.getAll('purchase');
    const statementItems = Store.getAll('statement');

    const timeMaps = {
      daily: {},
      weekly: {},
      monthly: {},
      yearly: {}
    };

    function _initBucket(map, key) {
      if (!map[key]) {
        map[key] = _emptyBucket(key);
      }
      return map[key];
    }

    // 1. Sales Data
    salesItems.forEach(r => {
      const dObj = _parseDateString(r.date || r._createdAt);
      const val = parseFloat(r.total_sales || r.total) || 0;

      const dailyKey = dObj.toISOString().split('T')[0];
      const weekNum = _getWeekNumber(dObj);
      const weeklyKey = `${dObj.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      const monthlyKey = dailyKey.slice(0, 7);
      const yearlyKey = String(dObj.getFullYear());

      _initBucket(timeMaps.daily, dailyKey).W_Sale += val;
      _initBucket(timeMaps.weekly, weeklyKey).W_Sale += val;
      _initBucket(timeMaps.monthly, monthlyKey).W_Sale += val;
      _initBucket(timeMaps.yearly, yearlyKey).W_Sale += val;
    });

    // 2. Purchases / Expenses
    purchaseItems.forEach(r => {
      const dObj = _parseDateString(r.date || r._createdAt);
      const val = parseFloat(r.total_price || r.total) || 0;
      const expType = _mapExpenseCategory(r);

      const dailyKey = dObj.toISOString().split('T')[0];
      const weekNum = _getWeekNumber(dObj);
      const weeklyKey = `${dObj.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      const monthlyKey = dailyKey.slice(0, 7);
      const yearlyKey = String(dObj.getFullYear());

      [timeMaps.daily[dailyKey], timeMaps.weekly[weeklyKey], timeMaps.monthly[monthlyKey], timeMaps.yearly[yearlyKey]].forEach(b => {
        if (!b) return;
        if (expType === 'W_Produce') b.W_Produce += val;
        else if (expType === 'W_Container') b.W_Container += val;
        else if (expType === 'W_GFI') b.W_GFI += val;
        else if (expType === 'Wages/LabourCost') b.wagesLabourCost += val;
        else b.W_OtherCost += val;
      });
    });

    // 3. Statements Data
    statementItems.forEach(r => {
      const dObj = _parseDateString(r.date_issued || r.date || r._createdAt);
      const gross = parseFloat(r.gross_sales) || 0;
      const deposit = parseFloat(r.net_pay) || 0;
      const deductions = Math.abs(parseFloat(r.deductions) || 0) + Math.abs(parseFloat(r.insurance) || 0);

      const dailyKey = dObj.toISOString().split('T')[0];
      const weekNum = _getWeekNumber(dObj);
      const weeklyKey = `${dObj.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      const monthlyKey = dailyKey.slice(0, 7);
      const yearlyKey = String(dObj.getFullYear());

      [
        _initBucket(timeMaps.daily, dailyKey),
        _initBucket(timeMaps.weekly, weeklyKey),
        _initBucket(timeMaps.monthly, monthlyKey),
        _initBucket(timeMaps.yearly, yearlyKey)
      ].forEach(b => {
        b.W_Deposit += deposit;
        b.W_OtherCost += deductions;
        if (!b.W_Sale && gross) b.W_Sale += gross;
      });
    });

    // Compute W_Profits and NET_Profits across all horizons
    ['daily', 'weekly', 'monthly', 'yearly'].forEach(h => {
      Object.values(timeMaps[h]).forEach(b => {
        b.W_Profits = b.W_Sale - (b.W_Produce + b.W_Container + b.W_GFI);
        b.NET_Profits = b.W_Profits - (b.wagesLabourCost + b.W_OtherCost);
      });
    });

    const dailyList = Object.keys(timeMaps.daily).sort().map(k => timeMaps.daily[k]);
    const weeklyList = Object.keys(timeMaps.weekly).sort().map(k => timeMaps.weekly[k]);
    const monthlyList = Object.keys(timeMaps.monthly).sort().map(k => timeMaps.monthly[k]);
    const yearlyList = Object.keys(timeMaps.yearly).sort().map(k => timeMaps.yearly[k]);

    return {
      daily: dailyList,
      weekly: weeklyList,
      monthly: monthlyList,
      yearly: yearlyList,
      latest: {
        daily: dailyList.length ? dailyList[dailyList.length - 1] : _emptyBucket('Today'),
        weekly: weeklyList.length ? weeklyList[weeklyList.length - 1] : _emptyBucket('This Week'),
        monthly: monthlyList.length ? monthlyList[monthlyList.length - 1] : _emptyBucket('This Month'),
        yearly: yearlyList.length ? yearlyList[yearlyList.length - 1] : _emptyBucket('This Year')
      }
    };
  }

  function _compute360Metrics() {
    const salesItems = Store.getAll('sales');
    const purchaseItems = Store.getAll('purchase');
    const statementItems = Store.getAll('statement');

    // Time-based Sales Breakdown (Daily, Weekly, Monthly)
    const salesBreakdown = _computeSalesTimeBreakdown(salesItems);
    const financialMatrix = _computeFinancialMatrixMetrics();

    // 1. Total Sales Revenue
    const totalSalesFromSales = salesItems.reduce((acc, r) => acc + (parseFloat(r.total_sales || r.total) || 0), 0);
    const totalGrossFromStatement = statementItems.reduce((acc, r) => acc + (parseFloat(r.gross_sales) || 0), 0);
    const totalRevenue = totalSalesFromSales || totalGrossFromStatement;

    // 2. Total Purchase Expenses
    const totalExpenses = purchaseItems.reduce((acc, r) => acc + (parseFloat(r.total_price || r.total) || 0), 0);

    // 3. Net Operating Income / Profit
    const netProfit = totalRevenue - totalExpenses;

    // 4. Profit Margin Ratio (%)
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // 5. Statement Payout & Deductions
    const statementNetPay = statementItems.reduce((acc, r) => acc + (parseFloat(r.net_pay) || 0), 0);
    const statementDeductions = statementItems.reduce((acc, r) => acc + (parseFloat(r.deductions) || 0), 0);

    // 6. Quantities
    const itemsSold = salesItems.reduce((acc, r) => acc + (parseFloat(r.quantity_sold || r.quantity) || 0), 0);
    const itemsPurchased = purchaseItems.reduce((acc, r) => acc + (parseFloat(r.quantity) || 0), 0);

    // 7. Monthly Cash Flow Aggregation (Grouping Sales vs Purchases by Month YYYY-MM)
    const monthlyMap = {};

    salesItems.forEach(r => {
      let dObj = _parseDateString(r.date || r._createdAt);
      const month = dObj.toISOString().split('T')[0].slice(0, 7);
      monthlyMap[month] = monthlyMap[month] || { month, revenue: 0, expense: 0, statementPay: 0 };
      monthlyMap[month].revenue += (parseFloat(r.total_sales || r.total) || 0);
    });

    purchaseItems.forEach(r => {
      let dObj = _parseDateString(r.date || r._createdAt);
      const month = dObj.toISOString().split('T')[0].slice(0, 7);
      monthlyMap[month] = monthlyMap[month] || { month, revenue: 0, expense: 0, statementPay: 0 };
      monthlyMap[month].expense += (parseFloat(r.total_price || r.total) || 0);
    });

    statementItems.forEach(r => {
      let dObj = _parseDateString(r.date_issued || r.date || r._createdAt);
      const month = dObj.toISOString().split('T')[0].slice(0, 7);
      monthlyMap[month] = monthlyMap[month] || { month, revenue: 0, expense: 0, statementPay: 0 };
      monthlyMap[month].statementPay += (parseFloat(r.net_pay) || 0);
      if (!monthlyMap[month].revenue && r.gross_sales) {
        monthlyMap[month].revenue += (parseFloat(r.gross_sales) || 0);
      }
    });

    const sortedMonths = Object.keys(monthlyMap).sort();
    const monthlyTrends = sortedMonths.map(m => {
      const rev = monthlyMap[m].revenue;
      const exp = monthlyMap[m].expense;
      const profit = rev - exp;
      const margin = rev > 0 ? (profit / rev) * 100 : 0;
      return {
        month: m,
        revenue: rev,
        expense: exp,
        profit: profit,
        margin: margin,
        statementPay: monthlyMap[m].statementPay
      };
    });

    // 8. Expense Category Aggregation
    const categoryMap = {};
    purchaseItems.forEach(r => {
      const cat = r.category || 'General Procurement';
      categoryMap[cat] = (categoryMap[cat] || 0) + (parseFloat(r.total_price || r.total) || 0);
    });
    const expenseCategories = Object.entries(categoryMap)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // 9. Top Revenue Products
    const productMap = {};
    salesItems.forEach(r => {
      const name = r.product_name || r.item_name || 'Item';
      productMap[name] = (productMap[name] || 0) + (parseFloat(r.total_sales || r.total) || 0);
    });
    const topProducts = Object.entries(productMap)
      .map(([product, amount]) => ({ product, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    return {
      salesBreakdown,
      financialMatrix,
      totalRevenue,
      totalExpenses,
      netProfit,
      profitMargin,
      statementNetPay,
      statementDeductions,
      itemsSold,
      itemsPurchased,
      monthlyTrends,
      expenseCategories,
      topProducts
    };
  }

  // ──────────────── KPI CARDS RENDERER ────────────────

  function renderKPIs(selectedModuleId = '360-financial') {
    const el = document.getElementById('dash-kpis');
    if (!el) return;

    if (selectedModuleId === '360-financial') {
      const matrix = _computeFinancialMatrixMetrics();
      const b = matrix.latest[_activeHorizon] || matrix.latest.monthly;
      const periodLabel = b.periodKey || _activeHorizon;

      const kpis = [
        { label: 'W_Sale', value: _formatValue(b.W_Sale, 'currency'), sub: `Gross Sales (${periodLabel})`, icon: '📈', color: '#00D4AA' },
        { label: 'W_Deposit', value: _formatValue(b.W_Deposit, 'currency'), sub: `Bank Payout (${periodLabel})`, icon: '🏦', color: '#6C63FF' },
        { label: 'W_Produce', value: _formatValue(b.W_Produce, 'currency'), sub: `Produce Expenses (${periodLabel})`, icon: '🍎', color: '#FFD93D' },
        { label: 'W_Container', value: _formatValue(b.W_Container, 'currency'), sub: `Containers & Bags (${periodLabel})`, icon: '📦', color: '#FF9F43' },
        { label: 'W_GFI', value: _formatValue(b.W_GFI, 'currency'), sub: `GFI Supplies (${periodLabel})`, icon: '🥫', color: '#48DBFB' },
        { label: 'W_Profits', value: _formatValue(b.W_Profits, 'currency'), sub: `Gross Operating Profit (${periodLabel})`, icon: '💰', color: '#00D4AA' },
        { label: 'Wages / LabourCost', value: _formatValue(b.wagesLabourCost, 'currency'), sub: `Payroll & Staff (${periodLabel})`, icon: '👷', color: '#FF6B6B' },
        { label: 'W_OtherCost', value: _formatValue(b.W_OtherCost, 'currency'), sub: `Overhead & Insurance (${periodLabel})`, icon: '📋', color: '#54A0FF' },
        { label: 'NET_Profits', value: _formatValue(b.NET_Profits, 'currency'), sub: `Net Operating Profit (${periodLabel})`, icon: '💵', color: '#FF9FF3' }
      ];

      const horizonControls = `
        <div style="grid-column: 1 / -1; display:flex; align-items:center; justify-content:space-between; margin-bottom: 0.5rem; background: var(--bg-card); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border)">
          <div style="font-size:0.88rem; font-weight:700; color:var(--text)">
            📊 Financial Indicators Horizon: <span style="color:var(--primary); text-transform:capitalize">${_activeHorizon} View</span>
          </div>
          <div class="dashboard-controls">
            <button class="btn btn-sm ${_activeHorizon==='daily'?'btn-primary':'btn-ghost'}" onclick="Dashboard.setHorizon('daily')">📅 Daily</button>
            <button class="btn btn-sm ${_activeHorizon==='weekly'?'btn-primary':'btn-ghost'}" onclick="Dashboard.setHorizon('weekly')">🗓️ Weekly</button>
            <button class="btn btn-sm ${_activeHorizon==='monthly'?'btn-primary':'btn-ghost'}" onclick="Dashboard.setHorizon('monthly')">📆 Monthly</button>
            <button class="btn btn-sm ${_activeHorizon==='yearly'?'btn-primary':'btn-ghost'}" onclick="Dashboard.setHorizon('yearly')">📅 Yearly</button>
          </div>
        </div>
      `;

      el.innerHTML = horizonControls + kpis.map(kpi => `
        <div class="kpi-card" style="--kpi-accent: ${kpi.color}">
          <div class="kpi-card-top">
            <div>
              <span class="kpi-card-label">${kpi.label}</span>
              <div style="font-size:0.7rem; color:var(--text-3); font-weight:600; margin-top:2px">${kpi.sub}</div>
            </div>
            <span class="kpi-card-icon">${kpi.icon}</span>
          </div>
          <div class="kpi-card-value">${kpi.value}</div>
          <div class="kpi-card-bar"><div class="kpi-card-bar-fill" style="width:85%"></div></div>
        </div>`).join('');
      return;
    }

    // Individual module or 'all' KPIs
    const allKpis = [];
    let modulesToRender = _config.modules.filter(m => m.enabled);
    if (selectedModuleId !== 'all') {
      modulesToRender = modulesToRender.filter(m => m.id === selectedModuleId);
    }

    modulesToRender.forEach(mod => {
      if (!mod?.analytics?.kpis) return;
      mod.analytics.kpis.forEach(kpi => allKpis.push({ ...kpi, moduleId: mod.id, moduleName: mod.name }));
    });

    el.innerHTML = allKpis.map(kpi => {
      const value = Store.aggregate(kpi.moduleId, kpi.field, kpi.agg);
      const formattedValue = _formatValue(value, kpi.format);
      return `
        <div class="kpi-card" style="--kpi-accent: ${kpi.color}">
          <div class="kpi-card-top">
            <div>
              <span class="kpi-card-label">${kpi.label}</span>
              <div style="font-size:0.7rem; color:var(--text-3); font-weight:600; margin-top:2px">${kpi.moduleName}</div>
            </div>
            <span class="kpi-card-icon">${kpi.icon}</span>
          </div>
          <div class="kpi-card-value">${formattedValue}</div>
          <div class="kpi-card-bar"><div class="kpi-card-bar-fill" style="width:75%"></div></div>
        </div>`;
    }).join('');
  }

  // ──────────────── CHARTS RENDERER ────────────────

  function renderCharts(selectedModuleId = '360-financial') {
    const el = document.getElementById('dash-charts');
    const tableContainer = document.getElementById('dash-360-table-container');
    if (!el) return;

    // Destroy existing charts
    Object.values(_charts).forEach(c => c.destroy());
    _charts = {};

    if (selectedModuleId === '360-financial') {
      const m = _compute360Metrics();

      el.innerHTML = `
        <!-- Daily Sales Trend Chart -->
        <div class="chart-card col-4" id="chart-card-sales-daily">
          <div class="chart-card-header">
            <div>
              <h3 class="chart-title">📅 Daily Sales Trend Analysis</h3>
              <span style="font-size:0.72rem; color:var(--text-3); font-weight:600">Daily Revenue ($) Timeline</span>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="canvas-sales-daily"></canvas>
          </div>
        </div>

        <!-- Weekly Sales Analysis Chart -->
        <div class="chart-card col-4" id="chart-card-sales-weekly">
          <div class="chart-card-header">
            <div>
              <h3 class="chart-title">🗓️ Weekly Sales Breakdown</h3>
              <span style="font-size:0.72rem; color:var(--text-3); font-weight:600">Weekly Aggregated Revenue ($)</span>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="canvas-sales-weekly"></canvas>
          </div>
        </div>

        <!-- Monthly Sales Analysis Chart -->
        <div class="chart-card col-4" id="chart-card-sales-monthly">
          <div class="chart-card-header">
            <div>
              <h3 class="chart-title">📆 Monthly Sales Analysis</h3>
              <span style="font-size:0.72rem; color:var(--text-3); font-weight:600">Monthly Aggregated Revenue ($)</span>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="canvas-sales-monthly"></canvas>
          </div>
        </div>

        <!-- 1. Revenue vs Expenses Cash Flow Trend -->
        <div class="chart-card col-7" id="chart-card-360-cashflow">
          <div class="chart-card-header">
            <div>
              <h3 class="chart-title">📈 360° Revenue vs Expenses Cash Flow Trend</h3>
              <span style="font-size:0.72rem; color:var(--text-3); font-weight:600">Sales Income ($) vs Procurement Costs ($)</span>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="canvas-360-cashflow"></canvas>
          </div>
        </div>

        <!-- 2. Operating Expenses Allocation -->
        <div class="chart-card col-5" id="chart-card-360-expenses">
          <div class="chart-card-header">
            <div>
              <h3 class="chart-title">🥧 Operating Expenses Allocation</h3>
              <span style="font-size:0.72rem; color:var(--text-3); font-weight:600">Procurement Costs by Category</span>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="canvas-360-expenses"></canvas>
          </div>
        </div>

        <!-- 3. Top Revenue Generating Items -->
        <div class="chart-card col-6" id="chart-card-360-revenue-items">
          <div class="chart-card-header">
            <div>
              <h3 class="chart-title">📊 Top Revenue Generating Sale Items</h3>
              <span style="font-size:0.72rem; color:var(--text-3); font-weight:600">Gross Sales Revenue by Product</span>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="canvas-360-revenue-items"></canvas>
          </div>
        </div>

        <!-- 4. Statement Payout vs Deductions -->
        <div class="chart-card col-6" id="chart-card-360-statements">
          <div class="chart-card-header">
            <div>
              <h3 class="chart-title">⚖️ Franchise Statement Cash Flow</h3>
              <span style="font-size:0.72rem; color:var(--text-3); font-weight:600">Gross Sales vs Deductions vs Net Payout</span>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="canvas-360-statements"></canvas>
          </div>
        </div>
      `;

      // Render 360 Charts after DOM insertion
      setTimeout(() => {
        _renderSalesDailyChart(m.salesBreakdown.dailyList);
        _renderSalesWeeklyChart(m.salesBreakdown.weeklyList);
        _renderSalesMonthlyChart(m.salesBreakdown.monthlyList);
        _render360CashFlowChart(m.monthlyTrends);
        _render360ExpenseCategoryChart(m.expenseCategories);
        _render360TopProductsChart(m.topProducts);
        _render360StatementChart();
      }, 50);

      // Render 360 Financial Performance Matrix Table
      if (tableContainer) {
        tableContainer.innerHTML = _build360TableHTML(m.financialMatrix);
      }
      return;
    }

    // Hide 360 table if specific module selected
    if (tableContainer) tableContainer.innerHTML = '';

    // Standard module charts
    let modulesToRender = _config.modules.filter(m => m.enabled);
    if (selectedModuleId !== 'all') {
      modulesToRender = modulesToRender.filter(m => m.id === selectedModuleId);
    }

    const chartItems = [];
    modulesToRender.forEach(mod => {
      if (!mod?.analytics?.charts) return;
      mod.analytics.charts.forEach(chartDef => {
        chartItems.push({ moduleId: mod.id, moduleName: mod.name, chartId: chartDef.id, chartDef, cols: 6 });
      });
    });

    el.innerHTML = chartItems.map(item => {
      const colClass = _colClass(item.cols);
      return `
        <div class="chart-card ${colClass}" id="chart-card-${item.chartId}">
          <div class="chart-card-header">
            <div>
              <h3 class="chart-title">${item.chartDef.title}</h3>
              <span style="font-size:0.72rem; color:var(--text-3); font-weight:600">${item.moduleName}</span>
            </div>
            <div class="chart-card-actions">
              <button class="btn-icon" title="Expand" onclick="Dashboard.expandChart('${item.moduleId}','${item.chartId}')">⛶</button>
            </div>
          </div>
          <div class="chart-container">
            <canvas id="canvas-${item.chartId}"></canvas>
          </div>
        </div>`;
    }).join('');

    chartItems.forEach((item, i) => {
      setTimeout(() => _renderChart(item.moduleId, item.chartId), i * 50);
    });
  }

  // ──────────────── SPECIFIC 360 CHARTS ────────────────

  function _renderSalesDailyChart(dailyList) {
    const canvas = document.getElementById('canvas-sales-daily');
    if (!canvas) return;
    const theme = _config.app.theme;
    const labels = dailyList.length ? dailyList.map(d => d.date) : ['Today'];
    const values = dailyList.length ? dailyList.map(d => d.sales) : [0];

    _charts['sales-daily'] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Daily Sales Revenue ($)',
          data: values,
          borderColor: '#00D4AA',
          backgroundColor: _hexToRgba('#00D4AA', 0.18),
          tension: 0.35,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#00D4AA',
          borderWidth: 2.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.bgCard,
            borderColor: theme.borderColor,
            callbacks: { label: ctx => ` Daily Sales: $${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2 })}` }
          }
        },
        scales: {
          x: { grid: { color: _hexToRgba(theme.borderColor, 0.5) }, ticks: { maxRotation: 45 } },
          y: { grid: { color: _hexToRgba(theme.borderColor, 0.5) }, ticks: { callback: v => '$' + Number(v).toLocaleString() } }
        }
      }
    });
  }

  function _renderSalesWeeklyChart(weeklyList) {
    const canvas = document.getElementById('canvas-sales-weekly');
    if (!canvas) return;
    const theme = _config.app.theme;
    const labels = weeklyList.length ? weeklyList.map(w => w.week) : ['This Week'];
    const values = weeklyList.length ? weeklyList.map(w => w.sales) : [0];

    _charts['sales-weekly'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Weekly Sales Revenue ($)',
          data: values,
          backgroundColor: _hexToRgba('#6C63FF', 0.85),
          borderColor: '#6C63FF',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.bgCard,
            borderColor: theme.borderColor,
            callbacks: { label: ctx => ` Weekly Sales: $${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2 })}` }
          }
        },
        scales: {
          x: { grid: { color: _hexToRgba(theme.borderColor, 0.5) } },
          y: { grid: { color: _hexToRgba(theme.borderColor, 0.5) }, ticks: { callback: v => '$' + Number(v).toLocaleString() } }
        }
      }
    });
  }

  function _renderSalesMonthlyChart(monthlyList) {
    const canvas = document.getElementById('canvas-sales-monthly');
    if (!canvas) return;
    const theme = _config.app.theme;
    const labels = monthlyList.length ? monthlyList.map(m => m.month) : ['This Month'];
    const values = monthlyList.length ? monthlyList.map(m => m.sales) : [0];

    _charts['sales-monthly'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Monthly Sales Revenue ($)',
          data: values,
          backgroundColor: _hexToRgba('#FF9F43', 0.85),
          borderColor: '#FF9F43',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.bgCard,
            borderColor: theme.borderColor,
            callbacks: { label: ctx => ` Monthly Sales: $${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2 })}` }
          }
        },
        scales: {
          x: { grid: { color: _hexToRgba(theme.borderColor, 0.5) } },
          y: { grid: { color: _hexToRgba(theme.borderColor, 0.5) }, ticks: { callback: v => '$' + Number(v).toLocaleString() } }
        }
      }
    });
  }

  function _render360CashFlowChart(monthlyTrends) {
    const canvas = document.getElementById('canvas-360-cashflow');
    if (!canvas) return;

    const theme = _config.app.theme;
    Chart.defaults.color = theme.textSecondary;
    Chart.defaults.borderColor = theme.borderColor;

    const labels = monthlyTrends.length ? monthlyTrends.map(t => t.month) : ['Current Month'];
    const revenueData = monthlyTrends.length ? monthlyTrends.map(t => t.revenue) : [0];
    const expenseData = monthlyTrends.length ? monthlyTrends.map(t => t.expense) : [0];
    const profitData  = monthlyTrends.length ? monthlyTrends.map(t => t.profit) : [0];

    _charts['360-cashflow'] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Gross Sales Revenue ($)',
            data: revenueData,
            borderColor: '#00D4AA',
            backgroundColor: _hexToRgba('#00D4AA', 0.15),
            tension: 0.35,
            fill: true,
            borderWidth: 2.5
          },
          {
            label: 'Purchase Expenses ($)',
            data: expenseData,
            borderColor: '#FF6B6B',
            backgroundColor: _hexToRgba('#FF6B6B', 0.12),
            tension: 0.35,
            fill: true,
            borderWidth: 2.5
          },
          {
            label: 'Net Profit ($)',
            data: profitData,
            borderColor: '#6C63FF',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.35,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { color: theme.textPrimary } },
          tooltip: {
            backgroundColor: theme.bgCard,
            borderColor: theme.borderColor,
            borderWidth: 1,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: $${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2 })}` }
          }
        },
        scales: {
          x: { grid: { color: _hexToRgba(theme.borderColor, 0.5) } },
          y: { grid: { color: _hexToRgba(theme.borderColor, 0.5) }, ticks: { callback: v => '$' + Number(v).toLocaleString() } }
        }
      }
    });
  }

  function _render360ExpenseCategoryChart(categories) {
    const canvas = document.getElementById('canvas-360-expenses');
    if (!canvas) return;

    const theme = _config.app.theme;
    const labels = categories.length ? categories.map(c => c.category) : ['General'];
    const values = categories.length ? categories.map(c => c.amount) : [0];

    _charts['360-expenses'] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: CHART_PALETTE.map(c => _hexToRgba(c, 0.85)),
          borderColor: theme.bgCard,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: true, position: 'right', labels: { color: theme.textPrimary, usePointStyle: true } },
          tooltip: {
            backgroundColor: theme.bgCard,
            borderColor: theme.borderColor,
            callbacks: { label: ctx => ` $${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2 })}` }
          }
        }
      }
    });
  }

  function _render360TopProductsChart(products) {
    const canvas = document.getElementById('canvas-360-revenue-items');
    if (!canvas) return;

    const theme = _config.app.theme;
    const labels = products.length ? products.map(p => p.product.length > 22 ? p.product.slice(0,20)+'…' : p.product) : ['Sample Product'];
    const values = products.length ? products.map(p => p.amount) : [0];

    _charts['360-revenue-items'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Revenue ($)',
          data: values,
          backgroundColor: _hexToRgba('#00D4AA', 0.85),
          borderColor: '#00D4AA',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.bgCard,
            borderColor: theme.borderColor,
            callbacks: { label: ctx => ` Revenue: $${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2 })}` }
          }
        },
        scales: {
          x: { grid: { color: _hexToRgba(theme.borderColor, 0.5) }, ticks: { callback: v => '$' + Number(v).toLocaleString() } },
          y: { grid: { color: _hexToRgba(theme.borderColor, 0.5) } }
        }
      }
    });
  }

  function _render360StatementChart() {
    const canvas = document.getElementById('canvas-360-statements');
    if (!canvas) return;

    const statementItems = Store.getAll('statement');
    const theme = _config.app.theme;

    const labels = statementItems.length ? statementItems.map(s => `Stmt #${s.statement_no || '1'}`) : ['Stmt #1'];
    const grossData = statementItems.length ? statementItems.map(s => parseFloat(s.gross_sales) || 0) : [0];
    const dedData   = statementItems.length ? statementItems.map(s => parseFloat(s.deductions) || 0) : [0];
    const netData   = statementItems.length ? statementItems.map(s => parseFloat(s.net_pay) || 0) : [0];

    _charts['360-statements'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Gross Sales ($)', data: grossData, backgroundColor: _hexToRgba('#00D4AA', 0.8), borderRadius: 4 },
          { label: 'Deductions ($)', data: dedData, backgroundColor: _hexToRgba('#FF6B6B', 0.8), borderRadius: 4 },
          { label: 'Net Payout ($)', data: netData, backgroundColor: _hexToRgba('#6C63FF', 0.8), borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { color: theme.textPrimary } },
          tooltip: {
            backgroundColor: theme.bgCard,
            borderColor: theme.borderColor,
            callbacks: { label: ctx => ` ${ctx.dataset.label}: $${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2 })}` }
          }
        },
        scales: {
          x: { grid: { color: _hexToRgba(theme.borderColor, 0.5) } },
          y: { grid: { color: _hexToRgba(theme.borderColor, 0.5) }, ticks: { callback: v => '$' + Number(v).toLocaleString() } }
        }
      }
    });
  }

  function _build360TableHTML(matrix) {
    const horizonData = (matrix && matrix[_activeHorizon]) ? matrix[_activeHorizon] : [];
    const horizonTitle = _activeHorizon.charAt(0).toUpperCase() + _activeHorizon.slice(1);

    return `
      <div class="card admin-card p-4">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:0.75rem">
          <div>
            <h3 style="margin:0;font-size:1.1rem">📄 Multi-Period Financial Performance & Profitability Matrix</h3>
            <p style="margin:0.2rem 0 0;font-size:0.78rem;color:var(--text-2)">Detailed reconciliation of W_Sale, W_Deposit, W_Produce, W_Container, W_GFI, W_Profits, Wages/Labour, W_OtherCost, and NET_Profits</p>
          </div>
          <div style="display:flex;gap:0.4rem;align-items:center">
            <button class="btn btn-sm ${_activeHorizon==='daily'?'btn-primary':'btn-ghost'}" onclick="Dashboard.setHorizon('daily')">📅 Daily</button>
            <button class="btn btn-sm ${_activeHorizon==='weekly'?'btn-primary':'btn-ghost'}" onclick="Dashboard.setHorizon('weekly')">🗓️ Weekly</button>
            <button class="btn btn-sm ${_activeHorizon==='monthly'?'btn-primary':'btn-ghost'}" onclick="Dashboard.setHorizon('monthly')">📆 Monthly</button>
            <button class="btn btn-sm ${_activeHorizon==='yearly'?'btn-primary':'btn-ghost'}" onclick="Dashboard.setHorizon('yearly')">📅 Yearly</button>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Period (${horizonTitle})</th>
                <th>W_Sale ($)</th>
                <th>W_Deposit ($)</th>
                <th>W_Produce ($)</th>
                <th>W_Container ($)</th>
                <th>W_GFI ($)</th>
                <th>W_Profits ($)</th>
                <th>Wages/Labour ($)</th>
                <th>W_OtherCost ($)</th>
                <th>NET_Profits ($)</th>
                <th>Health Status</th>
              </tr>
            </thead>
            <tbody>
              ${horizonData.length ? horizonData.map(t => {
                const statusBadge = t.NET_Profits > 0
                  ? '<span class="badge badge-success">🟢 Profitable</span>'
                  : t.NET_Profits === 0
                    ? '<span class="badge badge-muted">⚪ Break-Even</span>'
                    : '<span class="badge badge-danger">🔴 Deficit</span>';
                return `
                  <tr>
                    <td><strong>${t.periodKey}</strong></td>
                    <td style="color:var(--accent);font-weight:600">${_formatValue(t.W_Sale, 'currency')}</td>
                    <td style="color:#6C63FF;font-weight:600">${_formatValue(t.W_Deposit, 'currency')}</td>
                    <td style="color:var(--danger);font-weight:500">${_formatValue(t.W_Produce, 'currency')}</td>
                    <td style="color:#FF9F43;font-weight:500">${_formatValue(t.W_Container, 'currency')}</td>
                    <td style="color:#48DBFB;font-weight:500">${_formatValue(t.W_GFI, 'currency')}</td>
                    <td style="color:var(--accent);font-weight:700">${_formatValue(t.W_Profits, 'currency')}</td>
                    <td style="color:#FF6B6B;font-weight:500">${_formatValue(t.wagesLabourCost, 'currency')}</td>
                    <td style="color:#54A0FF;font-weight:500">${_formatValue(t.W_OtherCost, 'currency')}</td>
                    <td style="color:${t.NET_Profits>=0?'#00D4AA':'#FF6B6B'};font-weight:800;font-size:0.95rem">${_formatValue(t.NET_Profits, 'currency')}</td>
                    <td>${statusBadge}</td>
                  </tr>`;
              }).join('') : `
                <tr>
                  <td colspan="11" style="text-align:center;color:var(--text-3);padding:2rem">No financial transaction data recorded for ${horizonTitle} view.</td>
                </tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ──────────────── STANDARD MODULE CHART ────────────────

  function _renderChart(moduleId, chartId) {
    const mod = _config.modules.find(m => m.id === moduleId);
    const chartDef = mod?.analytics?.charts?.find(c => c.id === chartId);
    if (!chartDef) return;

    const canvas = document.getElementById(`canvas-${chartId}`);
    if (!canvas) return;

    const data = Store.groupBy(moduleId, {
      groupField: chartDef.groupBy,
      valueField: chartDef.valueField,
      agg: chartDef.agg,
      dateGranularity: chartDef.dateGranularity || null,
      limit: chartDef.limit || null
    });

    if (!data.length) {
      const card = document.getElementById(`chart-card-${chartId}`);
      if (card) {
        const container = card.querySelector('.chart-container');
        if (container) container.innerHTML = `
          <div class="chart-empty">
            <div class="chart-empty-icon">📊</div>
            <p>No data yet — add records to see this chart</p>
          </div>`;
      }
      return;
    }

    const labels = data.map(d => _formatLabel(d.label, chartDef));
    const values = data.map(d => d.value);

    const theme = _config.app.theme;
    const baseColor = chartDef.color || CHART_PALETTE[0];

    Chart.defaults.color = theme.textSecondary;
    Chart.defaults.borderColor = theme.borderColor;

    const chartConfig = _buildChartConfig(chartDef.type, labels, values, baseColor, chartDef.title);
    _charts[chartId] = new Chart(canvas, chartConfig);
  }

  function _buildChartConfig(type, labels, values, baseColor, title) {
    const theme = _config.app.theme;
    const isCurrency = true;

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: type === 'doughnut' || type === 'pie', position: 'right',
          labels: { color: theme.textPrimary, padding: 12, usePointStyle: true, pointStyleWidth: 10 }
        },
        tooltip: {
          backgroundColor: theme.bgCard,
          borderColor: theme.borderColor,
          borderWidth: 1,
          titleColor: theme.textPrimary,
          bodyColor: theme.textSecondary,
          padding: 12,
          callbacks: {
            label: ctx => isCurrency
              ? ` $${Number(ctx.raw).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : ` ${ctx.raw}`
          }
        }
      }
    };

    switch (type) {
      case 'line':
        return {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: title,
              data: values,
              borderColor: baseColor,
              backgroundColor: _hexToRgba(baseColor, 0.15),
              tension: 0.4,
              fill: true,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: baseColor,
              borderWidth: 2.5
            }]
          },
          options: {
            ...commonOptions,
            scales: {
              x: { grid: { color: _hexToRgba(theme.borderColor, 0.5) }, ticks: { maxRotation: 45 } },
              y: { grid: { color: _hexToRgba(theme.borderColor, 0.5) },
                ticks: { callback: v => '$' + Number(v).toLocaleString() } }
            }
          }
        };

      case 'bar':
        return {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: title,
              data: values,
              backgroundColor: labels.map((_, i) => _hexToRgba(CHART_PALETTE[i % CHART_PALETTE.length], 0.8)),
              borderColor: labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]),
              borderWidth: 1,
              borderRadius: 6,
              borderSkipped: false
            }]
          },
          options: {
            ...commonOptions,
            indexAxis: labels.length > 6 ? 'y' : 'x',
            scales: {
              x: { grid: { color: _hexToRgba(theme.borderColor, 0.5) },
                ticks: { callback: v => typeof v === 'number' ? '$'+Number(v).toLocaleString() : v } },
              y: { grid: { color: _hexToRgba(theme.borderColor, 0.5) },
                ticks: { callback: v => typeof v === 'number' ? '$'+Number(v).toLocaleString() : v } }
            }
          }
        };

      case 'doughnut':
      case 'pie':
        return {
          type: type,
          data: {
            labels,
            datasets: [{
              data: values,
              backgroundColor: CHART_PALETTE.map(c => _hexToRgba(c, 0.85)),
              borderColor: theme.bgCard,
              borderWidth: 3,
              hoverOffset: 8
            }]
          },
          options: {
            ...commonOptions,
            cutout: type === 'doughnut' ? '65%' : 0,
            plugins: {
              ...commonOptions.plugins,
              legend: { ...commonOptions.plugins.legend, display: true }
            }
          }
        };

      default:
        return { type: 'bar', data: { labels, datasets: [{ data: values }] }, options: commonOptions };
    }
  }

  function expandChart(moduleId, chartId) {
    const mod = _config.modules.find(m => m.id === moduleId);
    const chartDef = mod?.analytics?.charts?.find(c => c.id === chartId);
    if (!chartDef) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay visible';
    overlay.id = 'chart-expand-overlay';
    overlay.innerHTML = `
      <div class="modal-box modal-wide chart-expand-modal">
        <div class="modal-header">
          <h3>${chartDef.title}</h3>
          <button class="modal-close" onclick="document.getElementById('chart-expand-overlay').remove(); Dashboard.renderCharts();">✕</button>
        </div>
        <div class="modal-body">
          <div style="height:500px; position:relative">
            <canvas id="canvas-expand-${chartId}"></canvas>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    setTimeout(() => {
      const data = Store.groupBy(moduleId, {
        groupField: chartDef.groupBy,
        valueField: chartDef.valueField,
        agg: chartDef.agg,
        dateGranularity: chartDef.dateGranularity || null,
        limit: null
      });
      if (!data.length) return;
      const labels = data.map(d => _formatLabel(d.label, chartDef));
      const values = data.map(d => d.value);
      const cfg = _buildChartConfig(chartDef.type, labels, values, chartDef.color || CHART_PALETTE[0], chartDef.title);
      new Chart(document.getElementById(`canvas-expand-${chartId}`), cfg);
    }, 100);
  }

  function filterModule(moduleId) {
    renderKPIs(moduleId);
    renderCharts(moduleId);
  }

  function refresh() {
    const filterEl = document.getElementById('dash-module-filter');
    const selected = filterEl ? filterEl.value : '360-financial';
    renderKPIs(selected);
    Object.values(_charts).forEach(c => c.destroy());
    _charts = {};
    renderCharts(selected);
    showToast('360° Financial Dashboard refreshed', 'info');
  }

  // ──────────────── UTILS ────────────────

  function _colClass(cols) {
    const map = { 4:'col-4', 5:'col-5', 6:'col-6', 7:'col-7', 8:'col-8', 12:'col-12' };
    return map[cols] || 'col-6';
  }

  function _formatLabel(label, chartDef) {
    if (chartDef.dateGranularity === 'month' && label.match(/^\d{4}-\d{2}$/)) {
      const [y, m] = label.split('-');
      return new Date(parseInt(y), parseInt(m)-1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
    }
    if (label.length > 20) return label.slice(0, 18) + '…';
    return label;
  }

  function _formatValue(value, format) {
    if (isNaN(value)) return '—';
    switch (format) {
      case 'currency': return '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'number':   return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
      case 'percent':  return Number(value).toFixed(1) + '%';
      default: return String(value);
    }
  }

  function _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  return { init, render, renderKPIs, renderCharts, expandChart, filterModule, refresh, setHorizon };
})();

window.Dashboard = Dashboard;
