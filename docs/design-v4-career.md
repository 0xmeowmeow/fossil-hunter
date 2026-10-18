# Design v4: the career game (VR first)

From the user's brief on 18 October 2026. This builds on `design-v3-museum.md`. The auction
designed there is **parked**. When it comes back it includes **attending other players'
auctions**.

## Inspiration: the Australian Fossil and Mineral Museum, Bathurst

The real museum behind the game. It is the Somerville Collection: over 5,000 objects
gathered over one person's lifetime and shown in an 1876 former schoolhouse. Only about a
quarter of the collection is on display at any time.

It has two galleries:
- **Fossils:** life on Earth from the first single-celled organisms to an elephant-bird egg.
  It has a striding *T. rex* skeleton, Australia's largest collection of fossils in amber, and
  opalised fossils.
- **Minerals:** crystals from over 100 Australian mine sites; gems such as diamond, sapphire,
  ruby and emerald; a metre-tall amethyst geode; and more than 100 thumbnail specimens.

What the game takes from it:
- one collector's lifetime collection;
- a heritage building you grow into;
- storage far bigger than the display;
- fossils, amber and minerals side by side;
- a showpiece that fills the hall.

## The shape: Kerbal's balance of play and management

Most time is spent hands-on at the bench or a dig site. Management happens between sessions
and gives each session a reason. As in KSP, three currencies pull against each other, and
failure is a spectacle, not a punishment.

| Currency | Earned by | Spent on / gates |
|---|---|---|
| **Funds** | gift shop, visitors, school groups, tours, sales | rock lots, leases, tools, building |
| **Reputation** | complete and honest displays, contracts, good tours | better sites, rarer lots, bigger contracts |
| **Knowledge** | identifying finds, completing series, contracts, prep milestones | the science track (tools, techniques, sites, facts) |

**Time.** There are no timers. Days advance when the player ends a session: they finish a prep,
come back from a dig, or open the museum for a day. Visitors, school groups and new lots happen
per day.

## The museum

- **Halls and cases.** You start with a small heritage building with one hall. It expands into
  wings: fossils, opal, amber, minerals. Storage is always bigger than the display.
- **Gift shop.** Two parts:
  - **Junk shelves:** plush trilobites, rubber dinosaurs, polished-pebble bags, postcards.
    They are stocked in bulk and bring steady cash with no skill involved.
  - **The specimen cabinet:** your own prepared specimens for sale. A cabinet piece sells only
    at **auction** (parked) or **to another player visiting your museum**, who takes it home
    to their own museum.
- **Curated tours.** Pick a route through your cases and write a short card for each stop. A
  finished tour can be taken by other players, and it brings in **school groups** for money and
  reputation. A tour scores well for coverage (a story through time, a theme) and for
  completeness and honest labels.

## Contracts (the spine of direction)

Contracts come from museums, universities, film crews, schools and collectors. Each one sets a
goal and a reward in funds, reputation, knowledge or a rare lot. Examples:
- "A complete *Phacops* above 90% integrity."
- "A growth series of three *Elrathia*."
- "An opalised shell for a documentary."
- "Sort the acid residue from a Riversleigh block."
- "Run a school tour covering the Palaeozoic."

Contracts should teach. Each one points the player at a technique, a site or an idea.

## Raw material: how rock arrives

- **Bulk lots.** These come up over time by chance, on a day-by-day noticeboard: "deceased
  estate: 40 kg of Wheeler shale", "quarry clear-out", "a dealer's mixed box". Each shows a
  difficulty and hints. What's inside stays unknown.
- **Rewards.** Contracts and tours can pay in rock: a parcel, a lease offer, a famous lot.
- **Dig sites (leases).** Buy a lease on a deposit. In VR you go there: work a face or a
  pit, decide where to cut, extract blocks, name them, and haul them home to storage. Each site
  has real assemblages (see `assemblages-and-taxa.md`): Wheeler, Cincinnati, Morocco, Lightning
  Ridge, Riversleigh, a Baltic amber beach.
- **Mail.** Parcels like the Lightning Ridge one, triggered by progress.

## The science track (learning built in)

This is the KSP tech tree, but the nodes are **ideas as well as tools**. Unlocking a node:
- **gives a capability:** a tool (fine scribe, acid bath, micro-abrasion, CT scan), a technique
  (consolidant, repair), a site, or a test (fizz, loupe, UV);
- **adds the fact where it matters:** after you learn "trilobites moulted", moult specimens show
  a tag in the field guide, the auction catalogue and your tour cards, with a one-line
  explanation. Knowledge appears in the world at the point of use, not in a quiz.

Example branches:
- **Preparation:** chisel → air scribe → fine scribe → abrasion media → acid → consolidants
  and repair → CT scan, so you can see inside before cutting.
- **Palaeontology:** identification → anatomy (spines, eyes, moults) → taphonomy (why fossils
  lie as they do) → stratigraphy (dating a block from its matrix and associates).
- **Mineralogy:** hardness, lustre and streak → crystal systems → gem cutting and polishing.
- **Amber:** forming, fakes and the UV test → inclusions → polishing and cutting windows.

Knowledge comes from doing: a first identification of a genus, a completed growth series, a
correct matrix identification, a contract, a prep milestone.

## New material

- **More fossils.** Next taxa: crinoids, corals, echinoids, fish, plants (Glossopteris, ferns),
  marsupial teeth, then vertebrate bones. They build on `shells.js` and the assemblage templates.
- **Gemstones and minerals.**
  - *Geodes:* crack or saw open, a hidden-inside jackpot.
  - *Crystals in matrix:* clean with care; the crystals are brittle.
  - *Rough gems:* sapphire, opal; cut and polish them, with a simple faceting mini-game.
- **Amber.** Polish rough amber to reveal inclusions (insects, plants) without overheating or
  cracking it. Real fakes (copal, plastic) are caught with the UV, hot-needle and saltwater
  tests from the science track.

## Platform: VR first, Meta Quest 3S as the benchmark

- Everything must hold 72 fps on a Quest 3S. Budgets:
  - the fracture solver and loose-rock pass in a Web Worker;
  - a smaller voxel grid and coarser fine shell in VR;
  - few draw calls, baked lighting in the museum;
  - simplified meshes for finished specimens on display.
- **Diegetic interface.** No HTML panels in VR: a wrist menu, a clipboard for contracts, a
  noticeboard for lots, a field guide as a book, and physical tool racks.
- **Places:** the bench (workshop), the museum (walkable), and dig sites. You teleport or walk
  between them.
- Desktop and iPad keep working, as the second-class views.

## Build order (proposed)

1. **Save and resume, storage, a day cycle** (local). Prepared and unprepared pieces persist.
2. **VR performance pass** on the existing bench: the Worker, budgets, and the diegetic wrist
   menu. Profile against the 3S with the emulator, then on the device.
3. **Walkable museum in VR:** one heritage hall, cases you place specimens in, visitors per day,
   junk shelves in the gift shop.
4. **Contracts board, plus lots arriving on the noticeboard.**
5. **Science track v1:** a handful of nodes, plus facts shown where they matter.
6. **New material:** crinoids and Glossopteris (chisel-only), then a geode, then amber.
7. **Tours and school groups,** then the specimen cabinet and player visits (online phase).
8. **Dig sites** (leases, cutting blocks in VR).
9. Auctions return, including attending other players' auctions.
