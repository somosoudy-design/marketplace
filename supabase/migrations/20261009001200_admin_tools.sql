-- Admin tools for the web panel: user lookup, role management, store membership by email and
-- processing of account deletion requests. Every function authorizes itself and writes to the audit log.

-- ---------- user directory (admins) ----------
create or replace function public.admin_users(p_query text default null, p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_q text := nullif(trim(coalesce(p_query, '')), '');
begin
  perform public.require_admin();
  return coalesce((
    select jsonb_agg(row_to_json(x) order by x.created_at desc)
      from (
        select u.id, u.email, p.full_name, p.phone, u.created_at, u.last_sign_in_at,
               (u.banned_until is not null and u.banned_until > now()) as blocked,
               coalesce((select array_agg(r.role::text order by r.role) from public.user_roles r where r.user_id = u.id), '{}') as roles,
               coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'role', m.role))
                           from public.store_members m join public.stores s on s.id = m.store_id where m.user_id = u.id), '[]'::jsonb) as stores,
               (select d.status from public.account_deletion_requests d where d.user_id = u.id order by d.requested_at desc limit 1) as deletion_status
          from auth.users u
          left join public.profiles p on p.id = u.id
         where v_q is null
            or u.email ilike '%' || v_q || '%'
            or p.full_name ilike '%' || v_q || '%'
            or u.id::text = v_q
         order by u.created_at desc
         limit least(greatest(coalesce(p_limit, 50), 1), 200)
      ) x), '[]'::jsonb);
end $$;

-- ---------- platform roles (superadmin only) ----------
create or replace function public.set_user_role(p_user_id uuid, p_role public.app_role, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then
    raise exception 'superadmin required' using errcode = '42501', hint = 'superadmin_required';
  end if;
  if p_user_id = auth.uid() and not p_grant then
    raise exception 'you cannot remove your own roles' using errcode = 'P0001', hint = 'self_role_change';
  end if;
  if p_grant then
    insert into public.user_roles (user_id, role, granted_by) values (p_user_id, p_role, auth.uid())
    on conflict do nothing;
  else
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
  perform public.audit(case when p_grant then 'grant_role' else 'revoke_role' end, 'user', p_user_id::text,
                       jsonb_build_object('role', p_role));
end $$;

-- ---------- store team (admins add people by e-mail) ----------
create or replace function public.add_store_member(p_store_id uuid, p_email text, p_role public.store_member_role default 'staff')
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  v_user uuid;
begin
  perform public.require_admin();
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'no account with that e-mail' using errcode = 'P0002', hint = 'user_not_found';
  end if;
  if not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'store not found' using errcode = 'P0002';
  end if;
  insert into public.store_members (store_id, user_id, role) values (p_store_id, v_user, coalesce(p_role, 'staff'))
  on conflict (store_id, user_id) do update set role = excluded.role;
  perform public.audit('add_member', 'store', p_store_id::text, jsonb_build_object('user_id', v_user, 'role', p_role));
  return v_user;
end $$;

-- ---------- account deletion ----------
-- Approving anonymizes personal data and blocks the login. Orders, payments and ledger entries are kept
-- because accounting and tax records must survive; their delivery addresses are reduced to region and city.
create or replace function public.process_account_deletion(p_request_id uuid, p_approve boolean, p_notes text default null)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_req public.account_deletion_requests%rowtype;
begin
  perform public.require_admin();
  select * into v_req from public.account_deletion_requests where id = p_request_id for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  if v_req.status not in ('requested', 'in_review') then
    raise exception 'request already processed' using errcode = 'P0001', hint = 'already_processed';
  end if;
  if not p_approve and coalesce(trim(p_notes), '') = '' then
    raise exception 'a note is required to decline' using errcode = '22023', hint = 'note_required';
  end if;
  if p_approve and exists (
      select 1 from public.orders o
       where o.buyer_id = v_req.user_id and o.status in ('placed', 'in_progress')) then
    raise exception 'the account has open orders' using errcode = 'P0001', hint = 'open_orders';
  end if;
  if p_approve and exists (select 1 from public.user_roles where user_id = v_req.user_id)
     or p_approve and exists (select 1 from public.store_members where user_id = v_req.user_id) then
    raise exception 'remove staff roles and store access first' using errcode = 'P0001', hint = 'has_roles';
  end if;

  if p_approve then
    update public.profiles
       set full_name = null, phone = null, avatar_path = null, preferences = '{}'::jsonb,
           personalization_enabled = false, marketing_opt_in = false
     where id = v_req.user_id;
    delete from public.addresses where user_id = v_req.user_id;
    delete from public.favorites where user_id = v_req.user_id;
    delete from public.stock_alerts where user_id = v_req.user_id;
    delete from public.user_events where user_id = v_req.user_id;
    delete from public.cart_items where user_id = v_req.user_id;
    delete from public.push_tokens where user_id = v_req.user_id;
    update public.orders
       set ship_to = jsonb_build_object('region_code', ship_to ->> 'region_code', 'city', ship_to ->> 'city', 'anonymized', true)
     where buyer_id = v_req.user_id;
    update public.fulfillments f
       set ship_to = jsonb_build_object('region_code', f.ship_to ->> 'region_code', 'city', f.ship_to ->> 'city', 'anonymized', true)
     where f.order_id in (select id from public.orders where buyer_id = v_req.user_id);
    update public.payments set payer_name = null, payer_phone = null where buyer_id = v_req.user_id;
    update auth.users
       set email = 'eliminado+' || id || '@example.invalid',
           phone = null,
           raw_user_meta_data = '{}'::jsonb,
           banned_until = 'infinity'
     where id = v_req.user_id;
    delete from auth.sessions where user_id = v_req.user_id;
    delete from auth.refresh_tokens where user_id = v_req.user_id::text;
  end if;

  update public.account_deletion_requests
     set status = case when p_approve then 'completed' else 'rejected' end,
         processed_at = now(), processed_by = auth.uid(), notes = p_notes
   where id = p_request_id;
  perform public.audit(case when p_approve then 'account_deleted' else 'deletion_declined' end, 'user', v_req.user_id::text,
                       jsonb_build_object('request_id', p_request_id));
end $$;
