/**
 * sync-data.usecase.port.js — Inbound Port for Data Synchronization
 */
class ISyncDataUseCase {
  async executeSync(connectorId, emit, options) {
    throw new Error('Method executeSync() must be implemented');
  }
}

module.exports = { ISyncDataUseCase };
