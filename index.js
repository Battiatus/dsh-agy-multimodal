// Plugin DeepSeek Harness : modèles Gemini de l'abonnement Antigravity (OAuth Google), plus recherche web et médias.
// L'écran de réglages (client.js) appelle la route /api/agy-multimodal : comptes, quotas, accès.
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Agy, CALLBACK_PORT, DEFAULT_ACCOUNT_PATH, MAX_REQUEST_BYTES, mediaType, openBrowser, sourcesOf, sseEvents, textOf, wireModel } from './lib/agy.js';
import { failureOf, toChunks, toRequest } from './lib/gemini.js';

export const name = 'agy-multimodal';
export const inject = ['llm', 'attachments'];

const PROVIDER = 'agy-mm'; // route propre : google-antigravity, google et agy sont déjà pris par d'autres plugins
const SETTINGS_PATH = join(dirname(DEFAULT_ACCOUNT_PATH), 'settings.json');
const QUOTA_TTL_MS = 30_000; // évite de solliciter Google à chaque ouverture de l'écran
const MODELS_TTL_MS = 5 * 60_000; // le sélecteur de DSH relit souvent la liste
const EFFORT_NAMES = { minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High' };

/** Réglages d'accès validés : interrupteurs booléens et ids de modèles masqués. */
export function cleanSettings(value = {}) {
  const flag = (v) => v !== false;
  return {
    gemini: flag(value.gemini), web: flag(value.web), media: flag(value.media), images: flag(value.images),
    hiddenModels: Array.isArray(value.hiddenModels) ? [...new Set(value.hiddenModels.filter((id) => typeof id === 'string' && id.length <= 200))] : [],
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

  // Ce que Google propose au compte actif, relu au plus toutes les 5 min ; sans compte ou hors ligne : la dernière réponse connue
  const NONE = { models: [] };
  let catalog = { at: 0, value: NONE };
  const offer = async () => {
    if (Date.now() - catalog.at < MODELS_TTL_MS) return catalog.value;
    try {
      catalog = { at: Date.now(), value: await agy.models() };
    } catch (error) {
      // réessai dans 30 s ; l'erreur est montrée dans les réglages (sans compte, ce n'en est pas une)
      catalog = { ...catalog, at: Date.now() - MODELS_TTL_MS + 30_000, error: /no Antigravity account/.test(error.message) ? null : error.message };
    }
    return catalog.value;
  };
  const models = async () => (await offer()).models;
  const modelsChanged = () => {
    catalog = { at: 0, value: NONE };
    ctx.emit('llm/adapters-updated'); // le sélecteur de modèles de DSH relit la liste
  };
  const findModel = async (id) => {
    const m = (await models()).find((x) => x.id === id || x.wire === id || x.efforts.some((e) => e.wire === id));
    if (m) return m;
    await agy.credentials(); // sans compte : l'erreur « no Antigravity account » plutôt qu'un modèle inconnu
    throw Object.assign(new Error(`unknown model: ${id}`), { failure: { message: `unknown model: ${id}`, code: 'INVALID_MODEL' } });
  };
  // Modèle désigné par Google pour la tâche : `webSearchModel` pour la recherche, `defaultModel` (celui de l'agent) sinon
  const toolModel = async (kind) => {
    const id = (await offer())[kind];
    if (id) return id;
    await agy.credentials();
    throw new Error('Google offers no model for this task on this Antigravity account');
  };

  ctx.llm.registerAdapter([PROVIDER], {
    providerInfo: (provider) => ({ id: provider, name: 'Antigravity' }),
    providerRetryPolicy: () => undefined,
    imageRequestPricing: () => undefined,
    imageRequestTarget: (_p, _m, image) => ({ width: image.width, height: image.height, maxBytes: image.bytes }),
    listModels: async (provider) => (settings.gemini ? await models() : [])
      .filter((m) => !settings.hiddenModels.includes(m.id))
      .map(({ id, name, images }) => ({ provider, id, name, inputModalities: images ? ['text', 'image'] : ['text'] })),
    async resolveModel(provider, model) {
      const m = await findModel(model);
      return {
        provider, id: model, name: m.name, inputModalities: m.images ? ['text', 'image'] : ['text'],
        ...(m.limit.context ? { context: { contextWindow: m.limit.context } } : {}),
        ...(m.limit.output ? { defaultMaxTokens: m.limit.output } : {}),
        // niveaux de raisonnement que Google propose pour ce modèle : DSH les montre dans son sélecteur
        ...(m.efforts.length ? { reasoning: { efforts: m.efforts.map((e) => ({ id: e.id, name: EFFORT_NAMES[e.id] })), defaultEffort: m.defaultEffort } } : {}),
      };
    },
    async prepareCall(provider, model, signal) {
      return { model: await this.resolveModel(provider, model, signal), stream: (options) => this.stream(options) };
    },
    async *stream(options) {
      if (!settings.gemini) {
        yield { type: 'finish', reason: { kind: 'error', failure: { message: 'Antigravity models are turned off in Settings › Antigravity', code: 'DISABLED' } } };
        return;
      }
      try {
        const m = await findModel(options.model);
        // un ancien id à niveau (gemini-3.8-flash-high) garde son niveau quand DSH n'en demande pas
        const wire = wireModel(m, options.reasoningEffort ?? m.efforts.find((e) => e.wire === options.model)?.id);
        const readImage = async (ref) => {
          const stored = await ctx.attachments.readImage(ref, options.signal);
          return { data: stored.data, mediaType: stored.ref.mediaType };
        };
        const response = await agy.call(wire, await toRequest(options, wire, readImage), { stream: true, signal: options.signal, sessionKey: options.sessionId });
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
        const reply = await agy.call(await toolModel('webSearchModel'), { contents: [{ role: 'user', parts: [{ text: query }] }], tools: [{ googleSearch: {} }] }, { signal: exec.signal });
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
        const reply = await agy.call(await toolModel('defaultModel'), { contents: [{ role: 'user', parts: [
          { inlineData: { mimeType, data: Buffer.from(data).toString('base64') } }, { text: prompt }] }] }, { signal: exec.signal });
        return { text: textOf(reply) };
      },
      isConcurrencySafe: () => true,
    }),
    images: (fs) => ({
      name: 'agy_image',
      description: 'Generates an image from a description, or edits images from the working folder (up to 5, as references), with the image model Google offers this Antigravity account. The images are added to the conversation.',
      parameters: { type: 'object', properties: {
        prompt: { type: 'string', minLength: 1, maxLength: 16384, description: 'what to create, or how to change the reference images' },
        images: { type: 'array', maxItems: 5, items: { type: 'string', minLength: 1, maxLength: 4096 }, description: 'paths of images in the working folder to edit or use as references' },
      }, required: ['prompt'], additionalProperties: false },
      output: {
        schema: { type: 'object', properties: { text: { type: 'string' }, images: { type: 'array', items: { type: 'object' } } } },
        render: (_args, value) => [
          { type: 'text', text: value.text || `Created ${value.images.length} image(s).` },
          ...value.images.map((attachment) => ({ type: 'image', attachment })),
        ],
      },
      async execute({ prompt, images = [] }, exec) {
        const references = [];
        for (const path of images) {
          const mimeType = mediaType(path);
          if (!mimeType.startsWith('image/')) throw new Error(`${path}: not an image`);
          references.push({ inlineData: { mimeType, data: Buffer.from(await readWorkspaceFile(fs, exec, path)).toString('base64') } });
        }
        const reply = await agy.call(await toolModel('imageModel'), {
          contents: [{ role: 'user', parts: [{ text: prompt }, ...references] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }, { signal: exec.signal });
        const parts = (reply.response ?? reply).candidates?.[0]?.content?.parts ?? [];
        const saved = [];
        for (const [i, part] of parts.filter((x) => x.inlineData?.mimeType?.startsWith('image/')).entries()) {
          const image = { data: new Uint8Array(Buffer.from(part.inlineData.data, 'base64')), mediaType: part.inlineData.mimeType, name: `agy-image-${i + 1}` };
          await ctx.attachments.validateImage?.(image);
          saved.push(await ctx.attachments.saveImage(image));
        }
        if (saved.length === 0) throw new Error(`no image returned${textOf(reply) ? `: ${textOf(reply).slice(0, 300)}` : ' (the request may have been refused)'}`);
        return { text: textOf(reply), images: saved };
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

  // Connexion Google partagée par l'écran et /agy : rend le lien tout de suite, l'écran suit l'avancement par `status`
  let login = { url: null, error: null };
  const startLogin = async () => {
    const { url, done } = await agy.beginLogin();
    login = { url, error: null };
    done.then(
      () => { if (login.url === url) login = { url: null, error: null }; modelsChanged(); },
      (error) => { if (login.url === url) login = { url: null, error: error.message === 'sign-in cancelled' ? null : error.message }; },
    );
    return url;
  };

  const quotas = new Map(); // email → { at, value }
  const methods = {
    status: async () => ({
      accounts: await agy.accounts(),
      login: { pending: Boolean(login.url), url: login.url, error: login.error },
      settings,
      models: (await models()).map(({ id, name }) => ({ id, name })),
      modelsError: catalog.error ?? null,
    }),
    login: async () => ({ url: await startLogin() }),
    'login.finish': async ({ address }) => ({ email: (await agy.finishLogin(String(address ?? ''))).email }),
    'login.cancel': async () => { agy.cancelLogin(); return {}; },
    'account.use': async ({ email }) => { await agy.use(String(email)); modelsChanged(); return {}; },
    'account.remove': async ({ email }) => {
      await agy.remove(String(email));
      quotas.delete(String(email));
      modelsChanged();
      return {};
    },
    quota: async ({ email, force }) => {
      const hit = quotas.get(String(email));
      if (hit && force !== true && Date.now() - hit.at < QUOTA_TTL_MS) return hit.value;
      const quota = await agy.quota(String(email));
      // repli par modèle : seuls ceux du sélecteur (le compte en liste une vingtaine, dont des modèles internes)
      const offered = new Set((await models()).flatMap((m) => [m.wire, ...m.efforts.map((e) => e.wire)]));
      const value = { pools: quota.pools, models: (quota.models ?? []).filter((m) => offered.has(m.modelId)) };
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
      description: 'Google Antigravity accounts: login, status, use <email>, logout',
      input: { hint: 'login | status | use <email> | logout [email]' },
      async handler({ rawInput }) {
        const [action = 'status', email] = rawInput.trim().split(/\s+/).filter(Boolean);
        try {
          if (action === 'login' && email) {
            const { email: added } = await agy.finishLogin(email);
            return { kind: 'success', text: `Connected as ${added}. Pick an "Antigravity" model in the model picker.` };
          }
          if (action === 'login') {
            const url = await startLogin();
            openBrowser(url); // navigateur de la machine qui fait tourner DSH ; le lien sert ailleurs
            return { kind: 'success', text: [
              'Sign in with Google here (a browser tab may already be open):', url, '',
              `Using DSH from another device? After approving, your browser lands on a page at localhost:${CALLBACK_PORT} that may not load.`,
              'Copy that page\'s full address and run: /agy login <address>',
            ].join('\n') };
          }
          if (action === 'use' && email) {
            await agy.use(email);
            modelsChanged();
            return { kind: 'success', text: `Active account: ${email}` };
          }
          if (action === 'logout') {
            const target = email ?? (await agy.account())?.email;
            if (!target) return { kind: 'error', text: 'No account connected.' };
            await agy.remove(target);
            modelsChanged();
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
