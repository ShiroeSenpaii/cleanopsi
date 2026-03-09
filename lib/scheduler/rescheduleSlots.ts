// lib/scheduler/rescheduleSlots.ts
// Generate constrained reschedule slot options from route pattern.
// Rules: 2-4 slots, route weekday only, same window, max 21 days, no past slots.

import { addWeeks, addDays, isBefore, format } from 'date-fns';

export interface RescheduleSlot {
  slotStart: string;
  slotEnd: string | null;
  displayLabel: string;
}

interface GenerateSlotsParams {
  routeWeekday: number;
  frequency: string;
  windowStart: string | null;
  windowEnd: string | null;
  isAnytime: boolean;
  fromDate: Date;
  maxSlots?: number;
  horizonDays?: number;
}

export function generateRescheduleSlots(params: GenerateSlotsParams): RescheduleSlot[] {
  const { routeWeekday, windowStart, windowEnd, isAnytime, fromDate, maxSlots = 4, horizonDays = 21 } = params;

  const slots: RescheduleSlot[] = [];
  const horizon = addDays(fromDate, horizonDays);

  let cursor = nextOccurrenceOfWeekday(addDays(fromDate, 1), routeWeekday);

  while (slots.length < maxSlots && isBefore(cursor, horizon)) {
    const dateStr = format(cursor, 'yyyy-MM-dd');

    let slotStart: string;
    let slotEnd: string | null = null;
    let displayLabel: string;

    if (isAnytime || !windowStart) {
      slotStart = `${dateStr}T12:00:00Z`;
      slotEnd = null;
      displayLabel = format(cursor, 'EEEE, MMMM d') + ' (Anytime)';
    } else {
      slotStart = `${dateStr}T${windowStart}:00Z`;
      slotEnd = windowEnd ? `${dateStr}T${windowEnd}:00Z` : null;
      displayLabel = `${format(cursor, 'EEEE, MMMM d')} ${windowStart}–${windowEnd ?? ''}`;
    }

    slots.push({ slotStart, slotEnd, displayLabel });
    cursor = addWeeks(cursor, 1);
  }

  return slots;
}

function nextOccurrenceOfWeekday(from: Date, weekday: number): Date {
  const d = new Date(from);
  const current = d.getDay();
  let delta = weekday - current;
  if (delta <= 0) delta += 7;
  d.setDate(d.getDate() + delta);
  return d;
}
