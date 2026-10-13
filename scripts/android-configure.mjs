import {stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fail, packageId, parseArgs, readJson, writeNewJson} from './android-utils.mjs';

try {
  const args = parseArgs(process.argv.slice(2), ['package', 'signing-key', 'key-alias', 'output']);
  if (args.help) {
    console.log('node scripts/android-configure.mjs --package FINAL_ID --signing-key EXISTING_PRIVATE_KEYSTORE --key-alias ACTUAL_ALIAS [--output PATH]');
  } else {
    const id = packageId(args.package);
    if (!args['signing-key'] || !args['key-alias'] || /replace|placeholder/i.test(args['key-alias'])) throw new Error('An existing keystore path and actual key alias are required.');
    const keyPath = resolve(args['signing-key']);
    if (!(await stat(keyPath)).isFile()) throw new Error('Signing key path must reference an existing keystore file.');
    const template = await readJson(new URL('../android-release/twa-manifest.template.json', import.meta.url));
    template.packageId = id;
    template.signingKey = {path: keyPath, alias: args['key-alias']};
    const output = args.output ? resolve(args.output) : fileURLToPath(new URL('../android-release/generated/twa-manifest.json', import.meta.url));
    await writeNewJson(output, template);
    console.log(`Prepared ${output}`);
    console.log('This is configuration only. The key alias and certificate still need verification; no APK or AAB was built or signed.');
  }
} catch (error) { fail(error); }
