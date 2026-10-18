// The science track: knowledge buys ideas, and each idea changes the game where it matters.
// A node gives a capability (a tool on more benches, an earlier warning, a scan) and a fact,
// and the fact appears at the point of use: the intro card, the field guide, the results card,
// the museum label. No quizzes.
//
// Knowledge comes from doing: finishing pieces, firsts, correct identifications, contracts.

export const BRANCHES = [
  ['prep', 'Preparation'],
  ['palaeo', 'Palaeontology'],
  ['mineral', 'Mineralogy'],
];

// gives: what changes in play. fact: what you now know (shown where relevant).
export const NODES = [
  {
    id: 'notebook', branch: 'prep', name: 'Identification tests', cost: 3, needs: [],
    gives: 'The notebook (needle, acid, loupe) on every bench.',
    fact: 'Acid fizzes on calcite and not on pyrite, opal or tooth enamel. A steel needle scratches anything softer than about 5½ on Mohs\' scale.',
  },
  {
    id: 'guide', branch: 'prep', name: 'Field guides', cost: 5, needs: ['notebook'],
    gives: 'The field guide on every bench.',
    fact: 'A deposit holds a handful of species. Ruling them out feature by feature is how identification really works.',
  },
  {
    id: 'model', branch: 'prep', name: 'Modelling the animal', cost: 8, needs: ['guide'],
    gives: 'Your model on every trilobite bench: scribes and the abrader stop at it.',
    fact: 'Preparators work from the expected anatomy: if the head is here, the genal spines should be there.',
  },
  {
    id: 'consolidant', branch: 'prep', name: 'Consolidants and repair', cost: 8, needs: ['notebook'],
    gives: 'Snapped spines are glued back: they cost much less integrity, and the label says "repaired".',
    fact: 'Paraloid B-72 is the preparator\'s glue: strong, clear, and it dissolves in acetone, so any repair can be undone.',
  },
  {
    id: 'ct', branch: 'prep', name: 'CT scanning', cost: 15, needs: ['model'],
    gives: 'The field guide marks which species the scan matches.',
    fact: 'X-ray CT maps density, not colour: pyrite lights up brightly, calcite in limestone barely shows.',
  },
  {
    id: 'anatomy', branch: 'palaeo', name: 'Trilobite anatomy', cost: 2, needs: [],
    gives: 'Anatomy notes in the field guide and on your results.',
    fact: 'Cephalon, thorax, pygidium: head, body segments, tail shield. "Trilobite" means three lobes, running side to side.',
  },
  {
    id: 'eyes', branch: 'palaeo', name: 'Trilobite eyes', cost: 4, needs: ['anatomy'],
    gives: 'Eye notes on labels for phacopids and dalmanitids.',
    fact: 'Trilobites had the oldest known complex eyes, with lenses of calcite. Phacopids had a few hundred large, separate lenses.',
    rel: (lv) => ['phacops', 'ghost'].includes(lv.id),
  },
  {
    id: 'taphonomy', branch: 'palaeo', name: 'Taphonomy', cost: 5, needs: ['anatomy'],
    gives: 'Each block\'s intro card says how its fossils came to lie as they do.',
    fact: 'Taphonomy is the study of what happens between death and discovery: scavengers, currents, burial and mineral change.',
  },
  {
    id: 'stratigraphy', branch: 'palaeo', name: 'Stratigraphy', cost: 8, needs: ['taphonomy'],
    gives: 'Blocks, lots and labels show the age of the rock.',
    fact: 'Rock layers stack oldest at the bottom. Index fossils and volcanic ash beds put dates on them.',
  },
  {
    id: 'hardness', branch: 'mineral', name: 'Mohs hardness', cost: 2, needs: [],
    gives: 'The abrader warns you when its powder is harder than the shell.',
    fact: 'Hardness is what scratches what. Bicarbonate (2.5) barely marks calcite (3); aluminium oxide (9) cuts everything on this bench.',
  },
  {
    id: 'lustre', branch: 'mineral', name: 'Lustre', cost: 4, needs: ['hardness'],
    gives: 'Show leftover rock from 90% exposed instead of 96%.',
    fact: 'Lustre is how a surface gives back light: glassy, satiny, earthy. A wet surface shows it best.',
  },
  {
    id: 'opal', branch: 'mineral', name: 'Grading opal', cost: 6, needs: ['lustre'],
    gives: 'The valuer gives you the full grade: body tone, brightness, colour, pattern.',
    fact: 'Opal is graded on body tone (N1 black to N9 white), brightness (B1 to B5), the colours in it and their pattern.',
    rel: (lv) => lv.id === 'ridge',
  },
];

// What each deposit adds once you know taphonomy and stratigraphy.
export const DEPOSITS = {
  beecher: { age: 'about 450 million years', taph: 'Buried alive in sudden mud flows, in water short of oxygen. Pyrite replaced even legs and antennae, which almost never fossilise.' },
  wheeler: { age: 'about 507 million years', taph: 'Calm, deep, oxygen-poor mud: few scavengers came, so whole animals and moults lie flat where they settled.' },
  calvert: { age: 'about 15 million years', taph: 'A shark\'s skeleton is cartilage and rots away; its teeth are hard enamel, and a shark sheds thousands of them in a lifetime.' },
  glossopteris: { age: 'about 255 million years', taph: 'Glossopteris trees dropped their leaves each autumn into cold swamp mud. Buried and squeezed, a leaf kept nothing but a film of carbon and the pattern of its veins.' },
  crawfordsville: { age: 'about 340 million years', taph: 'A crinoid meadow smothered by mud from a river delta. Buried at once, the arms stayed joined instead of falling apart into loose plates, which is what usually happens.' },
  arkansas: { age: 'about 250 million years', taph: 'As the Ouachita Mountains were pushed up, hot silica-rich water rose through cracks and grew crystals into open pockets. The rock round them later weathered to clay.' },
  cincinnati: { age: 'about 450 million years', taph: 'A storm bed: a storm ripped up the sea floor and dropped the shells in a jumble. A whole trilobite here means it was buried fast.' },
  lyme: { age: 'about 195 million years', taph: 'Ammonite shells drifted after death and settled into mud; their empty chambers often filled with calcite crystal.' },
  phacops: { age: 'about 390 million years', taph: 'Many Moroccan phacopids are whole, some rolled up: a quick burial on a muddy sea floor.' },
  spiny: { age: 'about 390 million years', taph: 'Spines survive only where nothing disturbed the body after burial: no currents, no burrowers.' },
  ghost: { age: 'about 400 million years', taph: 'Shell and rock are both calcite here, recrystallised together; the boundary is a change in texture, not material.' },
  ridge: { age: 'about 100 million years', taph: 'A freshwater mussel buried in river sand. Much later the shell dissolved, and silica-rich water filled the space it left and set as opal.' },
};

export const findNode = (id) => NODES.find((n) => n.id === id);
export const known = (p) => new Set(p?.science ?? []);

/** Can this node be learned now? Returns '' if so, or the reason not. */
export function blocked(p, id) {
  const n = findNode(id), k = known(p);
  if (!n) return 'Unknown idea.';
  if (k.has(id)) return 'Already learned.';
  const miss = n.needs.filter((x) => !k.has(x));
  if (miss.length) return `Needs ${miss.map((x) => findNode(x).name).join(' and ')} first.`;
  if ((p.knowledge ?? 0) < n.cost) return `Needs ${n.cost} knowledge.`;
  return '';
}

/** Learn a node: spends knowledge. Returns the profile or an error string. */
export function learn(p, id) {
  const why = blocked(p, id);
  if (why) return why;
  p.knowledge -= findNode(id).cost;
  p.science = [...(p.science ?? []), id];
  return p;
}

const isTrilobite = (lv) => !lv.specimen.kind || lv.specimen.kind === 'trilobite';

/** The bench features for this level: its own, plus what you've learned. */
export function featuresFor(lv, sci) {
  const f = new Set(lv.features);
  if (sci.has('notebook')) f.add('notebook');
  if (sci.has('guide')) f.add('guide');
  if (sci.has('model') && isTrilobite(lv)) f.add('model');
  return [...f];
}

/** Exposure from which leftover rock can be highlighted. Sweeping always starts at 96%. */
export const leftFrom = (sci) => (sci.has('lustre') ? 0.9 : 0.96);

/** Facts you know that bear on this level, as [name, fact]. */
export function factsFor(lv, sci) {
  const out = [];
  for (const n of NODES) {
    if (!sci.has(n.id) || !n.rel?.(lv)) continue;
    out.push([n.name, n.fact]);
  }
  const d = DEPOSITS[lv.id];
  if (d && sci.has('taphonomy')) out.push(['How it lies', d.taph]);
  if (d && sci.has('stratigraphy')) out.push(['Age', `The rock is ${d.age} old.`]);
  return out;
}

/** Knowledge earned by a finished specimen, as [[amount, reason]]. */
export function earned({ first, matrixOk, fossilOk, fitTrue }) {
  const out = [[1, 'a specimen prepared']];
  if (first) out.push([2, 'your first from this deposit']);
  if (matrixOk) out.push([1, 'the matrix identified']);
  if (fossilOk) out.push([1, 'the fossil material identified']);
  if (fitTrue) out.push([2, 'the species identified']);
  return out;
}
