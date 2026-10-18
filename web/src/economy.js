// The museum's day: visitors come to see what's on display, buy tickets and gift-shop junk.
// Deliberately simple and readable; tuning numbers live here.
//
// A day ends when you pack up or finish a specimen. Days only pass when you choose.

export const TICKET = 4;

/** Gift-shop junk: bought in bulk, sold one at a time. `pull` is how tempting it is. */
export const JUNK = [
  { id: 'plush', name: 'Plush trilobites', icon: '🧸', cost: 3, price: 12, lot: 10, pull: 0.09 },
  { id: 'dinos', name: 'Rubber dinosaurs', icon: '🦖', cost: 1, price: 4, lot: 25, pull: 0.16 },
  { id: 'pebbles', name: 'Bags of polished pebbles', icon: '💎', cost: 1.5, price: 6, lot: 20, pull: 0.12 },
  { id: 'postcards', name: 'Postcards of the collection', icon: '✉️', cost: 0.5, price: 2, lot: 40, pull: 0.2 },
  { id: 'casts', name: 'Plaster trilobite casts', icon: '🪨', cost: 6, price: 22, lot: 6, pull: 0.04 },
  { id: 'kits', name: '"Dig your own fossil" kits', icon: '⛏️', cost: 5, price: 18, lot: 8, pull: 0.06 },
];

/**
 * One day's takings. `shown` are the prepared items on display, `stock` the gift shop's
 * counts. Returns the numbers and the changed stock (doesn't touch anything else).
 */
export function dayResult(profile, shown, rng = Math.random) {
  // Appeal: every specimen draws people, valuable ones more; the star of the show most.
  const vals = shown.map((it) => it.value ?? 0).sort((a, b) => b - a);
  const appeal = vals.reduce((a, v, i) => a + 2 + Math.min(14, v / 90) * (i === 0 ? 1.6 : 1), 0);
  const rep = profile.rep ?? 0;
  const mean = 3 + appeal * (1 + rep / 200);
  const visitors = Math.max(0, Math.round(mean * (0.8 + 0.4 * rng())));
  const stock = { ...(profile.stock ?? {}) };
  const sold = {};
  let shop = 0;
  for (const j of JUNK) {
    const have = stock[j.id] ?? 0;
    if (!have) continue;
    let n = 0;
    for (let v = 0; v < visitors && n < have; v++) if (rng() < j.pull) n++;
    if (n) {
      stock[j.id] = have - n;
      sold[j.id] = n;
      shop += n * j.price;
    }
  }
  const tickets = visitors * TICKET;
  const repGain = Math.round(shown.length * 0.6 + visitors / 15);
  const star = shown.slice().sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  return { day: profile.day, visitors, tickets, shop, sold, stock, repGain, star: star?.name ?? null, earned: tickets + shop };
}

/** Buy a lot of junk for the shop: returns the new profile, or null if you can't afford it. */
export function restock(profile, id) {
  const j = JUNK.find((x) => x.id === id);
  if (!j) return null;
  const cost = Math.round(j.cost * j.lot);
  if (profile.funds < cost) return null;
  const stock = { ...(profile.stock ?? {}) };
  stock[id] = (stock[id] ?? 0) + j.lot;
  return { ...profile, funds: profile.funds - cost, stock };
}
