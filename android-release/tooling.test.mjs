import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assetLinks, fingerprint, packageId, parseArgs, writeNewJson} from '../scripts/android-utils.mjs';

// Test-only certificate-shaped bytes. These never get written to a hosting path.
const testCertificate = Array.from({length: 32}, (_, index) => index.toString(16).padStart(2, '0')).join(':');

async function clearTemporaryDirectory(directory) {
  const target = resolve(directory);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('form-android-')) throw new Error('Temporary cleanup target escaped its intended directory.');
  await rm(target, {recursive: true, force: true});
}

test('missing, placeholder, or malformed release identities are rejected', () => {
  for (const value of [undefined, '', 'example.app', 'REPLACE_WITH_FINAL_APPLICATION_ID', 'io.github..app', 'io.github/app', 'onepart']) assert.throws(() => packageId(value));
  assert.equal(packageId('io.github.trustidiong.calisthenics'), 'io.github.trustidiong.calisthenics');
});

test('certificate association rejects missing or placeholder fingerprints', () => {
  for (const value of [undefined, '', 'ACTUAL_PLAY_APP_SIGNING_SHA256', 'AA:BB', Array(32).fill('AA').join(':'), testCertificate.replace(':', '-')]) assert.throws(() => fingerprint(value));
  assert.throws(() => assetLinks('io.github.trustidiong.calisthenics', []));
});

test('real-format associations normalize duplicate certificates and retain exact package/relation', () => {
  const result = assetLinks('io.github.trustidiong.calisthenics', [testCertificate, testCertificate.toUpperCase()]);
  assert.deepEqual(result, [{relation: ['delegate_permission/common.handle_all_urls'], target: {namespace: 'android_app', package_name: 'io.github.trustidiong.calisthenics', sha256_cert_fingerprints: [testCertificate.toUpperCase()]}}]);
});

test('release output refuses to overwrite existing associations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'form-android-check-'));
  try {
    const path = join(directory, 'assetlinks.json');
    await writeFile(path, 'existing owner association');
    await assert.rejects(writeNewJson(path, []), {code: 'EEXIST'});
    assert.equal(await readFile(path, 'utf8'), 'existing owner association');
  } finally { await clearTemporaryDirectory(directory); }
});

test('invalid CLI arguments fail before producing a certificate file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'form-android-cli-'));
  try {
    const path = join(directory, 'association.json');
    const run = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/android-assetlinks.mjs', import.meta.url)), '--package', 'io.github.trustidiong.calisthenics', '--fingerprint', 'ACTUAL_PLAY_APP_SIGNING_SHA256', '--output', path], {encoding: 'utf8'});
    assert.equal(run.status, 1);
    assert.match(run.stderr, /actual.*SHA-256/i);
    await assert.rejects(readFile(path), {code: 'ENOENT'});
    assert.throws(() => parseArgs(['--package', 'one', '--package', 'two'], ['package']));
    assert.throws(() => parseArgs(['--unknown', 'one'], ['package']));
  } finally { await clearTemporaryDirectory(directory); }
});
