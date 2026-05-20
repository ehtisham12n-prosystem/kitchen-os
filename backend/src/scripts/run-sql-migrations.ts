import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';
import '../config/env.config';
import { getDatabaseConfig } from '../config/database.config';

type AppliedMigration = {
  filename: string;
  checksum: string;
};

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let singleQuote = false;
  let doubleQuote = false;
  let backtick = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const previousChar = index > 0 ? sql[index - 1] : '';
    const nextChar = index + 1 < sql.length ? sql[index + 1] : '';

    if (lineComment) {
      current += char;
      if (char === '\n') {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      current += char;
      if (previousChar === '*' && char === '/') {
        blockComment = false;
      }
      continue;
    }

    if (!singleQuote && !doubleQuote && !backtick) {
      if (char === '-' && nextChar === '-') {
        lineComment = true;
        current += char;
        continue;
      }

      if (char === '/' && nextChar === '*') {
        blockComment = true;
        current += char;
        continue;
      }
    }

    if (char === "'" && !doubleQuote && !backtick && previousChar !== '\\') {
      singleQuote = !singleQuote;
    } else if (char === '"' && !singleQuote && !backtick && previousChar !== '\\') {
      doubleQuote = !doubleQuote;
    } else if (char === '`' && !singleQuote && !doubleQuote) {
      backtick = !backtick;
    }

    if (char === ';' && !singleQuote && !doubleQuote && !backtick) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) {
    statements.push(trailing);
  }

  return statements;
}

function stripLeadingComments(statement: string): string {
  return statement.replace(
    /^(?:\s*--.*(?:\r?\n|$)|\s*\/\*[\s\S]*?\*\/\s*)+/,
    '',
  );
}

function splitTopLevelClauses(input: string): string[] {
  const clauses: string[] = [];
  let current = '';
  let depth = 0;
  let singleQuote = false;
  let doubleQuote = false;
  let backtick = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const previousChar = index > 0 ? input[index - 1] : '';

    if (char === "'" && !doubleQuote && !backtick && previousChar !== '\\') {
      singleQuote = !singleQuote;
    } else if (char === '"' && !singleQuote && !backtick && previousChar !== '\\') {
      doubleQuote = !doubleQuote;
    } else if (char === '`' && !singleQuote && !doubleQuote) {
      backtick = !backtick;
    } else if (!singleQuote && !doubleQuote && !backtick) {
      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth = Math.max(0, depth - 1);
      } else if (char === ',' && depth === 0) {
        const trimmed = current.trim();
        if (trimmed) {
          clauses.push(trimmed);
        }
        current = '';
        continue;
      }
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) {
    clauses.push(trailing);
  }

  return clauses;
}

async function columnExists(
  connection: mysql.Connection,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName],
  );

  return Array.isArray(rows) && rows.length > 0;
}

async function indexExists(
  connection: mysql.Connection,
  tableName: string,
  indexName: string,
): Promise<boolean> {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [tableName, indexName],
  );

  return Array.isArray(rows) && rows.length > 0;
}

async function executeCompatibleAlterTable(
  connection: mysql.Connection,
  statement: string,
): Promise<boolean> {
  const normalized = stripLeadingComments(statement);
  const alterMatch = normalized.match(
    /^ALTER\s+TABLE\s+`?([^`\s]+)`?\s+([\s\S]+)$/i,
  );

  if (!alterMatch) {
    return false;
  }

  const [, tableName, rawClauses] = alterMatch;
  if (!/(?:ADD|DROP)\s+(?:COLUMN|KEY|INDEX|UNIQUE\s+KEY)/i.test(rawClauses)) {
    return false;
  }

  const clauses = splitTopLevelClauses(rawClauses);
  if (clauses.length === 0) {
    return false;
  }

  const passthroughClauses: string[] = [];
  let handledCompatibleClause = false;

  const flushPassthroughClauses = async () => {
    if (passthroughClauses.length === 0) {
      return;
    }

    const passthroughStatement = `ALTER TABLE \`${tableName}\` ${passthroughClauses.join(', ')}`;
    passthroughClauses.length = 0;
    await connection.query(passthroughStatement);
  };

  for (const clause of clauses) {
    const addMatch = clause.match(
      /^ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+`?([^`\s]+)`?\s+([\s\S]+)$/i,
    );
    if (addMatch) {
      await flushPassthroughClauses();
      const [, columnName, definition] = addMatch;
      if (!(await columnExists(connection, tableName, columnName))) {
        await connection.query(
          `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`,
        );
      }
      handledCompatibleClause = true;
      continue;
    }

    const dropMatch = clause.match(
      /^DROP\s+COLUMN(?:\s+IF\s+EXISTS)?\s+`?([^`\s]+)`?$/i,
    );
    if (dropMatch) {
      await flushPassthroughClauses();
      const [, columnName] = dropMatch;
      if (await columnExists(connection, tableName, columnName)) {
        await connection.query(
          `ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``,
        );
      }
      handledCompatibleClause = true;
      continue;
    }

    const addIndexMatch = clause.match(
      /^ADD\s+(UNIQUE\s+)?(?:KEY|INDEX)\s+`?([^`\s]+)`?\s*(\([\s\S]+\))$/i,
    );
    if (addIndexMatch) {
      await flushPassthroughClauses();
      const [, uniqueKeyword = '', indexName, definition] = addIndexMatch;
      if (!(await indexExists(connection, tableName, indexName))) {
        const indexKind = uniqueKeyword ? 'ADD UNIQUE KEY' : 'ADD KEY';
        await connection.query(
          `ALTER TABLE \`${tableName}\` ${indexKind} \`${indexName}\` ${definition}`,
        );
      }
      handledCompatibleClause = true;
      continue;
    }

    const dropIndexMatch = clause.match(
      /^DROP\s+(?:KEY|INDEX)(?:\s+IF\s+EXISTS)?\s+`?([^`\s]+)`?$/i,
    );
    if (dropIndexMatch) {
      await flushPassthroughClauses();
      const [, indexName] = dropIndexMatch;
      if (await indexExists(connection, tableName, indexName)) {
        await connection.query(
          `ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``,
        );
      }
      handledCompatibleClause = true;
      continue;
    }

    passthroughClauses.push(clause);
  }

  if (!handledCompatibleClause) {
    return false;
  }

  await flushPassthroughClauses();
  return true;
}

async function executeSqlFile(
  connection: mysql.Connection,
  sql: string,
): Promise<void> {
  const statements = splitSqlStatements(sql);

  for (const statement of statements) {
    const handled = await executeCompatibleAlterTable(connection, statement);
    if (!handled) {
      try {
        await connection.query(statement);
      } catch (error) {
        if (
          error instanceof Error
          && 'code' in error
          && (error as { code?: string }).code === 'ER_TABLE_EXISTS_ERROR'
          && /^\s*CREATE\s+TABLE\b/i.test(stripLeadingComments(statement))
        ) {
          continue;
        }

        throw error;
      }
    }
  }
}

function getMigrationsDirectory(): string {
  return path.resolve(__dirname, '..', 'migrations');
}

function checksumFor(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

async function ensureDatabaseExists(): Promise<void> {
  const config = getDatabaseConfig();
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    multipleStatements: true,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
  } finally {
    await connection.end();
  }
}

async function main() {
  await ensureDatabaseExists();

  const config = getDatabaseConfig();
  const migrationsDirectory = getMigrationsDirectory();
  const filenames = (await fs.readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

  if (filenames.length === 0) {
    console.log('No SQL migrations found.');
    return;
  }

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    multipleStatements: true,
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        checksum CHAR(64) NOT NULL,
        executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_schema_migrations_filename (filename)
      )
    `);

    const [rows] = await connection.query(
      'SELECT filename, checksum FROM schema_migrations ORDER BY filename ASC',
    );
    const appliedByFilename = new Map(
      (rows as AppliedMigration[]).map((row) => [row.filename, row.checksum]),
    );

    let appliedCount = 0;
    let skippedCount = 0;

    for (const filename of filenames) {
      const absolutePath = path.join(migrationsDirectory, filename);
      const sql = await fs.readFile(absolutePath, 'utf8');
      const checksum = checksumFor(sql);
      const existingChecksum = appliedByFilename.get(filename);

      if (existingChecksum) {
        if (existingChecksum !== checksum) {
          throw new Error(
            `Migration checksum mismatch for ${filename}. The file changed after it was already applied.`,
          );
        }
        skippedCount += 1;
        continue;
      }

      console.log(`Applying ${filename}...`);
      await executeSqlFile(connection, sql);
      await connection.execute(
        'INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)',
        [filename, checksum],
      );
      appliedCount += 1;
    }

    console.log(
      `Migration run complete. Applied: ${appliedCount}. Already applied: ${skippedCount}.`,
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('SQL migration run failed.');
  console.error(error);
  process.exit(1);
});
