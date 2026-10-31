export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  storeUrl: process.env.NEXT_PUBLIC_STORE_URL ?? 'https://kora.example.com',
  // The hosted panel is static: its server actions (import, rates) live in the panel-api edge function.
  // Empty when the panel runs with its own Next server (local, tests), which answers /api/* itself.
  panelApi: process.env.NEXT_PUBLIC_PANEL_API ?? '',
};
export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
