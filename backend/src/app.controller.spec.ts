import { AppController } from './app.controller';

describe('AppController', () => {
  const appService = {
    getHello: jest.fn().mockReturnValue('KitchenOS API'),
    getLiveness: jest.fn().mockReturnValue({ status: 'ok' }),
    getReadiness: jest.fn().mockReturnValue({ status: 'ready' }),
  };

  const appController = new AppController(appService as any);

  it('returns the root greeting', () => {
    expect(appController.getHello()).toBe('KitchenOS API');
    expect(appService.getHello).toHaveBeenCalledTimes(1);
  });

  it('returns the public liveness probe', () => {
    expect(appController.getLiveness()).toEqual({ status: 'ok' });
    expect(appService.getLiveness).toHaveBeenCalledTimes(1);
  });

  it('returns the public readiness probe', () => {
    expect(appController.getReadiness()).toEqual({ status: 'ready' });
    expect(appService.getReadiness).toHaveBeenCalledTimes(1);
  });
});
