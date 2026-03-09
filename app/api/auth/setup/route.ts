// app/api/auth/setup/route.ts
// Creates org + user records after Supabase auth signup.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/db/client';
import { cookies } from 'next/headers';
import { DEFAULT_TEMPLATES } from '@/lib/templates/defaults';

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const businessName = (body.businessName ?? '').trim() || 'My Business';

  const serviceClient = createServiceClient();

  // Check if user already has an org
  const { data: existingUser } = await serviceClient
    .from('users')
    .select('organisation_id')
    .eq('id', user.id)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json({ ok: true, alreadySetup: true });
  }

  // Create organisation
  const { data: org, error: orgErr } = await serviceClient
    .from('organisations')
    .insert({ name: businessName, tz: 'America/New_York', onboarding_step: 'sms' })
    .select('id')
    .single();

  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });

  // Create user record
  const { error: userErr } = await serviceClient
    .from('users')
    .insert({ id: user.id, organisation_id: org.id, role: 'owner' });

  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });

  // Insert default message templates
  const templates = Object.values(DEFAULT_TEMPLATES).map((t) => ({
    organisation_id: org.id,
    key: t.key,
    body: t.body,
    enabled: t.enabled,
  }));

  await serviceClient.from('message_templates').insert(templates);

  return NextResponse.json({ ok: true, organisationId: org.id });
}
