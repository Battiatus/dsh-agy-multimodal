// Plugin DeepSeek Harness : modèles Gemini de l'abonnement Antigravity (OAuth Google), plus recherche web et médias.
// L'écran de réglages (client.js) appelle la route /api/agy-multimodal : comptes, quotas, accès.
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getPublicModelDefinitions } from '@cortexkit/antigravity-auth-core';
import { Agy, DEFAULT_ACCOUNT_PATH, MAX_REQUEST_BYTES, mediaType, sourcesOf, sseEvents, textOf } from './lib/agy.js';
import { failureOf, toChunks, toRequest } from './lib/gemini.js';

export const name = 'agy-multimodal';
export const inject = ['llm', 'attachments'];

const PROVIDER = 'agy-mm'; // route propre : google-antigravity, google et agy sont déjà pris par d'autres plugins
const TOOL_MODEL = 'gemini-3.8-flash-medium';
const SETTINGS_PATH = join(dirname(DEFAULT_ACCOUNT_PATH), 'settings.json');
const QUOTA_TTL_MS = 30_000; // évite de solliciter Google à chaque ouverture de l'écran

// Modèles Gemini texte du catalogue de la bibliothèque (sans le préfixe antigravity-), avec leurs niveaux de réflexion
const MODELS = Object.values(getPublicModelDefinitions())
  .filter((d) => d.id.includes('gemini') && !d.modalities.output.includes('image'))
  .map((d) => ({ id: d.id.replace(/^antigravity-/, ''), name: d.name.replace(' (Antigravity)', ''), limit: d.limit, efforts: Object.keys(d.variants ?? {}) }));

/** Réglages d'accès validés : interrupteurs booléens et modèles masqués connus. */
export function cleanSettings(value = {}) {
  const flag = (v) => v !== false;
  return {
    gemini: flag(value.gemini), web: flag(value.web), media: flag(value.media),
    hiddenModels: Array.isArray(value.hiddenModels) ? MODELS.map((m) => m.id).filter((id) => value.hiddenModels.includes(id)) : [],
  };
}

function loadSettings() {
  try {
    return cleanSettings(JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')));
  } catch {
    return cleanSettings();
  }
}

/** Réponse RPC au format attendu par connection.rpc.call du client DSH. */
export async function handleRpc(methods, request) {
  const reply = (rpcId, result) => Response.json({ type: 'server-response', rpcId, result });
  // details est exigé par le schéma du client, même vide
  const fail = (rpcId, code, message) => reply(rpcId, { ok: false, error: { code, message, details: {} } });
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    return new Response('content type must be application/json', { status: 415 });
  }
  let message;
  try {
    message = await request.json();
  } catch {
    return new Response('body is not JSON', { status: 400 });
  }
  const rpcId = typeof message?.rpcId === 'string' ? message.rpcId : 'invalid-request';
  const call = message?.payload;
  if (message?.type !== 'client-request' || typeof call?.method !== 'string' || !Object.hasOwn(methods, call.method)) {
    return fail(rpcId, 'agy-mm/bad-request', 'invalid request');
  }
  try {
    return reply(rpcId, { ok: true, value: await methods[call.method](call.payload ?? {}) });
  } catch (error) {
    return fail(rpcId, 'agy-mm/failed', String(error?.message ?? error));
  }
}

export function apply(ctx) {
  const agy = new Agy();
  let settings = loadSettings();

  ctx.llm.registerAdapter([PROVIDER], {
    providerInfo: (provider) => ({ id: provider, name: 'Gemini (Antigravity)' }),
    providerRetryPolicy: () => undefined,
    imageRequestPricing: () => undefined,
    imageRequestTarget: (_p, _m, image) => ({ width: image.width, height: image.height, maxBytes: image.bytes }),
    listModels: async (provider) => (settings.gemini ? MODELS : [])
      .filter((m) => !settings.hiddenModels.includes(m.id))
      .map(({ id, name }) => ({ provider, id, name, inputModalities: ['text', 'image'] })),
    async resolveModel(provider, model) {
      const m = MODELS.find((x) => x.id === model);
      if (!m) throw Object.assign(new Error(`unknown model: ${model}`), { failure: { message: `unknown model: ${model}`, code: 'INVALID_MODEL' } });
      return {
        provider, id: m.id, name: m.name, inputModalities: ['text', 'image'],
        context: { contextWindow: m.limit.context }, defaultMaxTokens: m.limit.output,
        ...(m.efforts.length ? { reasoning: { efforts: m.efforts.map((id) => ({ id, name: id })), defaultEffort: 'medium' } } : {}),
      };
    },
    async prepareCall(provider, model, signal) {
      return { model: await this.resolveModel(provider, model, signal), stream: (options) => this.stream(options) };
    },
    async *stream(options) {
      if (!settings.gemini) {
        yield { type: 'finish', reason: { kind: 'error', failure: { message: 'Gemini models are turned off in Settings › Antigravity (Gemini)', code: 'DISABLED' } } };
        return;
      }
      try {
        const wire = `${options.model}-${options.reasoningEffort ?? 'medium'}`;
        const readImage = async (ref) => {
          const stored = await ctx.attachments.readImage(ref, options.signal);
          return { data: stored.data, mediaType: stored.ref.mediaType };
        };
        const response = await agy.call(wire, await toRequest(options, wire, readImage), { stream: true, signal: options.signal });
        yield* toChunks(sseEvents(response.body), options);
      } catch (error) {
        yield options.signal?.aborted
          ? { type: 'finish', reason: { kind: 'aborted', failure: { message: 'request cancelled', code: 'CANCELLED' } } }
          : { type: 'finish', reason: { kind: 'error', failure: failureOf(error) } };
      }
    },
  });

  // Outils de l'agent, chacun enregistré ou retiré selon son interrupteur
  const text = { type: 'object', properties: { text: { type: 'string' } } };
  const TOOLS = {
    web: () => ({
      name: 'agy_web_search',
      description: 'Searches the web with Google Search (Gemini via Antigravity). Returns a concise answer with its sources.',
      parameters: { type: 'object', properties: { query: { type: 'string', minLength: 1, maxLength: 4096 } }, required: ['query'], additionalProperties: false },
      output: {
        schema: { type: 'object', properties: { text: { type: 'string' }, sources: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, uri: { type: 'string' } } } } } },
        render: (_args, value) => [{ type: 'text', text: [value.text, ...value.sources.map((s) => `- ${s.title} : ${s.uri}`)].join('\n') }],
      },
      async execute({ query }, exec) {
        const reply = await agy.call(TOOL_MODEL, { contents: [{ role: 'user', parts: [{ text: query }] }], tools: [{ googleSearch: {} }] }, { signal: exec.signal });
        return { text: textOf(reply), sources: sourcesOf(reply) };
      },
      isConcurrencySafe: () => true,
    }),
    media: (fs) => ({
      name: 'agy_media',
      description: 'Analyses an image, audio, video or PDF file from the working folder with Gemini: describe, transcribe, summarise or answer a question. Max size ~36 MB.',
      parameters: { type: 'object', properties: {
        path: { type: 'string', minLength: 1, maxLength: 4096, description: 'chemin dans le dossier de travail' },
        prompt: { type: 'string', minLength: 1, maxLength: 16384, description: 'instruction for the model' },
      }, required: ['path', 'prompt'], additionalProperties: false },
      output: { schema: text, render: (_args, value) => [{ type: 'text', text: value.text }] },
      async execute({ path, prompt }, exec) {
        const mimeType = mediaType(path);
        const data = await readWorkspaceFile(fs, exec, path);
        const reply = await agy.call(TOOL_MODEL, { contents: [{ role: 'user', parts: [
          { inlineData: { mimeType, data: Buffer.from(data).toString('base64') } }, { text: prompt }] }] }, { signal: exec.signal });
        return { text: textOf(reply) };
      },
      isConcurrencySafe: () => true,
    }),
  };
  let toolCtx;
  const registered = {};
  const syncTools = () => {
    if (!toolCtx) return;
    for (const [key, tool] of Object.entries(TOOLS)) {
      if (settings[key] && !registered[key]) registered[key] = toolCtx.tools.register(tool(toolCtx.fs));
      else if (!settings[key] && registered[key]) {
        registered[key]();
        delete registered[key];
      }
    }
  };
  ctx.inject(['tools', 'fs'], (c) => {
    toolCtx = c;
    syncTools();
    // les outils partent avec ce contexte : on oublie leurs poignées pour les réenregistrer au retour du service
    c.effect(() => () => {
      toolCtx = undefined;
      for (const key of Object.keys(registered)) delete registered[key];
    });
  });

  // Connexion lancée depuis l'écran : la requête rend la main tout de suite, l'écran suit l'avancement par `status`
  let login = { controller: null, error: null };
  const startLogin = () => {
    if (login.controller) return;
    const controller = new AbortController();
    login = { controller, error: null };
    agy.login({ signal: controller.signal }).then(
      () => { login = { controller: null, error: null }; },
      (error) => { login = { controller: null, error: controller.signal.aborted ? null : error.message }; },
    );
  };

  const quotas = new Map(); // email → { at, value }
  const methods = {
    status: async () => ({
      accounts: await agy.accounts(),
      login: { pending: Boolean(login.controller), error: login.error },
      settings,
      models: MODELS.map(({ id, name }) => ({ id, name })),
    }),
    login: async () => { startLogin(); return {}; },
    'login.cancel': async () => { login.controller?.abort(); return {}; },
    'account.use': async ({ email }) => { await agy.use(String(email)); return {}; },
    'account.remove': async ({ email }) => {
      await agy.remove(String(email));
      quotas.delete(String(email));
      return {};
    },
    quota: async ({ email, force }) => {
      const hit = quotas.get(String(email));
      if (hit && force !== true && Date.now() - hit.at < QUOTA_TTL_MS) return hit.value;
      const { gemini, models } = await agy.quota(String(email));
      // seuls les modèles proposés par ce plugin (le catalogue en compte une quinzaine)
      const value = { gemini, models: models.filter((m) => MODELS.some(({ id }) => m.modelId.startsWith(id))) };
      quotas.set(String(email), { at: Date.now(), value });
      return value;
    },
    settings: async (patch) => {
      settings = cleanSettings({ ...settings, ...patch });
      await mkdir(dirname(SETTINGS_PATH), { recursive: true, mode: 0o700 });
      await writeFile(SETTINGS_PATH, JSON.stringify(settings));
      syncTools();
      ctx.emit('llm/adapters-updated'); // le sélecteur de modèles de DSH relit la liste
      return settings;
    },
  };
  ctx.inject(['connection'], (c) => {
    const connection = c.get('connection');
    c.effect(() => connection.fetch.register({
      path: '/api/agy-multimodal', methods: ['POST'], requestBody: 'buffered',
      fetch: (request) => handleRpc(methods, request),
    }));
  });

  ctx.inject(['commands'], (commandCtx) => {
    commandCtx.commands.register({
      name: 'agy',
      description: 'Google Antigravity accounts for Gemini models (/agy login | status | use <email> | logout)',
      input: { hint: '[login|status|use <email>|logout]' },
      async handler({ rawInput, signal }) {
        const [action = 'status', email] = rawInput.trim().split(/\s+/).filter(Boolean);
        try {
          if (action === 'login') {
            const { email: added } = await agy.login({ signal });
            return { kind: 'success', text: `Connected (${added}). Pick a "Gemini (Antigravity)" model.` };
          }
          if (action === 'use' && email) {
            await agy.use(email);
            return { kind: 'success', text: `Active account: ${email}` };
          }
          if (action === 'logout') {
            const target = email ?? (await agy.account())?.email;
            if (!target) return { kind: 'error', text: 'No account connected.' };
            await agy.remove(target);
            return { kind: 'success', text: `${target} signed out: its tokens were deleted from this machine.` };
          }
          if (action === 'status') {
            const list = await agy.accounts();
            return { kind: 'success', text: list.length ? list.map((a) => `${a.active ? '● ' : '○ '}${a.email}`).join('\n') : 'No account: run /agy login' };
          }
          return { kind: 'error', text: 'usage: /agy login | status | use <email> | logout [email]' };
        } catch (error) {
          return { kind: 'error', text: error.message };
        }
      },
    });
  });
}

/** Octets d'un fichier ordinaire du dossier de travail (ni lien symbolique, ni hors du dossier). */
async function readWorkspaceFile(fs, exec, path) {
  const cwd = exec.agent?.session?.header?.cwd;
  if (!cwd) throw new Error('no active working folder');
  const entry = await fs.lstat(path, { cwd }, exec.signal);
  if (entry?.type !== 'file') throw new Error(`${path}: not a regular file (symlinks and folders are refused)`);
  const root = await fs.resolve(cwd, { cwd, signal: exec.signal });
  const target = await fs.resolve(path, { cwd, signal: exec.signal });
  if (!fs.contains(root, target)) throw new Error(`${path}: outside the working folder`);
  // shortcut: pas de contrôle de version avant/après lecture (fichier remplacé pendant la lecture), à ajouter si le dossier est partagé
  const maxBytes = Math.floor(MAX_REQUEST_BYTES * 3 / 4);
  const data = await fs.readBytes(target, exec.signal, maxBytes + 1);
  if (data.byteLength > maxBytes) throw new Error(`${path}: over ${(maxBytes / 1e6).toFixed(0)} MB, too large to send inline`);
  return data;
}
