import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Charge client.js comme le fait DSH (script classique) avec un faux React : vérifie l'enregistrement et le rendu.
async function loadClient(states = []) {
  let registered;
  const window = { __ModuleLoader__: { load: (entry) => { registered = entry; } } };
  const appended = [];
  const element = (tag) => ({ tag, children: [], append(...c) { this.children.push(...c); }, setAttribute(k, v) { this[k] = v; }, remove() { this.removed = true; } });
  const body = element('body');
  const document = { head: { append: (el) => appended.push(el) }, body, createElement: element, createTextNode: (text) => ({ text }) };
  vm.runInNewContext(await readFile(new URL('../client.js', import.meta.url), 'utf8'), { window, document });
  let i = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (initial) => [i < states.length ? states[i++] : initial, () => {}],
    useEffect: () => {},
  };
  const component = (name) => (props) => ({ type: name, props, children: [props.label ?? ''] });
  const ui = { Button: component('Button'), StateDot: component('StateDot'), Switch: component('Switch'), Tag: component('Tag') };
  const plugin = registered.factory((name) => ({ react: React, '@deepseek-ai/dsh-client-ui-primitives': ui })[name]);
  return { id: registered.id, plugin, appended, body };
}

const textOf = (node) => (node == null || node === false ? ''
  : typeof node !== 'object' ? String(node)
    : [node.props?.label ?? '', ...(node.children ?? []).map(textOf)].join(' '));

test('client.js s\'enregistre sous le nom du paquet et ajoute sa section de réglages', async () => {
  const { id, plugin, appended, body } = await loadClient();
  assert.equal(id, JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).name);
  assert.deepEqual([...plugin.inject], ['slots', 'connection']); // tableau d'un autre contexte vm
  let section;
  const listeners = {};
  const ctx = {
    on: (name, fn) => { listeners[name] = fn; },
    get: () => ({ rpc: { call: async () => ({ ok: true, value: {} }) } }),
    effect: (fn) => fn(),
    slots: { inject: (_slot, fn) => fn(), register: (options, render) => { section = { options, render }; } },
  };
  plugin.apply(ctx);
  assert.equal(section.options.id, 'agy-multimodal');
  assert.equal(section.options.label, 'Antigravity');
  assert.equal(appended.length, 1);
  // résultat de /agy affiché en carte, lien Google cliquable (DSH le cache dans une session vide)
  listeners['command/executed']('s1', 'export', { kind: 'success', text: 'x' });
  assert.equal(body.children.length, 0);
  listeners['command/executed']('s1', 'agy', { kind: 'success', text: 'Sign in here:\nhttps://accounts.google.com/o/oauth2?x=1\nthen' });
  const link = body.children[0].children.find((c) => c.tag === 'a');
  assert.equal(link.href, 'https://accounts.google.com/o/oauth2?x=1');
  assert.equal(link.textContent, 'Open Google sign-in');
});

test('la section affiche comptes, connexion, quotas et interrupteurs d\'accès', async () => {
  const status = {
    accounts: [{ email: 'a@x', active: true }, { email: 'b@x', active: false }],
    login: { pending: false, error: 'port 51121 is already in use' },
    settings: { gemini: true, web: false, media: true, hiddenModels: ['gemini-4-argon'] },
    models: [{ id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' }, { id: 'gemini-4-argon', name: 'Gemini 4 Argon' }],
  };
  const { plugin } = await loadClient([status, null, 0]);
  let render;
  plugin.apply({ on: () => {}, get: () => ({ rpc: { call: async () => ({}) } }), effect: (fn) => fn(),
    slots: { inject: (_s, fn) => fn(), register: (_o, r) => { render = r; } } });
  const section = render();
  const tree = section.type(section.props); // rend la fonction Section avec les états fournis
  const text = textOf(tree);
  for (const expected of ['a@x', 'b@x', 'In use', 'Use this account', 'Sign out', 'Add another Google account', 'port 51121 is already in use', 'Refresh quota', 'Google web search', 'Media analysis']) {
    assert.ok(text.includes(expected), `absent : ${expected}`);
  }
  const switches = [];
  const walk = (n) => { if (n && typeof n === 'object') { if (n.props && 'checked' in n.props) switches.push(n.props); (n.children ?? []).forEach(walk); } };
  walk(tree);
  // deux frères de même clé font dupliquer les lignes par React à chaque rafraîchissement
  const checkKeys = (n) => {
    if (!n || typeof n !== 'object') return;
    const keys = (n.children ?? []).map((c) => c?.props?.key).filter((k) => k !== undefined);
    assert.equal(new Set(keys).size, keys.length, `clés en double : ${keys}`);
    (n.children ?? []).forEach(checkKeys);
  };
  checkKeys(tree);
  const byLabel = Object.fromEntries(switches.map((s) => [s.label, s.checked]));
  assert.equal(byLabel['Google web search'], false);
  assert.equal(byLabel['Gemini 4 Argon'], false);
  assert.equal(byLabel['Gemini 3.8 Flash'], true);
});

test('pendant une connexion, la section montre le lien Google et le champ pour coller l\'adresse', async () => {
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?state=s';
  const status = { accounts: [], login: { pending: true, url, error: null },
    settings: { gemini: true, web: true, media: true, hiddenModels: [] }, models: [] };
  const { plugin } = await loadClient([status, null, 0, '', false, false, null]);
  let render;
  plugin.apply({ on: () => {}, get: () => ({ rpc: { call: async () => ({}) } }), effect: (fn) => fn(),
    slots: { inject: (_s, fn) => fn(), register: (_o, r) => { render = r; } } });
  const section = render();
  const tree = section.type(section.props);
  let signIn;
  const walk = (n) => { if (n && typeof n === 'object') { if (n.props?.url) signIn = n; (n.children ?? []).forEach(walk); } };
  walk(tree);
  assert.equal(signIn.props.url, url);
  const panel = signIn.type(signIn.props);
  const text = textOf(panel);
  for (const expected of ['Open Google sign-in', 'Copy link', 'localhost:51121', 'Finish', 'Cancel sign-in']) assert.ok(text.includes(expected), `absent : ${expected}`);
  let link;
  const find = (n) => { if (n && typeof n === 'object') { if (n.type === 'a') link = n; (n.children ?? []).forEach(find); } };
  find(panel);
  assert.equal(link.props.href, url);
  assert.equal(link.props.target, '_blank');
});
