/** Данные для текста письма (хранятся в email_outbox.payload) */
export interface EmailPayload {
  ticketNumber: string;
  ticketId: number;
  passengerName: string;
  trainNumber: string;
  date: string; // 05.12.2026
  fromName: string;
  toName: string;
  departure: string; // 07:00
  arrival: string; // 09:30
  carriageNo: number;
  seatLabel: string;
  seatClass: string; // Эконом / Бизнес
  price: string; // 19.00 EUR
  ticketUrl: string;
  reason?: string | null;
  oldDeparture?: string;
  oldArrival?: string;
}

export type EmailType = 'BOOKING_CONFIRMED' | 'TICKET_CANCELLED' | 'TRIP_CANCELLED' | 'SCHEDULE_CHANGED';

function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(title: string, color: string, rows: [string, string][], intro: string, p: EmailPayload) {
  const table = rows
    .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#64748b">${esc(k)}</td><td style="padding:6px 12px;font-weight:600">${esc(v)}</td></tr>`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:${color};color:#fff;padding:18px 24px;font-size:20px;font-weight:700">🚆 TrainTix — ${esc(title)}</div>
    <div style="padding:20px 24px">
      <p>Здравствуйте, ${esc(p.passengerName)}!</p>
      <p>${intro}</p>
      <table style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px">${table}</table>
      <p style="margin-top:20px"><a href="${esc(p.ticketUrl)}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Открыть билет</a></p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">Это письмо отправлено автоматически, отвечать на него не нужно.</p>
    </div>
  </div></body></html>`;
}

/** Собирает тему и текст письма по типу и данным (раздел 10.11) */
export function renderTemplate(type: string, p: EmailPayload): { subject: string; html: string; text: string } {
  const base: [string, string][] = [
    ['Билет', p.ticketNumber],
    ['Поезд', p.trainNumber],
    ['Дата', p.date],
    ['Маршрут', `${p.fromName} ${p.departure} → ${p.toName} ${p.arrival}`],
  ];
  const seat: [string, string][] = [
    ['Вагон / место', `${p.carriageNo} / ${p.seatLabel}`],
    ['Класс', p.seatClass],
    ['Цена', p.price],
  ];
  let subject: string;
  let html: string;
  switch (type) {
    case 'BOOKING_CONFIRMED':
      subject = `Билет ${p.ticketNumber} забронирован`;
      html = layout('билет забронирован', '#16a34a', [...base, ...seat], 'Ваш билет успешно забронирован. Хорошей поездки!', p);
      break;
    case 'TICKET_CANCELLED':
      subject = `Билет ${p.ticketNumber} отменён`;
      html = layout('билет отменён', '#64748b', base, 'Билет отменён. Место снова доступно для продажи.', p);
      break;
    case 'TRIP_CANCELLED':
      subject = `Рейс ${p.trainNumber} ${p.date} отменён`;
      html = layout('рейс отменён', '#dc2626', [...base, ['Причина', p.reason || 'не указана']],
        'К сожалению, рейс отменён. Ваш билет автоматически отменён.', p);
      break;
    case 'SCHEDULE_CHANGED':
      subject = `Изменилось расписание поезда ${p.trainNumber} ${p.date}`;
      html = layout('изменилось расписание', '#d97706', [
        ['Билет', p.ticketNumber],
        ['Поезд', p.trainNumber],
        ['Было', `${p.fromName} ${p.oldDeparture} → ${p.toName} ${p.oldArrival}`],
        ['Стало', `${p.fromName} ${p.departure} → ${p.toName} ${p.arrival}`],
      ], 'Время вашего поезда изменилось. Билет остаётся действительным.', p);
      break;
    default:
      subject = `TrainTix: ${type}`;
      html = layout(type, '#2563eb', base, '', p);
  }
  const text = `${subject}\n\n${p.trainNumber}, ${p.date}\n${p.fromName} ${p.departure} → ${p.toName} ${p.arrival}\nБилет: ${p.ticketUrl}`;
  return { subject, html, text };
}
