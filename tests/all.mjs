// Runs every play-test in sequence and prints a pass/fail table.
// Usage: node tests/all.mjs [url] [outDir]
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const url = process.argv[2] || 'http://localhost:4173';
const out = process.argv[3] || 'test-out';
mkdirSync(out, { recursive: true });
const tests = ['m1', 'm2', 'm3', 'm4', 'home', 'pwa'];
const dir = new URL('.', import.meta.url).pathname;
const run = (t) => new Promise((res) => {
  const t0 = Date.now(); let log = '';
  const p = spawn(process.execPath, [dir + t + '.mjs', url, out]);
  p.stdout.on('data', (d) => (log += d)); p.stderr.on('data', (d) => (log += d));
  const kill = setTimeout(() => p.kill(), 8 * 60e3);
  p.on('close', (code) => {
    clearTimeout(kill);
    const errs = /"(errors|errs)":\s*\[\s*\]/.test(log) || !/"(errors|errs)":/.test(log);
    res({ t, ok: code === 0 && errs, s: Math.round((Date.now() - t0) / 1000), log });
  });
});
let fail = 0;
for (const t of tests) {
  const r = await run(t);
  if (!r.ok) { fail++; console.log(r.log.slice(-2000)); }
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${t.padEnd(6)} ${r.s}s`);
}
process.exit(fail ? 1 : 0);
