import type { Request, Response } from 'express';
import { idParam } from '../tickets/tickets.schema';
import * as stationsService from './stations.service';

export async function listActive(_req: Request, res: Response) {
  res.json(await stationsService.listActive());
}

export async function listAll(_req: Request, res: Response) {
  res.json(await stationsService.listAll());
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await stationsService.create(req.user!.id, req.body));
}

export async function update(req: Request, res: Response) {
  res.json(await stationsService.update(req.user!.id, idParam.parse(req.params.id), req.body));
}
