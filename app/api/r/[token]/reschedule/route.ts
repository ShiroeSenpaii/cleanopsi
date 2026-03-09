// app/api/r/[token]/reschedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/db/client';
import { resolveActionToken } from '@/lib/tokens/actionTokens';
import { generateRescheduleSlots } from '@/lib/scheduler/rescheduleSlots';
import { createOrUpdateCalendarEvent } from '@/lib/google/calendar';
import { VisitStatus, ConfirmStatus, RescheduleRequestState } from '@/lib/enums';

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createServiceClient();
  const resolved = await resolveActionToken(params.token);

  if (!resolved) {
    return NextResponse.json({ error: 'This link has expired or is invalid.' }, { status: 404 });
  }

  const { visitId, organisationId } = resolved;
  const body = await request.json().catch(() => null);
  const slotStart: string | undefined = body?.slot_start;
  const slotEnd: string | undefined = body?.slot_end;

  if (!slotStart) return NextResponse.json({ error: 'slot_start is required.' }, { status: 400 });

  const { data: visit } = await supabase
    .from('visits')
    .select(`id, status, confirm_status, scheduled_date, google_event_id, subscription_id,
      subscriptions(id, frequency, route_id, customers(name), routes(weekday, window_start, window_end, is_anytime))`)
    .eq('id', visitId)
    .eq('organisation_id', organisationId)
    .single();

  if (!visit) return NextResponse.json({ error: 'Visit not found.' }, { status: 404 });

  // Idempotency
  if (visit.confirm_status === ConfirmStatus.RESCHEDULED) {
    return NextResponse.json({ ok: true, alreadyRescheduled: true });
  }

  if (visit.status !== VisitStatus.SCHEDULED) {
    return NextResponse.json({ error: 'This visit cannot be rescheduled in its current state.' }, { status: 409 });
  }

  const sub = visit.subscriptions as {
    id: string; frequency: string; route_id: string;
    customers: { name: string };
    routes: { weekday: number; window_start: string | null; window_end: string | null; is_anytime: boolean };
  };

  // Server-side slot validation
  const allowedSlots = generateRescheduleSlots({
    routeWeekday: sub.routes.weekday,
    frequency: sub.frequency,
    windowStart: sub.routes.window_start,
    windowEnd: sub.routes.window_end,
    isAnytime: sub.routes.is_anytime,
    fromDate: new Date(),
    maxSlots: 4,
    horizonDays: 21,
  });

  const matchedSlot = allowedSlots.find((s) => s.slotStart === slotStart);
  if (!matchedSlot) {
    return NextResponse.json(
      { error: 'The selected slot is no longer available. Please choose another.', availableSlots: allowedSlots },
      { status: 409 },
    );
  }

  // Step 1: Set reschedule_requested (truth state before downstream work)
  await supabase
    .from('visits')
    .update({ confirm_status: ConfirmStatus.RESCHEDULE_REQUESTED, last_customer_action_at: new Date().toISOString(), calendar_sync_error: null })
    .eq('id', visitId)
    .eq('organisation_id', organisationId);

  // Get customer_id
  const { data: subRecord } = await supabase
    .from('subscriptions')
    .select('customer_id')
    .eq('id', sub.id)
    .single();

  const { data: rr } = await supabase
    .from('reschedule_requests')
    .insert({
      organisation_id: organisationId,
      visit_id: visitId,
      customer_id: subRecord?.customer_id,
      state: RescheduleRequestState.OPENED,
      selected_slot_start: slotStart,
      selected_slot_end: slotEnd ?? matchedSlot.slotEnd,
    })
    .select('id')
    .single();

  // Step 2: Attempt Google Calendar update
  let calendarError: string | null = null;
  let googleEventId: string | null = visit.google_event_id ?? null;

  try {
    googleEventId = await createOrUpdateCalendarEvent({
      organisationId,
      visitId,
      customerName: sub.customers.name,
      slotStart,
      slotEnd: slotEnd ?? matchedSlot.slotEnd,
      existingEventId: googleEventId,
      isAnytime: sub.routes.is_anytime,
    });
  } catch (err: unknown) {
    calendarError = err instanceof Error ? err.message : 'Calendar update failed';
    console.error('[reschedule] calendar update failed', { visitId, error: calendarError });
  }

  if (calendarError) {
    // Leave as reschedule_requested — truthful state
    await supabase.from('visits').update({ calendar_sync_error: calendarError }).eq('id', visitId);
    if (rr) await supabase.from('reschedule_requests').update({ state: RescheduleRequestState.SELECTED }).eq('id', rr.id);

    return NextResponse.json(
      {
        ok: false,
        partialSuccess: true,
        message: 'Your reschedule has been noted, but we had trouble updating the calendar. We have been notified and will confirm your new time shortly.',
      },
      { status: 202 },
    );
  }

  // Step 3: Calendar succeeded
  await supabase
    .from('visits')
    .update({
      confirm_status: ConfirmStatus.RESCHEDULED,
      scheduled_start: slotStart,
      scheduled_end: slotEnd ?? matchedSlot.slotEnd,
      scheduled_date: slotStart.split('T')[0],
      google_event_id: googleEventId,
      calendar_sync_error: null,
    })
    .eq('id', visitId)
    .eq('organisation_id', organisationId);

  if (rr) await supabase.from('reschedule_requests').update({ state: RescheduleRequestState.SELECTED }).eq('id', rr.id);

  return NextResponse.json({ ok: true });
}
