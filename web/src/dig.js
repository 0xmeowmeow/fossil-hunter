// Dig sites: lease a deposit, stand at the quarry face, read it, and saw blocks out.
//
// The face is a grid of beds (rows) and columns. What's behind each cell is fixed by the
// lease's seed, so the face can't be re-rolled. Some beds are productive and look it (the site
// note says which). A fossil usually shows a sign at the face where it lies; barren rock now
// and then shows a look-alike (a calcite vein, iron staining, a burrow). Telling them apart is
// the skill. Cut where the sign is: centred, the block holds the whole animal; off-centre,
// the saw goes through it; wide of it, you get plain rock.
//
// Logic only (deterministic, testable); digui.js draws the face.

import { Rng, hash3 } from './rng.js';

// rich: chance a cell in a good bed holds something. beds: thickness and whether each is a
// productive bed, top to bottom. note: what a collector would tell you.
export const SITES = [
  { id: 'house-range', name: 'House Range quarry', level: 'wheeler', lease: 220, cuts: 6, rep: 0, rich: 0.55,
    beds: [[1.2, 0], [0.5, 1], [1.0, 0], [0.45, 1], [0.9, 0]],
    note: 'The trilobites come from the thin, dark beds. The thick grey ones are mostly barren.' },
  { id: 'sydney-cutting', name: 'Road cutting, Sydney Basin', level: 'glossopteris', lease: 160, cuts: 6, rep: 0, rich: 0.5,
    beds: [[0.9, 0], [0.6, 1], [0.6, 1], [1.2, 0], [0.7, 0]],
    note: 'Leaves lie in the pale, finely layered mudstone, flat along the bedding.' },
  { id: 'mount-ida', name: 'Pay-to-dig mine, Mount Ida', level: 'arkansas', lease: 240, cuts: 5, rep: 0, rich: 0.45,
    beds: [[1.0, 0], [1.4, 1], [0.8, 0], [1.0, 1]],
    note: 'Pockets sit in the softer red clay bands. A glint at the face is worth chasing.' },
  { id: 'ohio-roadcut', name: 'Roadcut near Cincinnati', level: 'cincinnati', lease: 280, cuts: 5, rep: 3, rich: 0.45,
    beds: [[0.6, 1], [0.5, 0], [0.6, 1], [0.5, 0], [0.6, 1], [0.6, 0]],
    note: 'Limestone and shale in turns. The shelly storm beds are where the trilobites are.' },
  { id: 'lyme-foreshore', name: 'The foreshore at Lyme Regis', level: 'lyme', lease: 360, cuts: 5, rep: 6, rich: 0.4,
    beds: [[0.8, 0], [0.7, 1], [0.9, 0], [0.7, 1]],
    note: 'Ammonites weather out of the limestone ledges, not the shale between them.' },
  { id: 'crawfordsville-creek', name: 'Sugar Creek bank, Crawfordsville', level: 'crawfordsville', lease: 420, cuts: 5, rep: 8, rich: 0.35,
    beds: [[1.0, 0], [0.5, 1], [1.2, 0], [0.6, 0]],
    note: 'One thin bed holds the crinoid meadow. Columnals in the face are the giveaway.' },
  { id: 'jebel', name: 'A pit near Alnif, Morocco', level: 'phacops', lease: 620, cuts: 5, rep: 15, rich: 0.4,
    beds: [[1.1, 0], [0.7, 1], [0.8, 0], [0.7, 1]],
    note: 'The locals dig the nodular limestone. The trilobites lie in the darker layer.' },
];

// The real sign a fossil leaves at the face, by kind, and the look-alikes.
export const SIGNS = {
  trilobite: { name: 'a dark crescent', loupe: 'A curved edge of dark shell seen end-on, ribbed along its length: a trilobite cut across.' },
  leaf: { name: 'a black streak along the bedding', loupe: 'A film of carbon lying flat in a bedding plane, with a fine midrib: a leaf.' },
  crystal: { name: 'a glint', loupe: 'Glassy faces catching the light: the tip of a quartz point.' },
  ammonite: { name: 'a curved ribbed edge', loupe: 'A coiled edge with regular ribs: the outer whorl of an ammonite.' },
  crinoid: { name: 'a row of little discs', loupe: 'Tiny round plates stacked like coins: a crinoid stem, so the crown may be close.' },
};
export const FALSE_SIGNS = [
  { id: 'vein', name: 'a white line', loupe: 'A thin, straight white line cutting across the layers: a calcite vein. Nothing lives in a crack.' },
  { id: 'stain', name: 'an orange blotch', loupe: 'Rusty iron staining, soft-edged and seeping along a joint. Just water and iron.' },
  { id: 'burrow', name: 'a small round pit', loupe: 'A round tube filled with slightly different mud: a worm burrow. A trace fossil, but nothing to prepare.' },
];

const KIND = { wheeler: 'trilobite', cincinnati: 'trilobite', phacops: 'trilobite', glossopteris: 'leaf', arkansas: 'crystal', lyme: 'ammonite', crawfordsville: 'crinoid' };
export const kindOf = (site) => KIND[site.level] ?? 'trilobite';
export const findSite = (id) => SITES.find((s) => s.id === id);

export const COLS = 8;

/**
 * The face: beds as rows ({ y0, y1, good }, in face units 0..1 top to bottom) and, for each
 * cell, what's in it and what shows. Fossil and sign positions are in face units.
 */
export function face(site, seed) {
  const total = site.beds.reduce((a, [t]) => a + t, 0);
  let y = 0;
  const rows = site.beds.map(([t, good]) => {
    const r = { y0: y / total, y1: (y + t) / total, good: !!good };
    y += t;
    return r;
  });
  const cells = [];
  rows.forEach((r, row) => {
    for (let col = 0; col < COLS; col++) {
      const h = (k) => hash3(col, row, k, seed);
      const x0 = col / COLS, x1 = (col + 1) / COLS;
      const p = site.rich * (r.good ? 1 : 0.12);
      const has = h(1) < p;
      const c = { col, row, has, x0, x1, y0: r.y0, y1: r.y1 };
      if (has) {
        // Where the animal lies in the cell, and whether it shows at the face.
        c.fx = x0 + (0.25 + 0.5 * h(2)) * (x1 - x0);
        c.fy = r.y0 + (0.3 + 0.4 * h(3)) * (r.y1 - r.y0);
        if (h(4) < 0.68) c.sign = { kind: kindOf(site), x: c.fx, y: c.fy, real: true };
        c.seed = Math.floor(h(5) * 1e6);
      } else if (h(6) < 0.06) {
        const f = FALSE_SIGNS[Math.floor(h(7) * FALSE_SIGNS.length)];
        c.sign = { kind: f.id, x: x0 + (0.2 + 0.6 * h(8)) * (x1 - x0), y: r.y0 + (0.25 + 0.5 * h(9)) * (r.y1 - r.y0), real: false };
      }
      cells.push(c);
    }
  });
  return { rows, cells };
}

/** Block size at the face, in face units (a little more than a column wide). */
export const CUT_W = 1.25 / COLS;

/**
 * Saw a block centred at (x, y). Returns { cell, whole | sawn | null } where sawn gives the
 * saw plane through the animal ({ dir, at }), or { barren: true }.
 */
export function cut(f, x, y, aspect = 2) {
  // The animal nearest the cut centre, measured in real proportions (the face is wider than tall).
  let best = null, bd = Infinity;
  for (const c of f.cells) {
    if (!c.has || c.taken) continue;
    const d = Math.hypot((c.fx - x) * aspect, c.fy - y);
    if (d < bd) { bd = d; best = c; }
  }
  const half = (CUT_W * aspect) / 2; // the block's half-width, in the same units
  if (!best || bd > half * 1.15) return { barren: true };
  best.taken = true;
  // Centred: the whole animal. Further out, the saw takes a slice off the side nearest the edge.
  const off = bd / half;
  if (off < 0.45) return { cell: best, whole: true };
  const dx = (best.fx - x) * aspect, dy = best.fy - y, l = Math.hypot(dx, dy) || 1;
  return { cell: best, sawn: { dir: [dx / l, -dy / l], at: Math.min(0.48, 0.08 + (off - 0.45) * 0.6) } };
}

/** Take out a lease. Returns { p, lease } or an error string. */
export function lease(p, siteId, seed) {
  const s = findSite(siteId);
  if (!s) return 'No such site.';
  if ((p.rep ?? 0) < s.rep) return `Needs ${s.rep} reputation.`;
  if ((p.funds ?? 0) < s.lease) return 'Not enough funds.';
  if ((p.leases ?? []).some((l) => l.site === siteId && l.cutsLeft > 0)) return 'You already hold a lease there.';
  p.funds -= s.lease;
  const l = { site: siteId, seed, cutsLeft: s.cuts, looks: 4, cuts: [], day: p.day };
  p.leases = [...(p.leases ?? []), l];
  return { p, lease: l };
}
