// Valida a migração sobre o schema anterior com dados isolados, sem reset.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL ?? '';
if (
  !new URL(connectionString).pathname
    .slice(1)
    .startsWith('taskflow_etapa06_migration_test')
)
  throw new Error(
    'Use um banco NOVO e vazio taskflow_etapa06_migration_test*.',
  );
const client = new pg.Client({ connectionString });
const server = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(
  new URL('../node_modules/prisma/build/index.js', import.meta.url),
);
const prefix = `migration06-${randomUUID()}`;
const userId = `${prefix}-user`,
  workspaceId = `${prefix}-workspace`,
  boardId = `${prefix}-board`;
function prisma(...args) {
  const result = spawnSync(
    process.execPath,
    [cli, ...args, '--config', 'prisma7.config.ts'],
    { cwd: server, env: process.env, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  process.stdout.write(result.stdout);
}
async function snapshot() {
  const result = {};
  for (const table of [
    'User',
    'Session',
    'Workspace',
    'WorkspaceMember',
    'Board',
    'BoardColumn',
    'Task',
  ]) {
    // Nomes vêm desta lista fixa; valores são sempre parâmetros.
    const rows = await client.query(
      `SELECT to_jsonb(t) - 'status' AS record FROM "${table}" t WHERE id LIKE $1 ORDER BY id`,
      [`${prefix}%`],
    );
    result[table] = rows.rows.map((row) => row.record);
  }
  return result;
}
await client.connect();
let prepared = false;
try {
  const tables = await client.query(
    "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'",
  );
  assert.equal(
    tables.rows[0].count,
    0,
    'O banco de migração precisa estar vazio. Não remova tabelas; crie outro banco isolado.',
  );
  for (const name of [
    '20261110021932_init',
    '20261110060000_add_auth_sessions',
  ]) {
    await client.query(
      await readFile(
        new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url),
        'utf8',
      ),
    );
    prisma('migrate', 'resolve', '--applied', name);
  }
  await client.query(
    'INSERT INTO "User" (id, name, email, "passwordHash", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())',
    [
      userId,
      'Fixture de migração',
      `${prefix}@example.invalid`,
      'unused-isolated-fixture',
    ],
  );
  prepared = true;
  await client.query(
    'INSERT INTO "Session" (id, "userId", "tokenHash", "expiresAt") VALUES ($1, $2, $3, NOW() + interval \'7 days\')',
    [`${prefix}-session`, userId, `${prefix}-token-hash`],
  );
  await client.query(
    'INSERT INTO "Workspace" (id, name, "updatedAt") VALUES ($1, $2, NOW())',
    [workspaceId, 'Workspace anterior'],
  );
  await client.query(
    'INSERT INTO "WorkspaceMember" (id, "userId", "workspaceId", role) VALUES ($1, $2, $3, $4)',
    [`${prefix}-member`, userId, workspaceId, 'OWNER'],
  );
  await client.query(
    'INSERT INTO "Board" (id, name, "workspaceId", "updatedAt") VALUES ($1, $2, $3, NOW())',
    [boardId, 'Quadro anterior', workspaceId],
  );
  for (const position of [0, 1, 2]) {
    const columnId = `${prefix}-column-${position}`;
    await client.query(
      'INSERT INTO "BoardColumn" (id, name, position, "boardId") VALUES ($1, $2, $3, $4)',
      [columnId, `Nome independente ${position}`, position, boardId],
    );
    await client.query(
      'INSERT INTO "Task" (id, title, description, position, "columnId", "creatorId", "assigneeId", "dueAt", "updatedAt") VALUES ($1, $2, $3, 0, $4, $5, $5, $6, NOW())',
      [
        `${prefix}-task-${position}`,
        `Tarefa anterior ${position}`,
        'Texto preservado',
        columnId,
        userId,
        '2026-11-20T00:00:00.000Z',
      ],
    );
  }
  const before = await snapshot();
  prisma('migrate', 'deploy');
  const after = await snapshot();
  assert.deepEqual(
    after,
    before,
    'Todos os valores anteriores devem permanecer iguais.',
  );
  const columns = await client.query(
    'SELECT status FROM "BoardColumn" WHERE "boardId" = $1 ORDER BY position',
    [boardId],
  );
  assert.deepEqual(
    columns.rows.map((row) => row.status),
    ['TODO', 'IN_PROGRESS', 'DONE'],
  );
  const tasks = await client.query(
    'SELECT c.status FROM "Task" t JOIN "BoardColumn" c ON c.id = t."columnId" WHERE c."boardId" = $1 ORDER BY c.position',
    [boardId],
  );
  assert.deepEqual(
    tasks.rows.map((row) => row.status),
    ['TODO', 'IN_PROGRESS', 'DONE'],
  );
  console.log(
    'PASS migração incremental: 3 tarefas e registros relacionados preservados, com status preenchido pela regra anterior.',
  );
  prisma('migrate', 'status');
} finally {
  if (prepared) {
    await client.query('DELETE FROM "Workspace" WHERE id = $1', [workspaceId]);
    await client.query('DELETE FROM "User" WHERE id = $1', [userId]);
  }
  await client.end();
}
