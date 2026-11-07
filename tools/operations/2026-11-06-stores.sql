-- APPROVED SCOPE PROPOSAL ONLY. Root reviews/tests/executes; this file defaults to ROLLBACK.
-- Only Marketplace mimnotafmfasvwrclxan. No migration, grants, users, memberships or product changes.
-- No network calls between BEGIN and terminator. Actual administrative DB session; no fabricated JWT.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '25s';

DO $guard$
DECLARE v_url text;
BEGIN
  IF session_user NOT IN ('postgres','supabase_admin') OR NOT public.is_service_role() THEN
    RAISE EXCEPTION 'Se requiere una sesión administrativa real; no se aplicó nada.';
  END IF;
  SELECT decrypted_secret INTO STRICT v_url FROM vault.decrypted_secrets WHERE name='kora_project_url';
  IF rtrim(v_url,'/') IS DISTINCT FROM 'https://mimnotafmfasvwrclxan.supabase.co' THEN
    RAISE EXCEPTION 'Proyecto distinto de Marketplace; no se aplicó nada.';
  END IF;
END $guard$;
SELECT pg_advisory_xact_lock(hashtextextended('mayami:tiendas-operativas:2026-11-06',0));
-- READ COMMITTED sees all stores committed before this lock, including during project verification.
-- Prevent concurrent store insertion/status/rename while allowing ordinary reads. Fails after 3s.
-- Protected-table fingerprints also abort if unrelated concurrent writes change the comparison.
LOCK TABLE public.stores IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE _store_expected (
 id uuid PRIMARY KEY,name text,slug text,kind text,old_status text,old_updated_at timestamptz,keep boolean
) ON COMMIT DROP;
INSERT INTO _store_expected VALUES
  ('d474e27d-887d-43e5-8b57-1544fc52e39c'::uuid, 'Casa Lumen', 'casa-lumen', 'seller', 'active', '2026-10-09T23:49:51.366208+00:00'::timestamptz, false),
  ('5afbabbf-0678-40ee-a5d8-540f53efe114'::uuid, 'Mayami', 'kora', 'platform', 'active', '2026-11-06T06:46:31.924697+00:00'::timestamptz, true),
  ('541c710e-f270-4ade-b975-fcc6c7369868'::uuid, 'Nova Gadgets', 'nova-gadgets', 'seller', 'pending', '2026-10-09T23:49:51.366208+00:00'::timestamptz, false),
  ('3d02e33d-f66a-450e-9864-ad8e9d052a36'::uuid, 'OdontoPro Suministros', 'odontopro', 'seller', 'active', '2026-10-09T23:49:51.366208+00:00'::timestamptz, false),
  ('42485d96-8af5-4e75-9d34-beff52deaf62'::uuid, 'Patitas & Co.', 'patitas', 'seller', 'active', '2026-10-09T23:49:51.366208+00:00'::timestamptz, false);
CREATE TEMP TABLE _store_new (id uuid PRIMARY KEY,name text,slug text UNIQUE) ON COMMIT DROP;
INSERT INTO _store_new VALUES
  ('c0ff9064-ca77-4652-99a3-c58de9f261ed', 'Aroma''top', 'aroma-top'),
  ('67791a7e-b246-4ee8-8ecd-34ceab445ecc', 'MilyeDent', 'milyedent');

DO $preconditions$
DECLARE n integer;
BEGIN
  PERFORM 1 FROM public.stores s JOIN _store_expected e USING(id) ORDER BY s.id FOR UPDATE OF s;
  IF (SELECT count(*) FROM public.stores)<>5 OR (SELECT count(*) FROM _store_expected)<>5 THEN
    RAISE EXCEPTION 'Cambió el inventario de tiendas; volver a revisar.';
  END IF;
  SELECT count(*) INTO n FROM public.stores s JOIN _store_expected e USING(id)
   WHERE (s.name,s.slug,s.kind::text,s.status::text,s.updated_at)
         IS NOT DISTINCT FROM (e.name,e.slug,e.kind,e.old_status,e.old_updated_at);
  IF n<>5 THEN RAISE EXCEPTION 'Cambió una tienda/version; ninguna modificación autorizada.'; END IF;
  IF (SELECT count(*) FROM _store_expected WHERE keep)<>1 OR NOT EXISTS (
    SELECT 1 FROM _store_expected WHERE keep AND id='5afbabbf-0678-40ee-a5d8-540f53efe114'
      AND name='Mayami' AND slug='kora' AND kind='platform' AND old_status='active'
  ) THEN RAISE EXCEPTION 'La identidad de Mayami no coincide.'; END IF;
  IF EXISTS (SELECT 1 FROM public.stores s JOIN _store_new n ON s.id=n.id OR s.slug=n.slug
    OR lower(regexp_replace(s.name,'[^[:alnum:]]','','g'))=lower(regexp_replace(n.name,'[^[:alnum:]]','','g')))
  THEN RAISE EXCEPTION 'Una tienda nueva ya existe o es ambigua; no duplicar.'; END IF;
  IF (SELECT count(*) FROM _store_new)<>2 THEN RAISE EXCEPTION 'Deben existir exactamente dos propuestas nuevas.'; END IF;
END $preconditions$;

CREATE TEMP TABLE _stores_before ON COMMIT DROP AS
 SELECT id,to_jsonb(s) AS data FROM public.stores s;
CREATE TEMP TABLE _integrity_before (entity text PRIMARY KEY,row_count bigint,fingerprint text) ON COMMIT DROP;
CREATE TEMP TABLE _audit_before ON COMMIT DROP AS SELECT coalesce(max(id),0) AS last_id FROM public.audit_log;

DO $snapshot$
DECLARE tab text; n bigint; fingerprint text;
BEGIN
  FOREACH tab IN ARRAY ARRAY[
    'products','product_variants','product_images','product_costs','variant_costs','moderation_events',
    'store_members','user_roles','collections','collection_products','shipping_rates','commission_rules',
    'orders','order_items','fulfillments','fulfillment_events','payment_methods','payment_quotes',
    'payments','payment_obligations','payment_allocations','ledger_entries','payouts','refunds',
    'claims','claim_messages','cart_items','favorites','stock_alerts'
  ] LOOP
    EXECUTE format('SELECT count(*), encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,''[]''),''UTF8'')),''hex'') FROM public.%I t',tab)
      INTO n,fingerprint;
    INSERT INTO _integrity_before VALUES(tab,n,fingerprint);
  END LOOP;
END $snapshot$;

-- Exactly the four inventoried test stores. Nova returns to pending if later reverted.
DO $changes$
DECLARE n integer;
BEGIN
  UPDATE public.stores s SET status='suspended'
    FROM _store_expected e WHERE s.id=e.id AND NOT e.keep;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>4 THEN RAISE EXCEPTION 'No se modificaron exactamente cuatro tiendas.'; END IF;
  INSERT INTO public.stores(id,name,slug,kind,status)
    SELECT id,name,slug,'seller'::public.store_kind,'active'::public.store_status FROM _store_new ORDER BY id;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>2 THEN RAISE EXCEPTION 'No se crearon exactamente dos tiendas.'; END IF;
END $changes$;

DO $verify$
DECLARE r record; n bigint; fingerprint text;
BEGIN
  IF (SELECT count(*) FROM public.stores)<>7 OR (SELECT count(*) FROM public.stores WHERE status='active')<>3
  THEN RAISE EXCEPTION 'La operación no produjo siete registros y tres tiendas activas.'; END IF;
  IF EXISTS (SELECT 1 FROM public.stores s JOIN _store_expected e USING(id)
    WHERE NOT e.keep AND s.status<>'suspended')
  THEN RAISE EXCEPTION 'Una tienda retirada permanece disponible.'; END IF;
  IF EXISTS (SELECT 1 FROM _stores_before b JOIN public.stores s USING(id) JOIN _store_expected e USING(id)
    WHERE CASE WHEN e.keep THEN to_jsonb(s) IS DISTINCT FROM b.data
               ELSE (to_jsonb(s)-'status'-'updated_at') IS DISTINCT FROM (b.data-'status'-'updated_at') END)
  THEN RAISE EXCEPTION 'Se alteraron campos no autorizados de una tienda existente.'; END IF;
  IF EXISTS (SELECT 1 FROM public.stores s JOIN _store_new n USING(id)
      WHERE s.name IS DISTINCT FROM n.name OR s.slug IS DISTINCT FROM n.slug OR s.kind<>'seller' OR s.status<>'active'
        OR s.logo_path IS NOT NULL OR s.cover_path IS NOT NULL OR s.contact_email IS NOT NULL
        OR s.rating_count<>0 OR s.rating_avg IS NOT NULL)
  THEN RAISE EXCEPTION 'Una tienda nueva contiene identidad o datos no autorizados.'; END IF;
  FOR r IN SELECT * FROM _integrity_before ORDER BY entity LOOP
    EXECUTE format('SELECT count(*), encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,''[]''),''UTF8'')),''hex'') FROM public.%I t',r.entity)
      INTO n,fingerprint;
    IF n IS DISTINCT FROM r.row_count OR fingerprint IS DISTINCT FROM r.fingerprint THEN
      RAISE EXCEPTION 'Cambió la tabla protegida %; se debe revertir.',r.entity;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.audit_log a WHERE a.id>(SELECT last_id FROM _audit_before)
      AND a.entity='stores' AND a.action='update' AND a.entity_id IN (SELECT id::text FROM _store_expected WHERE NOT keep))<>4
  THEN RAISE EXCEPTION 'Falta auditoría de las cuatro suspensiones.'; END IF;
  IF (SELECT count(*) FROM public.audit_log a WHERE a.id>(SELECT last_id FROM _audit_before)
      AND a.entity='stores' AND a.action='insert' AND a.entity_id IN (SELECT id::text FROM _store_new))<>2
  THEN RAISE EXCEPTION 'Falta auditoría de las dos altas.'; END IF;
END $verify$;

-- Readable, non-PII result BEFORE the terminator. A successful SELECT alone does not mean COMMIT.
SELECT jsonb_build_object(
  'state','validated_before_terminator',
  'project','mimnotafmfasvwrclxan',
  'existing_store_fields_preserved',true,
  'protected_tables',(SELECT jsonb_agg(jsonb_build_object('entity',entity,'rows',row_count,'sha256',fingerprint) ORDER BY entity) FROM _integrity_before),
  'retired',(SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'slug',s.slug,'old_status',e.old_status,'new_status',s.status,'old_updated_at',e.old_updated_at,'new_updated_at',s.updated_at) ORDER BY s.id) FROM public.stores s JOIN _store_expected e USING(id) WHERE NOT e.keep),
  'created',(SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'slug',s.slug,'kind',s.kind,'status',s.status,'members',0) ORDER BY s.id) FROM public.stores s JOIN _store_new n USING(id)),
  'active',(SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug,'kind',kind) ORDER BY name) FROM public.stores WHERE status='active'),
  'audit_entries',6
) AS store_transition;

-- TERMINATOR: DRY RUN. Only the integrator may explicitly replace this final ROLLBACK with COMMIT
-- after local tests and a separately reviewed remote rollback trial. Never replay blindly.
ROLLBACK;
