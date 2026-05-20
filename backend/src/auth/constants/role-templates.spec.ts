import { APP_PERMISSIONS } from './permissions';
import { DEFAULT_ROLE_TEMPLATES } from './role-templates';

function getTemplate(name: string) {
  const template = DEFAULT_ROLE_TEMPLATES.find((entry) => entry.name === name);
  expect(template).toBeDefined();
  return template!;
}

describe('DEFAULT_ROLE_TEMPLATES', () => {
  it('keeps cashiers out of shift and business-day management controls', () => {
    const cashier = getTemplate('Cashier');

    expect(cashier.permissions).not.toContain(APP_PERMISSIONS.POS.SHIFT_MANAGE);
    expect(cashier.permissions).not.toContain(APP_PERMISSIONS.POS.DAY_MANAGE);
    expect(cashier.permissions).toContain(APP_PERMISSIONS.POS.ORDER_CREATE);
    expect(cashier.permissions).toContain(APP_PERMISSIONS.POS.CASHIER_CONSOLE);
    expect(cashier.permissions).not.toContain(APP_PERMISSIONS.POS.ORDER_CANCEL);
    expect(cashier.permissions).not.toContain(APP_PERMISSIONS.POS.ORDER_RETURN);
  });

  it('gives branch managers explicit return and cancellation authority', () => {
    const branchManager = getTemplate('Branch Manager');

    expect(branchManager.permissions).toContain(APP_PERMISSIONS.POS.ORDER_CANCEL);
    expect(branchManager.permissions).toContain(APP_PERMISSIONS.POS.ORDER_RETURN);
    expect(branchManager.permissions).toContain(APP_PERMISSIONS.POS.TILL_MANAGE);
    expect(branchManager.permissions).toContain(APP_PERMISSIONS.INVENTORY.COUNT_SCHEDULE);
    expect(branchManager.permissions).toContain(APP_PERMISSIONS.INVENTORY.COUNT_REVIEW);
    expect(branchManager.permissions).toContain(APP_PERMISSIONS.INVENTORY.MONTH_CLOSE);
  });

  it('keeps supervisor-level till close authority with branch approvals', () => {
    const supervisor = getTemplate('Supervisor');

    expect(supervisor.permissions).toContain(APP_PERMISSIONS.POS.TILL_MANAGE);
  });

  it('does not grant inventory managers vendor payment approval authority', () => {
    const inventoryManager = getTemplate('Inventory Manager');

    expect(inventoryManager.permissions).toContain(APP_PERMISSIONS.PROCUREMENT.PAYMENTS);
    expect(inventoryManager.permissions).not.toContain(APP_PERMISSIONS.PROCUREMENT.PAYMENTS_APPROVE);
    expect(inventoryManager.permissions).toContain(APP_PERMISSIONS.INVENTORY.LOCATIONS_MANAGE);
    expect(inventoryManager.permissions).toContain(APP_PERMISSIONS.INVENTORY.COUNT_SETTINGS);
  });

  it('gives accountants the read access required for finance review screens', () => {
    const accountant = getTemplate('Accountant');

    expect(accountant.permissions).toContain(APP_PERMISSIONS.ACCOUNTING.DASHBOARD);
    expect(accountant.permissions).toContain(APP_PERMISSIONS.ACCOUNTING.JOURNAL_READ);
    expect(accountant.permissions).toContain(APP_PERMISSIONS.ACCOUNTING.BANKS);
    expect(accountant.permissions).toContain(APP_PERMISSIONS.INVENTORY.READ);
    expect(accountant.permissions).toContain(APP_PERMISSIONS.INVENTORY.COUNT_REPORT);
  });

  it('keeps store managers on execution and reporting instead of reconciliation authority', () => {
    const storeManager = getTemplate('Store Manager');

    expect(storeManager.permissions).toContain(APP_PERMISSIONS.INVENTORY.COUNT_PERFORM);
    expect(storeManager.permissions).toContain(APP_PERMISSIONS.INVENTORY.COUNT_REPORT);
    expect(storeManager.permissions).not.toContain(APP_PERMISSIONS.INVENTORY.COUNT_REVIEW);
  });
});
