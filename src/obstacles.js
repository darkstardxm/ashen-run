import * as THREE from 'three';

// Procedural obstacles built from small patterns. Types:
//  low   - knee-high barrier, jump over
//  high  - hanging beam, slide under
//  wall  - full block, change lanes
//  gap   - hole in the causeway, jump over
const SPAWN_Z = -90;
const DESPAWN_Z = 10;

const defs = {
  low:  { w: 1.7, h: 0.9,  d: 0.6, y: 0.45, color: 0x5b3a26 },
  high: { w: 1.9, h: 1.4,  d: 0.5, y: 2.1,  color: 0x3d3f47 }, // bottom at 1.4m
  wall: { w: 1.8, h: 3.2,  d: 1.0, y: 1.6,  color: 0x26242a },
  gap:  { w: 2.0, h: 0.42, d: 2.4, y: -0.2, color: 0x000000 },
};

// Patterns: each row is [lane -1, lane 0, lane 1]; null = free.
const PATTERNS = [
  { min: 0, rows: [['low', null, null]] },
  { min: 0, rows: [[null, 'low', null]] },
  { min: 0, rows: [[null, null, 'high']] },
  { min: 0, rows: [[null, 'wall', null]] },
  { min: 0, rows: [['wall', null, 'wall']] },
  { min: 0, rows: [['low', 'low', 'low']] },
  { min: 10, rows: [['high', 'high', 'high']] },
  { min: 10, rows: [[null, 'gap', null]] },
  { min: 15, rows: [['wall', 'low', 'wall']] },
  { min: 15, rows: [['wall', 'high', 'wall']] },
  { min: 25, rows: [['wall', 'wall', null]] },
  { min: 25, rows: [[null, 'wall', 'wall']] },
  { min: 30, rows: [['gap', 'gap', 'low']] },
  { min: 40, rows: [['low', 'wall', 'high']] },
];

export class Obstacles {
  constructor(scene, laneWidth) {
    this.scene = scene;
    this.laneWidth = laneWidth;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mats = {};
    this.geos = {};
    for (const [k, d] of Object.entries(defs)) {
      this.geos[k] = new THREE.BoxGeometry(d.w, d.h, d.d);
      this.mats[k] = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.9, emissive: k === 'gap' ? 0x000000 : 0x3a1406, emissiveIntensity: 0.9 });
    }
    this.reset();
  }

  reset() {
    for (const o of this.items || []) this.group.remove(o.mesh);
    this.items = [];
    this.nextSpawnZ = -40; // first obstacle distance ahead of the player
    this.rowId = 0;
  }

  // Gap between patterns shrinks over time (density ramp).
  spacing(elapsed) {
    return Math.max(9, 26 - elapsed * 0.22) + Math.random() * 6;
  }

  spawn(z, elapsed) {
    const pool = PATTERNS.filter((p) => p.min <= elapsed);
    const pat = pool[Math.floor(Math.random() * pool.length)];
    const flip = Math.random() < 0.5;
    const row = { id: ++this.rowId, scored: false };
    for (const r of pat.rows) {
      const lanes = flip ? [...r].reverse() : r;
      lanes.forEach((type, i) => {
        if (!type) return;
        const d = defs[type];
        const mesh = new THREE.Mesh(this.geos[type], this.mats[type]);
        mesh.position.set((i - 1) * this.laneWidth, d.y, z);
        this.group.add(mesh);
        this.items.push({ type, mesh, d, row, lane: i - 1 });
      });
    }
  }

  update(dt, speed, elapsed) {
    const dz = speed * dt;
    for (const o of this.items) o.mesh.position.z += dz;
    this.nextSpawnZ += dz;
    while (this.nextSpawnZ > SPAWN_Z) {
      this.spawn(this.nextSpawnZ - 60, elapsed);
      this.nextSpawnZ -= this.spacing(elapsed);
    }
    const keep = [];
    for (const o of this.items) {
      if (o.mesh.position.z > DESPAWN_Z) this.group.remove(o.mesh);
      else keep.push(o);
    }
    this.items = keep;
  }

  // Rows that just passed the runner (back edge behind z=0.5), each reported once.
  passed() {
    const out = new Map();
    for (const o of this.items) {
      if (o.row.scored) continue;
      if (o.mesh.position.z - o.d.d / 2 > 0.5) {
        if (!out.has(o.row)) out.set(o.row, []);
        out.get(o.row).push(o);
      }
    }
    for (const row of out.keys()) row.scored = true;
    return [...out.values()];
  }

  hits(b) {
    for (const o of this.items) {
      const p = o.mesh.position, d = o.d;
      const minZ = p.z - d.d / 2, maxZ = p.z + d.d / 2;
      if (maxZ < b.minZ || minZ > b.maxZ) continue;
      const minX = p.x - d.w / 2, maxX = p.x + d.w / 2;
      if (maxX < b.minX || minX > b.maxX) continue;
      if (o.type === 'gap') {
        // Falling in only if on the ground over the hole, centered enough.
        if (b.minY <= 0.01 && Math.abs((b.minX + b.maxX) / 2 - p.x) < d.w / 2 - 0.2) return o;
        continue;
      }
      const minY = p.y - d.h / 2, maxY = p.y + d.h / 2;
      if (maxY < b.minY || minY > b.maxY) continue;
      return o;
    }
    return null;
  }
}
