import {fail, fingerprint, packageId, parseArgs} from './android-utils.mjs';

async function request(url, expectedType) {
  const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(15000)});
  if (response.status !== 200) throw new Error(`${url}: expected HTTP 200 without a redirect, got ${response.status}.`);
  if (expectedType && !expectedType.test(response.headers.get('content-type') || '')) throw new Error(`${url}: unexpected Content-Type.`);
  return response;
}

try {
  const args = parseArgs(process.argv.slice(2), ['package', 'fingerprint', 'origin', 'path'], ['fingerprint']);
  if (args.help) {
    console.log('node scripts/android-verify-host.mjs --package FINAL_ID --fingerprint PLAY_SIGNING_SHA256 [--fingerprint SECOND_SHA256] [--origin https://HOST] [--path /calisthenics/dist/]');
  } else {
    const id = packageId(args.package);
    if (!args.fingerprint?.length) throw new Error('Provide at least one actual signing certificate fingerprint.');
    const certificates = [...new Set(args.fingerprint.map(fingerprint))];
    const origin = new URL(args.origin || 'https://trust-idiong.github.io');
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('--origin must be an HTTPS origin with no path, query, or credentials.');
    const path = args.path || '/calisthenics/dist/';
    if (!path.startsWith('/') || path.startsWith('//') || !path.endsWith('/') || path.includes('..') || path.includes('?') || path.includes('#')) throw new Error('--path must be an absolute site directory ending in /.');
    const base = new URL(path, origin);
    const [association, webManifest] = await Promise.all([
      request(new URL('/.well-known/assetlinks.json', origin), /application\/(?:[\w.+-]*\+)?json/i).then(r => r.json()),
      request(new URL('manifest.webmanifest', base), /application\/(?:manifest\+json|json)/i).then(r => r.json()),
      request(base, /text\/html/i),
      request(new URL('privacy.html', base), /text\/html/i),
      request(new URL('sw.js', base), /(?:javascript|ecmascript)/i)
    ]);
    if (!Array.isArray(association)) throw new Error('Root assetlinks.json must be a JSON array.');
    const matching = association.filter(x => x?.relation?.includes('delegate_permission/common.handle_all_urls') && x?.target?.namespace === 'android_app' && x?.target?.package_name === id);
    for (const certificate of certificates) {
      if (!matching.some(x => x.target.sha256_cert_fingerprints?.some(f => String(f).toUpperCase() === certificate))) throw new Error('Root assetlinks.json does not contain every supplied signing certificate for the final application ID.');
    }
    for (const field of ['start_url', 'scope']) {
      const url = new URL(webManifest[field] || './', new URL('manifest.webmanifest', base));
      if (url.origin !== origin.origin || !url.pathname.startsWith(base.pathname)) throw new Error(`Web manifest ${field} is outside the app directory.`);
    }
    if (!webManifest.icons?.some(i => i.sizes?.split(' ').includes('512x512'))) throw new Error('Web manifest needs a 512×512 launcher icon.');
    await Promise.all(webManifest.icons.map(i => request(new URL(i.src, new URL('manifest.webmanifest', base)), /^image\//i)));
    console.log(`Verified public PWA resources and root certificate association for ${id}.`);
    console.log('A real-device install from the intended Play track must still verify full-screen TWA launch, offline use, and backup restore.');
  }
} catch (error) { fail(error); }
