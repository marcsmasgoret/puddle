// Visual models for the floating toys, built from simple shapes so they match
// the clean art style. Model space matches physics/toyBodies.ts; each model is
// offset so its origin is the centre of mass.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DUCK, PAPER, SAIL, BOBBER, DONUT, type ToyKind } from '../physics/toyBodies';
import { LAYER_REFLECT } from '../render/pipeline';

function tinted(g: THREE.BufferGeometry, color: string) {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) c.toArray(a, k * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}

function duck() {
  const { body, head } = DUCK;
  const b = new THREE.SphereGeometry(1, 40, 28);
  b.scale(body.r.x, body.r.y, body.r.z);
  // tail: lift the back of the body into a little upturned point
  const pos = b.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), y = pos.getY(k);
    if (x < -0.02) pos.setY(k, y + Math.pow((-x - 0.02) / 0.025, 2) * 0.018 * (y > -0.005 ? 1 : 0.4));
  }
  b.translate(body.c.x, body.c.y, body.c.z);
  // flat base
  for (let k = 0; k < pos.count; k++) if (pos.getY(k) < DUCK.base) pos.setY(k, DUCK.base);
  b.computeVertexNormals();
  const h = new THREE.SphereGeometry(head.r, 32, 24);
  h.translate(head.c.x, head.c.y, head.c.z);
  const beak = new THREE.SphereGeometry(1, 20, 12);
  beak.scale(0.016, 0.006, 0.012);
  beak.translate(head.c.x + 0.022, head.c.y - 0.004, 0);
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.SphereGeometry(0.0035, 12, 8);
    e.translate(head.c.x + 0.015, head.c.y + 0.007, s * 0.013);
    return tinted(e, '#1b1b1f');
  });
  const geo = mergeGeometries([tinted(b, '#ffcf2e'), tinted(h, '#ffd43a'), tinted(beak, '#ff8a1f'), ...eyes]);
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  return { geo, mat, com: DUCK.com };
}

function paperBoat() {
  const { length: L, keel: K, width: W, hull: Hh } = PAPER;
  // folded hull: a V-shaped trough with raked ends, plus the centre sail fold
  const v: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => v.push(...a, ...b, ...c);
  const kb = [-K / 2, 0, 0], kf = [K / 2, 0, 0];
  const tb = [-L / 2, Hh, 0], tf = [L / 2, Hh, 0];
  const b0 = W * 0.3; // half-width of the flat folded base
  for (const s of [-1, 1]) {
    const lb = [-L / 2 + 0.012, Hh, s * W / 2], lf = [L / 2 - 0.012, Hh, s * W / 2];
    const bb = [-K / 2, 0, s * b0], bf = [K / 2, 0, s * b0];
    tri(kb, kf, bf); tri(kb, bf, bb);
    tri(bb, bf, lf); tri(bb, lf, lb);
    tri(kb, bb, tb); tri(bb, lb, tb);
    tri(kf, tf, bf); tri(bf, tf, lf);
    // sail fold: a tall triangle in the middle
    tri([-0.032, Hh, s * 0.004], [0.032, Hh, s * 0.004], [0, Hh + 0.038, 0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  const geo = tinted(g, '#f6f3ec');
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  return { geo, mat, com: PAPER.com };
}

function sailboat() {
  const { hull, mast } = SAIL;
  const h = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  h.scale(hull.r.x, hull.r.y, hull.r.z);
  // sharpen the bow a little
  const p = h.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k);
    if (x > 0) p.setZ(k, p.getZ(k) * (1 - 0.45 * Math.pow(x / hull.r.x, 2)));
  }
  h.translate(hull.c.x, hull.c.y, hull.c.z);
  h.computeVertexNormals();
  const deck = new THREE.CircleGeometry(1, 40);
  deck.rotateX(-Math.PI / 2);
  deck.scale(hull.r.x, 1, hull.r.z);
  const dp = deck.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < dp.count; k++) {
    const x = dp.getX(k);
    if (x > 0) dp.setZ(k, dp.getZ(k) * (1 - 0.45 * Math.pow(x / hull.r.x, 2)));
  }
  deck.translate(hull.c.x, hull.c.y, hull.c.z);
  const stripe = new THREE.TorusGeometry(1, 0.06, 6, 48);
  stripe.rotateX(Math.PI / 2);
  stripe.scale(hull.r.x * 0.995, 0.08, hull.r.z * 0.995);
  stripe.translate(hull.c.x, hull.c.y - 0.004, hull.c.z);
  const m = new THREE.CylinderGeometry(0.0025, 0.003, mast, 8);
  m.translate(0.008, hull.c.y + mast / 2, 0);
  const sailV = new THREE.BufferGeometry();
  sailV.setAttribute('position', new THREE.Float32BufferAttribute([0.006, hull.c.y + 0.02, 0, 0.006, hull.c.y + mast - 0.01, 0, -0.07, hull.c.y + 0.02, 0], 3));
  sailV.computeVertexNormals();
  const jib = new THREE.BufferGeometry();
  jib.setAttribute('position', new THREE.Float32BufferAttribute([0.011, hull.c.y + 0.025, 0, 0.011, hull.c.y + mast - 0.04, 0, 0.07, hull.c.y + 0.02, 0], 3));
  jib.computeVertexNormals();
  const geo = mergeGeometries([
    tinted(h, '#2f5577'),
    tinted(deck, '#d8b98c'),
    tinted(stripe, '#f2efe6'),
    tinted(m, '#a27b52'),
    tinted(sailV, '#f4efe2'),
    tinted(jib, '#e9846a'),
  ]);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide });
  return { geo, mat, com: SAIL.com };
}

function bobber() {
  const { r } = BOBBER;
  const top = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const bottom = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const band = new THREE.CylinderGeometry(r * 1.01, r * 1.01, r * 0.18, 24, 1, true);
  const stick = new THREE.CylinderGeometry(0.0012, 0.0016, 0.022, 8);
  stick.translate(0, r + 0.009, 0);
  const geo = mergeGeometries([tinted(top, '#e8392f'), tinted(bottom, '#f4f1ea'), tinted(band, '#1f1f24'), tinted(stick, '#e8392f')]);
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.8 });
  return { geo, mat, com: BOBBER.com };
}

/** Inflatable beach donut: pink icing with a scalloped drip edge, sprinkles. */
function donut() {
  const { R, r } = DONUT;
  const t = new THREE.TorusGeometry(R, r, 28, 72);
  t.rotateX(Math.PI / 2);
  t.translate(0, r, 0);
  const pos = t.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const icing = new THREE.Color('#f58fb4'), dough = new THREE.Color('#e7b679'), c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
    const ang = Math.atan2(z, x);
    // the icing covers the top and drips over the sides in soft scallops
    const edge = r * (0.75 + 0.35 * Math.sin(ang * 9) + 0.15 * Math.sin(ang * 23 + 1.3));
    c.copy(y > edge ? icing : dough);
    c.toArray(col, k * 3);
  }
  t.setAttribute('color', new THREE.BufferAttribute(col, 3));
  t.deleteAttribute('uv');
  const parts: THREE.BufferGeometry[] = [t.toNonIndexed()];
  const sprinkleCols = ['#ffffff', '#7fd3f2', '#ffe066', '#9be38b', '#c79bf2', '#ff6f61'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 46; k++) {
    const a = rnd() * Math.PI * 2;
    const phi = (rnd() - 0.5) * 1.6; // around the top of the tube
    const ring = R + Math.sin(phi) * r;
    const s = new THREE.CapsuleGeometry(0.0013, 0.0065, 2, 6);
    s.rotateZ(Math.PI / 2);
    s.rotateY(rnd() * Math.PI);
    s.translate(Math.cos(a) * ring, r + Math.cos(phi) * r + 0.0008, Math.sin(a) * ring);
    parts.push(tinted(s, sprinkleCols[k % sprinkleCols.length]));
  }
  const geo = mergeGeometries(parts);
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.15, sheen: 0.2 });
  return { geo, mat, com: DONUT.com };
}

const builders = { duck, paperBoat: paperBoat, sailboat, bobber, donut };
const cache = new Map<ToyKind, { geo: THREE.BufferGeometry; mat: THREE.Material }>();

export function toyMesh(kind: ToyKind) {
  let c = cache.get(kind);
  if (!c) {
    const b = builders[kind]();
    b.geo.translate(-b.com.x, -b.com.y, -b.com.z);
    c = { geo: b.geo, mat: b.mat };
    cache.set(kind, c);
  }
  const mesh = new THREE.Mesh(c.geo, c.mat);
  mesh.castShadow = true;
  mesh.layers.enable(LAYER_REFLECT);
  return mesh;
}
