// app/api/r/[token]/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/db/client';
import { resolveActionToken } from '@/lib/tokens/actionTokens';
import { VisitStatus, ConfirmStatus } from '@/lib/enums';

export async function POST(_request: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createServiceClient();
  const resolved = await resolveActionToken(params.token);

  if (!resolved) {
    return NextResponse.json({ error: 'This link has expired or is invalid.' }, { status: 404 });
  }

  const { visitId, organisationId } = resolved;

  const { data: visit, error: visitErr } = await supabase
    .from('visits')
    .select('id, status, confirm_status')
    .eq('id', visitId)
    .eq('organisation_id', organisationId)
    .single();

  if (visitErr || !visit) return NextResponse.json({ error: 'Visit not found.' }, { status: 404 });

  // Idempotency
  if (visit.confirm_status === ConfirmStatus.CONFIRMED) {
    return NextResponse.json({ ok: true, alreadyConfirmed: true });
  }

  if (visit.status !== VisitStatus.SCHEDULED) {
    return NextResponse.json({ error: 'This visit cannot be confirmed in its current state.' }, { status: 409 });
  }

  const { error: updateErr } = await supabase
    .from('visits')
    .update({ confirm_status: ConfirmStatus.CONFIRMED, last_customer_action_at: new Date().toISOString() })
    .eq('id', visitId)
    .eq('organisation_id', organisationId);

  if (updateErr) {
    console.error('[confirm] update failed', updateErr.message);
    return NextResponse.json({ error: 'Failed to confirm. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
