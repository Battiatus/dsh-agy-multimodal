#!/usr/bin/env node
// Vérifie les tests des tâches difficiles avec les solutions de référence, dans le même bac à sable que le banc.
import { runSandboxed, sandboxDir } from './sandbox.js';
import { REFERENCE } from './reference.js';
import { HARD } from './tasks.js';

const dir = await sandboxDir();
let failed = 0;
for (const task of HARD) {
  const { pass, detail } = await runSandboxed(dir, REFERENCE[task.id], task.tests, task.async);
  console.log(`${pass ? '✓' : '✗'} ${task.id}${pass ? '' : `: ${detail}`}`);
  if (!pass) failed++;
}
process.exit(failed ? 1 : 0);
