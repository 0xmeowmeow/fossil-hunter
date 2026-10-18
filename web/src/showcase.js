// The landing-page specimen: a freshly generated, fully prepared trilobite on a stone plinth,
// turning slowly in raking light, with a museum label. A different animal every visit.

import * as THREE from 'three';
import { ARCHETYPES, FOSSILS } from './data.js';
import { buildFine } from './finefossil.js';
import { Noise } from './noise.js';
import { Rng } from './rng.js';
import { speciesName, GROUP_NAMES } from './species.js';
import { sampleTrilobite, Trilobite } from './trilobite.js';
import { srgbToLinear } from './specimen.js';

const LOOKS = ['pyrite', 'calcite_dark', 'calcite_brown'];

export function buildShowcase(seed) {
  const rng = new Rng(seed);
  const archs = Object.keys(ARCHETYPES);
  const archetype = archs[rng.int(archs.length)];
  const spec = sampleTrilobite(seed, { archetype, pure: rng.next() < 0.7, pose: { enroll: 0, yaw: 0, tilt: 0, roll: 0, flatten: 0.95 } });
  const tri = new Trilobite(spec, { minR: 0.008 });
  const { lo, hi } = tri.restOnPlane(0);
  const voxel = 0.0065, pad = 0.03;
  const o = [lo[0] - pad, lo[1] - pad, -0.02];
  const dims = [Math.ceil((hi[0] - lo[0] + 2 * pad) / voxel) + 1, Math.ceil((hi[1] - lo[1] + 2 * pad) / voxel) + 1, Math.ceil((hi[2] + pad + 0.02) / voxel) + 1];
  const field = new Float32Array(dims[0] * dims[1] * dims[2]);
  for (let k = 0; k < dims[2]; k++)
    for (let j = 0; j < dims[1]; j++)
      for (let i = 0; i < dims[0]; i++) {
        const d = tri.field(o[0] + i * voxel, o[1] + j * voxel, o[2] + k * voxel);
        field[i + j * dims[0] + k * dims[0] * dims[1]] = Math.max(-4, Math.min(4, -d / voxel));
      }
  const look = FOSSILS[LOOKS[rng.int(LOOKS.length)]];
  const base = srgbToLinear(look.colour), noise = new Noise(seed);
  const factor = /Mobi|Android|iPad|Quest|OculusBrowser/i.test(globalThis.navigator?.userAgent ?? '') ? 1.5 : 2.5;
  const chunks = buildFine({ origin: o, voxel, nx: dims[0], ny: dims[1], nz: dims[2], field, fn: (x, y, z) => tri.field(x, y, z) }, factor);
  const parts = chunks.map((ch) => {
    const col = new Float32Array(ch.nv * 3), rough = new Float32Array(ch.nv).fill(1 - look.gloss);
    const metal = new Float32Array(ch.nv).fill(look.metal), grain = new Float32Array(ch.nv).fill(0.06);
    for (let q = 0; q < ch.nv; q++) {
      const x = ch.pos[q * 3], y = ch.pos[q * 3 + 1], z = ch.pos[q * 3 + 2];
      const g = (1 + 0.18 * noise.fbm(x, y, z, 30, 2)) * ch.ao[q];
      col[q * 3] = base[0] * g; col[q * 3 + 1] = base[1] * g; col[q * 3 + 2] = base[2] * g;
    }
    return { pos: ch.pos, nrm: ch.nrm, col, rough, metal, grain, idx: ch.idx };
  });
  const name = speciesName(archetype, rng);
  return { parts, name, group: GROUP_NAMES[archetype], seed, size: [hi[0] - lo[0], hi[1] - lo[1]] };
}

/** Put the showcase into a three.js group, using the view's specimen material. */
export function showcaseGroup(sc, material) {
  const fossil = new THREE.Group();
  for (const d of sc.parts) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(d.nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(d.col, 3));
    g.setAttribute('rough', new THREE.BufferAttribute(d.rough, 1));
    g.setAttribute('metal', new THREE.BufferAttribute(d.metal, 1));
    g.setAttribute('grain', new THREE.BufferAttribute(d.grain, 1));
    g.setIndex(new THREE.BufferAttribute(d.idx, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    m.castShadow = m.receiveShadow = true;
    fossil.add(m);
  }
  // A slab of dark shale to rest on.
  // A rough, irregular flake of shale rather than a box.
  const w = sc.size[0] + 0.22, l = sc.size[1] + 0.2;
  const shape = new THREE.Shape();
  const N = 22, rng = new Rng(sc.seed + 9);
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 0.86 + 0.18 * rng.next();
    const x = Math.cos(a) * (w / 2) * r, y = Math.sin(a) * (l / 2) * r;
    i ? shape.lineTo(x, y) : shape.moveTo(x, y);
  }
  const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.015, bevelSegments: 2 });
  const slab = new THREE.Mesh(slabGeo, new THREE.MeshStandardMaterial({ color: 0x2a2723, roughness: 0.95 }));
  slab.position.z = -0.075;
  slab.receiveShadow = true;
  const inner = new THREE.Group();
  inner.add(fossil, slab);
  inner.rotation.x = -Math.PI / 2; // z-up specimen -> y-up world
  const outer = new THREE.Group();
  outer.add(inner);
  return outer;
}
