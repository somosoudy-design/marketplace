#!/usr/bin/env python3
"""Builds aplicar-migraciones-07-a-21.sql: migrations 7..21 for the remote project "Marketplace"
(mimnotafmfasvwrclxan), whose first six migrations were applied one by one through the Supabase
connector and recorded with the connector's own timestamps. The output runs in one transaction,
refuses to run twice, and renames those six history rows to the file versions so `supabase db push`
stays consistent. Usage: python3 tools/supabase-remote/build.py"""
import glob
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'tools/supabase-remote/aplicar-migraciones-07-a-21.sql')
# file version -> version the connector recorded for it
APPLIED = {
    '20261009000100': '20261009120356', '20261009000200': '20261009120455', '20261009000300': '20261009120537',
    '20261009000400': '20261009120607', '20261009000500': '20261009120731', '20261009000600': '20261009120818',
}

files = sorted(glob.glob(os.path.join(ROOT, 'supabase/migrations/*.sql')))
rest = [f for f in files if os.path.basename(f)[:14] not in APPLIED]
version = lambda f: os.path.basename(f)[:14]
name = lambda f: os.path.basename(f)[15:-4]

out = ["""-- =====================================================================
-- Proyecto Supabase "Marketplace" (mimnotafmfasvwrclxan): migraciones 7 a 21.
-- Las 6 primeras ya están aplicadas. Este archivo se genera desde supabase/migrations
-- con tools/supabase-remote/build.py; no lo edites a mano.
--
-- Cómo usarlo: copia todo el archivo, pégalo en el SQL Editor del proyecto y pulsa Run.
-- El editor avisará de "operaciones destructivas": son reemplazos de funciones y reglas
-- y borrados dentro de funciones que solo se ejecutan cuando la app las llame. En un
-- proyecto vacío no hay datos que perder. Todo corre en una sola transacción: si algo
-- falla, no queda nada a medias. No carga datos demo ni cuentas de prueba.
-- =====================================================================
begin;

do $guard$
begin
  if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'payment_obligations') then
    raise exception 'Faltan las migraciones 1 a 6; no se aplicó nada.';
  end if;
  if exists (select 1 from pg_proc where proname = 'place_order' and pronamespace = 'public'::regnamespace) then
    raise exception 'Este archivo ya se aplicó antes; no se aplicó nada.';
  end if;
end $guard$;
"""]
for f in rest:
    out.append(f"\n-- ===================== {os.path.basename(f)} =====================\n")
    out.append(open(f, encoding='utf-8').read().rstrip('\n') + '\n')
out.append("\n-- ===================== historial de migraciones =====================\n")
out.append("-- Mismas versiones que los archivos del repositorio, para que `supabase db push` siga coherente.\n")
for v, old in APPLIED.items():
    out.append(f"update supabase_migrations.schema_migrations set version = '{v}' where version = '{old}';\n")
values = ",\n  ".join(f"('{version(f)}', '{name(f)}')" for f in rest)
out.append(f"insert into supabase_migrations.schema_migrations (version, name) values\n  {values};\n")
out.append("\ncommit;\n")
open(OUT, 'w', encoding='utf-8').write(''.join(out))
print(f'{len(rest)} migrations -> {os.path.relpath(OUT, ROOT)}')
