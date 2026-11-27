import { createApp } from './app';
import { config } from './config';
import { db } from './db/client';
import { startEmailWorker, stopEmailWorker } from './modules/notifications/notifications.service';
import { logger } from './utils/logger';

async function main() {
  await db.$connect();
  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`TrainTix API: http://localhost:${config.port}/api  (сайт в режиме разработки: ${config.corsOrigin})`);
  });
  if (config.emailWorkerEnabled) startEmailWorker();

  const shutdown = async () => {
    logger.info('остановка сервера…');
    stopEmailWorker();
    server.close();
    await db.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'не удалось запустить сервер — проверьте DATABASE_URL в server/.env и что PostgreSQL запущен');
  process.exit(1);
});
