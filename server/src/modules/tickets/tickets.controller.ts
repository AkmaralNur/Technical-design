import type { Request, Response } from 'express';
import * as ticketsService from './tickets.service';
import { idParam, myTicketsQuerySchema } from './tickets.schema';

export async function book(req: Request, res: Response) {
  const ticket = await ticketsService.bookTicket(req.user!.id, req.body);
  res.status(201).json(ticket);
}

export async function listMine(req: Request, res: Response) {
  res.json(await ticketsService.listMyTickets(req.user!.id, myTicketsQuerySchema.parse(req.query)));
}

export async function getMine(req: Request, res: Response) {
  res.json(await ticketsService.getMyTicket(req.user!.id, idParam.parse(req.params.id)));
}

export async function cancel(req: Request, res: Response) {
  res.json(await ticketsService.cancelTicket(req.user!.id, idParam.parse(req.params.id)));
}

export async function pdf(req: Request, res: Response) {
  const { pdf, fileName } = await ticketsService.getTicketPdf(req.user!, idParam.parse(req.params.id));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(pdf);
}
