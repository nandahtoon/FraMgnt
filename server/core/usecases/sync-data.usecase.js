/**
 * sync-data.usecase.js — Hexagon Core Application Use Case for Data Synchronization
 */
const { ISyncDataUseCase } = require('../ports/inbound/sync-data.usecase.port');

class SyncDataUseCase extends ISyncDataUseCase {
  constructor(credentialsRepo, connectorAdapters = {}) {
    super();
    this.credentialsRepo = credentialsRepo;
    this.connectorAdapters = connectorAdapters;
  }

  registerAdapter(connectorId, adapter) {
    this.connectorAdapters[connectorId] = adapter;
  }

  async executeSync(connectorId, emit, options = {}) {
    const adapter = this.connectorAdapters[connectorId];
    if (!adapter) {
      throw new Error(`No outbound connector adapter registered for '${connectorId}'`);
    }

    const credsEntity = this.credentialsRepo.getCredentials(connectorId);
    emit('log', `🚀 Initiating Hexagon Use Case sync for '${connectorId}'...`);

    const records = await adapter.fetchData(credsEntity, emit, options);
    return records;
  }
}

module.exports = { SyncDataUseCase };
