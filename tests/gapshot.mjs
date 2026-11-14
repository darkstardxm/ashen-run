import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const pg = await b.newPage(); await pg.setViewport({ width: 960, height: 540 });
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type()==='error' && errs.push(m.text()));
await pg.goto('http://localhost:4173', { waitUntil: 'load' });
await pg.waitForFunction(() => window.__runner?.ready && window.__runner.allLoaded, { timeout: 60000 });
await pg.keyboard.press('Space'); await new Promise(r => setTimeout(r, 500));
const L = await pg.evaluate(() => (window.__BL = 0));
for (const [i, d] of [[0, 300], [1, 1400], [2, 2600]]) {
  await pg.evaluate((d) => { const R = window.__runner; R.state.god = true; R.warp(d); }, d);
  await new Promise(r => setTimeout(r, 300));
  const n = await pg.evaluate((i) => { const R = window.__runner, O = R.obstacles; R.state.paused = true;
    for (const o of O.items) O.group.remove(o.mesh); O.items = [];
    for (const lane of [-1, 1]) { const it = O.make('gap', i); it.mesh.position.set(lane * O.laneWidth, 0, -9); Object.assign(it, { type: 'gap', row: { id: 0 }, lane, biome: i }); O.group.add(it.mesh); O.items.push(it); }
    return !!O.tpl[i].gap; }, i);
  await new Promise(r => setTimeout(r, 400));
  await pg.screenshot({ path: `/workspace/runner-docs/gap_${i}.jpg`, type: 'jpeg', quality: 70 }); const shot = n;
  console.log(i, shot);
}
console.log('errors', errs);
await b.close();
