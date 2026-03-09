// lib/tokens/actionTokens.ts
// Opaque action token generation and resolution.
// Tokens are random, contain no PII, and expire after TOKEN_TTL_HOURS.

import { createServiceClient } from '@/lib/db/client';
import { randomBytes } from 'crypto';

const TOKEN_TTL_HOURS = 72;

/**
 * Get or create an action token for a visit.
 * Reuses an existing non-expired token to avoid token sprawl.
 */
export async function getOrCreateActionToken(
  organisationId: string,
  visitId: string,
): Promise<string> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('visit_action_tokens')
    .select('token, expires_at')
    .eq('organisation_id', organisationId)
    .eq('visit_id', visitId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.token;

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('visit_action_tokens').insert({
    organisation_id: organisationId,
    visit_id: visitId,
    token,
    expires_at: expiresAt,
  });

  if (error) throw new Error(`Failed to create action token: ${error.message}`);

  return token;
}

export interface ResolvedToken {
  visitId: string;
  organisationId: string;
}

/**
 * Resolve a token. Returns null if not found or expired. Never leaks PII.
 */
export async function resolveActionToken(token: string): Promise<ResolvedToken | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('visit_action_tokens')
    .select('visit_id, organisation_id, expires_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!data) return null;

  return {
    visitId: data.visit_id,
    organisationId: data.organisation_id,
  };
}
