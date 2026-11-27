import type { Request, Response } from 'express';
import { idParam } from '../tickets/tickets.schema';
import * as trainsService from './trains.service';

export async function list(_req: Request, res: Response) {
  res.json(await trainsService.list());
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await trainsService.create(req.user!.id, req.body));
}

export async function update(req: Request, res: Response) {
  res.json(await trainsService.update(req.user!.id, idParam.parse(req.params.id), req.body));
}

export async function getCarriages(req: Request, res: Response) {
  res.json(await trainsService.getCarriages(idParam.parse(req.params.id)));
}

export async function addCarriage(req: Request, res: Response) {
  res.status(201).json(await trainsService.addCarriage(req.user!.id, idParam.parse(req.params.id), req.body));
}

export async function updateCarriage(req: Request, res: Response) {
  res.json(await trainsService.updateCarriage(req.user!.id, idParam.parse(req.params.id), req.body));
}

export async function updateSeat(req: Request, res: Response) {
  res.json(await trainsService.updateSeat(req.user!.id, idParam.parse(req.params.id), req.body));
}
