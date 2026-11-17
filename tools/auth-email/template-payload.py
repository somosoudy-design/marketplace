"""Print the eight non-secret Supabase Auth settings for Mayami's four OTP emails."""
from pathlib import Path
import json
import tomllib

root = Path(__file__).resolve().parents[2]
templates = tomllib.loads((root / 'supabase/config.toml').read_text())['auth']['email']['template']
payload = {}
for name in ('confirmation', 'recovery', 'magic_link', 'email_change'):
    config = templates[name]
    html = (root / config['content_path']).read_text()
    payload[f'mailer_subjects_{name}'] = config['subject']
    payload[f'mailer_templates_{name}_content'] = html
print(json.dumps(payload, ensure_ascii=False))
