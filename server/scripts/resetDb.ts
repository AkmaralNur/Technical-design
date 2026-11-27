/**
 * ТОЛЬКО ДЛЯ ЛОКАЛЬНОЙ РАЗРАБОТКИ: удаляет базу из DATABASE_URL, создаёт заново,
 * применяет миграции и заполняет тестовыми данными.
 * Запуск: npm run db:reset
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import { Client } from 'pg';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('db:reset запрещён в production');
  const url = new URL(process.env.DATABASE_URL ?? '');
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error(`Недопустимое имя базы: ${dbName}`);
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${dbName}" ENCODING 'UTF8'`);
  await client.end();
  console.log(`✔ База "${dbName}" пересоздана`);
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
}

main().catch((e) => {
  console.error('✘', e.message);
  process.exit(1);
});
