const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db.cjs');

const CONFIG_PATH = path.join(__dirname, 'pos.runtime.json');
const DEFAULT_BACKEND_URL = process.env.KOS_POS_BACKEND_URL || 'http://localhost:3000/v1';

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function readRuntimeConfig() {
    let fileConfig = {};
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        } catch (error) {
            console.error('Failed to parse pos.runtime.json:', error);
        }
    }

    return {
        backend_url: fileConfig.backend_url || DEFAULT_BACKEND_URL,
        tenant_slug: fileConfig.tenant_slug || process.env.KOS_POS_TENANT_SLUG || '',
        username: fileConfig.username || process.env.KOS_POS_USERNAME || '',
        password: fileConfig.password || process.env.KOS_POS_PASSWORD || '',
        branch_id: Number(fileConfig.branch_id || process.env.KOS_POS_BRANCH_ID || 0) || null,
        device_uid: fileConfig.device_uid || process.env.KOS_POS_DEVICE_UID || '',
        device_code: fileConfig.device_code || process.env.KOS_POS_DEVICE_CODE || '',
        device_name: fileConfig.device_name || process.env.KOS_POS_DEVICE_NAME || 'KitchenOS POS Terminal',
        device_type: fileConfig.device_type || process.env.KOS_POS_DEVICE_TYPE || 'pos_terminal',
        device_os: fileConfig.device_os || process.platform,
        app_version: fileConfig.app_version || process.env.npm_package_version || '0.0.0',
        printer_name: fileConfig.printer_name || process.env.KOS_POS_PRINTER_NAME || '',
        silent_print: String(fileConfig.silent_print || process.env.KOS_POS_SILENT_PRINT || '').toLowerCase() === 'true',
    };
}

function computeHash(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex');
}

function computeNextRetryAt(attemptCount) {
    const minutes = Math.min(Math.max(2 ** Math.max(Number(attemptCount || 0) - 1, 0), 1), 30);
    return new Date(Date.now() + (minutes * 60 * 1000)).toISOString();
}

async function setSetting(key, value) {
    await dbRun(
        `INSERT INTO device_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, typeof value === 'string' ? value : JSON.stringify(value)],
    );
}

async function getSetting(key) {
    const row = await dbGet(`SELECT value FROM device_settings WHERE key = ?`, [key]);
    if (!row?.value) return null;
    try {
        return JSON.parse(row.value);
    } catch {
        return row.value;
    }
}

async function getStoredSession() {
    return {
        token: await getSetting('auth_token'),
        user_context: await getSetting('user_context'),
        device: await getSetting('device_context'),
        branch_id: await getSetting('branch_id'),
    };
}

async function loginIfNeeded(force = false) {
    const config = readRuntimeConfig();
    if (!config.tenant_slug || !config.username || !config.password || !config.branch_id || !config.device_uid) {
        return {
            ok: false,
            reason: 'Offline POS runtime config is missing tenant, credentials, branch, or device identity.',
            config,
        };
    }

    const stored = await getStoredSession();
    if (!force && stored.token && stored.user_context) {
        return {
            ok: true,
            token: stored.token,
            user_context: stored.user_context,
            config,
        };
    }

    const response = await fetch(`${config.backend_url.replace(/\/$/, '')}/auth/client-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tenantSlug: config.tenant_slug,
            username: config.username,
            password: config.password,
        }),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Client login failed: ${message || response.statusText}`);
    }

    const login = await response.json();
    const token = login.access_token;
    const me = await fetch(`${config.backend_url.replace(/\/$/, '')}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!me.ok) {
        throw new Error(`Failed to load auth context: ${me.statusText}`);
    }
    const profile = await me.json();
    await setSetting('auth_token', token);
    await setSetting('user_context', profile.user_context || null);
    await setSetting('branch_id', config.branch_id);

    return {
        ok: true,
        token,
        user_context: profile.user_context,
        config,
    };
}

async function registerDevice(forceLogin = false) {
    const session = await loginIfNeeded(forceLogin);
    if (!session.ok) {
        return session;
    }

    const { config, token } = session;
    const response = await fetch(`${config.backend_url.replace(/\/$/, '')}/pos/devices/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'x-branch-id': String(config.branch_id),
        },
        body: JSON.stringify({
            branch_id: config.branch_id,
            device_uid: config.device_uid,
            device_code: config.device_code || undefined,
            device_name: config.device_name,
            device_type: config.device_type,
            device_os: config.device_os,
            app_version: config.app_version,
        }),
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Device registration failed: ${message || response.statusText}`);
    }

    const device = await response.json();
    await setSetting('device_context', device);
    return {
        ok: true,
        token,
        user_context: session.user_context,
        config,
        device,
    };
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || response.statusText);
    }
    return response.json();
}

async function tryFetchJson(url, options = {}) {
    try {
        return await fetchJson(url, options);
    } catch (error) {
        console.warn(`Optional preload fetch failed for ${url}:`, error?.message || error);
        return null;
    }
}

async function upsertReferenceRows(tableName, rows, columns, valueMapper) {
    await dbRun(`DELETE FROM ${tableName}`);
    if (!Array.isArray(rows) || rows.length === 0) {
        return 0;
    }

    const placeholders = columns.map(() => '?').join(', ');
    const statement = db.prepare(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`);

    try {
        for (const row of rows) {
            await new Promise((resolve, reject) => {
                statement.run(valueMapper(row), (err) => {
                    if (err) reject(err);
                    else resolve(null);
                });
            });
        }
    } finally {
        await new Promise((resolve, reject) => {
            statement.finalize((err) => {
                if (err) reject(err);
                else resolve(null);
            });
        });
    }

    return rows.length;
}

async function pullMenuFromCloud() {
    const session = await registerDevice(false);
    if (!session.ok) {
        return session;
    }

    const baseUrl = session.config.backend_url.replace(/\/$/, '');
    const headers = {
        Authorization: `Bearer ${session.token}`,
        'x-branch-id': String(session.config.branch_id),
    };

    const data = await fetchJson(
        `${baseUrl}/catalog/menu/branch/${session.config.branch_id}`,
        { headers },
    );
    const categories = Array.isArray(data.categories) ? data.categories : [];
    const products = Array.isArray(data.products) ? data.products : [];
    const [customers, vouchers, paymentMethods, saleCounters] = await Promise.all([
        tryFetchJson(`${baseUrl}/customers`, { headers }),
        tryFetchJson(`${baseUrl}/deals/vouchers`, { headers }),
        tryFetchJson(`${baseUrl}/setup/payment-methods`, { headers }),
        tryFetchJson(`${baseUrl}/pos/sale-counters?branch_id=${session.config.branch_id}`, { headers }),
    ]);

    await upsertReferenceRows(
        'categories',
        categories,
        ['id', 'name'],
        (category) => [String(category.id || category.name), category.name],
    );
    await upsertReferenceRows(
        'products',
        products,
        ['id', 'name', 'description', 'category', 'price', 'image_url'],
        (product) => [
            String(product.id),
            product.product_name || product.name,
            product.description || product.desc || '',
            product.category?.category_name || product.category || 'Uncategorized',
            Number(product.price || product.product_base_price || 0),
            product.image_url || product.img || '',
        ],
    );
    await upsertReferenceRows(
        'customers',
        Array.isArray(customers) ? customers : [],
        ['id', 'name', 'phone_number', 'allow_credit', 'credit_limit', 'status'],
        (customer) => [
            String(customer.id),
            customer.name || customer.customer_name || 'Customer',
            customer.phone_number || '',
            customer.allow_credit ? 1 : 0,
            Number(customer.credit_limit || 0),
            customer.status || 'active',
        ],
    );
    await upsertReferenceRows(
        'vouchers',
        Array.isArray(vouchers) ? vouchers : [],
        ['id', 'code', 'name', 'discount_type', 'discount_value', 'is_active'],
        (voucher) => [
            String(voucher.id),
            voucher.code,
            voucher.name || '',
            voucher.discount_type || 'fixed_amount',
            Number(voucher.discount_value || 0),
            voucher.is_active ? 1 : 0,
        ],
    );
    await upsertReferenceRows(
        'payment_methods',
        Array.isArray(paymentMethods) ? paymentMethods : [],
        ['id', 'method_name', 'method_code', 'is_active'],
        (method) => [
            String(method.id),
            method.method_name,
            method.method_code,
            method.is_active ? 1 : 0,
        ],
    );
    await upsertReferenceRows(
        'sale_counters',
        Array.isArray(saleCounters) ? saleCounters : [],
        ['id', 'name', 'code', 'is_active'],
        (counter) => [
            String(counter.id),
            counter.name,
            counter.code || '',
            counter.is_active ? 1 : 0,
        ],
    );
    await setSetting('last_menu_sync_at', new Date().toISOString());

    return {
        ok: true,
        categories_count: categories.length,
        products_count: products.length,
        customers_count: Array.isArray(customers) ? customers.length : 0,
        vouchers_count: Array.isArray(vouchers) ? vouchers.length : 0,
        payment_methods_count: Array.isArray(paymentMethods) ? paymentMethods.length : 0,
        sale_counters_count: Array.isArray(saleCounters) ? saleCounters.length : 0,
    };
}

async function reserveOrderNumber() {
    const config = readRuntimeConfig();
    const today = new Date().toISOString().split('T')[0].replaceAll('-', '');
    const counterKey = `order_counter_${today}`;
    const last = Number(await getSetting(counterKey) || 0);
    const next = last + 1;
    await setSetting(counterKey, next);

    const clientCode = String(config.tenant_slug || 'tenant').slice(0, 8).toUpperCase();
    const branchCode = `B${config.branch_id || 0}`;
    const deviceCode = (config.device_code || config.device_uid || 'POS').replace(/\s+/g, '').toUpperCase();
    return `${clientCode}-${branchCode}-${deviceCode}-${String(next).padStart(5, '0')}`;
}

async function saveDraftCart(draft) {
    await dbRun(
        `INSERT INTO cart_drafts (id, cart_json, remarks, order_number, updated_at)
         VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
            cart_json = excluded.cart_json,
            remarks = excluded.remarks,
            order_number = excluded.order_number,
            updated_at = CURRENT_TIMESTAMP`,
        [
            JSON.stringify(draft?.cart || []),
            draft?.remarks || '',
            draft?.order_number || null,
        ],
    );
    return true;
}

async function loadDraftCart() {
    const row = await dbGet(`SELECT * FROM cart_drafts WHERE id = 1`);
    if (!row) {
        return { cart: [], remarks: '', order_number: null };
    }

    return {
        cart: row.cart_json ? JSON.parse(row.cart_json) : [],
        remarks: row.remarks || '',
        order_number: row.order_number || null,
    };
}

async function clearDraftCart() {
    await dbRun(`DELETE FROM cart_drafts WHERE id = 1`);
    return true;
}

async function saveOfflineOrder(order) {
    await dbRun(
        `INSERT INTO offline_orders (
            id, order_number, branch_id, device_uid, shift_reference, business_day_reference, counter_session_reference, sale_counter_id, customer, waiter, table_name, order_type,
            payment_method, order_note, total_amount, sub_total, tax_amount, discount_amount,
            items_json, payments_json, status, sync_status, remote_order_id, sync_error, sync_attempt_count, synced_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
         ON CONFLICT(id) DO UPDATE SET
            order_number = excluded.order_number,
            branch_id = excluded.branch_id,
            device_uid = excluded.device_uid,
            shift_reference = excluded.shift_reference,
            business_day_reference = excluded.business_day_reference,
            counter_session_reference = excluded.counter_session_reference,
            sale_counter_id = excluded.sale_counter_id,
            customer = excluded.customer,
            waiter = excluded.waiter,
            table_name = excluded.table_name,
            order_type = excluded.order_type,
            payment_method = excluded.payment_method,
            order_note = excluded.order_note,
            total_amount = excluded.total_amount,
            sub_total = excluded.sub_total,
            tax_amount = excluded.tax_amount,
            discount_amount = excluded.discount_amount,
            items_json = excluded.items_json,
            payments_json = excluded.payments_json,
            status = excluded.status,
            sync_status = excluded.sync_status,
            sync_error = excluded.sync_error,
            sync_attempt_count = excluded.sync_attempt_count,
            synced_at = excluded.synced_at`,
        [
            order.id,
            order.order_number,
            order.branch_id || null,
            order.device_uid || null,
            order.shift_reference || null,
            order.business_day_reference || null,
            order.counter_session_reference || null,
            order.sale_counter_id || null,
            order.customer || null,
            order.waiter || null,
            order.table_name || null,
            order.order_type || 'Dine-in',
            order.payment_method || null,
            order.order_note || null,
            Number(order.total_amount || 0),
            Number(order.sub_total || order.total_amount || 0),
            Number(order.tax_amount || 0),
            Number(order.discount_amount || 0),
            order.items_json || '[]',
            order.payments_json || '[]',
            order.status || 'Open',
            order.sync_status || 'pending',
            order.remote_order_id || null,
            order.sync_error || null,
            Number(order.sync_attempt_count || 0),
            order.synced_at || null,
            order.created_at || null,
        ],
    );
    return order.id;
}

async function getCurrentBusinessDay() {
    return dbGet(
        `SELECT * FROM business_days WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1`,
    );
}

async function openBusinessDay(payload = {}) {
    const config = readRuntimeConfig();
    const current = await getCurrentBusinessDay();
    if (current) {
        return current;
    }

    const businessDate = payload.business_date || new Date().toLocaleDateString('en-CA');
    const businessDayId = payload.id || `BD-${businessDate}-${config.branch_id || 0}`;
    const row = {
        id: businessDayId,
        branch_id: payload.branch_id || config.branch_id || null,
        business_date: businessDate,
        title: payload.title || `Business Day ${businessDate}`,
        notes: payload.notes || null,
        status: payload.status || 'open',
        opened_at: payload.opened_at || new Date().toISOString(),
    };

    await dbRun(
        `INSERT INTO business_days (
            id, branch_id, business_date, title, status, notes, sync_status, sync_error, sync_attempt_count, synced_at, opened_at, closed_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, 0, NULL, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET
            branch_id = excluded.branch_id,
            business_date = excluded.business_date,
            title = excluded.title,
            status = excluded.status,
            notes = excluded.notes,
            sync_status = 'pending',
            sync_error = NULL,
            sync_attempt_count = 0,
            synced_at = NULL,
            opened_at = excluded.opened_at`,
        [row.id, row.branch_id, row.business_date, row.title, row.status, row.notes, row.opened_at],
    );

    await addToSyncQueue('BUSINESS_DAY', row, {
        event_id: `BUSINESS_DAY-OPEN-${row.id}`,
        entity_id: row.id,
    });

    return dbGet(`SELECT * FROM business_days WHERE id = ?`, [row.id]);
}

async function closeBusinessDay(payload = {}) {
    const current = await getCurrentBusinessDay();
    if (!current) {
        throw new Error('No active business day found.');
    }

    const closedAt = payload.closed_at || new Date().toISOString();
    await dbRun(
        `UPDATE business_days
         SET status = 'closed', notes = COALESCE(?, notes), sync_status = 'pending', sync_error = NULL,
             sync_attempt_count = 0, synced_at = NULL, closed_at = ?
         WHERE id = ?`,
        [payload.notes || null, closedAt, current.id],
    );

    const snapshot = await dbGet(`SELECT * FROM business_days WHERE id = ?`, [current.id]);
    await addToSyncQueue('BUSINESS_DAY', snapshot, {
        event_id: `BUSINESS_DAY-CLOSE-${current.id}`,
        entity_id: current.id,
    });

    return snapshot;
}

async function getCurrentCounterSession() {
    return dbGet(
        `SELECT * FROM counter_sessions WHERE terminal_status IN ('open', 'active') ORDER BY opened_at DESC LIMIT 1`,
    );
}

async function getSaleCounters() {
    return dbAll(`SELECT * FROM sale_counters WHERE is_active = 1 ORDER BY name ASC`);
}

async function getCustomers() {
    return dbAll(`SELECT * FROM customers WHERE status = 'active' ORDER BY name ASC`);
}

async function getVouchers() {
    return dbAll(`SELECT * FROM vouchers WHERE is_active = 1 ORDER BY code ASC`);
}

async function getPaymentMethods() {
    return dbAll(`SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY method_name ASC`);
}

async function openCounterSession(payload = {}) {
    const config = readRuntimeConfig();
    const storedSession = await getStoredSession();
    const current = await getCurrentCounterSession();
    if (current) {
        return current;
    }

    const businessDay = await getCurrentBusinessDay() || await openBusinessDay();
    const saleCounterId = Number(payload.sale_counter_id || 0);
    if (!saleCounterId) {
        throw new Error('Select a sale counter before opening an offline sales counter session.');
    }

    const saleCounter = await dbGet(`SELECT * FROM sale_counters WHERE id = ?`, [String(saleCounterId)]);
    if (!saleCounter) {
        throw new Error('Selected sale counter is not available in the local cache. Refresh reference data first.');
    }

    const sessionId = payload.id || crypto.randomUUID();
    const row = {
        id: sessionId,
        branch_id: payload.branch_id || config.branch_id || null,
        business_day_reference: businessDay.id,
        shift_reference: payload.shift_reference || null,
        sale_counter_id: saleCounterId,
        sale_counter_name: payload.sale_counter_name || saleCounter.name,
        device_uid: payload.device_uid || config.device_uid || null,
        cashier_user_id: payload.cashier_user_id || null,
        cashier_name: payload.cashier_name || storedSession?.user_context?.full_name || null,
        assigned_float: Number(payload.assigned_float || payload.opening_float || 0),
        opening_verified_cash: Number(payload.opening_verified_cash || payload.assigned_float || payload.opening_float || 0),
        expected_cash: Number(payload.expected_cash || payload.opening_float || 0),
        terminal_status: payload.terminal_status || 'active',
        opened_at: payload.opened_at || new Date().toISOString(),
    };

    await dbRun(
        `INSERT INTO counter_sessions (
            id, branch_id, business_day_reference, shift_reference, sale_counter_id, sale_counter_name, device_uid,
            cashier_user_id, cashier_name, assigned_float, opening_verified_cash, blind_count, expected_cash, variance,
            terminal_status, x_report_json, sync_status, sync_error, sync_attempt_count, synced_at, opened_at, closed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, NULL, 'pending', NULL, 0, NULL, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET
            branch_id = excluded.branch_id,
            business_day_reference = excluded.business_day_reference,
            shift_reference = excluded.shift_reference,
            sale_counter_id = excluded.sale_counter_id,
            sale_counter_name = excluded.sale_counter_name,
            device_uid = excluded.device_uid,
            cashier_user_id = excluded.cashier_user_id,
            cashier_name = excluded.cashier_name,
            assigned_float = excluded.assigned_float,
            opening_verified_cash = excluded.opening_verified_cash,
            expected_cash = excluded.expected_cash,
            terminal_status = excluded.terminal_status,
            sync_status = 'pending',
            sync_error = NULL,
            sync_attempt_count = 0,
            synced_at = NULL,
            opened_at = excluded.opened_at`,
        [
            row.id,
            row.branch_id,
            row.business_day_reference,
            row.shift_reference,
            row.sale_counter_id,
            row.sale_counter_name,
            row.device_uid,
            row.cashier_user_id,
            row.cashier_name,
            row.assigned_float,
            row.opening_verified_cash,
            row.expected_cash,
            row.terminal_status,
            row.opened_at,
        ],
    );

    await addToSyncQueue('COUNTER_SESSION', row, {
        event_id: `COUNTER_SESSION-OPEN-${row.id}`,
        entity_id: row.id,
    });

    return dbGet(`SELECT * FROM counter_sessions WHERE id = ?`, [row.id]);
}

async function buildLocalXReport(counterSessionId) {
    const session = await dbGet(`SELECT * FROM counter_sessions WHERE id = ?`, [counterSessionId]);
    if (!session) {
        throw new Error('Counter session not found.');
    }

    const orders = await dbAll(
        `SELECT * FROM offline_orders WHERE counter_session_reference = ? ORDER BY created_at ASC`,
        [counterSessionId],
    );
    const paidOrders = orders.filter((order) => ['paid', 'completed'].includes(String(order.status || '').toLowerCase()));
    const paymentBreakdown = paidOrders.reduce((acc, order) => {
        const mode = String(order.payment_method || 'cash').trim().toLowerCase() || 'cash';
        acc[mode] = Number(acc[mode] || 0) + Number(order.total_amount || 0);
        return acc;
    }, {});
    const grossSales = paidOrders.reduce((sum, order) => sum + Number(order.sub_total || 0), 0);
    const netSales = paidOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const taxTotal = paidOrders.reduce((sum, order) => sum + Number(order.tax_amount || 0), 0);
    const discountTotal = paidOrders.reduce((sum, order) => sum + Number(order.discount_amount || 0), 0);
    const cashSales = paidOrders
        .filter((order) => String(order.payment_method || '').trim().toLowerCase().includes('cash'))
        .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const openingCash = Number(session.opening_verified_cash || session.assigned_float || 0);
    const expectedCash = Number((openingCash + cashSales).toFixed(2));

    return {
        counter_session_reference: session.id,
        business_day_reference: session.business_day_reference,
        sale_counter_id: session.sale_counter_id,
        sale_counter_name: session.sale_counter_name,
        opened_at: session.opened_at,
        closed_at: session.closed_at,
        order_count: orders.length,
        paid_order_count: paidOrders.length,
        gross_sales: grossSales,
        net_sales: netSales,
        tax_total: taxTotal,
        discount_total: discountTotal,
        payment_breakdown: paymentBreakdown,
        opening_float: Number(session.assigned_float || 0),
        opening_verified_cash: openingCash,
        blind_count: session.blind_count === null || session.blind_count === undefined ? null : Number(session.blind_count),
        expected_cash: expectedCash,
        variance: session.blind_count === null || session.blind_count === undefined
            ? Number(session.variance || 0)
            : Number((Number(session.blind_count || 0) - expectedCash).toFixed(2)),
        generated_at: new Date().toISOString(),
        orders: orders.map((order) => ({
            order_number: order.order_number,
            order_type: order.order_type,
            status: order.status,
            total_amount: Number(order.total_amount || 0),
            payment_method: order.payment_method || null,
            created_at: order.created_at,
        })),
    };
}

async function closeCounterSession(payload = {}) {
    const current = await getCurrentCounterSession();
    if (!current) {
        throw new Error('No active counter session found.');
    }

    const xReport = await buildLocalXReport(current.id);
    const blindCount = Number(payload.blind_count ?? xReport.net_sales ?? 0);
    const expectedCash = Number(payload.expected_cash ?? xReport.expected_cash ?? xReport.net_sales ?? 0);
    const variance = Number((blindCount - expectedCash).toFixed(2));
    const closedAt = payload.closed_at || new Date().toISOString();

    await dbRun(
        `UPDATE counter_sessions
         SET blind_count = ?, expected_cash = ?, variance = ?, terminal_status = 'closed',
             x_report_json = ?, sync_status = 'pending', sync_error = NULL, sync_attempt_count = 0,
             synced_at = NULL, closed_at = ?
         WHERE id = ?`,
        [blindCount, expectedCash, variance, JSON.stringify(xReport), closedAt, current.id],
    );

    const snapshot = await dbGet(`SELECT * FROM counter_sessions WHERE id = ?`, [current.id]);
    await addToSyncQueue('COUNTER_SESSION', {
        ...snapshot,
        x_report_json: snapshot?.x_report_json || JSON.stringify(xReport),
    }, {
        event_id: `COUNTER_SESSION-CLOSE-${current.id}`,
        entity_id: current.id,
    });

    return {
        ...(snapshot || {}),
        x_report: xReport,
    };
}

async function getCurrentOfflineShift() {
    return dbGet(
        `SELECT * FROM offline_shifts WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1`,
    );
}

async function openOfflineShift(payload = {}) {
    const config = readRuntimeConfig();
    const current = await getCurrentOfflineShift();
    if (current) {
        return current;
    }

    const shiftId = payload.id || crypto.randomUUID();
    const shiftRow = {
        id: shiftId,
        branch_id: payload.branch_id || config.branch_id || null,
        device_uid: payload.device_uid || config.device_uid || null,
        opening_float: Number(payload.opening_float || 0),
        status: 'open',
        sync_status: 'pending',
        opened_at: payload.opened_at || new Date().toISOString(),
    };

    await dbRun(
        `INSERT INTO offline_shifts (
            id, branch_id, device_uid, opening_float, actual_cash, status, sync_status,
            sync_error, sync_attempt_count, synced_at, opened_at, closed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            branch_id = excluded.branch_id,
            device_uid = excluded.device_uid,
            opening_float = excluded.opening_float,
            status = excluded.status,
            sync_status = excluded.sync_status,
            opened_at = excluded.opened_at`,
        [
            shiftRow.id,
            shiftRow.branch_id,
            shiftRow.device_uid,
            shiftRow.opening_float,
            null,
            shiftRow.status,
            shiftRow.sync_status,
            null,
            0,
            null,
            shiftRow.opened_at,
            null,
        ],
    );

    await addToSyncQueue('SHIFT', {
        shift_reference: shiftRow.id,
        status: 'open',
        opening_float: shiftRow.opening_float,
        opened_at: shiftRow.opened_at,
    }, {
        event_id: `SHIFT-OPEN-${shiftRow.id}`,
        entity_id: shiftRow.id,
    });

    return dbGet(`SELECT * FROM offline_shifts WHERE id = ?`, [shiftRow.id]);
}

async function closeOfflineShift(payload = {}) {
    const current = await getCurrentOfflineShift();
    if (!current) {
        throw new Error('No active offline shift found.');
    }

    const actualCash = Number(payload.actual_cash || 0);
    const closedAt = payload.closed_at || new Date().toISOString();
    await dbRun(
        `UPDATE offline_shifts
         SET actual_cash = ?, status = 'closed', sync_status = 'pending', sync_error = NULL,
             closed_at = ?, sync_attempt_count = 0, synced_at = NULL
         WHERE id = ?`,
        [actualCash, closedAt, current.id],
    );

    await addToSyncQueue('SHIFT', {
        shift_reference: current.id,
        status: 'closed',
        opening_float: Number(current.opening_float || 0),
        actual_cash: actualCash,
        opened_at: current.opened_at,
        closed_at: closedAt,
    }, {
        event_id: `SHIFT-CLOSE-${current.id}`,
        entity_id: current.id,
    });

    return dbGet(`SELECT * FROM offline_shifts WHERE id = ?`, [current.id]);
}

async function saveKOT(kot) {
    await dbRun(
        `INSERT INTO kot_tracking (
            id, branch_id, device_uid, kot_number, order_id, order_number, type,
            items_json, status, sync_status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
         ON CONFLICT(id) DO UPDATE SET
            branch_id = excluded.branch_id,
            device_uid = excluded.device_uid,
            kot_number = excluded.kot_number,
            order_id = excluded.order_id,
            order_number = excluded.order_number,
            type = excluded.type,
            items_json = excluded.items_json,
            status = excluded.status,
            sync_status = excluded.sync_status`,
        [
            kot.id,
            kot.branch_id || null,
            kot.device_uid || null,
            kot.kot_number,
            kot.order_id,
            kot.order_number || null,
            kot.type || null,
            kot.items_json,
            kot.status || 'Pending',
            kot.sync_status || 'pending',
            kot.created_at || null,
        ],
    );
    return kot.id;
}

async function addToSyncQueue(entity_type, payload, meta = {}) {
    const eventId = meta.event_id || crypto.randomUUID();
    const entityId = meta.entity_id || payload.order_number || payload.kot_number || payload.shift_reference || payload.id || null;
    const payloadHash = meta.payload_hash || computeHash(payload);

    await dbRun(
        `INSERT INTO sync_queue (
            event_id, entity_type, entity_id, payload, payload_hash, batch_id, status, attempt_count, next_retry_at, created_at
         ) VALUES (?, ?, ?, ?, ?, NULL, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(event_id) DO UPDATE SET
            entity_type = excluded.entity_type,
            entity_id = excluded.entity_id,
            payload = excluded.payload,
            payload_hash = excluded.payload_hash,
            batch_id = NULL,
            conflict_reason = NULL,
            resolution_status = NULL,
            server_entity_id = NULL,
            last_server_status = NULL,
            last_server_message = NULL,
            status = CASE WHEN sync_queue.status = 'synced' THEN sync_queue.status ELSE excluded.status END,
            next_retry_at = CURRENT_TIMESTAMP`,
        [
            eventId,
            entity_type,
            entityId,
            JSON.stringify(payload),
            payloadHash,
            meta.status || 'pending',
        ],
    );

    return eventId;
}

async function getPendingSyncs() {
    return dbAll(
        `SELECT * FROM sync_queue
         WHERE status IN ('pending', 'failed', 'conflict')
           AND (next_retry_at IS NULL OR datetime(next_retry_at) <= datetime('now'))
         ORDER BY created_at ASC`,
    );
}

async function getOrders(statusFilter = null) {
    let query = `SELECT * FROM offline_orders`;
    const params = [];

    if (statusFilter) {
        const normalized = String(statusFilter).toLowerCase();
        if (normalized === 'open') {
            query += ` WHERE LOWER(status) IN ('open', 'pending', 'in progress', 'held')`;
        } else if (normalized === 'today' || normalized === "today's orders") {
            query += ` WHERE DATE(created_at) = DATE('now', 'localtime')`;
        } else if (normalized === 'recent orders') {
            query += ` ORDER BY created_at DESC LIMIT 20`;
            return dbAll(query, params);
        } else if (normalized === 'paid') {
            query += ` WHERE LOWER(status) IN ('paid', 'completed')`;
        } else if (normalized === 'take-away') {
            query += ` WHERE LOWER(order_type) = 'take-away'`;
        } else if (normalized === 'delivery') {
            query += ` WHERE LOWER(order_type) = 'delivery'`;
        } else {
            query += ` WHERE LOWER(status) = ?`;
            params.push(normalized);
        }
    }

    query += ` ORDER BY created_at DESC`;
    return dbAll(query, params);
}

async function getKOTs() {
    return dbAll(`SELECT * FROM kot_tracking ORDER BY created_at DESC`);
}

async function updateKOTStatus(id, status) {
    await dbRun(`UPDATE kot_tracking SET status = ?, sync_status = 'pending' WHERE id = ?`, [status, id]);
    const kot = await dbGet(`SELECT * FROM kot_tracking WHERE id = ?`, [id]);
    if (kot?.order_number) {
        await addToSyncQueue('KOT', {
            order_number: kot.order_number,
            kot_number: kot.kot_number,
            status,
        }, {
            entity_id: kot.kot_number,
        });
    }
    return true;
}

async function markEntitySyncState(entityType, entityId, status, remoteEntityId = null) {
    if (entityType === 'ORDER' && entityId) {
        await dbRun(`UPDATE offline_orders SET sync_status = ?, remote_order_id = COALESCE(?, remote_order_id), sync_error = CASE WHEN ? = 'synced' THEN NULL ELSE sync_error END, synced_at = CASE WHEN ? = 'synced' THEN CURRENT_TIMESTAMP ELSE synced_at END WHERE order_number = ?`, [
            status,
            remoteEntityId,
            status,
            status,
            entityId,
        ]);
    }
    if (entityType === 'KOT' && entityId) {
        await dbRun(`UPDATE kot_tracking SET sync_status = ? WHERE kot_number = ? OR id = ?`, [status, entityId, entityId]);
    }
    if (entityType === 'SHIFT' && entityId) {
        await dbRun(
            `UPDATE offline_shifts
             SET sync_status = ?, sync_error = CASE WHEN ? = 'synced' THEN NULL ELSE sync_error END,
                 synced_at = CASE WHEN ? = 'synced' THEN CURRENT_TIMESTAMP ELSE synced_at END
             WHERE id = ?`,
            [status, status, status, entityId],
        );
    }
    if (entityType === 'BUSINESS_DAY' && entityId) {
        await dbRun(
            `UPDATE business_days
             SET sync_status = ?, sync_error = CASE WHEN ? = 'synced' THEN NULL ELSE sync_error END,
                 synced_at = CASE WHEN ? = 'synced' THEN CURRENT_TIMESTAMP ELSE synced_at END
             WHERE id = ?`,
            [status, status, status, entityId],
        );
    }
    if (entityType === 'COUNTER_SESSION' && entityId) {
        await dbRun(
            `UPDATE counter_sessions
             SET sync_status = ?, sync_error = CASE WHEN ? = 'synced' THEN NULL ELSE sync_error END,
                 synced_at = CASE WHEN ? = 'synced' THEN CURRENT_TIMESTAMP ELSE synced_at END
             WHERE id = ?`,
            [status, status, status, entityId],
        );
    }
}

async function markEntitySyncError(entityType, entityId, message, attemptCount, syncState = 'failed') {
    if (entityType === 'ORDER' && entityId) {
        await dbRun(
            `UPDATE offline_orders
             SET sync_status = ?, sync_error = ?, sync_attempt_count = ?
             WHERE order_number = ?`,
            [syncState, message, Number(attemptCount || 0), entityId],
        );
    }
    if (entityType === 'SHIFT' && entityId) {
        await dbRun(
            `UPDATE offline_shifts
             SET sync_status = ?, sync_error = ?, sync_attempt_count = ?
             WHERE id = ?`,
            [syncState, message, Number(attemptCount || 0), entityId],
        );
    }
    if (entityType === 'KOT' && entityId) {
        await dbRun(
            `UPDATE kot_tracking SET sync_status = ? WHERE kot_number = ? OR id = ?`,
            [syncState, entityId, entityId],
        );
    }
    if (entityType === 'BUSINESS_DAY' && entityId) {
        await dbRun(
            `UPDATE business_days
             SET sync_status = ?, sync_error = ?, sync_attempt_count = ?
             WHERE id = ?`,
            [syncState, message, Number(attemptCount || 0), entityId],
        );
    }
    if (entityType === 'COUNTER_SESSION' && entityId) {
        await dbRun(
            `UPDATE counter_sessions
             SET sync_status = ?, sync_error = ?, sync_attempt_count = ?
             WHERE id = ?`,
            [syncState, message, Number(attemptCount || 0), entityId],
        );
    }
}

async function getSyncReconciliation() {
    const [queueSummary, failedRows, recentOrders, recentShifts, oldestPendingRow, latestSyncedRow] = await Promise.all([
        dbAll(`
            SELECT status, COUNT(*) AS total
            FROM sync_queue
            GROUP BY status
        `),
        dbAll(`
            SELECT * FROM sync_queue
            WHERE status IN ('failed', 'conflict')
            ORDER BY last_attempt_at DESC, created_at DESC
            LIMIT 10
        `),
        dbAll(`
            SELECT * FROM offline_orders
            ORDER BY created_at DESC
            LIMIT 10
        `),
        dbAll(`
            SELECT * FROM offline_shifts
            ORDER BY opened_at DESC
            LIMIT 5
        `),
        dbGet(`
            SELECT created_at
            FROM sync_queue
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
        `),
        dbGet(`
            SELECT synced_at, batch_id
            FROM sync_queue
            WHERE synced_at IS NOT NULL
            ORDER BY synced_at DESC
            LIMIT 1
        `),
    ]);

    const summary = {
        pending: 0,
        failed: 0,
        conflict: 0,
        synced: 0,
    };
    queueSummary.forEach((row) => {
        const key = String(row.status || '').toLowerCase();
        if (key in summary) {
            summary[key] = Number(row.total || 0);
        }
    });

    const attentionItems = [];
    if (summary.conflict > 0) {
        attentionItems.push({
            level: 'critical',
            code: 'conflicts_open',
            title: 'Manual conflict review needed',
            detail: `${summary.conflict} local sync row(s) are waiting in conflict status.`,
        });
    }
    if (summary.failed > 0) {
        attentionItems.push({
            level: summary.failed >= 5 ? 'critical' : 'warning',
            code: 'failed_retries',
            title: 'Retry backlog detected',
            detail: `${summary.failed} local sync row(s) failed and will retry automatically.`,
        });
    }
    if (summary.pending > 0 && oldestPendingRow?.created_at) {
        attentionItems.push({
            level: 'info',
            code: 'oldest_pending',
            title: 'Oldest unsynced payload',
            detail: `The oldest pending row was queued at ${oldestPendingRow.created_at}.`,
        });
    }

    return {
        summary,
        sync_health: summary.conflict > 0 || summary.failed > 0 ? 'attention' : summary.pending > 0 ? 'syncing' : 'healthy',
        attention_items: attentionItems,
        oldest_pending_at: oldestPendingRow?.created_at || null,
        latest_synced_at: latestSyncedRow?.synced_at || null,
        latest_batch_id: latestSyncedRow?.batch_id || null,
        failed_rows: failedRows,
        recent_orders: recentOrders,
        recent_shifts: recentShifts,
    };
}

async function syncNow() {
    if (!navigator.onLine) {
        return { ok: false, reason: 'offline' };
    }

    const session = await registerDevice(false);
    if (!session.ok) {
        return session;
    }

    const queueRows = await dbAll(
        `SELECT * FROM sync_queue
         WHERE status IN ('pending', 'failed', 'conflict')
           AND (next_retry_at IS NULL OR datetime(next_retry_at) <= datetime('now'))
         ORDER BY created_at ASC
         LIMIT 20`,
    );

    if (queueRows.length === 0) {
        return { ok: true, synced: 0, results: [] };
    }

    const batchId = crypto.randomUUID();

    const events = queueRows.map((row) => {
        const payload = JSON.parse(row.payload || '{}');
        return {
            event_id: row.event_id,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            event_type: 'sync',
            payload_hash: row.payload_hash || computeHash(payload),
            queued_at: row.created_at,
            order: row.entity_type === 'ORDER' ? payload : undefined,
            kot: row.entity_type === 'KOT' ? payload : undefined,
            shift: row.entity_type === 'SHIFT' ? payload : undefined,
            business_day: row.entity_type === 'BUSINESS_DAY' ? payload : undefined,
            counter_session: row.entity_type === 'COUNTER_SESSION' ? payload : undefined,
        };
    });

    queueRows.forEach((row) => {
        db.run(
            `UPDATE sync_queue
             SET attempt_count = attempt_count + 1,
                 last_attempt_at = CURRENT_TIMESTAMP,
                 batch_id = ?,
                 status = 'pending'
             WHERE id = ?`,
            [batchId, row.id],
        );
    });

    const response = await fetch(`${session.config.backend_url.replace(/\/$/, '')}/pos/sync/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
            'x-branch-id': String(session.config.branch_id),
        },
        body: JSON.stringify({
            branch_id: session.config.branch_id,
            device_uid: session.config.device_uid,
            device_code: session.config.device_code || undefined,
            device_name: session.config.device_name,
            device_type: session.config.device_type,
            device_os: session.config.device_os,
            app_version: session.config.app_version,
            batch_id: batchId,
            sent_at: new Date().toISOString(),
            queue_depth: queueRows.length,
            failed_event_count: queueRows.filter((row) => row.status === 'failed').length,
            conflict_event_count: queueRows.filter((row) => row.status === 'conflict').length,
            events,
        }),
    });

    if (!response.ok) {
        const message = await response.text();
        for (const row of queueRows) {
            const nextRetryAt = computeNextRetryAt(Number(row.attempt_count || 0) + 1);
            await dbRun(
                `UPDATE sync_queue
                 SET status = 'failed', last_error = ?, last_server_status = 'failed', last_server_message = ?, next_retry_at = ?, last_attempt_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [message || response.statusText, message || response.statusText, nextRetryAt, row.id],
            );
            await markEntitySyncError(
                row.entity_type,
                row.entity_id,
                message || response.statusText,
                Number(row.attempt_count || 0) + 1,
            );
        }
        throw new Error(`Offline sync batch failed: ${message || response.statusText}`);
    }

    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];

    for (const result of results) {
        const row = queueRows.find((candidate) => candidate.event_id === result.event_id);
        if (!row) continue;

        if (result.status === 'processed') {
            await dbRun(
                `UPDATE sync_queue
                 SET status = 'synced',
                     last_error = NULL,
                     conflict_reason = NULL,
                     resolution_status = NULL,
                     server_entity_id = COALESCE(?, server_entity_id),
                     last_server_status = 'processed',
                     last_server_message = ?,
                     synced_at = CURRENT_TIMESTAMP,
                     next_retry_at = NULL
                 WHERE event_id = ?`,
                [result.entity_id || null, result.message || null, result.event_id],
            );
            await markEntitySyncState(row.entity_type, row.entity_id || result.entity_id, 'synced', result.entity_id || null);
        } else {
            const nextRetryAt = result.status === 'conflict'
                ? null
                : computeNextRetryAt(Number(row.attempt_count || 0) + 1);
            await dbRun(
                `UPDATE sync_queue
                 SET status = ?,
                     last_error = ?,
                     conflict_reason = ?,
                     resolution_status = ?,
                     server_entity_id = COALESCE(?, server_entity_id),
                     last_server_status = ?,
                     last_server_message = ?,
                     next_retry_at = ?
                 WHERE event_id = ?`,
                [
                    result.status,
                    result.message || 'Sync failed',
                    result.conflict_reason || null,
                    result.resolution_status || (result.status === 'conflict' ? 'open' : null),
                    result.entity_id || null,
                    result.status,
                    result.message || 'Sync failed',
                    nextRetryAt,
                    result.event_id,
                ],
            );
            await markEntitySyncError(
                row.entity_type,
                row.entity_id || result.entity_id,
                result.message || 'Sync failed',
                Number(row.attempt_count || 0) + 1,
                result.status,
            );
            await markEntitySyncState(row.entity_type, row.entity_id || result.entity_id, result.status);
        }
    }

    return {
        ok: true,
        synced: results.filter((result) => result.status === 'processed').length,
        batch_id: batchId,
        results,
    };
}

async function bootstrapOfflineContext() {
    const config = readRuntimeConfig();
    const stored = await getStoredSession();
    let onlineContext = null;

    if (navigator.onLine) {
        try {
            onlineContext = await registerDevice(false);
        } catch (error) {
            console.error('Offline bootstrap registration failed:', error);
        }
    }

    return {
        is_online: navigator.onLine,
        is_configured: Boolean(config.tenant_slug && config.username && config.password && config.branch_id && config.device_uid),
        backend_url: config.backend_url,
        branch_id: config.branch_id || stored.branch_id || null,
        branch_name:
            onlineContext?.user_context?.allowed_branches?.find((branch) => Number(branch.branch_id) === Number(config.branch_id))?.branch_name ||
            null,
        device: onlineContext?.device || stored.device || null,
        user_context: onlineContext?.user_context || stored.user_context || null,
        current_business_day: await getCurrentBusinessDay(),
        current_counter_session: await getCurrentCounterSession(),
        current_shift: await getCurrentOfflineShift(),
        sync_reconciliation: await getSyncReconciliation(),
        sale_counters: await getSaleCounters(),
        customers: await getCustomers(),
        vouchers: await getVouchers(),
        payment_methods: await getPaymentMethods(),
        last_menu_sync_at: await getSetting('last_menu_sync_at'),
        printer_name: config.printer_name || null,
        silent_print: config.silent_print,
    };
}

async function printBill(receipt) {
    const config = readRuntimeConfig();
    return ipcRenderer.invoke('pos:print-bill', {
        receipt,
        printOptions: {
            deviceName: config.printer_name || undefined,
            silent: Boolean(config.silent_print),
        },
    });
}

contextBridge.exposeInMainWorld('api', {
    bootstrapOfflineContext,
    pullMenuFromCloud,
    printBill,
    syncNow,
    getPendingSyncs,
    getSyncReconciliation,
    reserveOrderNumber,
    saveDraftCart,
    loadDraftCart,
    clearDraftCart,
    saveOfflineOrder,
    getCurrentBusinessDay,
    openBusinessDay,
    closeBusinessDay,
    getCurrentCounterSession,
    openCounterSession,
    closeCounterSession,
    buildLocalXReport,
    getCurrentOfflineShift,
    openOfflineShift,
    closeOfflineShift,
    getOrders,
    saveKOT,
    getKOTs,
    updateKOTStatus,
    addToSyncQueue,
    getMenu: async () => {
        const categories = await dbAll(`SELECT * FROM categories`);
        const products = await dbAll(`SELECT * FROM products`);
        return { categories, products };
    },
    getSaleCounters,
    getCustomers,
    getVouchers,
    getPaymentMethods,

    // --- INVENTORY APIs ---
    getRawMaterials: async () => {
        return dbAll(`SELECT * FROM raw_materials ORDER BY name ASC`);
    },
    saveRawMaterial: async (material) => {
        const { id, name, unit, current_stock, min_par_level, cost_per_unit } = material;
        await dbRun(
            `INSERT OR REPLACE INTO raw_materials (id, name, unit, current_stock, min_par_level, cost_per_unit)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id, name, unit, current_stock, min_par_level, cost_per_unit],
        );
        return id;
    },
    getRecipes: async () => {
        return dbAll(`
            SELECT r.*, p.name as product_name, m.name as material_name, m.unit
            FROM recipes r
            JOIN products p ON r.product_id = p.id
            JOIN raw_materials m ON r.raw_material_id = m.id
        `);
    },
    addRecipeLink: async (recipeId, productId, rawMaterialId, quantityRequired) => {
        const result = await dbRun(
            `INSERT INTO recipes (id, product_id, raw_material_id, quantity_required) VALUES (?, ?, ?, ?)`,
            [recipeId, productId, rawMaterialId, quantityRequired],
        );
        return result.lastID;
    },
    processOrderDepletion: async (orderId, itemsJson) => {
        return new Promise((resolve, reject) => {
            try {
                const items = JSON.parse(itemsJson || '[]');
                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    for (const item of items) {
                        db.all(
                            `
                                SELECT r.raw_material_id, r.quantity_required
                                FROM recipes r
                                JOIN products p ON r.product_id = p.id
                                WHERE p.id = ? OR p.name = ?
                            `,
                            [String(item.product_id || ''), item.name || item.product_name || ''],
                            (err, recipes) => {
                                if (err) {
                                    console.error('Depletion error finding recipe:', err);
                                    return;
                                }

                                for (const recipe of recipes) {
                                    const totalDepletion = recipe.quantity_required * Number(item.qty || item.quantity || 0);
                                    const txId = crypto.randomUUID();

                                    db.run(
                                        `INSERT INTO inventory_transactions (id, raw_material_id, transaction_type, quantity, order_id)
                                         VALUES (?, ?, 'sales_depletion', ?, ?)`,
                                        [txId, recipe.raw_material_id, -totalDepletion, orderId],
                                    );

                                    db.run(
                                        `UPDATE raw_materials SET current_stock = current_stock - ? WHERE id = ?`,
                                        [totalDepletion, recipe.raw_material_id],
                                    );
                                }
                            },
                        );
                    }

                    db.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve(true);
                    });
                });
            } catch (err) {
                reject(err);
            }
        });
    },
});

console.log('KitchenOS POS Preload Script Loaded and Offline Sync API Exposed');
