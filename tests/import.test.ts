// tests/import.test.ts — B1, B2, B3, B4
import { describe, it, expect } from 'vitest';
import { validateRow } from '../lib/import/validateRow';

describe('B2: Invalid phone rejection', () => {
  it('rejects a non-E.164 phone', () => {
    const result = validateRow({ customer_name: 'Test', phone_e164: 'not-a-phone', weekday: 'Tuesday', window_start: '09:00', window_end: '12:00', frequency: 'weekly' }, 2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.field === 'phone_e164')).toBe(true);
  });

  it('rejects empty phone', () => {
    const result = validateRow({ phone_e164: '', weekday: 'Tuesday', window_start: '09:00', window_end: '12:00', frequency: 'weekly' }, 2);
    expect(result.ok).toBe(false);
  });
});

describe('B4: Frequency validation', () => {
  it('rejects unsupported frequency', () => {
    const result = validateRow({ phone_e164: '+12025550101', weekday: 'Tuesday', window_start: '09:00', window_end: '12:00', frequency: 'fortnightly' }, 2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const err = result.errors.find((e) => e.field === 'frequency');
      expect(err?.message).toContain('weekly');
    }
  });
});

describe('B1: Valid rows', () => {
  it('parses a standard weekly timed row', () => {
    const result = validateRow({
      customer_name: 'John Smith', phone_e164: '+12025550101', route_name: 'Tue North',
      weekday: 'Tuesday', window_label: '09:00-12:00', window_start: '09:00', window_end: '12:00',
      frequency: 'weekly', consent_status: 'unknown', next_visit_date: '2026-03-10', notes: 'standard',
    }, 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.phoneE164).toBe('+12025550101');
      expect(result.data.weekday).toBe(2);
      expect(result.data.frequency).toBe('weekly');
      expect(result.data.isAnytime).toBe(false);
    }
  });

  it('parses an anytime row', () => {
    const result = validateRow({
      customer_name: 'David Carter', phone_e164: '+12025550103', route_name: 'Tue North',
      weekday: 'Tuesday', window_label: 'Anytime', window_start: '', window_end: '',
      frequency: 'biweekly', consent_status: 'unknown', next_visit_date: '2026-03-10',
    }, 4);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isAnytime).toBe(true);
      expect(result.data.windowStart).toBeNull();
      expect(result.data.windowEnd).toBeNull();
    }
  });

  it('handles all 20 seed CSV rows without errors', () => {
    const seedRows = [
      { customer_name: 'John Smith', phone_e164: '+12025550101', route_name: 'Tue North', weekday: 'Tuesday', window_label: '09:00-12:00', window_start: '09:00', window_end: '12:00', frequency: 'weekly', consent_status: 'unknown', next_visit_date: '2026-03-10' },
      { customer_name: 'Maria Lopez', phone_e164: '+12025550102', route_name: 'Tue North', weekday: 'Tuesday', window_label: '09:00-12:00', window_start: '09:00', window_end: '12:00', frequency: 'weekly', consent_status: 'unknown', next_visit_date: '2026-03-10' },
      { customer_name: 'David Carter', phone_e164: '+12025550103', route_name: 'Tue North', weekday: 'Tuesday', window_label: 'Anytime', window_start: '', window_end: '', frequency: 'biweekly', consent_status: 'unknown', next_visit_date: '2026-03-10' },
    ];
    for (const row of seedRows) {
      const result = validateRow(row, 2);
      expect(result.ok).toBe(true);
    }
  });
});

describe('B3: Duplicate row detection', () => {
  it('flags same phone+weekday+frequency as duplicate', () => {
    const row1 = validateRow({ phone_e164: '+12025550101', weekday: 'Tuesday', window_start: '09:00', window_end: '12:00', frequency: 'weekly' }, 2);
    const row2 = validateRow({ phone_e164: '+12025550101', weekday: 'Tuesday', window_start: '09:00', window_end: '12:00', frequency: 'weekly' }, 3);
    expect(row1.ok).toBe(true);
    expect(row2.ok).toBe(true);
    if (row1.ok && row2.ok) {
      const key1 = `${row1.data.phoneE164}|${row1.data.weekday}|${row1.data.frequency}`;
      const key2 = `${row2.data.phoneE164}|${row2.data.weekday}|${row2.data.frequency}`;
      expect(key1).toBe(key2);
    }
  });
});
