-- Product questions. Forward-only module; no existing business rows are changed.
-- Caller applies this file atomically. No scheduler, service, payment or provider change.
do $$ begin
 if to_regclass('public.product_questions') is not null or to_regnamespace('question_private') is not null then
  raise exception 'Questions module already exists; review instead of replacing';
 end if;
 if to_regprocedure('account_private.session_open()') is null
 or to_regprocedure('account_private.guard_write()') is null
 or md5((select prosrc from pg_proc where oid=to_regprocedure('account_private.blockers(uuid)')))
    is distinct from 'da7c5fff479ae8d60a9e3b34a3cc1c14' then
  raise exception 'Account closure baseline differs; review before applying';
 end if;
end $$;

create schema question_private;
revoke all on schema question_private from public,anon,authenticated,service_role;

create table public.product_questions (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete restrict,
 store_id uuid not null references public.stores(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 body text not null check(char_length(body) between 10 and 500),
 body_key text generated always as (lower(regexp_replace(btrim(body),'\s+',' ','g'))) stored,
 answer_body text check(answer_body is null or char_length(answer_body) between 1 and 1000),
 answered_by uuid references auth.users(id) on delete restrict,
 answered_at timestamptz,
 status text not null default 'published' check(status in('published','hidden')),
 hidden_reason text check(hidden_reason is null or char_length(hidden_reason) between 1 and 300),
 is_demo boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(product_id,user_id,body_key),
 check((answer_body is null and answered_by is null and answered_at is null)
   or (answer_body is not null and answered_by is not null and answered_at is not null)),
 check((status='published' and hidden_reason is null) or (status='hidden' and hidden_reason is not null))
);
create index product_questions_public on public.product_questions(product_id,created_at desc,id desc) where status='published';
create index product_questions_inbox on public.product_questions(store_id,status,created_at,id);
create index product_questions_author on public.product_questions(user_id);
create index product_questions_answered_by on public.product_questions(answered_by) where answered_by is not null;
alter table public.product_questions enable row level security;
-- No direct table read/write API: public RPCs project only the fields a visitor may see.
revoke all on public.product_questions from public,anon,authenticated,service_role;
create policy product_questions_read on public.product_questions for select to anon,authenticated using (
 user_id=auth.uid() or public.is_admin() or public.is_store_member(store_id)
 or (status='published' and answer_body is not null and exists(
   select 1 from public.products p join public.stores s on s.id=p.store_id
   where p.id=product_id and p.moderation_status='published' and s.status='active'))
);
create policy account_open_only on public.product_questions as restrictive for all to authenticated
 using((select account_private.session_open())) with check((select account_private.session_open()));
create trigger account_00_open before insert or update or delete on public.product_questions
 for each statement execute function account_private.guard_write();
create trigger product_questions_touch before update on public.product_questions
 for each row execute function public.touch_updated_at();

-- Reads treat stale/closed credentials as a guest. Writes also call require_user, which acquires
-- the existing account-close shared lock before any question/store row lock.
create function question_private.actor() returns uuid language sql stable security definer set search_path=pg_catalog as $$
 select case when account_private.session_open() then auth.uid() end
$$;
create function question_private.require_actor() returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare u uuid:=public.require_user();
begin
 if question_private.actor() is distinct from u then
  raise exception 'account is unavailable' using errcode='42501',hint='account_closed';
 end if;
 return u;
end $$;

-- Product conversation only. Keep contacts and outside links out of public user-generated text.
-- Conservative phone match requires at least seven digits in one phone-like run; model numbers
-- and ordinary quantities with fewer digits remain valid.
create function question_private.clean_body(p_body text,p_min integer,p_max integer) returns text
language plpgsql immutable set search_path=pg_catalog as $$
declare b text:=btrim(coalesce(p_body,''));
begin
 if char_length(b)<p_min or char_length(b)>p_max or b~'[[:cntrl:]]' and b~'[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' then
  raise exception 'invalid question text length' using errcode='P0001',hint='invalid_input';
 end if;
 if b~*'([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|https?://|www\.|[a-z0-9-]+\.(com|net|org|app|io|me|co|ve|info|biz|ly)([/[:space:]]|$))'
 or b~'(^|[^[:alnum:]])\+?[0-9]([[:space:]().-]*[0-9]){6,}([^[:alnum:]]|$)' then
  raise exception 'contacts are not allowed in public questions' using errcode='P0001',hint='question_contact';
 end if;
 return b;
end $$;

create function question_private.present(q public.product_questions,p_actor uuid,p_manage boolean) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object(
  'id',q.id,'product_id',q.product_id,'store_id',q.store_id,'body',q.body,'answer_body',q.answer_body,
  'created_at',q.created_at,'answered_at',q.answered_at,'status',q.status,'is_demo',q.is_demo,
  'author',case when nullif(btrim(pr.full_name),'') is null then 'Cliente' else public._public_name(pr.full_name) end,
  'mine',coalesce(q.user_id=p_actor,false),
  'hidden_reason',case when p_manage or q.user_id=p_actor then q.hidden_reason end,
  'product_title',p.title,'product_slug',p.slug,'store_name',s.name)
 from public.products p join public.stores s on s.id=p.store_id
 left join public.profiles pr on pr.id=q.user_id where p.id=q.product_id
$$;

create function public.product_questions(p_product_id uuid,p_limit integer default 10,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare u uuid:=question_private.actor(); st uuid; visible boolean:=false; manage boolean:=false; moderator boolean:=false; result jsonb; total bigint;
begin
 select p.store_id,p.moderation_status='published' and s.status='active' into st,visible
  from public.products p join public.stores s on s.id=p.store_id where p.id=p_product_id;
 moderator:=u is not null and public.is_admin();
 manage:=u is not null and (moderator or public.is_store_member(st));
 if st is null or not coalesce(visible,false) and not manage then
  return jsonb_build_object('items','[]'::jsonb,'count',0,'can_ask',false,'can_answer',false,'can_moderate',false);
 end if;
 select count(*) into total from public.product_questions q where q.product_id=p_product_id
  and (manage or q.user_id=u or q.status='published' and q.answer_body is not null);
 select coalesce(jsonb_agg(x.payload order by x.created_at desc,x.id desc),'[]'::jsonb) into result from(
  select question_private.present(q,u,manage) payload,q.created_at,q.id from public.product_questions q
  where q.product_id=p_product_id and (manage or q.user_id=u or q.status='published' and q.answer_body is not null)
  order by q.created_at desc,q.id desc
  limit least(greatest(coalesce(p_limit,10),1),50) offset greatest(coalesce(p_offset,0),0)
 )x;
 return jsonb_build_object('items',result,'count',total,'can_ask',u is not null and coalesce(visible,false),
  'can_answer',manage,'can_moderate',moderator);
end $$;

create function public.store_questions(p_store_id uuid,p_status text default 'pending',p_limit integer default 20,p_offset integer default 0)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare u uuid:=question_private.require_actor(); result jsonb; total bigint;
begin
 perform public.require_store_member(p_store_id);
 if not exists(select 1 from public.stores where id=p_store_id) then
  raise exception 'store not found' using errcode='P0001',hint='not_found';
 end if;
 if p_status is null or p_status not in('pending','answered','hidden','all') then
  raise exception 'invalid inbox filter' using errcode='P0001',hint='invalid_input';
 end if;
 select count(*) into total from public.product_questions q where q.store_id=p_store_id and (
  p_status='all' or p_status='hidden' and q.status='hidden'
  or p_status='pending' and q.status='published' and q.answer_body is null
  or p_status='answered' and q.status='published' and q.answer_body is not null);
 select coalesce(jsonb_agg(x.payload order by x.pending desc,x.created_at,x.id),'[]'::jsonb) into result from(
  select question_private.present(q,u,true) payload,(q.answer_body is null) pending,q.created_at,q.id
  from public.product_questions q where q.store_id=p_store_id and (
   p_status='all' or p_status='hidden' and q.status='hidden'
   or p_status='pending' and q.status='published' and q.answer_body is null
   or p_status='answered' and q.status='published' and q.answer_body is not null)
  order by (q.answer_body is null) desc,q.created_at,q.id
  limit least(greatest(coalesce(p_limit,20),1),50) offset greatest(coalesce(p_offset,0),0)
 )x;
 return jsonb_build_object('items',result,'count',total,'can_ask',false,'can_answer',true,'can_moderate',public.is_admin());
end $$;

create function public.ask_question(p_product_id uuid,p_body text)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare u uuid:=question_private.require_actor(); b text:=question_private.clean_body(p_body,10,500); st uuid; q public.product_questions;
begin
 -- Same actor/product requests serialize. A retry of the same normalized question returns its row,
 -- does not notify twice, does not consume another rate-limit slot, and never republishes hidden content.
 perform pg_advisory_xact_lock(hashtextextended('question:'||u::text||':'||p_product_id::text,0));
 select p.store_id into st from public.products p join public.stores s on s.id=p.store_id
  where p.id=p_product_id and p.moderation_status='published' and s.status='active' for share of p,s;
 if not found then raise exception 'product not available' using errcode='P0001',hint='not_found'; end if;
 select * into q from public.product_questions where product_id=p_product_id and user_id=u
  and body_key=lower(regexp_replace(btrim(b),'\s+',' ','g'));
 if found then return question_private.present(q,u,false); end if;
 perform public.check_rate_limit('question',5,3600);
 insert into public.product_questions(product_id,store_id,user_id,body,is_demo)
 values(p_product_id,st,u,b,coalesce((select is_demo from public.profiles where id=u),false)) returning * into q;
 perform public.notify_store(st,'system','Nueva pregunta sobre tu producto','Tienes una pregunta pendiente de responder.',
  jsonb_build_object('product_id',p_product_id,'question_id',q.id));
 return question_private.present(q,u,false);
end $$;

create function public.answer_question(p_question_id uuid,p_body text)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare u uuid:=question_private.require_actor(); b text:=question_private.clean_body(p_body,1,1000); q public.product_questions;
begin
 select * into q from public.product_questions where id=p_question_id for update;
 if not found then raise exception 'question not found' using errcode='P0001',hint='not_found'; end if;
 perform public.require_store_member(q.store_id);
 if q.answer_body=b then return question_private.present(q,u,true); end if;
 perform public.check_rate_limit('question_answer',60,3600);
 update public.product_questions set answer_body=b,answered_by=u,answered_at=now() where id=q.id returning * into q;
 perform public.audit('question.answer','product_questions',q.id::text,jsonb_build_object('store_id',q.store_id));
 if q.status='published' then
  perform public.notify(q.user_id,'system','La tienda respondió tu pregunta','Puedes revisar la respuesta en la ficha del producto.',
   jsonb_build_object('product_id',q.product_id,'question_id',q.id));
 end if;
 return question_private.present(q,u,true);
end $$;

create function public.moderate_question(p_question_id uuid,p_hide boolean,p_reason text default null)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare u uuid:=question_private.require_actor(); q public.product_questions; reason text:=nullif(btrim(coalesce(p_reason,'')),'');
begin
 perform public.require_admin();
 if p_hide is null or p_hide and (reason is null or char_length(reason)>300) then
  raise exception 'a moderation reason is required' using errcode='P0001',hint='invalid_input';
 end if;
 select * into q from public.product_questions where id=p_question_id for update;
 if not found then raise exception 'question not found' using errcode='P0001',hint='not_found'; end if;
 if q.status=(case when p_hide then 'hidden' else 'published' end) and
    q.hidden_reason is not distinct from (case when p_hide then reason end) then
  return question_private.present(q,u,true);
 end if;
 update public.product_questions set status=case when p_hide then 'hidden' else 'published' end,
  hidden_reason=case when p_hide then reason end where id=q.id returning * into q;
 perform public.audit(case when p_hide then 'question.hide' else 'question.publish' end,'product_questions',q.id::text,
  jsonb_build_object('store_id',q.store_id,'reason',case when p_hide then reason end));
 return question_private.present(q,u,true);
end $$;

-- Explicit function permissions. No privileged helper may be invoked by an API role.
revoke all on function question_private.actor(),question_private.require_actor(),
 question_private.clean_body(text,integer,integer),question_private.present(public.product_questions,uuid,boolean)
 from public,anon,authenticated,service_role;
revoke all on function public.product_questions(uuid,integer,integer),public.store_questions(uuid,text,integer,integer),
 public.ask_question(uuid,text),public.answer_question(uuid,text),public.moderate_question(uuid,boolean,text)
 from public,anon,authenticated,service_role;
grant execute on function public.product_questions(uuid,integer,integer) to anon,authenticated,service_role;
grant execute on function public.store_questions(uuid,text,integer,integer),public.ask_question(uuid,text),
 public.answer_question(uuid,text),public.moderate_question(uuid,boolean,text) to authenticated,service_role;

-- The established closure policy holds authored reviews/free text for classification. Extend exactly
-- that inventory to questions and replies, so a closure never reports completion while ignoring UGC.
-- This does not erase a question, identify an anonymous user, or change any financial retention.
do $$
declare definition text; old_fragment text:='(''reviews'',''user_id''),';
begin
 definition:=pg_get_functiondef('account_private.blockers(uuid)'::regprocedure);
 if position(old_fragment in definition)=0 then raise exception 'Account blocker fragment differs'; end if;
 definition:=replace(definition,old_fragment,old_fragment||'(''product_questions'',''user_id''),(''product_questions'',''answered_by''),');
 execute definition;
end $$;
