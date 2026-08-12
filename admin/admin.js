/**
 * admin.js — System Admin Panel
 * Visual config editor — manage modules, fields, charts, theme, import mappings
 */

const AdminPanel = (() => {
  let _config = null;
  let _onSave = null;

  function init(config, onSave) {
    _config = JSON.parse(JSON.stringify(config)); // deep clone
    _onSave = onSave;
  }

  // ──────────────── MAIN RENDER ────────────────

  function render(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = `
      <div class="admin-header">
        <div>
          <h2 class="page-title">⚙️ System Administration</h2>
          <p class="page-subtitle">Configure modules, fields, charts, and application settings</p>
        </div>
        <div class="admin-actions">
          <button class="btn btn-ghost" onclick="AdminPanel.exportConfig()">⬇️ Export Config</button>
          <label class="btn btn-ghost file-upload-label">
            ⬆️ Import Config
            <input type="file" accept=".json" style="display:none" onchange="AdminPanel.importConfig(this)">
          </label>
          <button class="btn btn-ghost" onclick="AdminPanel.resetConfig()">🔄 Reset to Default</button>
        </div>
      </div>

      <div class="admin-layout">
        <!-- Left nav -->
        <div class="admin-sidenav">
          <button class="admin-nav-btn active" onclick="AdminPanel.showSection('app', this)">🎨 App Settings</button>
          <button class="admin-nav-btn" onclick="AdminPanel.showSection('modules', this)">📦 Modules</button>
          <button class="admin-nav-btn" onclick="AdminPanel.showSection('connectors', this)">🔌 Connectors</button>
          <button class="admin-nav-btn" onclick="AdminPanel.showSection('dashboard', this)">🏠 Dashboard</button>
          <button class="admin-nav-btn" onclick="AdminPanel.showSection('data', this)">🗄️ Data Management</button>
        </div>

        <!-- Right content -->
        <div class="admin-content" id="admin-content-area">
          <!-- Rendered by showSection() -->
        </div>
      </div>`;

    showSection('app', el.querySelector('.admin-nav-btn.active'));
  }

  function showSection(section, btn) {
    // Update nav active state
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const area = document.getElementById('admin-content-area');
    switch (section) {
      case 'app':        area.innerHTML = _renderAppSettings(); break;
      case 'modules':    area.innerHTML = _renderModulesSection(); break;
      case 'connectors': _renderConnectorsSection(area); break;
      case 'dashboard':  area.innerHTML = _renderDashboardSection(); break;
      case 'data':       area.innerHTML = _renderDataSection(); break;
    }
  }

  // ──────────────── APP SETTINGS ────────────────

  function _renderAppSettings() {
    const app = _config.app;
    const theme = app.theme;
    return `
      <div class="admin-section">
        <h3 class="admin-section-title">Application Settings</h3>

        <div class="card admin-card">
          <h4 class="admin-card-title">General</h4>
          <div class="form-grid">
            <div class="form-field">
              <label class="form-label">App Name</label>
              <input type="text" class="form-control" value="${app.name}" 
                onchange="AdminPanel._updateApp('name', this.value)">
            </div>
            <div class="form-field">
              <label class="form-label">Short Name</label>
              <input type="text" class="form-control" value="${app.shortName}"
                onchange="AdminPanel._updateApp('shortName', this.value)">
            </div>
            <div class="form-field">
              <label class="form-label">Logo Icon (emoji)</label>
              <input type="text" class="form-control" value="${app.logoIcon}"
                onchange="AdminPanel._updateApp('logoIcon', this.value)">
            </div>
            <div class="form-field">
              <label class="form-label">Tagline</label>
              <input type="text" class="form-control" value="${app.tagline}"
                onchange="AdminPanel._updateApp('tagline', this.value)">
            </div>
          </div>
        </div>

        <div class="card admin-card mt-4">
          <h4 class="admin-card-title">Theme Preset & Colors</h4>
          <div class="form-field mb-4">
            <label class="form-label">Visual Theme Preset</label>
            <select class="form-control" onchange="AdminPanel.applyPresetTheme(this.value)">
              <option value="cyber-dark" ${theme.preset==='cyber-dark'?'selected':''}>🌌 Cyber Dark Glass (Default)</option>
              <option value="midnight-neon" ${theme.preset==='midnight-neon'?'selected':''}>⚡ Midnight Neon</option>
              <option value="emerald-matrix" ${theme.preset==='emerald-matrix'?'selected':''}>🟢 Emerald Matrix</option>
              <option value="royal-violet" ${theme.preset==='royal-violet'?'selected':''}>👑 Royal Violet</option>
              <option value="clean-light" ${theme.preset==='clean-light'?'selected':''}>☀️ Clean Light Studio</option>
            </select>
          </div>
          <div class="form-grid">
            ${Object.entries(theme).filter(([k]) => k !== 'preset' && k !== 'textPrimary' && k !== 'textSecondary').map(([key, value]) => `
              <div class="form-field color-field">
                <label class="form-label">${_camelToLabel(key)}</label>
                <div class="color-input-wrap">
                  <input type="color" class="color-picker" value="${value.startsWith('#') ? value : '#6C63FF'}"
                    onchange="AdminPanel._updateTheme('${key}', this.value)">
                  <input type="text" class="form-control color-text" value="${value}"
                    onchange="AdminPanel._updateTheme('${key}', this.value)">
                </div>
              </div>`).join('')}
          </div>
        </div>

        <div class="admin-save-bar">
          <button class="btn btn-primary" onclick="AdminPanel.saveConfig()">💾 Save Settings</button>
        </div>
      </div>`;
  }

  // ──────────────── MODULES ────────────────

  function _renderModulesSection() {
    return `
      <div class="admin-section">
        <div class="admin-section-header">
          <h3 class="admin-section-title">Modules</h3>
          <button class="btn btn-primary" onclick="AdminPanel.addModule()">+ Add Module</button>
        </div>

        ${_config.modules.map((mod, idx) => `
          <div class="card admin-card mod-editor" id="mod-editor-${mod.id}">
            <div class="mod-editor-header" onclick="AdminPanel.toggleModEditor('${mod.id}')">
              <div class="mod-editor-title">
                <span class="mod-icon-big">${mod.icon}</span>
                <div>
                  <strong>${mod.name}</strong>
                  <span class="badge ${mod.enabled ? 'badge-success' : 'badge-muted'}">${mod.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
              <div class="mod-editor-controls">
                <label class="toggle-switch" title="Enable/Disable">
                  <input type="checkbox" ${mod.enabled ? 'checked' : ''} 
                    onchange="AdminPanel._toggleModule('${mod.id}', this.checked)" onclick="event.stopPropagation()">
                  <span class="toggle-slider"></span>
                </label>
                <span class="expand-icon">▾</span>
              </div>
            </div>

            <div class="mod-editor-body" id="mod-body-${mod.id}" style="display:none">
              <!-- Basic info -->
              <div class="form-grid mt-3">
                <div class="form-field">
                  <label class="form-label">Module Name</label>
                  <input type="text" class="form-control" value="${mod.name}"
                    onchange="AdminPanel._updateModule('${mod.id}', 'name', this.value)">
                </div>
                <div class="form-field">
                  <label class="form-label">Icon (emoji)</label>
                  <input type="text" class="form-control" value="${mod.icon}"
                    onchange="AdminPanel._updateModule('${mod.id}', 'icon', this.value)">
                </div>
                <div class="form-field col-span-2">
                  <label class="form-label">Description</label>
                  <input type="text" class="form-control" value="${mod.description}"
                    onchange="AdminPanel._updateModule('${mod.id}', 'description', this.value)">
                </div>
              </div>

              <!-- Fields -->
              <div class="fields-section mt-4">
                <div class="fields-section-header">
                  <h5>Fields (${mod.fields.length})</h5>
                  <button class="btn btn-ghost btn-sm" onclick="AdminPanel.addField('${mod.id}')">+ Add Field</button>
                </div>
                <div class="fields-list" id="fields-list-${mod.id}">
                  ${_renderFieldsList(mod)}
                </div>
              </div>

              <div class="admin-save-bar">
                <button class="btn btn-ghost danger" onclick="AdminPanel.deleteModule('${mod.id}')">🗑️ Delete Module</button>
                <button class="btn btn-primary" onclick="AdminPanel.saveConfig()">💾 Save Changes</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  }

  function _renderFieldsList(mod) {
    const typeColors = { text:'#6C63FF', number:'#00D4AA', currency:'#FFD93D', date:'#FF9F43', select:'#FF6B6B', textarea:'#48DBFB' };
    return mod.fields.map((f, fi) => `
      <div class="field-row" id="field-row-${mod.id}-${f.id}">
        <span class="field-drag">⠿</span>
        <span class="field-type-badge" style="background:${typeColors[f.type]||'#666'}">${f.type}</span>
        <span class="field-id"><code>${f.id}</code></span>
        <span class="field-label">${f.label}</span>
        <span class="field-req">${f.required ? '✓ Required' : 'Optional'}</span>
        <div class="field-actions">
          <button class="btn-icon" title="Edit" onclick="AdminPanel.editField('${mod.id}', ${fi})">✏️</button>
          <button class="btn-icon danger" title="Delete" onclick="AdminPanel.deleteField('${mod.id}', ${fi})">🗑️</button>
        </div>
      </div>`).join('');
  }

  // ──────────────── DASHBOARD SECTION ────────────────

  function _renderDashboardSection() {
    const dash = _config.dashboard;
    return `
      <div class="admin-section">
        <h3 class="admin-section-title">Dashboard Layout</h3>
        <div class="card admin-card">
          <div class="form-grid">
            <div class="form-field">
              <label class="form-label">Dashboard Title</label>
              <input type="text" class="form-control" value="${dash.title}"
                onchange="AdminPanel._config.dashboard.title = this.value">
            </div>
            <div class="form-field">
              <label class="form-label">Default Module</label>
              <select class="form-control" onchange="AdminPanel._config.dashboard.defaultModule = this.value">
                ${_config.modules.map(m => `<option value="${m.id}" ${dash.defaultModule===m.id?'selected':''}>${m.name}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="card admin-card mt-4">
          <h4 class="admin-card-title">Layout Items</h4>
          <div class="layout-list">
            ${dash.layout.map((item, i) => {
              const mod = _config.modules.find(m => m.id === item.moduleId);
              const chart = item.type === 'chart' ? mod?.analytics?.charts?.find(c => c.id === item.chartId) : null;
              return `
                <div class="layout-row">
                  <span class="layout-type-badge ${item.type}">${item.type}</span>
                  <span>${chart ? chart.title : 'KPI Cards'}</span>
                  <span class="layout-module">${mod?.name || item.moduleId}</span>
                  <span class="layout-cols">cols: ${item.cols}</span>
                  <input type="number" class="form-control input-sm" value="${item.cols}" min="3" max="12"
                    onchange="AdminPanel._config.dashboard.layout[${i}].cols = parseInt(this.value)">
                  <button class="btn-icon danger" onclick="AdminPanel.removeLayoutItem(${i})">🗑️</button>
                </div>`;
            }).join('')}
          </div>
        </div>

        <div class="admin-save-bar">
          <button class="btn btn-primary" onclick="AdminPanel.saveConfig()">💾 Save Dashboard Layout</button>
        </div>
      </div>`;
  }

  // ──────────────── DATA MANAGEMENT ────────────────

  function _renderDataSection() {
    const rows = _config.modules.map(mod => {
      const count = Store.getAll(mod.id).length;
      return `
        <div class="data-mod-row">
          <span class="mod-icon">${mod.icon}</span>
          <div class="data-mod-info">
            <strong>${mod.name}</strong>
            <span class="text-secondary">${count} records</span>
          </div>
          <div class="data-mod-actions">
            <button class="btn btn-ghost btn-sm" onclick="AdminPanel.exportModuleData('${mod.id}')">⬇️ Export</button>
            <label class="btn btn-ghost btn-sm file-upload-label">
              ⬆️ Import
              <input type="file" accept=".json" style="display:none" onchange="AdminPanel.importModuleData('${mod.id}', this)">
            </label>
            <button class="btn btn-sm danger" onclick="AdminPanel.clearModuleData('${mod.id}')">🗑️ Clear Data</button>
          </div>
        </div>`;
    });

    return `
      <div class="admin-section">
        <h3 class="admin-section-title">Data Management</h3>
        <div class="card admin-card">
          <p class="text-secondary mb-3">Manage stored data for each module. Export for backup or import from a previous export.</p>
          ${rows.join('')}
        </div>

        <div class="card admin-card mt-4 danger-zone">
          <h4 class="admin-card-title danger-title">⚠️ Danger Zone</h4>
          <p class="text-secondary">These actions cannot be undone.</p>
          <button class="btn danger mt-3" onclick="AdminPanel.clearAllData()">🗑️ Clear All Data (All Modules)</button>
        </div>
      </div>`;
  }

  // ──────────────── FIELD EDITOR ────────────────

  function editField(moduleId, fieldIdx) {
    const mod = _config.modules.find(m => m.id === moduleId);
    const f = mod.fields[fieldIdx];
    if (!f) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay visible';
    overlay.id = 'field-edit-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3>Edit Field: ${f.label}</h3>
          <button class="modal-close" onclick="document.getElementById('field-edit-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="form-field">
              <label class="form-label">Field ID <span class="text-secondary">(no spaces)</span></label>
              <input type="text" id="fe-id" class="form-control" value="${f.id}">
            </div>
            <div class="form-field">
              <label class="form-label">Label</label>
              <input type="text" id="fe-label" class="form-control" value="${f.label}">
            </div>
            <div class="form-field">
              <label class="form-label">Type</label>
              <select id="fe-type" class="form-control">
                ${['text','number','currency','date','select','textarea'].map(t =>
                  `<option value="${t}" ${f.type===t?'selected':''}>${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-field">
              <label class="form-label">Icon (emoji)</label>
              <input type="text" id="fe-icon" class="form-control" value="${f.icon||''}">
            </div>
            <div class="form-field">
              <label class="form-label">Placeholder</label>
              <input type="text" id="fe-placeholder" class="form-control" value="${f.placeholder||''}">
            </div>
            <div class="form-field">
              <label class="form-label">Group</label>
              <select id="fe-group" class="form-control">
                ${(mod.fieldGroups||[]).map(g => `<option value="${g.id}" ${f.group===g.id?'selected':''}>${g.label}</option>`).join('')}
              </select>
            </div>
            <div class="form-field col-span-2">
              <label class="form-label">Options (for select type, one per line)</label>
              <textarea id="fe-options" class="form-control" rows="4">${(f.options||[]).join('\n')}</textarea>
            </div>
          </div>
          <div class="field-required-check mt-3">
            <label class="checkbox-label">
              <input type="checkbox" id="fe-required" ${f.required?'checked':''}>
              Required field
            </label>
          </div>
          <div class="form-actions mt-4">
            <button class="btn btn-ghost" onclick="document.getElementById('field-edit-overlay').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="AdminPanel._saveField('${moduleId}', ${fieldIdx})">Save Field</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  function _saveField(moduleId, fieldIdx) {
    const mod = _config.modules.find(m => m.id === moduleId);
    const optionsText = document.getElementById('fe-options')?.value || '';
    mod.fields[fieldIdx] = {
      ...mod.fields[fieldIdx],
      id:          document.getElementById('fe-id').value.trim(),
      label:       document.getElementById('fe-label').value.trim(),
      type:        document.getElementById('fe-type').value,
      icon:        document.getElementById('fe-icon').value.trim(),
      placeholder: document.getElementById('fe-placeholder').value.trim(),
      group:       document.getElementById('fe-group').value,
      required:    document.getElementById('fe-required').checked,
      options:     optionsText ? optionsText.split('\n').map(s => s.trim()).filter(Boolean) : undefined
    };
    document.getElementById('field-edit-overlay')?.remove();
    document.getElementById(`fields-list-${moduleId}`).innerHTML = _renderFieldsList(mod);
    showToast('Field updated — click Save Changes to persist', 'info');
  }

  function addField(moduleId) {
    const mod = _config.modules.find(m => m.id === moduleId);
    const newField = {
      id: `field_${Date.now()}`, label: 'New Field', type: 'text',
      required: false, placeholder: '', icon: '📝', group: mod.fieldGroups?.[0]?.id || '_default'
    };
    mod.fields.push(newField);
    document.getElementById(`fields-list-${moduleId}`).innerHTML = _renderFieldsList(mod);
    editField(moduleId, mod.fields.length - 1);
  }

  function deleteField(moduleId, fieldIdx) {
    if (!confirm('Delete this field?')) return;
    const mod = _config.modules.find(m => m.id === moduleId);
    mod.fields.splice(fieldIdx, 1);
    document.getElementById(`fields-list-${moduleId}`).innerHTML = _renderFieldsList(mod);
  }

  function toggleModEditor(moduleId) {
    const body = document.getElementById(`mod-body-${moduleId}`);
    if (!body) return;
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
  }

  function addModule() {
    const newMod = {
      id: `module_${Date.now()}`, name: 'New Module', icon: '📦',
      description: 'A new configurable module', enabled: true, color: '#6C63FF',
      fields: [], fieldGroups: [{ id: 'default', label: 'Fields', icon: '📋' }],
      table: { defaultColumns: [], sortBy: '', sortDir: 'desc', pageSize: 20 },
      analytics: { kpis: [], charts: [] },
      dataSource: { type: 'manual', importEnabled: true, exportEnabled: true }
    };
    _config.modules.push(newMod);
    showSection('modules', document.querySelector('.admin-nav-btn.active'));
    showToast('New module added — configure it and save', 'success');
  }

  function deleteModule(moduleId) {
    if (!confirm(`Delete module "${moduleId}"? This cannot be undone.`)) return;
    _config.modules = _config.modules.filter(m => m.id !== moduleId);
    showSection('modules', document.querySelector('.admin-nav-btn.active'));
    showToast('Module deleted', 'info');
  }

  // ──────────────── CONFIG PERSISTENCE ────────────────

  function saveConfig() {
    Store.saveConfig(_config);
    if (_onSave) _onSave(_config);
    showToast('✓ Configuration saved', 'success');
  }

  function exportConfig() {
    const blob = new Blob([JSON.stringify(_config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `framgnt-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Config exported', 'success');
  }

  function importConfig(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        _config = imported;
        Store.saveConfig(_config);
        if (_onSave) _onSave(_config);
        showSection('app', document.querySelector('.admin-nav-btn'));
        showToast('Config imported and applied', 'success');
      } catch(err) {
        showToast('Error parsing config file', 'error');
      }
    };
    reader.readAsText(file);
  }

  function resetConfig() {
    if (!confirm('Reset to default config? All customizations will be lost.')) return;
    localStorage.removeItem('framgnt_config_override');
    location.reload();
  }

  function exportModuleData(moduleId) {
    const data = Store.exportModuleData(moduleId);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${moduleId}_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importModuleData(moduleId, input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = Store.importModuleData(moduleId, e.target.result);
      if (result.success) showToast(`Imported ${result.count} records`, 'success');
      else showToast(`Import failed: ${result.error}`, 'error');
      showSection('data', null);
    };
    reader.readAsText(file);
  }

  function clearModuleData(moduleId) {
    if (!confirm(`Clear all data for module "${moduleId}"?`)) return;
    Store.removeAll(moduleId);
    showSection('data', null);
    showToast('Module data cleared', 'info');
  }

  function clearAllData() {
    if (!confirm('Clear ALL data from ALL modules? This cannot be undone!')) return;
    _config.modules.forEach(m => Store.removeAll(m.id));
    showSection('data', null);
    showToast('All data cleared', 'info');
  }

  function removeLayoutItem(idx) {
    _config.dashboard.layout.splice(idx, 1);
    showSection('dashboard', null);
  }

  // ──────────────── CONNECTORS SECTION ────────────────

  // ──────────────── CONNECTORS SECTION ────────────────

  function _renderConnectorsSection(container) {
    const defaultEmail = '';
    const defaultPwd = '';
    const defaultUrl = 'https://www.kroger.com/mypurchases?page={page}&tab=purchases';
    const defaultPages = 5;

    container.innerHTML = `
      <div class="admin-section">
        <h3 class="admin-section-title">🔌 Automated Data Connectors</h3>
        <p class="admin-section-subtitle" style="margin-top:-0.5rem;margin-bottom:1rem;color:var(--text-2);font-size:0.85rem">
          Configure background scrapers, pagination parameters, and official Kroger Developer API credentials.
        </p>

        <!-- 1. Kroger Official Developer API Connector Card -->
        <div class="card admin-card p-4 mb-4">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
            <div style="display:flex;align-items:center;gap:0.75rem">
              <span style="font-size:2rem">🔑</span>
              <div>
                <strong style="font-size:1.1rem">Kroger Official Developer Portal API Connector</strong>
                <div style="font-size:0.78rem;color:var(--text-2)">Official REST API (OAuth2 Client Credentials & Products/Cart/Profile)</div>
              </div>
            </div>
            <div id="badge-kroger-api">
              <span class="badge badge-muted">⚪ Checking status...</span>
            </div>
          </div>

          <div style="background:var(--bg-input);padding:1rem;border-radius:var(--radius);margin-bottom:1rem;border:1px solid var(--border)">
            <h5 style="margin-top:0;margin-bottom:0.75rem;font-size:0.88rem;color:var(--text)">🌐 Official Developer API Credentials (developer.kroger.com)</h5>
            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">API Client ID</label>
                <input type="text" id="connector-kroger-api-client-id" class="form-control" 
                       placeholder="my-app-client-id" value="">
              </div>
              <div class="form-field">
                <label class="form-label">API Client Secret</label>
                <input type="password" id="connector-kroger-api-client-secret" class="form-control" 
                       placeholder="••••••••••••••••" value="">
              </div>
              <div class="form-field" style="grid-column: span 2">
                <label class="form-label">User Loyalty ID / Account ID (Optional)</label>
                <input type="text" id="connector-kroger-api-user-id" class="form-control" 
                       placeholder="400000000000" value="">
              </div>
            </div>
            <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" onclick="AdminPanel.saveConnectorCredentials('kroger-api')">💾 Save API Credentials</button>
              <button class="btn btn-ghost btn-sm" onclick="AdminPanel.testApiProduct('products')">📦 Test Products API</button>
              <button class="btn btn-ghost btn-sm" onclick="AdminPanel.testApiProduct('locations')">📍 Test Locations API</button>
              <button class="btn btn-ghost btn-sm" onclick="AdminPanel.testApiProduct('profile')">👤 Test Profile API</button>
              <button class="btn btn-ghost btn-sm" onclick="AdminPanel.testApiProduct('cart')">🛒 Test Cart API</button>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="font-size:0.78rem;color:var(--text-3)">
              Accesses official Kroger Developer Portal APIs (OAuth2, Product Catalog, Store Locations, Profile & Cart).
            </div>
            <button class="btn btn-accent btn-sm" onclick="AdminPanel.triggerConnectorSync('kroger-api')">⚡ Run Multi-Product API Sync</button>
          </div>
        </div>

        <!-- 2. Kroger Web Scraper Connector Card -->
        <div class="card admin-card p-4">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
            <div style="display:flex;align-items:center;gap:0.75rem">
              <span style="font-size:2rem">🛒</span>
              <div>
                <strong style="font-size:1.1rem">Kroger Web Auto-Sync Connector</strong>
                <div style="font-size:0.78rem;color:var(--text-2)">Target Module: Purchases (purchase)</div>
              </div>
            </div>
            <div id="badge-kroger-scraper">
              <span class="badge badge-muted">⚪ Checking status...</span>
            </div>
          </div>

          <div style="background:var(--bg-input);padding:1rem;border-radius:var(--radius);margin-bottom:1rem;border:1px solid var(--border)">
            <h5 style="margin-top:0;margin-bottom:0.75rem;font-size:0.88rem;color:var(--text)">🔐 Configurable Kroger Credentials & Scraper Settings</h5>
            <div class="form-grid">
              <div class="form-field">
                <label class="form-label">Kroger Email</label>
                <input type="email" id="connector-kroger-email" class="form-control" 
                       placeholder="user@example.com" value="${_escapeHtml(defaultEmail)}">
              </div>
              <div class="form-field">
                <label class="form-label">Kroger Password</label>
                <input type="password" id="connector-kroger-password" class="form-control" 
                       placeholder="••••••••" value="${_escapeHtml(defaultPwd)}">
              </div>
              <div class="form-field" style="grid-column: span 2">
                <label class="form-label">Purchase URL Pattern ({page} placeholder)</label>
                <input type="text" id="connector-kroger-url" class="form-control" 
                       value="${_escapeHtml(defaultUrl)}">
              </div>
              <div class="form-field">
                <label class="form-label">Max Pages to Scrape</label>
                <input type="number" id="connector-kroger-pages" class="form-control" 
                       value="${defaultPages}" min="1" max="50">
              </div>
            </div>
            <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" onclick="AdminPanel.saveConnectorCredentials('kroger')">💾 Save Settings & Credentials</button>
              <button class="btn btn-ghost btn-sm" onclick="AdminPanel.clearConnectorSession('kroger')">🗑️ Clear Saved Session</button>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="font-size:0.78rem;color:var(--text-3)">
              Background auto-sync runs 100% headlessly with silent session authentication.
            </div>
            <button class="btn btn-accent btn-sm" onclick="AdminPanel.triggerConnectorSync('kroger')">⚡ Start Auto-Sync Now</button>
          </div>
        </div>

        <!-- 3. Sales Excel File Watcher Connector Card -->
        <div class="card admin-card p-4">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
            <div style="display:flex;align-items:center;gap:0.75rem">
              <span style="font-size:2rem">📈</span>
              <div>
                <strong style="font-size:1.1rem">Excel Sales Report Auto-Watcher Connector</strong>
                <div style="font-size:0.78rem;color:var(--text-2)">Target Module: Sale Data (sales)</div>
              </div>
            </div>
            <div id="badge-sales-excel">
              <span class="badge badge-muted">⚪ Checking status...</span>
            </div>
          </div>

          <div style="background:var(--bg-input);padding:1rem;border-radius:var(--radius);margin-bottom:1rem;border:1px solid var(--border)">
            <h5 style="margin-top:0;margin-bottom:0.75rem;font-size:0.88rem;color:var(--text)">📁 Auto-Watch Directory & Ingestion Rules</h5>
            <div class="form-grid">
              <div class="form-field" style="grid-column: span 2">
                <label class="form-label">Auto-Watch Directory Path</label>
                <input type="text" id="connector-sales-excel-folder" class="form-control" 
                       placeholder="C:\PROJECTS\FraMgnt\resources" value="C:\\PROJECTS\\FraMgnt\\resources">
              </div>
              <div class="form-field">
                <label class="form-label">File Mask Pattern</label>
                <input type="text" id="connector-sales-excel-mask" class="form-control" 
                       placeholder="*.xlsx" value="*.xlsx">
              </div>
            </div>
            <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" onclick="AdminPanel.saveConnectorCredentials('sales-excel')">💾 Save Directory Settings</button>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="font-size:0.78rem;color:var(--text-3)">
              Scans watched local folder and automatically ingests daily sales spreadsheets.
            </div>
            <button class="btn btn-accent btn-sm" onclick="AdminPanel.triggerConnectorSync('sales-excel')">⚡ Run Sales Ingestion</button>
          </div>
        </div>
      </div>`;

    // Asynchronously fetch status and populate badges & inputs without blocking initial render
    (async () => {
      if (typeof KrogerApiConnector !== 'undefined') {
        const st = await KrogerApiConnector.getStatus();
        const badgeEl = document.getElementById('badge-kroger-api');
        if (badgeEl) {
          badgeEl.innerHTML = st.offline
            ? '<span class="badge badge-danger">🔴 Server Offline</span>'
            : st.has_credentials
              ? '<span class="badge badge-success">🟢 Official API Configured</span>'
              : '<span class="badge badge-warning">⚪ API Setup Required</span>';
        }
        if (st.credentials) {
          const clientIdEl = document.getElementById('connector-kroger-api-client-id');
          const clientSecretEl = document.getElementById('connector-kroger-api-client-secret');
          const userIdEl = document.getElementById('connector-kroger-api-user-id');
          if (clientIdEl && st.credentials.client_id) clientIdEl.value = st.credentials.client_id;
          if (clientSecretEl && st.credentials.client_secret) clientSecretEl.value = st.credentials.client_secret;
          if (userIdEl && st.credentials.user_id) userIdEl.value = st.credentials.user_id;
        }
      }

      if (typeof KrogerConnector !== 'undefined') {
        const st = await KrogerConnector.getStatus();
        const badgeEl = document.getElementById('badge-kroger-scraper');
        if (badgeEl) {
          badgeEl.innerHTML = st.offline
            ? '<span class="badge badge-danger">🔴 Server Offline</span>'
            : st.session_exists
              ? '<span class="badge badge-success">🟢 Active Session Ready</span>'
              : st.has_credentials
                ? '<span class="badge badge-warning">🔑 Credentials Configured</span>'
                : '<span class="badge badge-muted">⚪ Setup Required</span>';
        }
        if (st.credentials) {
          const emailEl = document.getElementById('connector-kroger-email');
          const pwdEl = document.getElementById('connector-kroger-password');
          const urlEl = document.getElementById('connector-kroger-url');
          const pagesEl = document.getElementById('connector-kroger-pages');
          if (emailEl && st.credentials.email) emailEl.value = st.credentials.email;
          if (pwdEl && st.credentials.password) pwdEl.value = st.credentials.password;
          if (urlEl && st.credentials.url_pattern) urlEl.value = st.credentials.url_pattern;
          if (pagesEl && st.credentials.max_pages) pagesEl.value = st.credentials.max_pages;
        }
      }

      if (typeof SalesExcelConnector !== 'undefined') {
        const st = await SalesExcelConnector.getStatus();
        const badgeEl = document.getElementById('badge-sales-excel');
        if (badgeEl) {
          badgeEl.innerHTML = st.offline
            ? '<span class="badge badge-danger">🔴 Server Offline</span>'
            : st.has_credentials
              ? '<span class="badge badge-success">🟢 Folder Watcher Ready</span>'
              : '<span class="badge badge-warning">⚪ Folder Setup Required</span>';
        }
        if (st.credentials) {
          const folderEl = document.getElementById('connector-sales-excel-folder');
          const maskEl = document.getElementById('connector-sales-excel-mask');
          if (folderEl && st.credentials.watch_folder) folderEl.value = st.credentials.watch_folder;
          if (maskEl && st.credentials.file_mask) maskEl.value = st.credentials.file_mask;
        }
      }
    })();
  }

  async function saveConnectorCredentials(connectorId) {
    if (connectorId === 'kroger') {
      const email = document.getElementById('connector-kroger-email')?.value?.trim();
      const password = document.getElementById('connector-kroger-password')?.value;
      const urlPattern = document.getElementById('connector-kroger-url')?.value?.trim() || 'https://www.kroger.com/mypurchases?page={page}&tab=purchases';
      const maxPages = parseInt(document.getElementById('connector-kroger-pages')?.value) || 5;

      if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
      }
      try {
        const res = await KrogerConnector.saveCredentials({
          email,
          password,
          url_pattern: urlPattern,
          max_pages: maxPages
        });
        if (res.ok) {
          showToast('Kroger settings & credentials saved successfully!', 'success');
          showSection('connectors', null);
        } else {
          showToast(`Error: ${res.error}`, 'error');
        }
      } catch (err) {
        showToast('Failed to save settings (is server running?)', 'error');
      }
    } else if (connectorId === 'kroger-api') {
      const clientId = document.getElementById('connector-kroger-api-client-id')?.value?.trim();
      const clientSecret = document.getElementById('connector-kroger-api-client-secret')?.value;
      const userId = document.getElementById('connector-kroger-api-user-id')?.value?.trim();

      if (!clientId || !clientSecret) {
        showToast('Please enter API Client ID and Client Secret', 'error');
        return;
      }
      try {
        const res = await KrogerApiConnector.saveCredentials({
          client_id: clientId,
          client_secret: clientSecret,
          user_id: userId
        });
        if (res.ok) {
          showToast('Kroger Developer API credentials saved!', 'success');
          showSection('connectors', null);
        } else {
          showToast(`Error: ${res.error}`, 'error');
        }
      } catch (err) {
        showToast('Failed to save API credentials (is server running?)', 'error');
      }
    } else if (connectorId === 'sales-excel') {
      const folderPath = document.getElementById('connector-sales-excel-folder')?.value?.trim();
      const mask = document.getElementById('connector-sales-excel-mask')?.value?.trim() || '*.xlsx';

      if (!folderPath) {
        showToast('Please enter watch directory path', 'error');
        return;
      }
      try {
        const res = await SalesExcelConnector.saveCredentials({
          watch_folder: folderPath,
          file_mask: mask
        });
        if (res.ok) {
          showToast('Sales Excel Watcher settings saved!', 'success');
          showSection('connectors', null);
        } else {
          showToast(`Error: ${res.error}`, 'error');
        }
      } catch (err) {
        showToast('Failed to save Sales Excel settings (is server running?)', 'error');
      }
    }
  }

  async function launchInteractiveLogin(connectorId) {
    if (connectorId === 'kroger') {
      showToast('Opening Chrome window for Kroger sign-in...', 'info');
      try {
        await KrogerConnector.startInteractiveLogin();
      } catch (err) {
        showToast('Failed to launch interactive login', 'error');
      }
    }
  }

  async function clearConnectorSession(connectorId) {
    if (connectorId === 'kroger') {
      try {
        await KrogerConnector.clearSession();
        showToast('Kroger session cleared', 'info');
        showSection('connectors', null);
      } catch (err) {
        showToast('Failed to clear session', 'error');
      }
    }
  }

  async function triggerConnectorSync(connectorId) {
    if (connectorId === 'kroger') {
      if (typeof ModuleEngine !== 'undefined' && ModuleEngine._openAutoSync) {
        ModuleEngine._openAutoSync('purchase');
      } else {
        showToast('Opening sync runner...', 'info');
        KrogerConnector.startSync();
      }
    } else if (connectorId === 'kroger-api') {
      showToast('Starting Official Kroger Developer API sync...', 'info');
      try {
        const res = await KrogerApiConnector.startSync();
        if (res.ok) showToast('Official API Sync initiated!', 'success');
        else showToast(`API Sync Error: ${res.error}`, 'error');
      } catch (err) {
        showToast('Failed to trigger Official API Sync', 'error');
      }
    } else if (connectorId === 'sales-excel') {
      showToast('Starting Sales Excel Ingestion Sync...', 'info');
      try {
        const res = await SalesExcelConnector.startSync();
        if (res.ok) showToast('Sales Ingestion initiated!', 'success');
        else showToast(`Sales Sync Error: ${res.error}`, 'error');
      } catch (err) {
        showToast('Failed to trigger Sales Ingestion', 'error');
      }
    }
  }

  async function testApiProduct(productType) {
    showToast(`Testing Kroger ${productType.toUpperCase()} API...`, 'info');
    try {
      let res;
      if (productType === 'products') res = await KrogerApiConnector.testProductSearch('milk', 3);
      else if (productType === 'locations') res = await KrogerApiConnector.testLocationsSearch('45202');
      else if (productType === 'profile') res = await KrogerApiConnector.testProfile();
      else if (productType === 'cart') res = await KrogerApiConnector.testCart();

      if (res && res.ok) {
        showToast(`✅ ${productType.toUpperCase()} API Success!`, 'success');
        console.log(`[Kroger API ${productType}]`, res);
      } else {
        const msg = (res && res.error) ? res.error : (res && res.data && res.data.error) ? JSON.stringify(res.data.error) : 'API Error';
        showToast(`⚠️ ${productType.toUpperCase()} API: ${msg}`, 'warning');
      }
    } catch (err) {
      showToast(`Failed to test ${productType} API: ${err.message}`, 'error');
    }
  }

  // ──────────────── MUTATION HELPERS ────────────────

  function applyPresetTheme(presetName) {
    _config.app.theme = _config.app.theme || {};
    _config.app.theme.preset = presetName;

    const presets = {
      'cyber-dark': {
        primaryColor: '#6C63FF', accentColor: '#00D4AA', dangerColor: '#FF6B6B', warningColor: '#FFD93D',
        bgDark: '#0B0C15', bgCard: 'rgba(26, 27, 46, 0.7)', bgSidebar: 'rgba(18, 19, 42, 0.85)',
        textPrimary: '#F0F0F8', textSecondary: '#9D9FC2', borderColor: 'rgba(255, 255, 255, 0.08)'
      },
      'midnight-neon': {
        primaryColor: '#00F0FF', accentColor: '#FF007F', dangerColor: '#FF3366', warningColor: '#FFCC00',
        bgDark: '#05050D', bgCard: 'rgba(15, 15, 35, 0.8)', bgSidebar: 'rgba(10, 10, 25, 0.9)',
        textPrimary: '#FFFFFF', textSecondary: '#8F93B8', borderColor: 'rgba(0, 240, 255, 0.15)'
      },
      'emerald-matrix': {
        primaryColor: '#10B981', accentColor: '#3B82F6', dangerColor: '#EF4444', warningColor: '#F59E0B',
        bgDark: '#06130D', bgCard: 'rgba(12, 31, 22, 0.75)', bgSidebar: 'rgba(8, 22, 16, 0.9)',
        textPrimary: '#ECFDF5', textSecondary: '#86EFAC', borderColor: 'rgba(16, 185, 129, 0.15)'
      },
      'royal-violet': {
        primaryColor: '#8B5CF6', accentColor: '#EC4899', dangerColor: '#F43F5E', warningColor: '#F59E0B',
        bgDark: '#0F091A', bgCard: 'rgba(29, 18, 50, 0.75)', bgSidebar: 'rgba(20, 12, 36, 0.9)',
        textPrimary: '#F5F3FF', textSecondary: '#DDD6FE', borderColor: 'rgba(139, 92, 246, 0.18)'
      },
      'clean-light': {
        primaryColor: '#4F46E5', accentColor: '#0D9488', dangerColor: '#E11D48', warningColor: '#D97706',
        bgDark: '#F8FAFC', bgCard: '#FFFFFF', bgSidebar: '#F1F5F9',
        textPrimary: '#0F172A', textSecondary: '#475569', borderColor: '#E2E8F0'
      }
    };

    if (presets[presetName]) {
      Object.assign(_config.app.theme, presets[presetName]);
      App.applyTheme(_config.app.theme);
      showToast(`Applied "${presetName}" theme preset!`, 'success');
      showSection('app', document.querySelector('.admin-nav-btn.active'));
    }
  }

  function _updateApp(key, value) { _config.app[key] = value; }
  function _updateTheme(key, value) { _config.app.theme[key] = value; }
  function _updateModule(moduleId, key, value) {
    const mod = _config.modules.find(m => m.id === moduleId);
    if (mod) mod[key] = value;
  }
  function _toggleModule(moduleId, enabled) {
    const mod = _config.modules.find(m => m.id === moduleId);
    if (mod) mod.enabled = enabled;
  }

  function _camelToLabel(str) {
    return str.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  }

  // Public API — _config exposed as a getter/setter via closure access
  const api = {
    init, render, showSection, applyPresetTheme,
    toggleModEditor, addModule, deleteModule,
    editField, addField, deleteField,
    saveConfig, exportConfig, importConfig, resetConfig,
    exportModuleData, importModuleData, clearModuleData, clearAllData,
    removeLayoutItem,
    saveConnectorCredentials, clearConnectorSession, launchInteractiveLogin, triggerConnectorSync, testApiProduct,
    _updateApp, _updateTheme, _updateModule, _toggleModule,
    _saveField,
    get _config() { return _config; },
    set _config(v) { _config = v; }
  };
  return api;
})();

window.AdminPanel = AdminPanel;

