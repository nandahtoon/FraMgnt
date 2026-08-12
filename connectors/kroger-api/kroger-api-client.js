/**
 * Kroger Official Developer API Connection Adaptor Client (v2.0.0)
 *
 * Implements client bindings for Kroger Developer Portal API Products:
 *  - Products API (catalog search, UPC lookup, pricing)
 *  - Locations API (store search by zip/latlong)
 *  - Identity Profile API (customer profile & loyalty card)
 *  - Cart API (view & update active cart)
 */
const KrogerApiConnector = (function () {
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
      const res = await fetch(`${_serverUrl}/api/connectors/kroger-api/status`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      return { ok: false, offline: true, error: err.message };
    }
  }

  async function saveCredentials(payload) {
    const res = await fetch(`${_serverUrl}/api/connectors/kroger-api/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  // 1. Products API
  async function testProductSearch(term = 'milk', limit = 5) {
    const res = await fetch(`${_serverUrl}/api/connectors/kroger-api/products?term=${encodeURIComponent(term)}&limit=${limit}`);
    return await res.json();
  }

  // 2. Locations API
  async function testLocationsSearch(zipCode = '45202') {
    const res = await fetch(`${_serverUrl}/api/connectors/kroger-api/locations?zipCode=${encodeURIComponent(zipCode)}`);
    return await res.json();
  }

  // 3. Identity Profile API
  async function testProfile() {
    const res = await fetch(`${_serverUrl}/api/connectors/kroger-api/profile`);
    return await res.json();
  }

  // 4. Cart API
  async function testCart() {
    const res = await fetch(`${_serverUrl}/api/connectors/kroger-api/cart`);
    return await res.json();
  }

  // Ingestion Sync
  async function startSync(opts = {}) {
    const res = await fetch(`${_serverUrl}/api/connectors/kroger-api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts)
    });
    return await res.json();
  }

  return {
    configure,
    getStatus,
    saveCredentials,
    testProductSearch,
    testLocationsSearch,
    testProfile,
    testCart,
    startSync
  };
})();

if (typeof window !== 'undefined') {
  window.KrogerApiConnector = KrogerApiConnector;
}
