import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';

export function parseArgs(argv, options, repeated = []) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help') { result.help = true; continue; }
    if (!flag.startsWith('--') || !options.includes(flag.slice(2))) throw new Error(`Unknown option: ${flag}`);
    const name = flag.slice(2), value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value.`);
    if (repeated.includes(name)) (result[name] ||= []).push(value);
    else if (result[name] !== undefined) throw new Error(`${flag} was provided more than once.`);
    else result[name] = value;
  }
  return result;
}

export function packageId(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(value) || /replace|example|placeholder/i.test(value)) {
    throw new Error('Provide a final lowercase Android application ID, such as io.github.trustidiong.calisthenics.');
  }
  return value;
}

export function fingerprint(value) {
  if (typeof value !== 'string' || !/^(?:[a-fA-F0-9]{2}:){31}[a-fA-F0-9]{2}$/.test(value)) {
    throw new Error('Provide the actual 32-byte SHA-256 certificate fingerprint, with colon-separated hex pairs.');
  }
  const normalized = value.toUpperCase();
  if (new Set(normalized.split(':')).size === 1) throw new Error('A repeated-byte fingerprint is a placeholder; use the actual signing certificate fingerprint.');
  return normalized;
}

export function assetLinks(packageName, fingerprints) {
  if (!Array.isArray(fingerprints) || !fingerprints.length) throw new Error('At least one real certificate fingerprint is required.');
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: packageId(packageName),
      sha256_cert_fingerprints: [...new Set(fingerprints.map(fingerprint))]
    }
  }];
}

export async function writeNewJson(path, data) {
  await mkdir(dirname(path), {recursive: true});
  await writeFile(path, JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function fail(error) {
  console.error(error.code === 'EEXIST' ? 'Output already exists. Choose a new output path; existing files were preserved.' : error.message);
  process.exitCode = 1;
}
