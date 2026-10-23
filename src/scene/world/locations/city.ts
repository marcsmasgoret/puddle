// City street: a puddle on the asphalt by the curb, a storm drain, a
// sidewalk with streetlamps and street trees, a row of buildings behind and
// towers in the distance. Windows and lamps light up at night.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cnTower, nightLights, windowLights, ridge, hazed, rng, reflective, broadleaves } from '../props';

/** a parked car: rounded body, glasshouse, wheels, lights */
function car(color: string, night: number) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: '#1f272f', roughness: 0.1, metalness: 0.6 });
  const tyre = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.9 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(4.3, 0.75, 1.8, 3, 0.18), paint);
  body.position.y = 0.62;
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.62, 1.62, 3, 0.16), glass);
  cabin.position.set(-0.25, 1.22, 0);
  const roof = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.08, 1.5, 2, 0.04), paint);
  roof.position.set(-0.3, 1.53, 0);
  g.add(body, cabin, roof);
  for (const x of [-1.38, 1.38])
    for (const z of [-0.82, 0.82]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16), tyre);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.33, z);
      g.add(w);
    }
  const lamp = (x: number, c: string, k: number) => {
    for (const z of [-0.62, 0.62]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: c, emissive: new THREE.Color(c), emissiveIntensity: k }));
      l.position.set(x, 0.75, z);
      g.add(l);
    }
  };
  lamp(2.15, '#fff6e0', 0.2);
  lamp(-2.15, '#c0201a', 0.3 + night * 0.5);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return reflective(g);
}

/** a red fire hydrant */
function hydrant() {
  const red = new THREE.MeshStandardMaterial({ color: '#c42a1e', roughness: 0.5 });
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.55, 14), red);
  barrel.position.y = 0.28;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), red);
  cap.position.y = 0.55;
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.06, 6), red);
  nut.position.y = 0.68;
  const side = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.36, 10), red);
  side.rotation.z = Math.PI / 2;
  side.position.y = 0.38;
  g.add(barrel, cap, nut, side);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return reflective(g);
}

/** facade material: muted wall colour with a grid of windows, lit at night */
function facade(color: string, night: number, seed: number) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      THREE.UniformsLib.lights,
      { uWall: { value: new THREE.Color(color) }, uNight: { value: night }, uSeed: { value: seed } },
    ]),
    lights: true,
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vF;
      varying vec3 vN;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vF = vec2(abs(normal.x) > 0.5 ? w.z : w.x, w.y);
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      #include <lights_pars_begin>
      uniform vec3 uWall;
      uniform float uNight, uSeed;
      varying vec2 vF;
      varying vec3 vN;
      float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
      void main() {
        // each building has its own rhythm: floor height, bay width, window size
        float st = h(vec2(3.1, 7.7));
        vec2 bay = vec2(1.4 + 0.8 * st, 3.0 + 0.5 * h(vec2(1.3, 2.9)));
        float ww = 0.5 + 0.25 * h(vec2(5.5, 1.1)), wh = 0.5 + 0.15 * h(vec2(9.1, 4.4));
        vec2 cell = floor(vF / bay);
        vec2 f = fract(vF / bay);
        float x0 = 0.5 - ww / 2.0, x1 = 0.5 + ww / 2.0, y0 = 0.28, y1 = 0.28 + wh;
        float win = step(x0, f.x) * step(f.x, x1) * step(y0, f.y) * step(f.y, y1);
        // the window's reveal: a frame and a shadowed recess at the top and left
        float fr = 0.035;
        float frame = win * (1.0 - step(x0 + fr, f.x) * step(f.x, x1 - fr) * step(y0 + fr * 1.5, f.y) * step(f.y, y1 - fr * 1.5));
        float recess = win * smoothstep(y1 - 0.14, y1, f.y);
        // sill below and lintel above each window, string courses between floors
        float sill = step(x0 - 0.04, f.x) * step(f.x, x1 + 0.04) * step(y0 - 0.05, f.y) * step(f.y, y0);
        float lintel = step(x0 - 0.02, f.x) * step(f.x, x1 + 0.02) * step(y1, f.y) * step(f.y, y1 + 0.04);
        float course = step(0.97, f.y) * step(0.5, h(vec2(8.2, 0.3)));
        // shopfront level: one long window, lit warm at night
        float shop = step(0.6, vF.y) * step(vF.y, 2.9) * step(0.08, fract(vF.x / 7.0)) * step(fract(vF.x / 7.0), 0.92);
        if (vF.y < 3.5) { win = 0.0; frame = 0.0; sill = 0.0; lintel = 0.0; course = 0.0; }
        // hemisphere ambient + sun, kept simple
        vec3 light = mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, vN.y * 0.5 + 0.5);
        light += directionalLights[0].color * max(dot(vN, directionalLights[0].direction), 0.0) * 0.6;
        // brick or render: a faint running bond on most buildings
        vec2 bk = vF * vec2(4.0, 13.0);
        bk.x += step(1.0, mod(floor(bk.y), 2.0)) * 0.5;
        float brick = step(0.45, h(vec2(2.2, 6.6))) * (h(floor(bk)) - 0.5) * 0.12;
        float mortar = step(0.45, h(vec2(2.2, 6.6))) * (1.0 - step(0.06, fract(bk.y)) * step(0.04, fract(bk.x))) * 0.12;
        vec3 col = uWall * (1.0 + brick - mortar) * light;
        col = mix(col, uWall * 1.25 * light, max(max(sill, lintel), course) * 0.8);
        // glass: reflects the sky (brighter looking up), some with blinds drawn
        float blind = step(0.75, h(cell + 2.0));
        vec3 sky = mix(vec3(0.2, 0.25, 0.32), vec3(0.55, 0.65, 0.78), clamp(0.3 + 0.02 * vF.y + 0.25 * h(cell + 5.0), 0.0, 1.0));
        vec3 glass = mix(sky * light * 0.55, vec3(0.75, 0.72, 0.64) * light * 0.5, blind * 0.6);
        glass *= 1.0 - 0.35 * recess;
        col = mix(col, glass, win);
        col = mix(col, uWall * 0.55 * light, frame);
        // at night some windows glow warm: lamp-lit rooms, brighter toward
        // the ceiling, each a slightly different colour and strength
        float lit = step(0.6, h(cell)) * uNight;
        vec3 room = mix(vec3(0.62, 0.38, 0.16), vec3(0.55, 0.45, 0.3), h(cell + 7.0));
        col += (win - frame) * lit * room * (0.25 + 0.35 * h(cell + 3.0)) * (0.7 + 0.5 * f.y);
        // shopfronts: panes between mullions, a dark sill, lit from the
        // ceiling inside; about two in three are open late
        float sbay = floor(vF.x / 7.0);
        float pane = step(0.05, fract(vF.x / 1.75)) * step(fract(vF.x / 1.75), 0.95);
        float shopLit = step(0.35, h(vec2(sbay, 9.0))) * uNight;
        float ssill = smoothstep(0.6, 0.75, vF.y);
        vec3 shopGlass = mix(vec3(0.16, 0.2, 0.26), vec3(0.4, 0.46, 0.5), 0.3 + 0.3 * h(vec2(sbay, 1.0))) * light;
        col = mix(col, shopGlass * 0.8, shop);
        col = mix(col, uWall * 0.4 * light, shop * (1.0 - pane));
        vec3 shopCol = mix(vec3(0.6, 0.42, 0.22), vec3(0.5, 0.48, 0.4), h(vec2(sbay, 4.0)));
        col += shop * pane * ssill * shopLit * shopCol * (0.14 + 0.24 * smoothstep(0.6, 2.9, vF.y));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

const def: LocationDef = {
  id: 'city',
  shape: () => ({ kind: 'blob', seed: 11, rx: 1.0, rz: 0.5, wobble: 0.9 }),
  ground: { style: 'asphalt', a: '#56575b', b: '#4b4c50', c: '#e2c75a', bed: '#45464a', bedAccent: '#5a5a5c' },
  critters: {
    // out of a crack along the curb, darting along it into the storm drain
    mouse: { from: [-2.6, -4.13], to: [1.6, -4.13], hide: 'drain' },
    habitat: { birds: ['crows', 'songbirds'], trees: [[-3.2, -5.4], [8.6, -5.5], [-11, -5.3]] },
  },
  freezes: () => true,
  build(ctx) {
    const { mood, season } = ctx;
    const haze = mood.haze;
    const night = mood.night;
    const g = new THREE.Group();
    const r = rng(9);
    // the puddle sits in a wide street; the far curb and sidewalk are ~4 m back
    const curbZ = -4.2;
    const concrete = new THREE.MeshStandardMaterial({ color: season === 'winter' ? '#c9ccd0' : '#a7a49c', roughness: 0.9 });
    const curb = new THREE.Mesh(new THREE.BoxGeometry(60, 0.13, 0.18), concrete);
    curb.position.set(0, 0.065, curbZ - 0.09);
    const walk = new THREE.Mesh(new THREE.BoxGeometry(60, 0.13, 3.2), concrete);
    walk.position.set(0, 0.065, curbZ - 0.18 - 1.6);
    curb.receiveShadow = walk.receiveShadow = true;
    g.add(reflective(curb), reflective(walk));
    // storm drain grate set into the curb face (the mouse lives here)
    const grate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.04), new THREE.MeshStandardMaterial({ color: '#1d1e21', roughness: 0.6, metalness: 0.6 }));
    grate.position.set(1.6, 0.05, curbZ + 0.005);
    g.add(grate);
    // buildings
    const palette = ['#b98f74', '#8f9aa6', '#c9b79c', '#7e6e66', '#a3a9a0', '#c4a28a'];
    // a row of buildings, broken by a cross street straight ahead that
    // opens a view down to the towers
    let x = -46;
    const back = curbZ - 3.6;
    const trim = new THREE.MeshStandardMaterial({ color: '#d8d2c6', roughness: 0.8 });
    const metal = new THREE.MeshStandardMaterial({ color: '#7d8186', roughness: 0.5, metalness: 0.5 });
    const awnings = ['#2f5d50', '#8a2e2a', '#273a5c', '#5a4632', '#a0602a'];
    while (x < 46) {
      const w = 6 + r() * 9;
      if (x + w > -5.5 && x < 5.5) {
        x = 5.5;
        continue;
      }
      const h = 9 + r() * 22;
      const d = 10;
      const wall = palette[Math.floor(r() * palette.length)];
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade(wall, night, r() * 100));
      const front = back - r() * 1.5;
      b.position.set(x + w / 2, h / 2, front - d / 2);
      g.add(reflective(b));
      // a cornice along the top, and a band over the shopfronts
      const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.45, d + 0.3), trim);
      cornice.position.set(x + w / 2, h + 0.1, front - d / 2);
      const band = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 0.16), trim);
      band.position.set(x + w / 2, 3.15, front + 0.08);
      g.add(reflective(cornice), reflective(band));
      // shop awnings, tilted out over the sidewalk
      for (let ax = x + 0.5; ax + 6 < x + w; ax += 7) {
        if (r() < 0.35) continue;
        const aw = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 1.3), new THREE.MeshStandardMaterial({ color: awnings[Math.floor(r() * awnings.length)], roughness: 0.85 }));
        aw.position.set(ax + 3, 2.85, front + 0.6);
        aw.rotation.x = 0.35;
        aw.castShadow = true;
        g.add(reflective(aw));
      }
      // something on most roofs: a water tank or air-conditioning units
      if (r() < 0.45) {
        const tank = new THREE.Group();
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.0, 16), new THREE.MeshStandardMaterial({ color: '#7a5a40', roughness: 0.9 }));
        drum.position.y = 2.6;
        const top = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.8, 16), new THREE.MeshStandardMaterial({ color: '#4d4a46', roughness: 0.7 }));
        top.position.y = 4.0;
        tank.add(drum, top);
        for (const [lx, lz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), metal);
          leg.position.set(lx, 0.8, lz);
          tank.add(leg);
        }
        tank.position.set(x + w * (0.3 + 0.4 * r()), h + 0.3, front - d * 0.6);
        g.add(reflective(tank));
      } else {
        for (let k = 0; k < 2; k++) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.0), metal);
          ac.position.set(x + w * (0.25 + 0.5 * r()), h + 0.75, front - 2 - r() * 5);
          g.add(reflective(ac));
        }
      }
      x += w + 0.2;
    }
    // further down the cross street, a second row stepping back
    for (let k = 0; k < 6; k++) {
      const w = 7 + r() * 6, h = 14 + r() * 30;
      const side = k % 2 ? 1 : -1;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 12), facade(palette[Math.floor(r() * palette.length)], night, r() * 100));
      b.position.set(side * (5.5 + w / 2 + r() * 2), h / 2, back - 22 - Math.floor(k / 2) * 18);
      g.add(reflective(b));
    }
    // towers in the distance
    g.add(
      ridge({
        z: -260, width: 900, base: 0, hill: 4, color: hazed('#5b6476', haze, 260, 260).lerp(new THREE.Color('#202838'), night * 0.6), haze, mist: 0.3, seed: 4,
        extra: (xx) => {
          const k = Math.floor((xx + 450) / 22);
          const rr = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1;
          return rr > 0.35 ? 20 + rr * 90 : 0;
        },
      }),
    );
    // downtown at night: lit windows across the distant towers
    if (night > 0) {
      const rects: [number, number, number, number, number][] = [];
      for (let k = 0; k < 900 / 22; k++) {
        const rr = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1;
        if (rr <= 0.35) continue;
        const x = k * 22 - 450;
        rects.push([x + 2, x + 20, 3, 20 + rr * 90 - 2, -257]);
      }
      g.add(nightLights(windowLights(rects, 3.6, 0.32, 11), night, { size: 1.8, gain: 1.1 }));
    }
    // and the CN Tower, ~3 km off at the end of the cross street (drawn at
    // 900 m and scaled so it subtends the true angle)
    {
      const cnMat = new THREE.MeshBasicMaterial({ color: hazed('#6b7484', haze, 3000, 4000).lerp(new THREE.Color('#1b2233'), night * 0.7), fog: false });
      const cnGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb070').multiplyScalar(0.2 + night * 2), fog: false });
      const cn = cnTower(cnMat, cnGlow, night);
      cn.scale.setScalar(900 / 3000);
      cn.position.set(40, 0, -900);
      g.add(reflective(cn));
    }
    // streetlamps along the sidewalk
    const pole = new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.5, metalness: 0.4 });
    const bulb = new THREE.MeshStandardMaterial({ color: '#fff2d0', emissive: new THREE.Color('#ffd28a'), emissiveIntensity: night * 6 + 0.2 });
    for (const lx of [-7.5, 4.5, 14]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 5, 8), pole);
      p.position.set(lx, 2.5, curbZ - 0.6);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.08), pole);
      arm.position.set(lx + 0.4, 4.95, curbZ - 0.6);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8), bulb);
      head.position.set(lx + 0.85, 4.85, curbZ - 0.6);
      p.castShadow = true;
      g.add(reflective(p), reflective(arm), reflective(head));
      if (night > 0.5) {
        const light = new THREE.PointLight('#ffcf8a', 14, 14, 1.6);
        light.position.copy(head.position);
        g.add(light);
      }
    }
    // parked cars along the far curb, a hydrant on the sidewalk
    const paints = ['#9aa3ab', '#2a3440', '#7a1f22', '#e8e6e0', '#33503f'];
    for (const [cx, k] of [[-5.3, 0], [5.4, 2], [12.5, 3]] as [number, number][]) {
      const c = car(paints[k], night);
      c.position.set(cx, 0, curbZ + 1.05);
      c.rotation.y = k % 2 ? 0 : Math.PI;
      g.add(c);
    }
    const hy = hydrant();
    hy.position.set(2.7, 0.13, curbZ - 0.55);
    g.add(hy);
    // street trees in pits
    g.add(broadleaves([[-3.2, curbZ - 1.2, 5.5], [8.6, curbZ - 1.3, 5.8], [-11, curbZ - 1.1, 5.2]], season, 21));
    return { group: g };
  },
};
export default def;
