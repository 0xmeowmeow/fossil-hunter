// Curated tours: a route through the cases with a card at each stop. A good tour tells a story
// (oldest to youngest, or the other way), covers a span of time and a variety of life, shows
// well-prepared pieces, and says something at every stop. Tours bring school groups.
//
// Plain functions over items and levels, like economy.js.

import { DEPOSITS } from './science.js';

export const MIN_STOPS = 3, MAX_STOPS = 8;

/** Age in millions of years for a level, from its deposit note ("about 450 million years"). */
export function ageOf(levelId) {
  const m = /([\d.]+) million/.exec(DEPOSITS[levelId]?.age ?? '');
  return m ? +m[1] : null;
}

/** What kind of thing a level holds, for variety. */
const GROUPS = {
  beecher: 'trilobite', wheeler: 'trilobite', cincinnati: 'trilobite', phacops: 'trilobite', spiny: 'trilobite', ghost: 'trilobite',
  calvert: 'shark', lyme: 'ammonite', ridge: 'opal', glossopteris: 'plant', crawfordsville: 'crinoid', arkansas: 'mineral',
};
export const groupOf = (levelId) => GROUPS[levelId] ?? 'other';

/**
 * Rate a tour. stops: [{ item, card }] with item records. Returns { stars 1-5, points, notes
 * [[text, good]] } explaining the rating, so a player can see how to improve it.
 */
export function rate(stops) {
  const notes = [];
  if (stops.length < MIN_STOPS) return { stars: 0, points: 0, notes: [[`A tour needs at least ${MIN_STOPS} stops.`, false]] };
  let pts = 0;
  // A story through time.
  const ages = stops.map((s) => ageOf(s.item.level)).filter((a) => a !== null);
  const down = ages.every((a, i) => i === 0 || a <= ages[i - 1]), up = ages.every((a, i) => i === 0 || a >= ages[i - 1]);
  if (ages.length >= 3 && (down || up) && new Set(ages).size > 1) {
    pts += 1;
    notes.push([down ? 'Walks forward through time, oldest first.' : 'Walks back through time, youngest first.', true]);
  } else notes.push(['The stops jump about in time. Order them oldest to youngest to tell a story.', false]);
  const span = ages.length ? Math.max(...ages) - Math.min(...ages) : 0;
  pts += Math.min(1, span / 300);
  notes.push([span >= 200 ? `Spans ${Math.round(span)} million years.` : span > 0 ? `Spans only ${Math.round(span)} million years; reach further back or forward.` : 'Every stop is the same age.', span >= 200]);
  // Variety of life (and the odd mineral).
  const kinds = new Set(stops.map((s) => groupOf(s.item.level)));
  pts += Math.min(1.35, (kinds.size - 1) * 0.45);
  notes.push([kinds.size >= 3 ? `${kinds.size} different kinds of thing.` : `Only ${kinds.size === 1 ? 'one kind' : 'two kinds'} of thing; mix it up.`, kinds.size >= 3]);
  // Quality of the pieces.
  const q = stops.reduce((a, s) => a + (s.item.exposure ?? 0) * (s.item.integrity ?? 0), 0) / stops.length;
  pts += Math.max(-1, (q - 0.6) * 2); // rough pieces count against it
  notes.push([q >= 0.85 ? 'Beautifully prepared pieces.' : q >= 0.7 ? 'Decent pieces; better preparation would lift it.' : 'Some rough pieces let it down.', q >= 0.85]);
  // Something to say at each stop.
  const said = stops.filter((s) => (s.card ?? '').trim().length >= 30).length / stops.length;
  pts += said * 1.2;
  notes.push([said >= 1 ? 'A card at every stop.' : `${Math.round((1 - said) * stops.length)} stop${Math.round((1 - said) * stops.length) === 1 ? ' has' : 's have'} no card (a sentence or two).`, said >= 1]);
  const stars = Math.max(1, Math.min(5, Math.round(pts)));
  return { stars, points: pts, notes };
}

/**
 * Will a school come today, and what do they bring? Deterministic given rng. Returns null or
 * { students, fee, rep }.
 */
export function schoolVisit(stars, rep, rng = Math.random) {
  if (!stars) return null;
  const chance = Math.min(0.85, 0.15 + 0.13 * stars + rep / 500);
  if (rng() > chance) return null;
  const students = 16 + Math.floor(rng() * 14);
  return { students, fee: students * 5, rep: 1 + Math.round(stars * 0.8) };
}

/** A starting card for a stop, from what the player knows (they can rewrite it). */
export function suggestCard(item, level, sci) {
  const d = DEPOSITS[item.level];
  const bits = [`${item.name || level?.title || 'This specimen'}, from ${level?.place ?? 'somewhere'}.`];
  if (d && sci.has('stratigraphy')) bits.push(`The rock is ${d.age} old.`);
  if (d && sci.has('taphonomy')) bits.push(d.taph);
  return bits.join(' ');
}
