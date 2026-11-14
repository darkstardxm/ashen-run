import puppeteer, { KnownDevices } from 'puppeteer-core';
const URL = process.argv[2] || 'http://localhost:4173';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = {}, errs = [];
const p = await b.newPage();
p.on('pageerror', e => errs.push(e.message));
await p.setViewport({ width: 1280, height: 720 });
await p.goto(URL, { waitUntil: "load" }); await p.waitForFunction(() => window.__runner?.ready, { timeout: 60000 }); await sleep(600);
await p.evaluate(() => localStorage.removeItem('ashenrun.best'));
await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => window.__runner?.ready, { timeout: 60000 }); await sleep(500);
out.titleBestFresh = await p.$eval('#title-best', e => e.textContent);
await p.click('#play-btn'); await sleep(200);
// In-page autopilot: dodge using obstacle data, to exercise combos.
await p.evaluate(() => {
  const R = window.__runner;
  const send = (a) => R.input.queue.push(a);
  window.__bot = setInterval(() => {
    const s = R.state; if (s.mode !== 'running') return;
    const ahead = R.obstacles.items.filter(o => o.mesh.position.z < 0 && o.mesh.position.z > -9);
    const mine = ahead.filter(o => o.lane === s.lane).sort((a, b) => b.mesh.position.z - a.mesh.position.z)[0];
    if (!mine) return;
    const z = mine.mesh.position.z;
    if ((mine.type === 'wall' || mine.kind === 'vent')) {
      for (const l of [s.lane - 1, s.lane + 1].filter(l => l >= -1 && l <= 1).sort(() => Math.random() - .5)) {
        if (!ahead.some(o => o.lane === l && o.mesh.position.z > -12)) { send(l < s.lane ? 'left' : 'right'); return; }
      }
      for (const l of [-1, 0, 1]) if (l !== s.lane && !ahead.some(o => o.lane === l && o.type === 'wall')) { send(l < s.lane ? 'left' : 'right'); return; }
    } else if ((mine.type === 'low' || mine.type === 'gap' || mine.kind === 'ceiling') && z > -0.18 * s.speed - 1.2 && s.grounded) send('jump');
    else if ((mine.type === 'high' || mine.kind === 'censer') && z > -0.15 * s.speed - 1 && s.slideT <= 0) send('slide');
  }, 30);
});
let maxCombo = 0, maxMult = 1;
const t0 = Date.now();
while (Date.now() - t0 < 45000) {
  const s = await p.evaluate(() => ({ mode: window.__runner.state.mode, c: window.__runner.score.combo, m: window.__runner.score.mult }));
  maxCombo = Math.max(maxCombo, s.c); maxMult = Math.max(maxMult, s.m);
  if (s.mode !== 'running') break;
  await sleep(200);
}
out.maxCombo = maxCombo; out.maxMult = maxMult;
out.hudMultText = await p.$eval('#mult', e => e.textContent);
// Pause test (if still running)
if ((await p.evaluate(() => window.__runner.state.mode)) === 'running') {
  await p.keyboard.press('Escape'); await sleep(100);
  const d1 = await p.evaluate(() => window.__runner.state.distance); await sleep(700);
  const d2 = await p.evaluate(() => window.__runner.state.distance);
  out.pauseMode = await p.evaluate(() => window.__runner.state.mode);
  out.pauseFrozen = Math.abs(d2 - d1) < 0.01;
  out.pauseScreen = await p.$eval('#pause', e => !e.classList.contains('hidden'));
  await p.screenshot({ path: '/workspace/runner-docs/m2-pause.png' });
  await p.keyboard.press('Escape'); await sleep(200);
  out.resumedMode = await p.evaluate(() => window.__runner.state.mode);
}
await p.evaluate(() => clearInterval(window.__bot));
await p.screenshot({ path: '/workspace/runner-docs/m2-hud.png' });
const t1 = Date.now();
while ((await p.evaluate(() => window.__runner.state.mode)) !== 'over' && Date.now() - t1 < 40000) await sleep(250);
out.finalScore = await p.$eval('#final-score', e => +e.textContent);
out.newRecordShown = await p.$eval('#new-record', e => !e.classList.contains('hidden'));
out.storedBest = await p.evaluate(() => localStorage.getItem('ashenrun.best'));
await p.screenshot({ path: '/workspace/runner-docs/m2-over.png' });
await p.reload({ waitUntil: "load" }); await p.waitForFunction(() => window.__runner?.ready, { timeout: 60000 }); await sleep(500);
out.titleBestAfterReload = await p.$eval('#title-best', e => e.textContent);
await p.click('#play-btn'); await sleep(300);
out.hudBestAfterReload = await p.$eval('#best', e => e.textContent);
out.restartScoreReset = await p.evaluate(() => window.__runner.score.value < 50);
// mobile pause button
const m = await b.newPage(); m.on('pageerror', e => errs.push(e.message));
await m.emulate(KnownDevices['iPhone 13']);
await m.goto(URL, { waitUntil: "load" }); await m.waitForFunction(() => window.__runner?.ready, { timeout: 60000 }); await sleep(400);
out.mobileTitleBest = await m.$eval('#title-best', e => e.textContent);
await m.tap('#play-btn'); await sleep(400);
await m.tap('#pause-btn'); await sleep(150);
out.mobilePauseMode = await m.evaluate(() => window.__runner.state.mode);
await m.tap('#resume-btn'); await sleep(150);
out.mobileResumeMode = await m.evaluate(() => window.__runner.state.mode);
await m.screenshot({ path: '/workspace/runner-docs/m2-mobile.png' });
out.errors = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
