import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {workoutIsActive, reloadIsSafe, isIOS, isStandalone} from '../dist/pwa.js';

const dist = new URL('../dist/', import.meta.url);
const workerSource = await readFile(new URL('sw.js', dist), 'utf8');
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', dist), 'utf8'));

function worker(scopePath = '/calisthenics/', options = {}) {
  const handlers = {};
  const calls = {added: [], opened: [], deleted: [], fetched: [], skipped: 0, claimed: 0};
  const scope = 'https://example.test' + scopePath;
  const cache = {
    async addAll(requests) { calls.added.push(requests); if (options.failInstall) throw new Error('missing shell asset'); },
    async match(request) { return options.cached?.(typeof request === 'string' ? request : request.url); },
  };
  const context = vm.createContext({
    URL, Request, Response, Set, Promise,
    self: {
      location: {href: scope + 'sw.js'},
      clients: {async claim() { calls.claimed++; }},
      skipWaiting() { calls.skipped++; },
      addEventListener(type, fn) { handlers[type] = fn; },
    },
    caches: {
      async open(name) { calls.opened.push(name); return cache; },
      async keys() { return options.cacheNames || []; },
      async delete(name) { calls.deleted.push(name); return true; },
    },
    async fetch(request) {
      calls.fetched.push(request);
      if (options.networkFailure) throw new TypeError('offline');
      return new Response(options.body || 'online shell', {status: options.status || 200});
    },
  });
  vm.runInContext(workerSource, context);
  function fetchEvent(path, mode = 'cors', method = 'GET') {
    let response;
    const request = {url: new URL(path, scope).href, mode, method};
    handlers.fetch({request, respondWith(value) { response = value; }});
    return response;
  }
  async function lifecycle(type) {
    let completion;
    handlers[type]({waitUntil(value) { completion = value; }});
    return completion;
  }
  return {handlers, calls, fetchEvent, lifecycle, scope};
}

test('manifest is installable at both root and GitHub Pages subpath', async () => {
  assert.equal(manifest.display, 'standalone');
  for (const key of ['id', 'scope', 'start_url']) assert.equal(manifest[key], './');
  for (const path of ['/', '/calisthenics/']) {
    const base = 'https://example.test' + path;
    assert.equal(new URL(manifest.start_url, base).pathname, path);
    for (const icon of manifest.icons) {
      assert.ok(icon.src.startsWith('./'));
      assert.ok(new URL(icon.src, base).pathname.startsWith(path));
      await access(fileURLToPath(new URL(icon.src, dist)));
    }
  }
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'maskable'));
});

test('PNG icon files have the declared dimensions', async () => {
  for (const icon of manifest.icons) {
    const png = await readFile(new URL(icon.src, dist));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
  }
});

test('atomic shell precache resolves every file inside each deployment scope', async () => {
  for (const path of ['/', '/calisthenics/']) {
    const service = worker(path);
    await service.lifecycle('install');
    assert.equal(service.calls.added.length, 1, 'one atomic addAll operation');
    const requests = service.calls.added[0];
    assert.equal(new Set(requests.map(request => request.url)).size, requests.length);
    assert.ok(requests.some(request => request.url.endsWith('/checkpoint.js')));
    assert.ok(requests.some(request => request.url.endsWith('/storage.js')));
    assert.ok(requests.some(request => request.url.endsWith('/mobile.css')));
    for (const request of requests) {
      assert.ok(request.url.startsWith(service.scope));
      assert.equal(request.cache, 'reload');
      assert.equal(request.credentials, 'same-origin');
      await access(fileURLToPath(new URL(request.url.slice(service.scope.length), dist)));
    }
    assert.equal(service.calls.skipped, 0, 'install must wait for explicit consent');
  }
});

test('a failed shell install does not activate or remove an existing working cache', async () => {
  const service = worker('/calisthenics/', {failInstall: true});
  await assert.rejects(service.lifecycle('install'), /missing shell asset/);
  assert.equal(service.calls.skipped, 0);
  assert.equal(service.calls.deleted.length, 0);
});

test('worker only activates an update on the explicit consent message', () => {
  const service = worker();
  service.handlers.message({data: {type: 'arbitrary-message'}});
  assert.equal(service.calls.skipped, 0);
  service.handlers.message({data: {type: 'ACTIVATE_UPDATE'}});
  assert.equal(service.calls.skipped, 1);
});

test('activation removes only obsolete caches for this app scope', async () => {
  const prefix = 'form-seven:' + encodeURIComponent('/calisthenics/') + ':';
  const service = worker('/calisthenics/', {cacheNames: [
    prefix + 'old-release', 'form-seven:' + encodeURIComponent('/') + ':old-release',
    'another-app-cache',
  ]});
  await service.lifecycle('activate');
  assert.deepEqual(service.calls.deleted, [prefix + 'old-release']);
  assert.equal(service.calls.claimed, 1);
});

test('navigation uses the network first, then the complete cached app shell', async () => {
  const online = worker('/', {cached: () => new Response('cached shell')});
  const onlineResponse = await online.fetchEvent('./?from=homescreen', 'navigate');
  assert.equal(await onlineResponse.text(), 'online shell');
  assert.equal(online.calls.fetched.length, 1);
  const offline = worker('/calisthenics/', {
    networkFailure: true,
    cached: url => url.endsWith('/index.html') ? new Response('cached shell') : undefined,
  });
  assert.equal(await (await offline.fetchEvent('./#workout', 'navigate')).text(), 'cached shell');
  const failure = worker('/calisthenics/', {status: 503, cached: () => new Response('cached shell')});
  assert.equal(await (await failure.fetchEvent('./', 'navigate')).text(), 'cached shell');
});

test('cached local workout modules work without a network request', async () => {
  const service = worker('/calisthenics/', {networkFailure: true, cached: () => new Response('offline workout module')});
  const response = await service.fetchEvent('./engine.js');
  assert.equal(await response.text(), 'offline workout module');
  assert.equal(service.calls.fetched.length, 0);
});

test('third-party media, APIs, downloads, and out-of-scope assets are never cached or intercepted', () => {
  const service = worker();
  for (const path of [
    'https://www.youtube-nocookie.com/embed/demo',
    'https://i.ytimg.com/vi/demo/hqdefault.jpg',
    'https://fonts.googleapis.com/css2?family=DM+Sans',
    '/another-app/app.js', './api/journal', './downloads/FORM_SEVEN_Package.zip', './app.js?tracking=1',
  ]) assert.equal(service.fetchEvent(path), undefined, path);
  assert.equal(service.fetchEvent('./app.js', 'cors', 'POST'), undefined);
  assert.equal(service.calls.opened.length, 0);
});

test('active and paused workouts prevent application reload, and device detection is explicit', () => {
  assert.equal(workoutIsActive('running'), true);
  assert.equal(workoutIsActive('paused'), true);
  assert.equal(workoutIsActive('complete'), false);
  assert.equal(workoutIsActive('ready'), false);
  assert.equal(reloadIsSafe('ready', 'true'), false);
  assert.equal(reloadIsSafe('running', 'false'), false);
  assert.equal(reloadIsSafe('paused', 'false'), false);
  assert.equal(reloadIsSafe('complete', 'false'), true);
  assert.equal(isIOS({userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5}), true);
  assert.equal(isIOS({userAgent: 'Mac', platform: 'MacIntel', maxTouchPoints: 5}), true);
  assert.equal(isIOS({userAgent: 'Android', platform: 'Linux', maxTouchPoints: 5}), false);
  assert.equal(isStandalone({matchMedia: () => ({matches: false})}, {standalone: true}), true);
  assert.equal(isStandalone({matchMedia: () => ({matches: true})}, {}), true);
});
