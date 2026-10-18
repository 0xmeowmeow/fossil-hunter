// Meta Quest (WebXR) controls.
//   Left grip (analog): grab and turn the sample. Left stick up/down: magnify; left/right:
//   swing the lamp round. Left trigger: wet the surface.
//   Left X: wrist menu (point with the right controller, trigger to press): wet, leftovers,
//   sweep, recentre, pack up, finish, leave VR. Left Y: show/hide the status panel.
//   Right controller is the tool; its tip works the rock where it touches.
//   Right trigger (analog): air pressure / hammer force. Right grip (analog): abrasive flow
//   or stroke rate while squeezed. Right A: next tool. Right B: next abrasive.
// Haptics differ on rock and shell, and kick on cracks and snapped spines.

import * as THREE from 'three';
import { TOOLS } from './data.js';

const TIP = 0.13; // metres from the controller origin to the tool tip

export class XRControl {
  constructor(view, game, ui) {
    this.view = view;
    this.game = game;
    this.ui = ui;
    this.hands = { left: null, right: null };
    this.prev = { left: [], right: [] };
    this.grab = null;
    this.scale = 0.16;
    this.hudOn = true;
    this.hudTimer = 0;

    const xr = view.renderer.xr;
    for (let i = 0; i < 2; i++) {
      const c = xr.getController(i);
      c.addEventListener('connected', (e) => {
        c.userData.src = e.data;
        this.hands[e.data.handedness] = c;
        if (e.data.handedness === 'right') c.add(this._toolModel());
        if (e.data.handedness === 'left') c.add(this._hud(), this._menu());
        if (e.data.handedness === 'right') c.add(this._ray());
      });
      c.addEventListener('disconnected', () => {
        for (const h of ['left', 'right']) if (this.hands[h] === c) this.hands[h] = null;
        c.clear();
      });
      view.scene.add(c);
    }
    xr.addEventListener('sessionstart', () => this._start());
    xr.addEventListener('sessionend', () => this._end());
    game.onEvent = (ev, p) => this._haptics(ev, p);
  }

  static async supported() {
    try {
      return !!navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr'));
    } catch {
      return false;
    }
  }

  async enter() {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    this.view.renderer.xr.setReferenceSpaceType('local-floor');
    await this.view.renderer.xr.setSession(session);
  }

  _start() {
    const r = this.view.root;
    this.saved = { p: r.position.clone(), q: r.quaternion.clone(), s: r.scale.clone() };
    r.position.set(0, 1.05, -0.38);
    r.quaternion.identity();
    r.scale.setScalar(this.scale);
    this.table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.7), new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 0.9 }));
    this.table.receiveShadow = true;
    this.view.scene.add(this.table);
    this.placePending = true; // put the bench in front of the head on the first tracked frame
    this.ui.setXR(true);
  }

  _end() {
    this.setMenu(false);
    const r = this.view.root;
    if (this.saved) {
      r.position.copy(this.saved.p);
      r.quaternion.copy(this.saved.q);
      r.scale.copy(this.saved.s);
    }
    if (this.table) this.view.scene.remove(this.table);
    this.game.xrAim = null;
    this.ui.setXR(false);
  }

  /** Bench and specimen ~40 cm in front of the eyes and ~38 cm below them, facing the player. */
  _place() {
    const cam = this.view.renderer.xr.getCamera();
    const p = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    if (p.lengthSq() === 0) return; // pose not tracked yet
    const f = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld);
    f.y = 0;
    if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
    f.normalize();
    const root = this.view.root;
    root.position.copy(p).addScaledVector(f, 0.4).add(new THREE.Vector3(0, -0.38, 0));
    root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), f);
    this.table.position.copy(root.position).add(new THREE.Vector3(0, -0.19, 0)).addScaledVector(f, 0.05);
    this.table.quaternion.copy(root.quaternion);
    this.placePending = false;
  }

  _toolModel() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.11, 16), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.7, roughness: 0.35 }));
    body.rotation.x = Math.PI / 2;
    body.position.z = -0.045;
    const nib = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.8, roughness: 0.3 }));
    nib.rotation.x = -Math.PI / 2;
    nib.position.z = -TIP + 0.015;
    g.add(body, nib);
    return g;
  }

  _hud() {
    const canvas = (this.hudCanvas = document.createElement('canvas'));
    canvas.width = 512;
    canvas.height = 256;
    this.hudTex = new THREE.CanvasTexture(canvas);
    this.hudTex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshBasicMaterial({ map: this.hudTex, transparent: true }));
    m.position.set(0, 0.06, -0.05);
    m.rotation.x = -0.6;
    this.hudMesh = m;
    return m;
  }

  // ---- wrist menu

  /** The menu's buttons, given the current state (some only appear when they apply). */
  _items() {
    const g = this.game;
    const near = g.exposure >= 0.96 && g.exposure < 1;
    return [
      { id: 'wet', label: 'Wet the surface' },
      near && { id: 'left', label: g.showLeft ? 'Hide leftovers' : 'Show leftovers' },
      near && { id: 'sweep', label: 'Sweep the rest', hot: true },
      { id: 'recentre', label: 'Recentre the bench' },
      { id: 'pack', label: 'Pack up for the day' },
      { id: 'finish', label: 'Finish the specimen', hot: true },
      { id: 'exit', label: 'Leave VR' },
    ].filter(Boolean);
  }

  _menu() {
    const canvas = (this.menuCanvas = document.createElement('canvas'));
    canvas.width = 512;
    canvas.height = 640;
    this.menuTex = new THREE.CanvasTexture(canvas);
    this.menuTex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.15), new THREE.MeshBasicMaterial({ map: this.menuTex, transparent: true }));
    m.position.set(0.02, 0.11, -0.07);
    m.rotation.x = -0.45;
    m.visible = false;
    this.menuMesh = m;
    return m;
  }

  _drawMenu() {
    const c = this.menuCanvas.getContext('2d'), items = (this.menuItems = this._items());
    c.clearRect(0, 0, 512, 640);
    c.fillStyle = 'rgba(20,20,24,0.9)';
    c.beginPath();
    c.roundRect(0, 0, 512, 640, 28);
    c.fill();
    c.fillStyle = '#e0b35a';
    c.font = '600 30px system-ui, sans-serif';
    c.fillText('Fossil Hunter', 28, 52);
    const h = 74, top = 80;
    items.forEach((it, i) => {
      const y = top + i * h;
      it.rect = [20, y, 472, h - 12];
      c.fillStyle = this.menuHover === i ? '#5a4a2c' : it.hot ? '#3a3122' : '#2a2620';
      c.beginPath();
      c.roundRect(...it.rect, 14);
      c.fill();
      c.fillStyle = '#f2e6d0';
      c.font = '30px system-ui, sans-serif';
      c.fillText(it.label, 44, y + 42);
    });
    this.menuTex.needsUpdate = true;
  }

  _ray() {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xf0c060, transparent: true, opacity: 0.8 }));
    line.scale.z = 0.4;
    line.visible = false;
    this.rayLine = line;
    return line;
  }

  setMenu(on) {
    this.menuOn = on;
    if (this.menuMesh) this.menuMesh.visible = on;
    if (this.rayLine) this.rayLine.visible = on;
    this.menuHover = -1;
    if (on) this._drawMenu();
  }

  /** Point the right controller at the menu; returns the hovered item index or -1. */
  _pointMenu(R) {
    if (!this.menuMesh) return -1;
    R.updateMatrixWorld();
    this.menuMesh.updateMatrixWorld();
    const o = new THREE.Vector3().setFromMatrixPosition(R.matrixWorld);
    const d = new THREE.Vector3(0, 0, -1).transformDirection(R.matrixWorld);
    const rc = (this._rc ??= new THREE.Raycaster());
    rc.set(o, d);
    const hit = rc.intersectObject(this.menuMesh, false)[0];
    this.rayLine.scale.z = hit ? hit.distance : 0.4;
    if (!hit?.uv) return -1;
    const x = hit.uv.x * 512, y = (1 - hit.uv.y) * 640;
    return (this.menuItems ?? []).findIndex((it) => x >= it.rect[0] && x <= it.rect[0] + it.rect[2] && y >= it.rect[1] && y <= it.rect[1] + it.rect[3]);
  }

  _press(id) {
    const g = this.game, xr = this.view.renderer.xr;
    this._pulse(0.4, 30);
    if (id === 'wet') g.wetten();
    else if (id === 'left') g.setShowLeft(!g.showLeft);
    else if (id === 'sweep') g.sweep();
    else if (id === 'recentre') this.placePending = true;
    else if (id === 'pack') { xr.getSession()?.end(); g.packUp(); }
    else if (id === 'finish') { g.finish(); xr.getSession()?.end(); }
    else if (id === 'exit') xr.getSession()?.end();
    this.waitRelease = true; // the trigger that pressed the button mustn't also fire the tool
    if (id !== 'left') this.setMenu(false);
    else this._drawMenu();
  }

  _drawHud(trigger, gripv) {
    const c = this.hudCanvas?.getContext('2d');
    if (!c) return;
    const g = this.game, d = g.describeSettings();
    c.clearRect(0, 0, 512, 256);
    c.fillStyle = 'rgba(20,20,24,0.82)';
    c.beginPath();
    c.roundRect(0, 0, 512, 256, 24);
    c.fill();
    c.fillStyle = '#f2e6d0';
    c.font = '600 40px system-ui, sans-serif';
    c.fillText(d.tool + (d.media ? ` · ${d.media}` : ''), 24, 56);
    c.font = '28px system-ui, sans-serif';
    const bar = (y, label, v) => {
      c.fillStyle = '#9a917f';
      c.fillText(label, 24, y);
      c.fillStyle = '#3a352d';
      c.fillRect(220, y - 22, 260, 22);
      c.fillStyle = '#e0b35a';
      c.fillRect(220, y - 22, 260 * v, 22);
    };
    bar(110, d.xLabel, trigger);
    bar(150, d.yLabel, gripv);
    c.fillStyle = '#f2e6d0';
    c.fillText(`Exposed ${Math.round(g.exposure * 100)}%`, 24, 200);
    c.fillStyle = g.rate.integ > 0.005 ? '#e07a5a' : '#9cc58a';
    c.fillText(`Integrity ${(g.integ.value * 100).toFixed(1)}%`, 24, 238);
    // Frame timing (for tuning on the headset): typical and worst frame of the last few seconds.
    const p = g.perf;
    if (p?.p50) {
      c.font = '22px ui-monospace, monospace';
      c.fillStyle = p.p95 > 15 ? '#e07a5a' : '#8f8778';
      c.textAlign = 'right';
      c.fillText(`${Math.round(1000 / p.p50)} fps · worst ${Math.round(p.worst)} ms`, 488, 238);
      c.textAlign = 'left';
    }
    this.hudTex.needsUpdate = true;
  }

  _edge(hand, gp, i) {
    const now = !!gp.buttons[i]?.pressed;
    const was = !!this.prev[hand][i];
    this.prev[hand][i] = now;
    return now && !was;
  }

  update(dt) {
    const xr = this.view.renderer.xr;
    if (!xr.isPresenting) return;
    const root = this.view.root, game = this.game;
    if (this.placePending) this._place();

    const L = this.hands.left, R = this.hands.right;
    const lgp = L?.userData.src?.gamepad, rgp = R?.userData.src?.gamepad;

    if (L && lgp) {
      const gripv = lgp.buttons[1]?.value ?? 0;
      if (gripv > 0.55 && !this.grab) {
        L.updateMatrixWorld();
        root.updateMatrixWorld();
        this.grab = new THREE.Matrix4().copy(L.matrixWorld).invert().multiply(root.matrixWorld);
      } else if (gripv < 0.4) this.grab = null;
      const sx = lgp.axes[2] ?? 0;
      if (Math.abs(sx) > 0.15) this.view.setLight(this.view.lightAz + sx * dt * 1.6, this.view.lightEl);
      if (this._edge('left', lgp, 0)) game.wetten();
      const sy = lgp.axes[3] ?? 0;
      if (Math.abs(sy) > 0.15) this.scale = Math.min(0.6, Math.max(0.06, this.scale * Math.exp(-sy * dt * 1.2)));
      if (this.grab) {
        const m = new THREE.Matrix4().multiplyMatrices(L.matrixWorld, this.grab);
        m.decompose(root.position, root.quaternion, new THREE.Vector3());
      }
      root.scale.setScalar(this.scale);
      if (this._edge('left', lgp, 4)) this.setMenu(!this.menuOn);
      if (this._edge('left', lgp, 5)) {
        this.hudOn = !this.hudOn;
        if (this.hudMesh) this.hudMesh.visible = this.hudOn;
      }
    }

    if (R && rgp && this.menuOn) {
      // Menu open: the right controller is a pointer, and the tool rests.
      game.xrAim = null;
      const i = this._pointMenu(R);
      if (i !== this.menuHover) {
        this.menuHover = i;
        this._drawMenu();
      }
      if (this._edge('right', rgp, 0) && i >= 0) this._press(this.menuItems[i].id);
      return;
    }
    if (R && rgp) {
      let trigger = rgp.buttons[0]?.value ?? 0;
      if (this.waitRelease) {
        if (trigger < 0.05) this.waitRelease = false;
        else trigger = 0;
      }
      const gripv = rgp.buttons[1]?.value ?? 0;
      if (this._edge('right', rgp, 4)) game.cycleTool();
      if (this._edge('right', rgp, 5)) game.cycleMedia();
      R.updateMatrixWorld();
      const tipW = new THREE.Vector3(0, 0, -TIP).applyMatrix4(R.matrixWorld);
      const dirW = new THREE.Vector3(0, 0, -1).transformDirection(R.matrixWorld);
      const tool = TOOLS[game.settings.tool];
      const flow = gripv > 0.05 ? gripv : game.settings.flow;
      const edgeW = new THREE.Vector3(1, 0, 0).transformDirection(R.matrixWorld);
      game.xrAim = {
        tip: this.view.toLocal(tipW),
        dir: this.view.dirToLocal(dirW).normalize(),
        e: this.view.dirToLocal(edgeW).normalize(),
        active: trigger > 0.05,
        pressure: trigger,
        flow,
      };
      if (trigger > 0.05 && tool.kind !== 'chisel') this._contactBuzz(trigger);
      // Chisel: squeeze the grip to call off a wound-up blow.
      if (tool.kind === 'chisel' && gripv > 0.6) game.cancelChisel();
      this.hudTimer -= dt;
      if (this.hudOn && this.hudTimer <= 0) {
        this.hudTimer = 0.25;
        this._drawHud(trigger, flow);
      }
    } else {
      game.xrAim = null;
    }
  }

  _pulse(v, ms) {
    const h = this.hands.right?.userData.src?.gamepad?.hapticActuators?.[0];
    h?.pulse?.(Math.min(1, v), ms);
  }

  /** Continuous buzz while the tool runs: stronger and sharper on shell. */
  _contactBuzz(trigger) {
    const g = this.game, v = g.sp.vol, a = g.xrAim;
    const p = v.grid(a.tip.x, a.tip.y, a.tip.z);
    if (v.sampleF(p[0], p[1], p[2]) < -0.7) return;
    const fo = v.sample(v.fossil, p[0], p[1], p[2]), r = v.sample(v.rock, p[0], p[1], p[2]);
    const onShell = fo > -0.7 && fo >= r - 0.3;
    this._pulse(onShell ? 0.55 + 0.3 * trigger : 0.15 + 0.3 * trigger, 18);
  }

  _haptics(ev, p) {
    if (!this.view.renderer.xr.isPresenting) return;
    if (ev.snaps.length) this._pulse(1, 140);
    else if (ev.chips) this._pulse(0.9, 70);
    else if (ev.pops) this._pulse(0.5, 20);
    else if (TOOLS[this.game.settings.tool].kind === 'chisel' && ev.contact !== 'none') this._pulse(0.4 + 0.5 * p, 40);
  }
}
