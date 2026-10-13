import {readFile, stat} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fail, packageId, parseArgs, readJson} from './android-utils.mjs';

try {
  const args = parseArgs(process.argv.slice(2), ['project', 'package']);
  if (args.help) {
    console.log('node scripts/android-check-project.mjs --project GENERATED_ANDROID_DIRECTORY --package FINAL_ID');
  } else {
    if (!args.project) throw new Error('--project must point to an initialized Bubblewrap project.');
    const directory = resolve(args.project), id = packageId(args.package);
    const manifest = await readJson(join(directory, 'twa-manifest.json'));
    if (manifest.packageId !== id) throw new Error('Generated package ID does not match the final application ID.');
    if (!manifest.signingKey?.alias || /replace|placeholder/i.test(manifest.signingKey.alias)) throw new Error('A real signing key alias is required.');
    const keyPath = resolve(directory, manifest.signingKey.path || '');
    if (!(await stat(keyPath)).isFile()) throw new Error('Signing keystore file is missing.');
    const gradle = await readFile(join(directory, 'app/build.gradle'), 'utf8');
    const source = gradle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const target = source.match(/\btargetSdk(?:Version)?\s*(?:=\s*)?(\d+)\b/), compile = source.match(/\bcompileSdk(?:Version)?\s*(?:=\s*)?(\d+)\b/);
    if (!target || !compile) throw new Error('Could not read numeric compile/target SDK values. Inspect app/build.gradle manually.');
    if (Number(target[1]) < 36 || Number(compile[1]) < Number(target[1])) throw new Error('This October 2026 phone release needs targetSdk >= 36 and compileSdk >= targetSdk.');
    if (!source.includes(`applicationId "${id}"`) && !source.includes(`applicationId '${id}'`)) throw new Error('Gradle applicationId does not match the final ID.');
    console.log(`Source configuration passed for ${id}, target API ${target[1]}.`);
    console.log('This check does not establish signature validity, successful compilation, device compatibility, or Play approval.');
  }
} catch (error) { fail(error); }
