// app/(app)/layout.tsx — Auth guard for all protected routes
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">CleanOps</span>
        <div className="flex gap-4 text-sm text-gray-600">
          <a href="/dashboard/today" className="hover:text-gray-900">Today</a>
          <a href="/customers" className="hover:text-gray-900">Customers</a>
          <a href="/settings/templates" className="hover:text-gray-900">Templates</a>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
