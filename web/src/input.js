// 2D input for iPad and PC.
//   Canvas, one finger / left mouse / Apple Pencil: use the tool where you touch.
//   Canvas, two fingers: drag turns the specimen, pinch zooms, twist rolls.
//   Mouse: right or middle drag turns, wheel zooms, hover shows the tool tip.
//   Pad (left thumb): x = air pressure, y = abrasive flow / stroke rate. It stays where released.
//   Angle gizmo: drag the dot the way the tool should lean (centre = straight in). Sticky.
//   Apple Pencil: its tilt and azimuth are the tool's angle while drawing.
//   Light dial: drag the sun to move the lamp (centre = overhead, edge = raking).

import * as THREE from 'three';

export class Input {
  constructor(canvas, pad, game) {
    this.canvas = canvas;
    this.game = game;
    this.view = game.view;
    this.pointers = new Map();
    this.toolPointer = null;
    this.hover = null;
    this.gesture = null;

    canvas.addEventListener('pointerdown', (e) => this._down(e));
    canvas.addEventListener('pointermove', (e) => this._move(e));
    canvas.addEventListener('pointerup', (e) => this._up(e));
    canvas.addEventListener('pointercancel', (e) => this._up(e));
    canvas.addEventListener('pointerleave', () => (this.hover = null));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.view.zoom(Math.exp(e.deltaY * 0.0012));
    }, { passive: false });
    this._pad(pad);
    this._angle(document.getElementById('angle'));
    this._light(document.getElementById('light'));
    window.addEventListener('keydown', (e) => this._key(e));
  }

  _down(e) {
    this.game.sfx.resume();
    this.canvas.setPointerCapture(e.pointerId);
    const p = { x: e.clientX, y: e.clientY, type: e.pointerType, button: e.button };
    this.pointers.set(e.pointerId, p);
    const touches = [...this.pointers.values()].filter((q) => q.type === 'touch');
    if (e.pointerType === 'mouse' && e.button !== 0) {
      // Right/middle button while a chisel blow is wound up: call it off.
      if (this.toolPointer !== null && this.game.cancelChisel()) {
        this.toolPointer = null;
        this.pointers.delete(e.pointerId);
        return;
      }
      this.gesture = { kind: 'turn', last: [e.clientX, e.clientY] };
      return;
    }
    const bench = this.game.bench;
    if (bench?.active && touches.length < 2) {
      // Display bench: drag turns the block; a click (custom outline) drops a point.
      this.gesture = { kind: 'turn', last: [e.clientX, e.clientY], start: [e.clientX, e.clientY] };
      return;
    }
    if (touches.length >= 2) {
      // Second finger: cancel the tool (a wound-up blow is called off, not released).
      this.game.cancelChisel();
      this._endTool();
      this.gesture = { kind: 'multi', ...this._multi() };
      return;
    }
    this.toolPointer = e.pointerId;
    this.game.aimScreen(e.clientX, e.clientY, true, this._pencil(e), this._penAngle(e));
  }

  _move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') {
        this.hover = [e.clientX, e.clientY];
        this.game.aimScreen(e.clientX, e.clientY, false, 1);
      }
      return;
    }
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.gesture?.kind === 'turn') {
      const [lx, ly] = this.gesture.last;
      this._turn(e.clientX - lx, e.clientY - ly);
      this.gesture.last = [e.clientX, e.clientY];
    } else if (this.gesture?.kind === 'multi') {
      const m = this._multi();
      if (!m) return;
      this._turn(m.cx - this.gesture.cx, m.cy - this.gesture.cy);
      if (this.gesture.dist > 0 && m.dist > 0) this.view.zoom(this.gesture.dist / m.dist);
      const da = m.ang - this.gesture.ang;
      this.view.turn(new THREE.Vector3(0, 0, 1).applyQuaternion(this.view.camera.quaternion), -da);
      Object.assign(this.gesture, m);
    } else if (e.pointerId === this.toolPointer) {
      this.game.aimScreen(e.clientX, e.clientY, true, this._pencil(e), this._penAngle(e));
    }
  }

  _up(e) {
    this.pointers.delete(e.pointerId);
    const g = this.gesture, bench = this.game.bench;
    if (bench?.active && g?.start && Math.hypot(e.clientX - g.start[0], e.clientY - g.start[1]) < 6) this.game.benchClick?.(e.clientX, e.clientY);
    if (e.type === 'pointercancel' && e.pointerId === this.toolPointer) this.game.cancelChisel();
    if (e.pointerId === this.toolPointer) this._endTool();
    if (this.gesture && (this.gesture.kind === 'turn' || this.pointers.size < 2)) this.gesture = null;
  }

  _endTool() {
    this.toolPointer = null;
    this.game.aimScreen(null, null, false, 1);
  }

  _pencil(e) {
    // Apple Pencil pressure acts as a throttle on the pad's air pressure.
    return e.pointerType === 'pen' && e.pressure > 0 ? 0.3 + 0.9 * e.pressure : 1;
  }

  /** Apple Pencil tilt -> tool angle (tilt 0-1 of 70 deg, azimuth on screen). */
  _penAngle(e) {
    if (e.pointerType !== 'pen') return null;
    let alt = e.altitudeAngle, az = e.azimuthAngle;
    if (alt === undefined && (e.tiltX || e.tiltY)) {
      const tx = (e.tiltX * Math.PI) / 180, ty = (e.tiltY * Math.PI) / 180;
      az = Math.atan2(Math.tan(ty), Math.tan(tx));
      alt = Math.atan(1 / Math.hypot(Math.tan(tx), Math.tan(ty)));
    }
    if (alt === undefined) return null;
    return { tilt: Math.min(1, (Math.PI / 2 - alt) / ((70 * Math.PI) / 180)), az };
  }

  /** A sticky circular control: calls set(dx, dy) with offsets in -1..1 from the centre. */
  _disc(el, set) {
    const read = (e) => {
      const r = el.getBoundingClientRect();
      let dx = ((e.clientX - r.left) / r.width) * 2 - 1, dy = ((e.clientY - r.top) / r.height) * 2 - 1;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      set(dx, dy);
    };
    el.addEventListener('pointerdown', (e) => {
      this.game.sfx.resume();
      el.setPointerCapture(e.pointerId);
      el.dataset.drag = e.pointerId;
      read(e);
      e.stopPropagation();
    });
    el.addEventListener('pointermove', (e) => { if (el.dataset.drag == e.pointerId) read(e); });
    const up = (e) => { if (el.dataset.drag == e.pointerId) delete el.dataset.drag; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  _angle(el) {
    this.angleEl = el;
    this._disc(el, (dx, dy) => this.game.setAngle(Math.hypot(dx, dy), Math.atan2(dy, dx)));
  }

  _light(el) {
    this.lightEl = el;
    const view = this.view;
    this._disc(el, (dx, dy) => {
      // Centre = overhead, rim = raking. Azimuth relative to the camera so "left" is left on screen.
      const r = Math.min(1, Math.hypot(dx, dy));
      const camAz = Math.atan2(view.camera.position.x, view.camera.position.z);
      view.setLight(camAz + Math.atan2(dx, dy), (1 - r) * (Math.PI / 2 - 0.08) + 0.08);
      this.syncLight();
    });
    this.syncLight();
  }

  syncLight() {
    const view = this.view, knob = this.lightEl.querySelector('.knob');
    const camAz = Math.atan2(view.camera.position.x, view.camera.position.z);
    const a = view.lightAz - camAz, r = 1 - (view.lightEl - 0.08) / (Math.PI / 2 - 0.08);
    knob.style.left = `${50 + Math.sin(a) * r * 50}%`;
    knob.style.top = `${50 + Math.cos(a) * r * 50}%`;
  }

  _multi() {
    const t = [...this.pointers.values()].filter((q) => q.type === 'touch');
    if (t.length < 2) return null;
    const [a, b] = t;
    return {
      cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
      dist: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  /** Trackball: screen drag turns the specimen about camera-relative axes. */
  _turn(dx, dy) {
    const cam = this.view.camera;
    const k = 0.006;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    this.view.turn(up, dx * k);
    this.view.turn(right, dy * k);
  }

  _pad(pad) {
    const knob = pad.querySelector('.knob');
    const set = (e) => {
      const r = pad.getBoundingClientRect();
      let x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
      // Constrain to the circle, then use the square coordinates.
      const cx = x - 0.5, cy = y - 0.5, l = Math.hypot(cx, cy);
      if (l > 0.5) {
        x = 0.5 + (cx / l) * 0.5;
        y = 0.5 + (cy / l) * 0.5;
      }
      this.game.setPad(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)));
    };
    this.syncPad = () => {
      const { pressure, flow, angleTilt, angleAz } = this.game.settings;
      knob.style.left = `${pressure * 100}%`;
      knob.style.top = `${(1 - flow) * 100}%`;
      if (this.angleEl) {
        const ak = this.angleEl.querySelector('.knob'), st = this.angleEl.querySelector('.stick');
        const x = Math.cos(angleAz) * angleTilt, y = Math.sin(angleAz) * angleTilt;
        ak.style.left = `${50 + x * 50}%`;
        ak.style.top = `${50 + y * 50}%`;
        st.style.width = `${angleTilt * 50}%`;
        st.style.transform = `rotate(${angleAz}rad)`;
      }
    };
    pad.addEventListener('pointerdown', (e) => {
      this.game.sfx.resume();
      pad.setPointerCapture(e.pointerId);
      pad.dataset.drag = e.pointerId;
      set(e);
      e.stopPropagation();
    });
    pad.addEventListener('pointermove', (e) => {
      if (pad.dataset.drag == e.pointerId) set(e);
    });
    const up = (e) => {
      if (pad.dataset.drag == e.pointerId) delete pad.dataset.drag;
    };
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
  }

  _key(e) {
    if (e.target.tagName === 'INPUT') return;
    const g = this.game, s = g.settings;
    if (e.key === 'Escape' && g.cancelChisel()) {
      this.toolPointer = null;
      e.preventDefault();
      return;
    }
    const tools = { 1: 'chisel', 2: 'scribe_large', 3: 'scribe_fine', 4: 'abrader' };
    const media = { q: 'bicarb', w: 'dolomite', e: 'alox' };
    const heads = { q: 'wedge', w: 'bolster', e: 'point' };
    if (tools[e.key]) g.setTool(tools[e.key]);
    else if (media[e.key]) s.tool === 'chisel' ? g.setHead(heads[e.key]) : g.setMedia(media[e.key]);
    else if (e.key === 'ArrowRight') g.setPad(Math.min(1, s.pressure + 0.05), s.flow);
    else if (e.key === 'ArrowLeft') g.setPad(Math.max(0, s.pressure - 0.05), s.flow);
    else if (e.key === 'ArrowUp') g.setPad(s.pressure, Math.min(1, s.flow + 0.05));
    else if (e.key === 'ArrowDown') g.setPad(s.pressure, Math.max(0, s.flow - 0.05));
    else if (e.key === ']') g.setAngle(s.angleTilt + 0.07, s.angleAz);
    else if (e.key === '[') g.setAngle(s.angleTilt - 0.07, s.angleAz);
    else if (e.key === '.') g.setAngle(s.angleTilt, s.angleAz + 0.2);
    else if (e.key === ',') g.setAngle(s.angleTilt, s.angleAz - 0.2);
    else return;
    e.preventDefault();
  }
}
