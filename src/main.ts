// Phase 0 placeholder: a calm layered-ridge scene to prove the WebGL2 +
// Three.js + deploy pipeline works. Replaced by the real puddle in Phase 1.
import * as THREE from 'three';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
camera.position.set(0, 1.4, 6);
camera.lookAt(0, 0.6, -10);

const skyTop = new THREE.Color('#6f7fb3');
const skyHorizon = new THREE.Color('#f6c7a4');
const haze = new THREE.Color('#e9b9a2');
scene.fog = new THREE.Fog(haze, 8, 160);

// Sky: vertical gradient on a large inverted sphere, with a soft sun glow.
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(300, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: skyTop },
      horizon: { value: skyHorizon },
      sunDir: { value: new THREE.Vector3(0.25, 0.08, -1).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, horizon, sunDir;
      varying vec3 vDir;
      void main() {
        float t = smoothstep(-0.05, 0.55, vDir.y);
        vec3 col = mix(horizon, top, t);
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.85, 0.65) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.25);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }),
);
scene.add(sky);

// Layered ridges: each layer is a filled silhouette; distance + fog give the
// atmospheric depth.
function ridge(z: number, height: number, rough: number, color: string, seed: number) {
  const shape = new THREE.Shape();
  const width = 260;
  shape.moveTo(-width / 2, -5);
  for (let i = 0; i <= 160; i++) {
    const x = -width / 2 + (i / 160) * width;
    const y =
      height *
      (0.55 +
        0.3 * Math.sin(x * 0.045 + seed) +
        0.15 * Math.sin(x * 0.13 + seed * 2.1) +
        rough * 0.08 * Math.sin(x * 0.6 + seed * 5.3));
    shape.lineTo(x, y);
  }
  shape.lineTo(width / 2, -5);
  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color }),
  );
  mesh.position.z = z;
  scene.add(mesh);
}
ridge(-150, 30, 1, '#c99aa0', 1.3);
ridge(-100, 22, 1, '#a77d8e', 4.1);
ridge(-60, 14, 1.5, '#7f6179', 2.7);
ridge(-30, 7, 2, '#5c4660', 6.2);

// Foreground ground.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshBasicMaterial({ color: '#4a3a4f' }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Puddle stand-in: an irregular disc reflecting the sky gradient with gentle
// concentric ripples.
const puddleShape = new THREE.Shape();
for (let i = 0; i <= 64; i++) {
  const a = (i / 64) * Math.PI * 2;
  const r = 1 + 0.12 * Math.sin(3 * a + 1) + 0.07 * Math.sin(5 * a + 2);
  const x = Math.cos(a) * r * 1.6;
  const y = Math.sin(a) * r;
  if (i === 0) puddleShape.moveTo(x, y);
  else puddleShape.lineTo(x, y);
}
const puddleUniforms = { time: { value: 0 }, top: { value: skyTop }, horizon: { value: skyHorizon } };
const puddle = new THREE.Mesh(
  new THREE.ShapeGeometry(puddleShape, 64),
  new THREE.ShaderMaterial({
    uniforms: puddleUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform vec3 top, horizon;
      varying vec2 vP;
      void main() {
        float r = length(vP * vec2(0.62, 1.0));
        float ripple = sin(r * 22.0 - time * 2.2) * exp(-r * 1.6) * 0.5 + 0.5;
        vec3 col = mix(horizon, top, 0.35 + 0.25 * vP.y + 0.08 * ripple);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }),
);
puddle.rotation.x = -Math.PI / 2;
puddle.position.set(0, 0.01, 1.6);
scene.add(puddle);

document.getElementById('build')!.textContent = `build ${__COMMIT__}`;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the puddle in frame on tall phone screens
  camera.fov = w / h < 0.8 ? 60 : 45;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop((t) => {
  puddleUniforms.time.value = t / 1000;
  renderer.render(scene, camera);
});
