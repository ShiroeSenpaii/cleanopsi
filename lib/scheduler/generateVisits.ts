// lib/scheduler/generateVisits.ts
// Idempotent visit generation for the next N days.

import { createServiceClient } from '@/lib/db/client';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addDays, addWeeks, addMonths, isBefore, isAfter, parseISO, format } from 'date-fns';

interface GenerateParams {
  organisationId: string;
  horizonDays?: number;
}

interface GenerateResult {
  created: number;
  skipped: number;
}

export async function generateVisits(params: GenerateParams): Promise<GenerateResult> {
  const { organisationId, horizonDays = 14 } = params;
  const supabase = createServiceClient();

  const { data: org, error: orgErr } = await supabase
    .from('organisations')
    .select('tz')
    .eq('id', organisationId)
    .single();

  if (orgErr || !org) throw new Error(`Organisation not found: ${organisationId}`);
  const tz = org.tz;

  const { data: subscriptions, error: subErr } = await supabase
    .from('subscriptions')
    .select(`id, frequency, next_visit_date, routes(weekday, window_start, window_end, is_anytime)`)
    .eq('organisation_id', organisationId)
    .eq('active', true);

  if (subErr) throw new Error(`Failed to load subscriptions: ${subErr.message}`);

  const todayInOrg = toZonedTime(new Date(), tz);
  const horizonEnd = addDays(todayInOrg, horizonDays);

  let created = 0;
  let skipped = 0;

  for (const sub of subscriptions ?? []) {
    const route = sub.routes as {
      weekday: number;
      window_start: string | null;
      window_end: string | null;
      is_anytime: boolean;
    };

    let cursor = parseISO(sub.next_visit_date);
    if (isBefore(cursor, todayInOrg)) {
      cursor = advanceToNext(cursor, sub.frequency, todayInOrg);
    }

    while (!isAfter(cursor, horizonEnd)) {
      const scheduledDate = format(cursor, 'yyyy-MM-dd');

      let scheduledStart: string | null = null;
      let scheduledEnd: string | null = null;

      if (!route.is_anytime && route.window_start && route.window_end) {
        const startLocal = `${scheduledDate}T${route.window_start}:00`;
        const endLocal = `${scheduledDate}T${route.window_end}:00`;
        scheduledStart = fromZonedTime(startLocal, tz).toISOString();
        scheduledEnd = fromZonedTime(endLocal, tz).toISOString();
      }

      const { error: insertErr } = await supabase.from('visits').insert({
        organisation_id: organisationId,
        subscription_id: sub.id,
        scheduled_date: scheduledDate,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        status: 'scheduled',
        confirm_status: 'pending',
      });

      if (insertErr) {
        if (insertErr.code === '23505') {
          skipped++;
        } else {
          console.error('[generateVisits] insert error', { subscriptionId: sub.id, scheduledDate, error: insertErr.message });
          skipped++;
        }
      } else {
        created++;
      }

      cursor = advanceByFrequency(cursor, sub.frequency);
    }
  }

  return { created, skipped };
}

function advanceByFrequency(from: Date, frequency: string): Date {
  switch (frequency) {
    case 'weekly': return addWeeks(from, 1);
    case 'biweekly': return addWeeks(from, 2);
    case 'monthly': return addMonths(from, 1);
    default: throw new Error(`Unknown frequency: ${frequency}`);
  }
}

function advanceToNext(from: Date, frequency: string, reference: Date): Date {
  let cursor = from;
  while (isBefore(cursor, reference)) {
    cursor = advanceByFrequency(cursor, frequency);
  }
  return cursor;
}
