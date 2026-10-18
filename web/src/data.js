// Body plans, materials, tools and levels.
// Material numbers come from docs/preparation-survey.md section 5 (design estimates, 0-1).

export const ARCHETYPES = {
  ptychopariid: {
    n_thorax: [11, 14], ceph_len: [.32, .38], pyg_len: [.07, .11], ceph_halfwidth: [.42, .5],
    ceph_shape: [1.8, 2.3], thorax_front: [.92, 1.0], thorax_taper: [.5, .65], pyg_shape: [1.6, 2.4],
    n_pyg: [2, 3], axial_ratio: [.22, .28], height: [.06, .085], glabella_len: [.6, .75],
    glabella_front: [.7, .9], glabella_height: [.12, .25], eye_x: [.5, .6], eye_y: [.4, .55],
    eye_size: [.03, .05], genal_spine: [.02, .12], genal_angle: [.05, .2], pleural_spine: [0, .02],
    occipital_spine: [0, 0], tail_spine: [0, 0], pyg_spines: [0, 0], tubercles: [0, .1], border: [.5, .8],
  },
  redlichiid: {
    n_thorax: [14, 18], ceph_len: [.27, .34], pyg_len: [.03, .05], ceph_halfwidth: [.48, .6],
    ceph_shape: [1.9, 2.4], thorax_front: [.88, .98], thorax_taper: [.3, .5], pyg_shape: [1.5, 2.5],
    n_pyg: [1, 1], axial_ratio: [.24, .3], height: [.065, .09], glabella_len: [.82, .95],
    glabella_front: [1.0, 1.3], glabella_height: [.2, .35], eye_x: [.42, .55], eye_y: [.35, .6],
    eye_size: [.08, .12], genal_spine: [.35, .75], genal_angle: [.05, .25], pleural_spine: [.08, .18],
    occipital_spine: [0, .08], tail_spine: [0, .05], pyg_spines: [0, 0], tubercles: [0, .15], border: [.3, .6],
  },
  asaphid: {
    n_thorax: [8, 8], ceph_len: [.33, .39], pyg_len: [.28, .36], ceph_halfwidth: [.46, .55],
    ceph_shape: [2.0, 2.8], thorax_front: [.95, 1.0], thorax_taper: [.8, .95], pyg_shape: [1.8, 2.6],
    n_pyg: [4, 7], axial_ratio: [.26, .32], height: [.1, .14], glabella_len: [.55, .75],
    glabella_front: [.9, 1.15], glabella_height: [.08, .2], eye_x: [.45, .55], eye_y: [.35, .5],
    eye_size: [.045, .07], genal_spine: [0, .25], genal_angle: [.05, .2], pleural_spine: [0, 0],
    occipital_spine: [0, 0], tail_spine: [0, 0], pyg_spines: [0, 0], tubercles: [0, .05], border: [.3, .6],
  },
  phacopid: {
    n_thorax: [11, 11], ceph_len: [.3, .36], pyg_len: [.16, .23], ceph_halfwidth: [.4, .48],
    ceph_shape: [1.6, 2.1], thorax_front: [.95, 1.02], thorax_taper: [.5, .68], pyg_shape: [1.7, 2.4],
    n_pyg: [5, 8], axial_ratio: [.3, .36], height: [.12, .17], glabella_len: [.88, .98],
    glabella_front: [1.5, 1.9], glabella_height: [.45, .7], eye_x: [.55, .64], eye_y: [.3, .45],
    eye_size: [.07, .1], genal_spine: [0, .04], genal_angle: [.05, .15], pleural_spine: [0, 0],
    occipital_spine: [0, 0], tail_spine: [0, 0], pyg_spines: [0, 0], tubercles: [.5, 1.0], border: [.2, .4],
  },
  dalmanitid: {
    n_thorax: [11, 11], ceph_len: [.27, .33], pyg_len: [.22, .3], ceph_halfwidth: [.45, .52],
    ceph_shape: [1.4, 1.9], thorax_front: [.93, 1.0], thorax_taper: [.55, .7], pyg_shape: [1.3, 1.8],
    n_pyg: [8, 11], axial_ratio: [.27, .33], height: [.09, .13], glabella_len: [.85, .95],
    glabella_front: [1.2, 1.55], glabella_height: [.3, .5], eye_x: [.5, .6], eye_y: [.35, .5],
    eye_size: [.07, .1], genal_spine: [.2, .45], genal_angle: [.05, .2], pleural_spine: [0, .04],
    occipital_spine: [0, 0], tail_spine: [.2, .45], pyg_spines: [0, 0], tubercles: [.2, .5], border: [.2, .5],
  },
  odontopleurid: {
    n_thorax: [9, 10], ceph_len: [.3, .36], pyg_len: [.1, .15], ceph_halfwidth: [.45, .55],
    ceph_shape: [1.8, 2.4], thorax_front: [.92, 1.0], thorax_taper: [.6, .8], pyg_shape: [1.6, 2.4],
    n_pyg: [2, 3], axial_ratio: [.3, .38], height: [.1, .14], glabella_len: [.8, .92],
    glabella_front: [.85, 1.05], glabella_height: [.3, .5], eye_x: [.45, .55], eye_y: [.3, .45],
    eye_size: [.04, .06], genal_spine: [.4, .85], genal_angle: [.15, .4], pleural_spine: [.25, .5],
    occipital_spine: [.1, .3], tail_spine: [0, 0], pyg_spines: [2, 4], tubercles: [.6, 1.0], border: [.1, .3],
  },
};

export const INT_PARAMS = new Set(['n_thorax', 'n_pyg', 'pyg_spines']);

// H hardness, B brittleness, T toughness (resistance to a crack running through it),
// fiss: how much weaker the bedding planes are (shale splits easily, limestone hardly).
export const MATRICES = {
  black_shale: { name: 'Black carbonaceous shale', fizz: 0.05, loupe: 'Very fine, dull and earthy; flakes away in paper-thin sheets along the bedding.', H: .18, B: .75, T: .22, fiss: .05, colours: ['#2a2a2c', '#333234', '#252528', '#3b3936'] },
  calc_shale: { name: 'Calcareous shale', fizz: 0.45, loupe: 'Fine, dull, slightly gritty; splits into thin plates.', H: .25, B: .7, T: .26, fiss: .04, colours: ['#77746a', '#6b6a63', '#827d70', '#5f5f5a'] },
  shaly_limestone: { name: 'Shaly limestone', fizz: 0.8, loupe: 'Fine-grained, with thin clay partings between harder layers.', H: .4, B: .5, T: .45, fiss: .15, colours: ['#a59a85', '#b3a892', '#968c79', '#aca189'] },
  micrite: { name: 'Micritic limestone', fizz: 1, loupe: 'Dense and very fine-grained, almost porcelain-like; breaks unevenly, barely along bedding.', H: .45, B: .4, T: .65, fiss: .3, colours: ['#b8a68a', '#c4b396', '#ab9a80', '#bcaa8a'] },
  sand: { name: 'Loose sand and clay', fizz: 0.1, loupe: 'Rounded sand grains in clay; crumbles under a fingernail.', H: .08, B: .3, T: .08, fiss: .5, colours: ['#b49a74', '#a88e69', '#bfa57d', '#9c8463'] },
  opal_clay: { name: 'Opal dirt (claystone)', fizz: 0, loupe: 'Pale, chalky kaolinite claystone (the miners call the hard band "shincracker"); soft and smooth, with flecks of grey potch.', H: .14, B: .45, T: .16, fiss: .2, colours: ['#d9d6cf', '#cfcbc2', '#e2dfd8', '#c7c2b8'] },
  grey_micrite: { name: 'Grey micritic limestone', fizz: 1, loupe: 'Dense, very fine-grained grey limestone; breaks unevenly.', H: .45, B: .4, T: .65, fiss: .3, colours: ['#55524d', '#5e5a54', '#4d4a46', '#58544e'] },
};

// gloss: how smooth the surface is (0 matte .. 1 mirror). metal: metallic lustre.
// marked: what tool marks turn the surface into (pyrite dulls and tarnishes, calcite frosts pale).
export const FOSSILS = {
  pyrite: { name: 'Pyrite', kind: 'pyrite', fizz: 0, loupe: 'Brassy, metallic lustre; tiny crystal faces glint.', H: .85, T: .55, colour: '#c9a345', gloss: .75, metal: .9, marked: '#6f5a35' },
  calcite_dark: { name: 'Calcite (dark)', kind: 'calcite', fizz: 1, loupe: 'Glassy to satiny lustre; flat cleavage faces catch the light.', H: .35, T: .4, colour: '#2b2622', gloss: .62, metal: 0, marked: '#8d867a' },
  calcite_brown: { name: 'Calcite (brown)', kind: 'calcite', fizz: 1, loupe: 'Glassy, honey-brown; cleavage faces catch the light.', H: .35, T: .4, colour: '#6a4a30', gloss: .55, metal: 0, marked: '#b39a7e' },
  calcite_pale: { name: 'Calcite (pale shell)', kind: 'calcite', fizz: 1, loupe: 'Cream calcite shell with fine growth lines.', H: .35, T: .4, colour: '#cdb89a', gloss: .45, metal: 0, marked: '#e6dccb' },
  enameloid: { name: 'Enameloid (tooth)', kind: 'apatite', fizz: 0.1, loupe: 'Glassy, near-black enameloid; the root is brown and dull.', H: .65, T: .5, colour: '#2a2a2e', gloss: .8, metal: 0, marked: '#77787c' },
  opal: { name: 'Opal (potch and precious)', kind: 'opal', fizz: 0, loupe: 'Translucent grey potch shot through with flashes of colour.', H: .72, T: .3, colour: '#8d9aa6', gloss: .9, metal: 0, marked: '#b7bcc0', opal: true },
  calcite_grey: { name: 'Calcite (grey)', kind: 'calcite', fizz: 1, loupe: 'Satiny grey; faint cleavage glints, smoother than the rock around it.', H: .35, T: .4, colour: '#3f3c38', gloss: .6, metal: 0, marked: '#8f8b84' },
};

// Abrasive media. H on the same 0-1 scale as materials.
export const MEDIA = {
  bicarb: { name: 'Sodium bicarbonate', short: 'Bicarb', H: .3 },
  dolomite: { name: 'Dolomite', short: 'Dolomite', H: .45 },
  alox: { name: 'Aluminium oxide', short: 'Al₂O₃', H: .95 },
};

// Radii are in voxels. depth: how fast the tool digs a pit at its centre, in voxels per
// second at full pressure into rock of zero hardness. rate: blows per second at full stroke.
export const TOOLS = {
  chisel: { kind: 'chisel', name: 'Hammer & chisel', short: 'Chisel', radius: 3, popDepth: 3, vibRadius: 45, vib: 2.2, chargeTime: 1.1 },
  scribe_large: { kind: 'scribe', name: 'Air scribe (large)', short: 'Large scribe', radius: 5.5, depth: 46, popRadius: 7, popDepth: 4, vibRadius: 26, vib: 1.0, rate: 30 },
  scribe_fine: { kind: 'scribe', name: 'Air scribe (fine)', short: 'Fine scribe', radius: 2, depth: 19, popRadius: 3.5, popDepth: 3, vibRadius: 10, vib: 0.25, rate: 30 },
  abrader: { kind: 'abrader', name: 'Air abrader', short: 'Abrader', spot: 2.6, depth: 170, rays: 18 },
};

// Chisel heads. width: blade width in voxels. beta: half-angle of the fracture cone it
// starts (a point makes a wide Hertzian cone; a sharp wedge a narrow one). The pref values
// weight which kinds of crack the head favours: splitting along its blade, opening a
// bedding plane, or a cone (flake / crater).
export const HEADS = {
  wedge: { name: 'Splitting wedge', short: 'Wedge', width: 2.5, beta: 45, pref: { blade: 1.0, bed: 1.0, joint: 0.9, cone: 0.75 } },
  bolster: { name: 'Bolster (wide)', short: 'Bolster', width: 9, beta: 55, pref: { blade: 0.8, bed: 1.1, joint: 0.8, cone: 1.0 } },
  point: { name: 'Point', short: 'Point', width: 1, beta: 65, pref: { blade: 0.25, bed: 0.4, joint: 0.5, cone: 1.0 } },
};

// Energy of a full-force blow with the heaviest hammer, in toughness x voxel-face units.
// A small edge flake in shale costs ~30, in limestone ~150; opening a whole shale bedding
// plane ~500; cleaving a limestone block in half ~4000 (beyond any blow).
export const E_MAX = 1200;

// The contrast ladder: hardness contrast, interface release and colour contrast all shrink.
// parting: base + variation * noise, clamped 0-1. 1 = matrix pops off cleanly, 0 = welded.
// Tools and features arrive as they're needed. `fresh` lists what's new on this level, for
// the intro card.
// Tools and features arrive as they're needed. `fresh` lists what's new on this level, for
// the intro card. `difficulty` is 1-5. Hidden levels are reached another way (the mail room).
export const LEVELS = [
  {
    id: 'beecher', title: 'Black shale', place: 'Ordovician, New York', difficulty: 1,
    blurb: 'Something golden glints in soft black shale. The shale is far softer than whatever is inside it.',
    matrix: 'black_shale', fossil: 'pyrite', parting: { base: .9, vary: .05, freq: 3 },
    specimen: { seed: 101, archetype: 'ptychopariid', pure: true, count: 1, partialChance: 0 }, value: 120,
    tools: ['chisel', 'abrader'], media: ['bicarb', 'dolomite'], features: [],
    fresh: [
      ['Hammer & chisel', 'Press on the rock, drag to lean the chisel, hold to wind up, release to strike. Flakes come off edges; a blow along a bedding plane can split a whole layer.'],
      ['Air abrader', 'A jet of fine powder. It only cuts what is softer than the powder: bicarbonate is gentle, dolomite faster.'],
    ],
  },
  {
    id: 'wheeler', title: 'Grey shale', place: 'Cambrian, Utah', difficulty: 1,
    blurb: 'Grey shale, a dark shell. The shale is only a little softer than the shell, but it lets go cleanly.',
    matrix: 'calc_shale', fossil: 'calcite_dark', parting: { base: .82, vary: .1, freq: 3 },
    specimen: { seed: 7, archetype: 'ptychopariid', pure: true }, value: 180,
    tools: ['chisel', 'scribe_large', 'abrader'], media: ['bicarb', 'dolomite'], features: [],
    fresh: [['Large air scribe', 'A vibrating carbide point that chips rock away along its line. A low, lifting angle pops thin matrix off the shell; straight down into the shell marks it.']],
  },
  {
    id: 'calvert', title: 'Cliff sands', place: 'Miocene, Maryland', difficulty: 1,
    blurb: 'Crumbly sand from a sea cliff, packed with the things that sank to the bottom of a warm Miocene sea.',
    matrix: 'sand', fossil: 'enameloid', parting: { base: .9, vary: .05, freq: 3 },
    specimen: { seed: 23, kind: 'shark_tooth', mix: [{ kind: 'bivalve', n: [1, 3] }, { kind: 'gastropod', n: [0, 2] }], partialChance: 0.15 }, value: 160,
    tools: ['chisel', 'scribe_large', 'abrader'], media: ['bicarb', 'dolomite'], features: [],
    fresh: [['Soft sand', 'This matrix barely holds together. The abrader eats it; a chisel just crumbles it. Mind the shells.']],
  },
  {
    id: 'cincinnati', title: 'Shaly limestone', place: 'Late Ordovician, Ohio', difficulty: 2,
    blurb: 'A storm bed: a jumble of shells around something bigger. The rock is harder than the shells, so abrasives cut the fossils faster than the rock.',
    matrix: 'shaly_limestone', fossil: 'calcite_brown', parting: { base: .65, vary: .2, freq: 3 },
    specimen: { seed: 31, archetype: 'asaphid', pure: true, count: 1, mix: [{ kind: 'brachiopod', n: [2, 5] }, { kind: 'bivalve', n: [0, 2] }] }, value: 300,
    tools: ['chisel', 'scribe_large', 'scribe_fine', 'abrader'], media: ['bicarb', 'dolomite'], features: ['notebook'],
    fresh: [
      ['Fine air scribe', 'A smaller point for close work around the shell.'],
      ['Notebook', 'Scratch, acid and loupe tests to identify the rock and the shell, and a plan that follows from your identification.'],
    ],
  },
  {
    id: 'lyme', title: 'Blue Lias', place: 'Early Jurassic, Dorset', difficulty: 3,
    blurb: 'A coiled shape in a grey limestone ledge, with frilly lines where the chambers were. Beautiful, if you can get it out whole.',
    matrix: 'shaly_limestone', fossil: 'calcite_pale', parting: { base: .6, vary: .25, freq: 3 },
    specimen: { seed: 57, kind: 'ammonite', mix: [{ kind: 'bivalve', n: [0, 2] }], partialChance: 0.25 }, value: 380,
    tools: ['chisel', 'scribe_large', 'scribe_fine', 'abrader'], media: ['bicarb', 'dolomite'], features: ['notebook'],
    fresh: [],
  },
  {
    id: 'phacops', title: 'Tan limestone', place: 'Devonian, Morocco', difficulty: 3,
    blurb: 'Same hardness, same mineral: shell and rock. Some patches pop, some are welded. Watch the lustre.',
    matrix: 'micrite', fossil: 'calcite_dark', parting: { base: .5, vary: .35, freq: 4 },
    specimen: { seed: 12, archetype: 'phacopid', pure: true }, value: 420,
    tools: ['chisel', 'scribe_large', 'scribe_fine', 'abrader'], media: ['bicarb', 'dolomite', 'alox'], features: ['notebook', 'guide'],
    fresh: [
      ['Aluminium oxide', 'The hardest powder. It cuts anything - including the shell.'],
      ['Field guide', 'The trilobites known from this deposit. One of them is in your block.'],
    ],
  },
  {
    id: 'spiny', title: 'Spines in limestone', place: 'Devonian, Morocco', difficulty: 4,
    blurb: 'Something spiny. Spines snap once the rock around them is gone: leave them propped until last.',
    matrix: 'micrite', fossil: 'calcite_dark', parting: { base: .45, vary: .35, freq: 4 },
    specimen: { seed: 44, archetype: 'odontopleurid', pure: true }, value: 900,
    tools: ['chisel', 'scribe_large', 'scribe_fine', 'abrader'], media: ['bicarb', 'dolomite', 'alox'], features: ['notebook', 'guide', 'model'],
    fresh: [['Your model', 'Sketch where you think the fossil is. Scribes and the abrader will not cut inside it, so a good model lets you work right up to the shell.']],
  },
  {
    id: 'ghost', title: 'Grey on grey', place: 'Devonian, Morocco', difficulty: 5,
    blurb: 'Welded matrix, nearly the same colour as the shell. Only a faint difference in lustre tells you where to stop.',
    matrix: 'grey_micrite', fossil: 'calcite_grey', parting: { base: .3, vary: .35, freq: 5 },
    specimen: { seed: 63, archetype: 'dalmanitid', pure: true }, value: 1400,
    tools: ['chisel', 'scribe_large', 'scribe_fine', 'abrader'], media: ['bicarb', 'dolomite', 'alox'], features: ['notebook', 'guide', 'model'],
    fresh: [],
  },
];

// Reached through the mail room, not the drawers.
export const SPECIAL = {
  ridge: {
    id: 'ridge', title: 'A parcel of opal dirt', place: 'Early Cretaceous, Lightning Ridge, NSW', difficulty: 1, hidden: true,
    blurb: 'A lump of pale shincracker, posted by a miner you met once. Most opal dirt holds nothing at all, but a sliver of shell is showing through this one, and it flashes colour. Fossils from here are rare. Make it count.',
    matrix: 'opal_clay', fossil: 'opal', parting: { base: .92, vary: .05, freq: 3 },
    specimen: { seed: 777, kind: 'bivalve', count: 1, partialChance: 0.35, size: { bivalve: [0.7, 0.95] }, opal: true, peek: 0.018 }, value: 1600,
    tools: ['chisel', 'abrader'], media: ['bicarb'], features: [],
    fresh: [['Opalised shell', 'Over millions of years, silica replaced this freshwater mussel\'s shell, and parts of it turned to precious opal. Follow the glint showing through the shincracker. One clean split should open it. Gently.']],
  },
};
