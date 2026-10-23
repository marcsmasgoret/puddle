// City street: a puddle on the asphalt by the curb, a storm drain, a
// sidewalk with streetlamps and street trees, a row of buildings behind and
// towers in the distance. Windows and lamps light up at night.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { ridge, hazed, rng, reflective, broadleaves } from '../props';

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
        vec2 cell = floor(vF / vec2(1.6, 3.0));
        vec2 f = fract(vF / vec2(1.6, 3.0));
        float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.8);
        // shopfront level: one long window, lit warm at night
        float shop = step(0.6, vF.y) * step(vF.y, 2.9) * step(0.08, fract(vF.x / 7.0)) * step(fract(vF.x / 7.0), 0.92);
        if (vF.y < 3.5) win = 0.0;
        // hemisphere ambient + sun, kept simple
        vec3 light = mix(hemisphereLights[0].groundColor, hemisphereLights[0].skyColor, vN.y * 0.5 + 0.5);
        light += directionalLights[0].color * max(dot(vN, directionalLights[0].direction), 0.0) * 0.6;
        vec3 col = uWall * light;
        vec3 glass = mix(vec3(0.16, 0.2, 0.26), vec3(0.45, 0.55, 0.65), 0.3) * light;
        col = mix(col, glass, win);
        // at night some windows glow warm
        float lit = step(0.6, h(cell)) * uNight;
        col += win * lit * vec3(0.9, 0.62, 0.32) * (0.6 + 0.6 * h(cell + 3.0));
        col = mix(col, glass, shop * 0.8);
        col += shop * uNight * vec3(0.8, 0.6, 0.38) * step(0.3, h(vec2(floor(vF.x / 7.0), 9.0)));
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

const def: LocationDef = {
  id: 'city',
  shape: () => ({ kind: 'blob', seed: 11, rx: 1.0, rz: 0.5, wobble: 0.9 }),
  ground: { style: 'asphalt', a: '#56575b', b: '#4b4c50', c: '#e2c75a', bed: '#45464a', bedAccent: '#5a5a5c' },
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
    while (x < 46) {
      const w = 6 + r() * 9;
      if (x + w > -5.5 && x < 5.5) {
        x = 5.5;
        continue;
      }
      const h = 9 + r() * 22;
      const d = 10;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facade(palette[Math.floor(r() * palette.length)], night, r() * 100));
      b.position.set(x + w / 2, h / 2, back - d / 2 - r() * 1.5);
      g.add(reflective(b));
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
    // street trees in pits
    g.add(broadleaves([[-3.2, curbZ - 1.2, 5.5], [8.6, curbZ - 1.3, 5.8], [-11, curbZ - 1.1, 5.2]], season, 21));
    return { group: g };
  },
};
export default def;
