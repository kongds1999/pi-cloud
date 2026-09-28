/**
 * Server-side Supabase client factory for pi-cloud.
 *
 * Two clients:
 * - `supabaseService()` — service_role, bypasses RLS. Server API routes only.
 * - `supabaseForUser(jwt)` — anon key + user JWT, RLS enforced. Used when
 *   acting strictly on behalf of the signed-in user.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`pi-cloud: missing required env ${name}`);
  return value;
}

export function supabaseService(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(
      required("SUPABASE_URL"),
      required("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return serviceClient;
}

export function supabaseForUser(jwt: string): SupabaseClient {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    },
  );
}
