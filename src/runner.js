import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const RUNS = new Set(['run_loop', 'lean_left', 'lean_right']);
const ONE_SHOT = new Set(['jump_takeoff', 'jump_land', 'hit', 'death_fall']);

// The hooded knight: GLTF model + an animation state picked from game state each frame.
export class RunnerModel {
  constructor(gltf) {
    this.root = new THREE.Group();
    this.model = skeletonClone(gltf.scene);
    this.model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of gltf.animations) {
      const a = this.mixer.clipAction(clip);
      if (ONE_SHOT.has(clip.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[clip.name] = a;
    }
    this.current = null;
    this.play('run_loop', 0);
  }

  play(name, fade = 0.12) {
    if (this.current === name) return;
    const next = this.actions[name];
    if (!next) return;
    const prev = this.current && this.actions[this.current];
    next.reset().setEffectiveWeight(1).play();
    if (prev && RUNS.has(name) && RUNS.has(this.current)) next.time = prev.time; // keep the stride in phase
    if (prev && fade > 0) next.crossFadeFrom(prev, fade, false);
    else if (prev) prev.stop();
    this.current = name;
  }

  // s: { mode, grounded, sliding, sinceJump, landT, laneDelta, speed }
  update(dt, s) {
    let want;
    if (s.mode === 'dying' || s.mode === 'over') want = 'death_fall';
    else if (s.sliding) want = 'slide';
    else if (!s.grounded) want = s.sinceJump < 0.28 ? 'jump_takeoff' : 'jump_air';
    else if (s.landT > 0) want = 'jump_land';
    else if (s.laneDelta < -0.25) want = 'lean_left';
    else if (s.laneDelta > 0.25) want = 'lean_right';
    else want = 'run_loop';
    const fade = want === 'death_fall' ? 0.08 : want === 'slide' ? 0.08 : 0.12;
    this.play(want, fade);
    const runScale = s.mode === 'title' ? 0.8 : 0.85 + (s.speed - 12) * 0.03;
    for (const n of ['run_loop', 'lean_left', 'lean_right']) this.actions[n].timeScale = runScale;
    this.mixer.update(s.mode === 'paused' ? 0 : dt);
  }
}
