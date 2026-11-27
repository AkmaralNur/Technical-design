import { Router } from 'express';
import { validate } from '../../middleware/validate';
import * as controller from './stations.controller';
import { createStationSchema, updateStationSchema } from './stations.schema';

/** Публичный: GET /api/stations */
export const publicStationsRoutes = Router();
publicStationsRoutes.get('/', controller.listActive);

/** Админ: /api/admin/stations */
export const adminStationsRoutes = Router();
adminStationsRoutes.get('/', controller.listAll);
adminStationsRoutes.post('/', validate(createStationSchema), controller.create);
adminStationsRoutes.patch('/:id', validate(updateStationSchema), controller.update);
