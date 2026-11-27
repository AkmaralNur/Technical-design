import { Router } from 'express';
import { validate } from '../../middleware/validate';
import * as controller from './trains.controller';
import { addCarriageSchema, createTrainSchema, updateCarriageSchema, updateSeatSchema, updateTrainSchema } from './trains.schema';

/** Админ: поезда, вагоны, места. Подключается к /api/admin */
const router = Router();
router.get('/trains', controller.list);
router.post('/trains', validate(createTrainSchema), controller.create);
router.patch('/trains/:id', validate(updateTrainSchema), controller.update);
router.get('/trains/:id/carriages', controller.getCarriages);
router.post('/trains/:id/carriages', validate(addCarriageSchema), controller.addCarriage);
router.patch('/carriages/:id', validate(updateCarriageSchema), controller.updateCarriage);
router.patch('/seats/:id', validate(updateSeatSchema), controller.updateSeat);

export default router;
