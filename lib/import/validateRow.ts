// lib/import/validateRow.ts
// Validates and normalises a single CSV import row.

import { parsePhoneNumberFromString } from 'libphonenumber-js';

export interface RawCSVRow {
  customer_name?: string;
  phone_e164?: string;
  route_name?: string;
  weekday?: string;
  window_label?: string;
  window_start?: string;
  window_end?: string;
  frequency?: string;
  consent_status?: string;
  next_visit_date?: string;
  notes?: string;
  [key: string]: string | undefined;
}

export interface ImportRow {
  customerName: string | null;
  phoneE164: string;
  routeName: string;
  weekday: number;
  windowLabel: string;
  windowStart: string | null;
  windowEnd: string | null;
  isAnytime: boolean;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  consentStatus: 'opted_in' | 'opted_out' | 'unknown';
  nextVisitDate: string | null;
  notes: string | null;
}

export interface ImportRowError {
  field: string;
  message: string;
}

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const VALID_FREQUENCIES = new Set<string>(['weekly', 'biweekly', 'monthly']);
const HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseTime(value: string | undefined): string | null | undefined {
  if (!value || value.trim() === '') return null;
  const trimmed = value.trim();
  if (HH_MM_REGEX.test(trimmed)) return trimmed;
  return undefined; // signal invalid
}

export function validateRow(
  row: RawCSVRow,
  rowIndex: number,
): { ok: true; data: ImportRow } | { ok: false; errors: ImportRowError[]; rowIndex: number } {
  const errors: ImportRowError[] = [];

  // phone
  const rawPhone = (row.phone_e164 ?? '').trim();
  let phoneE164 = '';
  if (!rawPhone) {
    errors.push({ field: 'phone_e164', message: 'Phone is required' });
  } else {
    const parsed = parsePhoneNumberFromString(rawPhone);
    if (!parsed || !parsed.isValid()) {
      errors.push({
        field: 'phone_e164',
        message: `Invalid phone number: "${rawPhone}". Must be E.164 format (e.g. +12025550101).`,
      });
    } else {
      phoneE164 = parsed.number as string;
    }
  }

  // weekday
  const rawWeekday = (row.weekday ?? '').trim().toLowerCase();
  const weekdayNum = WEEKDAY_MAP[rawWeekday];
  if (weekdayNum === undefined) {
    errors.push({
      field: 'weekday',
      message: `Unknown weekday: "${row.weekday}". Allowed: Monday–Sunday.`,
    });
  }

  // frequency
  const rawFrequency = (row.frequency ?? '').trim().toLowerCase();
  if (!VALID_FREQUENCIES.has(rawFrequency)) {
    errors.push({
      field: 'frequency',
      message: `Invalid frequency: "${row.frequency}". Allowed: weekly, biweekly, monthly.`,
    });
  }

  // window
  const windowStartRaw = row.window_start;
  const windowEndRaw = row.window_end;
  let windowStart: string | null = null;
  let windowEnd: string | null = null;
  let isAnytime = true;

  const parsedStart = parseTime(windowStartRaw);
  const parsedEnd = parseTime(windowEndRaw);

  if (
    (!windowStartRaw || windowStartRaw.trim() === '') &&
    (!windowEndRaw || windowEndRaw.trim() === '')
  ) {
    isAnytime = true;
    windowStart = null;
    windowEnd = null;
  } else {
    if (parsedStart === undefined || parsedEnd === undefined) {
      errors.push({ field: 'window_start', message: `Invalid time format. Use HH:MM.` });
    } else {
      windowStart = parsedStart;
      windowEnd = parsedEnd;
      isAnytime = false;
    }
  }

  if (
    (windowStart !== null && windowEnd === null && !isAnytime) ||
    (windowStart === null && windowEnd !== null && !isAnytime)
  ) {
    errors.push({
      field: 'window_start',
      message: 'Both window_start and window_end are required for timed visits.',
    });
  }

  const routeName = (row.route_name ?? '').trim() || 'Default Route';
  const windowLabel =
    (row.window_label ?? '').trim() ||
    (isAnytime ? 'Anytime' : `${windowStart}–${windowEnd}`);

  const rawConsent = (row.consent_status ?? '').trim().toLowerCase();
  const consentStatus: ImportRow['consentStatus'] =
    rawConsent === 'opted_in' ? 'opted_in' : rawConsent === 'opted_out' ? 'opted_out' : 'unknown';

  const rawNextVisit = (row.next_visit_date ?? '').trim();
  const nextVisitDate = /^\d{4}-\d{2}-\d{2}$/.test(rawNextVisit) ? rawNextVisit : null;

  if (errors.length > 0) {
    return { ok: false, errors, rowIndex };
  }

  return {
    ok: true,
    data: {
      customerName: (row.customer_name ?? '').trim() || null,
      phoneE164,
      routeName,
      weekday: weekdayNum,
      windowLabel,
      windowStart,
      windowEnd,
      isAnytime,
      frequency: rawFrequency as ImportRow['frequency'],
      consentStatus,
      nextVisitDate,
      notes: (row.notes ?? '').trim() || null,
    },
  };
}
