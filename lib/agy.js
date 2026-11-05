// Client Antigravity (« agy ») : connexion OAuth Google, jetons, appels Gemini via v1internal.
// Canal non officiel : Google a déjà banni des comptes branchés ainsi dans des outils tiers.
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import {
  ANTIGRAVITY_ENDPOINT_FALLBACKS, accessTokenExpired, aggregateQuota, applyAgyNativeGenerationConfig, authorizeAntigravity,
  ensureProjectContext, exchangeAntigravity, fetchAvailableModels, fetchWithAgyCliTransport, formatRefreshParts,
  parseRefreshParts, refreshAntigravityToken, resolveModelWithTier,
} from '@cortexkit/antigravity-auth-core';

export const DEFAULT_ACCOUNT_PATH = join(homedir(), '.dsh/agy-multimodal/accounts.json');
export const CALLBACK_PORT = 51121; // imposé par l'URI de retour enregistrée chez Google pour ce client OAuth
export const MAX_REQUEST_BYTES = 48e6; // au-delà, le serveur refuse les données en ligne (limite reprise de dsh-antigravity-auth)

// Types acceptés par Gemini en données en ligne (doc Gemini API : image, audio, vidéo, PDF)
export const MEDIA_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif',
  '.wav': 'audio/wav', '.mp3': 'audio/mp3', '.aiff': 'audio/aiff', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
  '.mp4': 'video/mp4', '.mpeg': 'video/mpeg', '.mpg': 'video/mpg', '.mov': 'video/mov', '.avi': 'video/avi', '.flv': 'video/x-flv',
  '.webm': 'video/webm', '.wmv': 'video/wmv', '.3gp': 'video/3gpp',
  '.pdf': 'application/pdf',
};

export function mediaType(path) {
  const type = MEDIA_TYPES[extname(path).toLowerCase()];
  if (!type) throw new Error(`format non pris en charge : ${extname(path) || path} (acceptés : ${Object.keys(MEDIA_TYPES).join(' ')})`);
  return type;
}

/** Texte de la réponse, sans les parties de raisonnement (`thought`). v1internal enveloppe la réponse dans `response`. */
export function textOf(reply) {
  const parts = (reply.response ?? reply).candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => !p.thought && p.text).map((p) => p.text).join('');
}

/** Sources web citées par l'ancrage Google Search : [{ title, uri }], sans doublon. */
export function sourcesOf(reply) {
  const chunks = (reply.response ?? reply).candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Map();
  for (const { web } of chunks) if (web?.uri && !seen.has(web.uri)) seen.set(web.uri, { title: web.title ?? web.uri, uri: web.uri });
  return [...seen.values()];
}

/** Objets JSON d'un flux SSE (`data: {...}` suivis d'une ligne vide), dans l'ordre. */
export async function* sseEvents(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer = (buffer + decoder.decode(chunk, { stream: true })).replace(/\r\n/g, '\n');
    for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
      const data = buffer.slice(0, end).split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
      buffer = buffer.slice(end + 2);
      if (data) yield JSON.parse(data);
    }
  }
  const tail = buffer.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
  if (tail) yield JSON.parse(tail);
}

export class Agy {
  /** Comptes dans `accountPath` : { active: email, accounts: { [email]: { refresh, access, expires, email } } }. */
  constructor(accountPath = DEFAULT_ACCOUNT_PATH) {
    this.accountPath = accountPath;
  }

  async #load() {
    try {
      return JSON.parse(await readFile(this.accountPath, 'utf8'));
    } catch {
      return { active: null, accounts: {} };
    }
  }

  // écriture atomique : un fichier à moitié écrit ferait perdre tous les jetons
  async #store(data) {
    await mkdir(dirname(this.accountPath), { recursive: true, mode: 0o700 });
    const tmp = `${this.accountPath}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(data), { mode: 0o600 });
    await chmod(tmp, 0o600);
    await rename(tmp, this.accountPath);
  }

  async #save({ refresh, access, expires, email }) {
    const data = await this.#load();
    data.accounts[email] = { refresh, access, expires, email };
    await this.#store(data);
  }

  /** Comptes connectés, sans les jetons : [{ email, active, expires }]. */
  async accounts() {
    const { active, accounts } = await this.#load();
    return Object.values(accounts).map(({ email, expires }) => ({ email, active: email === active, expires }));
  }

  /** Compte actif, ou null. */
  async account() {
    return (await this.accounts()).find((a) => a.active) ?? null;
  }

  async use(email) {
    const data = await this.#load();
    if (!data.accounts[email]) throw new Error(`compte inconnu : ${email}`);
    await this.#store({ ...data, active: email });
  }

  /** Retire un compte de cette machine ; si c'était l'actif, le suivant prend sa place. */
  async remove(email) {
    const data = await this.#load();
    delete data.accounts[email];
    if (data.active === email) data.active = Object.keys(data.accounts)[0] ?? null;
    await this.#store(data);
  }

  /**
   * Ouvre la connexion Google dans le navigateur et attend le retour sur 127.0.0.1:51121.
   * Le port n'est tenu que pendant la connexion ; s'il est pris (autre plugin Antigravity), rien n'est ouvert.
   */
  async login({ open = (url) => execFile('open', [url]), signal, timeoutMs = 5 * 60_000 } = {}) {
    const { url } = await authorizeAntigravity();
    const state = new URL(url).searchParams.get('state');
    const [code, returned] = await new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        if (!req.url.startsWith('/oauth-callback')) return res.writeHead(404).end();
        const q = new URL(req.url, `http://localhost:${CALLBACK_PORT}`).searchParams;
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Connexion reçue, vous pouvez fermer cet onglet.');
        finish(() => (q.get('code') ? resolve([q.get('code'), q.get('state')]) : reject(new Error(q.get('error') ?? 'pas de code'))));
      });
      const timer = setTimeout(() => finish(() => reject(new Error('connexion abandonnée (délai dépassé)'))), timeoutMs);
      const abort = () => finish(() => reject(new Error('connexion annulée')));
      signal?.addEventListener('abort', abort, { once: true });
      function finish(settle) {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        server.close();
        settle();
      }
      server.on('error', (error) => finish(() => reject(error.code === 'EADDRINUSE'
        ? new Error(`port ${CALLBACK_PORT} déjà pris (autre outil Antigravity ouvert ?) : fermez-le puis relancez la connexion`)
        : error)));
      server.listen(CALLBACK_PORT, '127.0.0.1', () => open(url));
    });
    if (returned !== state) throw new Error('state OAuth différent : connexion refusée');
    const result = await exchangeAntigravity(code, state);
    if (result.type !== 'success') throw new Error(`échange OAuth refusé : ${result.error}`);
    const email = result.email ?? `compte-${Date.now()}`; // l'adresse sert de clé ; Google la renvoie normalement
    await this.#save({ ...result, email });
    const data = await this.#load();
    await this.#store({ ...data, active: email });
    return { email };
  }

  /** Jeton d'accès et projet d'un compte (l'actif par défaut), rafraîchis au besoin. */
  async credentials(email) {
    const { active, accounts } = await this.#load();
    let auth = accounts[email ?? active];
    if (!auth) throw new Error('aucun compte Antigravity : lancez /agy login');
    if (accessTokenExpired(auth)) {
      const parts = parseRefreshParts(auth.refresh);
      const fresh = await refreshAntigravityToken(parts.refreshToken);
      auth = { ...auth, ...fresh, refresh: formatRefreshParts({ ...parts, refreshToken: fresh.refresh }) };
      await this.#save(auth);
    }
    const context = await ensureProjectContext({ type: 'oauth', ...auth });
    if (context.auth.refresh !== auth.refresh) await this.#save({ ...auth, refresh: context.auth.refresh });
    return { access: auth.access, project: context.effectiveProjectId };
  }

  /**
   * Un appel Gemini. `request` suit generateContent (contents, systemInstruction, tools, generationConfig).
   * `stream: true` renvoie la Response SSE brute (streamGenerateContent?alt=sse) ; sinon le JSON de la réponse.
   */
  async call(model, request, { stream = false, signal } = {}) {
    const { access, project } = await this.credentials();
    const wire = resolveModelWithTier(model).actualModel;
    const generationConfig = { ...request.generationConfig };
    applyAgyNativeGenerationConfig(wire, generationConfig);
    const body = JSON.stringify({ project, model: wire, request: { ...request, generationConfig } });
    if (body.length > MAX_REQUEST_BYTES) {
      throw new Error(`requête de ${(body.length / 1e6).toFixed(1)} Mo, limite ${MAX_REQUEST_BYTES / 1e6} Mo : réduisez le fichier`);
    }
    const path = stream ? 'v1internal:streamGenerateContent?alt=sse' : 'v1internal:generateContent';
    let failure;
    for (const endpoint of ANTIGRAVITY_ENDPOINT_FALLBACKS) {
      const res = await fetchWithAgyCliTransport(`${endpoint}/${path}`,
        { method: 'POST', headers: { Authorization: `Bearer ${access}` }, body },
        { signal, timeoutMs: 600_000, idleTimeoutMs: 600_000 });
      if (res.ok) return stream ? res : res.json();
      const text = await res.text();
      failure = Object.assign(new Error(`Antigravity ${res.status} : ${text.slice(0, 600)}`), { status: res.status });
      if (res.status !== 404 && res.status < 500) break; // erreur du client : l'autre point d'accès répondra pareil
    }
    throw failure;
  }

  /** Quota restant d'un compte : groupe Gemini et modèles Gemini, chacun { remainingFraction 0..1, resetTime ISO }. */
  async quota(email) {
    const { access, project } = await this.credentials(email);
    const { models } = await fetchAvailableModels({ accessToken: access, projectId: project, endpoints: ANTIGRAVITY_ENDPOINT_FALLBACKS });
    const summary = aggregateQuota(models);
    return {
      gemini: summary.groups.gemini ?? null,
      models: (summary.perModel ?? []).filter((m) => m.group === 'gemini')
        .map(({ modelId, displayName, remainingFraction, resetTime }) => ({ modelId, displayName: displayName ?? modelId, remainingFraction, resetTime })),
    };
  }

  /** Partie `inlineData` pour un fichier local (image, audio, vidéo, PDF). */
  static async filePart(path) {
    const type = mediaType(path);
    const { size } = await stat(path);
    if (size * 4 / 3 > MAX_REQUEST_BYTES) throw new Error(`${path} : ${(size / 1e6).toFixed(1)} Mo, trop lourd pour un envoi en ligne`);
    return { inlineData: { mimeType: type, data: (await readFile(path)).toString('base64') } };
  }
}
