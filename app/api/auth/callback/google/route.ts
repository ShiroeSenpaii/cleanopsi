// app/api/auth/callback/google/route.ts
// Handles Google OAuth2 redirect. Exchanges code for tokens, stores encrypted
// refresh token, and redirects to calendar picker.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/db/client';
import { encrypt } from '@/lib/crypto';
import { cookies } from 'next/headers';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { data: orgUser } = await supabase
    .from('users')
    .select('organisation_id')
    .eq('id', user.id)
    .single();

  if (!orgUser?.organisation_id) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    const reason = error ?? 'no_code';
    console.error('[google/callback] OAuth error:', reason);
    return NextResponse.redirect(
      new URL(`/onboarding/calendar?error=${encodeURIComponent(reason)}`, request.url),
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  let tokens;
  try {
    const { tokens: exchanged } = await oauth2Client.getToken(code);
    tokens = exchanged;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[google/callback] token exchange failed:', msg);
    return NextResponse.redirect(
      new URL(`/onboarding/calendar?error=${encodeURIComponent('token_exchange_failed')}`, request.url),
    );
  }

  if (!tokens.refresh_token) {
    // Google only returns refresh_token on first authorisation.
    // If missing, revoke and re-prompt with access_type=offline&prompt=consent.
    console.warn('[google/callback] no refresh_token returned — user may need to re-authorise');
    return NextResponse.redirect(
      new URL('/onboarding/calendar?error=no_refresh_token', request.url),
    );
  }

  const serviceClient = createServiceClient();
  const { error: upsertErr } = await serviceClient
    .from('integrations_google')
    .upsert(
      {
        organisation_id: orgUser.organisation_id,
        refresh_token_enc: encrypt(tokens.refresh_token),
        access_token_enc: tokens.access_token ? encrypt(tokens.access_token) : null,
        token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        calendar_id: null, // set after user picks calendar
      },
      { onConflict: 'organisation_id' },
    );

  if (upsertErr) {
    console.error('[google/callback] DB upsert failed:', upsertErr.message);
    return NextResponse.redirect(
      new URL('/onboarding/calendar?error=db_error', request.url),
    );
  }

  // Advance onboarding step if still at 'calendar'
  await serviceClient
    .from('organisations')
    .update({ onboarding_step: 'import' })
    .eq('id', orgUser.organisation_id)
    .eq('onboarding_step', 'calendar');

  return NextResponse.redirect(new URL('/onboarding/calendar/pick', request.url));
}
