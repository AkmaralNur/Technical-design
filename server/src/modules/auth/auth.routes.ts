import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { MESSAGES } from '../../utils/AppError';
import * as controller from './auth.controller';
import { loginSchema, registerSchema } from './auth.schema';

// Защита от подбора пароля: 10 попыток входа за 15 минут с одного IP (раздел 12.4)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({ error: { code: 'TOO_MANY_REQUESTS', message: MESSAGES.TOO_MANY_REQUESTS, details: null } });
  },
});

const router = Router();
router.post('/register', validate(registerSchema), controller.register);
router.post('/login', loginLimiter, validate(loginSchema), controller.login);
router.post('/logout', controller.logout);
router.get('/me', authenticate, controller.me);

export default router;
