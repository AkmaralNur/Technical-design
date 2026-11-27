import { describe, expect, it } from 'vitest';
import { buildSeats, segmentsOverlap } from '../src/utils/segments';
import { generateTicketNumber } from '../src/utils/ticketNumber';
import { renderTemplate } from '../src/modules/notifications/templates';

// Раздел 19.2 — unit-тесты

describe('segmentsOverlap (раздел 11.2)', () => {
  it('стык в Brno — не пересечение: [0,1) и [1,2)', () => expect(segmentsOverlap(0, 1, 1, 2)).toBe(false));
  it('[0,1) и [0,2) пересекаются', () => expect(segmentsOverlap(0, 1, 0, 2)).toBe(true));
  it('[1,2) и [0,2) пересекаются', () => expect(segmentsOverlap(1, 2, 0, 2)).toBe(true));
  it('одинаковые участки пересекаются', () => expect(segmentsOverlap(0, 2, 0, 2)).toBe(true));
  it('далёкие участки не пересекаются', () => expect(segmentsOverlap(0, 1, 2, 3)).toBe(false));
});

describe('buildSeats (раздел 10.10)', () => {
  it("'AB_CD' × 15 рядов = 60 мест 1A…15D", () => {
    const seats = buildSeats(1, 2, 15, 'AB_CD');
    expect(seats).toHaveLength(60);
    expect(seats[0].seatLabel).toBe('1A');
    expect(seats.at(-1)!.seatLabel).toBe('15D');
    expect(seats.map((s) => s.seatLetter)).not.toContain('_');
  });
  it("'A_BC' × 8 рядов = 24 места", () => expect(buildSeats(1, 1, 8, 'A_BC')).toHaveLength(24));
});

describe('generateTicketNumber (раздел 10.6)', () => {
  it('формат TTX- + 8 символов без 0/O/1/I', () => {
    for (let i = 0; i < 200; i++) expect(generateTicketNumber()).toMatch(/^TTX-[A-HJ-NP-Z2-9]{8}$/);
  });
  it('номера не повторяются', () => {
    const set = new Set(Array.from({ length: 2000 }, generateTicketNumber));
    expect(set.size).toBe(2000);
  });
});

describe('renderTemplate (раздел 10.11)', () => {
  const p = {
    ticketNumber: 'TTX-7F3K9Q2M', ticketId: 1, passengerName: 'Anna <b>', trainNumber: 'T101', date: '05.12.2026',
    fromName: 'Prague', toName: 'Brno', departure: '07:00', arrival: '09:30', carriageNo: 3, seatLabel: '12A',
    seatClass: 'Эконом', price: '19.00 EUR', ticketUrl: 'http://localhost/tickets/1',
  };
  it('письмо о брони содержит номер билета и место', () => {
    const m = renderTemplate('BOOKING_CONFIRMED', p);
    expect(m.subject).toContain('TTX-7F3K9Q2M');
    expect(m.html).toContain('12A');
  });
  it('HTML экранируется', () => expect(renderTemplate('BOOKING_CONFIRMED', p).html).toContain('Anna &lt;b&gt;'));
});
