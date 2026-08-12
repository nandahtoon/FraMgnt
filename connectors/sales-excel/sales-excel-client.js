/**
 * sales-excel-client.js — Sales Report Excel Connector Frontend Client
 */
const SalesExcelConnector = (function () {
  let _serverUrl = 'http://localhost:8081';

  function configure(config) {
    if (config && config.syncServer && config.syncServer.url) {
      _serverUrl = config.syncServer.url.replace(/\/$/, '');
    }
  }

  async function getStatus() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${_serverUrl}/api/connectors/sales-excel/status`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { ok: false, offline: true, error: err.message };
    }
  }

  async function saveCredentials(payload) {
    const res = await fetch(`${_serverUrl}/api/connectors/sales-excel/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  async function startSync(opts = {}) {
    const res = await fetch(`${_serverUrl}/api/connectors/sales-excel/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts)
    });
    return await res.json();
  }

  return { configure, getStatus, saveCredentials, startSync };
})();

if (typeof window !== 'undefined') {
  window.SalesExcelConnector = SalesExcelConnector;
}
