// Souls: collectibles that float over the lanes (v2). The run's haul is banked in localStorage on death.
import * as THREE from 'three';
import { radialTexture } from './fx.js';

const KEY = 'ashenrun.souls';
const PER_LINE = 5, GAP = 2.2;         // souls per line, metres between them
const MAGNET = 2.4, GRAB = 0.85;       // pull-in and collect radii (m)
export const SOUL_POINTS = 5;

export function loadSouls() {
  try { return Math.max(0, parseInt(localStorage.getItem(KEY), 10) || 0); } catch { return 0; }
}
export function saveSouls(v) { try { localStorage.setItem(KEY, String(v)); } catch { /* private mode */ } }

export class Souls {
  constructor(scene, laneWidth, fx) {
    this.laneWidth = laneWidth; this.fx = fx;
    this.group = new THREE.Group(); scene.add(this.group);
    // Placeholder look until art batch 4: a pale cold crystal with a soft halo.
    this.tpl = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xbfeaff }));
    core.scale.y = 1.5;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture('#7fd4ffaa', '#00000000'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.scale.setScalar(1.1);
    this.tpl.add(core, halo);
    this.bank = loadSouls();
    this.reset();
  }

  setModel(root) { if (root) this.tpl = root; } // art batch 4 soul pickup

  reset() {
    for (const s of this.items || []) this.group.remove(s.mesh);
    this.items = []; this.run = 0;
  }

  // Called by Obstacles for every spawned row; occ is [left, mid, right] obstacle types or null.
  onRow(z, occ) {
    if (Math.random() > 0.5) return;
    const free = [], over = [];
    occ.forEach((t, i) => { if (!t) free.push(i - 1); else if (t === 'low' || t === 'gap' || t === 'high') over.push([i - 1, t]); });
    let lane, kind = 'line';
    if (over.length && (Math.random() < 0.45 || !free.length)) { const [l, t] = over[Math.floor(Math.random() * over.length)]; lane = l; kind = t === 'high' ? 'slide' : 'arc'; }
    else if (free.length) lane = free[Math.floor(Math.random() * free.length)];
    else return;
    for (let k = 0; k < PER_LINE; k++) {
      const off = (k - (PER_LINE - 1) / 2) * GAP;          // centred on the obstacle row
      const u = off / (GAP * (PER_LINE - 1) / 2);           // -1..1
      const y = kind === 'arc' ? 1.0 + 1.5 * (1 - u * u) : kind === 'slide' ? 0.55 : 1.0;
      const mesh = this.tpl.clone();
      mesh.position.set(lane * this.laneWidth, y, z + off);
      this.group.add(mesh);
      this.items.push({ mesh, y, phase: Math.random() * 6 });
    }
  }

  // rx/ry: runner centre. Returns how many souls were collected this frame.
  update(dt, dz, rx, ry, time, live = true) {
    let got = 0;
    const keep = [];
    for (const s of this.items) {
      const p = s.mesh.position;
      p.z += dz;
      s.mesh.rotation.y += dt * 3;
      if (live) {
        const dx = rx - p.x, dy = ry - p.y, d = Math.hypot(dx, dy, p.z);
        if (d < GRAB) { this.group.remove(s.mesh); got++; this.fx?.collect?.(p); continue; }
        if (d < MAGNET && Math.abs(dx) < 1.3) { const k = Math.min(1, dt * 10); p.x += dx * k; p.y += dy * k; s.pulled = true; }
      }
      if (!s.pulled) p.y = s.y + Math.sin(time * 3 + s.phase) * 0.08;
      if (p.z > 6) this.group.remove(s.mesh); else keep.push(s);
    }
    this.items = keep;
    this.run += got;
    return got;
  }

  // Add the run's souls to the saved total. Returns the new total.
  bankRun() { this.bank += this.run; saveSouls(this.bank); return this.bank; }
  spend(n) { if (n > this.bank) return false; this.bank -= n; saveSouls(this.bank); return true; }
}
