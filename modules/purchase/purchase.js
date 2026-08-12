/**
 * purchase.js — Purchase Module Logic
 * Handles Kroger data parsing, CSV import, data validation,
 * and the KrogerSync client (talks to local server on port 3131).
 */

const PurchaseModule = (() => {

  // ──────────────── KROGER PAGE PASTE PARSER ────────────────

  function parseKrogerPaste(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const records = [];
    let currentDate = '';
    let currentStore = '';
    let receiptId = '';

    const datePattern = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}/i;
    const pricePattern = /\$?([\d,]+\.\d{2})/;
    const receiptPattern = /receipt\s*#?\s*:?\s*([A-Z0-9\-]+)/i;
    const storePattern = /kroger\s*(?:#\s*)?(\d+)?|store\s*:?\s*([^$\n]+)/i;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (datePattern.test(line)) { currentDate = _normalizeDate(line.match(datePattern)[0]); i++; continue; }
      if (storePattern.test(line) && !pricePattern.test(line)) { currentStore = line; i++; continue; }
      const rMatch = line.match(receiptPattern);
      if (rMatch) { receiptId = rMatch[1]; i++; continue; }
      const priceMatch = line.match(pricePattern);
      if (priceMatch && currentDate) {
        const price = parseFloat(priceMatch[1].replace(',', ''));
        const itemName = line.replace(pricePattern, '').replace(/\$/, '').trim()
          .replace(/^\d+\s*[xX]\s*/, '').replace(/\s{2,}/g, ' ').trim();
        if (itemName && price > 0) {
          let quantity = 1;
          const qtyMatch = line.match(/^(\d+(?:\.\d+)?)\s*[xX@]/);
          if (qtyMatch) quantity = parseFloat(qtyMatch[1]);
          records.push({
            receipt_id: receiptId || '', date: currentDate,
            store_name: currentStore || 'Kroger', store_id: '',
            item_name: itemName || 'Unknown Item', upc: '',
            category: _guessCategory(itemName), quantity,
            unit_price: (price / quantity).toFixed(2), discount: '0.00',
            total_price: price.toFixed(2), payment_method: '', notes: ''
          });
        }
      }
      i++;
    }
    return records;
  }

  // ──────────────── CSV PARSER ────────────────

  function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return { headers: [], rows: [] };
    const delimiter = _detectDelimiter(lines[0]);
    const headers = _parseCSVLine(lines[0], delimiter);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = _parseCSVLine(line, delimiter);
      const row = {};
      headers.forEach((h, idx) => { row[h.trim()] = (values[idx] || '').trim(); });
      rows.push(row);
    }
    return { headers, rows };
  }

  function _parseCSVLine(line, delimiter = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) { result.push(current); current = ''; }
      else current += ch;
    }
    result.push(current);
    return result;
  }

  function _detectDelimiter(line) {
    const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
    for (const ch of line) if (counts[ch] !== undefined) counts[ch]++;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  // ──────────────── APPLY MAPPING ────────────────

  function applyMapping(rows, mapping, moduleFields) {
    return rows.map(row => {
      const record = {};
      moduleFields.forEach(f => { record[f.id] = f.type === 'currency' || f.type === 'number' ? '0' : ''; });
      Object.entries(mapping).forEach(([csvCol, fieldId]) => {
        if (row[csvCol] !== undefined && fieldId) {
          let val = row[csvCol];
          if (val) val = val.replace(/[$,]/g, '').trim();
          record[fieldId] = val;
        }
      });
      if (!record.category && record.item_name) record.category = _guessCategory(record.item_name);
      if (record.date) record.date = _normalizeDate(record.date) || record.date;
      ['quantity', 'quantity_sold', 'unit_price', 'retail_price', 'discount', 'total_price', 'total_sales', 'gross_sales', 'net_sales', 'net_pay'].forEach(f => {
        if (record[f] !== undefined && record[f] !== '') {
          const num = parseFloat(record[f]);
          record[f] = isNaN(num) ? '0' : String(num);
        }
      });
      return record;
    }).filter(r => {
      // Check if at least one primary field has content
      return Object.values(r).some(v => v !== '' && v !== '0');
    });
  }

  // ──────────────── NORMALIZE SCRAPED RECORDS ────────────────

  /**
   * Normalize records coming from the Playwright scraper:
   * - Auto-fill category if missing
   * - Normalize dates
   * - Ensure numeric fields are clean
   */
  function normalizeScrapedRecords(records) {
    return records.map(r => {
      const rec = { ...r };
      if (!rec.category && rec.item_name) rec.category = _guessCategory(rec.item_name);
      if (rec.date) rec.date = _normalizeDate(rec.date) || rec.date;
      ['quantity', 'unit_price', 'discount', 'total_price'].forEach(f => {
        if (rec[f] !== undefined) {
          const num = parseFloat(String(rec[f]).replace(/[$,]/g, ''));
          rec[f] = isNaN(num) ? '0' : num.toFixed(2);
        }
      });
      // Trim strings
      if (rec.item_name) rec.item_name = rec.item_name.trim().slice(0, 120);
      if (rec.store_name) rec.store_name = rec.store_name.trim().slice(0, 80);
      return rec;
    }).filter(r => r.item_name && r.item_name.length > 1);
  }

  // ──────────────── VALIDATION ────────────────

  function validate(record, fields) {
    const errors = {};
    fields.forEach(f => {
      if (f.required && (!record[f.id] || record[f.id] === '')) errors[f.id] = `${f.label} is required`;
      if ((f.type === 'currency' || f.type === 'number') && record[f.id] && isNaN(parseFloat(record[f.id])))
        errors[f.id] = `${f.label} must be a number`;
    });
    return { valid: Object.keys(errors).length === 0, errors };
  }

  // ──────────────── CATEGORY GUESSER ────────────────

  const CATEGORY_PATTERNS = {
    'Dairy & Eggs':          /milk|cheese|yogurt|butter|cream|egg|dairy/i,
    'Meat & Seafood':        /beef|chicken|pork|fish|salmon|shrimp|turkey|steak|ground|meat|seafood|lamb/i,
    'Produce':               /apple|banana|lettuce|tomato|onion|carrot|broccoli|spinach|fruit|vegetable|salad|pepper|cucumber|avocado|lemon|lime|orange/i,
    'Bakery':                /bread|bagel|muffin|cake|cookie|pastry|bakery|roll|bun|toast|croissant/i,
    'Frozen Foods':          /frozen|ice cream|pizza|waffle|burrito|taquito|nugget/i,
    'Beverages':             /water|juice|soda|coffee|tea|beer|wine|drink|beverage|lemonade|kombucha/i,
    'Snacks':                /chip|cracker|popcorn|pretzel|nut|snack|granola|bar|candy|chocolate/i,
    'Household':             /paper|towel|tissue|soap|detergent|cleaner|bag|trash|foil|wrap|sponge/i,
    'Personal Care':         /shampoo|conditioner|deodorant|toothpaste|lotion|razor|vitamin|medicine|pharmacy/i,
    'Canned & Packaged':     /(can|canned|soup|pasta|rice|bean|sauce|tomato|broth|stock)\b/i,
    'Condiments & Spices':   /ketchup|mustard|mayo|salt|pepper|spice|herb|dressing|vinegar|oil|sauce/i,
    'Breakfast':             /cereal|oatmeal|pancake|syrup|granola|breakfast/i
  };

  function _guessCategory(itemName) {
    for (const [cat, pattern] of Object.entries(CATEGORY_PATTERNS)) {
      if (pattern.test(itemName)) return cat;
    }
    return 'Other';
  }

  // ──────────────── DATE NORMALIZATION ────────────────

  function _normalizeDate(dateStr) {
    if (!dateStr) return '';
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
    const m = dateStr.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
    if (m) {
      const mon = months[m[1].toLowerCase().slice(0,3)];
      if (mon) return new Date(parseInt(m[3]), mon-1, parseInt(m[2])).toISOString().split('T')[0];
    }
    return dateStr;
  }

  // ──────────────── EXPORT ────────────────

  function exportToCSV(records, fields) {
    const headers = fields.map(f => f.label);
    const rows = records.map(r =>
      fields.map(f => {
        const val = r[f.id] !== undefined ? r[f.id] : '';
        return String(val).includes(',') || String(val).includes('\n')
          ? `"${String(val).replace(/"/g, '""')}"` : String(val);
      })
    );
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  function downloadCSV(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return {
    parseKrogerPaste, parseCSV, applyMapping,
    normalizeScrapedRecords, validate,
    exportToCSV, downloadCSV, downloadJSON,
    guessCategory: _guessCategory
  };
})();

// ══════════════════════════════════════════════
//  KrogerSync — Client for the local sync server
// ══════════════════════════════════════════════

const KrogerSync = (() => {
  let _serverUrl  = 'http://localhost:3131';
  let _sseSource  = null;
  let _listeners  = {};

  // ──────────────── CONFIG ────────────────

  function configure(config) {
    if (config?.app?.syncServer?.url) _serverUrl = config.app.syncServer.url;
  }

  // ──────────────── STATUS ────────────────

  async function checkStatus() {
    try {
      const resp = await fetch(`${_serverUrl}/api/status`, { signal: AbortSignal.timeout(3000) });
      if (!resp.ok) return { online: false };
      const data = await resp.json();
      return { online: true, ...data };
    } catch {
      return { online: false };
    }
  }

  // ──────────────── SSE PROGRESS STREAM ────────────────

  function subscribeProgress(handlers) {
    // handlers: { onLog, onProgress, onLoginComplete, onSyncComplete, onSessionExpired, onError }
    _listeners = handlers;

    if (_sseSource) { _sseSource.close(); _sseSource = null; }

    _sseSource = new EventSource(`${_serverUrl}/api/progress`);

    const handle = (type, fn) => {
      _sseSource.addEventListener(type, e => {
        try { fn(JSON.parse(e.data)); } catch { fn(e.data); }
      });
    };

    handle('log',             d => handlers.onLog?.(d));
    handle('progress',        d => handlers.onProgress?.(d));
    handle('login_complete',  d => handlers.onLoginComplete?.(d));
    handle('login_failed',    d => handlers.onError?.(`Login failed: ${d.message}`));
    handle('sync_complete',   d => handlers.onSyncComplete?.(d));
    handle('sync_failed',     d => handlers.onError?.(`Sync failed: ${d.message}`));
    handle('session_expired', d => handlers.onSessionExpired?.(d));
    handle('session_saved',   d => handlers.onLog?.('✅ Session saved successfully'));
    handle('error',           d => handlers.onError?.(d));

    _sseSource.onerror = () => {
      // SSE connection error — server may have gone away
      handlers.onError?.('Lost connection to sync server');
    };
  }

  function unsubscribeProgress() {
    if (_sseSource) { _sseSource.close(); _sseSource = null; }
    _listeners = {};
  }

  // ──────────────── ACTIONS ────────────────

  async function startLogin() {
    try {
      const resp = await fetch(`${_serverUrl}/api/kroger/login`, { method: 'POST' });
      return resp.ok;
    } catch (err) {
      console.error('KrogerSync.startLogin error:', err);
      return false;
    }
  }

  async function startSync() {
    try {
      const resp = await fetch(`${_serverUrl}/api/kroger/sync`, { method: 'POST' });
      return resp.ok;
    } catch (err) {
      console.error('KrogerSync.startSync error:', err);
      return false;
    }
  }

  async function deleteSession() {
    try {
      const resp = await fetch(`${_serverUrl}/api/kroger/session`, { method: 'DELETE' });
      return resp.ok;
    } catch { return false; }
  }

  return { configure, checkStatus, subscribeProgress, unsubscribeProgress, startLogin, startSync, deleteSession };
})();

window.PurchaseModule = PurchaseModule;
window.KrogerSync = KrogerSync;
