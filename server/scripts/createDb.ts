/**
 * Создаёт базу данных из DATABASE_URL, если её ещё нет.
 * Запуск: npm run db:create
 */
import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error(`Недопустимое имя базы: ${dbName}`);

  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount) {
    console.log(`✔ База "${dbName}" уже существует`);
  } else {
    await client.query(`CREATE DATABASE "${dbName}" ENCODING 'UTF8'`);
    console.log(`✔ База "${dbName}" создана`);
  }
  await client.end();
}

main().catch((e) => {
  console.error('✘ Не удалось создать базу:', e.message);
  console.error('  Проверьте DATABASE_URL в server/.env (пользователь, пароль, порт) и что служба PostgreSQL запущена.');
  process.exit(1);
});
