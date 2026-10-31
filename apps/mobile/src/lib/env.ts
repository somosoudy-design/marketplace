// Public configuration inlined at build time (EXPO_PUBLIC_*). Secrets never belong here.
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
