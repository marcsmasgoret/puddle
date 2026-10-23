// Backyard pool: the puddle is a small tiled pool set into a paver deck,
// with a fence, the corner of the house, shrubs and a lawn chair. In winter
// it becomes a steaming hot tub: warm underwater light, rising steam, jets
// bubbling up, and snow all around.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { broadleaves, rng, reflective, conifers } from '../props';

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
    const shape = new THREE.Shape();
    const hw = 0.95 + 0.12, hd = 0.62 + 0.12, cr = 0.32;
    shape.moveTo(-hw + cr, -hd);
    shape.lineTo(hw - cr, -hd); shape.quadraticCurveTo(hw, -hd, hw, -hd + cr);
    shape.lineTo(hw, hd - cr); shape.quadraticCurveTo(hw, hd, hw - cr, hd);
    shape.lineTo(-hw + cr, hd); shape.quadraticCurveTo(-hw, hd, -hw, hd - cr);
    shape.lineTo(-hw, -hd + cr); shape.quadraticCurveTo(-hw, -hd, -hw + cr, -hd);
    const hole = new THREE.Path();
    const iw = 0.95, id = 0.62, ir = 0.22;
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
    g.add(rail);
    // corner of the house on the left
    const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 6), new THREE.MeshStandardMaterial({ color: '#c8b8a4', roughness: 0.95 }));
    wall.position.set(-7.6, 2.5, -2.2);
    wall.castShadow = wall.receiveShadow = true;
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.1),
      new THREE.MeshStandardMaterial({ color: '#33414d', emissive: new THREE.Color('#ffc979'), emissiveIntensity: mood.night * 2.5 + (hot ? 0.4 : 0), roughness: 0.2 }),
    );
    win.position.set(-4.59, 1.6, -1.5);
    win.rotation.y = Math.PI / 2;
    g.add(reflective(wall), reflective(win));
    // shrubs and a tree over the fence
    g.add(broadleaves([[-3.5, -4.6, 2.2], [3.8, -4.7, 2.5], [6.5, -6.5, 7.5], [-1.5, -7.5, 8]], season, 31));
    g.add(conifers([[8.5, -6.4, 6], [-12, -8, 9], [12, -9, 10]], season, 4));
    // a lawn chair beside the pool
    const plastic = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.5 });
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), plastic);
    seat.position.y = 0.38;
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.05), plastic);
    backrest.position.set(0, 0.65, -0.24);
    backrest.rotation.x = -0.25;
    chair.add(seat, backrest);
    for (const [lx, lz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.38, 6), plastic);
      leg.position.set(lx, 0.19, lz);
      chair.add(leg);
    }
    chair.position.set(1.9, 0, -1.4);
    chair.rotation.y = -0.6;
    chair.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    g.add(reflective(chair));

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
