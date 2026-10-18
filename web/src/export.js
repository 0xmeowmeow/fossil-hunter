// Export the finished piece: .glb (with colours) for Blender, other games, AR viewers and
// decoration, or .stl in millimetres for 3D printing. Everything visible on the bench goes:
// the remaining rock and the fine fossil shell.

import * as THREE from 'three';

const MM_PER_UNIT = 50; // a body length of 1 unit is about a 5 cm trilobite

function collect(view) {
  const out = new THREE.Group();
  view.off.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(view.off.matrixWorld).invert();
  const meshes = [...view.chunks.values(), ...[...(view.fine?.values() ?? [])].map((f) => f.mesh)];
  for (const m of meshes) {
    if (!m.geometry.index || m.geometry.index.count === 0) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', m.geometry.attributes.position.clone());
    g.setAttribute('normal', m.geometry.attributes.normal.clone());
    if (m.geometry.attributes.color) g.setAttribute('color', m.geometry.attributes.color.clone());
    g.setIndex(m.geometry.index.clone());
    // Local frame (z up, block centred) -> exported frame: y up, centred, in metres for glTF.
    g.applyMatrix4(m.matrixWorld.clone().premultiply(inv));
    const rough = m.geometry.attributes.rough?.array[0] ?? 0.8;
    const metal = m.geometry.attributes.metal?.array[0] ?? 0;
    out.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal })));
  }
  return out;
}

function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

function framed(group, unitsTo) {
  const box = new THREE.Box3().setFromObject(group);
  const c = box.getCenter(new THREE.Vector3());
  const root = new THREE.Group();
  group.position.set(-c.x, -c.y, -box.min.z); // sit on the ground
  const zup = new THREE.Group();
  zup.add(group);
  zup.rotation.x = -Math.PI / 2; // z-up specimen -> y-up file
  zup.scale.setScalar(unitsTo);
  root.add(zup);
  root.updateMatrixWorld(true);
  return root;
}

export async function exportGLB(view, name) {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const root = framed(collect(view), MM_PER_UNIT / 1000); // glTF is in metres
  const data = await new GLTFExporter().parseAsync(root, { binary: true });
  save(new Blob([data], { type: 'model/gltf-binary' }), `${name}.glb`);
}

export async function exportSTL(view, name) {
  const { STLExporter } = await import('three/addons/exporters/STLExporter.js');
  const root = framed(collect(view), MM_PER_UNIT); // STL by convention in millimetres
  const data = new STLExporter().parse(root, { binary: true });
  save(new Blob([data], { type: 'model/stl' }), `${name}.stl`);
}
