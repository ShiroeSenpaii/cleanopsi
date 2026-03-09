// lib/scheduler/reminderJob.ts
// Core reminder job logic. Called by Edge Function cron or POST /api/reminders/run.
// Each send is independent — one failure does not abort the batch.

import { createServiceClient } from '@/lib/db/client';
import { isPhoneSuppressed } from '@/lib/suppression/check';
import { sendSMS } from '@/lib/twilio/send';
import { getOrCreateActionToken } from '@/lib/tokens/actionTokens';
import { renderTemplate } from '@/lib/templates/defaults';
import { toZonedTime, format as formatTZ } from 'date-fns-tz';
import { addHours, format } from 'date-fns';
import { MessageStatus } from '@/lib/enums';

interface ReminderJobResult {
  sent: number;
  suppressed: number;
  failed: number;
  skipped: number;
}

export async function runReminderJob(now?: Date): Promise<ReminderJobResult> {
  const supabase = createServiceClient();
  const effectiveNow = now ?? new Date();
  const result: ReminderJobResult = { sent: 0, suppressed: 0, failed: 0, skipped: 0 };

  const { data: orgs } = await supabase.from('organisations').select('id, name, tz');
  if (!orgs) return result;

  for (const org of orgs) {
    await processOrgReminders(supabase, org, effectiveNow, result);
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processOrgReminders(supabase: any, org: { id: string; name: string; tz: string }, now: Date, result: ReminderJobResult) {
  const tomorrowInOrg = toZonedTime(addHours(now, 24), org.tz);
  const tomorrowDate = formatTZ(tomorrowInOrg, 'yyyy-MM-dd', { timeZone: org.tz });

  // 24h reminders
  const { data: due24h } = await supabase
    .from('visits')
    .select(`id, organisation_id, subscription_id, scheduled_date, scheduled_start, scheduled_end,
      subscriptions(customer_id, route_id, customers(name, phone_e164), routes(window_label, is_anytime, reminder_rule_json))`)
    .eq('organisation_id', org.id)
    .eq('scheduled_date', tomorrowDate)
    .eq('status', 'scheduled')
    .eq('confirm_status', 'pending');

  for (const visit of due24h ?? []) {
    const { data: existingMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('visit_id', visit.id)
      .eq('template_key', 'reminder_24h')
      .maybeSingle();

    if (existingMsg) { result.skipped++; continue; }
    await sendVisitReminder({ supabase, visit, org, templateKey: 'reminder_24h', result });
  }

  // 2h reminders (timed visits only, never anytime)
  const windowStart = addHours(now, 1.833).toISOString();
  const windowEnd = addHours(now, 2.167).toISOString();

  const { data: due2h } = await supabase
    .from('visits')
    .select(`id, organisation_id, subscription_id, scheduled_date, scheduled_start, scheduled_end,
      subscriptions(customer_id, route_id, customers(name, phone_e164), routes(window_label, is_anytime, reminder_rule_json))`)
    .eq('organisation_id', org.id)
    .eq('status', 'scheduled')
    .eq('confirm_status', 'pending')
    .not('scheduled_start', 'is', null)
    .gte('scheduled_start', windowStart)
    .lte('scheduled_start', windowEnd);

  for (const visit of due2h ?? []) {
    const { data: existingMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('visit_id', visit.id)
      .eq('template_key', 'reminder_2h')
      .maybeSingle();

    if (existingMsg) { result.skipped++; continue; }
    await sendVisitReminder({ supabase, visit, org, templateKey: 'reminder_2h', result });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendVisitReminder(params: { supabase: any; visit: any; org: { id: string; name: string; tz: string }; templateKey: 'reminder_24h' | 'reminder_2h'; result: ReminderJobResult }) {
  const { supabase, visit, org, templateKey, result } = params;
  const customer = visit.subscriptions?.customers;
  const route = visit.subscriptions?.routes;

  if (!customer?.phone_e164) { result.skipped++; return; }

  // Suppression check — MUST run before every send
  const suppression = await isPhoneSuppressed(org.id, customer.phone_e164);
  if (suppression.suppressed) {
    await supabase.from('messages').insert({
      organisation_id: org.id,
      visit_id: visit.id,
      template_key: templateKey,
      direction: 'outbound',
      to_e164: customer.phone_e164,
      from_e164: null,
      body: '[suppressed — not sent]',
      twilio_message_sid: null,
      status: MessageStatus.SUPPRESSED,
      error_code: null,
      suppression_triggered: true,
    });
    result.suppressed++;
    return;
  }

  let actionToken: string;
  try {
    actionToken = await getOrCreateActionToken(org.id, visit.id);
  } catch (err) {
    console.error('[reminderJob] token generation failed', { visitId: visit.id, err });
    result.failed++;
    return;
  }

  const actionUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/r/${actionToken}`;
  const windowText = route?.is_anytime ? '' : ` (${route?.window_label ?? ''})`;

  const { data: tmpl } = await supabase
    .from('message_templates')
    .select('body, enabled')
    .eq('organisation_id', org.id)
    .eq('key', templateKey)
    .maybeSingle();

  if (tmpl && !tmpl.enabled) { result.skipped++; return; }

  const visitDateDisplay = visit.scheduled_date
    ? new Date(visit.scheduled_date + 'T12:00:00Z').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', timeZone: org.tz,
      })
    : visit.scheduled_date;

  const defaultBody = templateKey === 'reminder_24h'
    ? `Hi {{customer_name}}, this is a reminder that {{business_name}} has a visit scheduled for you tomorrow{{window_text}}.\n\nPlease let us know: {{action_url}}\n\nReply STOP to opt out.`
    : `Hi {{customer_name}}, {{business_name}} is on the way for your {{window_text}} visit today.\n\nConfirm or make changes: {{action_url}}\n\nReply STOP to opt out.`;

  const body = renderTemplate(tmpl?.body ?? defaultBody, {
    customer_name: customer.name ?? 'there',
    business_name: org.name,
    window_text: windowText,
    action_url: actionUrl,
    visit_date: visitDateDisplay,
  });

  const sendResult = await sendSMS({
    organisationId: org.id,
    visitId: visit.id,
    toE164: customer.phone_e164,
    body,
    templateKey,
    statusCallbackUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/twilio/status`,
  });

  if (sendResult.status === MessageStatus.FAILED) {
    result.failed++;
  } else {
    result.sent++;
  }
}
