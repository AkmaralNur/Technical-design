import type { Request, Response } from 'express';
import { idParam } from '../tickets/tickets.schema';
import * as tripsService from './trips.service';
import { adminTripsQuerySchema, journeySchema, optionalJourneySchema, searchSchema } from './trips.schema';

export async function search(req: Request, res: Response) {
  res.json(await tripsService.search(searchSchema.parse(req.query)));
}

export async function getTrip(req: Request, res: Response) {
  const { from, to } = optionalJourneySchema.parse(req.query);
  res.json(await tripsService.getTrip(idParam.parse(req.params.id), from, to));
}

export async function getSeats(req: Request, res: Response) {
  const { from, to } = journeySchema.parse(req.query);
  res.json(await tripsService.getSeatMap(idParam.parse(req.params.id), from, to));
}

// ---- админ

export async function listAdmin(req: Request, res: Response) {
  res.json(await tripsService.listAdmin(adminTripsQuerySchema.parse(req.query)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await tripsService.createTrips(req.user!.id, req.body));
}

export async function updateSchedule(req: Request, res: Response) {
  res.json(await tripsService.updateSchedule(req.user!.id, idParam.parse(req.params.id), req.body));
}

export async function cancel(req: Request, res: Response) {
  res.json(await tripsService.cancelTrip(req.user!.id, idParam.parse(req.params.id), req.body));
}
