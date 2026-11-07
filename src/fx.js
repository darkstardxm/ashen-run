import * as THREE from 'three';

// Flipbook sprites from the VFX sheets (frames run left-to-right, top-to-bottom).
export class SheetFX {
  constructor(scene, texture, { cols, rows, frames, fps, additive = true, loop = false, pool = 4 }) {
    Object.assign(this, { cols, rows, frames, fps, loop });
    this.items = [];
    for (let i = 0; i < pool; i++) {
      const map = texture.clone();
      map.repeat.set(1 / cols, 1 / rows);
      const mat = new THREE.SpriteMaterial({
        map, transparent: true, depthWrite: false, fog: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      scene.add(s);
      this.items.push({ s, t: 0 });
    }
    this.next = 0;
  }

  frame(it, f) {
    const m = it.s.material.map;
    m.offset.set((f % this.cols) / this.cols, 1 - (Math.floor(f / this.cols) + 1) / this.rows);
  }

  spawn(pos, size, color = 0xffffff, opacity = 1) {
    const it = this.items[this.next++ % this.items.length];
    it.t = 0;
    it.s.position.copy(pos);
    it.s.scale.set(size, size, 1);
    it.s.material.color.set(color);
    it.s.material.opacity = opacity;
    it.s.visible = true;
    this.frame(it, 0);
    return it.s;
  }

  update(dt, dz = 0) {
    for (const it of this.items) {
      if (!it.s.visible) continue;
      it.t += dt;
      it.s.position.z += dz;
      let f = Math.floor(it.t * this.fps);
      if (f >= this.frames) {
        if (this.loop) f %= this.frames;
        else { it.s.visible = false; continue; }
      }
      this.frame(it, f);
    }
  }
}

// Crop one frame out of a sheet into its own texture (for THREE.Points).
export function cropFrame(texture, fw, fh, i = 0, cols = 1) {
  const c = document.createElement('canvas');
  c.width = fw; c.height = fh;
  c.getContext('2d').drawImage(texture.image, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh, 0, 0, fw, fh);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft dark disc used as a blob shadow and for gap holes.
export function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, inner); grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
