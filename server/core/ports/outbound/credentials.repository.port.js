/**
 * credentials.repository.port.js — Outbound Port for Credentials Persistence
 */
class ICredentialsRepositoryPort {
  getCredentials(connectorId) {
    throw new Error('Method getCredentials() must be implemented');
  }
  saveCredentials(connectorId, credentialsEntity) {
    throw new Error('Method saveCredentials() must be implemented');
  }
  deleteCredentials(connectorId) {
    throw new Error('Method deleteCredentials() must be implemented');
  }
}

module.exports = { ICredentialsRepositoryPort };
