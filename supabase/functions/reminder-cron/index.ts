// supabase/functions/reminder-cron/index.ts
// Invoked by pg_cron every 15 minutes.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';

serve(async (_req) => {
  try {
    const baseUrl = Deno.env.get('NEXT_PUBLIC_BASE_URL') ?? '';
    const secret = Deno.env.get('CRON_SECRET') ?? '';

    const res = await fetch(`${baseUrl}/api/reminders/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
      body: JSON.stringify({ source: 'cron' }),
    });

    const result = await res.json();
    console.log('[reminder-cron] result', result);

    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[reminder-cron] error', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
