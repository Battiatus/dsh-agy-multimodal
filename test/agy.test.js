import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaType, offeredModels, sourcesOf, sseEvents, textOf } from '../lib/agy.js';

test('textOf ignore le raisonnement et lit la réponse enveloppée', () => {
  const reply = { response: { candidates: [{ content: { parts: [
    { text: 'je réfléchis', thought: true }, { text: 'Bon' }, { text: 'jour' }] } }] } };
  assert.equal(textOf(reply), 'Bonjour');
  assert.equal(textOf({ candidates: [{ content: { parts: [{ text: 'nu' }] } }] }), 'nu');
  assert.equal(textOf({ response: { candidates: [] } }), '');
});

test('sourcesOf dédoublonne les sources web', () => {
  const reply = { response: { candidates: [{ groundingMetadata: { groundingChunks: [
    { web: { uri: 'https://a.fr', title: 'A' } }, { web: { uri: 'https://a.fr', title: 'A bis' } },
    { web: { uri: 'https://b.fr' } }, { retrievedContext: {} }] } }] } };
  assert.deepEqual(sourcesOf(reply), [{ title: 'A', uri: 'https://a.fr' }, { title: 'https://b.fr', uri: 'https://b.fr' }]);
});

test('mediaType reconnaît image, audio, vidéo et refuse le reste', () => {
  assert.equal(mediaType('/x/photo.JPG'), 'image/jpeg');
  assert.equal(mediaType('conte.flac'), 'audio/flac');
  assert.equal(mediaType('conte.mp4'), 'video/mp4');
  assert.throws(() => mediaType('notes.txt'), /unsupported format/);
});

test('sseEvents recolle les événements coupés entre deux paquets', async () => {
  const encoder = new TextEncoder();
  const chunks = ['data: {"a":', '1}\r\n\r\ndata: {"a":2}\n\n', 'data: {"a":3}'].map((s) => encoder.encode(s));
  const seen = [];
  for await (const event of sseEvents(chunks)) seen.push(event.a);
  assert.deepEqual(seen, [1, 2, 3]);
});

test('plusieurs comptes : liste sans jetons, bascule, retrait de l\'actif', async () => {
  const { mkdtemp, readFile, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { Agy } = await import('../lib/agy.js');
  const path = join(await mkdtemp(join(tmpdir(), 'agy-acc-')), 'accounts.json');
  const account = (email) => ({ email, refresh: `r-${email}`, access: `a-${email}`, expires: 1 });
  await writeFile(path, JSON.stringify({ active: 'a@x', accounts: { 'a@x': account('a@x'), 'b@x': account('b@x') } }));
  const agy = new Agy(path);
  assert.deepEqual(await agy.accounts(), [{ email: 'a@x', active: true, expires: 1 }, { email: 'b@x', active: false, expires: 1 }]);
  await agy.use('b@x');
  assert.equal((await agy.account()).email, 'b@x');
  await assert.rejects(agy.use('c@x'), /unknown account/);
  await agy.remove('b@x');
  assert.equal((await agy.account()).email, 'a@x');
  assert.ok(!(await readFile(path, 'utf8')).includes('b@x'));
  await agy.remove('a@x');
  assert.equal(await agy.account(), null);
  await assert.rejects(agy.credentials(), /no Antigravity account/);
});

test('offeredModels reprend la liste du sélecteur de Google telle quelle, sans les modèles indisponibles', () => {
  const m = (displayName, extra = {}) => ({ displayName, maxTokens: 1048576, maxOutputTokens: 65536, supportsImages: true, ...extra });
  const offer = offeredModels({
    models: {
      'gemini-3.8-flash-high': m('Gemini 3.8 Flash (High)'),
      'gemini-3.8-flash-low': m('Gemini 3.8 Flash (Low)'),
      'claude-sonnet-4-6': m('Claude Sonnet 4.6 (Thinking)', { maxTokens: 250000 }),
      'gpt-oss-120b-medium': m('GPT-OSS 120B (Medium)', { supportsImages: undefined }),
      'gemini-4-argon-disabled': m('Gemini 4 Argon', { disabled: true }),
      'gemini-3.5-flash-lite': m('Gemini 3.5 Flash Lite'),
    },
    agentModelSorts: [{ displayName: 'Recommended', groups: [{ modelIds: [
      'gemini-3.8-flash-high', 'gemini-3.8-flash-low', 'claude-sonnet-4-6', 'gpt-oss-120b-medium', 'gemini-4-argon-disabled'] }] }],
    defaultAgentModelId: 'gemini-3.8-flash-high',
    webSearchModelIds: ['gemini-3.5-flash-lite'],
  });
  assert.deepEqual(offer.models.map((x) => [x.id, x.name, x.images]), [
    ['gemini-3.8-flash-high', 'Gemini 3.8 Flash (High)', true],
    ['gemini-3.8-flash-low', 'Gemini 3.8 Flash (Low)', true],
    ['claude-sonnet-4-6', 'Claude Sonnet 4.6 (Thinking)', true],
    ['gpt-oss-120b-medium', 'GPT-OSS 120B (Medium)', false],
  ]);
  assert.equal(offer.models[2].limit.context, 250000);
  assert.equal(offer.defaultModel, 'gemini-3.8-flash-high');
  assert.equal(offer.webSearchModel, 'gemini-3.5-flash-lite');
});

test('connexion : lien Google tout de suite, adresse collée vérifiée, annulation', async () => {
  const { mkdtemp } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { Agy } = await import('../lib/agy.js');
  const agy = new Agy(join(await mkdtemp(join(tmpdir(), 'agy-login-')), 'accounts.json'));
  await assert.rejects(agy.finishLogin('http://localhost:51121/oauth-callback?code=c&state=s'), /no sign-in in progress/);
  const { url, done } = await agy.beginLogin();
  assert.match(url, /^https:\/\/accounts\.google\.com\//);
  await assert.rejects(agy.finishLogin('http://localhost:51121/oauth-callback'), /no sign-in code/);
  await assert.rejects(agy.finishLogin('http://localhost:51121/oauth-callback?code=c&state=other'), /another sign-in attempt/);
  agy.cancelLogin();
  await assert.rejects(done, /sign-in cancelled/);
  await assert.rejects(agy.finishLogin('code=c'), /no sign-in in progress/);
});

test('un fichier de comptes illisible n\'est jamais écrasé par une liste vide', async () => {
  const { mkdtemp, readFile, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { Agy } = await import('../lib/agy.js');
  const path = join(await mkdtemp(join(tmpdir(), 'agy-bad-')), 'accounts.json');
  await writeFile(path, '{"active":"a@x","accounts":{"a@x":{tronqu');
  const agy = new Agy(path);
  await assert.rejects(agy.accounts(), /damaged/);
  await assert.rejects(agy.remove('a@x'), /damaged/);
  assert.equal(await readFile(path, 'utf8'), '{"active":"a@x","accounts":{"a@x":{tronqu');
  assert.deepEqual(await new Agy(join(tmpdir(), 'absent-agy', 'accounts.json')).accounts(), []);
});

test('les erreurs réseau nomment la cause, et les certificats du système sont acceptés', async () => {
  const { networkCause, trustSystemCertificates } = await import('../lib/agy.js');
  const cause = (code, message) => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(message), { code }) });
  assert.match(networkCause(cause('ENOTFOUND', 'getaddrinfo ENOTFOUND cloudcode-pa.googleapis.com')), /DNS/);
  assert.match(networkCause(cause('UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'unable to get local issuer certificate')), /NODE_EXTRA_CA_CERTS/);
  assert.match(networkCause(cause('ECONNRESET', 'socket hang up')), /HTTPS_PROXY/);
  // Windows réel : cloudcode-pa.googleapis.com redirigé vers la machine (fichier hosts ou bloqueur DNS)
  const redirected = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:443'), { code: 'ECONNREFUSED', address: '127.0.0.1' }) });
  assert.match(networkCause(redirected), /hosts file/);
  assert.equal(trustSystemCertificates(), true); // Node 24 de DSH, comme celui des tests
});
