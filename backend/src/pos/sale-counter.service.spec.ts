import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SaleCounterService } from './sale-counter.service';

describe('SaleCounterService', () => {
  const saleCounterRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };
  const branchRepo = {
    findOne: jest.fn(),
  };

  let service: SaleCounterService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SaleCounterService(saleCounterRepo as any, branchRepo as any);
  });

  it('creates a sale counter within the resolved client branch', async () => {
    const payload = {
      name: 'Main Counter',
      code: 'KC-MAIN-01',
      branch_id: 5,
    };
    branchRepo.findOne.mockResolvedValue({ id: 5, client_id: 'CL-10001' });
    saleCounterRepo.create.mockImplementation((value) => value);
    saleCounterRepo.save.mockImplementation(async (value) => ({ id: 11, ...value }));

    await expect(service.create(payload as any, 'CL-10001')).resolves.toEqual(
      expect.objectContaining({
        id: 11,
        name: 'Main Counter',
        code: 'KC-MAIN-01',
        branch_id: 5,
        client_id: 'CL-10001',
      }),
    );

    expect(saleCounterRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'CL-10001',
        branch_id: 5,
      }),
    );
  });

  it('loads sale counters for an explicitly selected branch', async () => {
    branchRepo.findOne.mockResolvedValue({ id: 5, client_id: 'CL-10001' });
    saleCounterRepo.find.mockResolvedValue([{ id: 11, branch_id: 5 }]);

    await expect(service.findAll('CL-10001', 5)).resolves.toEqual([{ id: 11, branch_id: 5 }]);

    expect(saleCounterRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({
        client_id: 'CL-10001',
        branch_id: 5,
      }),
    });
  });

  it('blocks access to a sale counter outside the permitted branches', async () => {
    saleCounterRepo.findOne.mockResolvedValue({
      id: 11,
      client_id: 'CL-10001',
      branch_id: 8,
    });

    await expect(service.findOne(11, 'CL-10001', [5])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects duplicate counter codes within the same branch', async () => {
    const payload = {
      name: 'Main Counter',
      code: 'counter_1',
      branch_id: 5,
    };
    branchRepo.findOne.mockResolvedValue({ id: 5, client_id: 'CL-10001' });
    saleCounterRepo.findOne.mockResolvedValueOnce({
      id: 11,
      client_id: 'CL-10001',
      branch_id: 5,
      code: 'COUNTER_1',
    });

    await expect(service.create(payload as any, 'CL-10001')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
