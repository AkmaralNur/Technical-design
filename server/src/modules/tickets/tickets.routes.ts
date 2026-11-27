import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import * as controller from './tickets.controller';
import { bookTicketSchema } from './tickets.schema';

const router = Router();
router.use(authenticate); // все адреса только для вошедших

router.post('/', requireRole('PASSENGER'), validate(bookTicketSchema), controller.book);
router.get('/', controller.listMine);
router.get('/:id', controller.getMine);
router.post('/:id/cancel', controller.cancel);
router.get('/:id/pdf', controller.pdf); // владелец или админ

export default router;
