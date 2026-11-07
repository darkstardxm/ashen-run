// M4 play-test: audio engine runs (music + SFX, all biomes and intensities), mute persists,
// pause suspends audio, back-to-title works, no errors. Records the mix to a .webm for review.
// Usage: node tests/m4.mjs [url] [outDir]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const URL = process.argv[2] || 'http://localhost:4173';
const DIR = process.argv[3] || '/tmp';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const out = {}, errs = [];
const p = await b.newPage();
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.setViewport({ width: 1280, height: 720 });
await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__runner?.ready, { timeout: 60000 });
await p.evaluate(() => localStorage.removeItem('ashenrun.muted'));
await p.mouse.click(640, 600); await sleep(300); // gesture wakes audio on the title
out.ctxOnTitle = await p.evaluate(() => window.__runner.audio.ctx?.state);
// Tap the master bus into a recorder plus an analyser for levels.
await p.evaluate(() => {
  const A = window.__runner.audio, ctx = A.ctx;
  const dest = ctx.createMediaStreamDestination();
  A.out.connect(dest);
  const an = ctx.createAnalyser(); an.fftSize = 2048; A.out.connect(an);
  window.__peaks = [];
  const buf = new Float32Array(2048);
  window.__meter = setInterval(() => { an.getFloatTimeDomainData(buf); let pk = 0, ss = 0; for (const v of buf) { pk = Math.max(pk, Math.abs(v)); ss += v * v; } window.__peaks.push([pk, Math.sqrt(ss / buf.length)]); }, 100);
  window.__chunks = [];
  const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
  rec.ondataavailable = (e) => window.__chunks.push(e.data);
  rec.start(500); window.__rec = rec;
});
await sleep(3000);
await p.click('#play-btn'); await sleep(300);
out.modeRun = await p.evaluate(() => window.__runner.audio.mode);
await p.evaluate(() => { window.__runner.state.god = true; });
const keys = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];
const phase = async (label, ms) => {
  const end = Date.now() + ms; let i = 0;
  while (Date.now() < end) { await p.keyboard.press(keys[i++ % keys.length]); await sleep(700); }
  out[label] = await p.evaluate(() => ({ bpm: Math.round(window.__runner.audio.bpm), lvl: window.__runner.audio.intensity, biome: window.__runner.audio.biome }));
};
await phase('cathedral_slow', 6000);
// Push speed up through every ramp, then hop biomes.
await p.evaluate(() => { window.__runner.state.elapsed = 59.5; });
await phase('cathedral_fast', 5000);
await p.evaluate(() => { window.__runner.warp(990); });
await phase('forge', 6000);
await p.evaluate(() => { window.__runner.state.elapsed = 199; window.__runner.warp(1990); });
await phase('catacombs_max', 7000);
// pause suspends audio
await p.keyboard.press('Escape'); await sleep(400);
out.ctxPaused = await p.evaluate(() => window.__runner.audio.ctx.state);
await p.keyboard.press('Escape'); await sleep(400);
out.ctxResumed = await p.evaluate(() => window.__runner.audio.ctx.state);
// die
await p.evaluate(() => { window.__runner.state.god = false; });
await p.waitForFunction(() => window.__runner.state.mode === 'over', { timeout: 30000 });
await sleep(2500);
out.modeOver = await p.evaluate(() => window.__runner.audio.mode);
await p.click('#home-btn'); await sleep(400);
out.afterHome = await p.evaluate(() => ({ mode: window.__runner.state.mode, audio: window.__runner.audio.mode, titleVisible: !document.getElementById('title').classList.contains('hidden') }));
await p.screenshot({ path: `${DIR}/m4-title.png` });
// record
const b64 = await p.evaluate(async () => {
  clearInterval(window.__meter);
  await new Promise(r => { window.__rec.onstop = r; window.__rec.stop(); });
  const blob = new Blob(window.__chunks, { type: 'audio/webm' });
  const ab = await blob.arrayBuffer(); let s = ''; const u = new Uint8Array(ab);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
});
fs.writeFileSync(`${DIR}/m4-mix.webm`, Buffer.from(b64, 'base64'));
const peaks = await p.evaluate(() => window.__peaks);
out.maxPeak = Math.max(...peaks.map(x => x[0])).toFixed(3);
out.meanRms = (peaks.reduce((a, x) => a + x[1], 0) / peaks.length).toFixed(3);
out.silentFrames = peaks.filter(x => x[0] < 0.001).length + '/' + peaks.length;
// mute persists
await p.click('#mute-btn'); await sleep(200);
await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => window.__runner?.ready, { timeout: 60000 });
out.mutedAfterReload = await p.evaluate(() => window.__runner.audio.muted && document.getElementById('mute-btn').classList.contains('muted'));
await p.click('#mute-btn');
out.unmuted = await p.evaluate(() => !window.__runner.audio.muted);
out.errors = errs;
console.log(JSON.stringify(out, null, 1));
await b.close();
