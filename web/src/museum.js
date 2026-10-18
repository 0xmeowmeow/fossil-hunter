// The museum: a small heritage hall (in the spirit of the old schoolhouse that holds the
// Somerville Collection in Bathurst) with display cases for the specimens you've prepared.
//
// Each case shows a baked display mesh (bake.js) at a little over life size, with a label
// card. On a screen: drag to look, click a case (or the floor) to walk there. In VR: point at
// the floor and pull the trigger to step there; the right stick turns.

import * as THREE from 'three';
import { specimenMaterial } from './view.js';
import * as save from './save.js';
import { LEVELS, SPECIAL } from './data.js';
import { known, DEPOSITS } from './science.js';

const SCALE = 0.05 * 4; // specimen units -> metres (1 unit = 5 cm), shown enlarged for reading
const EYE = 1.6;
const HALL = { w: 10, d: 14, h: 5 };

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#6b4a2f';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16; i++) {
    const x = i * 32;
    g.fillStyle = `hsl(${24 + (i * 7) % 9}, ${38 + (i * 13) % 12}%, ${25 + (i * 11) % 9}%)`;
    g.fillRect(x, 0, 31, 512);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x + 31, 0, 1, 512);
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(30,18,8,${0.04 + Math.random() * 0.06})`;
      g.fillRect(x + Math.random() * 31, Math.random() * 512, 1, 20 + Math.random() * 80);
    }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(x, (i * 137) % 512, 31, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(HALL.w / 2.5, HALL.d / 2.5);
  t.anisotropy = 8;
  return t;
}

/** A label card: name in italics, then where it's from and who prepared it. */
function labelTexture(lines) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#efe5cd';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(80,60,30,0.5)';
  g.lineWidth = 3;
  g.strokeRect(10, 10, 492, 236);
  g.fillStyle = '#2a2118';
  g.font = 'italic 700 44px Fraunces, Georgia, serif';
  g.fillText(lines[0], 28, 78, 456);
  // Three lines fit at a comfortable size; a fourth squeezes them up a little.
  const more = lines.length > 3;
  g.font = `500 ${more ? 22 : 26}px Fraunces, Georgia, serif`;
  lines.slice(1).forEach((l, i) => g.fillText(l, 28, (more ? 120 : 128) + i * (more ? 32 : 38), 456));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Museum {
  constructor(view, game, ui) {
    this.view = view;
    this.game = game;
    this.ui = ui;
    this.active = false;
    this.group = null;
    this.cases = [];
    this.yaw = 0; // looking down the hall (-z)
    this.pitch = -0.12;
    this.pos = new THREE.Vector3(0, EYE, HALL.d / 2 - 1.2);
    this.glide = null;
  }

  // ---- the hall

  _build() {
    const G = (this.group = new THREE.Group());
    const { w, d, h } = HALL;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    floor.name = 'floor';
    const plaster = new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.95 });
    const timber = new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.55 });
    const wall = (W, x, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(W, h), plaster);
      m.position.set(x, h / 2, z);
      m.rotation.y = ry;
      const dado = new THREE.Mesh(new THREE.BoxGeometry(W, 1.0, 0.04), timber);
      dado.position.set(x, 0.5, z);
      dado.rotation.y = ry;
      dado.translateZ(0.02);
      G.add(m, dado);
    };
    wall(w, 0, -d / 2, 0);
    wall(w, 0, d / 2, Math.PI);
    wall(d, -w / 2, 0, Math.PI / 2);
    wall(d, w / 2, 0, -Math.PI / 2);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xd9cfba, roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = h;
    // Tall windows down both long walls: warm daylight.
    const glow = new THREE.MeshBasicMaterial({ color: 0xfff1d6 });
    for (let i = -2; i <= 2; i++) {
      for (const s of [-1, 1]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.4), glow);
        win.position.set(s * (w / 2 - 0.01), 2.9, i * 2.6);
        win.rotation.y = -s * Math.PI / 2;
        G.add(win);
      }
    }
    for (let i = -3; i <= 3; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, 0.18), timber);
      beam.position.set(0, h - 0.12, i * 2);
      G.add(beam);
    }
    G.add(floor, ceiling);
    G.add(new THREE.HemisphereLight(0xfff4e0, 0x5a4634, 1.1));
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.4);
    sun.position.set(-4, 6, 3);
    G.add(sun);

    // Display cases: five down each side, one in the middle for the star of the collection.
    this.cases = [];
    const spots = [];
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) spots.push({ x: s * (w / 2 - 1.1), z: -d / 2 + 2.2 + i * 2.3, face: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
    spots.unshift({ x: 0, z: -1, face: 0, star: true });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xdfeff5, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, depthWrite: false });
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x2c1d14, roughness: 0.5 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1d1a17, roughness: 0.95 });
    for (const sp of spots) {
      const c = new THREE.Group();
      c.position.set(sp.x, 0, sp.z);
      c.rotation.y = sp.face;
      const size = sp.star ? 0.62 : 0.46;
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(size, 0.95, size), plinthMat);
      plinth.position.y = 0.475;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(size * 0.92, 0.02, size * 0.92), padMat);
      pad.position.y = 0.96;
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.2, size * 0.23, 0.04, 24), padMat);
      riser.position.y = 0.99;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(size, 0.5, size), glassMat);
      glass.position.y = 1.22;
      c.add(riser);
      glass.renderOrder = 2;
      c.add(plinth, pad, glass);
      c.userData = { case: this.cases.length, size, star: !!sp.star };
      G.add(c);
      this.cases.push({ group: c, size, star: !!sp.star, item: null, mesh: null });
    }
    this.view.scene.add(G);
  }

  /** Put the museum pieces in their cases (best first in the middle). */
  async _fill() {
    const items = (await save.listItems()).filter((it) => it.status === 'prepared' && it.where === 'museum' && !it.loanedTo);
    items.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    for (const c of this.cases) {
      if (c.mesh) { c.group.remove(c.mesh); c.mesh.traverse((o) => o.geometry?.dispose()); c.mesh = null; }
      if (c.label) { c.group.remove(c.label); c.label = null; }
      c.item = null;
    }
    let i = 0;
    const sci = known(await save.profile());
    for (const it of items) {
      const c = this.cases[i++];
      if (!c) break;
      const mesh = await save.loadDisplay(it.id);
      if (!mesh) continue;
      c.item = it;
      c.mesh = this._specimen(mesh, c.size);
      c.group.add(c.mesh);
      const lv = it.special ? SPECIAL[it.level] : LEVELS.find((l) => l.id === it.level);
      // Honest labels: repairs are declared; the science track adds the age of the rock.
      const lines = [it.name || lv?.title || 'Specimen', lv ? `${lv.place}` : '',
        `Prepared on day ${it.day ?? '?'} · valued at $${it.value ?? 0}${it.repaired ? ' · spines repaired' : ''}`];
      if (lv && sci.has('stratigraphy') && DEPOSITS[lv.id]) lines.splice(2, 0, `${DEPOSITS[lv.id].age[0].toUpperCase()}${DEPOSITS[lv.id].age.slice(1)} old`);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map: labelTexture(lines) }));
      label.position.set(0, 0.84, c.size / 2 + 0.004);
      label.rotation.x = -0.25;
      c.group.add(label);
      c.label = label;
    }
    this.count = items.length;
    return items.length;
  }

  /** A baked display mesh as a scene object, sitting on its pad, centred. */
  _specimen(b, size) {
    const g = new THREE.Group();
    const uniforms = {
      uWet: { value: 0 }, uInk: { value: this.view.blankInk }, uInkRect: { value: new THREE.Vector3(0, 0, 1) }, uInkOn: { value: 0 },
      uLeft: { value: 0 }, uTime: { value: 0 },
      uOpalA: { value: new THREE.Vector4(0.02, 0.06, 0.2, 0) }, uOpalB: { value: new THREE.Vector4(440, 600, 0.1, 1) },
      uCamObj: { value: new THREE.Vector3() }, uKeyObj: { value: new THREE.Vector3(0, 0, 1) }, uSkyObj: { value: new THREE.Vector3(0, 0, 1) },
    };
    if (b.opal) {
      const o = b.opal;
      uniforms.uOpalA.value.set(o.scale, o.width, o.roll, o.seed);
      uniforms.uOpalB.value.set(o.lmin, o.lmax, (o.tone - 1) / 6, [0, 2.2, 1.7, 1.3, 0.95, 0.65][o.bright]);
    }
    const mat = specimenMaterial(uniforms);
    const inner = new THREE.Group(); // specimen space (z up), centred on the pad
    for (const [part, rough, grain] of [['rock', 0.9, 1], ['shell', null, 0.06]]) {
      const m = b[part];
      if (!m) continue;
      const n = m.pos.length / 3;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n * 3; i++) col[i] = Math.pow(m.col[i] / 255, 2.2);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('rough', new THREE.BufferAttribute(m.rough ?? new Float32Array(n).fill(rough), 1));
      geo.setAttribute('metal', new THREE.BufferAttribute(m.metal ?? new Float32Array(n), 1));
      geo.setAttribute('grain', new THREE.BufferAttribute(new Float32Array(n).fill(grain), 1));
      geo.setAttribute('opal', new THREE.BufferAttribute(m.opal ?? new Float32Array(n), 1));
      geo.setIndex(new THREE.BufferAttribute(m.idx, 1));
      geo.computeBoundingSphere();
      inner.add(new THREE.Mesh(geo, mat));
    }
    const lo = b.lo, hi = b.hi;
    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1]) * SCALE;
    const s = span > size * 0.85 ? (size * 0.85) / span : 1; // big blocks are shrunk to fit the case
    inner.position.set(-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]);
    const zup = new THREE.Group();
    zup.rotation.x = -Math.PI / 2;
    zup.scale.setScalar(SCALE * s);
    zup.add(inner);
    zup.position.y = 1.01; // on the riser
    g.add(zup);
    g.userData = { uniforms, inner };
    return g;
  }

  // ---- visiting

  async enter() {
    if (!this.group) this._build();
    this.active = true;
    this.group.visible = true;
    this.view.showcaseMode(false); // (this shows the bench again, so hide it after)
    this.view.root.visible = false;
    this.view.scene.background = new THREE.Color(0x2a241e);
    const n = await this._fill();
    if (!this.view.renderer.xr.isPresenting) this._camera();
    else this.placeXR();
    return n;
  }

  leave() {
    this.active = false;
    if (this.group) this.group.visible = false;
    this.view.root.visible = true;
    this.view.scene.background = new THREE.Color(0x17171a);
    this.view.camera.position.set(0, 0, 0);
    this.view._placeCamera();
  }

  _camera() {
    const c = this.view.camera;
    c.position.copy(this.pos);
    c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /** Drag to look. */
  look(dx, dy) {
    this.yaw -= dx * 0.004;
    this.pitch = Math.max(-1.2, Math.min(1.0, this.pitch - dy * 0.004));
    this.glide = null;
    this._camera();
  }

  /** Click: walk to a case (stand in front of it, looking in), or to a spot on the floor. */
  click(x, y) {
    const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.view.camera);
    const hits = rc.intersectObject(this.group, true);
    for (const h of hits) {
      let o = h.object;
      while (o && o.userData.case === undefined && o !== this.group) o = o.parent;
      if (o && o.userData.case !== undefined) {
        const c = this.cases[o.userData.case];
        const front = new THREE.Vector3(0, 0, 1).applyQuaternion(c.group.quaternion);
        const to = c.group.position.clone().addScaledVector(front, c.size / 2 + 0.5).setY(EYE - 0.2);
        const target = c.group.position.clone().setY(1.06);
        this._walk(to, target);
        return c.item;
      }
      if (h.object.name === 'floor') {
        const to = h.point.clone().setY(EYE);
        to.x = Math.max(-HALL.w / 2 + 0.5, Math.min(HALL.w / 2 - 0.5, to.x));
        to.z = Math.max(-HALL.d / 2 + 0.5, Math.min(HALL.d / 2 - 0.5, to.z));
        this._walk(to, null);
        return null;
      }
    }
    return null;
  }

  _walk(to, lookAt) {
    let yaw = this.yaw, pitch = this.pitch;
    if (lookAt) {
      const d = lookAt.clone().sub(to);
      yaw = Math.atan2(-d.x, -d.z);
      pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    }
    // Take the short way round.
    while (yaw - this.yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw - this.yaw < -Math.PI) yaw += Math.PI * 2;
    this.glide = { from: this.pos.clone(), to, y0: this.yaw, y1: yaw, p0: this.pitch, p1: pitch, t: 0 };
  }

  // ---- VR: the hall is placed around the player; trigger at the floor to step, stick to turn

  placeXR() {
    const cam = this.view.renderer.xr.getCamera();
    const p = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    // Entrance under the player's feet, looking down the hall.
    this.group.position.set(p.x, 0, p.z - (HALL.d / 2 - 1.2));
    this.group.rotation.set(0, 0, 0);
  }

  /** VR teleport: move the hall so the pointed-at floor spot comes to the player's feet. */
  teleport(ray) {
    const hit = new THREE.Raycaster(ray.origin, ray.direction).intersectObject(this.group.getObjectByName('floor'), false)[0];
    if (!hit) return false;
    const cam = this.view.renderer.xr.getCamera();
    const p = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    this.group.position.x += p.x - hit.point.x;
    this.group.position.z += p.z - hit.point.z;
    return true;
  }

  turnXR(angle) {
    const cam = this.view.renderer.xr.getCamera();
    const p = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld).setY(0);
    // Rotate the hall about the player.
    this.group.position.sub(p).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).add(p);
    this.group.rotation.y += angle;
  }

  update(dt) {
    if (!this.active) return;
    const g = this.glide;
    if (g) {
      g.t = Math.min(1, g.t + dt / 0.9);
      const e = g.t * g.t * (3 - 2 * g.t);
      this.pos.lerpVectors(g.from, g.to, e);
      this.yaw = g.y0 + (g.y1 - g.y0) * e;
      this.pitch = g.p0 + (g.p1 - g.p0) * e;
      if (g.t >= 1) this.glide = null;
    }
    if (!this.view.renderer.xr.isPresenting) this._camera(); // (also undoes the bench's resize framing)
    // Opal fire needs the eye and light in each specimen's own space.
    const cam = this.view.renderer.xr.isPresenting ? this.view.renderer.xr.getCamera() : this.view.camera;
    const eye = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    for (const c of this.cases) {
      const u = c.mesh?.userData.uniforms;
      if (!u || !(u.uOpalB.value.w > 0) || !c.item) continue;
      const inner = c.mesh.userData.inner;
      inner.updateWorldMatrix(true, false);
      const inv = inner.matrixWorld.clone().invert();
      u.uCamObj.value.copy(eye).applyMatrix4(inv);
      u.uKeyObj.value.set(-0.6, 1, 0.4).transformDirection(inv);
      u.uSkyObj.value.set(0.3, 1, 0.5).transformDirection(inv);
    }
  }
}
