/**
 * fs-credentials.adapter.js — Secondary Outbound Adapter for File-System Credentials Storage
 */
const fs   = require('fs');
const path = require('path');
const { ICredentialsRepositoryPort } = require('../../ports/outbound/credentials.repository.port');
const { ConnectorCredentials } = require('../../domain/entities/connector-credentials.entity');

class FileSystemCredentialsAdapter extends ICredentialsRepositoryPort {
  constructor(authDir) {
    super();
    this.authDir = authDir || path.join(__dirname, '..', '..', '..', 'auth');
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  _filePath(connectorId) {
    return path.join(this.authDir, `${connectorId}-credentials.json`);
  }

  getCredentials(connectorId) {
    const file = this._filePath(connectorId);
    if (!fs.existsSync(file)) return null;
    try {
      const payload = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return new ConnectorCredentials(connectorId, payload);
    } catch (_) {
      return null;
    }
  }

  saveCredentials(connectorId, credentialsEntity) {
    this._ensureDir();
    const file = this._filePath(connectorId);
    const data = credentialsEntity instanceof ConnectorCredentials
      ? credentialsEntity.toJSON()
      : credentialsEntity;
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  }

  deleteCredentials(connectorId) {
    const file = this._filePath(connectorId);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      return true;
    }
    return false;
  }
}

module.exports = { FileSystemCredentialsAdapter };
