const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'pos_offline.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening local SQLite database:', err.message);
  } else {
    console.log('Connected to the KitchenOS POS offline SQLite database.');
    initDb();
  }
});

function ensureColumn(tableName, columnName, definition) {
  db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
    if (err || !rows) return;
    const hasColumn = rows.some((row) => row.name === columnName);
    if (!hasColumn) {
      db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  });
}

function initDb() {
  db.serialize(() => {
    // Sync Queue (for uplink to cloud)
    db.run(`CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT UNIQUE,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      payload TEXT NOT NULL,
      payload_hash TEXT,
      batch_id TEXT,
      status TEXT DEFAULT 'pending',
      attempt_count INTEGER DEFAULT 0,
      last_error TEXT,
      conflict_reason TEXT,
      resolution_status TEXT,
      server_entity_id TEXT,
      last_server_status TEXT,
      last_server_message TEXT,
      last_attempt_at DATETIME,
      next_retry_at DATETIME,
      synced_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_queue_event_id ON sync_queue(event_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sync_queue_status_retry ON sync_queue(status, next_retry_at, created_at)`);

    // Offline Orders Table
    db.run(`CREATE TABLE IF NOT EXISTS offline_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      branch_id INTEGER,
      device_uid TEXT,
      shift_reference TEXT,
      business_day_reference TEXT,
      counter_session_reference TEXT,
      sale_counter_id INTEGER,
      customer TEXT,
      waiter TEXT,
      table_name TEXT,
      order_type TEXT DEFAULT 'Dine-in',
      payment_method TEXT,
      order_note TEXT,
      total_amount REAL,
      sub_total REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      items_json TEXT,
      payments_json TEXT,
      status TEXT DEFAULT 'Open',
      remote_order_id TEXT,
      sync_status TEXT DEFAULT 'pending',
      sync_error TEXT,
      sync_attempt_count INTEGER DEFAULT 0,
      synced_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS offline_shifts (
      id TEXT PRIMARY KEY,
      branch_id INTEGER,
      device_uid TEXT,
      opening_float REAL DEFAULT 0,
      actual_cash REAL,
      status TEXT DEFAULT 'open',
      sync_status TEXT DEFAULT 'pending',
      sync_error TEXT,
      sync_attempt_count INTEGER DEFAULT 0,
      synced_at DATETIME,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_offline_shifts_status ON offline_shifts(status, sync_status, opened_at)`);

    db.run(`CREATE TABLE IF NOT EXISTS business_days (
      id TEXT PRIMARY KEY,
      branch_id INTEGER,
      business_date TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      notes TEXT,
      sync_status TEXT DEFAULT 'pending',
      sync_error TEXT,
      sync_attempt_count INTEGER DEFAULT 0,
      synced_at DATETIME,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_business_days_branch_date ON business_days(branch_id, business_date, status)`);

    db.run(`CREATE TABLE IF NOT EXISTS counter_sessions (
      id TEXT PRIMARY KEY,
      branch_id INTEGER,
      business_day_reference TEXT,
      shift_reference TEXT,
      sale_counter_id INTEGER,
      sale_counter_name TEXT,
      device_uid TEXT,
      cashier_user_id INTEGER,
      cashier_name TEXT,
      assigned_float REAL DEFAULT 0,
      opening_verified_cash REAL DEFAULT 0,
      blind_count REAL,
      expected_cash REAL,
      variance REAL,
      terminal_status TEXT DEFAULT 'active',
      x_report_json TEXT,
      sync_status TEXT DEFAULT 'pending',
      sync_error TEXT,
      sync_attempt_count INTEGER DEFAULT 0,
      synced_at DATETIME,
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_counter_sessions_status ON counter_sessions(branch_id, terminal_status, opened_at)`);

    // KOT Tracking
    db.run(`CREATE TABLE IF NOT EXISTS kot_tracking (
      id TEXT PRIMARY KEY,
      branch_id INTEGER,
      device_uid TEXT,
      kot_number TEXT NOT NULL,
      order_id TEXT NOT NULL,
      order_number TEXT,
      type TEXT,
      items_json TEXT NOT NULL,
      status TEXT DEFAULT 'Pending',
      sync_status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS device_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS cart_drafts (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      cart_json TEXT,
      remarks TEXT,
      order_number TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    ensureColumn('sync_queue', 'event_id', 'TEXT');
    ensureColumn('sync_queue', 'entity_id', 'TEXT');
    ensureColumn('sync_queue', 'payload_hash', 'TEXT');
    ensureColumn('sync_queue', 'batch_id', 'TEXT');
    ensureColumn('sync_queue', 'attempt_count', 'INTEGER DEFAULT 0');
    ensureColumn('sync_queue', 'last_error', 'TEXT');
    ensureColumn('sync_queue', 'conflict_reason', 'TEXT');
    ensureColumn('sync_queue', 'resolution_status', 'TEXT');
    ensureColumn('sync_queue', 'server_entity_id', 'TEXT');
    ensureColumn('sync_queue', 'last_server_status', 'TEXT');
    ensureColumn('sync_queue', 'last_server_message', 'TEXT');
    ensureColumn('sync_queue', 'last_attempt_at', 'DATETIME');
    ensureColumn('sync_queue', 'next_retry_at', 'DATETIME');
    ensureColumn('sync_queue', 'synced_at', 'DATETIME');

    ensureColumn('offline_orders', 'branch_id', 'INTEGER');
    ensureColumn('offline_orders', 'device_uid', 'TEXT');
    ensureColumn('offline_orders', 'shift_reference', 'TEXT');
    ensureColumn('offline_orders', 'business_day_reference', 'TEXT');
    ensureColumn('offline_orders', 'counter_session_reference', 'TEXT');
    ensureColumn('offline_orders', 'sale_counter_id', 'INTEGER');
    ensureColumn('offline_orders', 'order_type', `TEXT DEFAULT 'Dine-in'`);
    ensureColumn('offline_orders', 'payment_method', 'TEXT');
    ensureColumn('offline_orders', 'order_note', 'TEXT');
    ensureColumn('offline_orders', 'sub_total', 'REAL DEFAULT 0');
    ensureColumn('offline_orders', 'tax_amount', 'REAL DEFAULT 0');
    ensureColumn('offline_orders', 'discount_amount', 'REAL DEFAULT 0');
    ensureColumn('offline_orders', 'payments_json', 'TEXT');
    ensureColumn('offline_orders', 'remote_order_id', 'TEXT');
    ensureColumn('offline_orders', 'sync_error', 'TEXT');
    ensureColumn('offline_orders', 'sync_attempt_count', 'INTEGER DEFAULT 0');
    ensureColumn('offline_orders', 'synced_at', 'DATETIME');

    ensureColumn('kot_tracking', 'branch_id', 'INTEGER');
    ensureColumn('kot_tracking', 'device_uid', 'TEXT');
    ensureColumn('kot_tracking', 'order_number', 'TEXT');
    ensureColumn('kot_tracking', 'sync_status', `TEXT DEFAULT 'pending'`);

    ensureColumn('business_days', 'branch_id', 'INTEGER');
    ensureColumn('business_days', 'business_date', 'TEXT');
    ensureColumn('business_days', 'title', 'TEXT');
    ensureColumn('business_days', 'status', `TEXT DEFAULT 'open'`);
    ensureColumn('business_days', 'notes', 'TEXT');
    ensureColumn('business_days', 'sync_status', `TEXT DEFAULT 'pending'`);
    ensureColumn('business_days', 'sync_error', 'TEXT');
    ensureColumn('business_days', 'sync_attempt_count', 'INTEGER DEFAULT 0');
    ensureColumn('business_days', 'synced_at', 'DATETIME');
    ensureColumn('business_days', 'opened_at', 'DATETIME');
    ensureColumn('business_days', 'closed_at', 'DATETIME');

    ensureColumn('counter_sessions', 'branch_id', 'INTEGER');
    ensureColumn('counter_sessions', 'business_day_reference', 'TEXT');
    ensureColumn('counter_sessions', 'shift_reference', 'TEXT');
    ensureColumn('counter_sessions', 'sale_counter_id', 'INTEGER');
    ensureColumn('counter_sessions', 'sale_counter_name', 'TEXT');
    ensureColumn('counter_sessions', 'device_uid', 'TEXT');
    ensureColumn('counter_sessions', 'cashier_user_id', 'INTEGER');
    ensureColumn('counter_sessions', 'cashier_name', 'TEXT');
    ensureColumn('counter_sessions', 'assigned_float', 'REAL DEFAULT 0');
    ensureColumn('counter_sessions', 'opening_verified_cash', 'REAL DEFAULT 0');
    ensureColumn('counter_sessions', 'blind_count', 'REAL');
    ensureColumn('counter_sessions', 'expected_cash', 'REAL');
    ensureColumn('counter_sessions', 'variance', 'REAL');
    ensureColumn('counter_sessions', 'terminal_status', `TEXT DEFAULT 'active'`);
    ensureColumn('counter_sessions', 'x_report_json', 'TEXT');
    ensureColumn('counter_sessions', 'sync_status', `TEXT DEFAULT 'pending'`);
    ensureColumn('counter_sessions', 'sync_error', 'TEXT');
    ensureColumn('counter_sessions', 'sync_attempt_count', 'INTEGER DEFAULT 0');
    ensureColumn('counter_sessions', 'synced_at', 'DATETIME');
    ensureColumn('counter_sessions', 'opened_at', 'DATETIME');
    ensureColumn('counter_sessions', 'closed_at', 'DATETIME');

    // Categories Table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )`);

    // Products Table
    db.run(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      price REAL,
      image_url TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      customer_id INTEGER UNIQUE,
      name TEXT NOT NULL,
      phone_number TEXT,
      allow_credit INTEGER DEFAULT 0,
      credit_limit REAL DEFAULT 0,
      status TEXT DEFAULT 'active'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS vouchers (
      id TEXT PRIMARY KEY,
      voucher_id INTEGER UNIQUE,
      code TEXT NOT NULL,
      discount_type TEXT NOT NULL,
      discount_value REAL DEFAULT 0,
      min_order_value REAL DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      payment_method_id INTEGER UNIQUE,
      method_name TEXT NOT NULL,
      method_code TEXT,
      is_active INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sale_counters (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1
    )`);

    // Inventory: Raw Materials
    db.run(`CREATE TABLE IF NOT EXISTS raw_materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL, /* e.g., kg, liters, units */
      current_stock REAL DEFAULT 0,
      min_par_level REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0
    )`);

    // Recipes: Linking Products to Raw Materials
    db.run(`CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      raw_material_id TEXT NOT NULL,
      quantity_required REAL NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id)
    )`);

    // Inventory Transactions Log (Depletions/Restocks)
    db.run(`CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      raw_material_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL, /* e.g., 'sales_depletion', 'purchase_receive', 'manual_adjustment' */
      quantity REAL NOT NULL, /* Negative for depletion, positive for receive */
      order_id TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // --- SEED MOCK INVENTORY (For Dev/Testing) ---
    db.get('SELECT COUNT(*) as count FROM raw_materials', [], (err, row) => {
      if (!err && row && row.count === 0) {
        console.log('Seeding mock raw materials...');
        const stmt = db.prepare('INSERT INTO raw_materials (id, name, unit, current_stock, min_par_level, cost_per_unit) VALUES (?, ?, ?, ?, ?, ?)');
        stmt.run('rm-001', 'Flour (Dough)', 'kg', 50, 10, 1.50);
        stmt.run('rm-002', 'Mozzarella Cheese', 'kg', 20, 5, 8.00);
        stmt.run('rm-003', 'Tomato Sauce', 'liters', 15, 3, 2.50);
        stmt.run('rm-004', 'Pepperoni', 'kg', 10, 2, 12.00);
        stmt.run('rm-005', 'Chicken Breast', 'kg', 30, 10, 6.50);
        stmt.run('rm-006', 'Beef Patty', 'units', 100, 20, 1.20);
        stmt.run('rm-007', 'Burger Buns', 'units', 150, 30, 0.40);
        stmt.finalize();
      }
    });

    // --- SEED MOCK RECIPES (For Dev/Testing) ---
    db.get('SELECT COUNT(*) as count FROM recipes', [], (err, row) => {
      if (!err && row && row.count === 0) {
        console.log('Seeding mock recipes...');
        const stmt = db.prepare('INSERT INTO recipes (id, product_id, raw_material_id, quantity_required) VALUES (?, ?, ?, ?)');
        // Note: product_id here would ideally be exact UUIDs from product sync, 
        // to simplify the MVP test we rely on name matching in preload.cjs, but let's insert direct matches
        // For '1'='Margherita Pizza', '2'='Pepperoni Pizza', '3'='Classic Burger'
        stmt.run('rcp-1-1', '1', 'rm-001', 0.25); // 250g flour for Margherita
        stmt.run('rcp-1-2', '1', 'rm-002', 0.15); // 150g cheese for Margherita
        stmt.run('rcp-1-3', '1', 'rm-003', 0.10); // 100ml sauce for Margherita

        stmt.run('rcp-2-1', '2', 'rm-001', 0.25);
        stmt.run('rcp-2-2', '2', 'rm-002', 0.15);
        stmt.run('rcp-2-3', '2', 'rm-003', 0.10);
        stmt.run('rcp-2-4', '2', 'rm-004', 0.10); // 100g pepperoni

        stmt.run('rcp-3-1', '3', 'rm-006', 1);    // 1 Patty
        stmt.run('rcp-3-2', '3', 'rm-007', 1);    // 1 Bun
        stmt.finalize();
      }
    });

  });
}

module.exports = db;
