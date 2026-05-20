import 'reflect-metadata';
import { APP_PERMISSIONS } from '../auth/constants/permissions';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { PosController } from './pos.controller';

function readPermissions(methodName: keyof PosController) {
  return Reflect.getMetadata(PERMISSIONS_KEY, PosController.prototype[methodName]);
}

describe('PosController permission metadata', () => {
  it('uses branch-day permission for starting the business day', () => {
    expect(readPermissions('startBusinessDay')).toEqual([APP_PERMISSIONS.POS.DAY_MANAGE]);
  });

  it('uses till-management permission for manager-led till controls', () => {
    expect(readPermissions('reconcileTill')).toEqual([APP_PERMISSIONS.POS.TILL_MANAGE]);
    expect(readPermissions('reassignTill')).toEqual([APP_PERMISSIONS.POS.TILL_MANAGE]);
    expect(readPermissions('authorizeTill')).toEqual([APP_PERMISSIONS.POS.TILL_MANAGE]);
  });

  it('uses cashier POS permissions for counter closing endpoints', () => {
    expect(readPermissions('blindCloseCounterSession')).toEqual([APP_PERMISSIONS.POS.ORDER_CREATE]);
    expect(readPermissions('submitBlindCount')).toEqual([APP_PERMISSIONS.POS.ORDER_CREATE]);
  });

  it('uses exception-control permissions for cancellation and sales returns', () => {
    expect(readPermissions('cancelOrder')).toEqual([APP_PERMISSIONS.POS.ORDER_CANCEL]);
    expect(readPermissions('returnOrder')).toEqual([APP_PERMISSIONS.POS.ORDER_RETURN]);
  });
});
