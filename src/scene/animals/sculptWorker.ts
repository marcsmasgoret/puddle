// Builds animal meshes off the main thread (see sculpt.ts / sculptMesh.ts).
import { buildMeshData, type MeshSpec } from './sculptMesh';

self.onmessage = (e: MessageEvent<{ id: number; spec: MeshSpec }>) => {
  const data = buildMeshData(e.data.spec);
  (self as unknown as Worker).postMessage({ id: e.data.id, data }, [data.pos.buffer, data.nrm.buffer, data.index.buffer, data.si.buffer, data.sw.buffer]);
};
