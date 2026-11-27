import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.logLevel,
  redact: ['req.headers.cookie', 'req.headers.authorization', 'password', '*.password'],
  transport:
    config.isProd || config.env === 'test'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
});
