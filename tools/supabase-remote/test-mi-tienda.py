#!/usr/bin/env python3
"""Exercise the exact SQL Editor bundle on a fresh, retained LOCAL database clone."""
from pathlib import Path
import os
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
DATABASE = os.environ.get('KORA_RELEASE_TEST_DATABASE', '')
if not re.fullmatch(r'kora_seller_release_\d+', DATABASE) or os.environ.get('PGHOST') not in ('127.0.0.1', 'localhost'):
    raise SystemExit('Requires PGHOST=127.0.0.1 and a fresh local KORA_RELEASE_TEST_DATABASE=kora_seller_release_<timestamp> clone')
SQL = (ROOT / 'tools/supabase-remote/aplicar-mi-tienda-operativa.sql').read_text()


def run(sql, check=True):
    result = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', DATABASE],
                            input=sql, text=True, capture_output=True)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result


def snapshot():
    # No customer fields/secrets in output. Verify business data and protected operations remain intact.
    return run("""
      select count(*) from public.stores;
      select count(*) from public.products;
      select count(*) from public.orders;
      select md5(pg_get_functiondef('public.advance_fulfillment(uuid,text,text,text,text)'::regprocedure));
      select md5(pg_get_functiondef('public.set_product_costs(uuid,jsonb,jsonb)'::regprocedure));
      select version || ':' || name from supabase_migrations.schema_migrations order by version;
    """).stdout


class SellerActivation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(['python3', str(ROOT / 'tools/supabase-remote/build-mi-tienda.py'), '--check'], check=True)
        if run("select count(*) from supabase_migrations.schema_migrations where version in ('20261011172600','20261011174200')").stdout.strip() != '0':
            raise AssertionError('Fresh clone must have no recorded seller migrations; retain old clones and create a new one')
        # Fixture only in this isolated local clone; never changes remote Vault or the app's dev database.
        run("select vault.create_secret('https://mimnotafmfasvwrclxan.supabase.co', 'kora_project_url')")

    def rejection(self, setup, message):
        before = snapshot()
        result = run('begin;\n' + setup + '\n' + SQL, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(message, result.stderr)
        self.assertEqual(snapshot(), before, 'Failure must roll back the transaction and leave history/data/functions unchanged')

    def test_01_apply_exact_bundle_and_grants(self):
        before = snapshot().splitlines()[:5]
        result = run(SQL)
        self.assertIn('20261011172600|seller_product_editor', result.stdout)
        self.assertIn('20261011174200|seller_fulfillment_detail', result.stdout)
        self.assertIn('t|t', result.stdout)
        self.assertEqual(snapshot().splitlines()[:5], before)
        grants = run("""
          select bool_and(not has_function_privilege('anon', oid, 'EXECUTE')
                          and has_function_privilege('authenticated', oid, 'EXECUTE')
                          and has_function_privilege('service_role', oid, 'EXECUTE'))
          from pg_proc where oid in (
            'public.seller_save_product(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure,
            'public.seller_editor_ready()'::regprocedure,
            'public.seller_fulfillment_detail(uuid,uuid)'::regprocedure,
            'public.seller_orders_ready()'::regprocedure);
        """).stdout.strip()
        self.assertEqual(grants, 't')

    def test_02_repeat_does_not_rewrite_recorded_functions_or_history(self):
        before = snapshot()
        definition = "select oid,md5(pg_get_functiondef(oid)) from pg_proc where proname like 'seller_%' and pronamespace='public'::regnamespace order by oid"
        functions = run(definition).stdout
        run(SQL)
        self.assertEqual(snapshot(), before)
        self.assertEqual(run(definition).stdout, functions)

    def test_03_wrong_project_aborts(self):
        self.rejection("update vault.secrets set secret='https://other-project.supabase.co' where name='kora_project_url';", 'Wrong project')

    def test_04_conflicting_version_aborts(self):
        self.rejection("update supabase_migrations.schema_migrations set name='different_migration' where version='20261011172600';", 'Conflicting migration history')

    def test_05_same_name_different_version_aborts(self):
        self.rejection("update supabase_migrations.schema_migrations set version='20990101000000' where name='seller_fulfillment_detail';", 'Conflicting migration history')

    def test_06_missing_prerequisite_aborts(self):
        self.rejection('alter function public.require_store_member(uuid) rename to seller_test_missing_member;', 'Missing prerequisite')

    def test_07_recorded_but_missing_rpc_aborts(self):
        self.rejection('alter function public.seller_editor_ready() rename to seller_test_missing_editor;', 'Recorded migration missing function')

    def test_08_inconsistent_grants_abort(self):
        self.rejection('revoke execute on function public.seller_orders_ready() from authenticated;', 'Unexpected grants')


if __name__ == '__main__':
    unittest.main(verbosity=2)
