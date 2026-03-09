// tests/visitGeneration.test.ts — C1, C2
import { describe, it, expect } from 'vitest';
import { addWeeks, addMonths, format } from 'date-fns';
import { generateRescheduleSlots } from '../lib/scheduler/rescheduleSlots';

function advanceByFrequency(from: Date, frequency: string): Date {
  switch (frequency) {
    case 'weekly': return addWeeks(from, 1);
    case 'biweekly': return addWeeks(from, 2);
    case 'monthly': return addMonths(from, 1);
    default: throw new Error(`Unknown: ${frequency}`);
  }
}

describe('C1: Visit generation date arithmetic', () => {
  it('weekly: advances by 7 days', () => {
    expect(format(advanceByFrequency(new Date('2026-03-10'), 'weekly'), 'yyyy-MM-dd')).toBe('2026-03-17');
  });
  it('biweekly: advances by 14 days', () => {
    expect(format(advanceByFrequency(new Date('2026-03-10'), 'biweekly'), 'yyyy-MM-dd')).toBe('2026-03-24');
  });
  it('monthly: advances by 1 month', () => {
    expect(format(advanceByFrequency(new Date('2026-03-10'), 'monthly'), 'yyyy-MM-dd')).toBe('2026-04-10');
  });
});

describe('Reschedule slot generation', () => {
  it('generates only future slots within horizon', () => {
    const slots = generateRescheduleSlots({
      routeWeekday: 2, frequency: 'weekly', windowStart: '09:00', windowEnd: '12:00',
      isAnytime: false, fromDate: new Date('2026-03-09'), maxSlots: 4, horizonDays: 21,
    });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.length).toBeLessThanOrEqual(4);
    for (const slot of slots) {
      expect(new Date(slot.slotStart).getTime()).toBeGreaterThan(new Date('2026-03-09').getTime());
    }
  });

  it('generates anytime slots correctly', () => {
    const slots = generateRescheduleSlots({
      routeWeekday: 2, frequency: 'weekly', windowStart: null, windowEnd: null,
      isAnytime: true, fromDate: new Date('2026-03-09'), maxSlots: 4, horizonDays: 21,
    });
    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) {
      expect(slot.slotEnd).toBeNull();
      expect(slot.displayLabel).toContain('Anytime');
    }
  });

  it('respects max 4 slots', () => {
    const slots = generateRescheduleSlots({
      routeWeekday: 1, frequency: 'weekly', windowStart: '10:00', windowEnd: '14:00',
      isAnytime: false, fromDate: new Date('2026-03-09'), maxSlots: 4, horizonDays: 60,
    });
    expect(slots.length).toBeLessThanOrEqual(4);
  });
});
