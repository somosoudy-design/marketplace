#!/usr/bin/env bash
# Transport real, unmodified Android PNGs to ci/capturas. No APK/OTA publication and no image processing.
# Run only in the authorized CI job, including on failed tests. Keep original MP4/logs in its artifact.
set -euo pipefail
: "${GITHUB_RUN_ID:?CI run required}"
: "${GITHUB_SHA:?CI source required}"
attempt=${GITHUB_RUN_ATTEMPT:-1}
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$attempt" =~ ^[0-9]+$ && "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid evidence identity' >&2; exit 1; }
repo_root=$(pwd)
source_dir="$repo_root/shots/native"
[ -d "$source_dir" ] || { echo 'No native evidence directory was produced.'; exit 0; }
work=$(mktemp -d)
cleanup() { git -C "$repo_root" worktree remove --force "$work/tree" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT
# Existing evidence branch. Fetch/push normally; never force-push or replace another run's evidence.
git fetch -q origin ci/capturas
git worktree add -q --detach "$work/tree" FETCH_HEAD
destination="$work/tree/ultima/native-$GITHUB_RUN_ID-$attempt"
[ ! -e "$destination" ] || { echo 'Evidence for this exact attempt already exists; not overwriting.'; exit 1; }
mkdir -p "$destination"
python3 - "$source_dir" "$destination" <<'PY'
from pathlib import Path
import hashlib,html,json,os,shutil,struct,sys
source,dest=map(Path,sys.argv[1:]);raw=source/'raw';copied=[];recordings=[];skipped=[];total=0
for f in sorted(raw.rglob('*.png')) if raw.exists() else []:
 if f.is_symlink(): skipped.append({'file':str(f.relative_to(source)),'reason':'symlink'});continue
 data=f.read_bytes()
 if len(data)<24 or data[:8]!=b'\x89PNG\r\n\x1a\n' or data[12:16]!=b'IHDR':
  skipped.append({'file':str(f.relative_to(source)),'reason':'invalid_png'});continue
 width,height=struct.unpack('>II',data[16:24])
 if not(width>0 and height>0): skipped.append({'file':str(f.relative_to(source)),'reason':'empty_dimensions'});continue
 total+=len(data)
 if total>96*1024*1024: raise SystemExit('Original native PNGs exceed96MiB; select explicit source PNGs, never resize silently.')
 relative=f.relative_to(source);target=dest/relative;target.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(f,target)
 digest=hashlib.sha256(data).hexdigest()
 assert hashlib.sha256(target.read_bytes()).hexdigest()==digest
 copied.append({'sourceFile':str(relative),'file':str(relative),'sha256':digest,'bytes':len(data),'width':width,'height':height})
# Preserve complete cold-start videos too, so review is not limited to selected early frames.
for f in sorted(raw.glob('*/cold-start.mp4')) if raw.exists() else []:
 if f.is_symlink(): continue
 data=f.read_bytes()
 if not 0<len(data)<=32*1024*1024: raise SystemExit('Unexpected recording size; inspect runner artifact.')
 total+=len(data)
 if total>96*1024*1024: raise SystemExit('Native evidence exceeds96MiB; keep original runner artifact.')
 relative=f.relative_to(source);target=dest/relative;target.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(f,target)
 digest=hashlib.sha256(data).hexdigest()
 assert hashlib.sha256(target.read_bytes()).hexdigest()==digest
 recordings.append({'file':str(relative),'bytes':len(data),'sha256':digest})
receipt={}
receipt_path=source/'receipt.json'
if not receipt_path.exists(): receipt_path=source/'native-apk-receipt.json'
if receipt_path.exists():
 original=json.loads(receipt_path.read_text())
 for k in ['buildId','source','commit','runtime','package','versionCode','channel','profile','sha256','certificateSha256','nativeArtifactVerified']:
  if k in original: receipt[k]=original[k]
for extra in ['signing-reference.json','failure.json']:
 p=source/extra
 if p.exists(): shutil.copyfile(p,dest/extra)
for theme in ['light','dark']:
 p=source/f'device-diagnostics-{theme}.json'
 if p.exists():
  original=json.loads(p.read_text());keys=['App','Sistema','Canal','Runtime','Código','Publicada','Backend','Conexión','Sesión cifrada','Cuenta','Catálogo']
  (dest/p.name).write_text(json.dumps({k:original[k] for k in keys if k in original},ensure_ascii=False,indent=2)+'\n')
manifest={'source':'Android emulator captures and decoded original screenrecord frames; not web',
 'run':os.environ['GITHUB_RUN_ID'],'attempt':os.environ.get('GITHUB_RUN_ATTEMPT','1'),'workflowCommit':os.environ['GITHUB_SHA'],
 'apk':receipt,'imageProcessing':'none; byte-for-byte copies','images':copied,'recordings':recordings,'skipped':skipped,
 'executionComplete':(source/'RESULTADO.md').exists()}
(dest/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
readme='# Evidencia Android nativa · originales\n\n'
readme+=f"Run {manifest['run']} · intento {manifest['attempt']} · fuente {manifest['workflowCommit']}.\n\n"
readme+=f'{len(copied)} PNG y {len(recordings)} MP4 copiados byte a byte; no se redimensionaron, convirtieron, recortaron ni retocaron. Los early-frames proceden del screenrecord real. Los logs quedan en el artifact de esta misma ejecución.\n\n'
readme+=('El script terminó y produjo RESULTADO.md; queda revisión visual independiente.\n' if manifest['executionComplete'] else '**Ejecución incompleta o fallida. Estas capturas no implican aprobación.** Consultar el job para la causa.\n')
readme+='\nNo demuestra instalación en el teléfono de Oliver ni migración desde APK5. No confundir bundle embebido con recepción OTA.\n'
(dest/'LEEME.md').write_text(readme)
figures=[]
for item in copied:
 name=html.escape(item['file']);figures.append(f'<figure><a href="{name}"><img loading="lazy" src="{name}" alt="{name}"></a><figcaption>{name}<br>{item["width"]}×{item["height"]}</figcaption></figure>')
(dest/'index.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>mayami · Android real</title><style>body{font:15px system-ui;background:#110f18;color:#f8f7fc;margin:24px}.grid{display:flex;gap:20px;flex-wrap:wrap}figure{margin:0;width:280px}img{max-width:100%;height:auto}figcaption{overflow-wrap:anywhere;margin:8px 0 24px}a{color:#b79dff}</style><h1>mayami · Android real · originales</h1><p>PNG originales con enlace a tamaño completo. La galería limita sólo su ancho de visualización; los archivos no fueron transformados. Revisar <a href="manifest.json">manifest.json</a> y <a href="LEEME.md">estado de ejecución</a>.</p><div class="grid">'+''.join(figures)+'</div></html>')
print(f'Prepared {len(copied)} original Android PNGs, {total} bytes; complete={manifest["executionComplete"]}; skipped={len(skipped)}.')
PY
git -C "$work/tree" add -- "ultima/native-$GITHUB_RUN_ID-$attempt"
git -C "$work/tree" -c user.name=mayami-ci -c user.email=mayami-ci@users.noreply.github.com commit -qm "Evidencia nativa original: run $GITHUB_RUN_ID intento $attempt"
if ! git -C "$work/tree" push -q origin HEAD:refs/heads/ci/capturas; then
  # An unrelated evidence run may have advanced the branch. Preserve it and try one normal rebase/push.
  git -C "$work/tree" fetch -q origin ci/capturas
  git -C "$work/tree" rebase FETCH_HEAD
  git -C "$work/tree" push -q origin HEAD:refs/heads/ci/capturas
fi
echo "Original Android evidence: ci/capturas/ultima/native-$GITHUB_RUN_ID-$attempt"
