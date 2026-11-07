import * as THREE from 'three';

// M0 skeleton: foggy causeway receding from the camera, three lanes, placeholder runner.
const LANE_WIDTH = 2;
const SEGMENT_LENGTH = 12;
const SEGMENTS = 12;

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d12);
scene.fog = new THREE.Fog(0x0b0d12, 8, 70);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 4, 7);
camera.lookAt(0, 1, -10);

scene.add(new THREE.HemisphereLight(0x3a4660, 0x120a06, 0.6));
const moon = new THREE.DirectionalLight(0x8899bb, 0.8);
moon.position.set(-5, 10, 5);
scene.add(moon);
const torch = new THREE.PointLight(0xff6a2a, 30, 18, 2);
torch.position.set(0, 3, 1);
scene.add(torch);

// Track segments that loop toward the camera.
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

// Placeholder runner.
const runner = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 0.9, 4, 12),
  new THREE.MeshStandardMaterial({ color: 0x6b6f78, metalness: 0.6, roughness: 0.4 })
);
runner.position.set(0, 0.8, 0);
scene.add(runner);

// Ember particles.
const EMBERS = 300;
const emberGeo = new THREE.BufferGeometry();
const emberPos = new Float32Array(EMBERS * 3);
for (let i = 0; i < EMBERS; i++) {
  emberPos[i * 3] = (Math.random() - 0.5) * 16;
  emberPos[i * 3 + 1] = Math.random() * 8;
  emberPos[i * 3 + 2] = -Math.random() * 60;
}
emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xff7a30, size: 0.08, transparent: true, opacity: 0.85 }));
scene.add(embers);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const fpsEl = document.getElementById('fps');
let frames = 0, fpsTime = 0;
const clock = new THREE.Clock();
const speed = 10;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  for (const seg of track.children) {
    seg.position.z += speed * dt;
    if (seg.position.z > SEGMENT_LENGTH) seg.position.z -= SEGMENTS * SEGMENT_LENGTH;
  }
  const p = emberGeo.attributes.position.array;
  for (let i = 0; i < EMBERS; i++) {
    p[i * 3 + 1] += dt * 0.6;
    p[i * 3 + 2] += speed * dt * 0.5;
    if (p[i * 3 + 1] > 8 || p[i * 3 + 2] > 8) { p[i * 3 + 1] = 0; p[i * 3 + 2] = -60; }
  }
  emberGeo.attributes.position.needsUpdate = true;
  runner.position.y = 0.8 + Math.abs(Math.sin(t * 10)) * 0.08;
  torch.intensity = 26 + Math.sin(t * 13) * 3 + Math.sin(t * 7.3) * 2;

  frames++; fpsTime += dt;
  if (fpsTime >= 0.5) { fpsEl.textContent = `${Math.round(frames / fpsTime)} fps`; frames = 0; fpsTime = 0; }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
