# Design v3: the museum game

From the user's brief on 17 October 2026. This returns the game to its original premise: you are a
museum curator, and the fossil preparation is the work you do. It builds on `design-v2.md`
(preparation) and `research-fun-and-rendering.md` (evidence).

## Premise

You inherit or buy a small, run-down museum. It comes with **5–10 random fossils** already on
display. They are of various kinds and qualities, and give you a collection that is partly
filled from the start. You also have some starting money.

## Core loop (career mode)

1. **Buy batches** of rock from real-style **sites** (deposits). A batch is a mix:
   - mostly easy specimens;
   - a couple of medium ones;
   - one or two **really hard** ones.

   Every sample shows a **difficulty rating**, estimated from its matrix and the site. What's
   inside stays unknown.
2. **Prepare** samples at the bench. Players can sell the hard ones on, or **keep them in storage**
   until they have the tools and skill to free the really good specimens.
3. **Finish** the specimen. This craft is part of the score and the value:
   - sculpt the pedestal (Moroccan-style height transitions around the edge, levelled and shaped
     surplus rock);
   - flatten the underside for display;
   - identify the species correctly;
   - write the label (site, age, who found it, when).
4. **Display** it, or sell it in the **gift shop** or to other museums.
5. Build **dioramas and themed displays**, which earn more than single pieces:
   - a set of variants from one area;
   - comparative displays (one feature across groups);
   - sheer collection size.

   Small museums can thrive as **specialists**.
6. Spend earnings on more rock, tools and upgrades.

No timers. Difficulty is shown per sample.

## Content: beyond trilobites

Trilobites are only the prototype. Procedural generation matters most here: unknown poses,
**groupings** (crinoid gardens, mass mortality slabs) where skill and chance decide what shows on
the final piece, and a growing roster:
- **Glossopteris and other leaf fossils.** These are ultra-easy, chisel-only first samples:
  - one good strike splits the slab and reveals the leaf (part and counterpart);
  - where you strike changes the result;
  - push-your-luck splitting: crack it again for a cleaner, thinner slab, or keep what you have;
    every thinner slice risks ruining it.
- **Crinoids**: clusters, stems and calyces, many per block.
- **Ammonites**, **fish**, and later vertebrates.

The very first samples are **chisel only**.

## Feedback while working

- A **live specimen score**: the same formula that grades the finished piece, updated in real time.
- **Combo-style praise** for good actions, for example "Clean split!", or "Way to go!" when a strike
  uncovers a big section.
- Feedback that **escalates as the piece nears completion**.
- From about **95% exposed**, the remaining bits are subtly highlighted.
- A **strike preview** (see below).

## Social

- **Museum visits** in the spirit of Animal Crossing: other players walk through your museum.
  - Real human visitors act as a **profit multiplier** for the host.
  - Visiting costs the visitor nothing, unless they buy from the gift shop.
- **Export** a finished fossil or display as a rotating GIF or video for Facebook, Instagram, X
  and so on.
- **Popularity**: engagement with shares feeds back into the museum's popularity.
- **Trading**: surplus rock, specimens and so on, through safe, trustless exchanges.
- **The leaderboard becomes a world ranking of museums.** It allows several kinds of success:
  revenue, specialist rankings, popularity.
- The goal is a community that works together towards the best overall set of museums.

## Modes

- **Daily ("Wordle") mode** for casual players. Everyone gets the same sample each day. Daily
  players can still **sell their specimens on the market** and spend the revenue on more games or
  blank rock.
- **Career mode** as above.

## Decisions and recommendations (Claude, 17 October 2026)

### Strike simulator

**Yes**, as a *probabilistic* preview rather than an exact one.
- Run the real fracture solver several times with jittered inputs (contact point, toughness noise,
  luck) in a Web Worker. Draw the results as a fuzzy "likely crack" cloud plus the most likely
  outcome: flake, split or crush.
- Precision scales with progression: sharp on the first chisel-only samples (training wheels),
  vaguer on hard samples, and improved by skill and upgrades (a loupe, experience).
- This keeps the skill and the luck while making failure feel fair: you saw the risk and took it.

### Popularity from likes

The platform APIs (Meta Graph, X) don't give reliable or cheap access to likes on users'
personal posts.

**Recommendation:** every export carries a link to the specimen or museum page, and popularity
counts unique visits through shared links, which we can measure ourselves.

### Smart contracts

Not as blockchain, at least at first. The reasons:
- Wallets, transaction fees and scams.
- Player backlash.
- **Legal risk.** Random batches plus tradeable items with real-money value is close to how
  loot boxes are regulated, for example in Belgium and the Netherlands.

**Recommendation:** a **server-escrowed market** gives the same "trustless" atomic trades
(both sides commit, the server swaps), with an in-game currency that can't be cashed out.

### Visitor multiplier abuse

Count unique accounts per museum per day, with diminishing returns, and verify by email.

### Storing finished specimens

Store them as **seed + compressed final mesh** (meshopt-compressed GLB, about 100–300 KB). Other
players' museums then render without the voxel simulation.

## Roadmap

| Phase | Contents |
|---|---|
| **P0 (bench)** | Strike preview. Chisel-only Glossopteris splitting samples. Live specimen score with combo feedback and highlighting of the last 5%. A difficulty rating on each sample. |
| **P1 (career, single player, local save)** | Inherit a museum with 5–10 starting fossils, plus money. Sites and batches. Storage. Prepare → display/sell. A simple gallery. Gift shop. |
| **P2 (content)** | Generators for crinoid clusters, ammonites and leaves. Poses and groupings. Finishing craft: pedestal, base, ID and label. |
| **P3 (daily and share)** | Daily specimen. GIF/MP4 export with a tracked link. |
| **P4 (online)** | Accounts (email magic link). Cloud save. Asynchronous museum visits. World museum rankings and specialist rankings. |
| **P5 (economy)** | Server-escrow market for rock and specimens. Themed displays and dioramas with scoring. |

## Additions (user, 17 October 2026, later)

- **Before/after shows how it was done.** The finish shows a ghost of the original rock, plus
  the planes and regions each tool removed: chisel fracture planes, scribe areas and abrasion,
  each in its own colour.
- **Fun first, care later.** Early on, reward chisel-cracking along big, obvious fault lines.
  The game may suggest leaving the final prep for later, so the player can display a lot of
  specimens at about 85%. Later, with better tools and skill, they come back and tidy them up.
  85 → 100% should look and feel great, and reaching 100% should grant something extra (for
  example, more rendered detail or a special feature).
- **Audio priorities:**
  - music matters more than lots of sound samples;
  - haptic feedback rather than lots of sound;
  - a few satisfying noises, including slot-machine-style reward sounds for good moments.
- **Repair.** A damaged sample can be repaired. Repair does not restore integrity, but it gives
  some reward (presentation value). This matches real practice: restored and repaired specimens
  are displayed, and labelled as such.
- **Lots of easy fossils next:** crinoids, bivalves, marsupial teeth, leaves, fish, corals and so on.
- **Varied blocks.** Size, shape and orientation should vary, fossils should sit off-centre and
  at angles, and there can be **more than one specimen** in a block. A first slab with two or
  three trilobites is a big moment. Use real assemblages of things that occur together.

## Additions (18 October 2026)

- **Export the finished piece:** `.glb` with colours (Blender, other games, decoration, AR) and
  `.stl` in millimetres (3D printing). *Done*: buttons on the finish card.
- **A cheesy lexicon** for big moments: "Prehistoric!", "The rock just went extinct!" and so on.
  *Done*: `web/src/lexicon.js`, covering big flakes, splits, combos, exposure milestones and
  extra specimens.
- **The readout** was docked away from the tool, and the **chisel blow can be called off**
  (Esc, right-click, a second finger, or the VR grip). *Done.*

## Additions (18 October 2026, after two playtests)

- **Balance is working.** Holding the large scribe trades speed for damage, and the player
  happily took the penalty to finish faster. Keep the tool trade-offs as they are.
- **The first package: Lightning Ridge.** After the first completed specimen: "A package has
  arrived. Open it now, or put it in the mail room?" It is a block of Lightning Ridge opal dirt
  (claystone). A chisel strike cracks it open to show a freshwater bivalve that is partly
  **opalised**: random patches, random percentage, real play-of-colour. It sells for a lot.
  The game tells the player that fossils from here are rare, so choose wisely.
  *Done.* A sliver of the shell shows through a worn scuff in the shincracker (the miners' name
  for the hard opal dirt), and that sliver is always opalised, so the parcel flashes colour
  before the first strike (`specimen.peek`).
- **Partial fossils.** Not every animal is complete. The game must still say when the
  excavation is complete, and also that the specimen is partial (with an estimate of how much of
  the animal is there).
- **Later: an amber mode**, for collecting and preparing amber.
- **Shark teeth.** They're in every fossil shop, because they were everywhere.
- **Minecraft import/export**, and a **fossicking lease**. Levels become deposits: get a lease,
  the area is populated, the player decides how to cut it up, and those chunks become the blocks
  they work on. The player names each chunk, so they remember what they were excited about.
- **Engagement and analytics.** The user asked for maximal attention engineering and usage data.
  Decision recorded in the chat (18 October 2026):
  - build strong, honest pull: variable *content* (what's inside), skill-earned outcomes,
    collections, discovery and juice;
  - collect anonymous gameplay telemetry to tune it;
  - do not use casino mechanics on a game with tradeable items (near-miss engineering, losses
    disguised as wins, compulsion around money), because of the legal and ethical risks.

## Additions (18 October 2026, after a friend's playtest)

From a playtest by a friend of the user, plus the user's follow-ups. All *done* and deployed:
- **The last 1–2% isn't fun.** 99% of the shell bare now counts as 100% (`EXPOSE_FULL`). From
  98%, the HUD offers **Show leftovers** (the rock still on the shell pulses amber) and **Sweep
  the rest** (brushes it away with no harm, so players can wrap up or keep going).
- **Loose rock falls away.** Rock cut clean off from the specimen (no connection to the fossil)
  tumbles off as debris when the player pauses (`Tools.dropLoose`).
- **The underside.** The chisel braces the side the block rests on, which follows how the block
  is turned. A blow from underneath braces the top. Before this, the base was always anchored
  and underside blows did nothing.
- **Wet surface has a purpose.** Wet rock darkens where shell lies just beneath (within about
  4.5 cm), so it shows where to work. A first-use tip explains it.
- **Marks on rocks.** Field numbers in marker, museum numbers on white paint, glued typed
  labels, price stickers, "TOP" (`marks.js`). Most go on the underside. Ink shows only on the
  original weathered surface, so chiselling removes it. On the Lightning Ridge parcel, the
  miner circles the glint and writes a note ("Go gently! – Bev"), with the opal field on the
  underside.
- **Display bench.** After Finish: **Prepare for display**. Choose an oval, round or custom
  outline (up to 16 clicked corners), saw the base flat, and set the edges from a clean saw cut
  to natural. It previews live, never cuts the fossil, and **Mount it** bakes the shape
  (+8% presentation). Exports use the mounted shape.
  - Still to do: decimate the baked mesh. The fine shell dominates file size, so a trim only
    cut a test STL from 27 to 23 MB.
- **Opal, take two** (after the user's playtest: "looks like oil"). Play-of-colour is now
  Bragg diffraction from 3D domains, each with its own lattice-plane tilt and sphere size.
  A domain flashes only when light and eye line up with its planes, so the fire moves as you
  turn the stone. Three layers below the surface give depth, inside a body from black (N1)
  to light (N7). Each opal is graded: body tone, brightness B1–B5, top colour (red is rarest
  at 14%), and pattern (pinfire to harlequin, which is 6%). These multiply into a value with a
  deep tail: 1 in 10 is worth about 2.7× and the rare best about 10×. A buyer's note gives a
  range from "similar sales", because opal pricing is judgement. Sweep now appears from 96%.
