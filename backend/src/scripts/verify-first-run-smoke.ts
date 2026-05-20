import * as mysql from 'mysql2/promise';
import '../config/env.config';
import { getDatabaseConfig } from '../config/database.config';
import { getNumberEnv, getOptionalEnv, getRequiredEnv } from '../config/env.config';

type CountRow = { total: number };
type ClientRow = { id: string; client_code: string; domain_slug: string };
type UserRow = { id: number; user_name: string; client_id: string; user_type: string };

function buildApiBaseUrl(): string {
  const configured = getOptionalEnv('SMOKE_API_BASE_URL');
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  return `http://127.0.0.1:${getNumberEnv('PORT', 3000)}/v1`;
}

async function requireCount(
  connection: mysql.Connection,
  sql: string,
  params: unknown[] = [],
): Promise<number> {
  const [rows] = await connection.query(sql, params);
  const row = (rows as CountRow[])[0];
  return Number(row?.total ?? 0);
}

async function main() {
  const apiBaseUrl = buildApiBaseUrl();
  const db = getDatabaseConfig();
  const superAdminUsername = getRequiredEnv('BOOTSTRAP_SUPER_ADMIN_USERNAME');
  const superAdminPassword = getRequiredEnv('BOOTSTRAP_SUPER_ADMIN_PASSWORD');
  const clientSlug = getOptionalEnv('BOOTSTRAP_CLIENT_SLUG');
  const clientAdminUsername = getOptionalEnv('BOOTSTRAP_CLIENT_ADMIN_USERNAME');

  const connection = await mysql.createConnection({
    host: db.host,
    port: db.port,
    user: db.username,
    password: db.password,
    database: db.database,
  });

  try {
    const schemaMigrationCount = await requireCount(
      connection,
      'SELECT COUNT(*) AS total FROM schema_migrations',
    );
    if (schemaMigrationCount <= 0) {
      throw new Error('schema_migrations is empty. SQL migration run was not verified.');
    }

    const [platformClients] = await connection.query(
      'SELECT id, client_code, client_domain_slug AS domain_slug FROM clients WHERE id = ? LIMIT 1',
      ['NX-10101'],
    );
    const nexusClient = (platformClients as ClientRow[])[0];
    if (!nexusClient) {
      throw new Error('NX-10101 was not found in clients after bootstrap.');
    }

    const [platformAdmins] = await connection.query(
      'SELECT id, user_name, client_id, user_type FROM users WHERE user_name = ? LIMIT 1',
      [superAdminUsername],
    );
    const superAdmin = (platformAdmins as UserRow[])[0];
    if (!superAdmin || superAdmin.client_id !== 'NX-10101') {
      throw new Error(
        `Super admin ${superAdminUsername} was not found under NX-10101 after bootstrap.`,
      );
    }

    let clientSummary:
      | {
          client: ClientRow;
          clientAdmin?: UserRow;
        }
      | undefined;

    if (clientSlug) {
      const [clients] = await connection.query(
        'SELECT id, client_code, client_domain_slug AS domain_slug FROM clients WHERE client_domain_slug = ? LIMIT 1',
        [clientSlug],
      );
      const client = (clients as ClientRow[])[0];
      if (!client) {
        throw new Error(`Bootstrap client ${clientSlug} was not found after bootstrap.`);
      }

      let clientAdmin: UserRow | undefined;
      if (clientAdminUsername) {
        const [clientAdmins] = await connection.query(
          'SELECT id, user_name, client_id, user_type FROM users WHERE user_name = ? LIMIT 1',
          [clientAdminUsername],
        );
        clientAdmin = (clientAdmins as UserRow[])[0];
        if (!clientAdmin || clientAdmin.client_id !== client.id) {
          throw new Error(
            `Bootstrap client admin ${clientAdminUsername} was not found under ${client.id}.`,
          );
        }
      }

      clientSummary = { client, clientAdmin };
    }

    const loginResponse = await fetch(`${apiBaseUrl}/auth/system-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: superAdminUsername,
        password: superAdminPassword,
      }),
    });

    if (!loginResponse.ok) {
      throw new Error(
        `System login failed with status ${loginResponse.status}: ${await loginResponse.text()}`,
      );
    }

    const loginBody = (await loginResponse.json()) as {
      access_token?: string;
      user_context?: { client_id?: string; username?: string };
    };
    if (!loginBody.access_token || loginBody.user_context?.client_id !== 'NX-10101') {
      throw new Error('System login succeeded but returned an unexpected bootstrap user context.');
    }

    const meResponse = await fetch(`${apiBaseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${loginBody.access_token}`,
      },
    });

    if (!meResponse.ok) {
      throw new Error(
        `Auth me verification failed with status ${meResponse.status}: ${await meResponse.text()}`,
      );
    }

    const meBody = await meResponse.json();

    console.log(
      JSON.stringify(
        {
          database: db.database,
          schema_migrations: schemaMigrationCount,
          nexus_client: nexusClient,
          super_admin: superAdmin,
          bootstrap_client: clientSummary ?? null,
          login_verified: {
            api_base_url: apiBaseUrl,
            username: loginBody.user_context?.username,
            client_id: loginBody.user_context?.client_id,
            me_user_context_present: Boolean(meBody?.user_context),
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('First-run smoke verification failed.');
  console.error(error);
  process.exit(1);
});
