/**
 * server.js — FraMgnt Connector & Sync Server
 *
 * Runs on http://localhost:8081
 * Dynamically loads connectors from /connectors and exposes REST/SSE APIs for web app frontend.
 */

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const kroger = require('./scrapers/kroger');
const { loadConnectors } = require('./connectors-loader');

const app  = express();
const PORT = process.env.PORT || 8081;

// ─────────────────────────────────────────────
//  Middleware
// ─────────────────────────────────────────────

app.use(cors({ origin: '*' }));
app.use(express.json());

// ─────────────────────────────────────────────
//  Multi-Client SSE Broadcast Pool
// ─────────────────────────────────────────────

const _sseClients = new Set();

function sseEmit(type, data) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const clientRes of _sseClients) {
    try {
      clientRes.write(payload);
    } catch (_) {
      _sseClients.delete(clientRes);
    }
  }
  if (type === 'log') console.log('[SyncServer]', data);
  else if (type === 'error') console.error('[SyncServer ERROR]', data);
  else console.log(`[SyncServer:${type}]`, JSON.stringify(data));
}

// ─────────────────────────────────────────────
//  SSE Stream Endpoint
// ─────────────────────────────────────────────

app.get('/api/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  _sseClients.add(res);

  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (_) {
      _sseClients.delete(res);
      clearInterval(ping);
    }
  }, 20000);

  req.on('close', () => {
    _sseClients.delete(res);
    clearInterval(ping);
  });
});

// Health check
app.get('/api/status', (req, res) => {
  res.json({
    ok:             true,
    server:         'FraMgnt Connector & Sync Server',
    version:        '1.1.0',
    has_credentials: kroger.hasCredentials(),
    session_exists: kroger.sessionExists(),
    port:           PORT,
    sse_clients:    _sseClients.size
  });
});

// Load dynamic connectors from /connectors
loadConnectors(app, sseEmit);

// ─────────────────────────────────────────────
//  Legacy Kroger Endpoints (Compatibility)
// ─────────────────────────────────────────────

app.post('/api/kroger/credentials', (req, res) => {
  const creds = req.body;
  if (!creds || !creds.email || !creds.password) {
    return res.status(400).json({ ok: false, error: 'Email and password required' });
  }
  kroger.saveCredentials(creds);
  res.json({ ok: true, message: 'Credentials saved' });
});

app.post('/api/kroger/login', async (req, res, next) => {
  res.json({ ok: true, message: 'Manual login browser opening...' });
  try {
    await kroger.doManualLogin(sseEmit);
    sseEmit('login_complete', { session_exists: true });
  } catch (err) {
    sseEmit('error', err.message);
    sseEmit('login_failed', { message: err.message });
  }
});

app.post('/api/kroger/sync', async (req, res, next) => {
  res.json({ ok: true, message: 'Sync started' });
  try {
    const records = await kroger.scrapeAllPurchases(sseEmit);
    sseEmit('sync_complete', { records, count: records.length });
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      sseEmit('session_expired', { message: 'Your session has expired.' });
    } else {
      sseEmit('error', err.message);
      sseEmit('sync_failed', { message: err.message });
    }
  }
});

app.delete('/api/kroger/session', (req, res) => {
  kroger.deleteSession();
  sseEmit('log', '🗑️  Saved session deleted.');
  res.json({ ok: true, message: 'Session deleted' });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[SyncServer Error Middleware]', err);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────
//  Start Server
// ─────────────────────────────────────────────

app.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   FraMgnt — Connector & Sync Server      ║');
  console.log('║   Running on http://localhost:' + PORT + '      ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('  Credentials configured:', kroger.hasCredentials() ? '✅ Yes' : '❌ No');
  console.log('  Session active:       ', kroger.sessionExists() ? '✅ Yes' : '❌ No');
  console.log('');
});
