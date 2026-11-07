// Exécute du code produit par un modèle dans un processus Node à permissions restreintes :
// lecture de son seul fichier, ni écriture, ni processus enfant, ni worker, avec une limite de temps.
import { spawn } from 'node:child_process';
import { mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HARNESS = `
const assert = require('node:assert/strict');
const eq = (a, b) => assert.deepStrictEqual(a, b);
const ok = (v) => assert.ok(v);
const throws = (f, re) => assert.throws(f, re);
const rejects = (p, re) => assert.rejects(p, re);
`;

// chemin réel : le bac à sable de Node refuse un chemin passant par un lien (/var -> /private/var sur macOS)
export const sandboxDir = async () => realpath(await mkdtemp(join(tmpdir(), 'agy-bench-')));

export async function runSandboxed(dir, code, tests, isAsync) {
  const file = join(dir, `t${Math.random().toString(36).slice(2)}.cjs`);
  await writeFile(file, `${HARNESS}\n${code}\n;(async () => {${tests}\n})().then(() => process.exit(0), (e) => { console.error(e?.message ?? e); process.exit(1); });`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--permission', `--allow-fs-read=${file}`, file], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), isAsync ? 15000 : 10000);
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ pass: status === 0, detail: status === null ? 'timed out' : err.trim().split('\n').find((l) => l.trim())?.slice(0, 200) });
    });
  });
}
