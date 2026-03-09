// app/api/webhooks/twilio/inbound/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/db/client';
import { validateTwilioSignature } from '@/lib/twilio/webhook';
import { isStopLikePhrase, suppressPhone } from '@/lib/suppression/check';
import { sendSMS } from '@/lib/twilio/send';
import { decrypt } from '@/lib/crypto';
import { MessageStatus, MessageDirection } from '@/lib/enums';

const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) params[key] = String(value);

  const from = params['From'] ?? '';
  const body = params['Body'] ?? '';
  const messageSid = params['MessageSid'] ?? '';
  const to = params['To'] ?? '';

  if (!from || !messageSid) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Find org by the "To" number
  const { data: twilioInteg } = await supabase
    .from('integrations_twilio')
    .select('organisation_id, auth_token_enc')
    .or(`from_number.eq.${to},messaging_service_sid.eq.${to}`)
    .maybeSingle();

  if (!twilioInteg) {
    console.warn('[twilio/inbound] no matching org for To number', { to });
    return NextResponse.json({ error: 'Unrecognised sender' }, { status: 403 });
  }

  // Validate signature
  const signature = request.headers.get('x-twilio-signature') ?? '';
  const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/twilio/inbound`;
  const authToken = decrypt(twilioInteg.auth_token_enc);
  const isValid = validateTwilioSignature(authToken, signature, url, params);

  if (!isValid) {
    console.warn('[twilio/inbound] invalid signature', { from, messageSid });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const organisationId = twilioInteg.organisation_id;

  // Log the inbound message
  await supabase.from('messages').insert({
    organisation_id: organisationId,
    visit_id: null,
    direction: MessageDirection.INBOUND,
    to_e164: to,
    from_e164: from,
    body,
    twilio_message_sid: messageSid,
    status: MessageStatus.INBOUND_RECEIVED,
    suppression_triggered: false,
  });

  const bodyLower = body.toLowerCase().trim();

  // STOP-like handling
  if (isStopLikePhrase(body)) {
    const reason = bodyLower === 'stop' ? 'stop_keyword' : 'stop_like_phrase';
    await suppressPhone({ organisationId, phoneE164: from, reason, rawBody: body });
    await supabase.from('messages').update({ suppression_triggered: true }).eq('twilio_message_sid', messageSid);
    return new NextResponse(TWIML_EMPTY, { headers: { 'Content-Type': 'text/xml' } });
  }

  // HELP handling
  if (bodyLower === 'help' || bodyLower.includes('help')) {
    const { data: org } = await supabase
      .from('organisations')
      .select('name, support_email, support_phone')
      .eq('id', organisationId)
      .single();

    const supportContact = org?.support_email ?? org?.support_phone ?? 'us directly';
    const helpBody = `For help with your ${org?.name ?? ''} service, please contact ${supportContact}. Reply STOP to opt out.`;

    await sendSMS({
      organisationId,
      visitId: null,
      toE164: from,
      body: helpBody,
      templateKey: 'help_reply',
      statusCallbackUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/twilio/status`,
    });

    return new NextResponse(TWIML_EMPTY, { headers: { 'Content-Type': 'text/xml' } });
  }

  // Other inbound: already logged above, no action
  return new NextResponse(TWIML_EMPTY, { headers: { 'Content-Type': 'text/xml' } });
}
