// Exact, read-only artifact retrieval; the certificate reference comes independently from EAS.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { graphql, ARCHIVE_QUERY, downloadArchive, ReceiptError } from './recover-apk5.mjs';
import { validateBuild, EXPECTED } from './verify-native-apk.mjs';

const [buildId, commit, runtime, referencePath] = process.argv.slice(2);
try {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(buildId ?? '')) throw new ReceiptError('invalid_build_id');
  const reference = JSON.parse(await readFile(referencePath, 'utf8'));
  const data = await graphql(ARCHIVE_QUERY, { buildId }, { token: process.env.EXPO_TOKEN });
  const build = data?.builds?.byId;
  if (build?.id !== buildId || build?.app?.id !== EXPECTED.project || build?.app?.fullName !== '@marketplacebrand/marketplace') throw new ReceiptError('wrong_build_or_project');
  validateBuild(build, { source: commit, runtime, certificate: reference.certificateSha256 });
  await mkdir('apks', { recursive: true });
  await downloadArchive(build.artifacts?.applicationArchiveUrl, 'apks/mayami-preview.apk', {});
  // URL is short-lived, not printed or uploaded. The strict verifier consumes this file in the runner.
  await writeFile('apks/native-build.json', JSON.stringify([build]));
  console.log('Exact requested Android preview APK downloaded; native validation is next.');
} catch (error) {
  console.error('::error title=Native APK retrieval::' + (error instanceof ReceiptError ? error.code : 'invalid_build_or_reference'));
  process.exitCode = 1;
}
