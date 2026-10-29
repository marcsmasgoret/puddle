// Prince Edward Island: a tide pool on the north shore's red sand, iron-rich
// and rust-coloured; dunes held together by marram grass and dune fencing;
// red sandstone cliffs capped with turf curving away to the right, a white
// lighthouse with a red lantern on the point (its beam sweeps the bay at
// night); the green-blue Gulf of St. Lawrence rolling in.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { ridge, hazed, openWater, rng, reflective, boulders } from '../props';
import { duneHeight, dunes, marram, duneFence, cliffLine, seaStack, lighthouse2, surf } from './beachKit';

const def: LocationDef = {
  id: 'beach',
  shape: () => ({ kind: 'blob', seed: 3, rx: 1.0, rz: 0.6, wobble: 1.2 }),
  ground: { style: 'sand', a: '#b8603f', b: '#a65236', c: '#c97a56', bed: '#8e4a33', bedAccent: '#9a6a52' },
  water: (_x, z) => z < -9,
  critters: {
    mouse: { from: [-2.8, -3.1], to: [2.7, -2.8], hide: 'grass' },
    habitat: { birds: ['gulls', 'gulls', 'songbirds'], water: [-40, -12, 40, -70] },
  },
  freezes: () => true,
  build(ctx) {
    const { mood, season, waters } = ctx;
    const haze = mood.haze;
    const night = mood.night;
    const winter = season === 'winter';
    const g = new THREE.Group();
    // the Gulf, starting ~9 m out: green-brown shallows over the red sand,
    // blue-green beyond
    const sea = openWater({ w: 3000, d: 1200 }, 0.012, winter ? '#2d4a55' : '#2a6670', waters, {
      waves: 1.4,
      shallow: winter ? '#5a6e6c' : '#6c8a72',
      shoreZ: -9,
      shelf: 45,
      light: (1 - 0.85 * mood.night) * (1 - 0.3 * mood.overcast),
    });
    sea.position.z = -9 - 600;
    g.add(sea);
    g.add(surf({ at: [-140, -9], width: 300, sea: winter ? '#7f9694' : '#8fae9a', period: 6, zone: 12 }, waters.time));
    // wet, darker red sand where the swash runs up, fading up the beach
    {
      const fade = new Uint8Array(32 * 4);
      for (let k = 0; k < 32; k++) fade.set([255, Math.round(255 * 0.9 * (1 - k / 31) ** 1.4), 255, 255], k * 4);
      const alpha = new THREE.DataTexture(fade, 1, 32);
      alpha.magFilter = alpha.minFilter = THREE.LinearFilter;
      alpha.needsUpdate = true;
      // damp, not glassy: a low sun should not mirror off it like the sea
      const swash = new THREE.Mesh(new THREE.PlaneGeometry(300, 3), new THREE.MeshStandardMaterial({ color: winter ? '#8a7a74' : '#7c3b26', alphaMap: alpha, roughness: 0.75, transparent: true, depthWrite: false }));
      swash.rotation.x = -Math.PI / 2;
      swash.position.set(-140, 0.006, -7.6);
      g.add(swash);
    }
    // dunes to either side and behind the puddle's flanks
    // the shore curves away to the left: a line of dunes running off into
    // the distance along it, growing taller
    const h = duneHeight([
      [-6.5, -1.5, 1.0, 2.2, 1.4], [-9, -5.5, 2.0, 3, 2], [-13, -10.5, 2.8, 3.8, 2.8],
      [-18, -16, 3.4, 4.5, 3.4], [-24, -23, 4, 5.5, 4], [-31, -31, 4.5, 6, 5], [-39, -40, 5, 7, 6],
    ]);
    const sand = new THREE.Color(winter ? '#e4e3e6' : '#c47252');
    g.add(dunes(h, -52, -4, -52, 3, sand, 8));
    // marram grass on the dune crests and lee slopes
    const r = rng(5);
    const tufts: [number, number, number, number][] = [];
    for (let k = 0; k < 900; k++) {
      const x = -4.5 - r() * 42;
      const z = -48 + r() * 50;
      const y = h(x, z);
      if (y < 0.35 || r() > Math.min(1, y / 1.5)) continue;
      tufts.push([x, y - 0.03, z, 0.45 + r() * 0.35]);
    }
    const grassCol = season === 'autumn' ? '#b99a5a' : winter ? '#b3a98a' : '#8a9a52';
    g.add(marram(tufts, grassCol, 7));
    // dune fences leaning in the sand
    g.add(duneFence(-9.5, -2.5, -15, -8.5, h));
    // red sandstone cliffs running away on the right, rising out of the
    // beach as a grassy bank and climbing toward the point, with a sea
    // stack or two and fallen blocks at their foot
    const rock = winter ? '#9a5a48' : '#a8492e';
    const cliffAt = (z: number) => 10 + 0.42 * -z + 3 * Math.sin(z * 0.03);
    const pts: [number, number][] = [];
    for (let z = -5; z >= -235; z -= 10) pts.push([cliffAt(z), z]);
    const heightAt = (t: number) => {
      // the first ~20 m climbs from the sand, so the clifftop land meets the
      // beach instead of ending in mid-air
      const rise = THREE.MathUtils.smoothstep(t, 0, 0.09);
      return 0.15 + rise * (3.35 + 9.5 * Math.min(1, t * 1.3) + 1.2 * Math.sin(t * 17));
    };
    g.add(cliffLine({ points: pts, height: heightAt, rock, band: '#c9673f', pale: '#d9a27a', grass: winter ? '#e8ecef' : '#6f8a3c', seed: 3 }));
    for (const [z, h, w, k] of [[-88, 5.5, 2.6, 1], [-150, 8, 3.6, 2], [-158, 4, 2.2, 3]]) {
      const st = seaStack(h, w, rock, '#c9673f', winter ? '#e8ecef' : '#6f8a3c', k);
      st.position.set(cliffAt(z) - 6 - k * 3, 0, z);
      g.add(st);
    }
    const blocks: [number, number, number, number][] = [];
    for (let z = -14; z > -120; z -= 4 + r() * 5) blocks.push([cliffAt(z) - 1.5 - r() * 2.5, z, 0.4 + r() * 0.9, Math.floor(r() * 100)]);
    g.add(boulders(blocks, ctx.sdfAt, { stone: winter ? '#8f6656' : '#9a4a33', moss: '#5a4a32', mossAmount: 0.1 }));
    // the lighthouse out on the point, on the clifftop
    const lh = lighthouse2(11, night);
    lh.group.position.set(cliffAt(-185) + 9, heightAt(185 / 230), -185);
    g.add(lh.group);
    // the shore curving away on the left: a low headland of dunes and
    // spruce, far off in the haze
    g.add(ridge({ z: -420, width: 900, base: -2, hill: 14, treeH: 6, treeDensity: 0.25, pointy: true, color: hazed(winter ? '#b9b3ad' : '#6d6a4a', haze, 420, 380), haze, mist: 0.5, seed: 23, x: -620 }));
    // the far shore: low farmland across the bay
    g.add(ridge({ z: -700, width: 2400, base: -6, hill: 30, color: hazed(winter ? '#c9d0d6' : '#5f7a4a', haze, 700, 500), haze, mist: 0.6, seed: 17, x: -400 }));
    // a couple of bleached driftwood logs
    const wood = new THREE.MeshStandardMaterial({ color: '#b2a897', roughness: 0.9 });
    for (const [x, z, l, a] of [[1.9, -1.3, 1.4, 0.4], [-2.6, -2.2, 0.9, -0.8]]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, l, 10), wood);
      log.rotation.set(0, a, Math.PI / 2);
      log.position.set(x, 0.05, z);
      log.castShadow = true;
      g.add(reflective(log));
    }
    return { group: g, update: (t) => lh.update(t) };
  },
};
export default def;
