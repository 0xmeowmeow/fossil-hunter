# Making rock behave like rock: fracture research

Compiled 17 October 2026 after the first beta playtest. The user's verdict: the chisel removes a
"scoop", every tool feels like "removing pixels", and the rock doesn't behave like rock. The
screenshot (`~/Pictures/screenshots/20261017_135611.png`) shows paper-thin shards of
matrix floating over the fossil. They are left behind because pops and erosion edit the
field only inside a sphere, and nothing makes unsupported or thin material break away.

Two parallel searches were run, covering libraries, games and the physics.

**Tags.**
- **[V]** means checked against the linked source.
- **[I]** means inference or a design proposal.

---

## 1. What exists that we can use

| Candidate | What it is | Fit for us |
|---|---|---|
| [three-pinata](https://github.com/dgreenheck/three-pinata) (MIT, v2.0.1 Nov 2025, active) | Real-time Voronoi fracture and plane slicing for three.js, with a separately textured inner face. The Fruit Ninja effect. [V] | Works on meshes, not our voxel SDF. Good for **detached debris**: refracture or slice a chunk when it lands or is hit. Not for the main block. [I] |
| three.js ConvexObjectBreaker | `subdivideByImpact` and `cutByPlane`. Requires convex meshes. [V] | Debris only. |
| [three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg) (MIT) / [manifold-3d](https://github.com/elalish/manifold) (Apache-2.0, WASM) | Mesh booleans. Manifold also has `levelSet(sdf)` and `splitByPlane`. [V] | Not needed on the strike path. Manifold is a possible SDF-to-mesh bridge for chunks. [I] |
| [Rapier](https://github.com/dimforge/rapier) (`@dimforge/rapier3d-compat` 0.21, Apache-2.0, WASM) | Rigid bodies with `convexHull`, `convexDecomposition` and **`voxels`** colliders. [V] | **Debris physics**: fallen chunks tumble, land and settle. Runs on Quest and Safari. |
| [JoltPhysics.js](https://github.com/jrouwe/JoltPhysics.js) (MIT) | Rigid bodies, described as VR-suitable. [V] | Alternative to Rapier. |
| [NVIDIA Blast](https://github.com/NVIDIAGameWorks/Blast) / Unreal Chaos | Chunks joined by **bonds with health**. When the bond graph is cut, the disconnected part falls. [V] | No WASM build, so we **borrow the concept**: bonds and connectivity map directly onto voxels. |
| [three-voxel-destruction](https://github.com/sbobyn/three-voxel-destruction) (MIT) | Teardown-style browser demo: voxel connectivity, collapse when supports are cut, GPU-timed quality. [V] | Technique reference. It needs WebGPU, which is still experimental inside WebXR on Quest. [V] |
| VACD fracture (Müller et al. 2013, [SIGGRAPH](https://history.siggraph.org/?p=108389)) | Places a fracture pattern at the impact and intersects it with the volume, so cracks follow where you hit. [V] | **Key idea for us**: on voxels, intersecting a pattern with the volume is just labelling voxels. |
| Breaking Good (Sellán et al. 2023) | Precomputed fracture modes. [V] | GPL code. Reference only. |
| Physical crack solvers (BEM, phase-field, peridynamics) | — | Too heavy for mobile. [I] |

No published system combines an SDF ground truth, crack surfaces, connected-component
chunking and rigid debris. All four parts exist separately. [V searched / I]

## 2. What has been done in games and simulations

- **Fossil Fighters** (DS): a hammer takes big chunks and a drill does fine work, under a 90 s
  timer, with a damage-scored grade. Praised as addictive ("struggle for perfection").
  Criticised because damage is unavoidable and the timer is arbitrary. [V]
- **Fossil Hunters**: players complained it is "difficult to discern how much you can dig
  before a cave-in". Hidden thresholds feel unfair, so **the rock must show its
  weaknesses**. [V]
- **Teardown**: praised for voxel destruction, but players mock buildings "held up by one
  voxel". **Unsupported material must fall.** [V]
- **Astroneer**: a tool that is too weak for the material deforms it slowly and **throws
  sparks**, which is a clear wrong-tool cue. [V]
- **PowerWash Simulator**: layered dirt, per-part completion and a "cha-ching" when a part is
  done. The model for abrasion and scribing feel. [V]
- **VRex** (Unity VR student project), **Virtual Zipscribe** (NHM Los Angeles exhibit) and
  **Dinosaur Fossil Hunter**: their prep appears to be progress-driven, not fracture-driven.
  This leaves room for a game that does real fracture. [V/I]
- **Virtual knapping:** Orellana Figueroa et al. 2021 ([PMC8497608](https://pmc.ncbi.nlm.nih.gov/articles/PMC8497608/))
  is a GAN that predicts the removed volume from a depth map of the core. Code is on OSF.
  The Brockley Axe VR knapping project compares controller haptics with hand tracking. [V]

## 3. The physics, reduced to game rules

From the knapping experiments of Dibble, Rezek, McPherron and colleagues, and from rock
mechanics:

1. **Threshold, then flake.** Below the energy a flake needs, a blow only crushes (dust and
   a dent). Above it, the flake releases. Surplus energy adds side cracks and damage, not a
   proportionally bigger flake. [V basis]
2. **Bite depth sets size.** Platform depth alone explains about 88% of flake mass
   (R² 0.885). A steeper free-face angle (exterior platform angle, EPA) amplifies it. A
   starting model is `mass ≈ k·PD^n·f(EPA)`, with n between 2 and 3. [V / I]
3. **Angle limits the bite.** A blow straight into the platform (0°) removed nothing deeper
   than 8 mm. Tilting the blow 20–40° roughly doubled the depth that could be removed. [V]
4. **The chisel head picks the mode.**
   - A narrow wedge of about 30° chips and splits.
   - Blunt wedges of 90° or more crush.
   - A wide bolster near an edge spalls off a slab.
   - A point crushes a crater and sends out radial cracks.

   Cone size grows with tip radius, following the Hertz contact radius ∝ (load·radius)^⅓.
   [V / I]
5. **Bedding decides the fracture path.** A blade within about 10–15° of the bedding plane,
   struck from the side, splits a whole layer: the "lucky split". At 30–75° to bedding the
   fracture is stepped and broken. Preparators split shale with the chisel parallel to the
   bedding, tapping the sides, and never strike toward the fossil. [V]
6. **Cracks seek free surfaces and existing flaws.**
   - A thin margin breaks out.
   - A crack jumps onto joints and earlier cracks.
   - A split without enough mass on both sides blows out sideways.

   [V]
7. **Damage accumulates.** Each blow leaves microcracks that lower the toughness nearby.
   Hammering near the fossil eventually cracks it. [I, preparator practice]
8. **The fossil is a plane of weakness.** Concretions split along the fossil, giving part and
   counterpart. Some shales split through it instead. [V]
9. **Cues before and after the blow.** Show bedding lines and hairline joints. A ring means a
   clean split and a thud means crushing. Then failure feels earned. [V lesson]

Useful numbers [V]:
- The Hertzian cone flares about 22° from the surface (interior angle about 136–138°).
- Wedges of about 30° chip; 90° or more crush.
- A point is held about 90° to hard stone and 70° or less to soft stone.

## 4. Recommended architecture [I]

**Keep the voxel SDF as the ground truth and add a fracture layer on top.** The scribe and
abrader really are subtractive tools, and the SDF suits them. Rock breaking needs four
additions:

1. **A hidden toughness field per specimen.** It combines:
   - weak bedding planes;
   - a few joints (planar, low toughness);
   - the fossil–matrix parting;
   - per-voxel accumulated damage;
   - noise for luck.

   Joints and bedding are shown faintly on the rock as cues.
2. **Strike: a crack grows.** The crack is a cost-weighted front grown from the contact
   point inside a local brick:
   - it is shaped by chisel angle and head, and steered toward free surfaces;
   - it snaps onto weak planes;
   - it is limited by an energy budget.

   Below the energy threshold the blow only crushes. This is VACD/Blast thinking applied to
   voxels.
3. **Separation.** Connected components of rock that are cut off from the anchored base
   (the crack surface counts as a barrier) become **debris**:
   - their voxels are moved into a small SDF;
   - the small SDF is meshed with the same surface nets;
   - the mesh is dropped into Rapier as a rigid body;
   - it fades out once it settles.

   The fossil fractures the same way and can come out segmented.
4. **Every tool runs a support and thin-flap pass**, so nothing paper-thin or floating
   survives. This fixes the shards in the screenshot.

three-pinata is optional, for refracturing debris when it lands.
