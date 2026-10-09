export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  storeUrl: process.env.NEXT_PUBLIC_STORE_URL ?? 'https://kora.example.com',
};
export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
