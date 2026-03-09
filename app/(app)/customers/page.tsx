// app/(app)/customers/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function CustomersPage() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: orgUser } = await supabase.from('users').select('organisation_id').eq('id', user.id).single();
  if (!orgUser) redirect('/login');

  const { data: customers } = await supabase
    .from('customers')
    .select(`id, name, phone_e164, consent_status, created_at,
      subscriptions(frequency, routes(weekday, window_label), active)`)
    .eq('organisation_id', orgUser.organisation_id)
    .order('name');

  const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <a href="/onboarding/import" className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">Import CSV</a>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden">
        {(customers ?? []).length === 0 ? (
          <p className="p-8 text-center text-gray-500">No customers yet. <a href="/onboarding/import" className="text-blue-600 underline">Import a CSV</a> to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Route</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Frequency</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Consent</th>
              </tr>
            </thead>
            <tbody>
              {customers!.map((c) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const sub = (c.subscriptions as any[])?.[0];
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{c.phone_e164}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {sub ? `${WEEKDAY_NAMES[sub.routes?.weekday ?? 0]} — ${sub.routes?.window_label ?? 'Anytime'}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{sub?.frequency ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.consent_status === 'opted_in' ? 'bg-green-100 text-green-700' :
                        c.consent_status === 'opted_out' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{c.consent_status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
