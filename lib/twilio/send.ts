// lib/twilio/send.ts
// Twilio outbound message sending.
// ALWAYS call isPhoneSuppressed() before calling sendSMS().

import twilio from 'twilio';
import { createServiceClient } from '@/lib/db/client';
import { decrypt } from '@/lib/crypto';
import { MessageStatus, MessageDirection } from '@/lib/enums';

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string | null;
  fromNumber: string | null;
}

export async function getTwilioCredentials(
  organisationId: string,
): Promise<TwilioCredentials | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('integrations_twilio')
    .select('account_sid, auth_token_enc, messaging_service_sid, from_number')
    .eq('organisation_id', organisationId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    accountSid: data.account_sid,
    authToken: decrypt(data.auth_token_enc),
    messagingServiceSid: data.messaging_service_sid,
    fromNumber: data.from_number,
  };
}

interface SendSMSParams {
  organisationId: string;
  visitId: string | null;
  toE164: string;
  body: string;
  templateKey: string | null;
  statusCallbackUrl: string;
}

interface SendSMSResult {
  messageSid: string | null;
  status: string;
  errorCode: number | null;
  errorMessage: string | null;
}

/**
 * Send an outbound SMS via Twilio and log the message record.
 * Caller MUST have already verified suppression status.
 */
export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  const supabase = createServiceClient();
  const creds = await getTwilioCredentials(params.organisationId);

  if (!creds) {
    await logMessage(supabase, {
      organisationId: params.organisationId,
      visitId: params.visitId,
      templateKey: params.templateKey,
      direction: MessageDirection.OUTBOUND,
      toE164: params.toE164,
      fromE164: null,
      body: params.body,
      messageSid: null,
      status: MessageStatus.FAILED,
      errorCode: null,
    });
    return {
      messageSid: null,
      status: MessageStatus.FAILED,
      errorCode: null,
      errorMessage: 'No Twilio credentials configured for organisation',
    };
  }

  const client = twilio(creds.accountSid, creds.authToken);

  try {
    const message = await client.messages.create({
      body: params.body,
      to: params.toE164,
      ...(creds.messagingServiceSid
        ? { messagingServiceSid: creds.messagingServiceSid }
        : { from: creds.fromNumber! }),
      statusCallback: params.statusCallbackUrl,
    });

    await logMessage(supabase, {
      organisationId: params.organisationId,
      visitId: params.visitId,
      templateKey: params.templateKey,
      direction: MessageDirection.OUTBOUND,
      toE164: params.toE164,
      fromE164: creds.fromNumber ?? null,
      body: params.body,
      messageSid: message.sid,
      status: MessageStatus.QUEUED,
      errorCode: null,
    });

    return { messageSid: message.sid, status: MessageStatus.QUEUED, errorCode: null, errorMessage: null };
  } catch (err: unknown) {
    const twilioErr = err as { code?: number; message?: string };
    const errorCode = twilioErr.code ?? null;

    await logMessage(supabase, {
      organisationId: params.organisationId,
      visitId: params.visitId,
      templateKey: params.templateKey,
      direction: MessageDirection.OUTBOUND,
      toE164: params.toE164,
      fromE164: null,
      body: params.body,
      messageSid: null,
      status: MessageStatus.FAILED,
      errorCode,
    });

    console.error('[sendSMS] Twilio send failed', { organisationId: params.organisationId, errorCode, errorMessage: twilioErr.message });

    return {
      messageSid: null,
      status: MessageStatus.FAILED,
      errorCode,
      errorMessage: twilioErr.message ?? 'Twilio send failed',
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logMessage(supabase: any, data: {
  organisationId: string;
  visitId: string | null;
  templateKey: string | null;
  direction: string;
  toE164: string;
  fromE164: string | null;
  body: string;
  messageSid: string | null;
  status: string;
  errorCode: number | null;
}) {
  const { error } = await supabase.from('messages').insert({
    organisation_id: data.organisationId,
    visit_id: data.visitId,
    template_key: data.templateKey,
    direction: data.direction,
    to_e164: data.toE164,
    from_e164: data.fromE164,
    body: data.body,
    twilio_message_sid: data.messageSid,
    status: data.status,
    error_code: data.errorCode,
  });
  if (error) console.error('[sendSMS] failed to log message record', error.message);
}
