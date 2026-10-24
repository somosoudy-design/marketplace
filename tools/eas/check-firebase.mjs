// Verifies, without printing any secret, that push on Android is ready for the preview APK:
// 1. GOOGLE_SERVICES_JSON exists in the EAS "preview" environment and its google-services.json has a client for the
//    preview package (com.example.kora.preview);
// 2. the Expo project has an FCM V1 service account key for that package, from the same Firebase project;
// 3. the package has one signing keystore on EAS (the one APK 4 was signed with, so APK 5 installs over it).
// Usage, after `eas env:pull preview --non-interactive --path <file>` in apps/mobile:
//   node tools/eas/check-firebase.mjs <file>
// Only identifiers are printed (project id, package names, a short hash of the file, the certificate fingerprint);
// never the API key, the private key or the keystore. The repository and its Actions logs are public.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const brand = JSON.parse(readFileSync(new URL('../../config/brand.json', import.meta.url), 'utf8'));
const expo = JSON.parse(readFileSync(new URL('../../config/expo.json', import.meta.url), 'utf8'));
const pkg = `${brand.androidPackage}.preview`;
const problems = [];
const say = (msg) => console.log(msg);
const problem = (msg) => {
  problems.push(msg);
  console.log(`::error::${msg}`);
};

// 1. google-services.json from the pulled environment
const envFile = process.argv[2];
let firebaseProject = null;
if (!envFile || !existsSync(envFile)) {
  problem('No se pudo leer el entorno «preview» de EAS (falta el archivo de eas env:pull).');
} else {
  const lines = readFileSync(envFile, 'utf8').split('\n');
  const line = lines.find((l) => /^#?\s*GOOGLE_SERVICES_JSON=/.test(l));
  if (!line) {
    problem('No existe la variable GOOGLE_SERVICES_JSON en el entorno «preview» del proyecto de Expo.');
  } else if (line.startsWith('#')) {
    problem('GOOGLE_SERVICES_JSON tiene visibilidad «Secret»: EAS Build la usa, pero las actualizaciones no pueden calcular el runtime del APK con ella. Cámbiala a «Sensitive» en expo.dev.');
  } else {
    const value = line.slice(line.indexOf('=') + 1).trim();
    const file = resolve(dirname(envFile), value);
    let json = null;
    try {
      json = JSON.parse(readFileSync(existsSync(value) ? value : file, 'utf8'));
    } catch {
      problem('GOOGLE_SERVICES_JSON no es un archivo JSON válido (¿se creó como texto y no como archivo?).');
    }
    if (json) {
      const raw = readFileSync(existsSync(value) ? value : file);
      firebaseProject = json.project_info?.project_id ?? null;
      const clients = (json.client ?? []).map((c) => ({
        pkg: c.client_info?.android_client_info?.package_name,
        hasAppId: Boolean(c.client_info?.mobilesdk_app_id),
        hasKey: (c.api_key ?? []).some((k) => k.current_key),
      }));
      say(`google-services.json: proyecto Firebase «${firebaseProject}» (número ${json.project_info?.project_number ?? '?'}), huella ${createHash('sha256').update(raw).digest('hex').slice(0, 12)}`);
      say(`  paquetes Android: ${clients.map((c) => c.pkg).join(', ') || 'ninguno'}`);
      const mine = clients.find((c) => c.pkg === pkg);
      if (!mine) problem(`google-services.json no tiene una app Android con el paquete ${pkg}. Agrégala en Firebase y vuelve a subir el archivo.`);
      else if (!mine.hasAppId || !mine.hasKey) problem(`La app ${pkg} de google-services.json no trae mobilesdk_app_id o api_key: descarga el archivo otra vez desde Firebase.`);
      else say(`  ${pkg}: presente, con app id y clave de API (no se muestran)`);
    }
  }
}

// 2 and 3. Credentials on EAS for the package
const fullName = `@${expo.owner}/${expo.slug}`;
const query = `query($fullName: String!, $pkg: String) { app { byFullName(fullName: $fullName) {
  id androidAppCredentials(filter: { applicationIdentifier: $pkg }) {
    applicationIdentifier
    googleServiceAccountKeyForFcmV1 { id projectIdentifier createdAt }
    androidAppBuildCredentialsList { isDefault name androidKeystore { sha256CertificateFingerprint createdAt } }
  } } } }`;
const res = await fetch('https://api.expo.dev/graphql', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.EXPO_TOKEN ?? ''}` },
  body: JSON.stringify({ query, variables: { fullName, pkg } }),
}).catch((e) => ({ ok: false, status: e.cause?.code ?? e.message, json: async () => ({}) }));
const body = await res.json().catch(() => ({}));
if (!res.ok || body.errors) {
  problem(`No se pudieron leer las credenciales de ${fullName}: ${body?.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`}`);
} else {
  const creds = (body.data?.app?.byFullName?.androidAppCredentials ?? []).filter((c) => c.applicationIdentifier === pkg);
  if (!creds.length) problem(`El proyecto de Expo no tiene credenciales Android para ${pkg}.`);
  const fcm = creds.map((c) => c.googleServiceAccountKeyForFcmV1).find(Boolean);
  if (!fcm) {
    problem(`Falta la clave FCM V1 en Expo › Credentials › Android › ${pkg} › «FCM V1 service account key».`);
  } else {
    say(`Clave FCM V1: cargada (${fcm.createdAt?.slice(0, 10)}), proyecto Firebase «${fcm.projectIdentifier}»`);
    if (firebaseProject && fcm.projectIdentifier !== firebaseProject) {
      problem(`La clave FCM V1 es del proyecto «${fcm.projectIdentifier}» y google-services.json del proyecto «${firebaseProject}»: deben ser del mismo proyecto de Firebase.`);
    }
  }
  const builds = creds.flatMap((c) => c.androidAppBuildCredentialsList ?? []);
  const keystores = builds.filter((b) => b.androidKeystore);
  for (const b of keystores) {
    say(`Firma${b.isDefault ? ' (predeterminada)' : ''}: «${b.name}», certificado SHA-256 ${b.androidKeystore.sha256CertificateFingerprint}, creada ${b.androidKeystore.createdAt?.slice(0, 10)}`);
  }
  if (!keystores.length) problem(`No hay firma (keystore) en EAS para ${pkg}: el APK 5 no se podría instalar sobre el APK 4.`);
}

if (problems.length) {
  say(`\nFirebase y Expo: ${problems.length} problema(s) que corregir antes del APK 5.`);
  process.exit(1);
}
say('\nFirebase y Expo: listos para el APK 5.');
