// lib/suppression/check.ts
// Suppression check gate — must be called before every outbound send.
// Uses the service-role Supabase client to bypass RLS (called from server/edge).

import { createServiceClient } from '@/lib/db/client';

export interface SuppressionCheckResult {
  suppressed: boolean;
  reason?: string;
  suppressedAt?: string;
}

/**
 * Check whether a phone number is suppressed for the given organisation.
 * This MUST be called before every outbound send without exception.
 */
export async function isPhoneSuppressed(
  organisationId: string,
  phoneE164: string,
): Promise<SuppressionCheckResult> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('suppression_list')
    .select('reason, suppressed_at')
    .eq('organisation_id', organisationId)
    .eq('phone_e164', phoneE164)
    .maybeSingle();

  if (error) {
    // If suppression check itself errors, default to suppressed (safe fail).
    console.error('[suppression] check error, defaulting to suppressed', {
      organisationId,
      error: error.message,
    });
    return { suppressed: true, reason: 'check_error' };
  }

  if (data) {
    return {
      suppressed: true,
      reason: data.reason,
      suppressedAt: data.suppressed_at,
    };
  }

  return { suppressed: false };
}

/**
 * STOP-like phrase detection.
 * Returns true if the message body should be treated as an opt-out.
 * Normalises to lowercase, strips punctuation before matching.
 */
export function isStopLikePhrase(body: string): boolean {
  const normalised = body
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const STOP_PATTERNS = [
    'stop',
    'unsubscribe',
    'cancel',
    'end',
    'quit',
    'revoke',
    'opt out',
    'stop texting',
    'stop texting me',
    'please stop',
    'please stop texting',
    'please stop texting me',
    'do not text',
    'dont text',
    'no more texts',
    'remove me',
  ];

  // Exact full-message match OR starts-with for short messages
  for (const pattern of STOP_PATTERNS) {
    if (normalised === pattern || normalised.startsWith(pattern + ' ')) {
      return true;
    }
  }

  // Substring match only for clearly unambiguous phrases
  const SUBSTRING_PATTERNS = ['opt out', 'stop texting', 'no more texts', 'remove me'];
  for (const pattern of SUBSTRING_PATTERNS) {
    if (normalised.includes(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Add a phone to the suppression list. Idempotent via upsert.
 */
export async function suppressPhone(params: {
  organisationId: string;
  phoneE164: string;
  reason: 'stop_keyword' | 'stop_like_phrase' | 'manual' | 'complaint';
  rawBody?: string;
}): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.from('suppression_list').upsert(
    {
      organisation_id: params.organisationId,
      phone_e164: params.phoneE164,
      suppressed_at: new Date().toISOString(),
      reason: params.reason,
      raw_body: params.rawBody ?? null,
    },
    { onConflict: 'organisation_id,phone_e164' },
  );

  if (error) {
    console.error('[suppression] failed to suppress phone', {
      organisationId: params.organisationId,
      error: error.message,
    });
    throw error;
  }
}
