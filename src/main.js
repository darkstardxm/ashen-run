import * as THREE from 'three';
import { Input } from './input.js';
import { Obstacles } from './obstacles.js';
import { Score } from './score.js';

// M1 core loop (greybox): three lanes, jump/slide/lane input, procedural obstacles,
// collision, speed + density ramps, game over and restart.
export const LANE_WIDTH = 2;
const SEGMENT_LENGTH = 12;
const SEGMENTS = 12;
const BASE_SPEED = 12;
const MAX_SPEED = 30;
const SPEED_STEP = 2;          // added every ramp
const RAMP_INTERVAL = 20;      // seconds
const GRAVITY = -38;
const JUMP_VELOCITY = 13;
const SLIDE_TIME = 0.65;
const LANE_LERP = 14;
const BUFFER_TIME = 0.15;

const $ = (id) => document.getElementById(id);
const app = $('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d12);
scene.fog = new THREE.Fog(0x0b0d12, 10, 75);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
const CAM_BASE = new THREE.Vector3(0, 4, 7);
camera.position.copy(CAM_BASE);
camera.lookAt(0, 1, -10);

scene.add(new THREE.HemisphereLight(0x3a4660, 0x120a06, 0.7));
const moon = new THREE.DirectionalLight(0x8899bb, 0.8);
moon.position.set(-5, 10, 5);
scene.add(moon);
const torch = new THREE.PointLight(0xff6a2a, 30, 18, 2);
torch.position.set(0, 3.6, -2.5);
scene.add(torch);
const fill = new THREE.PointLight(0xffb080, 8, 8, 2); // keeps the runner readable from behind
fill.position.set(0, 2.5, 2.5);
scene.add(fill);

// Looping track.
const track = new THREE.Group();
scene.add(track);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.95 });
const lineMat = new THREE.MeshBasicMaterial({ color: 0x5a3a22 });
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1c1b1f, roughness: 1 });
for (let i = 0; i < SEGMENTS; i++) {
  const seg = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(LANE_WIDTH * 3, 0.4, SEGMENT_LENGTH), floorMat);
  floor.position.y = -0.2;
  seg.add(floor);
  for (const x of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, SEGMENT_LENGTH * 0.9), lineMat);
    line.position.set(x, 0.01, 0);
    seg.add(line);
  }
  for (const x of [-4.2, 4.2]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), pillarMat);
    pillar.position.set(x, 3, 0);
    seg.add(pillar);
  }
  seg.position.z = -i * SEGMENT_LENGTH;
  track.add(seg);
}

// Placeholder runner: a pivot we squash/stretch, holding a capsule.
const runnerRoot = new THREE.Group();
const runnerBody = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 0.9, 4, 12),
  new THREE.MeshStandardMaterial({ color: 0x6b6f78, metalness: 0.6, roughness: 0.4 })
);
runnerBody.position.y = 0.8;
runnerRoot.add(runnerBody);
scene.add(runnerRoot);

// Embers.
const EMBERS = 300;
const emberGeo = new THREE.BufferGeometry();
const emberPos = new Float32Array(EMBERS * 3);
for (let i = 0; i < EMBERS; i++) {
  emberPos[i * 3] = (Math.random() - 0.5) * 16;
  emberPos[i * 3 + 1] = Math.random() * 8;
  emberPos[i * 3 + 2] = -Math.random() * 60;
}
emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
scene.add(new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xff7a30, size: 0.08, transparent: true, opacity: 0.85 })));

// Hit sparks (collision feedback).
const SPARKS = 40;
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
const sparkVel = new Float32Array(SPARKS * 3);
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffb060, size: 0.12, transparent: true }));
sparks.visible = false;
scene.add(sparks);

const obstacles = new Obstacles(scene, LANE_WIDTH);
const input = new Input(renderer.domElement);
const score = new Score();
$('title-best').textContent = score.best;

// State.
const state = {
  mode: 'title',      // title | running | paused | dying | over
  prevLane: 0, laneChangeT: 99,
  lane: 0,            // -1, 0, 1
  x: 0, y: 0, vy: 0,
  grounded: true,
  slideT: 0,
  speed: BASE_SPEED,
  elapsed: 0,
  distance: 0,
  dyingT: 0,
  landT: 0,
  shake: 0,
  bufferedJump: 0,
  bufferedSlide: 0,
};

function resetRun() {
  Object.assign(state, {
    mode: 'running', lane: 0, x: 0, y: 0, vy: 0, grounded: true, slideT: 0,
    speed: BASE_SPEED, elapsed: 0, distance: 0, dyingT: 0, landT: 0, shake: 0,
    bufferedJump: 0, bufferedSlide: 0, prevLane: 0, laneChangeT: 99,
  });
  obstacles.reset();
  score.reset();
  updateHud(true);
  $('pause').classList.add('hidden');
  $('pause-btn').classList.remove('hidden');
  sparks.visible = false;
  runnerRoot.rotation.set(0, 0, 0);
  runnerBody.scale.set(1, 1, 1);
  $('title').classList.add('hidden');
  $('over').classList.add('hidden');
  $('hud').classList.remove('hidden');
}

function die() {
  state.mode = 'dying';
  state.dyingT = 0;
  state.shake = 0.6;
  const p = sparkGeo.attributes.position.array;
  for (let i = 0; i < SPARKS; i++) {
    p[i * 3] = state.x; p[i * 3 + 1] = state.y + 1; p[i * 3 + 2] = -0.4;
    sparkVel[i * 3] = (Math.random() - 0.5) * 8;
    sparkVel[i * 3 + 1] = Math.random() * 7;
    sparkVel[i * 3 + 2] = (Math.random() - 0.2) * 6;
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparks.visible = true;
  sparks.material.opacity = 1;
}

function showGameOver() {
  state.mode = 'over';
  const record = score.finish();
  $('final-score').textContent = score.value;
  $('final-dist').textContent = Math.floor(state.distance);
  $('final-best').textContent = score.best;
  $('title-best').textContent = score.best;
  $('new-record').classList.toggle('hidden', !record);
  $('over').classList.remove('hidden');
  $('pause-btn').classList.add('hidden');
}

function setPaused(on) {
  if (on && state.mode === 'running') { state.mode = 'paused'; $('pause').classList.remove('hidden'); }
  else if (!on && state.mode === 'paused') { state.mode = 'running'; $('pause').classList.add('hidden'); clock.getDelta(); }
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
    hud.mult.textContent = score.mult > 1 ? `x${score.mult}` : '';
    hud.mult.classList.remove('pulse'); void hud.mult.offsetWidth; hud.mult.classList.add('pulse');
  }
}
function popText(text, cls) {
  const el = document.createElement('div');
  el.className = `pop ${cls}`; el.textContent = text;
  hud.pop.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function startOrRestart() {
  if (state.mode === 'title' || state.mode === 'over') resetRun();
}
$('play-btn').addEventListener('click', startOrRestart);
$('restart-btn').addEventListener('click', startOrRestart);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const fpsEl = $('fps');
const speedEl = $('speed');
let frames = 0, fpsTime = 0;
const clock = new THREE.Clock();

function handleInput(dt) {
  state.bufferedJump = Math.max(0, state.bufferedJump - dt);
  state.bufferedSlide = Math.max(0, state.bufferedSlide - dt);
  for (const a of input.drain()) {
    if (state.mode === 'paused') { if (a === 'pause' || a === 'confirm' || a === 'jump') setPaused(false); continue; }
    if (state.mode !== 'running') {
      if (a === 'jump' || a === 'confirm') startOrRestart();
      continue;
    }
    if (a === 'pause') { setPaused(true); continue; }
    if (a === 'left' || a === 'right') {
      const nl = Math.max(-1, Math.min(1, state.lane + (a === 'left' ? -1 : 1)));
      if (nl !== state.lane) { state.prevLane = state.lane; state.lane = nl; state.laneChangeT = 0; }
    }
    else if (a === 'jump') state.bufferedJump = BUFFER_TIME;
    else if (a === 'slide') state.bufferedSlide = BUFFER_TIME;
  }
  if (state.bufferedJump > 0 && state.grounded) {
    state.vy = JUMP_VELOCITY; state.grounded = false; state.slideT = 0; state.bufferedJump = 0;
  }
  if (state.bufferedSlide > 0) {
    if (state.grounded) { state.slideT = SLIDE_TIME; state.bufferedSlide = 0; }
    else state.vy = Math.min(state.vy, -18); // fast-fall into slide
  }
}

function updateRunner(dt) {
  const targetX = state.lane * LANE_WIDTH;
  const prevX = state.x;
  state.x += (targetX - state.x) * Math.min(1, LANE_LERP * dt);
  const lean = (state.x - prevX) / Math.max(dt, 1e-4);

  if (!state.grounded) {
    state.vy += GRAVITY * dt;
    state.y += state.vy * dt;
    if (state.y <= 0) { state.y = 0; state.vy = 0; state.grounded = true; state.landT = 0.18; }
  }
  if (state.slideT > 0) state.slideT -= dt;
  if (state.landT > 0) state.landT -= dt;

  runnerRoot.position.set(state.x, state.y, 0);
  runnerRoot.rotation.z = THREE.MathUtils.lerp(runnerRoot.rotation.z, -lean * 0.03, 0.3);
  const sliding = state.slideT > 0;
  let sy = 1, sxz = 1;
  if (sliding) { sy = 0.45; sxz = 1.2; }
  else if (state.landT > 0) { const k = state.landT / 0.18; sy = 1 - 0.25 * k; sxz = 1 + 0.15 * k; }
  else if (!state.grounded) { sy = 1 + Math.min(0.15, Math.abs(state.vy) * 0.01); sxz = 1 / sy; }
  runnerBody.scale.set(sxz, THREE.MathUtils.lerp(runnerBody.scale.y, sy, 0.45), sxz);
  runnerBody.position.y = 0.8 * runnerBody.scale.y + (state.grounded && !sliding ? Math.abs(Math.sin(state.elapsed * 12)) * 0.07 : 0);
}

function runnerBox() {
  const sliding = state.slideT > 0;
  const h = sliding ? 0.8 : 1.6;
  return { minX: state.x - 0.35, maxX: state.x + 0.35, minY: state.y, maxY: state.y + h, minZ: -0.35, maxZ: 0.35 };
}

// A row is cleared cleanly if an obstacle was in the runner's lane (jumped or slid past it).
// Dodging out of its lane also counts as a clear; doing it in the last 0.4s is a near miss.
function scorePassed() {
  for (const row of obstacles.passed()) {
    const inLane = row.some((o) => o.lane === state.lane);
    const leftLane = row.some((o) => o.lane === state.prevLane && o.lane !== state.lane);
    if (leftLane && state.laneChangeT < 0.4) score.bump('near');
    else if (inLane || (leftLane && state.laneChangeT < 1.5)) score.bump('clear');
  }
}

function tick() {
  const rawDt = Math.min(clock.getDelta(), 0.05);
  const slowmo = state.mode === 'dying' ? 0.25 : 1;
  const dt = rawDt * slowmo;
  handleInput(rawDt);

  const moving = state.mode === 'running' || state.mode === 'title' || state.mode === 'dying';
  const worldSpeed = state.mode === 'title' ? 8 : state.speed * (state.mode === 'dying' ? Math.max(0, 1 - state.dyingT * 2) : 1);

  if (state.mode === 'running') {
    state.elapsed += dt;
    state.distance += state.speed * dt;
    state.laneChangeT += dt;
    score.update(dt, state.speed * dt);
    const step = Math.floor(state.elapsed / RAMP_INTERVAL);
    const newSpeed = Math.min(MAX_SPEED, BASE_SPEED + step * SPEED_STEP);
    if (newSpeed > state.speed) { state.speed = newSpeed; camera.fov += 7; }
    updateRunner(dt);
    obstacles.update(dt, state.speed, state.elapsed);
    if (obstacles.hits(runnerBox())) die();
    else scorePassed();
    for (const e of score.drain()) {
      if (e.type === 'clear') popText(`+${e.pts}`, 'clear');
      else if (e.type === 'near') popText(`NEAR MISS +${e.pts}`, 'near');
      else if (e.type === 'tier') popText(`x${e.mult}`, 'tier');
    }
    updateHud();
    speedEl.textContent = `${state.speed.toFixed(0)} m/s`;
  } else if (state.mode === 'dying') {
    state.dyingT += rawDt;
    runnerRoot.rotation.x = Math.min(Math.PI / 2.2, state.dyingT * 3);
    runnerRoot.position.y = Math.max(0, state.y - state.dyingT * 2);
    obstacles.update(dt, worldSpeed, state.elapsed);
    if (state.dyingT > 1.0) showGameOver();
  }

  if (moving) {
    for (const seg of track.children) {
      seg.position.z += worldSpeed * dt;
      if (seg.position.z > SEGMENT_LENGTH) seg.position.z -= SEGMENTS * SEGMENT_LENGTH;
    }
  }

  const p = emberGeo.attributes.position.array;
  for (let i = 0; i < EMBERS; i++) {
    p[i * 3 + 1] += dt * 0.6;
    p[i * 3 + 2] += worldSpeed * dt * 0.5;
    if (p[i * 3 + 1] > 8 || p[i * 3 + 2] > 8) { p[i * 3 + 1] = 0; p[i * 3 + 2] = -60; }
  }
  emberGeo.attributes.position.needsUpdate = true;

  if (sparks.visible) {
    const sp = sparkGeo.attributes.position.array;
    for (let i = 0; i < SPARKS; i++) {
      sparkVel[i * 3 + 1] += GRAVITY * 0.4 * rawDt;
      sp[i * 3] += sparkVel[i * 3] * rawDt;
      sp[i * 3 + 1] += sparkVel[i * 3 + 1] * rawDt;
      sp[i * 3 + 2] += sparkVel[i * 3 + 2] * rawDt;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparks.material.opacity = Math.max(0, sparks.material.opacity - rawDt * 0.8);
  }

  // Camera: follow lane loosely, FOV kick decays, shake on hit.
  const baseFov = camera.aspect < 1 ? 82 : 65; // wider in portrait so all lanes stay in view
  camera.fov += (baseFov + (state.speed - BASE_SPEED) * 0.3 - camera.fov) * Math.min(1, rawDt * 3);
  camera.updateProjectionMatrix();
  state.shake = Math.max(0, state.shake - rawDt);
  const s = state.shake * 0.5;
  camera.position.set(CAM_BASE.x + state.x * 0.5 + (Math.random() - 0.5) * s, CAM_BASE.y + (Math.random() - 0.5) * s, CAM_BASE.z);
  camera.lookAt(state.x * 0.5, 1, -10);

  const t = clock.elapsedTime;
  torch.position.x = state.x;
  fill.position.x = state.x;
  torch.intensity = 26 + Math.sin(t * 13) * 3 + Math.sin(t * 7.3) * 2;

  frames++; fpsTime += rawDt;
  if (fpsTime >= 0.5) { fpsEl.textContent = `${Math.round(frames / fpsTime)} fps`; frames = 0; fpsTime = 0; }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// Debug hook for automated play-tests.
window.__runner = { state, obstacles, input, score };
