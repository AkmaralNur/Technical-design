import 'express-async-errors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { config } from './config';
import { authenticate, requireRole } from './middleware/authenticate';
import { checkOrigin } from './middleware/checkOrigin';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { AppError } from './utils/AppError';
import adminRoutes from './modules/admin/admin.routes';
import authRoutes from './modules/auth/auth.routes';
import { publicStationsRoutes } from './modules/stations/stations.routes';
import ticketsRoutes from './modules/tickets/tickets.routes';
import { publicTripsRoutes } from './modules/trips/trips.routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:'], styleSrc: ["'self'", "'unsafe-inline'"] },
      },
    }),
  );
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => !req.url?.startsWith('/api') },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      serializers: { req: (req) => ({ method: req.method, url: req.url }), res: (res) => ({ statusCode: res.statusCode }) },
    }),
  );

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', checkOrigin);
  app.use('/api/auth', authRoutes);
  app.use('/api/stations', publicStationsRoutes);
  app.use('/api/trips', publicTripsRoutes);
  app.use('/api/tickets', ticketsRoutes);
  app.use('/api/admin', authenticate, requireRole('ADMIN'), adminRoutes);
  app.use('/api', () => {
    throw new AppError(404, 'NOT_FOUND', 'Такого адреса API нет');
  });

  // собранный React-сайт (npm run build) + SPA
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler); // всегда последним
  return app;
}
