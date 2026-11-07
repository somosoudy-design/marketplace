-- =====================================================================
-- Version 20261009154233 = the one the Supabase connector recorded when applying it to the remote project.
-- Scheduled jobs call the internal edge functions (rates-sync, push-dispatch) with a random token that
-- lives only in Supabase Vault, instead of the service role key. The database never holds the master
-- key, nobody has to copy it by hand, and the token can only start those jobs: the functions check it
-- through job_token_valid, which only the service role may run.
--  * Vault `kora_job_token`: created here once (256 random bits) and never shown.
--  * Vault `kora_project_url`: the project's https URL, stored by the operator (docs/INSTALACION.md).
-- Without Vault (plain local Postgres) or without the URL the jobs stay a no-op with a notice.
-- =====================================================================

do $$
begin
  if to_regnamespace('vault') is not null
     and not exists (select 1 from vault.secrets where name = 'kora_job_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'kora_job_token',
      'Lets pg_cron start the rates-sync and push-dispatch edge functions (checked by public.job_token_valid).');
  end if;
end $$;

create or replace function public.invoke_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_url text; v_token text;
begin
  if not public.is_service_role() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_name !~ '^[a-z0-9-]{1,40}$' then raise exception 'invalid function name' using errcode = '22023'; end if;
  if to_regnamespace('vault') is null then
    raise notice 'edge function % not called: Supabase Vault is not available', p_name;
    return null;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'kora_project_url';
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'kora_job_token';
  if v_url is null or v_token is null then
    raise notice 'edge function % not called: vault secrets kora_project_url / kora_job_token are missing', p_name;
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_name,
    headers := jsonb_build_object('content-type', 'application/json', 'x-kora-job-token', v_token),
    body := coalesce(p_body, '{}'::jsonb),
    timeout_milliseconds := 30000);
end $$;

-- Hashes both sides before comparing, so the time taken says nothing about how much of a guess matched.
create or replace function public.job_token_valid(p_token text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_token text;
begin
  if p_token is null or length(p_token) < 32 or to_regnamespace('vault') is null then return false; end if;
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'kora_job_token';
  return v_token is not null and sha256(convert_to(p_token, 'UTF8')) = sha256(convert_to(v_token, 'UTF8'));
end $$;

revoke execute on function public.job_token_valid(text) from public, anon, authenticated;
grant execute on function public.job_token_valid(text) to service_role;
