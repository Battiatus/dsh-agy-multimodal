import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Charge client.js comme le fait DSH (script classique) avec un faux React : vérifie l'enregistrement et le rendu.
async function loadClient(states = []) {
  let registered;
  const window = { __ModuleLoader__: { load: (entry) => { registered = entry; } } };
  const appended = [];
  const document = { head: { append: (el) => appended.push(el) }, createElement: () => ({ remove() {} }) };
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
  return { id: registered.id, plugin, appended };
}

const textOf = (node) => (node == null || node === false ? ''
  : typeof node !== 'object' ? String(node)
    : [node.props?.label ?? '', ...(node.children ?? []).map(textOf)].join(' '));

test('client.js s\'enregistre sous le nom du paquet et ajoute sa section de réglages', async () => {
  const { id, plugin, appended } = await loadClient();
  assert.equal(id, JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).name);
  assert.deepEqual([...plugin.inject], ['slots', 'connection']); // tableau d'un autre contexte vm
  let section;
  const ctx = {
    get: () => ({ rpc: { call: async () => ({ ok: true, value: {} }) } }),
    effect: (fn) => fn(),
    slots: { inject: (_slot, fn) => fn(), register: (options, render) => { section = { options, render }; } },
  };
  plugin.apply(ctx);
  assert.equal(section.options.id, 'agy-multimodal');
  assert.equal(section.options.label, 'Antigravity (Gemini)');
  assert.equal(appended.length, 1);
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
  plugin.apply({ get: () => ({ rpc: { call: async () => ({}) } }), effect: (fn) => fn(),
    slots: { inject: (_s, fn) => fn(), register: (_o, r) => { render = r; } } });
  const section = render();
  const tree = section.type(section.props); // rend la fonction Section avec les états fournis
  const text = textOf(tree);
  for (const expected of ['a@x', 'b@x', 'active', 'Use', 'Add a Google account', 'port 51121 is already in use', 'Quotas', 'Web search']) {
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
  assert.equal(byLabel['Web search (agy_web_search tool)'], false);
  assert.equal(byLabel['Gemini 4 Argon'], false);
  assert.equal(byLabel['Gemini 3.8 Flash'], true);
});
