import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BIOMES } from './biomes.js';

const BASE = './art/';
const OBSTACLES = ['low_barrier', 'hanging_blade_or_beam', 'broken_wall'];

function loaders(manager) {
  const gltf = new GLTFLoader(manager);
  const tex = new THREE.TextureLoader(manager);
  return {
    glb: (p) => gltf.loadAsync(BASE + p),
    img: (p, srgb = true) => tex.loadAsync(BASE + p).then((t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }),
  };
}
function biomeJobs(L, out, b) {
  const o = (out.biomes[b.id] = { obstacles: {}, scenery: {} });
  const jobs = [L.glb(`track/${b.id}_segment.glb`).then((g) => (o.track = g.scene))];
  for (const n of [...OBSTACLES, b.signature]) jobs.push(L.glb(`obstacles/${b.id}/${n}.glb`).then((g) => (o.obstacles[n] = g.scene)));
  for (const n of new Set([...b.scenery, b.pillar, b.arch].filter(Boolean))) jobs.push(L.glb(`scenery/${b.id}/${n}.glb`).then((g) => (o.scenery[n] = g.scene)));
  jobs.push(L.img(`sky/${b.id}_equirect.jpg`).then((t) => (o.sky = t)));
  return jobs;
}

// Loads what the first biome needs (runner, VFX, biome 0). onProgress(0..1).
// The other biomes stream in afterwards with loadBiome so the game starts sooner.
export async function loadAssets(onProgress = () => {}) {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_u, done, total) => onProgress(done / total);
  const L = loaders(manager);
  const out = { runner: null, biomes: {}, vfx: {} };
  const jobs = [L.glb('runner/runner.glb').then((g) => (out.runner = g)), ...biomeJobs(L, out, BIOMES[0])];
  for (const n of ['embers', 'hit_sparks', 'dust_landing_puff', 'fire_jet', 'speedup_ember_burst']) {
    jobs.push(L.img(`vfx/${n}_sheet.webp`).then((t) => (out.vfx[n] = t)));
  }
  await Promise.all(jobs);
  return out;
}

export async function loadBiome(out, index) {
  await Promise.all(biomeJobs(loaders(new THREE.LoadingManager()), out, BIOMES[index]));
  return out.biomes[BIOMES[index].id];
}

// Collider hint stored in glTF extras on `nodeName` (or the first node carrying one).
export function colliderOf(root, nodeName) {
  let found = null;
  root.traverse((n) => {
    if (found || !n.userData?.collider_size) return;
    if (!nodeName || n.name === nodeName) found = n.userData;
  });
  return found && { size: found.collider_size, center: found.collider_center };
}
