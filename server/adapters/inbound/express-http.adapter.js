/**
 * express-http.adapter.js — Driving Inbound HTTP Adapter using Express
 */
class ExpressHttpAdapter {
  constructor(app, syncDataUseCase, credentialsRepo, sseBroadcaster) {
    this.app = app;
    this.syncDataUseCase = syncDataUseCase;
    this.credentialsRepo = credentialsRepo;
    this.sseBroadcaster = sseBroadcaster;
  }

  registerConnectorRoutes(connectorId, manifest) {
    const routePrefix = `/api/connectors/${connectorId}`;

    // GET Status Driving Adapter
    this.app.get(`${routePrefix}/status`, (req, res) => {
      const credsEntity = this.credentialsRepo.getCredentials(connectorId);
      res.json({
        ok: true,
        connectorId,
        name: manifest.name,
        targetModule: manifest.targetModule,
        has_credentials: !!credsEntity && credsEntity.isValid(),
        session_exists: false,
        credentials: credsEntity ? credsEntity.toJSON() : null
      });
    });

    // POST Credentials Driving Adapter
    this.app.post(`${routePrefix}/credentials`, (req, res) => {
      const payload = req.body;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ ok: false, error: 'Invalid payload' });
      }
      this.credentialsRepo.saveCredentials(connectorId, payload);
      res.json({ ok: true, message: 'Credentials saved successfully via Hexagon Adapter' });
    });

    // DELETE Credentials Driving Adapter
    this.app.delete(`${routePrefix}/credentials`, (req, res) => {
      this.credentialsRepo.deleteCredentials(connectorId);
      res.json({ ok: true, message: 'Credentials deleted' });
    });

    // POST Sync Driving Adapter
    this.app.post(`${routePrefix}/sync`, async (req, res) => {
      const opts = req.body || {};
      res.json({ ok: true, message: `Sync started for ${manifest.name}` });

      try {
        const records = await this.syncDataUseCase.executeSync(connectorId, (type, data) => {
          this.sseBroadcaster(type, data);
        }, opts);
        this.sseBroadcaster('sync_complete', { connectorId, count: records.length, records });
      } catch (err) {
        console.error(`[Hexagon HTTP Adapter:${manifest.name}] Sync error:`, err);
        this.sseBroadcaster('sync_failed', { connectorId, message: err.message });
      }
    });
  }
}

module.exports = { ExpressHttpAdapter };
