import * as mysql from 'mysql2/promise';
import '../config/env.config';
import { getDatabaseConfig } from '../config/database.config';
import { SYSTEM_PERMISSION_REGISTRY, normalizePermissionKey } from '../auth/constants/permissions';
import { DEFAULT_ROLE_TEMPLATES } from '../auth/constants/role-templates';

type ClientRow = mysql.RowDataPacket & {
    id: number;
    client_code: string;
    client_name: string;
    status: string;
};

type RoleRow = mysql.RowDataPacket & {
    id: number;
    client_id: string;
    role_name: string;
    name: string | null;
    description: string | null;
    context_scope: string | null;
    approval_authority: string | null;
    permissions: string | null;
    is_system_role: number;
    is_active: number;
};

type PermissionRow = mysql.RowDataPacket & {
    id: number;
    key: string;
};

function normalizePermissionList(permissionKeys: string[]): string[] {
    return Array.from(
        new Set(
            permissionKeys
                .map((permission) => normalizePermissionKey(permission))
                .filter(Boolean),
        ),
    );
}

function parsePermissions(value: string | null): string[] {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? normalizePermissionList(parsed) : [];
    } catch {
        return [];
    }
}

async function ensurePermissions(connection: mysql.Connection): Promise<Map<string, number>> {
    const normalizedRegistry = SYSTEM_PERMISSION_REGISTRY.map((permission) => ({
        ...permission,
        key: normalizePermissionKey(permission.key),
    }));

    const [existingRows] = await connection.query<PermissionRow[]>('SELECT id, `key` FROM permissions');
    const existingMap = new Map(existingRows.map((permission) => [normalizePermissionKey(permission.key), permission.id]));

    for (const permission of normalizedRegistry) {
        if (existingMap.has(permission.key)) {
            continue;
        }

        const [result] = await connection.execute<mysql.ResultSetHeader>(
            'INSERT INTO permissions (`key`, module, action, scope) VALUES (?, ?, ?, ?)',
            [permission.key, permission.module, permission.action, permission.scope],
        );
        existingMap.set(permission.key, Number(result.insertId));
    }

    return existingMap;
}

async function syncRolePermissionLinks(
    connection: mysql.Connection,
    roleId: number,
    permissions: string[],
    permissionMap: Map<string, number>,
): Promise<void> {
    await connection.execute('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

    const permissionIds = permissions
        .filter((permission) => permission !== 'all')
        .map((permission) => permissionMap.get(permission))
        .filter((permissionId): permissionId is number => typeof permissionId === 'number');

    for (const permissionId of permissionIds) {
        await connection.execute(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
            [roleId, permissionId],
        );
    }
}

async function syncClientRoles(
    connection: mysql.Connection,
    client: ClientRow,
    permissionMap: Map<string, number>,
): Promise<void> {
    const [roleRows] = await connection.query<RoleRow[]>(
        `SELECT id, client_id, role_name, name, description, context_scope, approval_authority, permissions, is_system_role, is_active
         FROM roles
         WHERE client_id = ?`,
        [client.client_code],
    );

    const existingByName = new Map(roleRows.map((role) => [role.role_name, role]));

    for (const template of DEFAULT_ROLE_TEMPLATES) {
        const normalizedPermissions = normalizePermissionList(template.permissions);
        const existingRole = existingByName.get(template.name);

        if (!existingRole) {
            const [insertResult] = await connection.execute<mysql.ResultSetHeader>(
                `INSERT INTO roles (
                    client_id,
                    role_name,
                    name,
                    description,
                    context_scope,
                    approval_authority,
                    permissions,
                    is_system_role,
                    is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    client.client_code,
                    template.name,
                    template.name,
                    template.description ?? null,
                    template.contextScope,
                    template.approvalAuthority,
                    JSON.stringify(normalizedPermissions),
                    1,
                    1,
                ],
            );

            const roleId = Number(insertResult.insertId);
            await syncRolePermissionLinks(connection, roleId, normalizedPermissions, permissionMap);
            continue;
        }

        if (Boolean(existingRole.is_system_role)) {
            await connection.execute(
                `UPDATE roles
                 SET name = ?,
                     description = ?,
                     context_scope = ?,
                     approval_authority = ?,
                     permissions = ?,
                     is_active = 1
                 WHERE id = ?`,
                [
                    existingRole.name || existingRole.role_name,
                    template.description ?? existingRole.description,
                    template.contextScope,
                    template.approvalAuthority,
                    JSON.stringify(normalizedPermissions),
                    existingRole.id,
                ],
            );
        }
    }

    const [syncedRoles] = await connection.query<RoleRow[]>(
        `SELECT id, permissions
         FROM roles
         WHERE client_id = ?
           AND is_active = 1`,
        [client.client_code],
    );

    for (const role of syncedRoles) {
        const permissions = parsePermissions(role.permissions);
        await syncRolePermissionLinks(connection, role.id, permissions, permissionMap);
    }
}

async function bootstrap() {
    const db = getDatabaseConfig();
    const connection = await mysql.createConnection({
        host: db.host,
        port: db.port,
        user: db.username,
        password: db.password,
        database: db.database,
    });

    try {
        const permissionMap = await ensurePermissions(connection);
        const [clients] = await connection.query<ClientRow[]>(
            'SELECT id, client_code, client_name, client_status AS status FROM clients ORDER BY id ASC',
        );

        console.log(`--- Starting default role sync for ${clients.length} client(s) ---`);

        const synced: string[] = [];
        const failed: Array<{ client_code: string; error: string }> = [];

        for (const client of clients) {
            try {
                await connection.beginTransaction();
                await syncClientRoles(connection, client, permissionMap);
                await connection.commit();
                synced.push(client.client_code);
                console.log(`Synced roles for ${client.client_code} (${client.client_name})`);
            } catch (error) {
                await connection.rollback();
                const message = error instanceof Error ? error.message : String(error);
                failed.push({ client_code: client.client_code, error: message });
                console.error(`Role sync failed for ${client.client_code}: ${message}`);
            }
        }

        console.log('--- Default role sync complete ---');
        console.log(JSON.stringify({
            total_clients: clients.length,
            synced_clients: synced.length,
            failed_clients: failed.length,
            failures: failed,
        }, null, 2));

        if (failed.length > 0) {
            process.exitCode = 1;
        }
    } finally {
        await connection.end();
    }
}

bootstrap().catch((error) => {
    console.error('Default client role sync failed.');
    console.error(error);
    process.exit(1);
});
