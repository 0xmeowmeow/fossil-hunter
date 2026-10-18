// The field guide: candidate trilobites known from a level's deposit, one of which is the
// animal in the rock. Genera are real; species names are invented. Each card gives typical
// anatomy (for the mind model to fit to), a size range and the features to look for.

import { ARCHETYPES } from './data.js';
import { Rng } from './rng.js';

const GENERA = {
  ammonite: ['Dactylioceras', 'Promicroceras', 'Asteroceras', 'Coroniceras', 'Arnioceras'],
  gastropod: ['Turritella', 'Ecphora', 'Conus', 'Busycon', 'Naticarius'],
  bivalve: ['Chesapecten', 'Glycymeris', 'Astarte', 'Mercenaria'],
  bivalve_opal: ['Hyridella', 'Velesunio'],
  brachiopod: ['Rafinesquina', 'Platystrophia', 'Hebertella', 'Mucrospirifer'],
  crinoid: ['Macrocrinus', 'Agaricocrinus', 'Dorycrinus', 'Scytalocrinus', 'Onychocrinus'],
  leaf: ['Glossopteris'],
  shark_tooth: ['Otodus', 'Carcharocles', 'Isurus', 'Hemipristis', 'Galeocerdo'],
  ptychopariid: ['Elrathia', 'Asaphiscus', 'Modocia', 'Ehmaniella'],
  redlichiid: ['Olenellus', 'Redlichia', 'Bristolia', 'Wanneria'],
  asaphid: ['Isotelus', 'Asaphus', 'Ogygiocarella', 'Megistaspis'],
  phacopid: ['Phacops', 'Eldredgeops', 'Reedops', 'Geesops'],
  dalmanitid: ['Dalmanites', 'Odontochile', 'Huntonia', 'Coronura'],
  odontopleurid: ['Kettneraspis', 'Dicranurus', 'Leonaspis', 'Selenopeltis'],
};

const SYL = ['ki', 'ra', 'mon', 'tel', 'lu', 'sa', 'ver', 'tor', 'na', 'cri', 'bo', 'li', 'den', 'ma', 'gu', 'phi'];
const ENDS = ['ensis', 'i', 'atus', 'osus', 'ianus', 'ella', 'ops'];

function epithet(rng) {
  let s = '';
  const n = 2 + rng.int(2);
  for (let i = 0; i < n; i++) s += SYL[rng.int(SYL.length)];
  return s + ENDS[rng.int(ENDS.length)];
}

/** A plausible name for an animal of this group. */
export function speciesName(arch, rng) {
  const g = GENERA[arch];
  return `${g[rng.int(g.length)]} ${epithet(rng)}`;
}

export const GROUP_NAMES = {
  ammonite: 'ammonite', gastropod: 'sea snail', bivalve: 'bivalve', brachiopod: 'brachiopod', shark_tooth: 'shark tooth',
  crinoid: 'crinoid (sea lily)', leaf: 'Glossopteris leaf',
  bivalve_opal: 'opalised freshwater mussel',
  ptychopariid: 'ptychopariid trilobite', redlichiid: 'redlichiid trilobite', asaphid: 'asaphid trilobite',
  phacopid: 'phacopid trilobite', dalmanitid: 'dalmanitid trilobite', odontopleurid: 'spiny odontopleurid trilobite',
};

/** Mid-range anatomy for an archetype (the "typical" animal on its card). */
function typical(arch) {
  const r = ARCHETYPES[arch], a = {};
  for (const [k, [lo, hi]] of Object.entries(r)) a[k] = (lo + hi) / 2;
  a.n_thorax = Math.round(a.n_thorax);
  a.n_pyg = Math.round(a.n_pyg);
  a.pyg_spines = Math.round(a.pyg_spines);
  a.glabellar_furrows = 2;
  return a;
}

function features(a) {
  const f = [`${a.n_thorax} thoracic segments`];
  if (a.genal_spine > 0.3) f.push('long genal spines');
  else if (a.genal_spine > 0.1) f.push('short genal spines');
  else f.push('rounded head corners');
  if (a.pleural_spine > 0.15) f.push('spiny margins');
  if (a.tail_spine > 0.1) f.push('long tail spine');
  if (a.occipital_spine > 0.08) f.push('neck spine');
  if (a.pyg_len > 0.2) f.push('large tail shield');
  else if (a.pyg_len < 0.07) f.push('tiny tail');
  if (a.eye_size > 0.075) f.push('large eyes');
  if (a.glabella_front > 1.4) f.push('bulbous glabella');
  if (a.tubercles > 0.45) f.push('covered in tubercles');
  return f;
}

function shellFeatures(sp) {
  const a = sp.spec.anatomy, f = [];
  if (a.kind === 'ammonite') {
    f.push(`${a.whorls.toFixed(1)} whorls`, a.ribs ? 'ribbed' : 'smooth', a.k < 0.34 ? 'open coil (evolute)' : 'tight coil (involute)');
    if (a.keel) f.push('keeled');
    f.push('suture lines');
  } else if (a.kind === 'gastropod') f.push(`${Math.round(a.whorls)} whorls`, a.T > 2 ? 'tall spire' : 'low spire', a.ribs ? 'ribbed' : 'smooth');
  else if (a.kind === 'bivalve') f.push(a.ribs ? `${a.ribs} radial ribs` : 'smooth', a.Hb ? 'both valves' : 'single valve', 'growth lines');
  else if (a.kind === 'brachiopod') f.push(`${a.ribs} ribs`, a.wing ? 'winged hinge' : 'rounded', a.fold ? 'fold and sulcus' : 'no fold');
  else if (a.kind === 'crinoid') f.push(`${a.arms} arms`, a.spread > 0.8 ? 'crown fanned open' : 'crown closed', 'stem of disc columnals', 'cup of calcite plates');
  else if (a.kind === 'leaf') f.push('tongue-shaped blade', 'strong midrib', 'net (reticulate) veins', a.torn ? 'torn edge' : 'whole margin');
  else if (a.kind === 'shark_tooth') f.push(a.serr ? 'serrated edge' : 'smooth edge', Math.abs(a.curve) > 0.15 ? 'curved crown' : 'upright crown', 'bilobed root');
  if (sp.opalFrac) {
    const o = sp.opal;
    const tone = o.tone <= 4 ? 'black opal' : o.tone <= 5 ? 'dark opal' : 'light opal';
    f.unshift(`${Math.round(sp.opalFrac * 100)}% opalised`, `${tone} (N${o.tone})`, { blue: 'blue fire', green: 'green and blue fire', orange: 'orange to blue fire', red: 'red fire, full spectrum' }[o.top], o.pattern, `brightness B${o.bright}`);
  }
  if (sp.completeness < 0.97) f.push(`partial (${Math.round(sp.completeness * 100)}% of the animal)`);
  return f;
}

/** Field guide for a specimen: the true animal plus look-alikes and locals, shuffled. */
export function fieldGuide(sp) {
  const rng = new Rng(sp.spec.seed * 7 + 3);
  const kind = sp.spec.kind ?? 'trilobite';
  if (kind !== 'trilobite') {
    const g = GENERA[sp.opalFrac ? 'bivalve_opal' : kind];
    return [{
      genus: g[rng.int(g.length)], species: epithet(rng), archetype: sp.opalFrac ? 'bivalve_opal' : kind, anatomy: sp.spec.anatomy, isTrue: true,
      size: '', features: shellFeatures(sp),
    }];
  }
  const trueArch = sp.spec.archetype;
  const others = Object.keys(ARCHETYPES).filter((a) => a !== trueArch);
  const picks = [];
  while (picks.length < 3) {
    const a = others[rng.int(others.length)];
    if (!picks.includes(a)) picks.push(a);
  }
  const cards = [];
  const make = (arch, isTrue) => {
    const g = GENERA[arch];
    const anatomy = isTrue ? { ...sp.spec.anatomy } : typical(arch);
    // Body length in cm: the real one is ~5 cm; others vary.
    const len = isTrue ? 5 : 3 + rng.next() * 6;
    return {
      genus: g[rng.int(g.length)], species: epithet(rng), archetype: arch, anatomy, isTrue,
      size: `${(len * 0.8).toFixed(1)}–${(len * 1.2).toFixed(1)} cm`, features: features(anatomy),
    };
  };
  cards.push(make(trueArch, true));
  if (sp.completeness < 0.97) cards[0].features.push(`partial (${Math.round(sp.completeness * 100)}% of the animal)`);
  // A close relative of the real one: same group, different genus - the hard choice.
  const rel = make(trueArch, false);
  const tg = cards[0].genus, gl = GENERA[trueArch];
  rel.genus = gl[(gl.indexOf(tg) + 1 + rng.int(gl.length - 1)) % gl.length];
  cards.push(rel);
  for (const a of picks) cards.push(make(a, false));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
