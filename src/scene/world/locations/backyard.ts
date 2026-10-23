// Backyard pool: the puddle is a small tiled pool set into a paver deck,
// with a cedar fence and a hedge along it, string lights, the corner of the
// house in lap siding, a patio umbrella and table, loungers, potted plants,
// a pool ladder and trees over the fence. In winter it becomes a steaming
// hot tub: warm underwater light, rising steam, jets bubbling up, and snow
// all around.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { broadleaves, rng, reflective, conifers, tint } from '../props';

/** painted lap siding: horizontal boards with a shadow line under each */
function siding(color: string) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSidingW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSidingW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSidingW;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float board = fract(vSidingW.y / 0.18);
        diffuseColor.rgb *= 0.82 + 0.18 * smoothstep(0.0, 0.25, board);`,
      );
  };
  m.customProgramCacheKey = () => 'siding';
  return m;
}

const def: LocationDef = {
  id: 'backyard',
  shape: () => ({ kind: 'roundRect', hw: 0.95, hd: 0.62, r: 0.22 }),
  ground: { style: 'tile', a: '#d8cfbf', b: '#d0c6b4', c: '#b0a593', bed: '#3f9cc4', bedAccent: '#e3f0f4' },
  critters: {
    // along the bottom of the fence and out through a gap under it
    mouse: { from: [-3.0, -5.08], to: [2.1, -5.08], hide: 'gap' },
    habitat: { birds: ['songbirds', 'crows'], trees: [[-3.5, -4.6], [3.8, -4.7], [6.5, -6.5]], rabbits: [-5, -4.8, 5, -2.2] },
  },
  freezes: () => false,
  hotTub: (s) => s === 'winter',
  build(ctx) {
    const { season, mood } = ctx;
    const hot = season === 'winter';
    const g = new THREE.Group();
    const r = rng(31);
    // coping stones around the pool edge
    const coping = new THREE.MeshStandardMaterial({ color: '#e6ddcc', roughness: 0.8 });
    // the pool grows with the puddle size setting
    const S = ctx.halfX / 0.95;
    const shape = new THREE.Shape();
    const hw = 0.95 * S + 0.12, hd = 0.62 * S + 0.12, cr = 0.22 * S + 0.1;
    shape.moveTo(-hw + cr, -hd);
    shape.lineTo(hw - cr, -hd); shape.quadraticCurveTo(hw, -hd, hw, -hd + cr);
    shape.lineTo(hw, hd - cr); shape.quadraticCurveTo(hw, hd, hw - cr, hd);
    shape.lineTo(-hw + cr, hd); shape.quadraticCurveTo(-hw, hd, -hw, hd - cr);
    shape.lineTo(-hw, -hd + cr); shape.quadraticCurveTo(-hw, -hd, -hw + cr, -hd);
    const hole = new THREE.Path();
    const iw = 0.95 * S, id = 0.62 * S, ir = 0.22 * S;
    hole.moveTo(-iw + ir, -id);
    hole.lineTo(iw - ir, -id); hole.quadraticCurveTo(iw, -id, iw, -id + ir);
    hole.lineTo(iw, id - ir); hole.quadraticCurveTo(iw, id, iw - ir, id);
    hole.lineTo(-iw + ir, id); hole.quadraticCurveTo(-iw, id, -iw, id - ir);
    hole.lineTo(-iw, -id + ir); hole.quadraticCurveTo(-iw, -id, -iw + ir, -id);
    shape.holes.push(hole);
    const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 }), coping);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.0;
    rim.receiveShadow = rim.castShadow = true;
    g.add(reflective(rim));
    // fence across the back
    const wood = new THREE.MeshStandardMaterial({ color: hot ? '#8a7a68' : '#a0846a', roughness: 0.9 });
    for (let x = -14; x < 14; x += 0.16) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.85 + (r() - 0.5) * 0.03, 0.025), wood);
      board.position.set(x, 0.92, -5.2);
      g.add(reflective(board));
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(28, 0.08, 0.05), wood);
    rail.position.set(0, 1.6, -5.17);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(28, 0.04, 0.12), wood);
    cap.position.set(0, 1.86, -5.2);
    g.add(rail, reflective(cap));
    for (let x = -12; x <= 12; x += 2.4) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.95, 0.1), wood);
      post.position.set(x, 0.97, -5.15);
      post.castShadow = true;
      g.add(reflective(post));
    }
    // a clipped hedge along the foot of the fence (bare and grey in winter),
    // with a gap where the mouse gets under
    {
      const parts: THREE.BufferGeometry[] = [];
      const leaf = hot ? '#6d6a5c' : season === 'autumn' ? '#7d7a3a' : '#3f6a34';
      for (let x = -11; x < 11; x += 0.45) {
        if (x > -3.4 && x < 2.6) continue;
        let b: THREE.BufferGeometry = new THREE.IcosahedronGeometry(0.42 + r() * 0.12, 1);
        b.scale(1.2, 1.0 + r() * 0.3, 0.8);
        b.translate(x, 0.45, -4.75);
        b = tint(b, new THREE.Color(leaf).multiplyScalar(0.85 + 0.3 * r()));
        parts.push(b);
      }
      const hedge = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
      hedge.castShadow = hedge.receiveShadow = true;
      g.add(reflective(hedge));
    }
    // string lights swagged along the fence top, glowing in the evening
    {
      const wire: number[] = [];
      const sag = (x: number) => 2.25 - 0.35 * Math.sin(Math.PI * (((x + 9) % 3) / 3));
      for (let x = -9; x < 9; x += 0.05) wire.push(x, sag(x), -5.05);
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
      g.add(new THREE.Line(wg, new THREE.LineBasicMaterial({ color: '#2a2a2a' })));
      const glow = Math.max(mood.night, mood.sunElevation < 0.12 ? 0.5 : 0);
      const bm = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: new THREE.Color('#ffc46b'), emissiveIntensity: 0.2 + glow * 5 });
      const bulb = new THREE.SphereGeometry(0.035, 8, 6);
      for (let x = -8.7; x < 9; x += 0.6) {
        const b = new THREE.Mesh(bulb, bm);
        b.position.set(x, sag(x) - 0.05, -5.05);
        g.add(b);
      }
    }
    // corner of the house on the left
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 6), siding(hot ? '#bfb4a6' : '#c8b8a4'));
    wall.position.set(-7.6, 2.5, -2.2);
    wall.castShadow = wall.receiveShadow = true;
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.1),
      new THREE.MeshStandardMaterial({ color: '#33414d', emissive: new THREE.Color('#ffc979'), emissiveIntensity: mood.night * 2.5 + (hot ? 0.4 : 0), roughness: 0.2 }),
    );
    win.position.set(-4.59, 1.6, -1.5);
    win.rotation.y = Math.PI / 2;
    g.add(reflective(wall), reflective(win));
    // window trim and muntin, the back door, the eaves
    const white = new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.6 });
    for (const [w, h, y, z] of [[1.6, 0.08, 2.19, -1.5], [1.7, 0.1, 1.0, -1.5], [0.08, 1.2, 1.6, -2.24], [0.08, 1.2, 1.6, -0.76], [0.05, 1.1, 1.6, -1.5]]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, w), white);
      t.position.set(-4.57, y, z);
      g.add(reflective(t));
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.05, 0.95), new THREE.MeshStandardMaterial({ color: '#3c5a6e', roughness: 0.6 }));
    door.position.set(-4.58, 1.03, 0.4);
    const eave = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 6.4), white);
    eave.position.set(-4.4, 5.0, -2.2);
    g.add(reflective(door), reflective(eave));
    // shrubs and a tree over the fence
    g.add(broadleaves([[-3.5, -4.6, 2.2], [3.8, -4.7, 2.5], [6.5, -6.5, 7.5], [-1.5, -7.5, 8]], season, 31));
    g.add(conifers([[8.5, -6.4, 6], [-12, -8, 9], [12, -9, 10]], season, 4));
    // loungers, a patio table under an umbrella, potted plants and the
    // pool ladder
    if (!hot) {
      const frame = new THREE.MeshStandardMaterial({ color: '#efece6', roughness: 0.5 });
      const cushion = new THREE.MeshStandardMaterial({ color: '#2f6f8a', roughness: 0.9 });
      for (const [lx, lz, a] of [[2.9, -3.3, -1.25], [4.1, -2.9, -1.4]]) {
        const l = new THREE.Group();
        const bed = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.08, 0.66, 2, 0.03), frame);
        bed.position.y = 0.32;
        const pad = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.07, 0.6, 2, 0.03), cushion);
        pad.position.set(0.3, 0.39, 0);
        const back = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.07, 0.6, 2, 0.03), cushion);
        back.position.set(-0.72, 0.58, 0);
        back.rotation.z = -0.7;
        l.add(bed, pad, back);
        for (const x of [-0.85, 0.85])
          for (const z of [-0.28, 0.28]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), frame);
            leg.position.set(x, 0.15, z);
            l.add(leg);
          }
        l.position.set(lx, 0, lz);
        l.rotation.y = a;
        l.traverse((o) => ((o as THREE.Mesh).castShadow = true));
        g.add(reflective(l));
      }
    }
    {
      const patio = new THREE.Group();
      const iron = new THREE.MeshStandardMaterial({ color: '#2d2f31', roughness: 0.5, metalness: 0.4 });
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.03, 24), new THREE.MeshStandardMaterial({ color: '#dfe3e2', roughness: 0.15, metalness: 0.1 }));
      top.position.y = 0.72;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8), iron);
      stem.position.y = 1.2;
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.45, 8, 1, true), new THREE.MeshStandardMaterial({ color: hot ? '#7d766c' : '#e9e1cc', roughness: 0.9, side: THREE.DoubleSide, flatShading: true }));
      canopy.position.y = 2.35;
      patio.add(top, stem, canopy);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.74, 6), iron);
        leg.position.set(Math.cos(a) * 0.35, 0.37, Math.sin(a) * 0.35);
        leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
        patio.add(leg);
      }
      patio.position.set(-3.1, 0, -3.5);
      patio.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      g.add(reflective(patio));
    }
    for (const [px, pz, k] of [[-3.6, -4.1, 1], [3.1, -4.2, 0.8], [-1.9, -4.3, 0.65]]) {
      const pot = new THREE.Group();
      const clay = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * k, 0.17 * k, 0.42 * k, 16), new THREE.MeshStandardMaterial({ color: '#b5643c', roughness: 0.9 }));
      clay.position.y = 0.21 * k;
      pot.add(clay);
      const leaves = new THREE.MeshStandardMaterial({ color: hot ? '#5e5a4e' : '#4c7a3a', roughness: 0.85, flatShading: true });
      for (let n = 0; n < 7; n++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 * k, 1), leaves);
        b.position.set((r() - 0.5) * 0.3 * k, (0.5 + r() * 0.35) * k, (r() - 0.5) * 0.3 * k);
        pot.add(b);
      }
      pot.position.set(px, 0, pz);
      pot.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      g.add(reflective(pot));
    }
    {
      const steel = new THREE.MeshStandardMaterial({ color: '#d7dbe0', roughness: 0.2, metalness: 0.9 });
      const ladder = new THREE.Group();
      for (const dz of [-0.22, 0.22]) {
        const pts = [new THREE.Vector3(0.16, -0.25, dz), new THREE.Vector3(0.12, 0.25, dz), new THREE.Vector3(-0.05, 0.42, dz), new THREE.Vector3(-0.22, 0.3, dz), new THREE.Vector3(-0.24, 0.02, dz)];
        ladder.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.02, 8), steel));
      }
      for (const y of [-0.15, 0.05]) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.44), steel);
        step.position.set(0.15, y, 0);
        ladder.add(step);
      }
      // hanging into the pool from its far edge
      ladder.position.set(0.4 * S, 0, -0.62 * S + 0.02);
      ladder.rotation.y = -Math.PI / 2;
      ladder.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      g.add(ladder);
    }

    // hot tub extras: a warm glow in the water and rising steam
    let update: ((t: number, dt: number) => void) | undefined;
    if (hot) {
      const glow = new THREE.PointLight('#7fd6ff', 1.2 + mood.night * 3, 3, 1.5);
      glow.position.set(0, -0.01, 0);
      g.add(glow);
      const steam = new Steam(ctx.halfX * 0.9, ctx.halfZ * 0.9, 0.35 + mood.night * 0.25);
      g.add(steam.points);
      update = (t, dt) => steam.update(t, dt);
    }
    return { group: g, update };
  },
};

/** Steam: soft white puffs rising off warm water, drifting and fading. */
class Steam {
  points: THREE.Points;
  private n = 70;
  private pos: Float32Array;
  private life: Float32Array;
  constructor(private hx: number, private hz: number, opacity: number) {
    this.pos = new Float32Array(this.n * 3);
    this.life = new Float32Array(this.n);
    for (let k = 0; k < this.n; k++) this.respawn(k, Math.random());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uOpacity: { value: opacity } },
      vertexShader: /* glsl */ `
        attribute float aLife;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (40.0 + 140.0 * aLife) / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vLife;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * sin(vLife * 3.14159) * uOpacity;
          gl_FragColor = vec4(vec3(0.95), a * 0.35);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }
  private respawn(k: number, life = 0) {
    this.pos[k * 3] = (Math.random() * 2 - 1) * this.hx;
    this.pos[k * 3 + 1] = 0.01;
    this.pos[k * 3 + 2] = (Math.random() * 2 - 1) * this.hz;
    this.life[k] = life;
  }
  update(t: number, dt: number) {
    for (let k = 0; k < this.n; k++) {
      this.life[k] += dt / 4.5;
      if (this.life[k] >= 1) this.respawn(k);
      this.pos[k * 3 + 1] += dt * 0.12;
      this.pos[k * 3] += Math.sin(t * 0.7 + k) * dt * 0.05;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.aLife.needsUpdate = true;
  }
}
export default def;
