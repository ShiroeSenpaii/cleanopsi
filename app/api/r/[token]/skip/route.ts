// app/api/r/[token]/skip/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/db/client';
import { resolveActionToken } from '@/lib/tokens/actionTokens';
import { VisitStatus } from '@/lib/enums';
import { addWeeks, addMonths, parseISO, format } from 'date-fns';

export async function POST(_request: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createServiceClient();
  const resolved = await resolveActionToken(params.token);

  if (!resolved) {
    return NextResponse.json({ error: 'This link has expired or is invalid.' }, { status: 404 });
  }

  const { visitId, organisationId } = resolved;

  const { data: visit } = await supabase
    .from('visits')
    .select(`id, status, confirm_status, subscription_id,
      subscriptions(id, frequency, next_visit_date, routes(weekday))`)
    .eq('id', visitId)
    .eq('organisation_id', organisationId)
    .single();

  if (!visit) return NextResponse.json({ error: 'Visit not found.' }, { status: 404 });

  // Idempotency
  if (visit.status === VisitStatus.SKIPPED) {
    return NextResponse.json({ ok: true, alreadySkipped: true });
  }

  if (visit.status !== VisitStatus.SCHEDULED) {
    return NextResponse.json({ error: 'This visit cannot be skipped in its current state.' }, { status: 409 });
  }

  const sub = visit.subscriptions as { id: string; frequency: string; next_visit_date: string; routes: { weekday: number } };

  const currentNext = parseISO(sub.next_visit_date);
  const newNextDate = advanceDate(currentNext, sub.frequency);
  const newNextDateStr = format(newNextDate, 'yyyy-MM-dd');

  // TODO: wrap in Postgres RPC for atomicity in v1.1
  const { error: visitErr } = await supabase
    .from('visits')
    .update({ status: VisitStatus.SKIPPED, last_customer_action_at: new Date().toISOString() })
    .eq('id', visitId)
    .eq('organisation_id', organisationId);

  if (visitErr) {
    console.error('[skip] visit update failed', visitErr.message);
    return NextResponse.json({ error: 'Failed to skip. Please try again.' }, { status: 500 });
  }

  const { error: subErr } = await supabase
    .from('subscriptions')
    .update({ next_visit_date: newNextDateStr })
    .eq('id', sub.id)
    .eq('organisation_id', organisationId);

  if (subErr) console.error('[skip] subscription advance failed', subErr.message);

  return NextResponse.json({ ok: true, nextVisitDate: newNextDateStr });
}

function advanceDate(from: Date, frequency: string): Date {
  switch (frequency) {
    case 'weekly': return addWeeks(from, 1);
    case 'biweekly': return addWeeks(from, 2);
    case 'monthly': return addMonths(from, 1);
    default: return addWeeks(from, 1);
  }
}
