import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная окружения ${name} (см. server/.env.example)`);
  return value;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  appTimezone: process.env.APP_TIMEZONE ?? 'Europe/Prague',
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 1025),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
  },
  mailFrom: process.env.MAIL_FROM ?? 'TrainTix <no-reply@traintix.local>',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345',
  pdfFont: process.env.PDF_FONT ?? '',
  emailWorkerEnabled: process.env.EMAIL_WORKER !== 'off',
};
