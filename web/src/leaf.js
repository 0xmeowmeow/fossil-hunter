// Glossopteris: the tongue-leaf of the Permian Gondwana forests, common in the shales of the
// Sydney Basin. Leaves fell into swamp mud and were pressed to a thin film of carbon: a
// compression, with the midrib and a net of fine veins standing in faint relief. The film is
// softer than the mudstone round it, so it's freed by splitting along the bedding, not by
// grinding.
//
// Body frame: the leaf runs along y (petiole at -y, apex at +y), lying in the xy plane, z up.

import { Fossil } from './fossilbase.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function sampleLeaf(rng) {
  return {
    kind: 'leaf',
    W: rng.uniform(0.12, 0.2), // half-width at the widest
    tipBias: rng.uniform(0.55, 0.72), // where the widest point is (spatulate leaves: towards the tip)
    th: rng.uniform(0.022, 0.03), // film thickness
    rib: rng.uniform(0.016, 0.024), // midrib half-width
    veinN: rng.uniform(70, 110), veinA: rng.uniform(0.9, 1.4), // secondary veins: density, arching
    wave: rng.uniform(0.005, 0.02), waveF: rng.uniform(1.5, 3.5), // the leaf isn't quite flat
    torn: rng.next() < 0.35 ? rng.uniform(0.1, 0.25) : 0, // a ragged edge
  };
}

export class Leaf extends Fossil {
  constructor(spec, opts) {
    super(spec, opts);
    const a = this.a;
    this.box = [[-a.W - 0.05, -0.62, -0.08], [a.W + 0.05, 0.56, 0.08]];
  }

  /** Half-width of the blade at y. */
  half(y) {
    const a = this.a, t = (y + 0.5) / 1.0; // 0 at the base, 1 at the apex
    if (t <= 0 || t >= 1) return -0.01;
    // Rises slowly from a narrow base, broadest past the middle, rounds off at the apex.
    const up = Math.pow(clamp(t / a.tipBias, 0, 1), 0.9), down = Math.sqrt(clamp((1 - t) / (1 - a.tipBias), 0, 1));
    return a.W * Math.min(up, down);
  }

  /** Height of the leaf's surface above its mid-plane: midrib, veins, a gentle wave. */
  relief(x, y) {
    const a = this.a, ax = Math.abs(x);
    const rib = a.rib * 0.7 * Math.exp(-((ax / a.rib) ** 2));
    // Secondary veins leave the midrib at a low angle and arch outwards; crossing ones make
    // the net (reticulate) pattern that tells Glossopteris apart.
    const s = y - a.veinA * ax * ax * 2.2 - 0.25 * ax;
    const v1 = Math.pow(0.5 + 0.5 * Math.cos(s * a.veinN), 8);
    const v2 = Math.pow(0.5 + 0.5 * Math.cos((y + 0.9 * ax) * a.veinN * 0.45 + 1.3), 12) * 0.5;
    return rib + 0.0035 * (v1 + v2) * clamp(ax / a.rib - 0.8, 0, 1);
  }

  sdf(x, y, z) {
    const a = this.a;
    // The petiole: a short stalk below the blade.
    const pet = Math.max(Math.hypot(x, z) - 0.012, y + 0.6, -0.48 - y);
    let w = this.half(y);
    if (a.torn > 0 && x > 0) w *= 1 - a.torn * (0.5 + 0.5 * Math.sin(y * 31 + Math.sin(y * 13) * 2));
    const out = Math.abs(x) - w;
    const mid = a.wave * Math.sin(y * a.waveF * TAU) * (x / a.W);
    const h = a.th / 2 + this.relief(x, y);
    const d = Math.max(out, Math.abs(z - mid) - h);
    return Math.min(d, pet);
  }
}
