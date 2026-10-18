# Design v2: discovery first, legible tools

From the user's playtest feedback on the first web beta (17 October 2026). This document
supersedes the "damage-focused" parts of the beta. The research behind it is in
`preparation-survey.md` and `fracture-research.md`.

## Principles (from the user)

1. **The joy is discovery.** *What is hidden inside?* Protect that first.
2. **Predict, then execute.** The core loop is reading the available information, predicting
   what a tool will do, and then doing it. Reward good prediction highly.
3. **Don't punish, except carelessness.** Early on, mistakes should teach rather than
   penalise. Only dumb or careless use should really cost you. Getting >95% should be
   achievable once you have identified the rock, the fossil and the right tool. 100% is hard
   but possible. On difficult specimens, >95% takes skill, fine motor control and planning.
4. **Tone down damage; focus on removal.** No sad "X cracked" messages. Show a **fossil
   integrity %** instead. It is a value multiplier, and it shows *how* each tool is
   interacting with the fossil.
5. **Look at the rock as you would in real life.** Fossil and matrix differ in reflectivity
   and texture as well as colour. A tiny matte speck on a glossy shell should read as rock.

## Features

### A. Field guide and identification (discovery)

- Each locality has a **field guide**: candidate trilobites known from that deposit, each a
  generated species card with a silhouette, size range and features (spines, eyes, tail
  shield). Real-world basis: preparators know a deposit's fauna.
- **Optional:** narrow the candidates down as features appear: genal spines visible, eye
  size, segment count.
- **Identify the materials** with real tests on a spot of the specimen:
  - **loupe:** close look at grain and lustre;
  - **scratch test:** steel needle; calcite scratches, pyrite doesn't;
  - **acid drop:** dilute HCl fizzes on calcite and limestone; shale barely fizzes; pyrite
    doesn't;
  - **wetting:** water darkens the rock and raises fossil/matrix contrast. Preparators really
    do this.

  The player then records their guess for matrix and fossil.
- **Prep recommendation.** From the player's *guesses*, the game recommends tools, media and
  pressure for each stage (bulk, near the fossil, finishing). A wrong guess gives a wrong
  plan; the integrity readout reveals that quickly, and the player recalibrates.

### B. The mind model (the player's "hit box")

- A translucent mesh that stands for **the player's belief about where the fossil is**. It
  starts as a simple ovoid that the player places and scales.
- **Choosing a genus** from the field guide reshapes it to that genus's envelope (the range of
  shapes for it), at the current position, heading and size.
- The player can **pull or shrink** it by hand to fit what has been uncovered, even through
  rock.
- **It protects what is inside it from careful tools.** A competent operator would not
  deliberately blast away what they believe is fossil.

| Tool | Respects the mind model? |
|---|---|
| Air scribe | Yes |
| Air abrader | Yes (spray stops at it) |
| Chisel | **No**: a hammer blow breaks rock wherever the crack runs |
| Chemicals (later) | **No** |

- So a generous model leaves rock that you must shrink the model to clear. A model that is
  too tight lets tools reach the fossil. Refining the model *is* the skill.

### C. Tools as vectors

- The air scribe and the abrader are shown as a **vector from the tool to the work**. The
  ray continues **dotted through the rock** to where it would exit. This lets you see what
  lies along the line of action before you act.
- **The angle matters and is controllable:**
  - **VR:** controller pose.
  - **iPad:** Apple Pencil tilt, or an angle gizmo (a sticky dot on a small hemisphere).
  - **PC:** the gizmo, or Alt+drag.
- **Scribe physics:** removal is strongest along the stylus axis. A shallow angle lifts and
  pops thin matrix (good); a steep angle into the shell dings it.
- **A live interaction readout near the tool:** what the current tool does to what it is
  touching right now. It shows the *actual* material behaviour, not the player's guess:
  matrix removed (rate) and fossil integrity change.

### D. Lighting and examination

- Physically distinct materials:
  - **Rock:** matte and granular, with a procedural micro-normal grain.
  - **Calcite shell:** smooth, satin sheen.
  - **Pyrite:** metallic.
  - **Damage:** pyrite dulls rather than turning grey; calcite frosts to a pale matte.
- A **movable raking light** (drag to swing it) and a loupe zoom.
- A **wet** toggle that darkens the rock and adds gloss, as when preparators wet a surface
  to read contrast.

### E. Rock behaves like rock

- **No floating shards.** After any edit, rock that is disconnected or paper-thin breaks
  away as small debris with dust.
- **The chisel** (later phase), as in `fracture-research.md`:
  - pick a head, set the angle, hold to charge, and the hammer animation plays on release;
  - a crack grows through a toughness field made of bedding, joints, the fossil parting,
    accumulated damage and some luck;
  - severed pieces fall as rigid debris.

### F. Scoring

- **Exposure %** (as now) × **integrity %** × presentation → value.
- Integrity is shown live; it drops visibly, with a brief highlight where the loss happened.
  No failure toasts.

## Status (17 October 2026, end of session)

- **Phase 1 (feel and legibility): done.** Consistent bite rules, the integrity readout,
  lustre and grain materials, the light dial, wetting, vector aim with a through-rock
  line, the live readout, breakaway of thin flaps and islands, and smoothed strokes.
- **Phase 2 (discovery): done for 2D.** Field guide with silhouettes, the mind model
  (place, fit a species, pull/push, rotate and scale, height) and protection for the
  scribes and abrader. **Not yet:** mind-model editing in VR; there is no "agreement"
  feedback in the UI yet (`MindModel.agreement()` exists).
- **Phase 3 (identification and planning): done.** Needle, acid and loupe tests, guesses,
  a plan from the guesses, and a correctness check on the results screen.
- **Phase 4 (fracture chisel): done.**
  - Toughness field: bedding, joints, damage and the fossil parting.
  - Cone, bedding, blade and joint candidates, with a matrix skin left on the shell.
  - Debris meshes and the press, lean, wind-up, release interaction in 2D and VR.
  - Strike time on desktop: about 60 ms for a crush or flake, about 0.6 s for a full
    shale split (a candidate for a Web Worker).

## Phases

1. **Feel and legibility:**
   - fix the tool/material consistency bugs;
   - add the integrity readout and value multiplier;
   - materials and lighting (reflectivity, grain, movable light, wet);
   - the vector aim with a through-rock ray and angle control;
   - the live interaction readout;
   - remove floating shards and thin flaps.
2. **Discovery:** the field guide and species cards; the mind model mesh (place, scale,
   genus fit, push/pull brush) and protection for the scribe and abrader.
3. **Identification and planning:** loupe, scratch, acid and wet tests; recording guesses;
   prep recommendations.
4. **The fracture chisel** and rigid debris (Rapier).
