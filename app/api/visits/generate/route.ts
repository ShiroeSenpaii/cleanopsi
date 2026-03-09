// app/api/visits/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateVisits } from '@/lib/scheduler/generateVisits';

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { data: orgUser } = await supabase
    .from('users')
    .select('organisation_id')
    .eq('id', user.id)
    .single();

  if (!orgUser?.organisation_id) return NextResponse.json({ error: 'Organisation not found' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const horizonDays = Math.min(Number(body.horizon_days ?? 14), 60);

  const result = await generateVisits({ organisationId: orgUser.organisation_id, horizonDays });
  return NextResponse.json(result);
}
