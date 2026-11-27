import { Router } from 'express';
import { validate } from '../../middleware/validate';
import * as controller from './routes.controller';
import { createRouteSchema, setFaresSchema, updateRouteSchema, updateStopsSchema } from './routes.schema';

/** Админ: маршруты, остановки, цены. Подключается к /api/admin/routes */
const router = Router();
router.get('/', controller.list);
router.post('/', validate(createRouteSchema), controller.create);
router.get('/:id', controller.get);
router.patch('/:id', validate(updateRouteSchema), controller.update);
router.put('/:id/stops', validate(updateStopsSchema), controller.updateStops);
router.put('/:id/fares', validate(setFaresSchema), controller.setFares);

export default router;
