# Fossil preparation: a survey for game design

Compiled 17 October 2026 from three parallel literature searches (mechanical, chemical and
materials). It covers how each technique removes rock, where it succeeds and fails, how
fast it is, and what damage it does. Section 8 turns this into simulation rules.

**Evidence tags.** **[S]** means sourced; the number points to the list at the end.
**[P]** means widely repeated preparator practice with no single primary citation
checked. **[E]** means a design estimate. All 1–5 scales and 0–1 property values are [E].
Several classic handbooks were cited only through secondary sources: Kummel & Raup 1965,
Rutzky et al. 1994, Leiggi & May, and the full texts of Jeppsson et al. and Lindsay
1987. See "Evidence limits" at the end.

---

## 1. One idea underneath everything: contrast

Every preparation method exploits a **difference between the fossil and the rock**. A
technique works when that difference is large, and fails or destroys the fossil when it
is small or reversed. There are four kinds of contrast.

| Contrast | What exploits it | The hard case |
|---|---|---|
| **Hardness**: the fossil is harder than the matrix | Air abrasion, needles. The ideal abrasive is harder than the matrix and softer than the fossil, roughly 3 Mohs apart [S1]. | A calcite trilobite (Mohs 3) in limestone (3–4): equal hardness, so both erode together. |
| **Chemistry**: the fossil does not dissolve in something that dissolves the matrix | Acids. Phosphate bone survives buffered acetic acid; silica survives HCl [S4, S7]. | Calcite in limestone is the same mineral, so any acid eats the fossil [S9]. |
| **Interface**: a weak "parting" layer between fossil and matrix, such as a clay film, iron-oxide skin or calcite rind | Air scribes, splitting, freeze–thaw. The matrix "pops off" along the boundary [P]. | "Welded" matrix that recrystallised across the boundary. Fractures then run *through* the shell, and you must grind grain by grain [S9]. |
| **Visual**: colour or texture difference | Every manual method: you can see where to stop [P]. | Low contrast leads to overshooting into the fossil. |

The first three map directly onto per-voxel properties. Visual contrast is a rendering
and readability concern, and possibly a "light/UV/magnifier" tool.

The most important consequence for the game: **the classic Moroccan trilobite is the
hard case on two counts.** It has equal hardness and the same chemistry as its matrix.
Interface quality varies, and visual contrast is usually good. That is exactly why these
specimens take tens of hours, and why the tool choice is skill-based rather than "use
acid".

---

## 2. Techniques compared

**Remove** = bulk removal speed. **Prec** = precision. Both are 1–5 [E].

### Mechanical

| Technique | Remove | Prec | Exploits | Succeeds when | Fails when | Main damage |
|---|---|---|---|---|---|---|
| **Hammer & chisel split** | 5 | 1 | Bedding planes and the fossil plane | Fissile shale, laminated limestone. The fossil itself is often the weak plane [S5]. | Massive limestone, pyrite cores, veins across the bedding [S5] | Split crosses the fossil (half on each side); shatter; off-plane fracture. Repeated pounding rarely helps [S5]. |
| **Hydraulic slab splitter** | 5 | 2 | Bedding planes | Large laminated slabs (Solnhofen, Green River) [P] | Same as above | Same, more evenly applied |
| **Freeze–thaw** | idle | 1 | Water expansion along the weakest plane | Siderite concretions such as Mazon Creek, which open along the fossil plane [S5, S17] | Air-locked or pyrite-cored nodules; outer shell flakes leaving a hard core [S5] | Very little. It is slow and its yield is uncertain. |
| **Rock saw** | 5 | 2 | Nothing; it cuts everything | Trimming, flat bases, removing bulk behind the fossil [P] | Hidden anatomy: it cannot see inside the rock | Cutting an unseen spine or tail; vibration spreading cracks |
| **Large air scribe** (CP-9361, ARO, Super Jack) | 4 | 2 | Interface. Each blow fractures matrix, which pops off at the parting [P]. About 13,500 blows/min [S4]. | Hard, brittle matrix with good release [S9] | Soft or plastic clay absorbs the blow. Welded matrix fractures through the fossil. | **Snapped spines** (vibration travels through the rock); cracks spreading in fractured specimens; whole shell pieces popping off |
| **Fine air scribe** (Micro Jack 1–6) | 3 | 4 | Interface | Detail work with release, under a microscope [S3] | Same as the large scribe, at smaller scale | Chatter marks and dings where the stylus touches the shell; local pops |
| **Needle / pin vise / scalpel** | 1 | 5 | Hardness and interface, by hand | Soft or **wetted** shale; some shales soften in water [S10] | Hard rock; it is ineffective there [S2] | Scratches (white lines on dark shell); slips; prying snaps thin parts. Low risk per stroke, but it accumulates. |
| **Micro-grinder / Dremel** | 4 | 2 | Nothing; it grinds everything | Bulk removal away from the fossil [P] | Anywhere near the surface | Gouges, heat, burr skating, torque snaps |
| **Air abrasion, soft media** (sodium bicarbonate, dolomite) | 2 | 4 | Hardness | Soft matrix over a hard shell, e.g. shale over a trilobite [S9]; final clean-up | Equal hardness. Thin shells in sticky shale, even at lowest pressure [S9]. | Light frosting; detail loss. Even bicarbonate removed 13 µm of bone surface [S1]. |
| **Air abrasion, hard media** (aluminium oxide, silicon carbide) | 4 | 3 | Hardness | Hard matrix over a robust fossil | Calcite fossils: it "quickly obliterates detail" [S7] | **Frosted, "melty" surface**; tubercles and eye lenses go first; gouging at steep angles (≥45°) [S1, S7] |
| **Ultrasonic bath** | 2 | 0 | Cavitation loosens clay | Loose clay on robust microfossils [P] | Anything with internal cracks or old repairs | Shattering; opening repairs; disaggregating shale |
| **Laser** (Nd:YAG) | 1 | 5 | Absorption contrast | Thin crusts; no SEM-visible damage on microfossils in tests [S8] | Bulk matrix | Thermal discolouration [P]. A museum-cost tool. |

**Air abrasion working parameters** [S1, S7]:
- **Pressure:** 10–100 psi. About 30 psi for delicate work; 80–100 psi with 27 µm aluminium oxide on unweathered rock.
- **Nozzle:** about 0.75 mm, giving a cut spot of about 1 mm at 10 mm distance. The stream spreads in a cone of about 8°, and doubling the nozzle diameter quadruples the flow.
- **Angle:** keep to 25° or less; steep angles gouge.
- **Rebound:** media bouncing off hollows hits areas you weren't aiming at.

**Media hardness (Mohs)** [S1, S7]. Ordered softest to hardest:
- **Plastic** 2–4: removes paint and resin only.
- **Bicarbonate** 2.5–4: gentlest.
- **Walnut shell** about 3.
- **Dolomite** 3.5–4: the middle ground.
- **Iron powder** about 4: hits harder than its hardness suggests and can darken surfaces.
- **Glass bead** about 6: peens and polishes.
- **Aluminium oxide** 9.
- **Silicon carbide** 9.

### Chemical

| Technique | Speed | Dissolves | Spares | Fails / destroys | Main damage |
|---|---|---|---|---|---|
| **Buffered acetic acid** (3–10%; pH > 3.6) [S1c, S3, S9] | One bath is active for a few hours. About 20 baths for a typical job. Total time ranges from **1–6 weeks to 2.5 years** [S9]. | Calcite and dolomite matrix (dolomite more slowly) | **Phosphate**: bone, teeth, fish, conodonts | Calcite and aragonite fossils. Unbuffered acid etches phosphate too [S1c]. | Salt crystals growing in cracks if rinsing is short; bloom on the surface; loss of unconsolidated fragments; spongy bone collapsing where its cavities were filled with calcite [S9] |
| **Formic acid** (about 5–10%) | About 2× faster: 8–10 cycles instead of about 20 [S4/S5] | Same | Phosphate, with less margin | Same as acetic, plus more bone etching | Same. Mixing formic and acetic acid without washing causes "extreme damage" [S9]. |
| **HCl** | Days | Calcite, dolomite, fast and fizzy | **Silica** (Glass Mountains brachiopods [S7]) | Anything calcareous or phosphatic | Freed silica spines break or fall through the screen. Silica replacement is often coarser than it looks [S7]. |
| **38% sulphuric acid** (niche) [S8] | "Short" | Fine-grained micrite *faster than* coarse fossil calcite | **Calcitic and partly pyritised** fossils in marly limestone | It is a bet on crystal-size contrast | Very risky. **The one acid route for calcite in limestone.** A good rare, expert tool. |
| **HF** | Hours to days | Silicates and silica | Organic-walled microfossils; phosphatic conodonts from chert [S11] | Carbonate fossils (insoluble CaF₂) | Fragments conodonts [S11]. **Lethal** even from small burns. Hot NaOH is the modern alternative [S11]. |
| **EDTA / chelators** | Very slow [E] | Any calcium mineral | Little: it does not discriminate between calcite and phosphate | Bone too [P] | Gentle but non-selective; local cleaning only |
| **Transfer method**: resin on the exposed face, then acid from the back [S6, S12] | Days to cure, then weeks to months of acid | Matrix behind | The skeleton keeps its original layout | Irreversible | Bubbles; resin–bone bond failure; acid creeping under the resin |
| **Freeze–thaw** (shale) | Days of cycles | Pore water expansion | Forams undamaged [S13] | Little | Very little |
| **Hydrogen peroxide** | Hours | Organics, by violent gassing | Robust specimens | **Damages delicate forams**, creating false "barren" layers [S13]; oxidises pyrite [S10] | Breakage; pyrite decay |
| **Kerosene/white spirit, then water** | Overnight | Shale splits as water forces the solvent out | Most specimens | — | Little [P] |
| **Calgon / Quaternary O / Rewoquat** | Hours to days | Clays dispersed or split apart | Most specimens | — | Little. Na₂CO₃ alone gave the most intact specimens [S14]. |
| **Oxalic acid / dithionite + EDTA** (stain removal) | Overnight | Iron-oxide stains | — | Calcite (forms calcium oxalate) [E] | All tested reagents damaged bone [S15]. Not routine. |

**The acid cycle used in practice** [S9]:
1. Remove as much as possible mechanically.
2. Consolidate the exposed bone, with an acid barrier where needed.
3. Acid bath, with the specimen face up on a grid so gas and sludge escape.
4. **Rinse for 2–4× as long as the acid phase.**
5. Dry.
6. Consolidate the newly exposed bone.
7. Repeat.

Each step is a distinct player decision with a distinct failure if skipped. That makes
it a ready-made idle/management loop.

---

## 3. Damage taxonomy

Each damage type needs a different game representation. Detectability matters for
grading and sale: some damage is invisible until later.

| Damage | Caused by | What it looks like | Detected | Repair |
|---|---|---|---|---|
| **Snapped spine / free part** | Scribe vibration; prying; removing support too early; ultrasonic | Missing or detached piece | Immediately | Glue (cyanoacrylate is common but irreversible; B-72 is reversible) costs authenticity [S11, S12] |
| **Fracture through the shell** | Scribe on welded matrix; splitting; saw vibration | Crack, lost flake | Immediately | Glue. Flooding cracks with consolidant *before* scribing prevents it [P]. |
| **Scratch / gouge** | Needle slips, grinder, steep-angle abrasion | White line on dark shell | On inspection, under magnification | Not repairable; a grade penalty |
| **Chatter / dings** | Scribe tip touching the shell | Pitted dots | Under magnification | Not repairable |
| **Frosting / detail loss** | Hard abrasive, close nozzle, long dwell | Matte, "melty" surface; tubercles and eye lenses blurred | Under raking light | Not repairable. The most common way a good specimen becomes a mediocre one. |
| **Acid etching** | Acid on calcite fossils; unbuffered acid on bone | Pitting, loss of surface | After the bath | Not repairable |
| **Salt damage** (efflorescence, crack wedging) | Short rinsing after acid | White crystal bloom; cracks widening **days later** | **Delayed** | Long re-soak if caught early |
| **Fragment loss** | Skipping consolidation between acid baths | Bits in the sludge | After the bath | Partly, if fragments are recovered |
| **Pyrite decay** | Humidity ≥ ~59% RH; leftover salts; water or peroxide treatments [S10] | White/yellow crystal growth, sulphur smell, the specimen splitting apart | **Months later** | Ammonia gas or ethanolamine thioglycolate (which can pit the surface); low-RH or oxygen-free storage [S10, S16] |
| **Over-prep** | Removing the matrix that supports and frames the fossil | A fragile, unsupported specimen; poor display | At the end | Not repairable. An aesthetics penalty. |
| **Restoration / composite** | A player choice | Filled or sculpted parts; parts from other individuals | **UV** shows resin, but not acrylic paint; CT detects composites [S14] | A value and disclosure mechanic |

---

## 4. Rock ⇄ fossil compatibility: the best route for each pair

Ratings:
- **OK**: works well.
- **R**: works, with real risk.
- **X**: destroys the fossil, or there is no route.

The chemical part draws on [S9, S7, S8, S11, S13]; the rest is [P/E].

| Fossil ↓ / Matrix → | Limestone | Shale / mudstone | Siderite or calcareous nodule | Sandstone | Chert | Soft clay |
|---|---|---|---|---|---|---|
| **Calcite** (trilobites, brachiopods, echinoderms) | **Mechanical only**: scribe plus abrasion. Acid **X**, except **R** with 38% H₂SO₄. | Split, then needle or soft abrasion; disaggregate for micros | Freeze–thaw or split, then scribe; acid **X** | Scribe or needle (cement-dependent) | Saw or grind; **X** in practice | Wash and sieve |
| **Aragonite** (nacre ammonites) | Mechanical, very gentle; acid **X** (even more soluble) | Freeze–thaw; peroxide **X** | Split; acid **X** | Needle | **X** | Wash; flakes on drying |
| **Phosphate** (bone, fish, teeth) | **Buffered acid OK**: the textbook case | Mechanical; disaggregation OK | Acid **R** (iron stains); mechanical | Brush and pick, plus consolidant; acid only if carbonate-cemented | NaOH > HF (**R**) | Brush; **consolidate first** |
| **Silica** | **HCl OK**: Glass Mountains | Disaggregation OK | HCl **OK/R** | **X**: the same material as the matrix | **X** | Wash |
| **Pyrite** | Mechanical or acid **R** (decay from salts) | **Abrasion only** (Beecher's Bed [S18]); water and peroxide **R** | Freeze–thaw **R** (pyrite cores resist) | Mechanical | Mechanical | Dry fast; **R** |
| **Carbon film** | Split only | **Split; needle at most**: the film flakes off with the matrix | **Freeze–thaw OK** (Mazon Creek) | **R** | HF + HCl for palynomorphs | **X** |

---

## 5. Material property sheet for the simulation

All values are [E], normalised 0–1, and derived from the sourced Mohs, solubility and
behaviour data. The columns:
- **H** hardness: resistance to abrasion or scribing.
- **T** toughness: resistance to crack growth.
- **B** brittleness: chance that a flake breaks off beyond the tool contact.
- **Aa** acetic-acid solubility.
- **Ah** HCl solubility.
- **W** water/freeze sensitivity.
- **Ad** default adhesion to the fossil: 0 pops off cleanly, 1 is welded.

### Matrix

| Material | Mohs (bulk) | H | T | B | Aa | Ah | W | Ad | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Micritic limestone | 3–4 | .45 | .65 | .40 | .45 | .90 | .10 | .55 | Moroccan matrix |
| Crystalline limestone | 3–4 | .45 | .45 | .60 | .40 | .85 | .10 | .75 | Fractures jump along cleavage |
| Lithographic limestone | 3–4 | .45 | .50 | .65 | .45 | .90 | .15 | .30 | Splits perfectly into plates (Solnhofen) |
| Green River limestone | 2.5–3.5 | .35 | .40 | .45 | .40 | .85 | .30 | .35 | Layers vary; a hard cap layer [S19] |
| Marl | 1.5–3 | .20 | .20 | .30 | .30 | .60 | .80 | .30 | Slakes when wetted and dried |
| Calcareous shale | 2–3 | .25 | .25 | .70 | .25 | .55 | .55 | .35 | Wheeler Shale |
| Black carbonaceous shale | 1.5–3 | .18 | .20 | .75 | .05 | .15 | .65 | .30 | Burgess, Beecher's Bed |
| Oil shale | 1–2.5 | .15 | .50 | .25 | .05 | .10 | .40 | .40 | Rubbery; absorbs scribe blows |
| Mudstone | 2–3 | .20 | .20 | .35 | .10 | .25 | .85 | .30 | |
| Siltstone | 3–5 | .40 | .40 | .40 | .10 | .25 | .45 | .40 | |
| Sandstone, friable | ~1 bulk | .15 | .10 | .20 | .05 | .30 | .70 | .20 | Hell Creek type |
| Sandstone, calcite-cemented | 3–4 | .50 | .50 | .35 | .50 | .90 | .30 | .50 | Disintegrates in acid |
| Siderite concretion | 3.5–4.5 | .55 | .80 | .30 | .02 | .30 | .60 | .20 | Freeze–thaw opens it on the fossil plane |
| Calcareous concretion | 3–4 | .50 | .85 | .30 | .45 | .90 | .15 | .70 | Lyme Regis |
| Phosphatic nodule | 4.5–5 | .65 | .60 | .50 | .05 | .40 | .10 | .70 | |
| Chert / flint | 6.5–7 | .95 | .55 | .90 | 0 | 0 | .20 | .90 | Conchoidal fracture |
| Ironstone | 4–6 | .65 | .70 | .35 | .02 | .35 | .10 | .60 | |
| Volcanic ash / tuff | 1–4 | .20 | .25 | .40 | .05 | .15 | .75 | .30 | Liaoning; swelling clays |
| Unconsolidated clay/sand | <1–2 | .05 | .05 | .05 | .05 | .20 | .95 | .10 | |

### Fossil

| Material | Mohs | H | T | B | Aa | Ah | W | Notes |
|---|---|---|---|---|---|---|---|---|
| Calcite shell | 3 | .35 | .35 | .65 | .50 | .95 | .10 | Cleaves in 3 directions; echinoderm plates cleave as single crystals |
| Aragonite / nacre | 3.5–4 | .40 | .20 | .80 | .60 | 1.0 | .50 | Flakes on drying |
| Recrystallised calcite | 3 | .35 | .40 | .70 | .50 | .95 | .10 | Forces Ad ≈ .8 in calcareous matrix (welded) |
| Bone (phosphate) | 4.5–5 | .50 | .30 | .55 | .05* | .60 | .40 | Porous; consolidant raises T. *Buffered acid. |
| Tooth enamel | ~5 | .60 | .40 | .50 | .03 | .50 | .20 | |
| Silica | 6.5–7 | .90 | .50 | .70 | 0 | 0 | .05 | |
| Opal | 5.5–6.5 | .75 | .20 | .85 | 0 | 0 | .50 | Crazes as it dries |
| Pyrite | 6–6.5 | .85 | .40 | .60 | .05 | .30 | .90 | W here = humidity decay over time |
| Carbon film | ~1 | .05 | .05 | .90 | 0 | 0 | .30 | Lost on almost any contact |
| Limonite | earthy–5 | .35 | .30 | .50 | .05 | .50 | .20 | |
| Mould / steinkern | host | — | — | — | — | — | — | An external mould means the fossil *is* the void: stop at the void wall |

---

## 6. The fossil–matrix interface

These rules come from [S9, S17, S18] and [P].

1. **Parting layer.** A per-boundary value. A clay, oxide or calcite-spar film makes the
   matrix pop off cleanly. Release can **vary within one specimen** [S9].
2. **Welded boundary.** Fossil and matrix recrystallised together. Scribe flakes then
   fracture *through* the shell, so the preparator must grind slowly.
3. **Work from a window outward.** Expose a small known area, such as the glabella or an
   eye, to find the true surface level, then follow it outward [P].
4. **Leave spines supported to the end.** Keep matrix pillars under spines, remove them
   last with abrasion only, and consolidate as you go [P].
5. **Direct force away from the fossil.** Work at a low angle toward the specimen so the
   flake breaks before the tool arrives: "your tool doesn't touch it" [S10].
6. **Part and counterpart.** A split follows the fossil plane. The part keeps most of the
   shell, often in relief. The counterpart keeps the mould plus some fragments. Which
   side keeps more depends on adhesion plus chance [S17].
7. **Voids.** Decay voids and ammonite chambers give a free surface. They are often
   lined with crystals, and their walls collapse if reached carelessly.
8. **Porosity.** Porous bone soaks up acid and consolidant. Porous matrix weathers away
   first, which is why fossils weather out *proud* of the rock surface.

---

## 7. Deposits as locality templates

Timings are given where sourced.

| Locality | Period | Matrix → fossil | Prep | Signature problem / hook |
|---|---|---|---|---|
| **Moroccan Devonian** (Jbel Issoumour, Hamar Laghdad) | Devonian | Micritic limestone → calcite trilobites | Several scribes, then abrasion under microscope [S20] | Welded vs popping matrix; spines snap. About **40–50 h for a *Walliserops***, per dealer anecdote [S15]; about 2–8 h for a simple *Phacops* [E]. Composites and fakes are common [S14]. |
| **Wheeler Shale**, Utah | Cambrian, ~507 Ma | Calcareous shale → calcite *Elrathia* | Split, then abrasion [S21] | Cone-in-cone calcite seams hide or displace specimens [S21] |
| **Cincinnatian**, Ohio | Late Ordovician | Limestone/shale interbeds → calcite *Isotelus*, *Flexicalymene* | Wash off the shale; scribe the limestone | Shale slakes; often enrolled or broken |
| **Beecher's Trilobite Bed**, NY | Late Ordovician | Black shale → **pyrite** *Triarthrus* with legs | **Abrasion only; chemicals destroyed specimens.** About 500 of several thousand were fit to prep [S18]. | Appendages; pyrite decay |
| **Burgess Shale**, BC | Mid Cambrian | Black mudstone → carbon films | Split; needle under microscope; low-angle light | No hardness contrast: the film flakes away |
| **Mazon Creek**, IL | Pennsylvanian | Siderite nodules → film/mould of soft-bodied animals | **Freeze–thaw**: mean 20 cycles (range 2–51); about 30% open after 8 cycles at the best pit, 10% after 20 elsewhere [S5]. Only about 10–15% contain a fossil [S6m]. | A natural gacha / idle mechanic |
| **Solnhofen** | Late Jurassic | Lithographic limestone → calcite/phosphate, feathers | Split along plates; UV [P] | Feather impressions exist only on the split plane |
| **Green River**, WY | Eocene | Laminated limestone → phosphate fish | Knives, needles, scribe, abrasion [S19] | "Ghosted" fish just under a split; a hard cap layer [S19] |
| **Holzmaden** | Early Jurassic | Bituminous shale → bone, pyrite, soft-tissue outlines | Scraping and scribing; about 5 months for one ichthyosaur (auction claim) [S22] | Huge slabs; pyrite |
| **Lyme Regis** | Early Jurassic | Lias limestone/marl, nodules → pyrite/calcite ammonites, aragonite nacre | Scribe, abrasion; split nodules | Pyrite decay; marl slaking; nacre flaking |
| **Morrison** | Late Jurassic | Cemented sandstone/mudstone → bone | Plaster field jacket; scribe; acid where carbonate-cemented | Cracked bone, hard concretions |
| **Hell Creek** | Late Cretaceous | Loose sand/mud → bone | Brushes, picks, **consolidant first** | Bone weaker than the matrix |
| **Liaoning (Yixian)** | Early Cretaceous | Tuffaceous shale → bone, carbonised feathers | Split; needle under microscope | Fakes; feathers lost when scraped |

Mapping to the prototype's localities:
- `devonian_limestone` is Moroccan.
- `cambrian_shale` is Wheeler.
- `ordovician_limestone` is Cincinnatian.
- `pyritised_shale` is Beecher's Bed.

---

## 8. What this means for the game

### 8.1 Per-voxel state

The prototype already has a signed distance field (SDF) and a material ID. Each voxel
then needs:

- **Material ID**, which looks up H, T, B, Aa, Ah, W from §5.
- **Integrity** (0–1): accumulated micro-damage. On a fossil voxel it drives the visible
  grade (frosting, chatter, scratches). Below a threshold the voxel breaks away.
- **Parting** (boundary voxels only): effective adhesion = `Ad × (1 − parting)`.
  Generated per specimen, with patches of good and bad release.
- **Support**: whether this voxel's chunk is still connected to the base. Computed as a
  flood fill or connected components when a voxel is removed, so a spine that loses
  its pillars becomes "unsupported".
- **Salt load / consolidated / wet flags** for chemical prep.

### 8.2 Tool rules

All [E]; tune by play.

- **Abrasion.**
  - Removal ∝ `pressure × max(0, H_media − H_voxel + k)`.
  - Fossil damage per hit ∝ `pressure × max(0, H_media − H_fossil + k')`.
  - Rebound spreads a smaller damage halo around the cone.
  - Angle above 25° adds gouge.
  - Media choice is the real decision. Aluminium oxide is fast, and it ruins calcite
    detail.
- **Air scribe.** Each blow chooses a flake.
  - If the flake reaches a boundary with good parting, it detaches cleanly along the
    boundary. This is the satisfying "pop".
  - If the boundary is welded, the crack continues into the fossil with probability
    ∝ `B_fossil × (1 − T_fossil)`.
  - Vibration also adds snap risk to unsupported fossil parts within a radius,
    ∝ `1 / support`.
  - Large scribes have a bigger flake size and radius.
- **Needle.** Small, precise removal ∝ `(1 − H_matrix)`, and much better on wet shale.
  Slip chance rises with hand speed, and a slip scratches the fossil.
- **Splitting.** Find the plane of least summed toughness through the block: bedding
  laminae plus the fossil plane. Hidden fossils on that plane separate into part and
  counterpart, divided by adhesion with a random term. This is the "sacrifice one
  specimen to reveal another" mechanic from the original brief, physically grounded.
- **Acid.** A timed bath.
  - Removal per cycle ∝ `Aa_voxel` on wetted, exposed voxels.
  - A buffer level drains each cycle, and bone etches when it runs out.
  - Salt load accumulates and is reduced by rinse time. Leftover salt causes **delayed**
    cracks after drying.
  - Bone that is exposed but unconsolidated loses fragments.
  - It only works when `Aa_matrix − Aa_fossil` is large. A calcite trilobite in acid is
    a lesson the player learns once.
- **Freeze–thaw.** An idle-timer action on nodules. It has a per-cycle opening
  probability from the locality data (§7), and the nodule opens on the fossil plane. A
  nodule can also turn out empty.
- **Consolidant / glue.** Raises T and integrity of the treated voxels. Costs a little
  authenticity: B-72 small, visible cyanoacrylate larger. Flooding cracks before
  scribing prevents fractures.

### 8.3 Value and grading

These follow directly from the damage taxonomy (§3):

- **Completeness**: snapped or missing parts.
- **Surface quality**: frosting, scratches, chatter, etching.
- **Presentation**: how well the fossil is framed by its remaining matrix; over-prep
  loses points.
- **Authenticity**: repairs, restorations, composites. The buyer may inspect with UV,
  which reveals resin but not acrylic.
- **Stability**: pyrite and salts carry a decay clock that matters after sale or in
  your museum.

Labour time is part of real-world value: 40–50 hours for a *Walliserops* versus a few
hours for a *Phacops*. In the game, rarity and difficulty are the same thing.

### 8.4 Progression implied by the research

A natural tool-unlock order, with each tool solving a problem the previous ones can't:

1. Hammer and chisel; brush.
2. Needles.
3. Large scribe.
4. Soft-media abrasion.
5. Fine scribe and microscope.
6. Hard media.
7. Acetic acid.
8. Formic acid, HCl, consolidant chemistry.
9. Expert and licensed tools: 38% H₂SO₄, HF/NaOH, laser, the transfer method.

Localities gate which problems you meet: Wheeler's easy release, Moroccan welded
matrix, Beecher's pyrite, Mazon Creek nodules, Green River fish in acid.

---

## Evidence limits

- **Numbers are not universal.** Pressures, media hardnesses, acid concentrations and
  cycle counts are sourced, but each is one lab's or one study's practice.
- **Dealer-anecdote timings** (Walliserops hours, Holzmaden months) are anecdotal.
- **Not verified by search:** Solnhofen terminology, the empty-nodule rate beyond [S6m],
  Liaoning fake prevalence, and the Mohs ranges for bulk rocks.
- **Toombs & Rixon** is dated 1950 (*Museums Journal* 50:105–107) in bibliographies.
  The "1959" date often given may be a miscitation [S6].
- **HF** is used to free phosphate or organic microfossils *from siliceous rock*. It is
  not used for carbonate fossils.
- **Fetch failures:** the AMNH pages returned 403, so they are cited from search
  summaries.

## Sources

**Mechanical**
- [S1] Graham & Allington-Jones 2018, air-abrasive re-evaluation, *Palaeontologia Electronica* 21.2.2T — https://palaeo-electronica.org/content/2018/2279-air-abrasive-fossil-preparation
- [S2] Tanaka et al. 2024, Wada air scribe, *Palaeontologia Electronica* 27(1):a16 — https://palaeo-electronica.org/content/2024/5151-wada-air-scribe
- [S3] Fossil Forum air-scribe threads — https://www.thefossilforum.com/topic/38897-tips-for-buying-an-air-scribe/ , https://www.thefossilforum.com/topic/123797-scribe-comparison/
- [S4] CP-9361 specs (retailer) — https://www.travers.com/cp9361-air-scriber-chicago-pneumatic/p/85-102-082/
- [S5] ESCONI, Mazon Monday 298, freeze–thaw method — https://esconi.org/2025/12/mazon-monday-298-the-freeze-thaw-method/
- [S6m] University of Illinois Extension, Mazon Creek — https://extension.illinois.edu/news-releases/master-naturalists-dig-illinois-ancient-past-mazon-creek-fossil-site
- [S7] Zoic Paleotech, air abrasives (vendor) — https://zoicpaleotech.com/pages/all-about-air-abrasives
- [S8] Laser cleaning: Landucci et al.; Miller et al. 2004 — https://jm.copernicus.org/articles/23/165/2004/
- [S9] Trilobiti.com, prep basics — https://www.trilobiti.com/amp/fossil-preparation-basics-a-short-clip-of-2-different-preparation-techniques
- [S10] Fossil Forum trilobite prep — https://www.thefossilforum.com/topic/76528-trilobite-prep-help/
- [S11] Goldberg & Davidson 2014 (SVP), B-72 — https://vertpaleo.org/wp-content/uploads/2021/03/Goldberg-and-Davidson_2014.pdf
- [S12] Zoic Paleotech, consolidants — https://www.zoicpaleotech.com/pages/consolidants-adhesives
- [S14] Fake trilobites: Le Comptoir Géologique https://www.le-comptoir-geologique.com/fake-trilobite.html ; Corbacho et al. 2019 https://ddd.uab.cat/record/236115
- [S15] FossilEra Walliserops listing (anecdotal) — https://www.fossilera.com/fossils/well-prepared-walliserops-trilobite-3-3

**Chemical** (numbering from the chemical report, with suffixes where it clashes)
- [S1c] Jeppsson, Anehus & Fredholm 1999, *J. Paleont.* 73:964–972 — https://resolve.cambridge.org/core/journals/journal-of-paleontology/article/abs/optimal-acetate-buffered-acetic-acid-technique-for-extracting-phosphatic-fossils/89C081C657ADCBCB37363F92BA4D45DD
- IGME *Boletín* 2012, acetic acid with tricalcium phosphate — https://info.igme.es/media/boletin/2012/123_2/4_ARTICULO_3.pdf
- Lund University Microfossil Laboratory — https://www.geology.lu.se/research/laboratories-equipment/lund-university-microfossil-laboratory
- AMNH Chemical Preparation — https://www.amnh.org/research/paleontology/collections/fossil-preparation/revealing/techniques/chemical-preparation
- Two Medicine Dinosaur Center prep procedures — https://docs.tmdinosaurcenter.org/staff/prep-lab-procedures/preparation-techniques
- [S6] Toombs & Rixon 1950 — https://mci.si.edu/node/1319899
- [S7] Glass Mountains, Butts (Peabody) — https://peabody.yale.edu/sites/default/files/documents/invertebrate-paleontology/ButtsPSP20FinalOPEN.pdf ; Cooper & Grant 1972 — https://repository.si.edu/items/634e99da-ee0e-4c2f-912f-7f3318c95209
- [S8] Sulphuric acid method, *Palaeontology* 52(1):187–192 (2009) — https://palass.org/publications/palaeontology-journal/archive/52/1/article_pp187-192
- [S9] Zoic Paleotech, acid preparation — https://www.zoicpaleotech.com/pages/acid-preparation
- [S10] Tacker 2020, pyrite disease review, *Palaeontologia Electronica* — https://palaeo-electronica.org/content/2020/3159-pyrite-disease
- [S11] HF and NaOH: Rigo et al. 2023; Ford & Lee 1997 — https://jm.copernicus.org/articles/16/158/1997/jm-16-158-1997.pdf
- [S12] Monte Bolca transfer, *Palaeontologia Electronica* 2015 — https://palaeo-electronica.org/content/2015/1190-challenges-monte-bolca-fish
- [S13] Kennedy & Coe 2014, *J. Micropalaeontology* 33:193–203 — https://jm.copernicus.org/articles/33/193/2014/
- [S14] Surfactants and Calgon: Prow et al. 2023 — https://par.nsf.gov/servlets/purl/10457179
- [S15] Iron stain removal, CAC journal vol. 38 — https://www.cac-accr.ca/wp-content/uploads/2018/12/Vol38_doc4.pdf
- [S16] Pyrite at the NHM (Cornish & Doyle 1984) — https://archive.org/download/biostor-165579/biostor-165579.pdf ; NHM Project Airless — https://peerj.com/preprints/3125

**Materials and localities**
- [S17] ESCONI, Mazon Monday 112, concretion splitting — https://esconi.org/2022/05/mazon-monday-112-concretion-shape-from-1952-fossil-paleontology-mazoncreek-mazonmonday-concretions/
- [S18] Beecher/Raymond 1920, *Appendages, Anatomy and Relationships of Trilobites* — https://gutenberg.org/files/41695/41695-h/41695-h.htm
- [S19] Green River prep (forum; dealer) — https://www.thefossilforum.com/topic/111374-green-river-fish-prep/ ; https://www.fossilera.com/fossils/30-fossil-fish-wall-mounted-slab-wyoming
- [S20] Steinkern, *Scabriscutellum* from Morocco — https://www.steinkern.de/english-articles/1197-scabriscutellum-morocco.html
- [S21] Wheeler Shale: UGA dissertation https://openscholar.uga.edu/record/10206 ; FossilEra https://fossilera.com/blog/preparation-sequence-olenoides-trilobite2
- [S22] Holzmaden: Urwelt-Museum Hauff https://www.urweltmuseum.de/english ; auction listing https://www.gazette-drouot.com/en/lots/33736187-important-ichthyosaur-fossil-stenopterygius---
- Farrell, Briggs & Gaines 2011, Beecher's Bed, *PALAIOS* 26 — https://bioone.org/journals/palaios/volume-26/issue-11/palo.2011.p11-050r/
