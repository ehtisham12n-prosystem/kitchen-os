import { PlatformBootstrapService } from './platform-bootstrap.service';

describe('PlatformBootstrapService', () => {
  const createSubject = () =>
    Reflect.construct(
      PlatformBootstrapService,
      Array.from({ length: 32 }, () => ({})),
    ) as PlatformBootstrapService;

  it('runs deterministic first-run bootstrap with super admin, client, and starter data', async () => {
    const service = createSubject();
    const superAdmin = {
      id: 1,
      user_name: 'root',
      email: 'root@kitchenos.local',
      __bootstrap_created: true,
    };
    const clientResult = {
      client: {
        id: 'CL-10001',
        client_code: 'KC',
        domain_slug: 'kitchen-club',
      },
      created: true,
      admin: {
        id: 2,
        user_name: 'kitchenclub.admin',
        email: 'admin@kitchenclub.local',
      },
      adminCreated: true,
      subscription: {
        id: 99,
        plan_code_snapshot: 'BASIC',
        status: 'active',
      },
      subscriptionCreated: true,
    };
    const starterData = {
      profile: 'kitchen-club',
      branch_created: true,
      catalog_seeded: true,
    };

    jest.spyOn(service as any, 'ensureCorePlatformData').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'ensureSuperAdmin').mockResolvedValue(superAdmin);
    jest.spyOn(service as any, 'ensureClient').mockResolvedValue(clientResult);
    const starterSpy = jest
      .spyOn(service as any, 'ensureClientStarterData')
      .mockResolvedValue(starterData);

    const result = await service.run({
      superAdmin: {
        fullName: 'Platform Root',
        username: 'root',
        email: 'root@kitchenos.local',
        password: 'secret',
      },
      client: {
        clientId: 'CL-10001',
        clientCode: 'KC',
        clientName: 'Kitchen Club',
        domainSlug: 'kitchen-club',
        planCode: 'BASIC',
        starterProfile: 'kitchen-club',
        admin: {
          fullName: 'Kitchen Club Admin',
          username: 'kitchenclub.admin',
          email: 'admin@kitchenclub.local',
          password: 'secret',
        },
      },
    });

    expect(result).toEqual({
      nexus_client_id: 'NX-10101',
      super_admin: {
        id: 1,
        username: 'root',
        email: 'root@kitchenos.local',
        created: true,
      },
      client: {
        id: 'CL-10001',
        client_code: 'KC',
        domain_slug: 'kitchen-club',
        created: true,
        admin: {
          id: 2,
          username: 'kitchenclub.admin',
          email: 'admin@kitchenclub.local',
          created: true,
        },
        subscription: {
          id: 99,
          plan_code: 'BASIC',
          status: 'active',
          created: true,
        },
        starter_data: starterData,
      },
    });
    expect(starterSpy).toHaveBeenCalledWith(
      clientResult.client,
      expect.objectContaining({ starterProfile: 'kitchen-club' }),
      1,
    );
  });

  it('supports bootstrap runs that create only the first super admin', async () => {
    const service = createSubject();

    jest.spyOn(service as any, 'ensureCorePlatformData').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'ensureSuperAdmin').mockResolvedValue({
      id: 1,
      user_name: 'root',
      email: 'root@kitchenos.local',
      __bootstrap_created: false,
    });
    const ensureClientSpy = jest.spyOn(service as any, 'ensureClient');
    const starterSpy = jest.spyOn(service as any, 'ensureClientStarterData');

    const result = await service.run({
      superAdmin: {
        fullName: 'Platform Root',
        username: 'root',
        email: 'root@kitchenos.local',
        password: 'secret',
      },
    });

    expect(result.client).toBeNull();
    expect(ensureClientSpy).not.toHaveBeenCalled();
    expect(starterSpy).not.toHaveBeenCalled();
  });
});
