import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  const validContacts = [
    {
      contact_type: 'business_primary',
      full_name: 'Business Contact',
      email: 'business@example.com',
      phone: '',
    },
    {
      contact_type: 'billing_primary',
      full_name: 'Billing Contact',
      email: 'billing@example.com',
      phone: '',
    },
    {
      contact_type: 'operations_primary',
      full_name: 'Operations Contact',
      email: 'ops@example.com',
      phone: '',
    },
  ];

  const createSubject = () => {
    const clientRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    const branchRepository = {
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    const contactRepository = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    const statusHistoryRepository = {
      save: jest.fn(),
      create: jest.fn((value) => value),
      find: jest.fn(),
    };
    const planRepository = {
      findOne: jest.fn(),
    };
    const clientSubscriptionRepository = {
      save: jest.fn(),
      create: jest.fn((value) => value),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    const clientSubscriptionHistoryRepository = {
      save: jest.fn(),
      create: jest.fn((value) => value),
      find: jest.fn(),
    };
    const clientOnboardingRepository = {
      findOne: jest.fn(),
    };
    const platformSettingsRepository = {
      findOne: jest.fn(),
    };
    const blueprintRepository = {
      findOne: jest.fn(),
    };
    const userRepository = {
      count: jest.fn(),
      findOne: jest.fn(),
    };
    const userBranchRoleRepository = {
      createQueryBuilder: jest.fn(),
    };
    const auditService = {
      getEntityHistory: jest.fn(),
    };
    const operationalAuditService = {
      log: jest.fn(),
    };
    const rolesService = {
      ensureDefaultRoles: jest.fn(),
      findAll: jest.fn(),
    };
    const usersService = {
      create: jest.fn(),
      update: jest.fn(),
    };

    const manager = {
      create: jest.fn((_entity, value) => value),
      save: jest.fn(),
      getRepository: jest.fn((entity) => {
        if (entity?.name === 'Branch') {
          return branchRepository;
        }
        return contactRepository;
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (callback: any) => callback(manager)),
    };

    const service = new ClientsService(
      clientRepository as any,
      branchRepository as any,
      contactRepository as any,
      statusHistoryRepository as any,
      planRepository as any,
      clientSubscriptionRepository as any,
      clientSubscriptionHistoryRepository as any,
      clientOnboardingRepository as any,
      platformSettingsRepository as any,
      blueprintRepository as any,
      userRepository as any,
      userBranchRoleRepository as any,
      auditService as any,
      operationalAuditService as any,
      rolesService as any,
      usersService as any,
      dataSource as any,
    );

    return {
      service,
      manager,
      dataSource,
      clientRepository,
      branchRepository,
      contactRepository,
      operationalAuditService,
      rolesService,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates the first branch during client creation', async () => {
    const {
      service,
      manager,
      clientRepository,
      branchRepository,
      rolesService,
      operationalAuditService,
    } = createSubject();

    clientRepository.findOne.mockResolvedValue(null);
    manager.save.mockImplementation(async (entity: any, value?: any) => {
      if (entity?.name === 'Client') {
        return {
          id: 'CL-10001',
          client_code: 'TEN-10001',
          client_name: value.client_name,
          domain_slug: value.domain_slug,
          address: value.address,
          city: value.city,
          country: value.country,
          phone: value.phone,
          email: value.email,
          currency: value.currency,
          language: value.language,
          status: value.status,
        };
      }
      return value;
    });

    jest.spyOn(service as any, 'generateIdentifiers').mockResolvedValue({
      id: 'CL-10001',
      clientCode: 'TEN-10001',
    });
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 'CL-10001',
      client_name: 'Bonfire',
    } as any);

    await service.create({
      client_name: 'Bonfire',
      legal_name: 'Bonfire Foods LLC',
      short_name: 'Bonfire',
      domain_slug: 'bonfire',
      contacts: validContacts as any,
      initial_branch: {
        branch_name: 'Main Branch',
        address: 'Street 1',
        city: 'Karachi',
        country: 'Pakistan',
        opening_time: '09:00',
        closing_time: '23:00',
      },
    } as any, {
      sub: '1',
    } as any);

    expect(branchRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'TEN-10001',
        branch_name: 'Main Branch',
        address: 'Street 1',
        city: 'Karachi',
        country: 'Pakistan',
        opening_time: '09:00:00',
        closing_time: '23:00:00',
        status: 'setup_pending',
      }),
    );
    expect(rolesService.ensureDefaultRoles).toHaveBeenCalledWith('TEN-10001');
    expect(operationalAuditService.log).toHaveBeenCalled();
  });

  it('updates the first branch from the edit client flow', async () => {
    const {
      service,
      clientRepository,
      branchRepository,
      operationalAuditService,
    } = createSubject();

    const client = {
      id: 'CL-10001',
      client_code: 'TEN-10001',
      client_name: 'Bonfire',
      legal_name: 'Bonfire Foods LLC',
      short_name: 'Bonfire',
      business_type: 'restaurant',
      address: 'Old Address',
      area: null,
      city: 'Karachi',
      country: 'Pakistan',
      phone: '123',
      email: 'client@example.com',
      cell_phone: null,
      website_url: null,
      currency: 'USD',
      language: 'en',
      timezone: 'UTC',
      comments: null,
      renewal_day: null,
      renewal_date: null,
      grace_period_days: 0,
      onboarding_blueprint: null,
      contacts: [],
      branches: [{ id: 7 }],
    };
    const existingBranch = {
      id: 7,
      client_id: 'TEN-10001',
      branch_name: 'Old Branch',
      short_name: 'Old',
      address: 'Old Address',
      city: 'Karachi',
      state: null,
      country: 'Pakistan',
      contact_person: null,
      phone: '123',
      email: 'old-branch@example.com',
      opening_time: '08:00:00',
      closing_time: '22:00:00',
      modules_enabled: [],
      updated_by: null,
    };

    clientRepository.findOne.mockResolvedValue(client);
    clientRepository.save.mockResolvedValue(client);
    branchRepository.findOne.mockResolvedValue(existingBranch);
    branchRepository.save.mockImplementation(async (value) => value);
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 'CL-10001',
      client_name: 'Bonfire',
    } as any);

    await service.update('CL-10001', {
      initial_branch: {
        branch_name: 'Main Branch',
        short_name: 'Main',
        address: 'New Address',
        city: 'Lahore',
        country: 'Pakistan',
        phone: '555',
        email: 'main@example.com',
        opening_time: '10:00',
        closing_time: '23:30',
      },
    } as any, {
      sub: '1',
    } as any);

    expect(branchRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        branch_name: 'Main Branch',
        short_name: 'Main',
        address: 'New Address',
        city: 'Lahore',
        country: 'Pakistan',
        phone: '555',
        email: 'main@example.com',
        opening_time: '10:00:00',
        closing_time: '23:30:00',
      }),
    );
    expect(operationalAuditService.log).not.toHaveBeenCalled();
  });

  it('creates the first branch from the edit client flow when none exists', async () => {
    const {
      service,
      clientRepository,
      branchRepository,
    } = createSubject();

    const client = {
      id: 'CL-10001',
      client_code: 'TEN-10001',
      client_name: 'Bonfire',
      legal_name: 'Bonfire Foods LLC',
      short_name: 'Bonfire',
      business_type: 'restaurant',
      address: 'Client Address',
      area: null,
      city: 'Karachi',
      country: 'Pakistan',
      phone: '123',
      email: 'client@example.com',
      cell_phone: null,
      website_url: null,
      currency: 'USD',
      language: 'en',
      timezone: 'UTC',
      comments: null,
      renewal_day: null,
      renewal_date: null,
      grace_period_days: 0,
      onboarding_blueprint: null,
      enabled_modules: ['catalog'],
      contacts: [],
      branches: [],
    };

    clientRepository.findOne.mockResolvedValue(client);
    clientRepository.save.mockResolvedValue(client);
    branchRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    branchRepository.save.mockImplementation(async (value) => value);
    jest.spyOn(service, 'findOne').mockResolvedValue({
      id: 'CL-10001',
      client_name: 'Bonfire',
    } as any);

    await service.update('CL-10001', {
      initial_branch: {
        branch_name: 'Starter Branch',
        address: 'Street 1',
        city: 'Karachi',
        country: 'Pakistan',
      },
    } as any, {
      sub: '1',
    } as any);

    expect(branchRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'TEN-10001',
        branch_code: 'BR001',
        branch_name: 'Starter Branch',
        modules_enabled: ['catalog'],
      }),
    );
  });
});
