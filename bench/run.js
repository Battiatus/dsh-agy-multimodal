#!/usr/bin/env node
// Banc d'essai : chaque configuration résout les tâches de tasks.js avec le compte Antigravity actif.
// Usage : node bench/run.js [--only 'libellé 1|libellé 2'] [--repeat N]
// Le code produit tourne dans un processus Node à permissions restreintes (lecture de son seul fichier,
// ni écriture, ni processus enfant, ni worker), avec une limite de temps.
import { mkdir, writeFile } from 'node:fs/promises';
import { Agy } from '../lib/agy.js';
import { runSandboxed, sandboxDir } from './sandbox.js';
import { CODE, HARD, REASONING } from './tasks.js';

// Résultat mesuré (bench/README.md) : un prompt « ingénieur » ou un budget de réflexion illimité rendent Flash
// plus lent sans réussir davantage ; on compare donc les niveaux tels que le plugin les envoie.
export const CONFIGS = [
  { label: 'gemini-3.8-flash low', model: 'gemini-3.8-flash-low' },
  { label: 'gemini-3.8-flash medium', model: 'gemini-3.8-flash-medium' },
  { label: 'gemini-3.8-flash high', model: 'gemini-3.8-flash-high' },
  { label: 'gemini-4-argon high', model: 'gemini-4-argon-high' },
  { label: 'claude-sonnet-5.5 high', model: 'claude-sonnet-5-5-high' },
  { label: 'claude-sonnet-4.6', model: 'claude-sonnet-4-6' },
  { label: 'gpt-oss-120b', model: 'gpt-oss-120b-medium' },
];


const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const only = flag('--only')?.split('|'); // libellés séparés par |, car ils contiennent des virgules
const repeat = Number(flag('--repeat') ?? 1);

const agy = new Agy();
const textOf = (reply) => (reply.response ?? reply).candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? '';

async function ask(config, prompt) {
  const request = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: {} };
  const start = Date.now();
  for (let attempt = 1; ; attempt++) {
    try {
      // limite par requête : une connexion qui ne répond plus ne bloque pas tout le banc
      const reply = await agy.call(config.model, request, { signal: AbortSignal.timeout(300_000) });
      const usage = (reply.response ?? reply).usageMetadata ?? {};
      return { text: textOf(reply), ms: Date.now() - start, thoughts: usage.thoughtsTokenCount ?? 0, output: usage.candidatesTokenCount ?? 0 };
    } catch (error) {
      // 429 / 503 : attendre et réessayer, pour mesurer le modèle et non la file d'attente
      if (attempt < 4 && (error.status === 429 || error.status >= 500)) { await new Promise((r) => setTimeout(r, 5000 * attempt)); continue; }
      return { error: error.message.slice(0, 200), ms: Date.now() - start, thoughts: 0, output: 0 };
    }
  }
}

const lastCodeBlock = (text) => [...text.matchAll(/```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)```/g)].at(-1)?.[1] ?? null;

async function pool(items, size, work) {
  const out = [];
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < items.length) { const i = next++; out[i] = await work(items[i]); } }));
  return out;
}

async function runConfig(config, dir) {
  const jobs = [];
  for (let r = 0; r < repeat; r++) {
    for (const task of CODE) jobs.push({ kind: 'code', task });
    for (const task of HARD) jobs.push({ kind: 'hard', task });
    for (const task of REASONING) jobs.push({ kind: 'reasoning', task });
  }
  return pool(jobs, 4, async ({ kind, task }) => {
    if (kind === 'code' || kind === 'hard') {
      const reply = await ask(config, `${task.prompt}\n\nReply with a single JavaScript code block defining \`${task.fn}\` (plain JavaScript for Node.js, no imports, no exports, no tests).`);
      const code = reply.text && lastCodeBlock(reply.text);
      const result = reply.error ? { pass: false, detail: reply.error } : code ? await runSandboxed(dir, code, task.tests, task.async) : { pass: false, detail: 'no code block' };
      return { kind, id: task.id, ...reply, text: undefined, ...result };
    }
    const reply = await ask(config, `${task.prompt}\nFinish with a last line exactly like: ANSWER: <answer>`);
    const answer = /ANSWER:\s*(.+)\s*$/im.exec(reply.text ?? '')?.[1]?.trim().replace(/[.\s]+$/, '');
    return { kind, id: task.id, ...reply, text: undefined, answer, pass: answer === task.answer, detail: reply.error ?? `got ${answer ?? 'nothing'}` };
  });
}

const dir = await sandboxDir();
const offered = new Set((await agy.models()).models.flatMap((m) => [m.wire, ...m.efforts.map((e) => e.wire)]));
const results = [];
for (const config of CONFIGS.filter((c) => !only || only.includes(c.label))) {
  if (!offered.has(config.model)) { console.log(`skip ${config.label}: ${config.model} is not offered to this account`); continue; }
  process.stdout.write(`${config.label}… `);
  const rows = await runConfig(config, dir);
  const sum = (kind) => rows.filter((r) => r.kind === kind);
  const passed = (kind) => sum(kind).filter((r) => r.pass).length;
  const avg = (key) => Math.round(rows.reduce((a, r) => a + r[key], 0) / rows.length);
  const line = { config: config.label, code: `${passed('code')}/${sum('code').length}`, hard: `${passed('hard')}/${sum('hard').length}`, reasoning: `${passed('reasoning')}/${sum('reasoning').length}`, 'avg s': (avg('ms') / 1000).toFixed(1), 'thinking tok': avg('thoughts'), 'output tok': avg('output') };
  results.push({ ...line, rows });
  console.log(`${line.code} code, ${line.hard} hard, ${line.reasoning} reasoning`);
  for (const r of rows.filter((x) => !x.pass)) console.log(`   ✗ ${r.id}: ${r.detail}`);
}
console.table(results.map(({ rows, ...line }) => line));
await mkdir(new URL('./results/', import.meta.url), { recursive: true });
const out = new URL(`./results/${new Date().toISOString().replace(/[:.]/g, '-')}.json`, import.meta.url);
await writeFile(out, JSON.stringify(results, null, 2));
console.log(`details: ${out.pathname}`);
