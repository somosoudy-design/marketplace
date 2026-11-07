export const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};
export const configured = Boolean(env.url && env.anon);
