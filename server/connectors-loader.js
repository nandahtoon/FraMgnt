/**
 * connectors-loader.js — Dynamic Connector Plugin Loader for Express Server
 *
 * Scans /connectors directory for connector manifests and registers API endpoints dynamically.
 */

const fs   = require('fs');
const path = require('path');

const CONNECTORS_DIR = path.join(__dirname, '..', 'connectors');

function loadConnectors(app, sseBroadcaster) {
  if (!fs.existsSync(CONNECTORS_DIR)) return [];

  const connectors = [];
  const entries = fs.readdirSync(CONNECTORS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const connectorId = entry.name;
    const manifestPath = path.join(CONNECTORS_DIR, connectorId, 'connector.json');

    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      connectors.push(manifest);

      // Look for custom scraper implementation
      let scraperPath = path.join(__dirname, 'scrapers', `${connectorId}.js`);
      if (!fs.existsSync(scraperPath)) {
        scraperPath = path.join(CONNECTORS_DIR, connectorId, 'scraper.js');
      }
      if (fs.existsSync(scraperPath)) {
        const scraper = require(scraperPath);
        _registerConnectorRoutes(app, connectorId, manifest, scraper, sseBroadcaster);
      } else {
        // Register default status/credentials endpoints for manifest
        _registerConnectorRoutes(app, connectorId, manifest, {}, sseBroadcaster);
      }
    } catch (err) {
      console.error(`[ConnectorsLoader] Failed to load connector "${connectorId}":`, err.message);
    }
  }

  // General list endpoint
  app.get('/api/connectors', (req, res) => {
    res.json({ ok: true, connectors });
  });

  return connectors;
}

function _registerConnectorRoutes(app, connectorId, manifest, scraper, sseBroadcaster) {
  const routePrefix = `/api/connectors/${connectorId}`;

  // GET status
  app.get(`${routePrefix}/status`, (req, res) => {
    const creds = scraper.getCredentials ? scraper.getCredentials() : null;
    res.json({
      ok: true,
      connectorId,
      name: manifest.name,
      targetModule: manifest.targetModule,
      has_credentials: scraper.hasCredentials ? scraper.hasCredentials() : false,
      session_exists: scraper.sessionExists ? scraper.sessionExists() : false,
      credentials: creds || null
    });
  });

  // POST credentials
  app.post(`${routePrefix}/credentials`, (req, res) => {
    const creds = req.body;
    if (!creds || typeof creds !== 'object') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }
    if (scraper.saveCredentials) {
      scraper.saveCredentials(creds);
      res.json({ ok: true, message: 'Credentials saved successfully' });
    } else {
      res.status(500).json({ ok: false, error: 'Credential saving not supported' });
    }
  });

  // DELETE credentials
  app.delete(`${routePrefix}/credentials`, (req, res) => {
    if (scraper.deleteCredentials) scraper.deleteCredentials();
    res.json({ ok: true, message: 'Credentials deleted' });
  });

  // DELETE session
  app.delete(`${routePrefix}/session`, (req, res) => {
    if (scraper.deleteSession) scraper.deleteSession();
    res.json({ ok: true, message: 'Session deleted' });
  });

  // POST sync
  app.post(`${routePrefix}/sync`, async (req, res) => {
    const opts = req.body || {};
    res.json({ ok: true, message: `Sync started for ${manifest.name}` });

    try {
      const records = await scraper.scrapeAllPurchases((type, data) => {
        sseBroadcaster(type, data);
      }, opts);
      sseBroadcaster('sync_complete', { connectorId, count: records.length, records });
    } catch (err) {
      console.error(`[${manifest.name}] Sync error:`, err);
      sseBroadcaster('sync_failed', { connectorId, message: err.message });
    }
  });

  // Additional Kroger Developer API Product routes
  if (connectorId === 'kroger-api') {
    app.get(`${routePrefix}/products`, async (req, res) => {
      try {
        const result = await scraper.getProducts({
          term: req.query.term || 'milk',
          upc: req.query.upc || '',
          locationId: req.query.locationId || '',
          limit: req.query.limit || 5
        });
        res.json(result);
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    app.get(`${routePrefix}/locations`, async (req, res) => {
      try {
        const result = await scraper.getLocations({
          zipCode: req.query.zipCode || '45202',
          radiusInMiles: req.query.radius || 10,
          limit: req.query.limit || 5
        });
        res.json(result);
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    app.get(`${routePrefix}/profile`, async (req, res) => {
      try {
        const result = await scraper.getProfile();
        res.json(result);
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    app.get(`${routePrefix}/cart`, async (req, res) => {
      try {
        const result = await scraper.getCart();
        res.json(result);
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });
  }

  console.log(`[ConnectorsLoader] Mounted connector endpoints: ${routePrefix}`);
}

module.exports = { loadConnectors };
