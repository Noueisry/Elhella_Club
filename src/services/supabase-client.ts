import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  if (env.configurationError) throw new Error(env.configurationError);
  return client ??= createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'smd-supabase-auth' },
  });
}
export function loginEmail(login: string): string {
  const value = login.trim().toLowerCase();
  return value.includes('@') ? value : `${value}@${env.loginDomain}`;
}
