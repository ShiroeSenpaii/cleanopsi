// app/api/webhooks/twilio/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/db/client';
import { validateTwilioSignature } from '@/lib/twilio/webhook';
import { decrypt } from '@/lib/crypto';

const TWILIO_TO_INTERNAL: Record<string, string> = {
  queued: 'queued', sending: 'queued', sent: 'sent',
  delivered: 'delivered', undelivered: 'undelivered', failed: 'failed',
};

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) params[key] = String(value);

  const messageSid = params['MessageSid'] ?? '';
  const messageStatus = params['MessageStatus'] ?? '';
  const errorCode = params['ErrorCode'] ? parseInt(params['ErrorCode'], 10) : null;

  if (!messageSid) return NextResponse.json({ error: 'Missing MessageSid' }, { status: 400 });

  const { data: messageRecord } = await supabase
    .from('messages')
    .select('id, organisation_id')
    .eq('twilio_message_sid', messageSid)
    .maybeSingle();

  if (!messageRecord) {
    // Unmatched SID — store for debugging, do not crash
    await supabase.from('unmatched_webhook_events').insert({
      twilio_message_sid: messageSid,
      payload_json: params,
    });
    return NextResponse.json({ ok: true, unmatched: true });
  }

  // Validate signature
  const { data: twilioInteg } = await supabase
    .from('integrations_twilio')
    .select('auth_token_enc')
    .eq('organisation_id', messageRecord.organisation_id)
    .maybeSingle();

  if (twilioInteg) {
    const authToken = decrypt(twilioInteg.auth_token_enc);
    const signature = request.headers.get('x-twilio-signature') ?? '';
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/twilio/status`;
    if (!validateTwilioSignature(authToken, signature, url, params)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }
  }

  const internalStatus = TWILIO_TO_INTERNAL[messageStatus] ?? messageStatus;
  await supabase.from('messages').update({ status: internalStatus, error_code: errorCode }).eq('id', messageRecord.id);

  return NextResponse.json({ ok: true });
}
