// app/(app)/dashboard/today/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export default async function TodayDashboard() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: orgUser } = await supabase
    .from('users')
    .select('organisation_id, organisations(name, tz)')
    .eq('id', user.id)
    .single();

  if (!orgUser) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = orgUser.organisations as any as { name: string; tz: string };
  const todayInOrg = format(toZonedTime(new Date(), org.tz), 'yyyy-MM-dd');

  const { data: todayVisits } = await supabase
    .from('visits')
    .select(`id, status, confirm_status, scheduled_date, calendar_sync_error, last_customer_action_at,
      subscriptions(customers(name, phone_e164), routes(window_label, is_anytime))`)
    .eq('organisation_id', orgUser.organisation_id)
    .eq('scheduled_date', todayInOrg)
    .order('created_at', { ascending: true });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentChanges } = await supabase
    .from('visits')
    .select(`id, status, confirm_status, last_customer_action_at,
      subscriptions(customers(name), routes(window_label))`)
    .eq('organisation_id', orgUser.organisation_id)
    .not('last_customer_action_at', 'is', null)
    .gte('last_customer_action_at', since)
    .order('last_customer_action_at', { ascending: false })
    .limit(20);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending = (todayVisits ?? []).filter((v: any) => v.status === 'scheduled' && v.confirm_status === 'pending');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const confirmed = (todayVisits ?? []).filter((v: any) => v.confirm_status === 'confirmed');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const needsReschedule = (todayVisits ?? []).filter((v: any) => v.confirm_status === 'reschedule_requested');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skipped = (todayVisits ?? []).filter((v: any) => v.status === 'skipped');

  // No-response: reminder sent, no action
  const { data: sentMsgVisitIds } = await supabase
    .from('messages')
    .select('visit_id')
    .eq('organisation_id', orgUser.organisation_id)
    .eq('direction', 'outbound')
    .neq('status', 'suppressed')
    .not('visit_id', 'is', null);

  const sentIds = new Set((sentMsgVisitIds ?? []).map((m) => m.visit_id));

  const noResponseVisits = (todayVisits ?? []).filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (v: any) => v.status === 'scheduled' && v.confirm_status === 'pending' && !v.last_customer_action_at && sentIds.has(v.id),
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">{org.name}</h1>
      <p className="text-gray-500 mb-6">Today&apos;s route — {todayInOrg}</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <BucketCard title="Pending" count={pending.length} color="yellow" visits={pending} />
        <BucketCard title="Confirmed" count={confirmed.length} color="green" visits={confirmed} />
        <BucketCard title="Needs Reschedule" count={needsReschedule.length} color="orange" visits={needsReschedule} showError />
        <BucketCard title="Skipped" count={skipped.length} color="gray" visits={skipped} />
      </div>

      {noResponseVisits.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">No response yet</h2>
          <div className="space-y-2">
            {noResponseVisits.map((v) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const cust = (v.subscriptions as any)?.customers;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const route = (v.subscriptions as any)?.routes;
              return (
                <div key={v.id} className="flex items-center justify-between bg-white border rounded-xl p-4">
                  <div>
                    <p className="font-medium">{cust?.name ?? '—'}</p>
                    <p className="text-sm text-gray-500">{route?.window_label ?? 'Anytime'}</p>
                  </div>
                  <span className="text-sm text-gray-400">Reminder sent</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(recentChanges?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Recent changes</h2>
          <div className="space-y-2">
            {recentChanges!.map((v) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const cust = (v.subscriptions as any)?.customers;
              const label = v.confirm_status === 'confirmed' ? '✅ Confirmed'
                : v.confirm_status === 'rescheduled' ? '🔁 Rescheduled'
                : v.status === 'skipped' ? '⏭ Skipped' : v.confirm_status;
              return (
                <div key={v.id} className="flex items-center justify-between bg-white border rounded-xl p-4">
                  <p className="font-medium">{cust?.name ?? '—'}</p>
                  <span className="text-sm text-gray-600">{label}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BucketCard({ title, count, color, visits, showError = false }: { title: string; count: number; color: string; visits: any[]; showError?: boolean }) {
  const colorMap: Record<string, string> = {
    yellow: 'border-yellow-300 bg-yellow-50',
    green: 'border-green-300 bg-green-50',
    orange: 'border-orange-300 bg-orange-50',
    gray: 'border-gray-200 bg-gray-50',
  };

  return (
    <div className={`border rounded-2xl p-4 ${colorMap[color] ?? ''}`}>
      <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
      <p className="text-3xl font-bold mb-2">{count}</p>
      <div className="space-y-1">
        {visits.slice(0, 5).map((v) => {
          const cust = v.subscriptions?.customers;
          const hasError = showError && v.calendar_sync_error;
          return (
            <p key={v.id} className="text-sm text-gray-700 truncate">
              {cust?.name ?? '—'}
              {hasError && <span className="ml-1 text-orange-600 text-xs">⚠ calendar</span>}
            </p>
          );
        })}
        {visits.length > 5 && <p className="text-xs text-gray-400">+{visits.length - 5} more</p>}
      </div>
    </div>
  );
}
