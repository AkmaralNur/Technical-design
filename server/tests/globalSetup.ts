import 'dotenv/config';
import { execSync } from 'child_process';
import { Client } from 'pg';

/** Пересоздаёт тестовую базу traintix_test и применяет миграции */
export default async function setup() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  url.pathname = '/traintix_test';
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  await client.query('DROP DATABASE IF EXISTS traintix_test WITH (FORCE)');
  await client.query(`CREATE DATABASE traintix_test ENCODING 'UTF8'`);
  await client.end();
  execSync('npx prisma migrate deploy', { stdio: 'ignore', env: { ...process.env, DATABASE_URL: url.toString() } });
}
