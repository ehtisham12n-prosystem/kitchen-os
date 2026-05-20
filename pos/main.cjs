const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db.cjs'); // Initialize offline DB
const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildReceiptHtml(receipt) {
    const items = Array.isArray(receipt?.items) ? receipt.items : [];
    const totals = receipt?.totals || {};

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>KitchenOS Bill</title>
    <style>
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        margin: 0;
        padding: 16px;
        color: #111827;
        width: 300px;
      }
      .header, .footer { text-align: center; }
      .title { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
      .muted { color: #6b7280; font-size: 12px; }
      .section { margin-top: 12px; }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 12px;
        margin: 4px 0;
      }
      .items {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 12px;
      }
      .items th, .items td {
        border-bottom: 1px dashed #d1d5db;
        padding: 6px 0;
        text-align: left;
        vertical-align: top;
      }
      .items th:last-child, .items td:last-child { text-align: right; }
      .summary { margin-top: 12px; border-top: 1px solid #111827; padding-top: 8px; }
      .net { font-size: 16px; font-weight: 700; }
      .remarks {
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px dashed #d1d5db;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="title">${escapeHtml(receipt?.branch_name || 'KitchenOS POS')}</div>
      <div class="muted">${escapeHtml(receipt?.counter_name || '')}</div>
      <div class="muted">${escapeHtml(receipt?.printed_at || '')}</div>
    </div>

    <div class="section">
      <div class="row"><span>Order #</span><strong>${escapeHtml(receipt?.order_number || '')}</strong></div>
      <div class="row"><span>Customer</span><span>${escapeHtml(receipt?.customer || 'Walk-in Customer')}</span></div>
      <div class="row"><span>Waiter</span><span>${escapeHtml(receipt?.waiter || '-')}</span></div>
      <div class="row"><span>Table</span><span>${escapeHtml(receipt?.table_name || '-')}</span></div>
      <div class="row"><span>Order Type</span><span>${escapeHtml(receipt?.order_type || '-')}</span></div>
      <div class="row"><span>Payment</span><span>${escapeHtml(receipt?.payment_mode || '-')}</span></div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item) => `
          <tr>
            <td>
              <div>${escapeHtml(item.name || '')}</div>
              ${item.instructions ? `<div class="muted">${escapeHtml(item.instructions)}</div>` : ''}
            </td>
            <td>${escapeHtml(item.qty || 0)}</td>
            <td>${escapeHtml(item.total || '')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="summary">
      <div class="row"><span>Subtotal</span><span>${escapeHtml(totals.sub_total || '')}</span></div>
      <div class="row"><span>Tax</span><span>${escapeHtml(totals.tax_amount || '')}</span></div>
      <div class="row"><span>Discount</span><span>${escapeHtml(totals.discount_amount || '')}</span></div>
      <div class="row net"><span>Net Payable</span><span>${escapeHtml(totals.net_payable || '')}</span></div>
      <div class="row"><span>Cash Received</span><span>${escapeHtml(totals.cash_received || '')}</span></div>
      <div class="row"><span>Change</span><span>${escapeHtml(totals.change_return || '')}</span></div>
    </div>

    ${receipt?.remarks ? `<div class="remarks"><strong>Remarks:</strong> ${escapeHtml(receipt.remarks)}</div>` : ''}

    <div class="footer section">
      <div class="muted">Offline POS bill</div>
    </div>
  </body>
</html>`;
}

async function printReceipt(payload) {
    const html = buildReceiptHtml(payload?.receipt || {});
    const printWindow = new BrowserWindow({
        show: false,
        width: 360,
        height: 640,
        autoHideMenuBar: true,
        webPreferences: {
            sandbox: false,
        },
    });

    try {
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

        if (payload?.printOptions?.deviceName) {
            const printers = await printWindow.webContents.getPrintersAsync();
            const matched = printers.find((printer) => printer.name === payload.printOptions.deviceName);
            if (!matched) {
                throw new Error(`Configured printer "${payload.printOptions.deviceName}" was not found on this device.`);
            }
        }

        await new Promise((resolve, reject) => {
            printWindow.webContents.print(
                {
                    silent: Boolean(payload?.printOptions?.silent),
                    deviceName: payload?.printOptions?.deviceName || undefined,
                    printBackground: true,
                    margins: { marginType: 'none' },
                },
                (success, failureReason) => {
                    if (!success) {
                        reject(new Error(failureReason || 'The print job was cancelled or could not be sent.'));
                        return;
                    }
                    resolve(true);
                },
            );
        });

        return { ok: true };
    } finally {
        if (!printWindow.isDestroyed()) {
            printWindow.close();
        }
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: true,
            contextIsolation: false // Simplifies SQLite access for this demo MVP
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5190');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }
}

ipcMain.handle('pos:print-bill', async (_event, payload) => {
    return printReceipt(payload);
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});
