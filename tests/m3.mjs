// M3 play-test: assets load, biome cycling + transitions, signature hazards, FPS, mobile.
// Usage: node tests/m3.mjs [url] [shotDir]
import puppeteer, { KnownDevices } from 'puppeteer-core';
const URL = process.argv[2] || 'http://localhost:4173';
const DIR = process.argv[3] || '/tmp';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = {}, errs = [];
const bot = () => {
  const R = window.__runner;
  const send = (a) => R.input.queue.push(a);
  const act = (o) => o.type === 'sig' ? ({ censer: 'slide', vent: 'wall', ceiling: 'jump' })[o.kind] : ({ low: 'jump', gap: 'jump', high: 'slide', wall: 'wall' })[o.type];
  window.__bot = setInterval(() => {
    const s = R.state; if (s.mode !== 'running') return;
    const ahead = R.obstacles.items.filter(o => o.mesh.position.z < 0.5 && o.mesh.position.z > -11);
    const mine = ahead.filter(o => o.lane === s.lane).sort((a, b) => b.mesh.position.z - a.mesh.position.z)[0];
    if (!mine) return;
    const z = mine.mesh.position.z, a = act(mine);
    if (a === 'wall') {
      for (const l of [-1, 0, 1].filter(l => l !== s.lane).sort((x, y) => Math.abs(x - s.lane) - Math.abs(y - s.lane))) {
        if (!ahead.some(o => o.lane === l && act(o) === 'wall' && o.mesh.position.z > -14)) { send(l < s.lane ? 'left' : 'right'); return; }
      }
    } else if (a === 'jump' && z > -0.18 * s.speed - 1.2 && s.grounded) send('jump');
    else if (a === 'slide' && z > -0.15 * s.speed - 1 && s.slideT <= 0) send('slide');
  }, 30);
};

const p = await b.newPage();
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('requestfailed', r => errs.push('REQFAIL ' + r.url()));
await p.setViewport({ width: 1280, height: 720 });
const t0 = Date.now();
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__runner?.ready, { timeout: 60000 });
out.loadMs = Date.now() - t0;
await sleep(800);
await p.screenshot({ path: `${DIR}/m3-title.png` });
await p.click('#play-btn'); await sleep(300);
await p.evaluate(bot);
await sleep(4000);
await p.screenshot({ path: `${DIR}/m3-cathedral.png` });
out.fpsCathedral = await p.$eval('#fps', e => e.textContent);
// Jump ahead to each biome boundary (god mode so the camera stays on the run).
const kinds = new Set();
for (const [i, name] of [[1, 'forge'], [2, 'catacombs'], [3, 'cathedral2']]) {
  await p.evaluate((d) => { window.__runner.state.god = true; window.__runner.warp(d); }, i * 1000 - 30);
  await sleep(1400);
  await p.screenshot({ path: `${DIR}/m3-transition-${name}.png` });
  await sleep(3500);
  out[`biome_${name}`] = await p.evaluate(() => window.__runner.state.biome);
  out[`fps_${name}`] = await p.$eval('#fps', e => e.textContent);
  for (const k of await p.evaluate(() => window.__runner.obstacles.items.filter(o => o.kind).map(o => `${o.kind}:${o.phase}`))) kinds.add(k);
  await p.screenshot({ path: `${DIR}/m3-${name}.png` });
}
out.sigSeen = [...kinds];
// Real run with the bot to death.
await p.evaluate(() => { const s = window.__runner.state; s.god = false; });
const t1 = Date.now();
await p.evaluate(() => window.__runner.warp(0));
while ((await p.evaluate(() => window.__runner.state.mode)) !== 'over' && Date.now() - t1 < 60000) await sleep(300);
out.botSurvivedS = Math.round((Date.now() - t1) / 1000);
out.botMult = await p.evaluate(() => window.__runner.score.mult);
if ((await p.evaluate(() => window.__runner.state.mode)) !== 'over') {
  await p.evaluate(() => clearInterval(window.__bot));
  await p.waitForFunction(() => window.__runner.state.mode === 'over', { timeout: 30000 });
}
await sleep(600);
await p.screenshot({ path: `${DIR}/m3-over.png` });
out.overVisible = await p.$eval('#over', e => !e.classList.contains('hidden'));
await p.click('#restart-btn'); await sleep(500);
out.restartMode = await p.evaluate(() => window.__runner.state.mode);
out.restartBiome = await p.evaluate(() => window.__runner.state.biome);

// Mobile.
const m = await b.newPage();
m.on('pageerror', e => errs.push('M ' + e.message));
await m.emulate(KnownDevices['iPhone 13']);
await m.goto(URL, { waitUntil: 'load' });
await m.waitForFunction(() => window.__runner?.ready, { timeout: 60000 });
await m.tap('#play-btn'); await sleep(500);
const cdp = await m.createCDPSession();
const swipe = async (x0, y0, x1, y1) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let k = 1; k <= 4; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / 4, y: y0 + (y1 - y0) * k / 4 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
await m.evaluate(() => { window.__runner.state.god = true; });
await swipe(200, 500, 80, 500); await sleep(400);
out.mobileLaneAfterLeft = await m.evaluate(() => window.__runner.state.lane);
await swipe(190, 400, 190, 550); await sleep(60);
out.mobileSliding = await m.evaluate(() => window.__runner.state.slideT > 0);
await sleep(3000);
out.mobileFps = await m.$eval('#fps', e => e.textContent);
await m.screenshot({ path: `${DIR}/m3-mobile.png` });
out.errors = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
