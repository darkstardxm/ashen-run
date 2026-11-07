import * as THREE from 'three';
import { colliderOf } from './assets.js';
import { BIOMES, biomeIndexAt } from './biomes.js';
import { radialTexture } from './fx.js';

// Procedural obstacles built from small patterns. Types:
//  low   - knee-high barrier, jump over
//  high  - hanging blade/beam (bottom edge 1.1 m), slide under
//  wall  - broken wall filling a lane, change lanes
//  gap   - hole in the causeway, jump over
//  sig   - the biome's signature hazard:
//          censer (Cathedral): swings in its lane, slide under, jump over, or dodge
//          fire-jet vent (Forge): glows 0.6 s then erupts a fire column, change lanes
//          collapsing ceiling (Catacombs): dust 0.6 s, then rubble drops, jump over
const SPAWN_Z = -90;
const DESPAWN_Z = 12;
const MIN_DEPTH = 0.7;      // thin colliders are padded so they can't be skipped between frames
const TELEGRAPH = 0.6;      // seconds of warning glow before a signature hazard goes live
const TRIGGER_Z = -50;      // signature hazards start their telegraph this far ahead

// Patterns: each row is [lane -1, lane 0, lane 1]; null = free.
const PATTERNS = [
  { min: 0, rows: [['low', null, null]] },
  { min: 0, rows: [[null, 'low', null]] },
  { min: 0, rows: [[null, null, 'high']] },
  { min: 0, rows: [[null, 'wall', null]] },
  { min: 0, rows: [['wall', null, 'wall']] },
  { min: 0, rows: [['low', 'low', 'low']] },
  { min: 6, rows: [[null, 'sig', null]] },
  { min: 6, rows: [['sig', null, null]] },
  { min: 10, rows: [['high', 'high', 'high']] },
  { min: 10, rows: [[null, 'gap', null]] },
  { min: 15, rows: [['wall', 'low', 'wall']] },
  { min: 15, rows: [['wall', 'high', 'wall']] },
  { min: 20, rows: [['wall', 'sig', null]] },
  { min: 25, rows: [['wall', 'wall', null]] },
  { min: 25, rows: [[null, 'wall', 'wall']] },
  { min: 30, rows: [['gap', 'gap', 'low']] },
  { min: 35, rows: [['sig', null, 'sig']] },
  { min: 40, rows: [['low', 'wall', 'high']] },
];

const SIG_KIND = { swinging_censer: 'censer', fire_jet_vent: 'vent', collapsing_ceiling: 'ceiling' };

function boxFromCollider(c, pad = {}) {
  const [w, h, d] = c.size, [, cy] = c.center;
  return { w: pad.w ?? w, h, d: Math.max(MIN_DEPTH, d), y: cy };
}

export class Obstacles {
  constructor(scene, laneWidth, assets, fx) {
    this.scene = scene;
    this.laneWidth = laneWidth;
    this.fx = fx;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.cueMats = new Set();
    this.tpl = BIOMES.map((b) => {
      const o = assets.biomes[b.id].obstacles;
      const prep = (root) => { this.collectCues(root); return root; };
      const low = prep(o.low_barrier), high = prep(o.hanging_blade_or_beam), wall = prep(o.broken_wall), sig = prep(o[b.signature]);
      return {
        low: { root: low, d: boxFromCollider(colliderOf(low, 'low_barrier')) },
        // Beam: bottom edge at 1.1 m; the collider runs up into the chains so it can't be jumped.
        high: { root: high, d: { w: 1.9, h: 2.9, d: MIN_DEPTH, y: 1.1 + 1.45 } },
        wall: { root: wall, d: { ...boxFromCollider(colliderOf(wall, 'broken_wall')), w: 1.9 } },
        sig: { root: sig, kind: SIG_KIND[b.signature], d: this.sigBox(SIG_KIND[b.signature], sig) },
      };
    });
    // Gaps are per-lane holes: a black pit with ember glow from below.
    const gapGeo = new THREE.PlaneGeometry(2.0, 2.4).rotateX(-Math.PI / 2);
    this.gapTpl = new THREE.Group();
    const pit = new THREE.Mesh(gapGeo, new THREE.MeshBasicMaterial({ color: 0x020101 }));
    pit.position.y = 0.012;
    const glow = new THREE.Mesh(gapGeo, new THREE.MeshBasicMaterial({
      map: radialTexture('#ff5a12cc', '#00000000'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    glow.position.y = 0.02;
    this.gapTpl.add(pit, glow);
    this.gapD = { w: 2.0, h: 0.42, d: 2.4, y: -0.2 };
    this.reset();
  }

  sigBox(kind, root) {
    if (kind === 'censer') return { ...boxFromCollider(colliderOf(root, 'censer_body')), y: 1.4 };
    if (kind === 'vent') return boxFromCollider(colliderOf(root, 'fire_jet_vent'));
    return boxFromCollider(colliderOf(root, 'collapsing_ceiling')); // landed rubble
  }

  collectCues(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (/^(cue_|void_)/.test(m.name)) {
          m.fog = false;
          m.userData.base = m.emissiveIntensity;
          this.cueMats.add(m);
        }
      }
    });
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

  spawn(z, elapsed, distance) {
    const pool = PATTERNS.filter((p) => p.min <= elapsed);
    const pat = pool[Math.floor(Math.random() * pool.length)];
    const flip = Math.random() < 0.5;
    const biome = biomeIndexAt(distance - z);
    const row = { id: ++this.rowId, scored: false };
    for (const r of pat.rows) {
      const lanes = flip ? [...r].reverse() : r;
      lanes.forEach((type, i) => {
        if (!type) return;
        const item = this.make(type, biome);
        item.mesh.position.set((i - 1) * this.laneWidth, 0, z);
        Object.assign(item, { type, row, lane: i - 1, biome });
        this.group.add(item.mesh);
        this.items.push(item);
      });
    }
  }

  make(type, biome) {
    if (type === 'gap') return { mesh: this.gapTpl.clone(), d: this.gapD, live: true };
    const t = this.tpl[biome][type];
    const mesh = t.root.clone();
    const item = { mesh, d: t.d, live: true, dx: 0 };
    if (type === 'sig') {
      item.kind = t.kind;
      item.phase = 'idle';
      item.t = 0;
      // Per-instance telegraph material so only this hazard lights up.
      mesh.traverse((o) => {
        if (o.isMesh && /^telegraph_/.test(o.material.name)) {
          o.material = o.material.clone();
          o.material.fog = false;
          item.tele = o.material;
          item.teleBase = o.material.emissiveIntensity || 1;
          o.material.emissiveIntensity = item.teleBase * 0.15;
        }
      });
      if (t.kind === 'censer') {
        item.pivot = mesh.getObjectByName('censer_pivot');
        item.swing = Math.random() * Math.PI * 2;
      } else if (t.kind === 'vent') {
        item.live = false;
        item.jet = mesh.getObjectByName('fx_fire_jet');
      } else {
        item.live = false;
        item.pieces = [1, 2, 3, 4, 5].map((n) => mesh.getObjectByName(`ceiling_piece_0${n}`)).filter(Boolean)
          .map((p) => ({ p, y0: p.position.y, rest: (p.userData.collider_size?.[1] ?? 0.6) / 2, vy: 0 }));
      }
    }
    return item;
  }

  updateSig(o, dt) {
    const z = o.mesh.position.z;
    if (o.kind === 'censer') {
      o.swing += dt * 2.2;
      const a = Math.sin(o.swing) * 0.32;
      o.pivot.rotation.z = a;
      o.dx = Math.sin(a) * 3.05;
      o.dy = 3.05 * (1 - Math.cos(a));
      if (o.tele) o.tele.emissiveIntensity = o.teleBase * (0.6 + 0.4 * Math.abs(Math.sin(o.swing * 2)));
      return;
    }
    if (o.phase === 'idle' && z > TRIGGER_Z) { o.phase = 'tele'; o.t = 0; }
    if (o.phase === 'idle') return;
    o.t += dt;
    if (o.tele) o.tele.emissiveIntensity = o.teleBase * (o.phase === 'tele' ? 0.5 + 0.5 * Math.abs(Math.sin(o.t * 26)) : 1);
    if (o.kind === 'vent') {
      if (o.phase === 'tele' && o.t >= TELEGRAPH) {
        o.phase = 'live'; o.live = true;
        o.fire = this.fx.fireJet(o.mesh);
      }
    } else {
      if (o.phase === 'tele' && o.t < dt * 1.5) this.fx.dust(o.mesh.position, 3.5);
      if (o.phase === 'tele' && o.t >= TELEGRAPH) o.phase = 'drop';
      if (o.phase === 'drop') {
        let landed = 0;
        for (const pc of o.pieces) {
          pc.vy -= 30 * dt;
          pc.p.position.y = Math.max(pc.rest, pc.p.position.y + pc.vy * dt);
          if (pc.p.position.y <= pc.rest) landed++;
        }
        if (landed === o.pieces.length) {
          o.phase = 'live'; o.live = true;
          this.fx.dust(o.mesh.position, 2.2);
        }
      }
    }
  }

  update(dt, speed, elapsed, distance, time) {
    const dz = speed * dt;
    for (const o of this.items) {
      o.mesh.position.z += dz;
      if (o.kind) this.updateSig(o, dt);
    }
    this.nextSpawnZ += dz;
    while (this.nextSpawnZ > SPAWN_Z) {
      this.spawn(this.nextSpawnZ - 60, elapsed, distance);
      this.nextSpawnZ -= this.spacing(elapsed);
    }
    const keep = [];
    for (const o of this.items) {
      if (o.mesh.position.z > DESPAWN_Z) { this.group.remove(o.mesh); if (o.fire) o.fire.done(); }
      else keep.push(o);
    }
    this.items = keep;
    // Cue glows breathe so obstacles read through the fog.
    const k = 0.85 + 0.25 * Math.sin(time * 5);
    for (const m of this.cueMats) m.emissiveIntensity = m.userData.base * k;
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
      if (!o.live) continue;
      const p = o.mesh.position, d = o.d;
      const minZ = p.z - d.d / 2, maxZ = p.z + d.d / 2;
      if (maxZ < b.minZ || minZ > b.maxZ) continue;
      const cx = p.x + (o.dx || 0);
      const minX = cx - d.w / 2, maxX = cx + d.w / 2;
      if (maxX < b.minX || minX > b.maxX) continue;
      if (o.type === 'gap') {
        // Falling in only if on the ground over the hole, centered enough.
        if (b.minY <= 0.01 && Math.abs((b.minX + b.maxX) / 2 - p.x) < d.w / 2 - 0.2) return o;
        continue;
      }
      const cy = d.y + (o.dy || 0);
      const minY = cy - d.h / 2, maxY = cy + d.h / 2;
      if (maxY < b.minY || minY > b.maxY) continue;
      return o;
    }
    return null;
  }
}
