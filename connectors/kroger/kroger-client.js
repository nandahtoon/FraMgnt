/**
 * Kroger Connector Frontend Client
 * Module/Independent connector client for Kroger purchase data ingestion.
 */
const KrogerConnector = (function () {
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
      const res = await fetch(`${_serverUrl}/api/connectors/kroger/status`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { ok: false, offline: true, error: err.message };
    }
  }

  async function saveCredentials(payload) {
    const res = await fetch(`${_serverUrl}/api/connectors/kroger/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  async function startInteractiveLogin() {
    const res = await fetch(`${_serverUrl}/api/connectors/kroger/login`, {
      method: 'POST'
    });
    return await res.json();
  }

  async function startSync(opts = {}) {
    const res = await fetch(`${_serverUrl}/api/connectors/kroger/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts)
    });
    return await res.json();
  }

  function subscribeProgress(onMessage) {
    const eventSource = new EventSource(`${_serverUrl}/api/progress`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };
    eventSource.onerror = (err) => {
      console.warn('SSE stream disconnected');
    };
    return () => eventSource.close();
  }

  return {
    configure,
    getStatus,
    saveCredentials,
    clearSession,
    startInteractiveLogin,
    startSync,
    subscribeProgress
  };
})();

if (typeof window !== 'undefined') {
  window.KrogerConnector = KrogerConnector;
  // Backward compatibility alias for KrogerSync
  window.KrogerSync = KrogerConnector;
}
