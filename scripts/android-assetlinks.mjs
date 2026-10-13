import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assetLinks, fail, parseArgs, writeNewJson} from './android-utils.mjs';

try {
  const args = parseArgs(process.argv.slice(2), ['package', 'fingerprint', 'output'], ['fingerprint']);
  if (args.help) {
    console.log('node scripts/android-assetlinks.mjs --package FINAL_ID --fingerprint ACTUAL_SHA256 [--fingerprint SECOND_SHA256] [--output PATH]');
  } else {
    const links = assetLinks(args.package, args.fingerprint);
    const output = args.output ? resolve(args.output) : fileURLToPath(new URL('../android-release/generated/assetlinks.json', import.meta.url));
    await writeNewJson(output, links);
    console.log(`Prepared ${output}`);
    console.log('Publish this public certificate association at https://trust-idiong.github.io/.well-known/assetlinks.json.');
    console.log('A file inside /calisthenics/ does not verify the origin. No file was published by this command.');
  }
} catch (error) { fail(error); }
