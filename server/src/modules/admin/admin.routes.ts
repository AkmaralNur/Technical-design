import { Router } from 'express';
import { adminStationsRoutes } from '../stations/stations.routes';
import trainsRoutes from '../trains/trains.routes';
import routesRoutes from '../routes/routes.routes';
import { adminTripsRoutes } from '../trips/trips.routes';
import * as controller from './admin.controller';

/** Все адреса /api/admin/* — только для ADMIN (проверка подключена в app.ts) */
const router = Router();
router.get('/stats', controller.stats);
router.get('/audit', controller.auditLog);
router.use('/stations', adminStationsRoutes);
router.use('/', trainsRoutes); // /trains, /carriages, /seats
router.use('/routes', routesRoutes);
router.use('/trips', adminTripsRoutes);
router.get('/tickets/export', controller.exportTickets);
router.get('/tickets', controller.listTickets);

export default router;
