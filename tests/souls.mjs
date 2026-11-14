// v2 M2: souls spawn, get collected, bank on death, and persist across reloads.
import puppeteer from 'puppeteer-core';
const URL = process.argv[2] || 'http://localhost:4173';
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage(); await pg.setViewport({ width: 960, height: 540 });
const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
const ready = () => pg.waitForFunction(() => window.__runner?.ready, { timeout: 60000 });
await pg.goto(URL, { waitUntil: 'load' }); await ready();
await pg.evaluate(() => localStorage.setItem('ashenrun.souls', '0'));
await pg.reload({ waitUntil: 'load' }); await ready();
await pg.keyboard.press('Space');
await pg.evaluate(() => { window.__runner.state.god = true; });
// Bot: steer into the nearest soul's lane, jump for arcs, slide for low ones.
let spawned = 0;
for (let i = 0; i < 250; i++) {
  await new Promise((r) => setTimeout(r, 100));
  const s = await pg.evaluate(() => {
    const R = window.__runner, it = R.souls.items.filter((x) => x.mesh.position.z < 0 && x.mesh.position.z > -25).sort((a, b) => b.mesh.position.z - a.mesh.position.z)[0];
    return { n: R.souls.items.length, lane: R.state.lane, t: it && { x: Math.round(it.mesh.position.x / 2), y: it.y, z: it.mesh.position.z } };
  });
  spawned = Math.max(spawned, s.n);
  if (!s.t) continue;
  if (s.t.x < s.lane) await pg.keyboard.press('ArrowLeft'); else if (s.t.x > s.lane) await pg.keyboard.press('ArrowRight');
  else if (s.t.y > 1.5 && s.t.z > -6) await pg.keyboard.press('Space');
  else if (s.t.y < 0.8 && s.t.z > -6) await pg.keyboard.press('ArrowDown');
}
const run = await pg.evaluate(() => window.__runner.souls.run);
const hud = await pg.$eval('#souls', (e) => +e.textContent);
await pg.evaluate(() => { window.__runner.state.god = false; });
const died = await pg.waitForFunction(() => window.__runner.state.mode === 'over', { timeout: 90000 }).then(() => true, () => false);
const final = await pg.$eval('#final-souls', (e) => +e.textContent);
const runEnd = await pg.evaluate(() => window.__runner.souls.run);
await pg.reload({ waitUntil: 'load' }); await ready();
const saved = await pg.evaluate(() => +localStorage.getItem('ashenrun.souls'));
const title = await pg.$eval('#title-souls', (e) => +e.textContent);
const out = { spawnedMax: spawned, collected: run, hud, died, final, saved, title, errors: errs };
console.log(JSON.stringify(out, null, 1));
const ok = run > 0 && hud === run && died && final === runEnd && saved === runEnd && title === saved && !errs.length;
await b.close();
process.exit(ok ? 0 : 1);
