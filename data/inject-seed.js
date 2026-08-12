/**
 * store-seed.js — Helper script to seed Sale Data and Statement modules from sample files
 */
const fs = require('fs');

const salesData = JSON.parse(fs.readFileSync('C:/PROJECTS/FraMgnt/resources/sample_sales.json', 'utf8'));
const statementData = JSON.parse(fs.readFileSync('C:/PROJECTS/FraMgnt/resources/sample_statement.json', 'utf8'));

const storeJsPath = 'C:/PROJECTS/FraMgnt/data/store.js';
let content = fs.readFileSync(storeJsPath, 'utf8');

if (!content.includes('// Seed sample datasets')) {
  const seedBlock = `
  // Seed sample datasets if empty
  try {
    if (typeof localStorage !== 'undefined') {
      if (!localStorage.getItem(NS + 'module_sales')) {
        insertBatch('sales', ${JSON.stringify(salesData)});
      }
      if (!localStorage.getItem(NS + 'module_statement')) {
        insertBatch('statement', ${JSON.stringify(statementData)});
      }
    }
  } catch (e) {
    console.log('Seed error:', e);
  }
`;

  content = content.replace('return {', seedBlock + '\n  return {');
  fs.writeFileSync(storeJsPath, content, 'utf8');
  console.log('Successfully injected seed code into store.js');
} else {
  console.log('store.js already contains seed block');
}
