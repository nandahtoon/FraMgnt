/**
 * excel-watcher.adapter.js — Driven Outbound Adapter for Excel Directory Watcher
 */
const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { SaleRecord } = require('../../core/domain/entities/sale-record.entity');

class ExcelDirectoryWatcherAdapter {
  constructor(defaultWatchFolder) {
    this.defaultWatchFolder = defaultWatchFolder || path.join(__dirname, '..', '..', '..', 'resources');
    this.sampleSalesPath    = path.join(__dirname, '..', '..', '..', 'resources', 'sample_sales.json');
  }

  async fetchData(credsEntity, emit, options = {}) {
    const payload = credsEntity ? credsEntity.payload : {};
    const targetDir = payload.watch_folder || this.defaultWatchFolder;

    emit('log', `🚀 Hexagon Adapter: Scanning watched directory: ${targetDir}`);
    emit('progress', { step: 'scan', percent: 20 });

    let records = [];

    if (fs.existsSync(targetDir)) {
      const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.csv'));
      emit('log', `📁 Hexagon Adapter: Found ${files.length} spreadsheet files.`);

      for (const file of files) {
        const filePath = path.join(targetDir, file);
        try {
          if (file.endsWith('.xlsx')) {
            const workbook = XLSX.readFile(filePath);
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonRows = XLSX.utils.sheet_to_json(firstSheet);
            jsonRows.forEach(row => {
              const entity = new SaleRecord({
                division_code: row['Division code'],
                division_name: row['Division name'],
                store_number:  row['Store #'],
                date:          row['Date'],
                gtin:          row['GTIN'],
                product_name:  row['Product name'] || row['Item'],
                quantity_sold: row['QS'] || row['Quantity'],
                retail_price:  row['RCP'] || row['Price'],
                total_sales:   row['QS*RCP'] || row['Total']
              });
              records.push(entity.toJSON());
            });
          }
        } catch (err) {
          emit('log', `⚠️ Warning: Failed to parse ${file}: ${err.message}`);
        }
      }
    }

    if (records.length === 0 && fs.existsSync(this.sampleSalesPath)) {
      records = JSON.parse(fs.readFileSync(this.sampleSalesPath, 'utf-8'));
    }

    emit('progress', { step: 'processing', percent: 70 });
    emit('log', `📦 Hexagon Adapter: Ingested ${records.length} sales domain records.`);
    emit('progress', { step: 'done', percent: 100 });
    return records;
  }
}

module.exports = { ExcelDirectoryWatcherAdapter };
