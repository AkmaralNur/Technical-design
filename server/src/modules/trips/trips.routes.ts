import { Router } from 'express';
import { validate } from '../../middleware/validate';
import * as controller from './trips.controller';
import { cancelTripSchema, createTripsSchema, updateScheduleSchema } from './trips.schema';

/** Публичные: /api/trips */
export const publicTripsRoutes = Router();
publicTripsRoutes.get('/search', controller.search);
publicTripsRoutes.get('/:id', controller.getTrip);
publicTripsRoutes.get('/:id/seats', controller.getSeats);

/** Админ: /api/admin/trips */
export const adminTripsRoutes = Router();
adminTripsRoutes.get('/', controller.listAdmin);
adminTripsRoutes.post('/', validate(createTripsSchema), controller.create);
adminTripsRoutes.patch('/:id/schedule', validate(updateScheduleSchema), controller.updateSchedule);
adminTripsRoutes.post('/:id/cancel', validate(cancelTripSchema), controller.cancel);
