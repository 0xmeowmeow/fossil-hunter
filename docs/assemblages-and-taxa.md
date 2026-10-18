# Real fossil assemblages, easy-to-generate animals, and varied blocks

Research digest, 18 October 2026. Sources are in the full report in the session log (Wikipedia,
AMNH, UCMP, journal papers, plus dealer listings, which are used only for what blocks look like).

**[S]** means sourced. **[K]** means general knowledge, to check before using it in label text.
**[I]** means a design idea.

## Assemblage templates

| Template | Age | Matrix | Contents | How they lie | Gameplay hook |
|---|---|---|---|---|---|
| Moroccan mortality plates (Jorf) | Devonian | hard limestone | several to 14+ *Phacops/Austerops* or *Basseiarges* on one plate [S]; rare spiny extras | one bedding plane, mixed outstretched/enrolled | jackpot multi-trilobite plates; composites and fakes → an authenticity mechanic [S] |
| Walcott–Rust quarry, NY | Ordovician | thin limestone | 18 trilobite species; the "Ceraurus layer" [S]; bryozoans | obrution (rapid burial of the living animals), many enrolled | a named jackpot horizon a few mm thick; appendages as an ultra-rare bonus |
| Wheeler Shale, Utah | Cambrian | grey shale | *Elrathia*, mostly moults (free cheeks missing) [S]; agnostids | flat on bedding | starter blocks; growth-series collections |
| Cincinnatian hash plates | Ordovician | limestone/shale | brachiopods, bryozoans, crinoid columnals, occasional *Flexicalymene* [S] | storm jumble, shells convex-up [S]; mud caps with whole trilobites [S] | "volume" block: lots of low-value finds, a small trilobite chance |
| Wenlock Limestone, Dudley | Silurian | reef limestone | brachiopods, *Favosites/Halysites*, *Calymene*, crinoids [S] | reef vs inter-reef | coral-heavy vs crinoid-heavy blocks |
| Crawfordsville, Indiana | Mississippian | siltstone | 60+ crinoid species, complete crowns, several genera per slab [S] | buried alive, tangled [S] | the crinoid garden; delicate arms |
| Coal measures | Pennsylvanian | roof shale, siderite nodules | *Neuropteris*, *Alethopteris*, *Calamites/Annularia*, *Lepidodendron*, *Stigmaria* [S] | leaf mats on many planes | barren-nodule gamble [S] |
| Mazon Creek | Pennsylvanian | siderite nodules | Braidwood: plants and insects; Essex: *Essexella* commonest, shrimp, *Tully* rare [S/K] | one per nodule, splits part/counterpart [S] | nodule gamble; freeze–thaw |
| Glossopteris beds | Permian | mudstone | *Glossopteris* mats with *Vertebraria* roots [S] | dense overlapping leaves | first chisel-only samples; a "continental drift" exhibit |
| Solnhofen | Jurassic | plattenkalk | *Saccocoma* beds, ammonites, *Mesolimulus*, fish, shrimp [S/K] | death trackways leading to their makers [S] | trail-to-maker reveals |
| Holzmaden | Jurassic | black shale | *Seirocrinus* colonies on driftwood (~50 crinoids) [S], ammonites, ichthyosaurs | flattened, pyritised | multi-session mega-block |
| Lyme Regis / Charmouth | Jurassic | limestone/mudstone, nodules | *Coroniceras* pavement [S], pyrite *Promicroceras* [S], belemnites, *Gryphaea* | | pyrite decay as a museum hazard |
| Whitby nodules | Jurassic | limestone nodules | one *Dactylioceras/Hildoceras* each, positive/negative halves [S] | | one-strike split |
| Lebanon (Haqel, Hjoula, Sahel Alma) | Cretaceous | platy limestone | fish dominate, shrimp, lobsters, octopus with ink (rare) [S] | | rare octopus jackpot; needle prep |
| Green River | Eocene | laminated limestone | *Knightia* mass mortality (24 fish on one plate) [S]; *Diplomystus*, *Mioplosus*, *Priscacara*; leaves, insects; rare birds and bats | split-fish layer vs 18-inch layer [S] | predator-with-prey plates |
| Messel | Eocene | oil shale | insects, fish, frogs, bats; *Darwinius* | | drying hazard; resin transfer [S] |
| Jehol (Liaoning) | Cretaceous | lake shale and tuff | *Lycoptera*, mayfly nymphs, conchostracans, *Confuciusornis* [K] | mass-mortality planes [S] | ash marker bed |
| Florissant | Eocene–Oligocene | paper shale | 1,500+ insect and 150 plant species [S] | | page-turning splits |
| London Clay, Sheppey | Eocene | clay, nodules | *Nypa* fruits, crabs in phosphatic nodules [S] | | crab-in-nodule jackpot |
| Calvert Cliffs | Miocene | sand/clay | shark teeth dominate [S], molluscs, whale bone | | tooth-in-vertebra jackpot |
| Riversleigh | Oligo-Miocene | freshwater limestone | marsupial jaws and teeth; insects in acid residues [S] | | acid-bath surprise roll |
| Burgess Shale | Cambrian | dark shale | *Marrella* ~9.6% of the community [S]; rare *Anomalocaris*, *Opabinia* | | split torn across part/counterpart |
| Extras | | | graptolite shales [S]; mollusc coquinas [S]; ripples, raindrops and mud cracks as bonus surfaces [S] | | |

## Easy parametric animals

The backbone for shells is Raup (1966): a generating curve swept along a log spiral, with three
parameters:
- **W**, how fast the whorl expands;
- **D**, its distance from the axis;
- **T**, how far it moves along the axis.

The recipes:
- **Ammonite:** T = 0, W 1.5–3. Ribs, keel, tubercles. Suture lines appear where the shell is gone.
- **Gastropod:** T > 0.
- **Bivalve:** very high W, two mirrored valves, radial ribs and growth lines.
- **Brachiopod:** two *unequal* valves, a beak, a fold/sulcus, sometimes spiriferid "wings".
- **Crinoid:** a stem of columnal discs, a 5-plate cup, and arms that branch recursively.
  - Arms come off within hours of death and stems last months [S], so loose columnals are the
    filler everywhere.
- **Corals:** horn coral as a curved cone with septa; colonies as Voronoi/hexagon domes
  (*Favosites*) or chain links (*Halysites*).
- **Echinoid:** pentaradial dome with ambulacra.
- **Graptolite:** saw-blade stipes.
- **Glossopteris:** a tongue-shaped leaf with a multi-strand midrib and mesh venation.
- **Fern:** a recursive pinnate structure.
- **Calamites:** a ribbed, jointed stem.
- **Lepidodendron:** bark with a diamond leaf-cushion lattice.
- **Fish:** a fusiform outline, vertebrae with spines, fins.
- **Shark tooth:** a serrated triangle with a two-lobed root.
- **Marsupial molar:** cusp cones on a root.
- **Nautiloid / orthocone:** a straight cone with septa.

## Varying the block

- **Several bedding planes**, with fossils at different depths. The 18-inch layer's non-splitting
  rock is the counter-example [S].
- **Part and counterpart.** Fine detail favours one side [S].
- **Nodules** form around the animal and split through it. Many are barren [S].
- **Fossils off-centre**, sometimes cut by the block edge.
- **Elongate fossils aligned by current** in storm beds, with shells convex-up [S]. In obrution
  beds, orientation is random and specimens are articulated [S].
- **Disarticulation increases with time before burial.**
- **What makes a block exciting:**
  - several complete specimens;
  - an interaction (predator and prey, a snail on a crinoid, a crinoid colony on a log);
  - a trace together with the animal that made it;
  - a rare associate;
  - unusual preservation;
  - a surprise in an acid bath;
  - growth series.
