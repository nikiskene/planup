import type { Config } from './billing.ts';
export function configuration(): Config {
  return {
    supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
    anonKey: Deno.env.get('SUPABASE_ANON_KEY') || '',
    serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    stripeKey: Deno.env.get('STRIPE_SECRET_KEY') || '',
    webhookSecret: Deno.env.get('STRIPE_WEBHOOK_SECRET') || '',
    appUrl: Deno.env.get('WRXS_APP_URL') || 'https://wrxs.cc',
    enabled: Deno.env.get('WRXS_BILLING_ENABLED') === 'true',
    live: true,
  };
}
