// lib/db/client.ts
// Supabase client factory.
// createServiceClient() — service role, bypasses RLS (server/Edge use only)
// createBrowserClient() — anon key, respects RLS (client components)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

export function createBrowserClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
