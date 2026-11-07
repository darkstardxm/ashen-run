// Ashen Run audio: heavy industrial metal, synthesized live with the Web Audio API.
// Nothing is sampled, so every sound here is original to the project.
// Music is a 16th-note step sequencer (drums, distorted guitar, bass, anvil hits)
// whose tempo and layers rise with run speed; each biome has its own riff and key.

const RIFFS = {
  // Tokens per 16th step: m = palm-muted root, number = open power chord (semitones over root), . = hold/rest.
  ashen_cathedral: { root: 73.42, riff: '0 m m 1 m m 0 m 3 . m m 1 . 0 . 0 m m 1 m m 0 m 5 . 6 . 3 . 1 .' },
  ember_forge:     { root: 65.41, riff: '0 m 0 m m 0 m m 0 m 0 m 12 . 10 . 0 m 0 m m 0 m m 0 m 0 m 3 . 2 .' },
  bone_catacombs:  { root: 61.74, riff: '0 . m m 1 . m m 0 . m m 6 . 5 . 0 . m m 1 . m m 3 . 2 . 1 . m m' },
};
const DRUMS = [
  // kick, snare, hat strings per intensity level (32 steps, x = hit)
  { k: 'x.......x.......x.......x.....x.', s: '....x.......x.......x.......x...', h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' },
  { k: 'x..x..x.x.......x..x..x.x...x.x.', s: '....x.......x.......x.......x...', h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' },
  { k: 'x..x..x.x.x.....x..x..x.x.x.xxxx', s: '....x.......x.......x.......x.x.', h: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { k: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', s: '....x.......x.......x.......x.xx', h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' },
];
const parse = (s) => s.split(' ');

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('ashenrun.muted') === '1';
    this.mode = 'off';       // off | title | run | over
    this.biome = 'ashen_cathedral';
    this.pendingBiome = null;
    this.intensity = 0;
    this.bpm = 132;
    this.step = 0;
    this.nextTime = 0;
  }

  // Must be called from a user gesture (browsers block audio until then).
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.6;
    // Soft limiter after the compressor so nothing clips at the output.
    const limit = ctx.createWaveShaper(); limit.curve = this.curve(1.6);
    this.out = this.gain(0.9);
    this.master.connect(comp).connect(limit).connect(this.out).connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = 0.5; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(2.4, 2.6);
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.5;
    this.verbSend.connect(this.verb).connect(this.master);
    this.noise = this.noiseBuffer(2);
    this.buildGuitarAmp();
    this.buildDrone();
    this.timer = setInterval(() => this.schedule(), 25);
    this.setMode(this.mode === 'off' ? 'title' : this.mode);
  }

  // ---------- helpers ----------
  noiseBuffer(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  impulse(sec, decay) {
    const ctx = this.ctx, len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }
  curve(k) {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }
  env(g, t, a, peak, d, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + d);
  }
  noiseSrc(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise; s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    return s;
  }
  osc(type, f, t, dur) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  filt(type, f, q = 1) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  gain(v = 1) { const g = this.ctx.createGain(); g.gain.value = v; return g; }

  // ---------- instruments ----------
  buildGuitarAmp() {
    const c = this.ctx;
    this.gtrIn = this.gain(1);
    const pre = this.filt('highpass', 90);
    const drive = c.createWaveShaper(); drive.curve = this.curve(28); drive.oversample = '2x';
    const mid = this.filt('peaking', 750, 0.9); mid.gain.value = -6;   // scooped mids
    const pres = this.filt('peaking', 2400, 1.2); pres.gain.value = 4;
    const cab = this.filt('lowpass', 4200, 0.7);
    const cab2 = this.filt('lowpass', 5200, 0.7);
    this.gtrOut = this.gain(0.32);
    this.gtrIn.connect(pre).connect(drive).connect(mid).connect(pres).connect(cab).connect(cab2).connect(this.gtrOut).connect(this.music);
  }
  buildDrone() {
    const c = this.ctx;
    this.drone = this.gain(0);
    const lp = this.filt('lowpass', 260, 4);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lfoAmt = this.gain(140); lfo.connect(lfoAmt).connect(lp.frequency); lfo.start();
    this.droneOsc = [];
    for (const [type, mul, det] of [['sawtooth', 0.5, -8], ['sawtooth', 0.5, 7], ['triangle', 0.75, 0], ['sine', 0.25, 0]]) {
      const o = c.createOscillator(); o.type = type; o.detune.value = det;
      o.frequency.value = RIFFS[this.biome].root * mul; o.start();
      o.mul = mul; o.connect(lp); this.droneOsc.push(o);
    }
    lp.connect(this.drone).connect(this.music);
    lp.connect(this.verbSend);
  }
  setDroneRoot(root, t) { for (const o of this.droneOsc) o.frequency.setTargetAtTime(root * o.mul, t, 0.8); }

  kick(t, v = 1) {
    const o = this.osc('sine', 160, t, 0.4), g = this.gain();
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.002, 1.1 * v, 0.32);
    o.connect(g).connect(this.music);
    const n = this.noiseSrc(t, 0.02), ng = this.gain(), hp = this.filt('highpass', 3000);
    this.env(ng, t, 0.001, 0.25 * v, 0.02);
    n.connect(hp).connect(ng).connect(this.music);
  }
  snare(t, v = 1) {
    const n = this.noiseSrc(t, 0.25), bp = this.filt('bandpass', 2200, 0.6), g = this.gain();
    this.env(g, t, 0.001, 0.6 * v, 0.2);
    n.connect(bp).connect(g); g.connect(this.music); g.connect(this.verbSend);
    const o = this.osc('triangle', 210, t, 0.12), og = this.gain();
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    this.env(og, t, 0.001, 0.45 * v, 0.1);
    o.connect(og).connect(this.music);
  }
  hat(t, v = 1) {
    const n = this.noiseSrc(t, 0.05), hp = this.filt('highpass', 8000), g = this.gain();
    this.env(g, t, 0.001, 0.13 * v, 0.035);
    n.connect(hp).connect(g).connect(this.music);
  }
  crash(t, v = 1, dest = this.music) {
    const n = this.noiseSrc(t, 1.6), hp = this.filt('highpass', 4500), g = this.gain();
    this.env(g, t, 0.003, 0.35 * v, 1.4);
    n.connect(hp).connect(g); g.connect(dest); g.connect(this.verbSend);
  }
  // Inharmonic metal hit (anvil / pipe), the "industrial" layer.
  anvil(t, base = 420, v = 1, dest = this.music, decay = 0.5) {
    const g = this.gain(); this.env(g, t, 0.001, 0.22 * v, decay);
    g.connect(dest); g.connect(this.verbSend);
    for (const r of [1, 2.41, 3.93, 5.47]) {
      const o = this.osc('sine', base * r, t, decay + 0.1), og = this.gain(1 / r);
      o.connect(og).connect(g);
    }
    const n = this.noiseSrc(t, 0.03), bp = this.filt('bandpass', base * 6, 2), ng = this.gain();
    this.env(ng, t, 0.001, 0.4 * v, 0.03); n.connect(bp).connect(ng).connect(g);
  }
  // One guitar note: two detuned saws per chord tone into the shared amp.
  guitar(t, root, semis, dur, muted, v = 1) {
    const f = root * Math.pow(2, semis / 12);
    const g = this.gain();
    const tone = this.filt('lowpass', muted ? 650 : 3200, muted ? 2 : 0.7);
    const d = muted ? 0.11 : dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.004);
    g.gain.setTargetAtTime(muted ? 0.0001 : 0.25 * v, t + 0.01, muted ? 0.04 : dur * 0.6);
    g.gain.setTargetAtTime(0.0001, t + d, 0.02);
    const tones = muted ? [1] : [1, 1.4983, 2];
    for (const m of tones) for (const det of [-9, 8]) {
      const o = this.osc('sawtooth', f * m, t, d + 0.1); o.detune.value = det;
      o.connect(tone);
    }
    tone.connect(g).connect(this.gtrIn);
    // bass doubles the root an octave down
    const b = this.osc('sawtooth', f / 2, t, d + 0.1), bl = this.filt('lowpass', 320, 1), bg = this.gain();
    bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(0.35 * v, t + 0.005);
    bg.gain.setTargetAtTime(0.0001, t + d, 0.03);
    b.connect(bl).connect(bg).connect(this.music);
  }

  // ---------- sequencer ----------
  setMode(mode) {
    this.mode = mode;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.drone.gain.cancelScheduledValues(t);
    this.drone.gain.setTargetAtTime(mode === 'title' ? 0.16 : mode === 'run' ? 0.06 : mode === 'over' ? 0.12 : 0, t, 0.4);
    if (mode === 'run') {
      this.step = 0; this.nextTime = t + 0.08;
      this.music.gain.cancelScheduledValues(t); this.music.gain.setTargetAtTime(0.5, t, 0.05);
    }
  }
  setBiome(key) { if (key !== this.biome) this.pendingBiome = key; }
  setSpeed(speed, base, max) {
    const k = (speed - base) / Math.max(1, max - base);
    this.bpm = 132 + k * 36;
    this.intensity = Math.min(3, Math.floor(k * 4 + 0.001));
  }
  schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.mode === 'title' || this.mode === 'over') {
      // Sparse distant anvil and a low gong over the drone.
      if (!this.ambT || this.ambT < ctx.currentTime) this.ambT = ctx.currentTime + 0.1;
      while (this.ambT < ctx.currentTime + 0.15) {
        const t = this.ambT;
        if (this.mode === 'title') this.anvil(t, 180 + Math.random() * 60, 0.35, this.music, 1.6);
        this.ambT += 3.2 + Math.random() * 2.5;
      }
      return;
    }
    if (this.mode !== 'run') return;
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05; // after a stall
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += 60 / this.bpm / 4;
      this.step = (this.step + 1) % 32;
    }
  }
  playStep(s, t) {
    if (s === 0 && this.pendingBiome) {
      this.biome = this.pendingBiome; this.pendingBiome = null;
      this.setDroneRoot(RIFFS[this.biome].root, t);
      this.crash(t, 1);
    }
    const r = RIFFS[this.biome], toks = (r.toks ||= parse(r.riff)), stepDur = 60 / this.bpm / 4;
    const dr = DRUMS[this.intensity];
    if (dr.k[s] === 'x') this.kick(t, s % 4 === 0 ? 1 : 0.8);
    if (dr.s[s] === 'x') this.snare(t, s % 8 === 4 ? 1 : 0.7);
    if (dr.h[s] === 'x') this.hat(t, s % 4 === 0 ? 1 : 0.6);
    if (this.intensity >= 1 && (s === 14 || s === 30)) this.anvil(t, this.biome === 'ember_forge' ? 520 : 380, 0.7);
    if (this.intensity >= 2 && s === 0) this.crash(t, 0.6);
    const tok = toks[s];
    if (tok === 'm') this.guitar(t, r.root, 0, stepDur, true);
    else if (tok !== '.') {
      let n = 1; while (toks[(s + n) % 32] === '.' && n < 8) n++;
      this.guitar(t, r.root, +tok, stepDur * n, false);
      if (this.intensity >= 3 && s % 16 === 0) this.guitar(t, r.root * 2, +tok + 12, stepDur * n, false, 0.5);
    }
  }

  // ---------- sound effects ----------
  now() { return this.ctx ? this.ctx.currentTime + 0.005 : 0; }
  play(name, arg) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const fn = this['sfx_' + name];
    if (fn) fn.call(this, this.now(), arg);
  }
  pan(x) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, x)); p.connect(this.sfx); return p; }
  whoosh(t, f0, f1, dur, v, dest = this.sfx) {
    const n = this.noiseSrc(t, dur), bp = this.filt('bandpass', f0, 1.4), g = this.gain();
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g).connect(dest);
  }
  thud(t, f, v, dur = 0.18, dest = this.sfx) {
    const o = this.osc('sine', f, t, dur), g = this.gain();
    o.frequency.exponentialRampToValueAtTime(f * 0.35, t + dur);
    this.env(g, t, 0.002, v, dur); o.connect(g).connect(dest);
  }
  sfx_jump(t) { this.whoosh(t, 350, 1800, 0.22, 0.45); this.thud(t, 110, 0.35, 0.08); }
  sfx_land(t) { this.thud(t, 120, 0.8, 0.16); this.whoosh(t, 500, 200, 0.12, 0.25); }
  sfx_slide(t) {
    const n = this.noiseSrc(t, 0.5), bp = this.filt('bandpass', 1100, 0.8), g = this.gain();
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.45);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
    n.connect(bp).connect(g).connect(this.sfx);
  }
  sfx_lane(t, dir) { this.whoosh(t, 900, 2600, 0.14, 0.22, this.pan(dir * 0.6)); }
  sfx_clear(t) { this.anvil(t, 1400, 0.18, this.sfx, 0.12); }
  sfx_near(t) { this.whoosh(t, 2400, 600, 0.2, 0.35); this.anvil(t + 0.02, 980, 0.45, this.sfx, 0.3); }
  sfx_tier(t, mult) {
    const base = { 2: 330, 3: 392, 5: 494 }[mult] || 330;
    this.anvil(t, base, 1, this.sfx, 1.2);
    this.anvil(t + 0.09, base * 1.5, 0.7, this.sfx, 1.0);
  }
  sfx_speedup(t) {
    this.crash(t, 1.1, this.sfx);
    this.whoosh(t, 200, 4000, 0.5, 0.35);
    const r = RIFFS[this.biome].root;
    this.guitar(t, r, 0, 0.45, false, 1.1); this.guitar(t + 0.45 * 0.5, r, 12, 0.3, false, 0.8);
  }
  sfx_hit(t) {
    this.anvil(t, 210, 1.6, this.sfx, 0.9);
    this.thud(t, 90, 1.2, 0.5);
    const n = this.noiseSrc(t, 0.35), ws = this.ctx.createWaveShaper(), g = this.gain();
    ws.curve = this.curve(40); this.env(g, t, 0.001, 0.5, 0.3);
    n.connect(ws).connect(this.filt('lowpass', 2500)).connect(g).connect(this.sfx);
    // music cuts out
    this.music.gain.setTargetAtTime(0.0001, t, 0.05);
  }
  sfx_gameover(t) {
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setTargetAtTime(0.5, t + 0.2, 0.3);
    this.thud(t, 70, 1.2, 1.4);
    // detuned chord that sags down a fifth
    const r = RIFFS[this.biome].root, g = this.gain(), ws = this.ctx.createWaveShaper(), lp = this.filt('lowpass', 1800);
    ws.curve = this.curve(18); this.env(g, t, 0.01, 0.22, 2.4);
    for (const m of [1, 1.189, 1.5]) for (const det of [-12, 10]) {
      const o = this.osc('sawtooth', r * m, t, 2.5); o.detune.value = det;
      o.frequency.exponentialRampToValueAtTime(r * m * 0.667, t + 2.2); o.connect(ws);
    }
    ws.connect(lp).connect(g); g.connect(this.sfx); g.connect(this.verbSend);
  }
  sfx_record(t) { for (const [i, f] of [[0, 392], [1, 494], [2, 587]]) this.anvil(t + i * 0.12, f, 0.9, this.sfx, 1.4); }
  sfx_biome(t) {
    const g = this.gain(); this.env(g, t, 0.01, 0.5, 3.5); g.connect(this.sfx); g.connect(this.verbSend);
    for (const [r, v] of [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.9, 0.12]]) {
      const o = this.osc('sine', 62 * r, t, 3.6), og = this.gain(v); o.connect(og).connect(g);
    }
  }
  sfx_vent(t, dist) {
    const v = Math.max(0.15, 1 - dist / 40);
    const n = this.noiseSrc(t, 0.9), lp = this.filt('lowpass', 300, 2), g = this.gain();
    lp.frequency.exponentialRampToValueAtTime(2200, t + 0.15); lp.frequency.exponentialRampToValueAtTime(600, t + 0.85);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7 * v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    n.connect(lp).connect(g).connect(this.sfx);
  }
  sfx_rumble(t) {
    const n = this.noiseSrc(t, 1.1), lp = this.filt('lowpass', 140, 3), g = this.gain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    n.connect(lp).connect(g).connect(this.sfx);
  }
  sfx_crash(t) { this.thud(t, 80, 1, 0.4); this.whoosh(t, 1200, 300, 0.4, 0.5); this.anvil(t, 160, 0.5, this.sfx, 0.4); }
  sfx_censer(t, x) { this.anvil(t, 700 + Math.random() * 80, 0.25, this.pan(x * 0.3), 0.6); }
  sfx_click(t) { this.anvil(t, 880, 0.4, this.sfx, 0.25); }

  // ---------- controls ----------
  setPaused(on) {
    this.paused = on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend(); else this.ctx.resume();
  }
  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('ashenrun.muted', this.muted ? '1' : '0');
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.ctx.currentTime, 0.05);
    return this.muted;
  }
}
