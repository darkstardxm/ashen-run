import { Audio } from './audio.js';
import * as THREE from 'three';
import { Input } from './input.js';
import { Obstacles } from './obstacles.js';
import { Score } from './score.js';
import { loadBiome, loadAssets } from './assets.js';
import { RunnerModel } from './runner.js';
import { BIOMES, BIOME_LENGTH, TRANSITION, biomeIndexAt } from './biomes.js';
import { SheetFX, cropFrame, radialTexture } from './fx.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// M3: art + biomes on top of the M1/M2 loop. Three lanes, jump/slide/lane input,
// procedural obstacles, combo scoring, three biomes cycling every 1000 m.
export const LANE_WIDTH = 2;
const SEGMENT_LENGTH = 12;
const SEGMENTS = 9;
const BASE_SPEED = 12;
const MAX_SPEED = 30;
const SPEED_STEP = 2;          // added every ramp
const RAMP_INTERVAL = 20;      // seconds
const GRAVITY = -38;
const JUMP_VELOCITY = 13;
const SLIDE_TIME = 0.65;
const LANE_LERP = 14;
const BUFFER_TIME = 0.15;
const LAND_TIME = 0.3;

const $ = (id) => document.getElementById(id);
const app = $('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(BIOMES[0].fog);
scene.fog = new THREE.FogExp2(BIOMES[0].fog, BIOMES[0].density);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 220);
const CAM_BASE = new THREE.Vector3(0, 3.8, 6.5);
camera.position.copy(CAM_BASE);
camera.lookAt(0, 1, -10);

const hemi = new THREE.HemisphereLight(0x3a4a66, 0x14161c, 0.55);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xa8bce0, 1.1);
scene.add(key, key.target);
const torch = new THREE.PointLight(0xff7a2a, 22, 16, 2);
torch.position.set(0, 3.6, -2.5);
scene.add(torch);
const fill = new THREE.PointLight(0xffc090, 6, 7, 2); // keeps the runner readable from behind
fill.position.set(0, 2.5, 2.5);
scene.add(fill);

const input = new Input(renderer.domElement);
const score = new Score();
const audio = new Audio();
audio.setMode('title');
// Browsers only allow audio after a gesture, so the first tap or key wakes it up.
const wake = () => audio.unlock();
window.addEventListener('pointerdown', wake);
window.addEventListener('keydown', wake);
window.addEventListener('touchend', wake); // older iOS only unlocks audio on touchend
const buzz = (ms) => { if (!audio.muted) navigator.vibrate?.(ms); };
function syncMuteBtn() {
  const b = $('mute-btn');
  b.classList.toggle('muted', audio.muted);
  b.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
}
$('mute-btn').addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.toggleMute(); syncMuteBtn(); });
window.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !e.repeat) { audio.toggleMute(); syncMuteBtn(); } });
syncMuteBtn();
$('title-best').textContent = score.best;

const state = {
  mode: 'loading',    // loading | title | running | paused | dying | over
  prevLane: 0, laneChangeT: 99,
  lane: 0, x: 0, y: 0, vy: 0,
  grounded: true, slideT: 0, sinceJump: 9,
  speed: BASE_SPEED, elapsed: 0, distance: 0,
  dyingT: 0, landT: 0, shake: 0,
  bufferedJump: 0, bufferedSlide: 0,
  biome: 0,
};

let world = null; // built after assets load
window.__runner = {
    audio, state, input, score, ready: false, renderer, pr: () => pixelRatio };

loadAssets((p) => { $('load-bar').style.width = `${Math.round(p * 100)}%`; })
  .then((assets) => {
    world = buildWorld(assets);
    window.__runner.obstacles = world.obstacles;
    // Test hook: jump to a distance and rebuild the track around it.
    window.__runner.warp = (d) => { state.distance = d; world.obstacles.reset(); layoutTrack(world); };
    window.__runner.ready = true;
    streamBiomes(assets);
    state.mode = 'title';
    $('loading').classList.add('hidden');
    $('play-btn').classList.remove('hidden');
  })
  .catch((e) => { console.error(e); $('loading').textContent = 'Failed to load. Refresh to try again.'; });

function buildWorld(assets) {
  const w = {};

  // Sky: two equirect domes so the next biome's sky can fade in over the last one.
  const skyGeo = new THREE.SphereGeometry(180, 48, 24);
  const mkSky = (order) => {
    const m = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, transparent: true, depthWrite: false, toneMapped: false }));
    m.renderOrder = order;
    m.rotation.y = Math.PI / 2;
    scene.add(m);
    return m;
  };
  w.skyA = mkSky(-2); w.skyB = mkSky(-1);
  w.skies = [assets.biomes[BIOMES[0].id].sky];

  // Track: each slot holds one segment + scenery per biome; only one is visible.
  w.track = new THREE.Group();
  scene.add(w.track);
  w.slots = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const slot = new THREE.Group();
    slot.userData.index = i;
    slot.userData.variants = [buildVariant(assets, 0, i)];
    slot.add(slot.userData.variants[0]);
    w.track.add(slot);
    w.slots.push(slot);
  }
  layoutTrack(w);

  // Runner + blob shadow.
  w.runner = new RunnerModel(assets.runner);
  scene.add(w.runner.root);
  w.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: radialTexture('#000000cc', '#00000000'), transparent: true, depthWrite: false }));
  w.shadow.position.y = 0.03;
  scene.add(w.shadow);

  // VFX.
  const v = assets.vfx;
  w.sparks = new SheetFX(scene, v.hit_sparks, { cols: 4, rows: 2, frames: 8, fps: 30, pool: 3 });
  w.dust = new SheetFX(scene, v.dust_landing_puff, { cols: 4, rows: 2, frames: 8, fps: 24, additive: false, pool: 8 });
  w.burst = new SheetFX(scene, v.speedup_ember_burst, { cols: 4, rows: 4, frames: 16, fps: 24, pool: 2 });
  w.jetTex = v.fire_jet;
  w.jets = [];

  // Embers drift up around the track (texture from the embers sheet).
  const EMBERS = 260;
  const emberGeo = new THREE.BufferGeometry();
  const ep = new Float32Array(EMBERS * 3);
  for (let i = 0; i < EMBERS; i++) { ep[i * 3] = (Math.random() - 0.5) * 18; ep[i * 3 + 1] = Math.random() * 8; ep[i * 3 + 2] = -Math.random() * 70; }
  emberGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  w.emberGeo = emberGeo;
  w.embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({
    map: cropFrame(v.embers, 256, 256), color: BIOMES[0].ember, size: 0.22, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  scene.add(w.embers);

  const fxApi = {
    sound: (name, arg) => audio.play(name, arg),
    dust: (pos, size) => w.dust.spawn(new THREE.Vector3(pos.x, size * 0.35, pos.z), size, BIOMES[state.biome].dust, 0.8),
    fireJet: (mesh) => addJet(w, mesh),
  };
  w.obstacles = new Obstacles(scene, LANE_WIDTH, assets, fxApi);
  return w;
}

// Bake a static group into one mesh per material, cutting draw calls a lot.
// Attributes are normalised to plain float arrays first so mixed source files can merge.
// One slot's look for biome bi: track segment, flanking pillars, a side prop, and an arch every 4th slot.
function buildVariant(assets, bi, i) {
  const b = BIOMES[bi], a = assets.biomes[b.id];
  const g = new THREE.Group();
  g.add(a.track.clone());
  const prop = (name, x, z, rotY, s = 1) => {
    const src = a.scenery[name];
    if (!src) return;
    const o = src.clone();
    o.position.set(x, 0, z); o.rotation.y = rotY; o.scale.setScalar(s);
    g.add(o);
  };
  prop(b.pillar, -4.6, -1.5, Math.PI / 2); prop(b.pillar, 4.6, -1.5, -Math.PI / 2);
  const extras = b.scenery.filter((n) => n !== b.pillar);
  const pick = () => extras[Math.floor(Math.random() * extras.length)];
  if (i % 2 === 0) prop(pick(), -5.6, -7.5, Math.PI / 2);
  else prop(pick(), 5.6, -7.5, -Math.PI / 2);
  if (b.arch && i % 4 === 0) prop(b.arch, 0, -10.5, 0);
  const merged = mergeStatic(g);
  merged.visible = false;
  return merged;
}

// Stream in the remaining biomes one by one after the game is playable.
async function streamBiomes(assets) {
  for (let bi = 1; bi < BIOMES.length; bi++) {
    try {
      await loadBiome(assets, bi);
    } catch (e) { console.error('biome load failed', BIOMES[bi].id, e); continue; }
    world.skies[bi] = assets.biomes[BIOMES[bi].id].sky;
    for (const slot of world.slots) {
      const v = buildVariant(assets, bi, slot.userData.index);
      slot.userData.variants[bi] = v; slot.add(v);
      setSlotBiome(slot);
    }
    world.obstacles.addBiome(bi, assets);
    renderer.compile(scene, camera);
  }
  window.__runner.allLoaded = true;
}

function plainGeometry(src, matrix) {
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(src.attributes)) {
    const arr = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  if (src.index) g.setIndex(Array.from(src.index.array));
  else g.setIndex([...Array(src.attributes.position.count).keys()]);
  return g.applyMatrix4(matrix);
}
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh) return;
    const attrs = Object.entries(o.geometry.attributes).map(([n, a]) => `${n}${a.itemSize}`).sort().join(',');
    const k = `${o.material.name || o.material.uuid}|${attrs}`;
    if (!buckets.has(k)) buckets.set(k, { mat: o.material, geos: [] });
    buckets.get(k).geos.push(plainGeometry(o.geometry, o.matrixWorld));
  });
  const out = new THREE.Group();
  for (const { mat, geos } of buckets.values()) {
    const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!geo) { console.warn('merge failed', mat.name); continue; }
    out.add(new THREE.Mesh(geo, mat));
  }
  return out;
}

function addJet(w, mesh) {
  const node = mesh.getObjectByName('fx_fire_jet') || mesh;
  const map = w.jetTex.clone();
  map.repeat.set(1 / 8, 1 / 2);
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
  const geo = new THREE.PlaneGeometry(1.4, 3.2).translate(0, 1.6, 0);
  const g = new THREE.Group();
  for (const r of [0, Math.PI / 2]) { const q = new THREE.Mesh(geo, mat); q.rotation.y = r; g.add(q); }
  node.add(g);
  const jet = { map, t: 0, done: () => { node.remove(g); w.jets = w.jets.filter((j) => j !== jet); } };
  w.jets.push(jet);
  return jet;
}

// Segment slot origins sit at the segment start and run 12 m toward -Z.
function layoutTrack(w) {
  w.slots.forEach((slot, i) => { slot.position.z = SEGMENT_LENGTH * (1 - i); setSlotBiome(slot); });
}
function setSlotBiome(slot) {
  let bi = biomeIndexAt(state.distance - slot.position.z);
  if (!slot.userData.variants[bi]) bi = 0; // not streamed in yet
  slot.userData.variants.forEach((g, i) => { if (g) g.visible = i === bi; });
}

function resetRun() {
  audio.unlock();
  audio.setBiome(BIOMES[0].id);
  audio.setSpeed(BASE_SPEED, BASE_SPEED, MAX_SPEED);
  audio.setMode('run');
  Object.assign(state, {
    mode: 'running', lane: 0, x: 0, y: 0, vy: 0, grounded: true, slideT: 0, sinceJump: 9,
    speed: BASE_SPEED, elapsed: 0, distance: 0, dyingT: 0, landT: 0, shake: 0,
    bufferedJump: 0, bufferedSlide: 0, prevLane: 0, laneChangeT: 99, biome: 0,
  });
  world.obstacles.reset();
  for (const j of [...world.jets]) j.done();
  layoutTrack(world);
  score.reset();
  updateHud(true);
  $('pause').classList.add('hidden');
  $('pause-btn').classList.remove('hidden');
  world.runner.root.rotation.set(0, 0, 0);
  $('title').classList.add('hidden');
  $('over').classList.add('hidden');
  $('hud').classList.remove('hidden');
  showBiomeName(0);
}

function die(hit) {
  state.mode = 'dying';
  state.dyingT = 0;
  state.shake = 0.6;
  const z = hit ? Math.min(0.3, hit.mesh.position.z) : -0.4;
  world.sparks.spawn(new THREE.Vector3(state.x, state.y + 1.1, z), 1.6, 0xffc080);
  audio.play('hit');
  buzz([40, 30, 80]);
  audio.setMode('off');
}

function showGameOver() {
  state.mode = 'over';
  const record = score.finish();
  $('final-score').textContent = score.value;
  $('final-dist').textContent = Math.floor(state.distance);
  $('final-best').textContent = score.best;
  $('title-best').textContent = score.best;
  $('new-record').classList.toggle('hidden', !record);
  audio.setMode('over');
  audio.play('gameover');
  if (record) setTimeout(() => audio.play('record'), 700);
  $('over').classList.remove('hidden');
  $('pause-btn').classList.add('hidden');
}

function setPaused(on) {
  if (on && state.mode === 'running') { state.mode = 'paused'; $('pause').classList.remove('hidden'); audio.setPaused(true); }
  else if (!on && state.mode === 'paused') { state.mode = 'running'; $('pause').classList.add('hidden'); clock.getDelta(); audio.setPaused(false); }
}
$('pause-btn').addEventListener('click', () => setPaused(state.mode === 'running'));
$('resume-btn').addEventListener('click', () => setPaused(false));
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

// HUD
const hud = { score: $('score'), best: $('best'), combo: $('combo'), mult: $('mult'), pop: $('pop') };
let shownMult = 0;
function updateHud(force) {
  hud.score.textContent = score.value;
  hud.best.textContent = Math.max(score.best, score.value);
  hud.combo.textContent = score.combo > 0 ? `${score.combo} combo` : '';
  if (force || shownMult !== score.mult) {
    shownMult = score.mult;
    hud.mult.className = score.mult > 1 ? `m${score.mult}` : '';
    hud.mult.textContent = score.mult > 1 ? `x${score.mult}` : '';
    if (score.mult > 1) { void hud.mult.offsetWidth; hud.mult.classList.add('pulse'); }
  }
}
function popText(text, cls) {
  const el = document.createElement('div');
  el.className = `pop ${cls}`; el.textContent = text;
  hud.pop.appendChild(el);
  setTimeout(() => el.remove(), 900);
}
function showBiomeName(i) {
  const el = $('biome');
  el.textContent = BIOMES[i].name;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  audio.setBiome(BIOMES[i].id);
  if (i !== 0 || state.distance > 10) audio.play('biome');
}

function startOrRestart() {
  if (state.mode === 'title' || state.mode === 'over') resetRun();
}
$('play-btn').addEventListener('click', startOrRestart);
$('restart-btn').addEventListener('click', startOrRestart);
$('home-btn').addEventListener('click', () => {
  if (state.mode !== 'over') return;
  // Clear the run that just ended so nothing from it lingers behind the title screen.
  Object.assign(state, {
    mode: 'title', lane: 0, prevLane: 0, x: 0, y: 0, vy: 0, grounded: true, slideT: 0, sinceJump: 9, landT: 0,
    speed: BASE_SPEED, elapsed: 0, distance: 0, dyingT: 0, shake: 0, bufferedJump: 0, bufferedSlide: 0, biome: 0,
  });
  world.obstacles.reset();
  for (const j of [...world.jets]) j.done();
  layoutTrack(world);
  world.runner.root.position.set(0, 0, 0);
  world.runner.root.rotation.set(0, 0, 0);
  $('over').classList.add('hidden'); $('hud').classList.add('hidden');
  $('title').classList.remove('hidden');
  $('combo').textContent = ''; $('mult').className = '';
  audio.setMode('title');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const fpsEl = $('fps');
const speedEl = $('speed');
let frames = 0, fpsTime = 0;
// Adaptive resolution: drop the pixel ratio a notch while frame rate stays under 45.
let pixelRatio = Math.min(window.devicePixelRatio, 2), slowWindows = 0;
function adaptResolution(fps) {
  slowWindows = fps < 45 ? slowWindows + 1 : 0;
  if (slowWindows >= 4 && pixelRatio > 0.75) {
    pixelRatio = Math.max(0.75, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio);
    slowWindows = 0;
  }
}
const clock = new THREE.Clock();

function handleInput(dt) {
  state.bufferedJump = Math.max(0, state.bufferedJump - dt);
  state.bufferedSlide = Math.max(0, state.bufferedSlide - dt);
  for (const a of input.drain()) {
    if (state.mode === 'loading') continue;
    if (state.mode === 'paused') { if (a === 'pause' || a === 'confirm' || a === 'jump') setPaused(false); continue; }
    if (state.mode !== 'running') {
      if (a === 'jump' || a === 'confirm') startOrRestart();
      continue;
    }
    if (a === 'pause') { setPaused(true); continue; }
    if (a === 'left' || a === 'right') {
      const nl = Math.max(-1, Math.min(1, state.lane + (a === 'left' ? -1 : 1)));
      if (nl !== state.lane) { state.prevLane = state.lane; state.lane = nl; state.laneChangeT = 0; audio.play('lane', nl - state.prevLane); }
    }
    else if (a === 'jump') state.bufferedJump = BUFFER_TIME;
    else if (a === 'slide') state.bufferedSlide = BUFFER_TIME;
  }
  if (state.bufferedJump > 0 && state.grounded) {
    state.vy = JUMP_VELOCITY; state.grounded = false; state.slideT = 0; state.bufferedJump = 0; state.sinceJump = 0; state.landT = 0;
    audio.play('jump');
  }
  if (state.bufferedSlide > 0) {
    if (state.grounded) {
      if (state.slideT <= 0) { world.dust.spawn(new THREE.Vector3(state.x, 0.4, 0.2), 1.3, BIOMES[state.biome].dust, 0.7); audio.play('slide'); }
      state.slideT = SLIDE_TIME; state.bufferedSlide = 0; state.landT = 0;
    }
    else state.vy = Math.min(state.vy, -18); // fast-fall into slide
  }
}

function updateRunner(dt) {
  const targetX = state.lane * LANE_WIDTH;
  const prevX = state.x;
  state.x += (targetX - state.x) * Math.min(1, LANE_LERP * dt);
  const lean = (state.x - prevX) / Math.max(dt, 1e-4);
  state.sinceJump += dt;

  if (!state.grounded) {
    state.vy += GRAVITY * dt;
    state.y += state.vy * dt;
    if (state.y <= 0) {
      state.y = 0; state.vy = 0; state.grounded = true;
      if (state.bufferedSlide <= 0) state.landT = LAND_TIME;
      world.dust.spawn(new THREE.Vector3(state.x, 0.4, 0.2), 1.4, BIOMES[state.biome].dust, 0.7);
      audio.play('land');
    }
  }
  if (state.slideT > 0) state.slideT -= dt;
  if (state.landT > 0) state.landT -= dt;

  const r = world.runner.root;
  r.position.set(state.x, state.y, 0);
  r.rotation.z = THREE.MathUtils.lerp(r.rotation.z, -lean * 0.012, 0.3);
}

function runnerBox() {
  const sliding = state.slideT > 0;
  const h = sliding ? 0.85 : 1.8; // slide pose stays under 0.94 m; hanging hazards start at 1.1 m
  return { minX: state.x - 0.3, maxX: state.x + 0.3, minY: state.y, maxY: state.y + h, minZ: -0.3, maxZ: 0.3 };
}

// A row is cleared cleanly if an obstacle was in the runner's lane (jumped or slid past it).
// Dodging out of its lane also counts as a clear; doing it in the last 0.4s is a near miss.
function scorePassed() {
  for (const row of world.obstacles.passed()) {
    const inLane = row.some((o) => o.lane === state.lane);
    const leftLane = row.some((o) => o.lane === state.prevLane && o.lane !== state.lane);
    if (leftLane && state.laneChangeT < 0.4) score.bump('near');
    else if (inLane || (leftLane && state.laneChangeT < 1.5)) score.bump('clear');
  }
}

// Fog, sky, lights and ember colour blend into each new biome over TRANSITION metres.
const cA = new THREE.Color(), cB = new THREE.Color();
const lerpHex = (a, b, t, out) => out.set(a).lerp(cB.set(b), t);
function updateBiome(time) {
  const d = state.distance;
  const cur = biomeIndexAt(d);
  if (cur !== state.biome && state.mode === 'running') showBiomeName(cur);
  state.biome = cur;
  const prev = (cur + BIOMES.length - 1) % BIOMES.length;
  const local = d % BIOME_LENGTH;
  const t = d < BIOME_LENGTH ? 1 : THREE.MathUtils.smoothstep(local, 0, TRANSITION);
  const A = BIOMES[prev], B = BIOMES[cur];
  lerpHex(A.fog, B.fog, t, scene.fog.color);
  scene.background.copy(scene.fog.color);
  scene.fog.density = THREE.MathUtils.lerp(A.density, B.density, t) + Math.sin(Math.PI * t) * 0.025;
  hemi.color.copy(lerpHex(A.hemi.sky, B.hemi.sky, t, cA));
  hemi.groundColor.copy(lerpHex(A.hemi.ground, B.hemi.ground, t, cA));
  hemi.intensity = THREE.MathUtils.lerp(A.hemi.intensity, B.hemi.intensity, t) * 1.6;
  key.color.copy(lerpHex(A.key.color, B.key.color, t, cA));
  key.intensity = THREE.MathUtils.lerp(A.key.intensity, B.key.intensity, t) * 1.4;
  key.position.set(...B.key.pos.map((v, i) => THREE.MathUtils.lerp(A.key.pos[i], v, t)));
  key.position.x += state.x; key.target.position.set(state.x, 0, -8);
  world.embers.material.color.copy(lerpHex(A.ember, B.ember, t, cA));
  world.skyA.material.map = world.skies[prev] || world.skies[0]; world.skyA.material.opacity = 1;
  world.skyB.material.map = world.skies[cur] || world.skies[0]; world.skyB.material.opacity = t;
  world.skyA.visible = t < 1;
  torch.intensity = 22 + Math.sin(time * 13) * 3 + Math.sin(time * 7.3) * 2;
}

let lastSkyMaps = [null, null];
function syncSkyMaps() {
  const a = world.skyA.material, b = world.skyB.material;
  if (lastSkyMaps[0] !== a.map || lastSkyMaps[1] !== b.map) { a.needsUpdate = b.needsUpdate = true; lastSkyMaps = [a.map, b.map]; }
}

function tick() {
  requestAnimationFrame(tick);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  handleInput(rawDt);
  if (!world) { renderer.render(scene, camera); return; }

  const slowmo = state.mode === 'dying' ? 0.25 : 1;
  const dt = rawDt * slowmo;
  const moving = state.mode === 'running' || state.mode === 'title' || state.mode === 'dying';
  const worldSpeed = state.mode === 'title' ? 8 : state.speed * (state.mode === 'dying' ? Math.max(0, 1 - state.dyingT * 2) : 1);
  const dz = moving ? worldSpeed * dt : 0;

  if (state.mode === 'running') {
    state.elapsed += dt;
    state.distance += state.speed * dt;
    state.laneChangeT += dt;
    score.update(dt, state.speed * dt);
    const step = Math.floor(state.elapsed / RAMP_INTERVAL);
    const newSpeed = Math.min(MAX_SPEED, BASE_SPEED + step * SPEED_STEP);
    if (newSpeed > state.speed) {
      state.speed = newSpeed; camera.fov += 7;
      world.burst.spawn(new THREE.Vector3(state.x, 1.1, 0), 3, 0xffffff, 0.9);
      audio.setSpeed(state.speed, BASE_SPEED, MAX_SPEED);
      audio.play('speedup');
      state.shake = Math.max(state.shake, 0.18);
    }
    updateRunner(dt);
    world.obstacles.update(dt, state.speed, state.elapsed, state.distance, t);
    const hit = world.obstacles.hits(runnerBox());
    if (hit && !state.god) die(hit);
    else scorePassed();
    for (const e of score.drain()) {
      if (e.type === 'clear') { popText(`+${e.pts}`, 'clear'); audio.play('clear'); }
      else if (e.type === 'near') { popText(`NEAR MISS +${e.pts}`, 'near'); audio.play('near'); }
      else if (e.type === 'tier') { popText(`x${e.mult}`, 'tier'); audio.play('tier', e.mult); buzz(15); }
    }
    updateHud();
    speedEl.textContent = `${state.speed.toFixed(0)} m/s`;
  } else if (state.mode === 'dying') {
    state.dyingT += rawDt;
    world.runner.root.position.y = Math.max(0, state.y - state.dyingT * 4);
    world.obstacles.update(dt, worldSpeed, state.elapsed, state.distance, t);
    if (state.dyingT > 1.5) showGameOver();
  }

  world.runner.update(rawDt, {
    mode: state.mode, grounded: state.grounded, sliding: state.slideT > 0, sinceJump: state.sinceJump,
    landT: state.landT, laneDelta: state.lane * LANE_WIDTH - state.x, speed: state.speed,
  });
  world.shadow.position.x = state.x;
  world.shadow.scale.setScalar(Math.max(0.4, 1 - state.y * 0.25));

  if (moving) {
    for (const slot of world.slots) {
      slot.position.z += dz;
      if (slot.position.z > SEGMENT_LENGTH * 2) { slot.position.z -= SEGMENTS * SEGMENT_LENGTH; setSlotBiome(slot); }
    }
  }
  updateBiome(t);
  syncSkyMaps();

  const p = world.emberGeo.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    p[i + 1] += rawDt * 0.8;
    p[i + 2] += dz * 0.6;
    if (p[i + 1] > 8 || p[i + 2] > 8) { p[i + 1] = Math.random() * 2; p[i + 2] = -70 + Math.random() * 10; p[i] = (Math.random() - 0.5) * 18; }
  }
  world.emberGeo.attributes.position.needsUpdate = true;
  world.sparks.update(rawDt);
  world.dust.update(rawDt, dz);
  world.burst.update(rawDt);
  for (const j of world.jets) {
    j.t += rawDt;
    const f = Math.floor(j.t * 20) % 16;
    j.map.offset.set((f % 8) / 8, 1 - (Math.floor(f / 8) + 1) / 2);
  }

  // Camera: follow lane loosely, FOV kick decays, shake on hit.
  const baseFov = camera.aspect < 1 ? 82 : 65; // wider in portrait so all lanes stay in view
  camera.fov += (baseFov + (state.speed - BASE_SPEED) * 0.3 - camera.fov) * Math.min(1, rawDt * 3);
  camera.updateProjectionMatrix();
  state.shake = Math.max(0, state.shake - rawDt);
  const s = state.shake * 0.5;
  camera.position.set(CAM_BASE.x + state.x * 0.5 + (Math.random() - 0.5) * s, CAM_BASE.y + (Math.random() - 0.5) * s, CAM_BASE.z);
  camera.lookAt(state.x * 0.5, 1, -10);
  world.skyA.position.copy(camera.position);
  world.skyB.position.copy(camera.position);

  torch.position.x = state.x;
  fill.position.x = state.x;

  frames++; fpsTime += rawDt;
  if (fpsTime >= 0.5) {
    const fps = Math.round(frames / fpsTime);
    fpsEl.textContent = `${fps} fps`;
    if (state.mode === 'running') adaptResolution(fps);
    frames = 0; fpsTime = 0;
  }

  renderer.render(scene, camera);
}
tick();
