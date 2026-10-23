// Camera framing: place the camera so the puddle fills roughly the bottom half
// of the screen on any aspect ratio, leaving the top half for the scenery.
//
// The camera looks down at a fixed, gentle angle (steep enough to see into
// the water, shallow enough to keep the horizon and trees in view). For that
// angle we search camera height and distance so the puddle's near edge sits
// just above the bottom of the screen and its far edge near the middle,
// without the puddle spilling off the sides.
import * as THREE from 'three';

export interface Framing {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export function frameCamera(outline: [number, number][], aspect: number): Framing {
  const portrait = aspect < 1;
  const fov = portrait ? 64 : 55;
  const pitchDeg = portrait ? 12 : 10;
  const farGoal = portrait ? -0.1 : -0.06;
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.05, 1000);
  cam.rotation.set(-THREE.MathUtils.degToRad(pitchDeg), 0, 0);
  const pts = outline.filter((_, k) => k % 8 === 0).map(([x, z]) => new THREE.Vector3(x, 0, z));
  const v = new THREE.Vector3();

  let best = { score: Infinity, pos: new THREE.Vector3() };
  for (let height = 0.4; height <= 6; height += 0.04) {
    for (let back = 0; back <= 8; back += 0.04) {
      cam.position.set(0, height, back);
      cam.updateMatrixWorld();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      let behind = false;
      for (const p of pts) {
        v.copy(p).project(cam);
        if (v.z > 1 || v.z < -1) { behind = true; break; }
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      }
      if (behind) continue;
      // on tall phone screens the puddle may run off the sides a little,
      // which lets it fill more of the lower half
      const edge = portrait ? 1.4 : 0.97;
      const overflow = Math.max(0, maxX - edge, -edge - minX);
      const score = (minY + 0.9) ** 2 + (maxY - farGoal) ** 2 + overflow * overflow * 50;
      if (score < best.score) best = { score, pos: cam.position.clone() };
    }
  }
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(cam.rotation);
  return { position: best.pos, target: best.pos.clone().add(dir), fov };
}
