// lib/twilio/webhook.ts
// Twilio webhook signature validation.

import twilio from 'twilio';

/**
 * Validate the X-Twilio-Signature header.
 * Returns true if valid, false otherwise.
 */
export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  return twilio.validateRequest(authToken, signature, url, params);
}
