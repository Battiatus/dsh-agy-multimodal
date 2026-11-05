import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.HOME = await mkdtemp(join(tmpdir(), 'agy-mm-home-')); // aucun compte : on teste le câblage, pas le réseau
const plugin = await import('../index.js');

function fakeHost() {
  const host = { adapters: {}, tools: {}, commands: {}, routes: {}, emitted: [] };
  const child = {
    get: (name) => child[name],
    effect: (fn) => { const dispose = fn(); return typeof dispose === 'function' ? dispose : () => {}; },
    tools: { register: (t) => { host.tools[t.name] = t; return () => { delete host.tools[t.name]; }; } },
    fs: {},
    commands: { register: (c) => { host.commands[c.name] = c; } },
    connection: { fetch: { register: (r) => { host.routes[r.path] = r; return () => {}; } } },
  };
  plugin.apply({
    llm: { registerAdapter: (routes, adapter) => routes.forEach((r) => { host.adapters[r] = adapter; }) },
    attachments: {},
    emit: (name) => host.emitted.push(name),
    inject: (_names, cb) => cb(child),
  });
  host.rpc = async (method, payload, contentType = 'application/json') => {
    const response = await host.routes['/api/agy-multimodal'].fetch(new Request('http://127.0.0.1/api/agy-multimodal', {
      method: 'POST', headers: { 'content-type': contentType },
      body: JSON.stringify({ type: 'client-request', rpcId: 'r1', method: 'agy-multimodal', payload: { method, payload } }),
    }));
    return response.headers.get('content-type')?.includes('json') ? response.json() : response.status;
  };
  return host;
}

test('le plugin enregistre son adaptateur, ses deux outils, /agy et sa route', async () => {
  const host = fakeHost();
  const adapter = host.adapters['agy-mm'];
  const ids = (await adapter.listModels('agy-mm')).map((m) => m.id);
  assert.ok(ids.includes('gemini-3.8-flash'), ids.join());
  assert.ok(!ids.some((id) => id.includes('image') || id.includes('claude')));
  const model = await adapter.resolveModel('agy-mm', 'gemini-3.8-flash');
  assert.equal(model.context.contextWindow, 1048576);
  assert.equal(model.reasoning.defaultEffort, 'medium');
  await assert.rejects(adapter.resolveModel('agy-mm', 'inconnu'), /modèle inconnu/);
  assert.deepEqual(Object.keys(host.tools).sort(), ['agy_media', 'agy_web_search']);
  assert.equal((await host.commands.agy.handler({ rawInput: '' })).text, 'Aucun compte : lancez /agy login');
  assert.ok(host.routes['/api/agy-multimodal']);
});

test('sans compte, un appel se termine par un échec MISSING_CREDENTIAL, pas une exception', async () => {
  const adapter = fakeHost().adapters['agy-mm'];
  const chunks = [];
  for await (const chunk of adapter.stream({ provider: 'agy-mm', model: 'gemini-3.8-flash', messages: [{ role: 'user', content: [{ type: 'text', text: 'salut' }] }] })) chunks.push(chunk);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].reason.failure.code, 'MISSING_CREDENTIAL');
});

test('la route RPC répond au format DSH et refuse ce qui n\'est pas une requête JSON connue', async () => {
  const host = fakeHost();
  const status = await host.rpc('status', {});
  assert.equal(status.type, 'server-response');
  assert.equal(status.rpcId, 'r1');
  assert.deepEqual(status.result.value.accounts, []);
  assert.equal(status.result.value.login.pending, false);
  assert.equal(await host.rpc('status', {}, 'text/plain'), 415);
  const unknown = await host.rpc('constructor', {});
  assert.deepEqual(unknown.result.error, { code: 'agy-mm/bad-request', message: 'requête invalide', details: {} });
  const failed = await host.rpc('account.use', { email: 'x@y' });
  assert.equal(failed.result.ok, false);
  assert.match(failed.result.error.message, /compte inconnu/);
  assert.deepEqual(failed.result.error.details, {});
});

test('les interrupteurs d\'accès retirent outils et modèles, et sont enregistrés', async () => {
  const host = fakeHost();
  const adapter = host.adapters['agy-mm'];
  await host.rpc('settings', { web: false, hiddenModels: ['gemini-4-argon', 'inventé'] });
  assert.deepEqual(Object.keys(host.tools), ['agy_media']);
  assert.ok(!(await adapter.listModels('agy-mm')).some((m) => m.id === 'gemini-4-argon'));
  assert.deepEqual(host.emitted, ['llm/adapters-updated']);
  const saved = JSON.parse(await readFile(join(process.env.HOME, '.dsh/agy-multimodal/settings.json'), 'utf8'));
  assert.deepEqual(saved, { gemini: true, web: false, media: true, hiddenModels: ['gemini-4-argon'] });

  await host.rpc('settings', { gemini: false, web: true });
  assert.deepEqual(Object.keys(host.tools).sort(), ['agy_media', 'agy_web_search']);
  assert.deepEqual(await adapter.listModels('agy-mm'), []);
  const chunks = [];
  for await (const chunk of adapter.stream({ provider: 'agy-mm', model: 'gemini-3.8-flash', messages: [] })) chunks.push(chunk);
  assert.equal(chunks[0].reason.failure.code, 'DISABLED');
  await host.rpc('settings', { gemini: true, hiddenModels: [] }); // remet l'état par défaut pour les autres tests
});
