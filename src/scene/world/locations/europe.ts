// Beach: a tide pool on soft pale sand, the sea going from clear turquoise
// over the sand bar to deep blue, surf rolling in and sliding up the beach,
// the shore curving out to sea on the right as a sandy point lined with
// coconut palms, a couple of umbrellas, a green headland with pale cliffs on
// the left, and sailboats on the horizon. (The location id is still 'europe'
// so saved settings carry over.)
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { ridge, hazed, openWater, rng, boulders, reflective } from '../props';
import { umbrella, lounger, sailboat, duneHeight, dunes, palm, surf, stonePine } from './beachKit';

const SHORE = -10;
/** the point on the right: its shore leaves the beach at (ROOT, SHORE) heading out along SPIT */
const ROOT = 6;
const SPIT = new THREE.Vector2(0.3, -1).normalize();
const SPIT_N = new THREE.Vector2(-SPIT.y, SPIT.x); // into the land
/** signed distance onto the point's land, metres (negative: sea) */
const onSpit = (x: number, z: number) => (x - ROOT) * SPIT_N.x + (z - SHORE) * SPIT_N.y;
const isSea = (x: number, z: number) => z < SHORE && onSpit(x, z) < 0;

/** the darker, glossier band of sand the swash leaves, fading up the beach */
function wetBand(at: [number, number], angle: number, width: number) {
  const fade = new Uint8Array(32 * 4);
  for (let k = 0; k < 32; k++) fade.set([255, Math.round(255 * 0.85 * (1 - k / 31) ** 1.5), 255, 255], k * 4);
  const alpha = new THREE.DataTexture(fade, 1, 32);
  alpha.magFilter = alpha.minFilter = THREE.LinearFilter;
  alpha.needsUpdate = true;
  const geo = new THREE.PlaneGeometry(width, 3.2);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 1.4);
  const wet = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#9e8766', alphaMap: alpha, transparent: true, roughness: 0.35, depthWrite: false }));
  wet.position.set(at[0], 0.035, at[1]);
  wet.rotation.y = angle;
  wet.receiveShadow = true;
  return wet;
}

/** a headland as a height field with sand, rock and scrub by height and slope */
function headland(h: (x: number, z: number) => number, x0: number, x1: number, z0: number, z1: number, haze: THREE.Color, winter: boolean) {
  const nx = 160, nz = 90;
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < p.count; k++) p.setY(k, h(p.getX(k), p.getZ(k)) - 0.3);
  g.computeVertexNormals();
  const n = g.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const sand = new THREE.Color('#e3d3ae'), rock = new THREE.Color('#cbbfa6'), scrub = new THREE.Color(winter ? '#7d8a6a' : '#5f7d45'), pine = new THREE.Color(winter ? '#55654c' : '#3e5c33');
  const c = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
    const steep = 1 - n.getY(k);
    const patch = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2) * Math.sin(z * 0.13 + x * 0.05);
    c.copy(scrub).lerp(pine, patch * 0.7);
    if (steep > 0.35) c.copy(rock).multiplyScalar(0.9 + 0.2 * Math.sin(y * 1.7));
    if (y < 1.2) c.copy(sand);
    c.lerp(haze, 1 - Math.exp(-Math.hypot(x, z) / 420));
    c.toArray(col, k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  m.receiveShadow = true;
  return reflective(m);
}

const def: LocationDef = {
  id: 'europe',
  shape: () => ({ kind: 'blob', seed: 21, rx: 1.0, rz: 0.58, wobble: 1.0 }),
  ground: { style: 'sand', a: '#eadbb8', b: '#e0cea6', c: '#f2e6cb', bed: '#cdb894', bedAccent: '#bfae90' },
  water: isSea,
  critters: {
    mouse: { from: [-2.9, -3.0], to: [2.6, -3.3], hide: 'gap' },
    habitat: { birds: ['gulls', 'gulls', 'songbirds'], water: [-40, -14, 8, -70] },
  },
  freezes: () => false,
  build(ctx) {
    const { mood, season, waters } = ctx;
    const haze = mood.haze;
    const winter = season === 'winter';
    const g = new THREE.Group();
    const r = rng(12);
    // the sea: turquoise over the sand, deep blue past the shelf
    const light = (1 - 0.85 * mood.night) * (1 - 0.35 * mood.overcast);
    const sea = openWater({ w: 3000, d: 1200 }, 0.012, winter ? '#1f4f6a' : '#15608f', waters, {
      waves: 0.7,
      shallow: winter ? '#4f9aa0' : '#43cfc4',
      shoreZ: SHORE,
      shelf: 70,
      light,
    });
    sea.position.z = SHORE - 600;
    g.add(sea);
    // the sandy point: low beach rising into dunes behind the palms
    const sandCol = new THREE.Color(winter ? '#d9d2c2' : '#e8d8b4');
    const spitH = (x: number, z: number) => {
      const d = onSpit(x, z);
      if (z > SHORE - 0.2 || d < 0) return d < 0 ? -0.3 : 0;
      return 0.03 + 0.2 * THREE.MathUtils.smoothstep(d, 1, 10) + 1.6 * THREE.MathUtils.smoothstep(d, 10, 28) * (0.6 + 0.4 * Math.sin(x * 0.21 + z * 0.13));
    };
    g.add(dunes(spitH, ROOT - 1, 95, -70, SHORE + 0.5, sandCol, 4));
    // surf and the wet band along both stretches of shore
    const seaTint = winter ? '#5b9aa2' : '#5fd6cc';
    const spitAngle = Math.atan2(-SPIT.y, SPIT.x);
    const spitMid: [number, number] = [ROOT + SPIT.x * 60, SHORE + SPIT.y * 60];
    g.add(surf({ at: [ROOT - 300, SHORE], width: 600, sea: seaTint, period: 7.5, zone: 10 }, waters.time));
    g.add(surf({ at: spitMid, angle: spitAngle, width: 120, sea: seaTint, period: 7.5, zone: 10 }, waters.time));
    g.add(wetBand([ROOT - 300, SHORE], 0, 600), wetBand(spitMid, spitAngle, 120));
    // coconut palms along the point, leaning out over the water
    for (let k = 0; k < 18; k++) {
      const t = 6 + k * 3.4 + r() * 2;
      const inland = 1.5 + r() * 3.5;
      const x = ROOT + SPIT.x * t + SPIT_N.x * inland, z = SHORE + SPIT.y * t + SPIT_N.y * inland;
      const p = palm(7 + r() * 4.5, 0.15 + r() * 0.3, 50 + k);
      p.position.set(x, spitH(x, z) - 0.1, z);
      // lean toward the sea (the palm's lean is along its +x)
      p.rotation.y = Math.atan2(SPIT_N.y, -SPIT_N.x) + (r() - 0.5) * 0.9;
      g.add(p);
    }
    // a couple of umbrellas and loungers along the beach (empty in winter)
    if (!winter) {
      const spots: [number, number, [string, string]][] = [[3.6, -6.4, ['#2a7fc1', '#f6f1e6']], [-5.5, -7.4, ['#e94b3c', '#f6f1e6']]];
      if (season === 'summer') spots.push([12, -11, ['#f2b632', '#f6f1e6']]);
      spots.forEach(([x, z, c], k) => {
        const u = umbrella(c, k + 3);
        u.position.set(x, 0, z);
        g.add(u);
        const l = lounger(['#f08a7a', '#7cc0e0', '#f4d36b'][k % 3]);
        l.position.set(x + 0.9, 0, z + 0.9);
        l.rotation.y = Math.PI / 2 + 0.15;
        g.add(l);
      });
      // a towel and a bag by the pool
      const towel = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.01, 1.6), new THREE.MeshStandardMaterial({ color: '#e46a5a', roughness: 0.95 }));
      towel.position.set(2.5, 0.005, -2.9);
      towel.rotation.y = 0.35;
      towel.receiveShadow = true;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.012, 0.18), new THREE.MeshStandardMaterial({ color: '#f6f1e6', roughness: 0.95 }));
      stripe.position.copy(towel.position).add(new THREE.Vector3(0, 0.001, 0));
      stripe.rotation.y = 0.35;
      g.add(reflective(towel), reflective(stripe));
    }
    // the headland on the left: scrub and pines on top, pale cliffs into the sea
    const hh = duneHeight([
      [-95, -150, 38, 55, 45], [-60, -115, 18, 28, 26], [-140, -120, 30, 40, 40], [-200, -190, 55, 70, 60], [-40, -90, 6, 16, 14],
    ]);
    g.add(headland(hh, -260, -20, -260, -60, haze, winter));
    // umbrella pines dotting the headland's top
    {
      const pine = stonePine(1, 3);
      const spots: THREE.Matrix4[] = [];
      for (let k = 0; k < 400 && spots.length < 140; k++) {
        const x = -250 + r() * 185, z = -250 + r() * 150;
        const y = hh(x, z);
        if (y < 5) continue;
        const s = 5 + r() * 3;
        spots.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.6, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(s, s, s)));
      }
      const inst = new THREE.InstancedMesh(pine.geometry, pine.material, spots.length);
      spots.forEach((m, k) => inst.setMatrixAt(k, m));
      inst.frustumCulled = false;
      g.add(reflective(inst));
    }
    // islands on the horizon, the far side of the bay on the right
    g.add(ridge({ z: -900, width: 3000, base: -8, hill: 34, color: hazed('#8494a6', haze, 900, 500), haze, mist: 0.75, seed: 33, x: 500 }));
    g.add(ridge({ z: -1100, width: 1200, base: -10, hill: 22, color: hazed('#8d9bab', haze, 1100, 500), haze, mist: 0.8, seed: 7, x: -700 }));
    // a few smooth rocks near the pool and where the sand meets the sea
    g.add(boulders([[2.4, -3.7, 0.18, 9], [3.1, -3.6, 0.22, 11], [-3.6, -6.5, 0.3, 3]], ctx.sdfAt, { stone: '#b9ad97', moss: '#8a8a60', mossAmount: 0.05 }));
    // sailboats out in the bay
    const boats = [sailboat(1), sailboat(0.8)];
    boats[0].position.set(60, 0, -340);
    boats[1].position.set(-120, 0, -520);
    boats[1].rotation.y = Math.PI;
    boats.forEach((b) => g.add(b));
    return {
      group: g,
      update(t) {
        boats[0].position.x = 60 + Math.sin(t * 0.01) * 30;
        boats[1].position.x = -120 + Math.sin(t * 0.008 + 2) * 25;
        boats.forEach((b, k) => (b.rotation.z = Math.sin(t * 0.7 + k) * 0.04));
      },
    };
  },
};
export default def;
