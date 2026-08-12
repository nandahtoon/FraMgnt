/**
 * module-engine.js — Dynamic Module Renderer
 * Reads module config and renders form, table, import wizard, and export panel
 */

const ModuleEngine = (() => {

  let _currentModule = null;
  let _config = null;
  let _queryState = {};

  function init(config) {
    _config = config;
  }

  // ──────────────── MAIN RENDER ────────────────

  function render(moduleId, containerId) {
    const mod = _config.modules.find(m => m.id === moduleId);
    if (!mod) { document.getElementById(containerId).innerHTML = '<p>Module not found</p>'; return; }
    _currentModule = mod;
    _queryState[moduleId] = _queryState[moduleId] || {
      search: '', sortBy: mod.table?.sortBy || 'date', sortDir: mod.table?.sortDir || 'desc',
      page: 1, pageSize: mod.table?.pageSize || 20, filters: {}
    };

    const el = document.getElementById(containerId);
    el.innerHTML = `
      <div class="module-header">
        <div class="module-title-group">
          <span class="module-icon">${mod.icon}</span>
          <div>
            <h2 class="module-title">${mod.name}</h2>
            <p class="module-desc">${mod.description}</p>
          </div>
        </div>
        <div class="module-actions">
          <div class="server-status-pill" id="server-status-${moduleId}" title="Sync server status">⚪ Checking...</div>
          <button class="btn btn-sync" onclick="ModuleEngine.openImport('${moduleId}')" id="sync-btn-${moduleId}">
            🔄 Auto-Sync Kroger
          </button>
          <button class="btn btn-ghost" onclick="ModuleEngine.openImport('${moduleId}')">⬆️ Import</button>
          <button class="btn btn-ghost" onclick="ModuleEngine.openExport('${moduleId}')">⬇️ Export</button>
          <button class="btn btn-primary" onclick="ModuleEngine.openForm('${moduleId}')">+ Add Record</button>
        </div>
      </div>

      <div class="module-kpis" id="mod-kpis-${moduleId}"></div>

      <div class="card mt-4">
        <div class="table-toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="search-${moduleId}" placeholder="Search records..." 
              oninput="ModuleEngine.onSearch('${moduleId}', this.value)" class="search-input">
          </div>
          <div class="table-toolbar-right">
            <span class="record-count" id="count-${moduleId}">Loading...</span>
            <select class="select-sm" onchange="ModuleEngine.onPageSize('${moduleId}', this.value)">
              <option value="10">10 / page</option>
              <option value="20" selected>20 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
          </div>
        </div>
        <div id="table-${moduleId}" class="table-wrapper"></div>
        <div id="pagination-${moduleId}" class="pagination"></div>
      </div>

      <!-- Form Modal -->
      <div id="form-modal-${moduleId}" class="modal-overlay hidden">
        <div class="modal-box">
          <div class="modal-header">
            <h3 id="form-title-${moduleId}">Add Record</h3>
            <button class="modal-close" onclick="ModuleEngine.closeForm('${moduleId}')">✕</button>
          </div>
          <div id="form-body-${moduleId}" class="modal-body"></div>
        </div>
      </div>

      <!-- Import Modal -->
      <div id="import-modal-${moduleId}" class="modal-overlay hidden">
        <div class="modal-box modal-wide">
          <div class="modal-header">
            <h3>Import Data — ${mod.name}</h3>
            <button class="modal-close" onclick="ModuleEngine.closeImport('${moduleId}')">✕</button>
          </div>
          <div id="import-body-${moduleId}" class="modal-body"></div>
        </div>
      </div>
    `;

    renderKPIs(moduleId);
    renderTable(moduleId);
    // Check server status async
    _checkServerStatus(moduleId);
  }

  async function _checkServerStatus(moduleId) {
    const pill = document.getElementById(`server-status-${moduleId}`);
    const btn  = document.getElementById(`sync-btn-${moduleId}`);
    if (!pill) return;
    try {
      const status = await KrogerSync.checkStatus();
      if (status.online) {
        const hasSession = status.session_exists;
        pill.textContent = hasSession ? '🟢 Sync Ready' : '🟡 Login Required';
        pill.className   = `server-status-pill ${hasSession ? 'online' : 'needs-login'}`;
        pill.title       = hasSession
          ? 'Sync server online — session active'
          : 'Sync server online — Kroger login required';
        if (btn) btn.onclick = () => ModuleEngine._openAutoSync(moduleId, status);
      } else {
        pill.textContent = '🔴 Server Offline';
        pill.className   = 'server-status-pill offline';
        pill.title       = 'Start server\\server\\start.bat to enable Auto-Sync';
        if (btn) btn.onclick = () => ModuleEngine.openImport(moduleId);
      }
    } catch {
      pill.textContent = '🔴 Server Offline';
      pill.className   = 'server-status-pill offline';
    }
  }

  // ──────────────── KPI STRIP ────────────────

  function renderKPIs(moduleId) {
    const mod = _config.modules.find(m => m.id === moduleId);
    if (!mod?.analytics?.kpis) return;
    const el = document.getElementById(`mod-kpis-${moduleId}`);
    if (!el) return;

    el.innerHTML = mod.analytics.kpis.map(kpi => {
      const value = Store.aggregate(moduleId, kpi.field, kpi.agg);
      return `
        <div class="kpi-chip" style="--kpi-color:${kpi.color}">
          <span class="kpi-chip-icon">${kpi.icon}</span>
          <div>
            <div class="kpi-chip-value">${_formatValue(value, kpi.format)}</div>
            <div class="kpi-chip-label">${kpi.label}</div>
          </div>
        </div>`;
    }).join('');
  }

  // ──────────────── TABLE ────────────────

  function renderTable(moduleId) {
    const mod = _config.modules.find(m => m.id === moduleId);
    const qs = _queryState[moduleId];
    const cols = mod.table?.defaultColumns || mod.fields.map(f => f.id);
    const fields = mod.fields.filter(f => cols.includes(f.id));

    const result = Store.query(moduleId, qs);

    // Count
    const countEl = document.getElementById(`count-${moduleId}`);
    if (countEl) countEl.textContent = `${result.total} records`;

    // Table
    const tableEl = document.getElementById(`table-${moduleId}`);
    if (!tableEl) return;

    if (!result.items.length) {
      tableEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>No records yet</h3>
          <p>Add records manually or use Import to bring in data</p>
          <button class="btn btn-primary mt-2" onclick="ModuleEngine.openImport('${moduleId}')">⬆️ Import Data</button>
        </div>`;
      document.getElementById(`pagination-${moduleId}`).innerHTML = '';
      return;
    }

    tableEl.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            ${fields.map(f => `
              <th class="sortable ${qs.sortBy === f.id ? 'sorted' : ''}" 
                  onclick="ModuleEngine.onSort('${moduleId}', '${f.id}')">
                ${f.label}
                <span class="sort-icon">${qs.sortBy === f.id ? (qs.sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>`).join('')}
            <th class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${result.items.map(row => `
            <tr>
              ${fields.map(f => `<td>${_renderCell(row[f.id], f)}</td>`).join('')}
              <td class="col-actions">
                <button class="btn-icon" title="Edit" onclick="ModuleEngine.openForm('${moduleId}', '${row._id}')">✏️</button>
                <button class="btn-icon danger" title="Delete" onclick="ModuleEngine.deleteRecord('${moduleId}', '${row._id}')">🗑️</button>
              </td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr class="table-summary-row">
            ${fields.map((f, idx) => {
              if (idx === 0) {
                return `<td><strong>Page Summary (${result.items.length} items)</strong></td>`;
              }
              if (f.id === 'quantity_sold' || f.id === 'quantity') {
                const sum = result.items.reduce((acc, r) => acc + (parseFloat(r[f.id]) || 0), 0);
                return `<td class="cell-number"><strong>${sum.toLocaleString('en-US')} units</strong></td>`;
              }
              if (f.id === 'retail_price' || f.id === 'unit_price') {
                const avg = result.items.length ? (result.items.reduce((acc, r) => acc + (parseFloat(r[f.id]) || 0), 0) / result.items.length) : 0;
                return `<td class="cell-currency"><strong>Avg $${avg.toFixed(2)}</strong></td>`;
              }
              if (f.type === 'currency' || f.id === 'total_sales' || f.id === 'total_price' || f.id === 'net_pay' || f.id === 'gross_sales') {
                const sum = result.items.reduce((acc, r) => acc + (parseFloat(r[f.id]) || 0), 0);
                return `<td class="cell-currency"><strong style="color:var(--accent)">$${sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>`;
              }
              return `<td>—</td>`;
            }).join('')}
            <td></td>
          </tr>
        </tfoot>
      </table>`;

    // Pagination
    const pagEl = document.getElementById(`pagination-${moduleId}`);
    if (pagEl) pagEl.innerHTML = _renderPagination(moduleId, result);
  }

  function _parseDateValue(val) {
    if (!val) return null;
    let s = String(val).trim();
    // Excel serial date number check (e.g., 46214)
    if (!isNaN(s) && Number(s) > 30000 && Number(s) < 70000) {
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + Number(s) * 86400000);
    }
    const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function _renderCell(value, field) {
    if (value === undefined || value === null || value === '') return '<span class="cell-empty">—</span>';

    if (field.id === 'gtin' || field.id === 'upc') {
      return `<code class="cell-mono">${_escapeHtml(String(value))}</code>`;
    }
    if (field.id === 'store_number') {
      const formatted = String(value).padStart(5, '0');
      return `<span class="badge badge-subtle">Store #${_escapeHtml(formatted)}</span>`;
    }
    if (field.id === 'division_name') {
      return `<span class="badge badge-muted">${_escapeHtml(String(value))}</span>`;
    }
    if (field.id === 'product_name' || field.id === 'item_name') {
      return `<strong class="cell-product-name">${_escapeHtml(String(value))}</strong>`;
    }
    if (field.type === 'currency' || field.id === 'total_sales' || field.id === 'retail_price' || field.id === 'total_price' || field.id === 'net_pay' || field.id === 'gross_sales') {
      const num = parseFloat(value);
      return `<span class="cell-currency">${isNaN(num) ? '—' : '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>`;
    }
    if (field.type === 'number' || field.id === 'quantity_sold' || field.id === 'quantity') {
      const num = parseFloat(value);
      return `<span class="cell-number">${isNaN(num) ? _escapeHtml(String(value)) : num.toLocaleString('en-US')}</span>`;
    }
    if (field.type === 'date' || field.id === 'date') {
      const d = _parseDateValue(value);
      return `<span class="cell-date">${d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : _escapeHtml(String(value))}</span>`;
    }
    if (field.type === 'select') return `<span class="badge">${_escapeHtml(String(value))}</span>`;
    return `<span>${_escapeHtml(String(value))}</span>`;
  }

  function _renderPagination(moduleId, result) {
    if (result.totalPages <= 1) return '';
    const qs = _queryState[moduleId];
    let html = '<div class="pagination-inner">';
    html += `<button class="page-btn" ${qs.page <= 1 ? 'disabled' : ''} onclick="ModuleEngine.onPage('${moduleId}', ${qs.page-1})">←</button>`;

    const start = Math.max(1, qs.page - 2);
    const end = Math.min(result.totalPages, start + 4);
    for (let p = start; p <= end; p++) {
      html += `<button class="page-btn ${p === qs.page ? 'active' : ''}" onclick="ModuleEngine.onPage('${moduleId}', ${p})">${p}</button>`;
    }
    html += `<button class="page-btn" ${qs.page >= result.totalPages ? 'disabled' : ''} onclick="ModuleEngine.onPage('${moduleId}', ${qs.page+1})">→</button>`;
    html += `<span class="page-info">Page ${qs.page} of ${result.totalPages}</span>`;
    html += '</div>';
    return html;
  }

  // ──────────────── FORM ────────────────

  function openForm(moduleId, recordId = null) {
    const mod = _config.modules.find(m => m.id === moduleId);
    const modal = document.getElementById(`form-modal-${moduleId}`);
    const titleEl = document.getElementById(`form-title-${moduleId}`);
    const bodyEl = document.getElementById(`form-body-${moduleId}`);
    if (!modal || !bodyEl) return;

    const existing = recordId ? Store.getById(moduleId, recordId) : null;
    titleEl.textContent = existing ? 'Edit Record' : 'Add Record';

    // Group fields
    const groups = mod.fieldGroups || [{ id: '_default', label: 'Fields', icon: '' }];
    const grouped = {};
    mod.fields.forEach(f => {
      const g = f.group || '_default';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(f);
    });

    bodyEl.innerHTML = `
      <form id="record-form-${moduleId}" onsubmit="ModuleEngine.submitForm(event,'${moduleId}','${recordId||''}')">
        ${groups.filter(g => grouped[g.id]?.length).map(g => `
          <div class="form-group-section">
            <div class="form-group-label">${g.icon} ${g.label}</div>
            <div class="form-grid">
              ${(grouped[g.id] || []).map(f => _renderField(f, existing?.[f.id] ?? '')).join('')}
            </div>
          </div>`).join('')}
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" onclick="ModuleEngine.closeForm('${moduleId}')">Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save Changes' : 'Add Record'}</button>
        </div>
      </form>`;

    modal.classList.remove('hidden');
    modal.classList.add('visible');
  }

  function _renderField(field, value) {
    const commonAttrs = `id="field-${field.id}" name="${field.id}" ${field.required ? 'required' : ''}`;
    let input = '';

    switch (field.type) {
      case 'select':
        input = `<select ${commonAttrs} class="form-control">
          <option value="">Select ${field.label}...</option>
          ${(field.options||[]).map(o => `<option value="${o}" ${o===value?'selected':''}>${o}</option>`).join('')}
        </select>`;
        break;
      case 'textarea':
        input = `<textarea ${commonAttrs} class="form-control" placeholder="${field.placeholder||''}" rows="3">${_escapeHtml(value)}</textarea>`;
        break;
      case 'number':
      case 'currency':
        input = `<input type="number" ${commonAttrs} class="form-control" 
          value="${value}" placeholder="${field.placeholder||'0.00'}"
          min="${field.min||0}" step="${field.step||'0.01'}">`;
        break;
      case 'date':
        input = `<input type="date" ${commonAttrs} class="form-control" value="${value}">`;
        break;
      default:
        input = `<input type="text" ${commonAttrs} class="form-control" 
          value="${_escapeHtml(value)}" placeholder="${field.placeholder||''}">`;
    }

    const prefix = field.type === 'currency' ? '<span class="input-prefix">$</span>' : '';
    return `
      <div class="form-field ${field.type === 'textarea' ? 'col-span-2' : ''}">
        <label class="form-label" for="field-${field.id}">
          ${field.icon || ''} ${field.label}${field.required ? ' <span class="required">*</span>' : ''}
        </label>
        <div class="input-wrapper">${prefix}${input}</div>
      </div>`;
  }

  function closeForm(moduleId) {
    const modal = document.getElementById(`form-modal-${moduleId}`);
    if (modal) { modal.classList.remove('visible'); modal.classList.add('hidden'); }
  }

  function submitForm(event, moduleId, recordId) {
    event.preventDefault();
    const form = event.target;
    const mod = _config.modules.find(m => m.id === moduleId);
    const data = {};
    mod.fields.forEach(f => {
      const el = form.elements[f.id];
      if (el) data[f.id] = el.value;
    });

    const { valid, errors } = PurchaseModule.validate(data, mod.fields);
    if (!valid) {
      // Show field errors
      Object.entries(errors).forEach(([fid, msg]) => {
        const el = document.getElementById(`field-${fid}`);
        if (el) { el.classList.add('input-error'); el.title = msg; }
      });
      return;
    }

    if (recordId) {
      Store.update(moduleId, recordId, data);
      showToast('Record updated ✓', 'success');
    } else {
      Store.insert(moduleId, data);
      showToast('Record added ✓', 'success');
    }
    closeForm(moduleId);
    renderTable(moduleId);
    renderKPIs(moduleId);
  }

  function deleteRecord(moduleId, recordId) {
    if (!confirm('Delete this record?')) return;
    Store.remove(moduleId, recordId);
    renderTable(moduleId);
    renderKPIs(moduleId);
    showToast('Record deleted', 'info');
  }

  // ──────────────── IMPORT WIZARD ────────────────

  function openImport(moduleId) {
    const mod = _config.modules.find(m => m.id === moduleId);
    const modal = document.getElementById(`import-modal-${moduleId}`);
    const body = document.getElementById(`import-body-${moduleId}`);
    if (!modal || !body) return;

    const sources = mod.dataSource?.sources || [];
    // Check server online status for the auto-sync card
    KrogerSync.checkStatus().then(status => {
      const autoCard = document.getElementById(`auto-sync-card-${moduleId}`);
      if (!autoCard) return;
      if (status.online) {
        autoCard.classList.add(status.session_exists ? 'auto-sync-ready' : 'auto-sync-needs-login');
        autoCard.querySelector('.auto-sync-status').textContent =
          status.session_exists ? '🟢 Ready — click to sync now' : '🟡 One-time login required';
        autoCard.querySelector('.auto-sync-action').textContent =
          status.session_exists ? '⚡ Start Sync' : '🔐 Login & Sync';
        autoCard.onclick = () => ModuleEngine._openAutoSync(moduleId, status);
      } else {
        autoCard.classList.add('auto-sync-offline');
        autoCard.querySelector('.auto-sync-status').textContent = '🔴 Server offline — start server\\start.bat first';
        autoCard.querySelector('.auto-sync-action').textContent = 'Start server first';
      }
    });

    body.innerHTML = `
      <div class="import-wizard" id="import-wizard-${moduleId}" data-step="1">

        <!-- Step 1: Choose Source -->
        <div class="wizard-step" data-step="1">
          <h4 class="wizard-step-title">Step 1 — Choose Data Source</h4>

          <!-- AUTO-SYNC HERO CARD -->
          <div class="auto-sync-hero" id="auto-sync-card-${moduleId}">
            <div class="auto-sync-hero-left">
              <div class="auto-sync-logo">🛒</div>
              <div>
                <div class="auto-sync-title">Auto-Sync from Kroger</div>
                <div class="auto-sync-desc">Automatically fetches all your purchase history via a local browser. No credentials stored.</div>
                <div class="auto-sync-status">⚪ Checking server...</div>
              </div>
            </div>
            <button class="auto-sync-action btn btn-sync" disabled>Checking...</button>
          </div>

          <div class="source-divider">— or import manually —</div>

          <div class="source-cards">
            ${sources.map(s => `
              <div class="source-card" onclick="ModuleEngine._selectSource('${moduleId}', '${s.id}')">
                <div class="source-icon">${s.logo}</div>
                <div class="source-name">${s.name}</div>
                <a href="${s.url}" target="_blank" class="source-link" onclick="event.stopPropagation()">Open Site ↗</a>
              </div>`).join('')}
            <div class="source-card" onclick="ModuleEngine._selectSource('${moduleId}', 'csv')">
              <div class="source-icon">📄</div>
              <div class="source-name">CSV File</div>
              <div class="source-link">Upload or paste</div>
            </div>
            <div class="source-card" onclick="ModuleEngine._selectSource('${moduleId}', 'manual_paste')">
              <div class="source-icon">📋</div>
              <div class="source-name">Paste Text</div>
              <div class="source-link">From any page</div>
            </div>
          </div>
        </div>

        <!-- Step 2: Instructions + Paste -->
        <div class="wizard-step hidden" data-step="2">
          <button class="btn-back" onclick="ModuleEngine._wizardStep('${moduleId}', 1)">← Back</button>
          <h4 class="wizard-step-title" id="import-step2-title-${moduleId}">Step 2 — Get Your Data</h4>
          <div id="import-instructions-${moduleId}" class="import-instructions"></div>
          <div class="import-paste-area">
            <label class="form-label">Paste your data or CSV content below:</label>
            <textarea id="import-paste-${moduleId}" class="paste-area" rows="12"
              placeholder="Paste CSV content or copied text from the website here..."></textarea>
            <div class="import-paste-actions">
              <label class="btn btn-ghost file-upload-label">
                📁 Upload File (Excel / CSV)
                <input type="file" accept=".csv,.txt,.xlsx,.xls" style="display:none"
                  onchange="ModuleEngine._onFileUpload('${moduleId}', this)">
              </label>
              <button class="btn btn-primary" onclick="ModuleEngine._parsePaste('${moduleId}')">Parse Data →</button>
            </div>
          </div>
        </div>

        <!-- Step 3: Map Columns -->
        <div class="wizard-step hidden" data-step="3">
          <button class="btn-back" onclick="ModuleEngine._wizardStep('${moduleId}', 2)">← Back</button>
          <h4 class="wizard-step-title">Step 3 — Map Columns to Fields</h4>
          <div id="import-mapping-${moduleId}" class="mapping-grid"></div>
          <div class="import-paste-actions mt-4">
            <button class="btn btn-primary" onclick="ModuleEngine._applyMapping('${moduleId}')">Preview Import →</button>
          </div>
        </div>

        <!-- Step 4: Preview & Confirm -->
        <div class="wizard-step hidden" data-step="4">
          <button class="btn-back" onclick="ModuleEngine._wizardStep('${moduleId}', 3)">← Back</button>
          <h4 class="wizard-step-title">Step 4 — Preview & Confirm</h4>
          <div id="import-preview-${moduleId}" class="import-preview"></div>
          <div class="import-paste-actions mt-4">
            <button class="btn btn-ghost" onclick="ModuleEngine.closeImport('${moduleId}')">Cancel</button>
            <button class="btn btn-primary" onclick="ModuleEngine._confirmImport('${moduleId}')">✓ Import Records</button>
          </div>
        </div>

        <!-- Step 5: Auto-Sync Progress -->
        <div class="wizard-step hidden" data-step="5">
          <h4 class="wizard-step-title" id="sync-step-title-${moduleId}">🔄 Auto-Syncing from Kroger...</h4>
          <div class="sync-progress-panel">
            <div class="sync-progress-bar-wrap">
              <div class="sync-progress-bar" id="sync-bar-${moduleId}" style="width:0%"></div>
            </div>
            <div class="sync-progress-pct" id="sync-pct-${moduleId}">0%</div>
          </div>
          <div class="sync-log" id="sync-log-${moduleId}"></div>
          <div class="import-paste-actions mt-4" id="sync-actions-${moduleId}">
            <button class="btn btn-ghost" onclick="KrogerSync.unsubscribeProgress(); ModuleEngine.closeImport('${moduleId}');">Cancel</button>
          </div>
        </div>

      </div>`;

    modal.classList.remove('hidden');
    modal.classList.add('visible');
    window._importState = window._importState || {};
    window._importState[moduleId] = { source: null, parsedRows: [], mappedRecords: [], csvHeaders: [] };
  }

  // ──────────────── AUTO-SYNC FLOW ────────────────

  async function _openAutoSync(moduleId, status) {
    _wizardStep(moduleId, 5);
    const logEl   = document.getElementById(`sync-log-${moduleId}`);
    const barEl   = document.getElementById(`sync-bar-${moduleId}`);
    const pctEl   = document.getElementById(`sync-pct-${moduleId}`);
    const titleEl = document.getElementById(`sync-step-title-${moduleId}`);
    const actEl   = document.getElementById(`sync-actions-${moduleId}`);

    const appendLog = msg => {
      if (!logEl) return;
      const line = document.createElement('div');
      line.className = 'sync-log-line';
      line.textContent = msg;
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
    };

    const setProgress = pct => {
      if (barEl) barEl.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
    };

    // Subscribe to SSE
    KrogerSync.subscribeProgress({
      onLog:           msg  => appendLog(msg),
      onProgress:      d    => setProgress(d.percent || 0),
      onLoginComplete: ()   => {
        appendLog('✅ Login complete! Starting data sync...');
        if (titleEl) titleEl.textContent = '🔄 Syncing purchase data...';
        KrogerSync.startSync();
      },
      onSyncComplete:  d    => {
        setProgress(100);
        appendLog(`\n🎉 Sync complete — ${d.count} items fetched!`);
        if (titleEl) titleEl.textContent = `✅ Sync Complete — ${d.count} items`;
        // Normalize + import records
        const records = PurchaseModule.normalizeScrapedRecords(d.records || []);
        Store.insertBatch(moduleId, records);
        KrogerSync.unsubscribeProgress();
        _checkServerStatus(moduleId);
        // Update actions
        if (actEl) actEl.innerHTML = `
          <button class="btn btn-ghost" onclick="ModuleEngine.closeImport('${moduleId}'); ModuleEngine.renderTable('${moduleId}'); ModuleEngine.renderKPIs('${moduleId}');">Close</button>
          <button class="btn btn-primary" onclick="App.route('dashboard')">📊 View Dashboard</button>`;
        showToast(`✅ Imported ${records.length} records from Kroger`, 'success');
        renderTable(moduleId);
        renderKPIs(moduleId);
      },
      onSessionExpired: () => {
        appendLog('⚠️  Session expired — opening login...');
        KrogerSync.startLogin();
      },
      onError: msg => {
        appendLog(`❌ Error: ${msg}`);
        if (titleEl) titleEl.textContent = '❌ Sync Failed';
        if (actEl) actEl.innerHTML = `
          <button class="btn btn-ghost" onclick="ModuleEngine.closeImport('${moduleId}')">Close</button>
          <button class="btn btn-primary" onclick="ModuleEngine._wizardStep('${moduleId}', 1); ModuleEngine._openAutoSync('${moduleId}', {})">Retry</button>`;
        KrogerSync.unsubscribeProgress();
      }
    });

    // Start the appropriate action
    if (status.session_exists) {
      appendLog('📡 Connected to sync server — starting headless browser...');
      appendLog('⏳ This may take 1–3 minutes depending on your purchase history size.');
      setProgress(2);
      KrogerSync.startSync();
    } else {
      if (titleEl) titleEl.textContent = '🔐 Kroger Login Required';
      appendLog('👤 A Chrome window will open for you to log in to Kroger.');
      appendLog('⚠️  Complete the login — the window will close automatically.');
      appendLog('📌 Your credentials are NOT stored by this server.');
      appendLog('');
      KrogerSync.startLogin();
    }
  }

  function _selectSource(moduleId, sourceId) {
    const mod = _config.modules.find(m => m.id === moduleId);
    window._importState[moduleId].source = sourceId;
    const source = mod.dataSource?.sources?.find(s => s.id === sourceId);

    const titleEl = document.getElementById(`import-step2-title-${moduleId}`);
    const instrEl = document.getElementById(`import-instructions-${moduleId}`);

    if (source) {
      titleEl.textContent = `Step 2 — Get Data from ${source.name}`;
      instrEl.innerHTML = `
        <div class="instructions-box">
          <h5>How to get your data from ${source.name}</h5>
          <ol>${source.instructionSteps.map(s => `<li>${s}</li>`).join('')}</ol>
          <a href="${source.url}" target="_blank" class="btn btn-ghost mt-2">Open ${source.name} ↗</a>
        </div>`;
    } else if (sourceId === 'csv') {
      titleEl.textContent = 'Step 2 — Upload or Paste CSV';
      instrEl.innerHTML = `<div class="instructions-box"><p>Upload a CSV file or paste CSV text content below. The first row should be column headers.</p></div>`;
    } else {
      titleEl.textContent = 'Step 2 — Paste Copied Text';
      instrEl.innerHTML = `<div class="instructions-box"><p>Copy text from any purchase history page and paste it below. The parser will try to extract item names, dates, and prices.</p></div>`;
    }

    _wizardStep(moduleId, 2);
  }

  function _wizardStep(moduleId, step) {
    const wizard = document.getElementById(`import-wizard-${moduleId}`);
    if (!wizard) return;
    wizard.querySelectorAll('.wizard-step').forEach(el => {
      el.classList.toggle('hidden', el.dataset.step != step);
    });
  }

  function _onFileUpload(moduleId, input) {
    const file = input.files[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel && typeof XLSX !== 'undefined') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csvText = XLSX.utils.sheet_to_csv(firstSheet);
          document.getElementById(`import-paste-${moduleId}`).value = csvText;
          showToast(`Loaded ${workbook.SheetNames[0]} from Excel file!`, 'success');
        } catch (err) {
          showToast(`Excel parse error: ${err.message}`, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById(`import-paste-${moduleId}`).value = e.target.result;
      };
      reader.readAsText(file);
    }
  }

  function _parsePaste(moduleId) {
    const mod = _config.modules.find(m => m.id === moduleId);
    const text = document.getElementById(`import-paste-${moduleId}`).value.trim();
    if (!text) { showToast('Please paste or upload data first', 'warning'); return; }

    const state = window._importState[moduleId];
    const source = state.source;

    // Try CSV parse first
    const csv = PurchaseModule.parseCSV(text);

    if (csv.headers.length > 1) {
      // Looks like CSV
      state.csvHeaders = csv.headers;
      state.parsedRows = csv.rows;

      // Build mapping UI
      const mapEl = document.getElementById(`import-mapping-${moduleId}`);
      const existingMap = mod.importMappings?.[source + '_csv'] || {};
      mapEl.innerHTML = `
        <p class="mapping-info">Found <strong>${csv.rows.length}</strong> rows with <strong>${csv.headers.length}</strong> columns. Map each CSV column to a field below:</p>
        <div class="mapping-table-wrap">
          <table class="mapping-table">
            <thead><tr><th>CSV Column</th><th>→</th><th>Field</th><th>Sample Value</th></tr></thead>
            <tbody>
              ${csv.headers.map(h => {
                const autoMap = existingMap[h] || _autoMatch(h, mod.fields);
                const sample = csv.rows[0]?.[h] || '';
                return `
                  <tr>
                    <td><code>${h}</code></td>
                    <td>→</td>
                    <td>
                      <select class="select-sm col-map-select" data-csv-col="${h}">
                        <option value="">— Skip —</option>
                        ${mod.fields.map(f => `<option value="${f.id}" ${autoMap===f.id?'selected':''}>${f.label}</option>`).join('')}
                      </select>
                    </td>
                    <td class="sample-val">${_escapeHtml(sample)}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
      _wizardStep(moduleId, 3);
    } else {
      // Try Kroger paste parse
      if (moduleId === 'purchase') {
        const records = PurchaseModule.parseKrogerPaste(text);
        if (records.length > 0) {
          state.mappedRecords = records;
          _showPreview(moduleId, records, mod.fields);
          _wizardStep(moduleId, 4);
          return;
        }
      }
      showToast('Could not parse data. Please ensure it is valid CSV or copied purchase history text.', 'warning');
    }
  }

  function _autoMatch(csvCol, fields) {
    const c = csvCol.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const f of fields) {
      const fl = f.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (c === fl || c.includes(f.id) || f.id.includes(c) || fl.includes(c)) return f.id;
    }
    return '';
  }

  function _applyMapping(moduleId) {
    const mod = _config.modules.find(m => m.id === moduleId);
    const state = window._importState[moduleId];
    const selects = document.querySelectorAll(`#import-mapping-${moduleId} .col-map-select`);
    const mapping = {};
    selects.forEach(sel => {
      if (sel.value) mapping[sel.dataset.csvCol] = sel.value;
    });

    const records = PurchaseModule.applyMapping(state.parsedRows, mapping, mod.fields);
    if (!records.length) { showToast('No valid records found after mapping', 'warning'); return; }
    state.mappedRecords = records;
    _showPreview(moduleId, records, mod.fields);
    _wizardStep(moduleId, 4);
  }

  function _showPreview(moduleId, records, fields) {
    const previewEl = document.getElementById(`import-preview-${moduleId}`);
    const displayFields = fields.slice(0, 6);
    previewEl.innerHTML = `
      <p class="preview-info">Ready to import <strong>${records.length}</strong> records. Preview (first 5):</p>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>${displayFields.map(f => `<th>${f.label}</th>`).join('')}</tr></thead>
          <tbody>
            ${records.slice(0, 5).map(r => `
              <tr>${displayFields.map(f => `<td>${_renderCell(r[f.id], f)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${records.length > 5 ? `<p class="preview-more">... and ${records.length - 5} more records</p>` : ''}`;
  }

  function _confirmImport(moduleId) {
    const state = window._importState[moduleId];
    const records = state.mappedRecords;
    if (!records?.length) return;
    Store.insertBatch(moduleId, records);
    closeImport(moduleId);
    renderTable(moduleId);
    renderKPIs(moduleId);
    showToast(`✓ Imported ${records.length} records`, 'success');
  }

  function closeImport(moduleId) {
    const modal = document.getElementById(`import-modal-${moduleId}`);
    if (modal) { modal.classList.remove('visible'); modal.classList.add('hidden'); }
  }

  // ──────────────── EXPORT ────────────────

  function openExport(moduleId) {
    const mod = _config.modules.find(m => m.id === moduleId);
    const all = Store.getAll(moduleId);
    if (!all.length) { showToast('No data to export', 'warning'); return; }

    const menu = document.createElement('div');
    menu.className = 'export-menu card';
    menu.innerHTML = `
      <div class="export-menu-title">Export ${all.length} records as:</div>
      <button class="export-btn" onclick="ModuleEngine._doExport('${moduleId}','csv')">📄 CSV File</button>
      <button class="export-btn" onclick="ModuleEngine._doExport('${moduleId}','json')">📦 JSON File</button>
      <button class="export-btn close-export" onclick="this.parentElement.remove()">✕ Cancel</button>
    `;
    document.body.appendChild(menu);
  }

  function _doExport(moduleId, format) {
    const mod = _config.modules.find(m => m.id === moduleId);
    const all = Store.getAll(moduleId);
    const ts = new Date().toISOString().split('T')[0];
    document.querySelector('.export-menu')?.remove();

    if (format === 'csv') {
      const csv = PurchaseModule.exportToCSV(all, mod.fields);
      PurchaseModule.downloadCSV(`${moduleId}_export_${ts}.csv`, csv);
    } else {
      PurchaseModule.downloadJSON(`${moduleId}_export_${ts}.json`, all);
    }
    showToast(`Exported ${all.length} records as ${format.toUpperCase()}`, 'success');
  }

  // ──────────────── QUERY HANDLERS ────────────────

  function onSearch(moduleId, value) {
    _queryState[moduleId].search = value;
    _queryState[moduleId].page = 1;
    renderTable(moduleId);
  }

  function onSort(moduleId, field) {
    const qs = _queryState[moduleId];
    if (qs.sortBy === field) qs.sortDir = qs.sortDir === 'asc' ? 'desc' : 'asc';
    else { qs.sortBy = field; qs.sortDir = 'asc'; }
    renderTable(moduleId);
  }

  function onPage(moduleId, page) {
    _queryState[moduleId].page = page;
    renderTable(moduleId);
  }

  function onPageSize(moduleId, size) {
    _queryState[moduleId].pageSize = parseInt(size);
    _queryState[moduleId].page = 1;
    renderTable(moduleId);
  }

  // ──────────────── UTILS ────────────────

  function _formatValue(value, format) {
    if (isNaN(value)) return '—';
    switch (format) {
      case 'currency': return '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'number':   return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
      case 'percent':  return Number(value).toFixed(1) + '%';
      default:         return String(value);
    }
  }

  function _escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return {
    init, render, renderKPIs, renderTable,
    openForm, closeForm, submitForm, deleteRecord,
    openImport, closeImport, openExport,
    onSearch, onSort, onPage, onPageSize,
    _selectSource, _wizardStep, _onFileUpload, _parsePaste,
    _applyMapping, _confirmImport, _doExport,
    _openAutoSync, _checkServerStatus
  };
})();

window.ModuleEngine = ModuleEngine;
