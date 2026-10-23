// Lions Gate, Vancouver: a rain puddle on the pebbly seawall shore at
// Stanley Park, looking across First Narrows to the Lions Gate Bridge, with
// the North Shore mountains and the twin peaks of The Lions behind.
//
// The bridge at its real proportions: main span 473 m, towers 111 m above
// the water, deck ~61 m up; drawn ~1.4 km away. Its necklace lights glow
// along the cables at night.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { ridge, hazed, openWater, conifers, rng, reflective, boulders } from '../props';

function bridge(color: THREE.Color, lightLevel: number) {
  const g = new THREE.Group();
  const green = new THREE.MeshBasicMaterial({ color, fog: false });
  const span = 473;
  const towerH = 111;
  const deckY = 61;
  // two towers: a pair of legs with cross struts
  for (const tx of [-span / 2, span / 2]) {
    for (const lz of [-7, 7]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(5, towerH, 4), green);
      leg.position.set(tx, towerH / 2, lz);
      g.add(leg);
    }
    for (const sy of [deckY + 10, towerH - 6]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 16), green);
      strut.position.set(tx, sy, 0);
      g.add(strut);
    }
  }
  // the deck, running on past the towers to each shore
  const deck = new THREE.Mesh(new THREE.BoxGeometry(span + 520, 4, 14), green);
  deck.position.y = deckY;
  g.add(deck);
  // main cables: catenaries from anchor to tower to tower to anchor
  const cable = (pts: THREE.Vector3[]) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.9, 5, false), green);
  };
  const sag = (x: number) => towerH - 4 - (towerH - deckY - 6) * (1 - Math.pow((2 * x) / span, 2));
  const lights: THREE.Vector3[] = [];
  for (const z of [-7, 7]) {
    const pts: THREE.Vector3[] = [new THREE.Vector3(-span / 2 - 240, deckY, z)];
    for (let k = 0; k <= 30; k++) {
      const x = -span / 2 + (k / 30) * span;
      pts.push(new THREE.Vector3(x, sag(x), z));
      if (z < 0 && k % 2 === 0) lights.push(new THREE.Vector3(x, sag(x), z));
    }
    pts.push(new THREE.Vector3(span / 2 + 240, deckY, z));
    g.add(cable(pts));
    // suspenders
    for (let k = 1; k < 30; k++) {
      const x = -span / 2 + (k / 30) * span;
      const h = sag(x) - deckY;
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, 0.4), green);
      s.position.set(x, deckY + h / 2, z);
      g.add(s);
    }
  }
  if (lightLevel > 0) {
    const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1c9').multiplyScalar(3 * lightLevel), fog: false });
    const bulb = new THREE.SphereGeometry(1.6, 6, 4);
    for (const p of lights) {
      const m = new THREE.Mesh(bulb, lm);
      m.position.copy(p);
      g.add(m);
    }
  }
  return g;
}

/** Peaks shaped like The Lions: two rounded granite horns on a long ridge. */
function lionsExtra(x: number) {
  const peak = (c: number, w: number, h: number) => h * Math.exp(-Math.pow((x - c) / w, 2));
  return peak(180, 40, 160) + peak(260, 35, 140);
}

const def: LocationDef = {
  id: 'lionsgate',
  shape: () => ({ kind: 'blob', seed: 13, rx: 1.0, rz: 0.6 }),
  ground: { style: 'shore', a: '#8f8b85', b: '#a39582', c: '#bfae8e', bed: '#857560', bedAccent: '#7d7a74' },
  freezes: () => true,
  build(ctx) {
    const { mood, season, waters } = ctx;
    const haze = mood.haze;
    const night = mood.night;
    const g = new THREE.Group();
    // First Narrows: open water from ~7 m out
    const sea = openWater({ w: 4000, d: 1400 }, 0.012, '#26495a', waters, { waves: 1.3 });
    sea.position.z = -7 - 700;
    g.add(sea);
    // seawall stones along the near shoreline
    const r = rng(23);
    const stones: [number, number, number, number][] = [];
    for (let k = 0; k < 5; k++) stones.push([(k - 2) * 3.4 + r() * 1.5, -5.6 - r() * 1.2, 0.25 + r() * 0.35, 40 + k]);
    g.add(boulders(stones, ctx.sdfAt, { stone: '#7e7c78', moss: '#5b6a3a', mossAmount: 0.3, snow: season === 'winter' }));
    // the bridge, ~1.4 km out, scaled to stay inside the far plane
    const bridgeCol = hazed('#3f7a5c', haze, 1400, 2400).lerp(new THREE.Color('#14261e'), night * 0.6);
    const b = bridge(bridgeCol, night);
    const s = 800 / 1400;
    b.scale.setScalar(s);
    b.position.set(-80, 0, -800);
    b.rotation.y = 0.12;
    g.add(reflective(b));
    // Stanley Park's dense forest on the left bank, rising to the bridge
    g.add(ridge({ z: -700, width: 900, base: -2, hill: 30, treeH: 14, treeDensity: 0.8, pointy: true, color: hazed('#22392b', haze, 700, 900), haze, mist: 0.4, seed: 7, x: -620 }));
    // North Shore mountains with The Lions (twin peaks) behind
    const rock = season === 'winter' ? '#e4e9ef' : '#58677a';
    // real sizes: the North Shore range (~1.2 km high, ~6 km away) and The
    // Lions (1646 m, ~12 km) subtend roughly 11° and 8°; drawn at ~1 km
    g.add(ridge({ z: -950, width: 6000, base: 10, hill: 140, color: hazed('#4c5d6d', haze, 1500, 2600), haze, mist: 0.5, seed: 12 }));
    g.add(ridge({ z: -1100, width: 6000, base: 50, hill: 120, color: hazed(rock, haze, 3000, 3800), haze, mist: 0.6, seed: 29, extra: (x) => lionsExtra(x) * 0.7 }));
    // a few shore conifers framing the view
    g.add(conifers([[-9, -5, 14], [-12, -9, 17], [10.5, -4.5, 12], [14, -8, 16]], season, 11));
    return { group: g };
  },
};
export default def;
