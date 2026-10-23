// Cottage dock: a rain puddle on weathered dock planks, a Muskoka chair, a
// calm lake beyond and a far shore of pines with a little cottage.
import * as THREE from 'three';
import type { LocationDef } from '../location';
import { ridge, hazed, openWater, conifers, rng, reflective } from '../props';

const def: LocationDef = {
  id: 'dock',
  shape: () => ({ kind: 'blob', seed: 5, rx: 0.95, rz: 0.55 }),
  ground: { style: 'planks', a: '#8d6c4b', b: '#a6825c', c: '#3b2a1c', bed: '#6f5238', bedAccent: '#6f5238' },
  freezes: () => true,
  build(ctx) {
    const { mood, season, waters } = ctx;
    const haze = mood.haze;
    const g = new THREE.Group();
    // the lake all around the dock (the dock is 6 m wide, running away from us)
    const water = openWater({ w: 3000, d: 1540 }, 0.01, season === 'winter' ? '#33464f' : '#24414a', waters, {
      waves: 0.8,
      ice: season === 'winter',
      // the dock, and the rocky shore the cottage path runs along on each side
      holes: [[-3, -6, 3, 60], [-60, -9, -11, 60], [11, -7, 60, 60]],
    });
    water.position.z = 40 - 770;
    g.add(water);
    // the dock's edge and posts
    const timber = new THREE.MeshStandardMaterial({ color: '#6b513a', roughness: 0.9 });
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 0.12), timber);
    fascia.position.set(0, 0.0, -6);
    g.add(reflective(fascia));
    for (const x of [-2.9, 2.9]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 46), timber);
      side.position.set(x, 0.0, 17);
      g.add(reflective(side));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.2, 10), timber);
      post.position.set(x, -0.35, -5.95);
      g.add(reflective(post));
    }
    // a Muskoka chair, facing the water
    const chairWood = new THREE.MeshStandardMaterial({ color: season === 'autumn' ? '#b5432b' : '#2f6f7a', roughness: 0.7 });
    const chair = new THREE.Group();
    for (let k = 0; k < 6; k++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.9, 0.02), chairWood);
      slat.position.set(-0.24 + k * 0.095, 0.62 + Math.sin((k / 5) * Math.PI) * 0.08, -0.32);
      slat.rotation.x = -0.45;
      chair.add(slat);
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.55), chairWood);
    seat.position.set(0, 0.32, 0);
    seat.rotation.x = 0.15;
    chair.add(seat);
    for (const sx of [-0.36, 0.36]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.75), chairWood);
      arm.position.set(sx, 0.55, 0.0);
      chair.add(arm);
      for (const sz of [-0.25, 0.3]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.06), chairWood);
        leg.position.set(sx, 0.27, sz);
        chair.add(leg);
      }
    }
    chair.position.set(-1.7, 0, -3.4);
    chair.rotation.y = Math.PI + 0.35;
    chair.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    g.add(reflective(chair));
    // far shore: pines and a cottage
    const pine = season === 'winter' ? '#425650' : '#2b4532';
    g.add(ridge({ z: -260, width: 1600, base: -1, hill: 6, treeH: 9, treeDensity: 1.2, pointy: true, color: hazed(pine, haze, 260, 260), haze, mist: 0.35, seed: 4 }));
    g.add(ridge({ z: -600, width: 3000, base: 0, hill: 45, treeH: 4, treeDensity: 0.5, color: hazed(pine, haze, 600, 400), haze, mist: 0.5, seed: 9 }));
    const cottage = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 7), new THREE.MeshStandardMaterial({ color: '#8c4a35', roughness: 0.9 }));
    body.position.y = 2.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 3.5, 4), new THREE.MeshStandardMaterial({ color: season === 'winter' ? '#e6ebef' : '#3a3d42', roughness: 0.8 }));
    roof.position.y = 6.7;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.75);
    const lit = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf7a').multiplyScalar(0.3 + mood.night * 2) }));
    lit.position.set(-2, 2.8, 3.51);
    cottage.add(body, roof, lit);
    cottage.position.set(-60, 0, -250);
    g.add(reflective(cottage));
    // a few pines near the dock on shore to the sides
    const r = rng(12);
    const near: [number, number, number][] = [];
    for (let k = 0; k < 10; k++) near.push([(k % 2 ? 1 : -1) * (13 + r() * 12), -2 - r() * 6, 12 + r() * 8]);
    g.add(conifers(near, season, 6));
    return { group: g };
  },
};
export default def;
