/**
 * app.js — Core Application Engine & Router
 * Loads config, builds navigation, manages routes, renders views
 */

const App = (() => {
  let _config = null;
  let _currentRoute = null;

  // ──────────────── BOOTSTRAP ────────────────

  async function init() {
    showLoader();
    try {
      // Load base config from file
      const resp = await fetch('./config/system.config.json');
      const baseConfig = await resp.json();

      // Merge with any admin overrides stored in localStorage
      const override = Store.loadConfigOverride();
      _config = override ? _mergeConfig(baseConfig, override) : baseConfig;

      // Ensure newly added modules in system.config.json are preserved
      if (baseConfig.modules) {
        baseConfig.modules.forEach(m => {
          if (!_config.modules.some(existing => existing.id === m.id)) {
            _config.modules.push(m);
          }
        });
      }
      if (baseConfig.navigation) {
        baseConfig.navigation.forEach(n => {
          if (!_config.navigation.some(existing => existing.id === n.id)) {
            const targetIdx = baseConfig.navigation.indexOf(n);
            _config.navigation.splice(targetIdx, 0, n);
          }
        });
      }

      // Apply theme
      applyTheme(_config.app.theme);

      // Initialize subsystems
      ModuleEngine.init(_config);
      Dashboard.init(_config);
      AdminPanel.init(_config, onConfigSave);
      if (typeof KrogerSync !== 'undefined') KrogerSync.configure(_config);


      // Build UI
      buildTopbar();
      buildSidebar();
      buildToastContainer();

      // Route to initial view
      const hash = location.hash.replace('#', '') || 'dashboard';
      route(hash);

      // Listen for hash changes
      window.addEventListener('hashchange', () => {
        route(location.hash.replace('#', ''));
      });

      hideLoader();
    } catch (err) {
      console.error('App init failed', err);
      document.getElementById('app-loader').innerHTML = `
        <div style="text-align:center;color:#FF6B6B">
          <div style="font-size:2rem">⚠️</div>
          <h3>Failed to load config</h3>
          <p style="color:#8B8DAF;margin-top:.5rem">${err.message}</p>
        </div>`;
    }
  }

  // ──────────────── TOPBAR ────────────────

  function buildTopbar() {
    const app = _config.app;
    const el = document.getElementById('topbar');
    el.innerHTML = `
      <button class="mobile-nav-toggle" id="mobile-nav-toggle" aria-label="Toggle navigation" onclick="App.toggleMobileSidebar()">
        <span class="hamburger-bar"></span>
        <span class="hamburger-bar"></span>
        <span class="hamburger-bar"></span>
      </button>
      <a class="topbar-logo" href="#dashboard">
        <span class="topbar-logo-icon">${app.logoIcon}</span>
        <span>${app.shortName}<span class="topbar-logo-accent"> Analytics</span></span>
      </a>
      <div class="topbar-breadcrumb" id="breadcrumb">
        <span>Dashboard</span>
      </div>
      <div class="topbar-spacer"></div>
      <div class="topbar-right">
        <span class="topbar-pill">v${app.version}</span>
        <div class="user-avatar" title="Admin">A</div>
      </div>`;

    _ensureSidebarBackdrop();
  }

  // ──────────────── SIDEBAR ────────────────

  function buildSidebar() {
    const nav = _config.navigation;
    const modules = _config.modules.filter(m => m.enabled);
    const el = document.getElementById('sidebar');

    el.innerHTML = `
      <div class="nav-section-label">Navigation</div>
      ${nav.map(item => `
        <button class="nav-item" id="nav-${item.id}" 
          onclick="App.route('${item.route}')"
          title="${item.label}">
          <span class="nav-item-icon">${item.icon}</span>
          <span>${item.label}</span>
        </button>`).join('')}

      <div class="nav-section-label">Modules</div>
      ${modules.map(mod => `
        <button class="nav-item" id="nav-mod-${mod.id}"
          onclick="App.route('module/${mod.id}')"
          title="${mod.name}">
          <span class="nav-item-icon">${mod.icon}</span>
          <span>${mod.name}</span>
        </button>`).join('')}

      <div class="sidebar-footer">
        ${_config.app.shortName} &copy; ${new Date().getFullYear()}
      </div>`;
  }

  function _ensureSidebarBackdrop() {
    if (!document.getElementById('sidebar-backdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'sidebar-backdrop';
      backdrop.onclick = () => closeMobileSidebar();
      document.body.appendChild(backdrop);
    }
  }

  function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const toggle = document.getElementById('mobile-nav-toggle');
    const isOpen = sidebar?.classList.contains('mobile-active');
    if (isOpen) {
      closeMobileSidebar();
    } else {
      sidebar?.classList.add('mobile-active');
      if (backdrop) backdrop.classList.add('visible');
      if (toggle) toggle.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const toggle = document.getElementById('mobile-nav-toggle');
    sidebar?.classList.remove('mobile-active');
    if (backdrop) backdrop.classList.remove('visible');
    if (toggle) toggle.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ──────────────── ROUTER ────────────────

  function route(path) {
    closeMobileSidebar();
    path = path || 'dashboard';
    _currentRoute = path;
    location.hash = path;

    // Update nav active states
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const main = document.getElementById('main-content');
    main.innerHTML = '';
    main.style.opacity = '0';
    main.style.transform = 'translateY(8px)';

    setTimeout(() => {
      if (path === 'dashboard') {
        _activateNav('nav-dashboard');
        setBreadcrumb('Dashboard');
        main.innerHTML = '<div id="dashboard-view"></div>';
        Dashboard.render('dashboard-view');
      } else if (path.startsWith('module/')) {
        const moduleId = path.split('/')[1];
        const mod = _config.modules.find(m => m.id === moduleId);
        if (mod) {
          _activateNav(`nav-mod-${moduleId}`);
          setBreadcrumb(mod.name);
          main.innerHTML = `<div id="module-view-${moduleId}"></div>`;
          ModuleEngine.render(moduleId, `module-view-${moduleId}`);
        }
      } else if (path === 'admin') {
        _activateNav('nav-admin');
        setBreadcrumb('Admin Panel');
        main.innerHTML = '<div id="admin-view"></div>';
        AdminPanel.render('admin-view');
      } else {
        main.innerHTML = `<div class="empty-state"><div class="empty-icon">🗺️</div><h3>Page not found</h3><p>Route "${path}" doesn't exist</p></div>`;
      }

      main.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      main.style.opacity = '1';
      main.style.transform = 'translateY(0)';
    }, 50);
  }

  function _activateNav(navId) {
    const el = document.getElementById(navId);
    if (el) el.classList.add('active');
  }

  function setBreadcrumb(label) {
    const el = document.getElementById('breadcrumb');
    if (el) el.innerHTML = `<span>${label}</span>`;
  }

  // ──────────────── CONFIG UPDATE ────────────────

  function onConfigSave(newConfig) {
    _config = newConfig;
    applyTheme(_config.app.theme);
    buildTopbar();
    buildSidebar();
    ModuleEngine.init(_config);
    Dashboard.init(_config);
    route(_currentRoute);
  }

  // ──────────────── THEME ────────────────

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme.preset) {
      root.setAttribute('data-theme', theme.preset);
    }
    const map = {
      primaryColor:   '--primary',
      accentColor:    '--accent',
      dangerColor:    '--danger',
      warningColor:   '--warning',
      bgDark:         '--bg',
      bgCard:         '--bg-card',
      bgSidebar:      '--bg-sidebar',
      textPrimary:    '--text',
      textSecondary:  '--text-2',
      borderColor:    '--border'
    };
    Object.entries(map).forEach(([key, cssVar]) => {
      if (theme[key]) root.style.setProperty(cssVar, theme[key]);
    });
  }

  // ──────────────── LOADER ────────────────

  function showLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) loader.style.display = 'flex';
  }

  function hideLoader() {
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.style.transition = 'opacity 0.4s ease';
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 400);
    }
  }

  // ──────────────── TOAST ────────────────

  function buildToastContainer() {
    if (!document.getElementById('toast-container')) {
      const el = document.createElement('div');
      el.id = 'toast-container';
      document.body.appendChild(el);
    }
  }

  // ──────────────── DEEP MERGE ────────────────

  function _mergeConfig(base, override) {
    // Simple deep merge — override wins
    const result = JSON.parse(JSON.stringify(base));
    function merge(target, src) {
      Object.entries(src).forEach(([k, v]) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          target[k] = target[k] || {};
          merge(target[k], v);
        } else {
          target[k] = v;
        }
      });
    }
    merge(result, override);
    return result;
  }

  return { init, route, onConfigSave, applyTheme, toggleMobileSidebar, closeMobileSidebar };
})();

// ──────────────── GLOBAL TOAST ────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

window.App = App;
window.showToast = showToast;

// ──────────────── ENTRY POINT ────────────────

document.addEventListener('DOMContentLoaded', () => App.init());
