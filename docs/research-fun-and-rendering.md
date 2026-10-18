# Making Fossil Hunter more compelling, and cheaper and better looking

Compiled 17 October 2026 from three research passes:
1. academic game design;
2. what successful developers say;
3. rendering techniques, including a read of this repo's renderer.

Evidence tags:
- **[E]**: empirical study.
- **[T]**: accepted theory.
- **[F]**: practitioner folklore.
- **[V]**: verified against the source or the code.
- **[I]**: inference.

No change has been implemented from this document yet.

## A. What the research says

### A1. Academic findings that matter here

- **Self-Determination Theory** (Ryan, Rigby & Przybylski 2006) [E]. Three things predicted enjoyment and wanting to replay: competence, autonomy and relatedness. Fossil Hunter scores on the first two. **Relatedness (other people) is near zero.**
- **Lazzaro's four keys** [T]. Fossil Hunter already covers three of the four:
  - hard fun (fiero, beating something difficult);
  - easy fun (curiosity);
  - serious fun (calm, absorbing).
  
  **People fun is missing.**
- **Curiosity is an information gap** (Loewenstein 1994) [T, with experimental support]. It is strongest when the player knows a little but not enough. Uncovering a fossil bit by bit is an almost perfect information gap, and the reveal must close it with something worth knowing, not only confetti.
- **Juice** (Kao 2020) [E]. In a controlled study, medium and high feedback beat both none and extreme on enjoyment, motivation and play time. Too much is as bad as none. Sound counts as juice (Hicks et al. 2024).
- **Easier is more engaging than "optimal challenge"** (Lomas et al. 2013, about 10,000 and 70,000 players) [E]. Let players choose their challenge, and tell them up front how hard it is.
- **Failure must feel like your fault** (Juul 2009/2013) [E]. A cracked shell should read as "I hit too hard", never as "random".
- **Collections pull players back** [E]:
  - Endowed progress (Nunes & Drèze 2006): a loyalty card with 2 of 10 stamps already filled got 34% completion, against 19% for an empty 8-stamp card.
  - The Ovsiankina effect (people resume interrupted tasks) replicates.
  - The Zeigarnik effect (unfinished tasks are better remembered) did **not** replicate in a 2025 meta-analysis.
- **Leaderboards** [E]:
  - They don't raise intrinsic motivation (Mekler 2017).
  - Players with low ranks get demotivated (Philpott; GaLA 2020).
  - Better: a "neighbourhood" view of nearby ranks, a percentile, daily boards, and personal-best framing.
  - **Our −5 points a minute penalises careful, absorbed play.**
- **PowerWash Simulator mood study** (Vuorre et al. 2024; about 162,000 mood reports from 8,695 players) [E, correlational]. Mood rose during play for about 72% of players, mostly early in sessions.
- **Learning built into the mechanic beats learning bolted on** (Habgood & Ainsworth 2011) [E]. Our real techniques *are* the mechanic. Protect that.
- **Dark patterns to avoid** (Zagal et al. 2013):
  - punishing streaks;
  - grinding;
  - "play now or lose it";
  - forced social invites.
  
  Variable *content* (a surprise species) with skill-earned *outcomes* is the ethical version of a variable reward.

### A2. What successful developers say

- **FuturLab (PowerWash Simulator).**
  - "The one word we hear more than any other… 'Satisfying'."
  - Immediate visual progress.
  - No timers or threats.
  - Keep the real thing, drop the real tedium. [Kotaku interview]
- **Witch Beam (Unpacking).**
  - Over 14,000 foley files, recorded per material.
  - The softer material decides the sound.
  - Several variants per sound.
  - Speed-dependent loudness.
  - Short pick-up sounds, because slow ones "felt laggy". [GDC 2022 talk, via Game Developer]
- **Josh Wardle (Wordle).**
  - One puzzle a day, about 3 minutes; it "doesn't want an intense relationship".
  - The spoiler-free share grid was invented by players first.
  - No link in the share text, because it looked "trashy".
- **Owlchemy Labs (Job Simulator).**
  - Simplify reality the way children's toys do.
  - Throw out flat-screen conventions in VR.
  - Perfect the first-time experience.
  - Watch newcomers play twice a week rather than trust analytics.
- **Balatro (LocalThunk).** No score preview: you set it up, then watch it resolve, card by card, with escalating sound.
- **House Flipper reviewers.** The before/after comparison is the magic, and players notice when it's missing.
- **Derek Yu.**
  - "Keep cutting until you get to the very edge of that core."
  - A nice title screen does wonders.
  - The last 10% is the details.
- **Daniel Cook ("Loops and Arcs").** Loops are worth playing again; arcs are content you use up once. Our procedural species turns the reveal into a loop rather than an arc.
- **Chris Zukowski.** A game needs a *hook* (real fossil prep with real fracture physics) and an *anchor*, a familiar comparison that tells buyers what it is ("PowerWash-style satisfying sim"). Players judge in about 45 seconds.
- **Teardown (Gustafsson), Slay the Spire (MegaCrit), Balatro.**
  - Fun to play with comes first.
  - Then iterate on metrics combined with watched playtests.
- **Wardle and Blow.** Both reject manipulative "addictive" design. Daily seeds, collections and craft get the pull without the dark patterns.

### A3. Rendering, reviewed against our code

Ranked by quality gained per cost:

1. **Image-based lighting**: a small PMREM environment map, which three.js can generate from a scene. Specular light currently has nothing to reflect, so gloss, wetness and pyrite look flat. Small effort, large gain, almost free on Quest.
2. **Cache the shadow map** (`shadowMap.autoUpdate = false`, update only when something changes). Right now 450–700k triangles are redrawn into the shadow map every frame. Small effort; the largest GPU saving.
3. **A curvature/cavity attribute**: lighter, rougher convex edges and darker cavities, plus SDF ambient occlusion on rock chunks as well as the fossil. This is the missing middle band of detail that makes stone look like stone. Small effort, zero runtime cost.
4. **Strata coloured per pixel** with a 1D lookup texture, instead of per-vertex colour. Crisp bands up close. Small to medium effort.
5. **Meshing and the fossil build in a Web Worker.** Removes chisel hitches and the 0.6–2 s load stall. Medium effort.
6. **Compact vertex data**: Int16 positions, octahedral normals, Uint8 colour and material values, Uint16 indices. About 3× less memory. Small to medium effort.
7. **Per-pixel normals and AO sampled from a 3D texture of the shape field**, which then lets the fossil mesh drop to about 80k triangles on Quest. Medium effort.
8. **Biplanar/triplanar detail textures** (KTX2) in place of the procedural noise grain. Medium effort.
9. **Specular anti-aliasing on the bump, dithering, and a shadow camera fitted to the block.** Small effort; less shimmer in VR.
10. **Spend the savings on Quest render resolution** (framebuffer scale about 1.2–1.4). Fixed foveation is already at maximum by default in r170. Small effort.

**Don't on Quest:**
- full-block raymarching;
- full-screen post effects (SSAO, bloom, FXAA);
- redrawing the shadow map every frame;
- alpha-blended dust clouds;
- R32F 3D textures (they may not filter on iPad);
- porting to WebGPU just for multiview before XRGPUBinding is confirmed on Quest Browser.

## B. Recommendations: what to do first

See the response in the chat log of 17 October 2026, and section C below.

## C. Proposed order

1. **Feel and payoff** (about 2–3 days):
   - material-aware layered sound;
   - reveal staging: a before/after wipe, the label typed out, the tally counting up;
   - fracture explanations ("struck across bedding, 38°");
   - IBL plus a cached shadow map plus a cavity attribute.
2. **Reasons to return** (about 3–4 days):
   - a daily specimen, shared seed, with its own board;
   - a share card;
   - a collection cabinet with silhouettes and some pre-filled specimens;
   - the leaderboard reshaped: neighbourhood view, percentile, careful vs swift.
3. **Depth** (later):
   - rarities (enrolled, juvenile, predation scar);
   - optional challenge contracts;
   - preparator ranks;
   - sell → sidegrade tools;
   - a VR tool bench;
   - metrics plus watched playtests.
