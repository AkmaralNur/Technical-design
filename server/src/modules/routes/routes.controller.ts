import type { Request, Response } from 'express';
import { idParam } from '../tickets/tickets.schema';
import * as routesService from './routes.service';

export async function list(_req: Request, res: Response) {
  res.json(await routesService.list());
}

export async function get(req: Request, res: Response) {
  res.json(await routesService.get(idParam.parse(req.params.id)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await routesService.create(req.user!.id, req.body));
}

export async function update(req: Request, res: Response) {
  res.json(await routesService.update(req.user!.id, idParam.parse(req.params.id), req.body));
}

export async function updateStops(req: Request, res: Response) {
  res.json(await routesService.updateStops(req.user!.id, idParam.parse(req.params.id), req.body.stops));
}

export async function setFares(req: Request, res: Response) {
  res.json(await routesService.setFares(req.user!.id, idParam.parse(req.params.id), req.body));
}
