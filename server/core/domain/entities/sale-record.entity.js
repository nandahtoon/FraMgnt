/**
 * sale-record.entity.js — Hexagon Domain Entity for Sales Transactions
 */
class SaleRecord {
  constructor({ division_code, division_name, store_number, date, gtin, product_name, quantity_sold, retail_price, total_sales }) {
    this.division_code = String(division_code || '16');
    this.division_name = String(division_name || 'CBMA');
    this.store_number  = String(store_number || '00982');
    this.date          = String(date || new Date().toISOString().split('T')[0]);
    this.gtin          = String(gtin || '');
    this.product_name  = String(product_name || 'Unknown Product').trim();
    this.quantity_sold = Number(quantity_sold) || 1;
    this.retail_price  = Number(retail_price) || 0.00;
    this.total_sales   = Number(total_sales) || (this.quantity_sold * this.retail_price);
  }

  toJSON() {
    return {
      division_code: this.division_code,
      division_name: this.division_name,
      store_number:  this.store_number,
      date:          this.date,
      gtin:          this.gtin,
      product_name:  this.product_name,
      quantity_sold: String(this.quantity_sold),
      retail_price:  this.retail_price.toFixed(2),
      total_sales:   this.total_sales.toFixed(2)
    };
  }
}

module.exports = { SaleRecord };
