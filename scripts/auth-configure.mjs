import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateAuthConfig} from '../dist/auth.js';

// Configure only public Firebase Web identifiers. This does not create a
// project, enable providers, authorize domains, deploy, or verify an account.
const usage = 'node scripts/auth-configure.mjs --input PUBLIC_FIREBASE_WEB_CONFIG.json [--output PATH]';
try {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const flag = process.argv[i];
    if (flag === '--help') { console.log(usage); process.exit(0); }
    if (!['--input', '--output'].includes(flag) || args[flag]) throw new Error(usage);
    const value = process.argv[++i];
    if (!value || value.startsWith('--')) throw new Error(usage);
    args[flag] = value;
  }
  if (!args['--input']) throw new Error(usage);
  let input;
  try { input = JSON.parse(await readFile(resolve(args['--input']), 'utf8')); }
  catch { throw new Error('Could not read the input JSON. Supply the public Web App configuration copied from Firebase, not service-account credentials.'); }
  const normalized = validateAuthConfig({provider:'firebase',firebase:input,persistence:'local',googleEnabled:true});
  if (!normalized) throw new Error('Supply a non-empty public Firebase Web App configuration.');
  const output = args['--output'] ? resolve(args['--output']) : fileURLToPath(new URL('../dist/auth-config.js', import.meta.url));
  const value = {provider:'firebase',firebase:normalized.firebase,googleEnabled:normalized.googleEnabled,persistence:normalized.persistence};
  const content = '// Public Firebase Web configuration; no service-account keys or passwords.\n'
    + '// Email/Password and Google must be enabled; authorize the deployed host.\n'
    + '// https://firebase.google.com/docs/auth/web/start\n'
    + 'export const AUTH_CONFIG = Object.freeze(' + JSON.stringify(value, null, 2) + ');\n';
  await writeFile(output, content, 'utf8');
  console.log(`Prepared public authentication configuration in ${output}.`);
  console.log('No account, Firebase project, provider setting, domain authorization or deployment was created.');
  console.log('Enable providers and authorize trust-idiong.github.io in your Firebase project before testing real accounts.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
