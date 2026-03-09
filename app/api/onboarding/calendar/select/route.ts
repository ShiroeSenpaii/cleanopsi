// app/api/onboarding/calendar/select/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/db/client';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => ({}));
  const calendarId = (body.calendarId ?? '').trim();
  if (!calendarId) return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });

  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from('integrations_google')
    .update({ calendar_id: calendarId })
    .eq('organisation_id', orgUser.organisation_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await serviceClient
    .from('organisations')
    .update({ onboarding_step: 'import' })
    .eq('id', orgUser.organisation_id);

  return NextResponse.json({ ok: true });
}
