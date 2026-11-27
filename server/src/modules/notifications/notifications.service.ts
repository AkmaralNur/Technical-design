import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { Prisma } from '@prisma/client';
import { config } from '../../config';
import { db, Tx } from '../../db/client';
import { localDate, localTime, SEAT_CLASS_RU } from '../../utils/format';
import { logger } from '../../utils/logger';
import type { TicketRow } from '../tickets/tickets.repository';
import { EmailPayload, EmailType, renderTemplate } from './templates';

/** Данные письма из строки билета */
export function payloadFromTicket(row: TicketRow, extra: Partial<EmailPayload> = {}): EmailPayload {
  return {
    ticketNumber: row.ticket_number,
    ticketId: Number(row.id),
    passengerName: row.passenger_name,
    trainNumber: row.train_number,
    date: localDate(row.departure_at, row.from_tz),
    fromName: row.from_station_name,
    toName: row.to_station_name,
    departure: localTime(row.departure_at, row.from_tz),
    arrival: localTime(row.arrival_at, row.to_tz),
    carriageNo: row.carriage_no,
    seatLabel: row.seat_label,
    seatClass: SEAT_CLASS_RU[row.seat_class] ?? row.seat_class,
    price: `${new Prisma.Decimal(row.price).toFixed(2)} ${row.currency}`,
    ticketUrl: `${config.appUrl}/tickets/${row.id}`,
    reason: row.cancel_reason,
    ...extra,
  };
}

/** Поставить письмо в очередь — в той же транзакции, что и бронь/отмена (раздел 10.11) */
export async function queueEmail(tx: Tx, type: EmailType, row: TicketRow, extra: Partial<EmailPayload> = {}) {
  await tx.emailOutbox.create({
    data: {
      type,
      toEmail: row.user_email,
      userId: row.user_id,
      ticketId: row.id,
      payload: payloadFromTicket(row, extra) as unknown as Prisma.InputJsonValue,
    },
  });
}

// ---------- отправщик писем ----------

const DEV_MAIL_DIR = path.resolve(__dirname, '../../../dev-mails');

const transport = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
    })
  : null;

async function deliver(to: string, mail: { subject: string; html: string; text: string }, id: bigint, type: string) {
  if (transport) {
    await transport.sendMail({ from: config.mailFrom, to, ...mail });
    return;
  }
  // SMTP не настроен — сохраняем письмо в файл, чтобы его можно было открыть в браузере
  fs.mkdirSync(DEV_MAIL_DIR, { recursive: true });
  const file = path.join(DEV_MAIL_DIR, `${id}-${type}.html`);
  fs.writeFileSync(file, `<!-- To: ${to} | Subject: ${mail.subject} -->\n${mail.html}`, 'utf8');
  logger.info({ to, subject: mail.subject, file }, 'письмо сохранено (SMTP не настроен)');
}

interface OutboxRow {
  id: bigint;
  type: string;
  to_email: string;
  payload: EmailPayload;
  attempts: number;
}

/** Берёт до 20 писем из очереди и отправляет. Повтор через 1, 2, 4, 8, 16 минут, после 5 неудач — FAILED */
export async function sendPendingEmails() {
  await db.$transaction(
    async (tx) => {
      const emails = await tx.$queryRaw<OutboxRow[]>`
        SELECT id, type, to_email, payload, attempts FROM email_outbox
         WHERE status = 'PENDING' AND next_attempt_at <= now()
         ORDER BY id LIMIT 20
         FOR UPDATE SKIP LOCKED`;
      for (const e of emails) {
        try {
          await deliver(e.to_email, renderTemplate(e.type, e.payload), e.id, e.type);
          await tx.emailOutbox.update({ where: { id: e.id }, data: { status: 'SENT', sentAt: new Date(), attempts: e.attempts + 1 } });
        } catch (err) {
          const attempts = e.attempts + 1;
          const failed = attempts >= 5;
          await tx.emailOutbox.update({
            where: { id: e.id },
            data: {
              attempts,
              status: failed ? 'FAILED' : 'PENDING',
              lastError: String(err),
              nextAttemptAt: new Date(Date.now() + 2 ** (attempts - 1) * 60_000),
            },
          });
          if (failed) logger.warn({ emailId: Number(e.id), err: String(err) }, 'письмо не отправлено после 5 попыток');
        }
      }
    },
    { timeout: 60_000 },
  );
}

let timer: NodeJS.Timeout | null = null;

export function startEmailWorker() {
  if (timer) return;
  const tick = () => sendPendingEmails().catch((err) => logger.error({ err }, 'ошибка отправщика писем'));
  timer = setInterval(tick, 10_000);
  tick();
  logger.info(transport ? `отправщик писем запущен (SMTP ${config.smtp.host}:${config.smtp.port})` : `отправщик писем запущен (без SMTP, письма в ${DEV_MAIL_DIR})`);
}

export function stopEmailWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
