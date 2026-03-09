// app/api/onboarding/calendar/list/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { listCalendars } from '@/lib/google/calendar';

export async function GET() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { data: orgUser } = await supabase.from('users').select('organisation_id').eq('id', user.id).single();
  if (!orgUser) return NextResponse.json({ error: 'Not found' }, { status: 403 });

  try {
    const calendars = await listCalendars(orgUser.organisation_id);
    return NextResponse.json({ calendars });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
