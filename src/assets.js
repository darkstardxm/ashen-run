import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BIOMES } from './biomes.js';

const BASE = './art/';
const OBSTACLES = ['low_barrier', 'hanging_blade_or_beam', 'broken_wall'];

// Loads every model, sky and VFX sheet the game uses. onProgress(0..1).
export async function loadAssets(onProgress = () => {}) {
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_u, done, total) => onProgress(done / total);
  const gltf = new GLTFLoader(manager);
  const tex = new THREE.TextureLoader(manager);
  const glb = (p) => gltf.loadAsync(BASE + p);
  const img = (p, srgb = true) => tex.loadAsync(BASE + p).then((t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; });

  const out = { runner: null, biomes: {}, vfx: {} };
  const jobs = [glb('runner/runner.glb').then((g) => (out.runner = g))];
  for (const b of BIOMES) {
    const o = (out.biomes[b.id] = { obstacles: {}, scenery: {} });
    jobs.push(glb(`track/${b.id}_segment.glb`).then((g) => (o.track = g.scene)));
    for (const n of [...OBSTACLES, b.signature]) jobs.push(glb(`obstacles/${b.id}/${n}.glb`).then((g) => (o.obstacles[n] = g.scene)));
    for (const n of new Set([...b.scenery, b.pillar, b.arch].filter(Boolean))) jobs.push(glb(`scenery/${b.id}/${n}.glb`).then((g) => (o.scenery[n] = g.scene)));
    jobs.push(img(`sky/${b.id}_equirect.jpg`).then((t) => (o.sky = t)));
  }
  for (const n of ['embers', 'hit_sparks', 'dust_landing_puff', 'fire_jet', 'speedup_ember_burst']) {
    jobs.push(img(`vfx/${n}_sheet.png`).then((t) => (out.vfx[n] = t)));
  }
  await Promise.all(jobs);
  return out;
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
