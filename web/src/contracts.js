// The contracts board and the lots noticeboard: what gives a career direction, and where rock
// comes from. Plain functions over the profile and items, so they're easy to test and tune.
//
// Contracts are goals, not loot: each asks for a specimen of a kind and a quality, says what
// it pays, and teaches something on the way. Some send you the block to work; others you have
// to source from a lot. You deliver from the storeroom, so it's always your choice whether a
// piece goes to the client or into your own cases. Loans come back.
//
// Lots are rock for sale, listed day by day. The listing says where the rock is from and how
// hard it is to work; what's inside each block is for you to find.

import { Rng } from './rng.js';

// Goal fields: level (id or ids), minExp, minInteg (0-1), mounted, intact (no snapped spines),
// count (how many to deliver), loan (they're returned after filming / the term).
// supply: blocks sent with the contract. rep: reputation needed before it's offered.
// once: offered only until completed. tip: what the job teaches.
export const CONTRACTS = [
  {
    id: 'utah-teaching', from: 'University of Utah, geology teaching lab', rep: 0, days: 6,
    title: 'A teaching trilobite from the Wheeler Shale',
    text: 'Our first-years need a trilobite they can hold. Clean, not perfect.',
    goal: { level: 'wheeler', minExp: 0.9, minInteg: 0.85 }, supply: ['wheeler'],
    reward: { funds: 140, rep: 5, knowledge: 3 },
    tip: 'Wheeler shale lets go of the shell cleanly. Lift it with the scribe at a low angle rather than digging straight down.',
  },
  {
    id: 'school-handling', from: 'Lithgow Public School', rep: 0, days: 5, loan: true,
    title: 'A shark tooth for the handling box',
    text: 'The year 4s are doing oceans. We would love to borrow a real tooth for a term.',
    goal: { level: 'calvert', minExp: 0.85 }, supply: ['calvert'],
    reward: { funds: 40, rep: 8, knowledge: 1 },
    tip: 'Cliff sand barely holds together: the abrader eats it, but so does it eat the shells beside the tooth.',
  },
  {
    id: 'beecher-gold', from: 'A private collector in Rochester', rep: 0, days: 6,
    title: 'A golden trilobite from Beecher\'s bed',
    text: 'Pyritised, bright, and not a scratch on the gold.',
    goal: { level: 'beecher', minExp: 0.95, minInteg: 0.95 },
    reward: { funds: 260, rep: 4 },
    tip: 'Pyrite is far harder than black shale. Bicarbonate in the abrader strips the shale and leaves the gold alone.',
  },
  {
    id: 'ohio-mount', from: 'Cincinnati Museum Center', rep: 3, days: 7,
    title: 'The big asaphid, on a sawn base',
    text: 'For our storm-bed case: the big asaphid, mounted so it stands up for itself.',
    goal: { level: 'cincinnati', minInteg: 0.85, minExp: 0.9, mounted: true }, supply: ['cincinnati'],
    reward: { funds: 220, rep: 8, knowledge: 4 },
    tip: 'After you finish, "Prepare for display" saws a flat base and trims the block. Clients notice a good mount.',
  },
  {
    id: 'growth-series', from: 'Natural History Museum of Utah', rep: 6, days: 12, once: true,
    title: 'A series of three from the Wheeler Shale',
    text: 'Three specimens, side by side, so visitors can see how one species varies. Buy a lot if you need the rock.',
    goal: { level: 'wheeler', minExp: 0.9, minInteg: 0.8, count: 3 },
    reward: { funds: 300, rep: 14, knowledge: 8 },
    tip: 'A series shows variation within a species: size, moults, the odd injury. One specimen can mislead; three start to tell a story.',
  },
  {
    id: 'dorset-ammonite', from: 'Lyme Regis Museum', rep: 8, days: 8,
    title: 'An ammonite from the Blue Lias, whole',
    text: 'The frilly suture lines must show. A broken whorl is no good to us.',
    goal: { level: 'lyme', minExp: 0.9, minInteg: 0.9 }, supply: ['lyme'],
    reward: { funds: 340, rep: 10, knowledge: 5 },
    tip: 'Suture lines are where the chamber walls met the shell. They show best where the shell is cleaned but not cut.',
  },
  {
    id: 'film-phacops', from: 'A documentary crew', rep: 10, days: 8, loan: true,
    title: 'A phacopid with its eyes intact, for a close-up',
    text: 'We are filming trilobite eyes. Every lens has to be there. We will bring it back.',
    goal: { level: 'phacops', minExp: 0.95, minInteg: 0.95 },
    reward: { funds: 380, rep: 12, knowledge: 4 },
    tip: 'Phacopids had compound eyes with big calcite lenses. In the same rock as the shell, only lustre tells you where to stop.',
  },
  {
    id: 'spines-intact', from: 'A collector in Tucson', rep: 20, days: 10,
    title: 'An odontopleurid with every spine',
    text: 'Not one snapped. I will know.',
    goal: { level: 'spiny', minExp: 0.9, minInteg: 0.9, intact: true },
    reward: { funds: 1100, rep: 10 },
    tip: 'Spines snap once the rock around them is gone. Leave them propped on matrix until last, and model the animal first.',
  },
  {
    id: 'ghost-study', from: 'A university research group', rep: 30, days: 12,
    title: 'A dalmanitid for a study of eye structure',
    text: 'Welded grey-on-grey matrix. We need the specimen, not your opinion of it.',
    goal: { level: 'ghost', minExp: 0.9, minInteg: 0.9 },
    reward: { funds: 900, rep: 16, knowledge: 10 },
    tip: 'When colour gives nothing away, wet the surface: shell and rock take water differently.',
  },
  {
    id: 'opal-film', from: 'A documentary crew', rep: 15, days: 14, loan: true,
    title: 'An opalised shell for the camera',
    text: 'Lightning Ridge, for a film about how opal forms. The more fire the better.',
    goal: { level: 'ridge', minExp: 0.9, minInteg: 0.85 },
    reward: { funds: 500, rep: 15, knowledge: 6 },
    tip: 'Opal is silica spheres stacked in rows; the colour is light diffracted between them. Bigger spheres reach red.',
  },
];

// Lots: blocks: level ids (one block each). rep gates the rarer ones; weight is how often
// they turn up.
export const LOTS = [
  { id: 'estate-wheeler', title: 'Deceased estate: a box of Wheeler shale', text: 'Labelled "House Range, 1974" in a careful hand.', blocks: ['wheeler', 'wheeler', 'wheeler'], price: 120, rep: 0, weight: 3 },
  { id: 'calvert-beach', title: 'Beach-combed cliff sand from Calvert', text: 'Bagged by a retired schoolteacher. Some of it has fallen out of the bags.', blocks: ['calvert', 'calvert', 'calvert'], price: 90, rep: 0, weight: 3 },
  { id: 'beecher-nodules', title: 'Black shale off a Beecher\'s bed dump', text: 'A collector\'s leftovers, still wrapped in newspaper.', blocks: ['beecher', 'beecher'], price: 70, rep: 0, weight: 2 },
  { id: 'ohio-quarry', title: 'Quarry clear-out, near Cincinnati', text: 'Storm-bed slabs going cheap before the crusher gets them.', blocks: ['cincinnati', 'cincinnati', 'cincinnati'], price: 210, rep: 0, weight: 2 },
  { id: 'dealer-mixed', title: 'A dealer\'s mixed box', text: 'Odds and ends from a closed shop: Utah, New York and Ohio.', blocks: ['wheeler', 'beecher', 'cincinnati'], price: 140, rep: 2, weight: 2 },
  { id: 'lyme-ledge', title: 'Ledge pieces from the Blue Lias', text: 'Brought up after a winter cliff fall.', blocks: ['lyme', 'lyme'], price: 220, rep: 5, weight: 2 },
  { id: 'morocco-phacops', title: 'An import lot from Morocco', text: 'Tan limestone, lightly roughed out at source.', blocks: ['phacops', 'phacops'], price: 280, rep: 8, weight: 2 },
  { id: 'morocco-spiny', title: 'One spiny nodule, Morocco', text: 'The seller swears there are spines in it.', blocks: ['spiny'], price: 380, rep: 18, weight: 1 },
  { id: 'morocco-grey', title: 'Grey-on-grey blocks, Morocco', text: 'Hard to read and harder to work. Priced accordingly.', blocks: ['ghost', 'ghost'], price: 700, rep: 28, weight: 1 },
  { id: 'ridge-tin', title: 'A tin of opal dirt from a Ridge miner', text: 'Shincracker from the Wallangulla field. Most of it holds nothing; this lump shows a glint.', blocks: ['ridge'], price: 600, rep: 25, weight: 1 },
];

const BOARD = 3, NOTICES = 3, ACTIVE = 3, LOT_DAYS = 3, OFFER_DAYS = 4;

/** Is this prepared item good enough for the contract's goal? */
export function qualifies(c, it) {
  const g = c.goal;
  if (it.status !== 'prepared' || it.where === 'sell' || it.where === 'delivered' || it.loanedTo) return false;
  const lv = [].concat(g.level);
  if (!lv.includes(it.level)) return false;
  if ((it.exposure ?? 0) < (g.minExp ?? 0) - 1e-9) return false;
  if ((it.integrity ?? 0) < (g.minInteg ?? 0) - 1e-9) return false;
  if (g.mounted && !it.mounted) return false;
  if (g.intact && (it.snapped ?? 0) > 0) return false;
  return true;
}

/** The items that would go to the client, cheapest first, or null if there aren't enough. */
export function deliverable(c, items) {
  const ok = items.filter((it) => qualifies(c, it)).sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
  const n = c.goal.count ?? 1;
  return ok.length >= n ? ok.slice(0, n) : null;
}

/** Why an item falls short (for the storeroom), or '' if it doesn't apply. */
export function shortfall(c, it) {
  const g = c.goal;
  if (![].concat(g.level).includes(it.level) || it.status !== 'prepared') return '';
  const out = [];
  if ((it.exposure ?? 0) < (g.minExp ?? 0)) out.push(`exposed ${Math.floor(it.exposure * 100)}% of ${Math.round(g.minExp * 100)}%`);
  if ((it.integrity ?? 0) < (g.minInteg ?? 0)) out.push(`integrity ${(it.integrity * 100).toFixed(0)}% of ${Math.round(g.minInteg * 100)}%`);
  if (g.mounted && !it.mounted) out.push('not mounted');
  if (g.intact && it.snapped) out.push(`${it.snapped} spine${it.snapped === 1 ? '' : 's'} snapped`);
  return out.join(', ');
}

export const findContract = (id) => CONTRACTS.find((c) => c.id === id);
export const findLot = (id) => LOTS.find((l) => l.id === id);

/** What the goal asks for, in one line. */
export function goalText(c, levelName) {
  const g = c.goal, bits = [];
  const n = g.count ?? 1;
  bits.push(`${n > 1 ? `${n} specimens` : 'A specimen'} from ${levelName(g.level)}`);
  if (g.minExp) bits.push(`at least ${Math.round(g.minExp * 100)}% exposed`);
  if (g.minInteg) bits.push(`${Math.round(g.minInteg * 100)}% integrity`);
  if (g.mounted) bits.push('mounted on a base');
  if (g.intact) bits.push('no snapped spines');
  return bits.join(', ');
}

export function rewardText(r) {
  return [r.funds && `$${r.funds}`, r.rep && `${r.rep} reputation`, r.knowledge && `${r.knowledge} knowledge`].filter(Boolean).join(' · ');
}

/**
 * A new day on the board: old offers and lots come down, new ones go up. Deterministic from
 * the career's start and the day, so a reload never re-rolls the board.
 */
export function refreshBoard(p) {
  const rng = new Rng(((p.started ?? 1) % 2147483647) + p.day * 7919);
  const rep = p.rep ?? 0;
  const done = new Set(p.contractsDone ?? []);
  const active = (p.contracts ?? []).filter((a) => !a.done);
  // Expired contracts: a small knock to reputation, and the board moves on. Blocks they sent
  // are yours to keep.
  const expired = [];
  for (const a of active) if (p.day > a.due) { a.done = 'expired'; expired.push(a.id); }
  p.rep = Math.max(0, rep - 2 * expired.length);
  p.contracts = (p.contracts ?? []).filter((a) => !a.done);
  // Offers.
  let offers = (p.offers ?? []).filter((o) => p.day < o.until);
  const busy = new Set([...p.contracts.map((a) => a.id), ...offers.map((o) => o.id)]);
  const pool = CONTRACTS.filter((c) => c.rep <= rep && !busy.has(c.id) && !(c.once && done.has(c.id)));
  while (offers.length < BOARD && pool.length) {
    // Newer, bigger work comes up more often once you've earned it.
    const c = rng.weighted(pool, pool.map((c) => 1 + c.rep / 10));
    pool.splice(pool.indexOf(c), 1);
    offers.push({ id: c.id, until: p.day + OFFER_DAYS });
  }
  // Lots.
  let lots = (p.lots ?? []).filter((l) => p.day < l.until);
  const lpool = LOTS.filter((l) => l.rep <= rep && !lots.some((x) => x.id === l.id));
  while (lots.length < NOTICES && lpool.length) {
    const l = rng.weighted(lpool, lpool.map((l) => l.weight));
    lpool.splice(lpool.indexOf(l), 1);
    // The asking price wanders a little from day to day.
    lots.push({ id: l.id, until: p.day + LOT_DAYS, price: Math.round(l.price * rng.uniform(0.85, 1.15) / 5) * 5 });
  }
  p.offers = offers;
  p.lots = lots;
  p.boardDay = p.day;
  return { expired };
}

/** Take on an offered contract. Returns { p, blocks } (level ids sent with it) or an error string. */
export function accept(p, id) {
  const c = findContract(id);
  if (!c || !(p.offers ?? []).some((o) => o.id === id)) return 'That offer is no longer on the board.';
  if ((p.contracts ?? []).length >= ACTIVE) return `You can take on ${ACTIVE} contracts at a time.`;
  p.offers = p.offers.filter((o) => o.id !== id);
  p.contracts = [...(p.contracts ?? []), { id, took: p.day, due: p.day + c.days }];
  return { p, blocks: c.supply ?? [] };
}

/**
 * Hand over the qualifying items. Returns { p, items } with the items changed (delivered, or
 * out on loan) and the reward added, or an error string.
 */
export function deliver(p, id, items) {
  const c = findContract(id);
  const a = (p.contracts ?? []).find((x) => x.id === id);
  if (!c || !a) return 'No such contract.';
  const give = deliverable(c, items);
  if (!give) return 'You don\'t have what they asked for yet.';
  for (const it of give) {
    if (c.loan) it.loanedTo = { who: c.from, back: p.day + 2 };
    else { it.where = 'delivered'; it.deliveredTo = c.from; }
  }
  const r = c.reward;
  p.funds = (p.funds ?? 0) + (r.funds ?? 0);
  p.rep = (p.rep ?? 0) + (r.rep ?? 0);
  p.knowledge = (p.knowledge ?? 0) + (r.knowledge ?? 0);
  p.contracts = p.contracts.filter((x) => x.id !== id);
  p.contractsDone = [...new Set([...(p.contractsDone ?? []), id])];
  return { p, items: give };
}

/** Buy a lot off the noticeboard. Returns { p, blocks, lot } or an error string. */
export function buyLot(p, id) {
  const l = findLot(id), n = (p.lots ?? []).find((x) => x.id === id);
  if (!l || !n) return 'That lot has gone.';
  if ((p.funds ?? 0) < n.price) return 'Not enough funds.';
  p.funds -= n.price;
  p.lots = p.lots.filter((x) => x.id !== id);
  return { p, blocks: l.blocks, lot: l };
}

/** Loans due back today come home. Returns the items that changed. */
export function returnLoans(p, items) {
  const back = items.filter((it) => it.loanedTo && p.day >= it.loanedTo.back);
  for (const it of back) delete it.loanedTo;
  return back;
}
