const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { vendors } = require('./seedData');

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'vendor-tracker.sqlite');

async function initializeDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      quoted_price REAL NOT NULL,
      shipping_cost REAL NOT NULL,
      lead_time_days INTEGER NOT NULL,
      notes TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const vendorCount = await db.get('SELECT COUNT(*) AS count FROM vendors');

  if (vendorCount.count !== vendors.length) {
    await db.exec('DELETE FROM vendors');

    const statement = await db.prepare(`
      INSERT INTO vendors (
        id,
        name,
        category,
        contact_name,
        contact_phone,
        contact_email,
        quoted_price,
        shipping_cost,
        lead_time_days,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      for (const vendor of vendors) {
        await statement.run(
          vendor.id,
          vendor.name,
          vendor.category,
          vendor.contactName,
          vendor.contactPhone,
          vendor.contactEmail,
          vendor.quotedPrice,
          vendor.shippingCost,
          vendor.leadTimeDays,
          vendor.notes,
        );
      }
    } finally {
      await statement.finalize();
    }
  }

  return db;
}

module.exports = {
  dbPath,
  initializeDatabase,
};
