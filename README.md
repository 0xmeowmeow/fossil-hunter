# Fossil Hunter

A fossil-preparation game for iPad, PC and Meta Quest 3S. Buy or collect fossil-bearing
rock, work the matrix off with brushes, scrapers, air abrasion and acid, then display or
sell the specimen. Later: expeditions to deposits by period, multi-specimen blocks where
exposing one fossil can sacrifice another, and museum curation. Real techniques where
possible; gameplay wins over realism.

## Design references

- [`docs/preparation-survey.md`](docs/preparation-survey.md): real preparation techniques,
  how each succeeds and fails, its damage modes and speed, rock/fossil compatibility, a
  material property sheet, and proposed simulation rules.

## Web beta: rock + fossil + tools (`web/`)

A playable build for iPad, PC and Meta Quest (WebXR) from one URL. No build step:
plain ES modules with three.js from a CDN.

```sh
cd web
./serve.py              # desktop: http://localhost:8000
./serve.py --https      # iPad / Quest on the LAN: https://<this-ip>:8443, accept the cert warning
```

WebXR needs HTTPS except on localhost, which is why `--https` makes a self-signed certificate.
Add `?level=phacops&seed=12` to jump straight into a level.

**Levels: the contrast ladder.**

1. Pyrite in black shale: huge hardness contrast, clean release, gold on black.
2. Wheeler *Elrathia*: small hardness contrast, clean release.
3. Cincinnatian *Isotelus*: the matrix is harder than the shell, so abrasives cut the fossil first.
4. Moroccan *Phacops*: the same hardness and mineral; patchy release.
5. Spiny odontopleurid: spines snap once the rock supporting them is gone.
6. Grey on grey: welded matrix and low colour contrast.

**Tools.**
- **Hammer and chisel** (wedge, bolster or point heads). Press to set the chisel, drag to
  lean it, hold to wind up, and release to strike. Real brittle fracture
  (`web/src/fracture.js`): a crack takes the cheapest path the blow can pay for. Bedding
  planes, joints, earlier damage and a clean fossil parting are all weak. Edge flakes come
  away, blows into the middle of a face crush, and a side blow along a weak shale bedding
  plane splits the layer off. Where the crack meets the fossil it follows the shell if it
  parts cleanly and cuts through where it's welded. Pieces fall as debris.
- **Large and fine air scribes:** vector aim with a through-rock line of action. A low
  angle pops thin matrix; a steep blow marks the shell.
- **Air abrader** with bicarbonate, dolomite or Al₂O₃: cuts only what is softer than the
  powder.

**Discovery and planning.**
- **Field guide:** candidate trilobites from the deposit, one of them real.
- **Mind model:** your guess at the fossil's shape. Fit it to a species, then pull or push
  its outline. The scribes and abrader won't cut inside it.
- **Notebook:** steel-needle, acid and loupe tests, your identification, and a prep plan
  derived from it.

**Scoring.** Fossil integrity % (shown live) times exposure gives the value. Materials are
told apart by lustre as well as colour. There is a movable raking light and a wet-surface
spray.

Design notes: [`docs/design-v2.md`](docs/design-v2.md) and [`docs/fracture-research.md`](docs/fracture-research.md).
Rules and numbers follow [`docs/preparation-survey.md`](docs/preparation-survey.md) §8.

**Controls.**
- **iPad:**
  - Left thumb on the circle sets air pressure (→) and flow or stroke rate (↑). It stays
    where you release it.
  - One finger on the rock uses the tool. Two fingers turn, pinch zooms, twist rolls.
  - Apple Pencil pressure throttles the air.
- **PC:** left mouse uses the tool, right-drag turns, wheel zooms. Keys 1–4 select tools,
  Q/W/E select abrasives, arrows move the pad.
- **Quest:**
  - Left grip holds and turns the sample; left stick magnifies.
  - Right trigger (analog) is pressure or hammer force; right grip (analog) is flow or
    stroke rate.
  - A cycles tools, B cycles abrasives.
  - Haptics differ on rock and on shell.
  - Left X toggles the wrist panel; left Y finishes.

**Code (`web/src/`).**
- `trilobite.js`: seeded SDF, ported from the prototype, plus spine part IDs.
- `specimen.js`: block, strata and parting map; the spine-support lists and grading targets.
- `volume.js`: density fields and ray marching.
- `mesher.js`: chunked surface nets with gradient normals.
- `tools.js`: tool physics and grading.
- `view.js`: three.js scene.
- `input.js`: touch, mouse and pad input.
- `xr.js`: Quest controls.
- `audio.js`: synthesised tool sounds.
- `game.js` and `ui.js`: game loop and interface.

**Tests (`web/test/`).**
- `node test/sim.test.js`: builds and meshes every level, and checks the mesh is closed and
  outward-facing. Add `--reveal --ply DIR` to export meshes for Blender.
- `node test/selectivity.js`: one second of each tool on rock and on shell, per level. This
  is the contrast ladder in numbers.
- `node test/pacing.js LEVEL TOOL [MEDIA]`: a methodical bot. It reports exposure, damage
  and value against simulated play time.
- `node test/balance.js`: a careless bot.
- `node test/fracture.test.js LEVEL`: chisel scenarios. A centre blow crushes, an edge
  blow flakes, and a side blow along the bedding splits.
- `node test/smoke.mjs` and `node test/xr-smoke.mjs`: browser checks with the server
  running. The XR test emulates a Quest 3 with Meta's IWER and drives the controllers.
- Setup: `npm i`, then `npx playwright install chromium`.

## Prototype 1: seeded trilobites in a matrix block (`proto/`)

Python generator plus a Blender renderer for checking the look before engine work.

```sh
python3 -m venv venv && venv/bin/pip install numpy scipy scikit-image
venv/bin/python proto/generate.py --sheet 1-12 --specimens 3,6     # meshes -> build/meshes/*.ply
blender -b --python proto/render_blender.py -- --samples 96        # renders -> build/*.png
```

Outputs: `build/trilobite_sheet.png` (12 seeds), `build/specimen_NNNN_stages.png`
(raw / partial / prepared), `build/specimen_NNNN_closeup.png`. Each fossil's parameters
are saved next to its mesh as JSON.

### How it works

- **Everything is a signed distance field (SDF)** on a voxel grid. Meshes come from
  marching cubes, which places vertices between grid points, so surfaces are smooth.
  Shading uses the field's gradient normals, not averaged triangle normals.
- **Trilobite** (`fossilgen/trilobite.py`): the shield is a height field over a seeded
  outline. It has a head shield (cephalon), thorax segments and a tail shield
  (pygidium). The axial lobe, furrows, glabella, border rim and tubercles are all height
  terms. Spines and eyes are 3D shapes smooth-unioned on. The head and trunk are separate
  volumes so a moult can shift the head away from the body.
- **Body plans** (`fossilgen/localities.py`): six archetypes loosely based on real groups.
  These are ptychopariid, redlichiid, asaphid, phacopid, dalmanitid and odontopleurid.
  Each specimen is a primary archetype blended with a secondary one. About 15% of seeds
  are strong blends: plausible animals that have never been found.
- **Localities** set the period, rock colour, fossil colour and which archetypes turn up.
  This is the hook for expeditions.
- **Pose**: enrolment (bending about a hinge axis), lying on the side, yaw and tilt,
  compaction, and moult disarticulation.
- **Specimen** (`fossilgen/specimen.py`): the block is a noisy rounded box with chipped
  faces and seeded strata, and the fossil rests on a bedding plane. Preparation is a
  floor field: the bedding plane next to the fossil, with a moat against the outline
  and a slope rising away from it. The partial stage adds a ragged working front.
  Vertex colours mark fossil vs matrix and fresh-worked vs weathered rind.

### Known limits / next

- Vertex colours fray where a thin fossil edge meets the floor at a grazing angle. The
  game should pick the material per pixel in the shader (triplanar texture + material
  field), not per vertex.
- No compound-eye lenses, facial sutures or doublure yet. Undersides are flat.
- Blocks are meshed whole here. The game needs chunked, incremental remeshing (surface
  nets or marching cubes in a Burst job or compute shader) and a per-voxel material ID
  and hardness for tools.
