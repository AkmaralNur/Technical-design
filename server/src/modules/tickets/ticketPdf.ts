import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Prisma } from '@prisma/client';
import { config } from '../../config';
import { localDate, localTime, SEAT_CLASS_RU } from '../../utils/format';
import type { TicketRow } from './tickets.repository';
import { displayStatus } from './tickets.repository';

/** Ищем TTF-шрифт с кириллицей (стандартные шрифты PDF кириллицу не умеют) */
function findFont(bold = false): string | null {
  const candidates = [
    !bold && config.pdfFont,
    path.resolve(__dirname, `../../../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans${bold ? '-Bold' : ''}.ttf`),
    bold ? 'C:/Windows/Fonts/arialbd.ttf' : 'C:/Windows/Fonts/arial.ttf',
    `/usr/share/fonts/truetype/dejavu/DejaVuSans${bold ? '-Bold' : ''}.ttf`,
  ].filter(Boolean) as string[];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

const STATUS_RU = { UPCOMING: 'Подтверждён', COMPLETED: 'Завершён', CANCELLED: 'Отменён' } as const;

/** Собирает PDF-билет A5 с QR-кодом (раздел 10.12) */
export async function buildTicketPdf(t: TicketRow): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A5', layout: 'landscape', margin: 32 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const regular = findFont();
  const bold = findFont(true) ?? regular;
  if (regular) doc.registerFont('main', regular);
  if (bold) doc.registerFont('bold', bold);
  const F = regular ? 'main' : 'Helvetica';
  const FB = bold ? 'bold' : 'Helvetica-Bold';

  const W = doc.page.width;
  const H = doc.page.height;
  const status = displayStatus(t);

  // шапка
  doc.rect(0, 0, W, 64).fill('#1d4ed8');
  doc.fillColor('#ffffff').font(FB).fontSize(22).text('TrainTix', 32, 20);
  doc.font(F).fontSize(12).text(`Билет ${t.ticket_number}`, 0, 27, { width: W - 32, align: 'right' });

  // данные
  const x = 32;
  let y = 88;
  const label = (k: string, v: string, lx: number, ly: number) => {
    doc.fillColor('#64748b').font(F).fontSize(9).text(k.toUpperCase(), lx, ly);
    doc.fillColor('#0f172a').font(FB).fontSize(13).text(v, lx, ly + 12);
  };
  label('Пассажир', t.passenger_name, x, y);
  label('Поезд', t.train_number, x + 250, y);
  label('Дата', localDate(t.departure_at, t.from_tz), x + 360, y);

  y += 52;
  doc.fillColor('#0f172a').font(FB).fontSize(20).text(t.from_station_name, x, y);
  doc.font(F).fontSize(14).fillColor('#1d4ed8').text(localTime(t.departure_at, t.from_tz), x, y + 26);
  doc.moveTo(x + 170, y + 18).lineTo(x + 300, y + 18).lineWidth(2).strokeColor('#94a3b8').stroke();
  doc.moveTo(x + 290, y + 12).lineTo(x + 300, y + 18).lineTo(x + 290, y + 24).stroke();
  doc.fillColor('#0f172a').font(FB).fontSize(20).text(t.to_station_name, x + 320, y);
  doc.font(F).fontSize(14).fillColor('#1d4ed8').text(localTime(t.arrival_at, t.to_tz), x + 320, y + 26);

  y += 74;
  label('Вагон', String(t.carriage_no), x, y);
  label('Место', t.seat_label, x + 90, y);
  label('Класс', SEAT_CLASS_RU[t.seat_class] ?? t.seat_class, x + 180, y);
  y += 46;
  label('Цена', `${new Prisma.Decimal(t.price).toFixed(2)} ${t.currency}`, x, y);
  label('Статус', STATUS_RU[status], x + 180, y);

  // QR-код с номером билета
  const qr = await QRCode.toBuffer(t.ticket_number, { margin: 1, width: 240 });
  doc.image(qr, W - 32 - 110, H - 32 - 126, { width: 110 });
  doc.fillColor('#94a3b8').font(F).fontSize(8).text('Предъявите QR-код при посадке', W - 32 - 160, H - 32 - 12, { width: 160, align: 'right', lineBreak: false });

  if (t.trip_status === 'CANCELLED' && t.cancel_reason) {
    doc.fillColor('#dc2626').font(F).fontSize(10).text(`Рейс отменён: ${t.cancel_reason}`, x, H - 32 - 14, { width: 300, lineBreak: false });
  }

  if (t.status === 'CANCELLED') {
    doc.save();
    doc.rotate(-20, { origin: [W / 2, H / 2] });
    doc.fillColor('#dc2626').opacity(0.35).font(FB).fontSize(72).text('ОТМЕНЁН', 0, H / 2 - 40, { width: W, align: 'center' });
    doc.restore();
  }

  doc.end();
  return done;
}
