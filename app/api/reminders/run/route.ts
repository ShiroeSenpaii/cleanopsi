// app/api/reminders/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runReminderJob } from '@/lib/scheduler/reminderJob';

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  try {
    const result = await runReminderJob();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[reminders/run] job error', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
