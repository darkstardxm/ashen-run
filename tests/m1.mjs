import puppeteer, { KnownDevices } from 'puppeteer-core';
const URL = process.argv[2] || 'http://localhost:4173';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = {};
const errs = [];
// Desktop
let p = await b.newPage();
p.on('pageerror', e => errs.push(e.message));
await p.setViewport({ width: 1280, height: 720 });
await p.goto(URL, { waitUntil: "load" }); await p.waitForFunction(() => window.__runner?.ready, { timeout: 60000 });
await sleep(800);
await p.screenshot({ path: '/workspace/runner-docs/m1-title.png' });
await p.click('#play-btn'); await sleep(300);
const S = () => p.evaluate(() => ({ ...window.__runner.state }));
out.startMode = (await S()).mode;
await p.keyboard.press('ArrowLeft'); await sleep(300); out.laneAfterLeft = (await S()).lane;
await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await sleep(300); out.laneAfterRight2 = (await S()).lane;
await p.keyboard.press('Space'); await sleep(150); out.yDuringJump = +(await S()).y.toFixed(2);
await sleep(900); out.groundedAfterJump = (await S()).grounded;
await p.keyboard.press('ArrowDown'); await sleep(100); out.slideT = +(await S()).slideT.toFixed(2);
await sleep(600);
await p.screenshot({ path: '/workspace/runner-docs/m1-run.png' });
// Wait for death with no input
const t0 = Date.now();
while ((await S()).mode !== 'over' && Date.now() - t0 < 30000) await sleep(250);
const st = await S();
out.diedWithin = ((Date.now() - t0) / 1000).toFixed(1) + 's'; out.modeAfter = st.mode; out.distance = Math.floor(st.distance);
out.overVisible = await p.$eval('#over', e => !e.classList.contains('hidden'));
await p.screenshot({ path: '/workspace/runner-docs/m1-over.png' });
await p.click('#restart-btn'); await sleep(300);
const r = await S(); out.restartMode = r.mode; out.restartDistanceReset = r.distance < 10;
await sleep(2000);
out.fpsDesktopSwiftshader = await p.$eval('#fps', e => e.textContent);
// Mobile touch
await p.close(); console.log('desktop', JSON.stringify(out));
const m = await b.newPage();
m.on('pageerror', e => errs.push(e.message));
await m.emulate(KnownDevices['iPhone 13']);
await m.goto(URL, { waitUntil: "load" }); await m.waitForFunction(() => window.__runner?.ready, { timeout: 60000 }); await sleep(500);
await m.tap('#play-btn'); await sleep(300);
const cdp = await m.createCDPSession();
async function swipe(x0, y0, x1, y1) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 5; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / 5, y: y0 + (y1 - y0) * i / 5 }] }); await sleep(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
const MS = () => m.evaluate(() => ({ ...window.__runner.state }));
out.mobileMode = (await MS()).mode;
await swipe(200, 400, 80, 400); await sleep(200); out.mobileLaneSwipeLeft = (await MS()).lane;
await swipe(100, 400, 300, 400); await sleep(200); out.mobileLaneSwipeRight = (await MS()).lane;
await swipe(200, 500, 200, 300); await sleep(120); out.mobileYSwipeUp = +(await MS()).y.toFixed(2);
await sleep(900);
await swipe(200, 300, 200, 500); await sleep(80); out.mobileSlideT = +(await MS()).slideT.toFixed(2);
await sleep(700);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 400 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(120); out.mobileYTap = +(await MS()).y.toFixed(2);
await m.screenshot({ path: '/workspace/runner-docs/m1-mobile.png' });
out.errors = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
