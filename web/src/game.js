// The preparation session: owns the specimen, tools and settings; turns aim + settings
// into tool calls each frame, and routes what happens to the view, sound, haptics and HUD.

import * as THREE from 'three';
import { TOOLS, MEDIA, HEADS, E_MAX, MATRICES, FOSSILS } from './data.js';
import { Specimen } from './specimen.js';
import { Tools, grade, integrity, exposureOf } from './tools.js';
import { MindModel } from './mind.js';
import { fieldGuide } from './species.js';
import { say } from './lexicon.js';
import { track } from './telemetry.js';
import { DisplayBench } from './display.js';
import * as save from './save.js';

const TOOL_ORDER = ['chisel', 'scribe_large', 'scribe_fine', 'abrader'];
const MEDIA_ORDER = ['bicarb', 'dolomite', 'alox'];
const HEAD_ORDER = ['wedge', 'bolster', 'point'];
const MAX_TILT = (70 * Math.PI) / 180;
// Real size of the trilobite (body length), for readouts in mm.
const BODY_MM = 50;

export class Game {
  constructor(view, sfx, ui) {
    this.view = view;
    this.sfx = sfx;
    this.ui = ui;
    // angleTilt 0-1 (0 = straight along the view, 1 = 70 deg off it); angleAz: lean direction
    // on screen (radians, 0 = right, y down), like an Apple Pencil's azimuth.
    this.settings = { tool: 'scribe_large', media: 'bicarb', head: 'wedge', pressure: 0.5, flow: 0.6, angleTilt: 0.45, angleAz: -2.3 };
    this.ch = null; // chisel in hand: { tip, screen0, ray0, charge, d, e, swing, struck }
    this.aim = { screen: null, active: false, throttle: 1, pen: null };
    this.xrAim = null; // set by XR each frame: { tip, dir, active, pressure, flow } in local space
    this.tapTimer = 0;
    this.statusTimer = 0;
    this.cleanTimer = 0;
    this.sp = null;
    this.wet = 0;
    this.showLeft = false;
    this.onEvent = null; // haptics hook
    this.rate = { removed: 0, integ: 0 };
  }

  /**
   * Put a block on the bench. opts.item: its storeroom record (made on first save if absent);
   * opts.state: saved work to resume.
   */
  async load(level, seed, opts = {}) {
    this.level = level;
    this.seed = seed ?? level.specimen.seed;
    this.item = opts.item ?? null;
    this.resumed = !!opts.state;
    this.sp = new Specimen(level, { seed: this.seed });
    this.tools = new Tools(this.sp);
    // Only this level's tools.
    if (!level.tools.includes(this.settings.tool)) this.settings.tool = level.tools[0];
    if (!level.media.includes(this.settings.media)) this.settings.media = level.media[0];
    this.mind = new MindModel(this.sp);
    this.tools.mind = this.mind;
    this.guide = fieldGuide(this.sp);
    this.modelMode = false;
    this.modelDrag = null;
    this.test = null; // armed identification test: 'scratch' | 'acid' | 'loupe'
    this.notes = [];
    this.guess = { matrix: null, fossil: null };
    this.mindTimer = 0;
    this.started = performance.now();
    this.usage = {};
    this.milestones = new Set();
    this.found = new Set([0]);
    if (opts.state) {
      try {
        await save.applyState(this, opts.state);
      } catch (e) {
        console.warn('could not resume this block', e);
        this.resumed = false;
      }
    }
    this.view.showcaseMode(false);
    document.getElementById('showlabel')?.classList.add('hidden');
    this.view.setSpecimen(this.sp);
    this.view.setMind(null);
    this.finished = false;
    this.bench?.close();
    this.bench = null;
    this.exposure = 0;
    this.combo = 0;
    this._savedRemoved = this.tools.removed;
    this._saveClock = 0;
    this.integ = integrity(this.sp);
    this.lastRemoved = 0;
    this.lastContact = null;
    this.mm3PerVoxel = (this.sp.vol.voxel * BODY_MM) ** 3;
    track('level_start', level.id, { seed: this.seed, count: this.sp.count, partial: this.sp.completeness < 0.97, opal: this.sp.opalFrac ?? null });
    this.ui.onLoaded(this);
  }

  setTool(t) {
    if (this.level && !this.level.tools.includes(t)) return;
    this.settings.tool = t;
    this.ui.syncSettings(this);
  }

  setMedia(m) {
    if (this.level && !this.level.media.includes(m)) return;
    this.settings.media = m;
    this.ui.syncSettings(this);
  }

  cycleTool(dir = 1) {
    const order = TOOL_ORDER.filter((t) => this.level.tools.includes(t));
    const i = order.indexOf(this.settings.tool);
    this.setTool(order[(i + dir + order.length) % order.length]);
  }

  cycleMedia(dir = 1) {
    if (this.settings.tool === 'chisel') {
      const i = HEAD_ORDER.indexOf(this.settings.head);
      this.setHead(HEAD_ORDER[(i + dir + HEAD_ORDER.length) % HEAD_ORDER.length]);
      return;
    }
    const order = MEDIA_ORDER.filter((m) => this.level.media.includes(m));
    const i = order.indexOf(this.settings.media);
    this.setMedia(order[(i + dir + order.length) % order.length]);
  }

  setHead(h) {
    this.settings.head = h;
    this.ui.syncSettings(this);
  }

  setPad(pressure, flow) {
    this.settings.pressure = pressure;
    this.settings.flow = flow;
    this.ui.syncSettings(this);
  }

  setAngle(tilt, az) {
    this.settings.angleTilt = Math.min(1, Math.max(0, tilt));
    this.settings.angleAz = az;
    this.ui.syncSettings(this);
  }

  /** Open the display bench (after Finish): saw the block to a shape for showing. */
  openBench() {
    if (!this.finished || this.bench?.mounted) return this.bench;
    this.bench = new DisplayBench(this);
    this.bench.open();
    this.view.celebrate(false);
    track('bench_open', this.level.id, {});
    return this.bench;
  }

  /** A click on the display bench: with a custom outline, drop a point on the block's top. */
  benchClick(x, y) {
    const b = this.bench;
    if (!b?.active || b.p.shape !== 'custom') return;
    const r = this.view.screenRay(x, y);
    const z = this.sp.bHi[2];
    if (Math.abs(r.d.z) < 1e-4) return;
    const t = (z - r.o.z) / r.d.z;
    if (t <= 0) return;
    const err = b.addPoint(r.o.x + r.d.x * t, r.o.y + r.d.y * t);
    this.ui.benchStatus?.(err);
  }

  /**
   * Brush away the rock still lying on the shell: every unexposed target, and the thin cover
   * above it. No harm to the fossil; it simply finishes the job.
   */
  sweep() {
    const v = this.sp.vol, rock = v.rock;
    const box = [v.nx, v.ny, v.nz, 0, 0, 0];
    let n = 0;
    const spawn = [];
    this._leftovers((u, i, j, k) => {
      rock[u] = -0.6;
      n++;
      box[0] = Math.min(box[0], i); box[1] = Math.min(box[1], j); box[2] = Math.min(box[2], k);
      box[3] = Math.max(box[3], i); box[4] = Math.max(box[4], j); box[5] = Math.max(box[5], k);
      if (n % 9 === 1) spawn.push(v.pos(i, j, k));
    });
    if (!n) return;
    v.touch(...box);
    this.tools.removed += n;
    this.view.spawnChips(spawn.slice(0, 120), 2);
    this.sfx.chip?.();
    this.ui.toast(say('sweep'), 'good');
    track('sweep', this.level.id, { n, exp: +this.exposure.toFixed(3) });
    this.statusTimer = 0;
  }

  /**
   * Visit the rock still lying on the shell: a small patch round each covered target and the
   * crumbs stacked on it (what Sweep brushes away, and what Show leftovers lights up).
   */
  _leftovers(fn) {
    const v = this.sp.vol, rock = v.rock, fos = v.fossil, seen = (this._lseen ??= new Uint32Array(v.count));
    const st = (this._lst = (this._lst ?? 0) + 1);
    for (const q of this.sp.targets) {
      if (rock[q] <= 0) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          for (let s = 0; s < 8; s++) {
            const u = q + dx + dy * v.sy + s * v.sz;
            if (u >= v.count || fos[u] > 0) break;
            if (rock[u] <= 0) { if (s > 0) break; continue; }
            if (seen[u] === st) continue;
            seen[u] = st;
            fn(u, u % v.nx, ((u / v.sy) | 0) % v.ny, (u / v.sz) | 0);
          }
    }
  }

  /** Light up the leftovers (or stop). Rebuilds the mask the mesher reads, then remeshes. */
  setShowLeft(on) {
    this.showLeft = on;
    if (!on) return;
    const v = this.sp.vol, mask = (this.sp.leftMask ??= new Uint8Array(v.count));
    mask.fill(0);
    const box = [v.nx, v.ny, v.nz, 0, 0, 0];
    this._leftovers((u, i, j, k) => {
      mask[u] = 1;
      box[0] = Math.min(box[0], i); box[1] = Math.min(box[1], j); box[2] = Math.min(box[2], k);
      box[3] = Math.max(box[3], i); box[4] = Math.max(box[4], j); box[5] = Math.max(box[5], k);
    });
    if (box[3]) v.touch(...box);
  }

    /** Spray the surface with water: darker rock, glossier everything, then it dries. */
  wetten() {
    if (!this.wetTold) {
      this.wetTold = true;
      this.ui.toast('Wet rock darkens where shell lies just beneath it. Follow the shadows; they fade as it dries.', '');
    }
    this.wet = 1;
  }

  // ---- identification tests

  /** Arm a test; the next press on the specimen performs it there. */
  armTest(type) {
    this.test = this.test === type ? null : type;
    this.ui.renderNotebook?.(this);
  }

  /**
   * Perform a test where the player pressed. Reports what you'd observe, not the answer.
   * Testing the fossil itself can mark it - test somewhere it won't matter.
   */
  _doTest(tip) {
    const v = this.sp.vol, g = v.grid(tip.x, tip.y, tip.z);
    const pr = this.tools.probe(g);
    if (pr.contact === 'none') return;
    const onShell = pr.contact === 'fossil';
    const m = onShell ? this.sp.fossilMat : this.sp.matrix;
    const where = onShell ? 'shell' : 'matrix';
    let text;
    if (this.test === 'scratch') {
      const H = m.H;
      text = H < 0.3 ? 'scratches easily; a soft powdery groove' : H < 0.55 ? 'scratches with firm pressure; a fine white line' : 'won\'t scratch: the needle skates off (harder than steel)';
      if (onShell && H < 0.55) this.tools._mark(g, 1.2, 70);
    } else if (this.test === 'acid') {
      const f = m.fizz;
      text = f > 0.7 ? 'fizzes vigorously' : f > 0.25 ? 'fizzes weakly, mostly where it\'s scratched' : 'no reaction';
      if (onShell && f > 0.5) this.tools._mark(g, 1.6, 90);
    } else {
      text = m.loupe;
    }
    this.notes.push({ test: this.test, where, text });
    this.sfx.tap();
    this.test = null;
    this.ui.renderNotebook?.(this);
  }

  setGuess(kind, id) {
    this.guess[kind] = id || null;
    this.ui.renderNotebook?.(this);
  }

  /** A prep plan from the player's identification (right or wrong). */
  plan() {
    const { matrix, fossil } = this.guess;
    if (!matrix || !fossil) return null;
    const M = MATRICES[matrix], F = Object.values(FOSSILS).find((f) => f.kind === fossil);
    const steps = [];
    // Rough out.
    if (M.fiss <= 0.05) steps.push(['Rough out', 'This splits easily along its bedding. Use the wedge, blade flat along the dark parting line on the side of the block at the fossil\'s level, and give it a firm side blow. Expect a skin of matrix left on the shell.']);
    else if (M.fiss <= 0.2) steps.push(['Rough out', 'Splits poorly. Take bolster flakes off the edges, driving outward; don\'t strike straight down over the fossil.']);
    else steps.push(['Rough out', 'Won\'t split along bedding. Bolster flakes from the edges only, working inward; leave the area over the fossil for the scribe.']);
    // Close to the fossil: is there an abrasive that cuts this rock but not this shell?
    const bite = (Hm, H) => Math.max(0, Hm - H + 0.04);
    const safe = Object.entries(MEDIA).filter(([, md]) => bite(md.H, M.H) > 0.05 && bite(md.H, F.H) === 0);
    if (safe.length) {
      const [, md] = safe[safe.length - 1];
      steps.push(['Near the fossil', `Air abrader with ${md.name.toLowerCase()}: it cuts this rock but is softer than the shell, so it can't hurt it. 50–80 psi.`]);
      if (F.H > 0.6) steps.push(['Scribes', 'The shell is harder than steel: the scribe barely marks it. Large scribe is fine close in.']);
      else steps.push(['Scribes', 'Use them for bulk only; the shell marks as easily as the rock. Keep to a low, lifting angle.']);
    } else {
      steps.push(['Near the fossil', 'No abrasive cuts this rock without also cutting the shell. Fine scribe at a low, lifting angle, 30–45 psi; fit your model tightly so it guards the shell.']);
      steps.push(['Finishing', 'If you must abrade, use the softest powder that still cuts the rock, briefly, and keep off the shell.']);
    }
    return steps;
  }

  // ---- the mind model

  /** Enter or leave model editing; the first time, place the ovoid in the middle of the block. */
  setModelMode(on) {
    this.modelMode = on;
    if (on && !this.mind.placed) {
      this.mind.placed = true;
      this.mind.version++;
    }
    this.view.showTool(null);
    this.view.setMindOpacity(on ? 0.3 : 0.1);
    this.ui.syncModel(this);
  }

  /** Reshape the model to a field-guide card. */
  fitModel(card) {
    if (!this.mind.placed) this.mind.placed = true;
    this.mind.fit(card.anatomy, this.sp.spec.seed);
    this.mind.card = card;
    this.ui.syncModel(this);
  }

  _modelPoint(x, y) {
    const ray = this.view.screenRay(x, y);
    const zp = this.mind.z0 + this.mind.height * 0.4;
    if (Math.abs(ray.d.z) < 1e-4) return null;
    const t = (zp - ray.o.z) / ray.d.z;
    if (t <= 0) return null;
    return [ray.o.x + ray.d.x * t, ray.o.y + ray.d.y * t];
  }

  _modelAim(x, y, active) {
    if (x === null || !active) {
      this.modelDrag = null;
      return;
    }
    const p = this._modelPoint(x, y);
    if (!p) return;
    if (!this.modelDrag) {
      this.modelDrag = { mode: this.mind.contains2D(p[0], p[1]) ? 'move' : 'pull', last: p };
      if (this.modelDrag.mode === 'pull') this.mind.pull(p[0], p[1]);
      return;
    }
    if (this.modelDrag.mode === 'move') this.mind.move(p[0] - this.modelDrag.last[0], p[1] - this.modelDrag.last[1]);
    else this.mind.pull(p[0], p[1]);
    this.modelDrag.last = p;
  }

  /**
   * Screen aim (2D). x === null clears it. active = tool running.
   * pen: { tilt 0-1, az } from an Apple Pencil, overriding the angle gizmo while drawing.
   */
  aimScreen(x, y, active, throttle, pen = null) {
    if (this.test && active && x !== null) {
      const ray = this.view.screenRay(x, y);
      const hit = this.sp.vol.raycast([ray.o.x, ray.o.y, ray.o.z], [ray.d.x, ray.d.y, ray.d.z], 20);
      if (hit) this._doTest(new THREE.Vector3(...hit.p));
      this.aim.screen = null;
      this.aim.active = false;
      this.testHold = true; // swallow the rest of this press
      return;
    }
    if (this.testHold) {
      if (x === null || !active) this.testHold = false;
      return;
    }
    if (this.modelMode) {
      this._modelAim(x, y, active);
      return;
    }
    if (x === null) {
      this.aim.screen = null;
      this.aim.active = false;
      return;
    }
    if (active && !this.aim.active) this.tapTimer = 0; // first chisel tap is immediate
    this.aim.screen = [x, y];
    this.aim.active = active;
    this.aim.throttle = throttle;
    this.aim.pen = pen;
  }

  /** Tool direction from the view ray and the lean (tilt, azimuth on screen). */
  _toolDir(ray, tilt, az) {
    const t = tilt * MAX_TILT;
    const w = ray.right.clone().multiplyScalar(Math.cos(az)).addScaledVector(ray.up, -Math.sin(az));
    return ray.d.clone().multiplyScalar(Math.cos(t)).addScaledVector(w, -Math.sin(t)).normalize();
  }

  update(dt) {
    if (this.sp && this.finished) {
      // The display bench still reshapes the rock after the excavation.
      this.view.update(Math.min(dt, 1 / 20));
      this.view.updateDirty(12);
      return;
    }
    if (!this.sp || this.finished) return;
    dt = Math.min(dt, 1 / 20);
    this._autosave(dt);
    const v = this.sp.vol, s = this.settings, tool = TOOLS[s.tool];
    let tip = null, dir = null, active = false, pressure = s.pressure, flow = s.flow;

    // Keep the protection mask and the ghost mesh in step with the model (debounced).
    const m = this.mind;
    if (m.placed && m.version !== m.shownVersion) {
      this.mindTimer -= dt;
      if (this.mindTimer <= 0 || !this.modelDrag) {
        this.mindTimer = 0.15;
        m.shownVersion = m.version;
        this.view.setMind(m);
        if (!this.modelDrag) m.rebuildMask();
        else this.maskStale = true;
      }
    } else if (this.maskStale && !this.modelDrag) {
      this.maskStale = false;
      m.rebuildMask();
    }
    if (this.modelMode) {
      this.view.showTool(null);
      this.view.showChisel(null);
      this._after(dt, null, tool);
      return;
    }

    let ray = null;
    if (this.xrAim) {
      ({ tip, dir, active } = this.xrAim);
      pressure = this.xrAim.pressure;
      flow = this.xrAim.flow;
    } else if (this.aim.screen) {
      ray = this.view.screenRay(...this.aim.screen);
      const hit = v.raycast([ray.o.x, ray.o.y, ray.o.z], [ray.d.x, ray.d.y, ray.d.z], 20);
      if (hit) {
        tip = new THREE.Vector3(...hit.p);
        const pen = this.aim.pen;
        dir = this._toolDir(ray, pen ? pen.tilt : s.angleTilt, pen ? pen.az : s.angleAz);
      }
      active = this.aim.active && !!hit;
      pressure = Math.min(1, s.pressure * this.aim.throttle);
    }

    if (tool.kind === 'chisel') {
      this._chisel(dt, tip, dir, active, ray);
      this._after(dt, null, tool);
      return;
    }
    if (this.ch) {
      this.ch = null;
      this.view.showChisel(null);
    }

    // The tool as a vector, with its line of action through the block.
    let probe = null;
    if (tip) {
      const g = v.grid(tip.x, tip.y, tip.z);
      const d = [dir.x, dir.y, dir.z];
      probe = this.tools.probe(g);
      const segs = this.tools.lineOfAction(g, d).map((sg) => ({
        kind: sg.kind,
        a: v.pos(sg.a[0], sg.a[1], sg.a[2]),
        b: v.pos(sg.b[0], sg.b[1], sg.b[2]),
      }));
      const r = (tool.kind === 'abrader' ? tool.spot : tool.radius) * v.voxel;
      this.view.showTool(tip, dir, segs, r, this.xrAim ? 0 : 0.3);
    } else {
      this.view.showTool(null);
    }

    let ev = null;
    if (active && tip) {
      const g = v.grid(tip.x, tip.y, tip.z);
      const d = [dir.x, dir.y, dir.z];
      // A sweep covers the whole path since last frame, not just where the pointer landed.
      const prev = this.prevTip;
      const step = tool.kind === 'abrader' ? tool.spot * 0.6 : (tool.radius || 2) * 0.6;
      const span = prev ? Math.hypot(g[0] - prev[0], g[1] - prev[1], g[2] - prev[2]) : 0;
      const n = prev && span < 60 ? Math.min(10, Math.max(1, Math.ceil(span / step))) : 1;
      this.prevTip = g;
      {
        ev = { contact: 'none', pops: 0, chips: 0, snaps: [], removed: 0 };
        for (let i = 1; i <= n; i++) {
          const f = i / n;
          const gi = n === 1 ? g : [prev[0] + (g[0] - prev[0]) * f, prev[1] + (g[1] - prev[1]) * f, prev[2] + (g[2] - prev[2]) * f];
          let e;
          if (tool.kind === 'scribe') e = this.tools.scribe(s.tool, gi, d, pressure, flow, dt / n);
          else e = this.tools.abrade(s.media, [gi[0] - d[0] * 10, gi[1] - d[1] * 10, gi[2] - d[2] * 10], d, pressure, flow, dt / n);
          if (e.contact !== 'none') ev.contact = e.contact === 'fossil' || ev.contact === 'none' ? e.contact : ev.contact;
          ev.pops += e.pops;
          ev.chips += e.chips;
          ev.snaps.push(...e.snaps);
          ev.removed += e.removed;
        }
        const key = tool.kind === 'scribe' ? s.tool : `abr_${s.media}`;
        const u = (this.usage[key] ??= { s: 0, shell: 0 });
        u.s = +(u.s + dt).toFixed(2);
        if (ev.contact === 'fossil') u.shell = +(u.shell + dt).toFixed(2);
        if (tool.kind === 'scribe') this.sfx.scribe(true, flow, pressure, ev.contact);
        else this.sfx.abrader(true, pressure, flow, ev.contact);
      }
      if (ev?.contact === 'fossil') this.lastContact = v.pos(g[0], g[1], g[2]);
    }
    if (!active) this.prevTip = null;
    if (!active || tool.kind !== 'scribe') this.sfx.scribe(false, flow, pressure, 'none');
    if (!active || tool.kind !== 'abrader') this.sfx.abrader(false, pressure, flow, 'none');

    if (ev) {
      if (ev.pops) this.sfx.pop();
      if (ev.chips) this.sfx.chip();
      if (ev.snaps.length) this.sfx.snap();
      this.onEvent?.(ev, pressure);
    }
    this._after(dt, { tip, probe, active }, tool);
  }

  /** Call off a wound-up chisel blow (Esc, right-click, a second finger, VR grip). */
  cancelChisel() {
    const ch = this.ch;
    if (!ch || ch.swing !== null) return false;
    this.ch = null;
    this.aim.active = false;
    this.cancelled = true; // swallow the rest of this press
    this.view.showChisel(null);
    this.ui.toast('Blow called off');
    return true;
  }

  /**
   * Hammer and chisel. Press on the rock to set the chisel; drag to lean it (the hammer end
   * goes the way you drag); hold to wind up the blow; release to strike. In VR the chisel
   * follows the controller and the trigger winds up.
   */
  _chisel(dt, tip, dir, active, ray) {
    const v = this.sp.vol, s = this.settings, tool = TOOLS.chisel, head = HEADS[s.head];
    let ch = this.ch;
    if (this.cancelled) {
      if (active) active = false;
      else this.cancelled = false;
    }
    if (!ch && active && tip) {
      ch = this.ch = { tip: tip.clone(), screen0: this.aim.screen?.slice(), ray0: ray, charge: 0, swing: null, struck: false };
    }
    if (ch && ch.swing === null && !active && ch.d) {
      ch.swing = 0; // released: the hammer comes down, with the chisel as it was held
    } else if (ch && ch.swing === null) {
      if (this.xrAim) {
        ch.tip.copy(this.xrAim.tip);
        ch.d = this.xrAim.dir.clone();
        ch.e = this.xrAim.e.clone();
      } else {
        let tilt = s.angleTilt, az = s.angleAz;
        if (this.aim.screen && ch.screen0) {
          const dx = this.aim.screen[0] - ch.screen0[0], dy = this.aim.screen[1] - ch.screen0[1];
          if (Math.hypot(dx, dy) > 10) {
            tilt = Math.min(1, Math.hypot(dx, dy) / 160);
            az = Math.atan2(dy, dx);
          }
        }
        ch.d = this._toolDir(ch.ray0, tilt, az);
        const w = ch.ray0.right.clone().multiplyScalar(Math.cos(az)).addScaledVector(ch.ray0.up, -Math.sin(az));
        ch.e = new THREE.Vector3().crossVectors(ch.d, w);
        if (ch.e.lengthSq() < 1e-4) ch.e.copy(ch.ray0.right);
        ch.e.normalize();
      }
      ch.charge = Math.min(1, ch.charge + dt / tool.chargeTime);
    }
    if (ch && ch.swing !== null) {
      ch.swing += dt / 0.13;
      if (ch.swing >= 1 && !ch.struck) {
        ch.struck = true;
        this._strike(ch);
      }
      if (ch.swing > 3) {
        this.ch = ch = null;
      }
    }
    if (ch) {
      this.view.showChisel(ch.tip, ch.d, ch.e, head.width * v.voxel, ch.charge, ch.swing === null ? null : Math.min(1, ch.swing));
      const g = v.grid(ch.tip.x, ch.tip.y, ch.tip.z);
      const segs = this.tools.lineOfAction(g, [ch.d.x, ch.d.y, ch.d.z]).map((sg) => ({ kind: sg.kind, a: v.pos(...sg.a), b: v.pos(...sg.b) }));
      this.view.showTool(ch.tip, ch.d, segs, 0.004, 0);
    } else {
      this.view.showChisel(null);
      if (tip && !this.xrAim) {
        // Hovering: show where the chisel would go.
        const d = ray ? this._toolDir(ray, s.angleTilt, s.angleAz) : dir;
        const g = v.grid(tip.x, tip.y, tip.z);
        const segs = this.tools.lineOfAction(g, [d.x, d.y, d.z]).map((sg) => ({ kind: sg.kind, a: v.pos(...sg.a), b: v.pos(...sg.b) }));
        this.view.showTool(tip, d, segs, 0.004, 0.3);
      } else if (tip) {
        this.view.showTool(tip, dir, [], 0.004, 0);
      } else this.view.showTool(null);
    }
    this.chargeShown = ch ? ch.charge : 0;
  }

  _strike(ch) {
    const v = this.sp.vol, s = this.settings;
    const g = v.grid(ch.tip.x, ch.tip.y, ch.tip.z);
    const weight = this.xrAim ? s.pressure : s.pressure;
    const energy = E_MAX * (0.1 + 0.9 * ch.charge) * (0.35 + 0.65 * weight);
    const dn = this.view.dirToLocal(new THREE.Vector3(0, -1, 0));
    this.tools.fracture.down = [dn.x, dn.y, dn.z];
    const ev = this.tools.chiselStrike(g, [ch.d.x, ch.d.y, ch.d.z], [ch.e.x, ch.e.y, ch.e.z], s.head, energy);
    const r = ev.strike;
    track('strike', this.level.id, { head: s.head, charge: +ch.charge.toFixed(2), kind: r.kind, size: r.size ?? 0, fossilLost: r.fossilLost ?? 0, exp: +this.exposure.toFixed(3) });
    this.sfx.tap();
    if (r.kind === 'crush' || r.kind === 'miss') {
      this.sfx.crush();
      if (r.kind === 'crush') this.ui.toast(ch.charge < 0.25 ? 'Too light: it only bruised the rock' : `${say('crush')} Nowhere for a crack to break out.`, '');
    } else {
      this.sfx.crack(r.size);
      // Praise in proportion to the result; strikes in quick succession build a combo.
      const now = performance.now();
      this.combo = now - (this.lastGood ?? 0) < 6000 ? (this.combo ?? 0) + 1 : 1;
      this.lastGood = now;
      if (r.kind === 'split' && r.size > 50000) this.ui.toast(say('split'), 'good');
      else if (r.size > 6000) this.ui.toast(this.combo >= 3 ? say('combo') : say('bigFlake'), 'good');
      else if (this.combo >= 4) this.ui.toast(say('combo'), 'good');
      if (r.debris) {
        const c = v.pos(...r.centre), p0 = v.pos(...g);
        const out = new THREE.Vector3(c[0] - p0[0], c[1] - p0[1], c[2] - p0[2]);
        if (out.lengthSq() < 1e-8) out.copy(ch.d);
        out.normalize();
        const up = this.view.dirToLocal(new THREE.Vector3(0, 1, 0));
        const k = Math.min(1, 0.35 + energy / E_MAX);
        const vel = out.multiplyScalar(0.45 * k).addScaledVector(ch.d, 0.15 * k).addScaledVector(up, 0.55 * k);
        const spin = (r.size > 20000 ? 0.8 : 3.5) * (0.5 + Math.random());
        this.view.addDebris(r.debris, [vel.x, vel.y, vel.z], spin);
      }
    }
    if (ev.chips) this.sfx.chip();
    if (ev.snaps.length) this.sfx.snap();
    if (r.fossilLost && ev.strike.centre) this.lastContact = v.pos(...ev.strike.centre);
    this.onEvent?.(ev, ch.charge);
  }

  _dropLoose() {
    const v = this.sp.vol;
    const pieces = this.tools.dropLoose();
    this._looseSeen = this.tools.removed;
    if (!pieces.length) return;
    const down = this.view.dirToLocal(new THREE.Vector3(0, -1, 0));
    let big = 0;
    for (const p of pieces) {
      if (p.debris) {
        const c = v.pos(...p.centre), mid = this.sp.bc;
        const out = new THREE.Vector3(c[0] - mid[0], c[1] - mid[1], 0).normalize().multiplyScalar(0.12);
        out.addScaledVector(down, 0.05);
        this.view.addDebris(p.debris, [out.x, out.y, out.z], 0.6 + Math.random());
      } else this.tools.spawn.push(v.pos(...p.centre));
      big = Math.max(big, p.size);
    }
    if (big > 400) {
      this.sfx.crack(big);
      this.ui.toast(say('loose'), 'good');
    }
    track('loose', this.level.id, { n: pieces.length, big });
  }

  /** Per-frame upkeep after any tool: breakaway cleanup, chips, wetness, remeshing, status. */
  _after(dt, info, tool) {
    const v = this.sp.vol;
    const { tip = null, probe = null, active = false } = info ?? {};

    // Rock that can no longer stand breaks away; chips fly where material came off.
    this.cleanTimer -= dt;
    if (this.cleanTimer <= 0) {
      this.cleanTimer = 0.12;
      this.tools.cleanup();
    }
    // Rock cut clean off from the specimen falls away, once the player pauses.
    if (this.tools.removed !== this._looseSeen) {
      this._looseSeen = this.tools.removed;
      this._looseAt = 0.35;
    }
    if (this._looseAt > 0 && !active && (this._looseAt -= dt) <= 0) this._dropLoose();
    if (this.tools.spawn.length) {
      this.view.spawnChips(this.tools.spawn, tool.kind === 'chisel' ? 14 : 4);
      this.tools.spawn.length = 0;
    }

    this.wet = Math.max(0, this.wet - dt / 25);
    this.view.uniforms.uWet.value = this.wet * this.wet * (3 - 2 * this.wet);
    this.view.uniforms.uTime.value = performance.now() / 1000;
    this.view.uniforms.uLeft.value += ((this.showLeft ? 1 : 0) - this.view.uniforms.uLeft.value) * Math.min(1, dt * 6);
    this.view.update(dt);
    this.view.updateDirty(this.xrAim ? 4 : 8);

    // Status: exposure, integrity, and how fast the tool is working right now.
    this.statusTimer -= dt;
    if (this.statusTimer <= 0) {
      const period = 0.25 - this.statusTimer;
      this.statusTimer = 0.25;
      let n = 0;
      const t = this.sp.targets, rock = v.rock;
      for (let i = 0; i < t.length; i++) if (rock[t[i]] <= 0) n++;
      this.exposure = exposureOf(n / (t.length || 1));
      // Milestones: rising praise as the piece comes out; the last few percent glow.
      for (const m of [25, 50, 75, 90, 100]) {
        if (this.exposure * 100 >= m && !(this.milestones ??= new Set()).has(m)) {
          this.milestones.add(m);
          track('milestone', this.level.id, { m, integ: +this.integ.value.toFixed(3), min: +((performance.now() - this.started) / 60000).toFixed(2), usage: this.usage });
          const partial = m === 100 && this.sp.completeness < 0.97;
          this.ui.toast(partial ? `Fully excavated! It's a partial specimen: about ${Math.round(this.sp.completeness * 100)}% of the animal survived.` : say(`milestone${m}`), 'good');
          if (m >= 90) this.sfx.jackpot?.();
        }
      }
      // A second (or third) animal starting to show is a big moment: celebrate it once.
      if (this.sp.count > 1) {
        const own = this.sp.targetOwner, tot = new Array(this.sp.count).fill(0), got = new Array(this.sp.count).fill(0);
        for (let i = 0; i < t.length; i++) {
          tot[own[i]]++;
          if (rock[t[i]] <= 0) got[own[i]]++;
        }
        this.found ??= new Set([0]);
        for (let k = 1; k < this.sp.count; k++) {
          if (!this.found.has(k) && tot[k] && got[k] / tot[k] > 0.04) {
            this.found.add(k);
            this.sfx.jackpot?.();
            this.ui.toast(say(this.found.size === 2 ? 'another' : 'third'), 'good');
          }
        }
      }
      const prev = this.integ.value;
      this.integ = integrity(this.sp);
      const dInt = prev - this.integ.value;
      const dRem = this.tools.removed - this.lastRemoved;
      this.lastRemoved = this.tools.removed;
      const k = 0.5;
      this.rate.removed = this.rate.removed * k + ((dRem * this.mm3PerVoxel) / period) * (1 - k);
      this.rate.integ = this.rate.integ * k + ((dInt * 100) / period) * (1 - k);
      if (dInt > 0.0005 && this.lastContact) this.view.pulse(this.lastContact);
      this.ui.syncStatus(this, dInt > 0.0005);
    }
    this.ui.readout(this, tip, probe, active);
  }

  // ---- saving

  /** Write this block's state to the storeroom (made on first save). */
  async save(status) {
    if (!this.sp || this._saving) return;
    this._saving = true;
    try {
      this.item ??= save.newItem(this.level, this.seed);
      const st = await save.encodeState(this);
      const it = this.item;
      Object.assign(it, { status: status ?? (it.status === 'prepared' ? 'prepared' : 'working'), minutes: st.minutes, exposure: this.exposure, integrity: this.integ.value, saved: Date.now() });
      await save.saveState(it.id, st);
      await save.putItem(it);
      this._savedRemoved = this.tools.removed;
      this._saveClock = 0;
    } catch (e) {
      console.warn('save failed', e);
    } finally {
      this._saving = false;
    }
  }

  /** Autosave: after a minute of work with changes, and whenever the page is hidden. */
  _autosave(dt) {
    if (this.finished || this.tools.removed === this._savedRemoved) return;
    this._saveClock += dt;
    if (this._saveClock > 60) this.save();
  }

  /** End the session without finishing: the block goes back on the shelf, and a day passes. */
  async packUp() {
    if (!this.sp || this.finished) return;
    await this.save('working');
    const p = await save.profile();
    p.day++;
    await save.saveProfile(p);
    track('pack_up', this.level.id, { exp: +this.exposure.toFixed(3), day: p.day });
    this.sp = null;
    this.ui.showMenu(`Packed up. The block is on your storeroom shelf, ${Math.floor(this.exposure * 100)}% exposed. Day ${p.day} begins.`);
  }

  finish() {
    if (!this.sp || this.finished) return null;
    this.finished = true;
    this.sfx.scribe(false, 0, 0, 'none');
    this.sfx.abrader(false, 0, 0, 'none');
    this.view.showTool(null);
    const g = grade(this.sp, this.tools.stats);
    g.minutes = (performance.now() - this.started) / 60000;
    track('finish', this.level.id, { exp: +g.exposure.toFixed(3), integ: +g.integrity.toFixed(3), min: +g.minutes.toFixed(2), value: g.value, usage: this.usage, stats: this.tools.stats });
    this.ui.showResults(this, g);
    // Into the storeroom as a prepared piece; a day passes.
    (async () => {
      this.item ??= save.newItem(this.level, this.seed);
      this.item.value = g.value;
      await this.save('prepared');
      const p = await save.profile();
      p.day++;
      await save.saveProfile(p);
    })();
    return g;
  }

  describeSettings() {
    const s = this.settings, tool = TOOLS[s.tool];
    return {
      tool: tool.short,
      media: tool.kind === 'abrader' ? MEDIA[s.media].short : null,
      psi: Math.round(10 + 90 * s.pressure),
      yLabel: tool.kind === 'abrader' ? 'Abrasive flow' : tool.kind === 'scribe' ? 'Stroke rate' : '—',
      xLabel: tool.kind === 'chisel' ? 'Hammer force' : 'Air pressure',
      tiltDeg: Math.round(s.angleTilt * 70),
    };
  }
}
