#!/usr/bin/env python3
"""Test the reviewed BCV SQL on a fresh retained LOCAL clone; never connects remotely."""
import json
import os
from pathlib import Path
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
DATABASE = os.environ.get('KORA_BCV_RELEASE_DATABASE', '')
if not re.fullmatch(r'kora_bcv_release_\d+', DATABASE) or os.environ.get('PGHOST') != '127.0.0.1':
    raise SystemExit('Requires PGHOST=127.0.0.1 and fresh LOCAL KORA_BCV_RELEASE_DATABASE=kora_bcv_release_<timestamp>')
SQL = (ROOT / 'tools/supabase-remote/aplicar-bcv-ves.sql').read_text()
MANIFEST = json.loads((ROOT / 'docs/BCV_VES_RELEASE.json').read_text())


def run(sql, check=True):
    result = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', DATABASE], input=sql, text=True, capture_output=True)
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result


def business():
    # Exact existing rows + unchanged quote/payment/pricing arithmetic, without printing any row content.
    chunks = []
    for table in ['exchange_rates', 'rate_policies', 'app_settings', 'stores', 'products', 'product_variants',
                  'orders', 'payment_obligations', 'payment_quotes', 'payments', 'ledger_entries', 'pricing_snapshots']:
        chunks.append(f"select md5(coalesce(string_agg(to_jsonb(t)::text, ',' order by to_jsonb(t)::text), '')) from public.{table} t;")
    for signature in ['public.create_payment_quote(uuid,text,uuid[])', 'public.take_pricing_snapshot(text)',
                      'public._divisas_factor(public.pricing_snapshots,text,numeric)', 'public.review_payment(uuid,boolean,numeric,text)']:
        chunks.append(f"select md5(pg_get_functiondef('{signature}'::regprocedure));")
    return run('\n'.join(chunks)).stdout


class BcvRelease(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(['python3', str(ROOT / 'tools/supabase-remote/build-bcv.py'), '--check'], check=True)
        if run("select to_regclass('public.bcv_banking_calendar') is null").stdout.strip() != 't':
            raise AssertionError('Fresh clone must have original finance functions and no BCV migration/calendar')

    def rejection(self, setup, message):
        before = business()
        result = run('begin;\n' + setup + '\n' + SQL, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(message, result.stderr)
        self.assertEqual(business(), before, 'Rejected release must roll back, including fixture setup')

    def test_01_wrong_project_is_rejected(self):
        self.rejection("update vault.secrets set secret='https://invalid.example.com' where name='kora_project_url';", 'Wrong project')

    def test_02_financial_drift_is_rejected(self):
        old = run("select pg_get_functiondef('public.current_rate(text)'::regprocedure)").stdout
        self.rejection(old.replace('no fresh rate', 'unreviewed drift') + ';', 'Unexpected financial definition')

    def test_03_conflicting_migration_history_is_rejected(self):
        self.rejection("insert into supabase_migrations.schema_migrations(version,name) values ('20261014202228','unexpected');", 'Conflicting BCV migration history')

    def test_04_recorded_but_missing_implementation_is_rejected(self):
        self.rejection("insert into supabase_migrations.schema_migrations(version,name) values ('20261014202228','bcv_effective_dates');", 'Unexpected financial definition')

    def test_05_unrecorded_calendar_is_rejected(self):
        self.rejection('create table public.bcv_banking_calendar(day date);', 'Unrecorded BCV objects')

    def test_06_apply_then_repeat_preserves_all_existing_financial_data(self):
        before = business()
        run(SQL)
        self.assertEqual(business(), before)
        run(SQL)
        self.assertEqual(business(), before)
        self.assertEqual(run("select count(*) from supabase_migrations.schema_migrations where version='20261014202228'").stdout.strip(), '1')
        self.assertEqual(run('select count(*) from public.bcv_banking_calendar').stdout.strip(), '365')
        for signature, digest in MANIFEST['postflight_financial_md5'].items():
            self.assertEqual(run(f"select md5(pg_get_functiondef('public.{signature}'::regprocedure))").stdout.strip(), digest)


if __name__ == '__main__':
    unittest.main(verbosity=2)
