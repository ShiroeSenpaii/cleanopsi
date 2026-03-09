// app/r/[token]/page.tsx
// Public customer action page. No auth required.

import { createServiceClient } from '@/lib/db/client';
import { resolveActionToken } from '@/lib/tokens/actionTokens';
import { generateRescheduleSlots } from '@/lib/scheduler/rescheduleSlots';
import CustomerActionClient from './CustomerActionClient';
import { VisitStatus } from '@/lib/enums';

interface Props { params: { token: string } }

export default async function ActionPage({ params }: Props) {
  const { token } = params;
  const resolved = await resolveActionToken(token);

  if (!resolved) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-sm text-center bg-white rounded-2xl shadow p-8">
          <h1 className="text-xl font-semibold mb-2">Link Expired</h1>
          <p className="text-gray-600">This link has expired or is no longer valid. Please contact us if you need to make a change to your visit.</p>
        </div>
      </div>
    );
  }

  const supabase = createServiceClient();

  const { data: visit } = await supabase
    .from('visits')
    .select(`id, status, confirm_status, scheduled_date, scheduled_start, scheduled_end, subscription_id,
      subscriptions(frequency, customers(name), routes(weekday, window_start, window_end, window_label, is_anytime))`)
    .eq('id', resolved.visitId)
    .eq('organisation_id', resolved.organisationId)
    .single();

  if (!visit) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-sm text-center bg-white rounded-2xl shadow p-8">
          <h1 className="text-xl font-semibold mb-2">Not Found</h1>
          <p className="text-gray-600">We could not find this visit.</p>
        </div>
      </div>
    );
  }

  const { data: org } = await supabase
    .from('organisations')
    .select('name, tz')
    .eq('id', resolved.organisationId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = visit.subscriptions as any;
  const route = sub.routes;

  const rescheduleSlots = generateRescheduleSlots({
    routeWeekday: route.weekday,
    frequency: sub.frequency,
    windowStart: route.window_start,
    windowEnd: route.window_end,
    isAnytime: route.is_anytime,
    fromDate: new Date(),
    maxSlots: 4,
    horizonDays: 21,
  });

  const alreadyActioned =
    visit.status !== VisitStatus.SCHEDULED ||
    ['confirmed', 'rescheduled'].includes(visit.confirm_status);

  return (
    <CustomerActionClient
      token={token}
      visitDate={visit.scheduled_date}
      windowLabel={route.is_anytime ? 'Anytime' : route.window_label}
      customerName={sub.customers.name}
      businessName={org?.name ?? 'Your service provider'}
      confirmStatus={visit.confirm_status}
      visitStatus={visit.status}
      alreadyActioned={alreadyActioned}
      rescheduleSlots={rescheduleSlots}
      orgTz={org?.tz ?? 'UTC'}
    />
  );
}
