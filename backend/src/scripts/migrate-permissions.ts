import fs from 'fs';
import path from 'path';

const REPLACEMENT_MAP = [
  { from: /APP_PERMISSIONS\.STAFF\.MANAGE_USERS/g, to: 'APP_PERMISSIONS.ADMIN.SECURITY_USERS' },
  { from: /APP_PERMISSIONS\.STAFF\.MANAGE_UserManagementS/g, to: 'APP_PERMISSIONS.ADMIN.SECURITY_USERS' },
  { from: /APP_PERMISSIONS\.STAFF\.READ/g, to: 'APP_PERMISSIONS.HR.STAFF_READ' },
  { from: /APP_PERMISSIONS\.STAFF\.MANAGE_ROLES/g, to: 'APP_PERMISSIONS.ADMIN.SECURITY_ROLES' },
  { from: /APP_PERMISSIONS\.BRANCH\.READ/g, to: 'APP_PERMISSIONS.ADMIN.SETUP_BRANCHES' },
  { from: /APP_PERMISSIONS\.BRANCH\.WRITE/g, to: 'APP_PERMISSIONS.ADMIN.SETUP_BRANCHES' },
  { from: /APP_PERMISSIONS\.BRANCH\.MANAGE_FLOWS/g, to: 'APP_PERMISSIONS.ADMIN.SETUP_BRANCHES' },
  { from: /APP_PERMISSIONS\.ORDERS\.CREATE/g, to: 'APP_PERMISSIONS.POS.ORDER_CREATE' },
  { from: /APP_PERMISSIONS\.ORDERS\.READ/g, to: 'APP_PERMISSIONS.POS.ORDER_READ' },
  { from: /APP_PERMISSIONS\.ORDERS\.VOID/g, to: 'APP_PERMISSIONS.POS.ORDER_CANCEL' },
  { from: /APP_PERMISSIONS\.ORDERS\.REPORT/g, to: 'APP_PERMISSIONS.POS.REPORTS' },
  { from: /APP_PERMISSIONS\.INVENTORY\.ADJUST/g, to: 'APP_PERMISSIONS.INVENTORY.STOCK_ADJUST' },
  { from: /APP_PERMISSIONS\.INVENTORY\.RECEIVE/g, to: 'APP_PERMISSIONS.INVENTORY.STOCK_RECEIVE' },
  { from: /APP_PERMISSIONS\.ACCOUNTING\.READ/g, to: 'APP_PERMISSIONS.ACCOUNTING.DASHBOARD' },
  { from: /APP_PERMISSIONS\.ACCOUNTING\.POST_JOURNAL/g, to: 'APP_PERMISSIONS.ACCOUNTING.JOURNAL_WRITE' },
];

const ROOT_DIR = 'd:\\Antigravity\\KitchenOS\\backend\\src';

function walk(dir: string, callback: (filePath: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath, callback);
    } else if (file.endsWith('.ts')) {
      callback(filePath);
    }
  }
}

console.log('--- Starting Global Permission Migration ---');

walk(ROOT_DIR, (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const mapping of REPLACEMENT_MAP) {
    if (mapping.from.test(content)) {
      content = content.replace(mapping.from, mapping.to);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
});

console.log('--- Migration Complete ---');
