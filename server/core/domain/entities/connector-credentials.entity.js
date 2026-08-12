/**
 * connector-credentials.entity.js — Hexagon Domain Entity for Connector Credentials
 */
class ConnectorCredentials {
  constructor(connectorId, payload = {}) {
    this.connectorId = connectorId;
    this.payload = { ...payload };
    this.updatedAt = new Date().toISOString();
  }

  isValid() {
    if (!this.connectorId) return false;
    if (this.connectorId === 'kroger') {
      return !!(this.payload.email && this.payload.password);
    }
    if (this.connectorId === 'kroger-api') {
      return !!(this.payload.client_id && this.payload.client_secret);
    }
    if (this.connectorId === 'sales-excel') {
      return !!(this.payload.watch_folder);
    }
    return Object.keys(this.payload).length > 0;
  }

  toJSON() {
    return { ...this.payload };
  }
}

module.exports = { ConnectorCredentials };
