import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaType, sourcesOf, sseEvents, textOf } from '../lib/agy.js';

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
