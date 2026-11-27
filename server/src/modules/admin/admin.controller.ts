import type { Request, Response } from 'express';
import * as adminService from './admin.service';
import { adminTicketsQuerySchema } from './admin.schema';

export async function listTickets(req: Request, res: Response) {
  res.json(await adminService.listAllTickets(adminTicketsQuerySchema.parse(req.query)));
}

export async function exportTickets(req: Request, res: Response) {
  const csv = await adminService.exportTicketsCsv(adminTicketsQuerySchema.parse(req.query));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookings.csv"');
  res.send(csv);
}

export async function stats(_req: Request, res: Response) {
  res.json(await adminService.stats());
}

export async function auditLog(req: Request, res: Response) {
  res.json(await adminService.auditLog(Number(req.query.limit ?? 50)));
}
