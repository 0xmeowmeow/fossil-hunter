// three.js scene: chunk meshes, materials and light, the tool vector with its line of
// action through the rock, chips/dust, damage pulses, camera, and transforms between
// world space and the volume's local (z-up) space.

import * as THREE from 'three';
import { meshChunk, meshGrid } from './mesher.js';
import { showcaseGroup } from './showcase.js';
import { buildFine, shadeFine } from './finefossil.js';
import { makeMarks } from './marks.js';

// Fine-shell resolution: 2x the rock grid on desktop, 1.5x on touch devices and headsets.
export const LITE = /Mobi|Android|iPad|Quest|OculusBrowser/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
const FINE = LITE ? 1.5 : 2;

// Procedural grain: a bump from 3D value noise in object space, applied with screen-space
// derivatives (three's perturbNormalArb). Rock is granular and matte; shell is smooth.
const GRAIN_GLSL = /* glsl */ `
uniform float uWet;
uniform sampler2D uInk;
uniform vec3 uInkRect;
uniform float uInkOn;
uniform float uLeft;
uniform float uTime;
uniform vec4 uOpalA;   // domain scale, flash width, roll, seed
uniform vec4 uOpalB;   // lambda min, lambda max (nm), body tone 0 black..1 light, brightness
uniform vec3 uCamObj;  // camera position, specimen space
uniform vec3 uKeyObj;  // key light direction, specimen space
uniform vec3 uSkyObj;  // overhead room light direction, specimen space
varying vec3 vExtra;
varying vec3 vObjN;
varying float vRough;
varying float vMetal;
varying float vGrain;
varying float vOpal;
varying vec3 vObj;
float gHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1,0,0)), f.x), mix(gHash(i + vec3(0,1,0)), gHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0,0,1)), gHash(i + vec3(1,0,1)), f.x), mix(gHash(i + vec3(0,1,1)), gHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// ---- Precious opal: Bragg diffraction from domains of stacked silica spheres.
// Each domain (a 3D Voronoi cell) is a little crystal with its own lattice-plane normal and
// sphere size. It only flashes when the light reflects off its planes toward the eye
// (half-vector close to the plane normal), in a colour set by Bragg's law: lambda =
// lambda0 * cos(angle of the light to the planes inside the stone). Tilt it and the colour
// slides toward blue; bigger spheres reach red. Several layers below the surface, seen
// through refraction, give the depth.
vec3 oHash(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}
vec3 spectral(float l) {
  // Visible wavelength (nm) -> linear RGB, fading at both ends.
  vec3 c;
  if (l < 440.0) c = vec3(-(l - 440.0) / 60.0, 0.0, 1.0);
  else if (l < 490.0) c = vec3(0.0, (l - 440.0) / 50.0, 1.0);
  else if (l < 510.0) c = vec3(0.0, 1.0, -(l - 510.0) / 20.0);
  else if (l < 580.0) c = vec3((l - 510.0) / 70.0, 1.0, 0.0);
  else if (l < 645.0) c = vec3(1.0, -(l - 645.0) / 65.0, 0.0);
  else c = vec3(1.0, 0.0, 0.0);
  float edge = smoothstep(395.0, 430.0, l) * (1.0 - smoothstep(680.0, 720.0, l));
  return c * c * edge;
}
// Nearest domain: returns its random id (xyz) and how far inside it we are (w: 0 at a boundary).
vec4 oCell(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  vec3 id = vec3(0.0);
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 h = oHash(i + g + uOpalA.w);
    float d = length(g + h - f);
    if (d < d1) { d2 = d1; d1 = d; id = h; } else if (d < d2) d2 = d;
  }
  return vec4(id, d2 - d1);
}
vec3 opalFire(vec3 P, vec3 N, vec3 V) {
  float eta = 1.0 / 1.45;
  vec3 Vi = -refract(-V, N, eta);               // inside, pointing back out toward the eye
  vec3 col = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float depth = float(k) * 0.55 * uOpalA.x;
    vec3 q = (P - Vi * depth) / uOpalA.x + float(k) * 17.3;
    // Organic domain shapes (warped), except harlequin's crisp angular blocks (low roll).
    vec3 w = vec3(gNoise(q * 0.5), gNoise(q * 0.5 + 3.3), gNoise(q * 0.5 + 7.7)) - 0.5;
    vec4 c = oCell(q + w * (0.4 + 1.6 * uOpalA.z));
    // Silica settles in layers, so most lattice planes lie roughly along the surface, tilted
    // by a random amount per domain.
    vec3 n = normalize(N * 0.85 + (c.xyz * 2.0 - 1.0));
    // Rolling flash: the planes bend gently across a big domain.
    n = normalize(n + uOpalA.z * (vec3(gNoise(q * 0.7), gNoise(q * 0.7 + 5.1), gNoise(q * 0.7 + 9.7)) - 0.5));
    float l0 = mix(uOpalB.x, uOpalB.y, pow(fract(c.x * 7.13 + c.z * 3.1), 0.75));
    // Fine growth striations within a domain, as seen under the microscope.
    float stri = 0.8 + 0.2 * sin(dot(q, n) * 40.0 + c.y * 6.28);
    float edge = smoothstep(0.0, 0.12, c.w);
    for (int j = 0; j < 2; j++) {
      vec3 L = j == 0 ? uKeyObj : uSkyObj;
      vec3 Li = -refract(-normalize(L), N, eta);
      vec3 H = normalize(Li + Vi);
      float a = abs(dot(H, n));
      float flash = exp(-(1.0 - a) / (uOpalA.y * 0.65));
      flash *= 0.45 + 0.55 * gNoise(q * 2.3 + c.y * 13.0); // mottled, never a flat fill
      float lam = l0 * abs(dot(Li, n));
      col += spectral(lam) * flash * stri * edge * (j == 0 ? 1.0 : 0.45) * (k == 0 ? 1.0 : k == 1 ? 0.7 : 0.45);
    }
  }
  return col;
}
vec3 grainPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = normalize(dFdx(surf_pos));
  vec3 vSigmaY = normalize(dFdy(surf_pos));
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

export class View {
  constructor(canvas) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.2;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    // Shadows re-render only when something that casts them changes (see render()); in a
    // headset most frames are just head motion.
    r.shadowMap.autoUpdate = false;
    this.shadowDirty = true;
    this._shSig = new Float64Array(7);
    r.xr.enabled = true;

    const s = (this.scene = new THREE.Scene());
    s.background = new THREE.Color(0x17171a);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 50);
    this.camDist = 2.4;
    this.camElev = 0.95; // radians above horizontal
    this._placeCamera();

    // The specimen can be turned (root), the volume is z-up (rot), and offset so the block
    // centre sits at the origin (off). Chunk meshes live in `off`, in volume-local units.
    this.root = new THREE.Group();
    this.rot = new THREE.Group();
    this.rot.rotation.x = -Math.PI / 2;
    this.off = new THREE.Group();
    this.rot.add(this.off);
    this.root.add(this.rot);
    s.add(this.root);

    s.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a241e, 0.4));
    // Movable raking key light: swing it to read relief and lustre, as under a lamp.
    const key = (this.key = new THREE.DirectionalLight(0xfff1dc, 3.4));
    key.castShadow = true;
    key.shadow.mapSize.setScalar(LITE ? 1024 : 2048);
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -1.3;
    sc.right = sc.top = 1.3;
    sc.near = 0.1;
    sc.far = 8;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.012;
    s.add(key);
    const fill = new THREE.DirectionalLight(0xc8d6ff, 0.45);
    fill.position.set(2, 2.5, 2);
    s.add(fill);
    this.setLight(-1.1, 0.5);

    const blank = (this.blankInk = new THREE.DataTexture(new Uint8Array(4), 1, 1));
    blank.needsUpdate = true;
    this.uniforms = { uWet: { value: 0 }, uInk: { value: blank }, uInkRect: { value: new THREE.Vector3(0, 0, 1) }, uInkOn: { value: 0 }, uLeft: { value: 0 }, uTime: { value: 0 },
      uOpalA: { value: new THREE.Vector4(0.02, 0.06, 0.2, 0) }, uOpalB: { value: new THREE.Vector4(440, 600, 0.1, 1) },
      uCamObj: { value: new THREE.Vector3() }, uKeyObj: { value: new THREE.Vector3(0, 0, 1) }, uSkyObj: { value: new THREE.Vector3(0, 0, 1) } };
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    this.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float rough;\nattribute float metal;\nattribute float grain;\nattribute float opal;\nattribute vec3 extra;\nvarying vec3 vExtra;\nvarying vec3 vObjN;\nvarying float vRough;\nvarying float vMetal;\nvarying float vGrain;\nvarying float vOpal;\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRough = rough; vMetal = metal; vGrain = grain; vOpal = opal; vObj = position; vExtra = extra; vObjN = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + GRAIN_GLSL)
        // Wetting darkens porous rock and glosses everything: contrast goes up, as in the lab.
        // Water also lets the shell show through thin matrix: a dark shadow where it lies just
        // beneath. Then ink, paint and labels on the original surface (see marks.js).
        .replace('#include <color_fragment>', `#include <color_fragment>
          diffuseColor.rgb *= mix(1.0, 0.6, uWet * vGrain);
          diffuseColor.rgb *= 1.0 - uWet * vExtra.y * 0.62;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.55, 0.1), vExtra.z * uLeft * 0.75);
          // Precious opal's body: black opal is near-black, light opal milky grey.
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.012, 0.014, 0.02), vec3(0.42, 0.44, 0.47), uOpalB.z), smoothstep(0.0, 0.5, vOpal));
          if (uInkOn > 0.5 && vExtra.x > 0.01) {
            vec3 on = normalize(vObjN);
            float sx = (vObj.x - uInkRect.x) / uInkRect.z, t = (vObj.y - uInkRect.y) / uInkRect.z;
            bool upF = on.z > 0.0;
            vec4 ink = texture2D(uInk, vec2(sx, upF ? 0.5 + 0.5 * t : 0.5 - 0.5 * t));
            float a = ink.a * smoothstep(0.3, 0.7, abs(on.z)) * smoothstep(0.3, 0.9, vExtra.x) * (0.8 + 0.2 * gNoise(vObj * 520.0));
            diffuseColor.rgb = mix(diffuseColor.rgb, ink.rgb, a);
          }`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(mix(vRough, 0.38, uWet * 0.75), 0.07, smoothstep(0.0, 0.5, vOpal));')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vMetal;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec3 q = vObj * 240.0;
            float fade = clamp(1.6 - length(fwidth(q)), 0.0, 1.0);
            // Water fills the pores, so a wet surface reads smoother.
            float h = vGrain * fade * (1.0 - 0.75 * uWet) * (gNoise(q) * 0.6 + gNoise(q * 2.7) * 0.4);
            normal = grainPerturb(-vViewPosition, normal, vec2(dFdx(h), dFdy(h)) * 0.6, faceDirection);
          }`)
        // Precious opal: play-of-colour (opalFire above), strongest where the shell is most opalised.
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // Leftover rock on the shell, when asked for: a slow amber pulse.
          if (uLeft > 0.0 && vExtra.z > 0.01) totalEmissiveRadiance += vec3(1.0, 0.45, 0.08) * vExtra.z * uLeft * (0.9 + 0.6 * sin(uTime * 4.0));
          if (vOpal > 0.01) {
            vec3 P = vObj, N = normalize(vObjN);
            if (!gl_FrontFacing) N = -N;
            vec3 V = normalize(uCamObj - P);
            totalEmissiveRadiance += opalFire(P, N, V) * vOpal * uOpalB.w;
          }`);
    };
    this.chunks = new Map();

    this._initTool();
    this._initChips();
    this._initChisel();
    this.pulses = [];
    this.debris = [];

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setMarks(m) {
    if (this.uniforms.uInk.value !== this.blankInk) this.uniforms.uInk.value.dispose();
    this.uniforms.uInk.value = this.blankInk;
    this.uniforms.uInkOn.value = 0;
    if (!m) return;
    const tex = new THREE.CanvasTexture(m.canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.uniforms.uInk.value = tex;
    this.uniforms.uInkRect.value.set(...m.rect);
    this.uniforms.uInkOn.value = 1;
  }

  /** Key light direction: azimuth (radians, around the vertical) and elevation above the horizon. */
  setLight(az, el) {
    this.lightAz = az;
    this.lightEl = Math.min(1.45, Math.max(0.08, el));
    const c = Math.cos(this.lightEl);
    this.key.position.set(Math.sin(az) * c * 3, Math.sin(this.lightEl) * 3, Math.cos(az) * c * 3);
  }

  _placeCamera() {
    const d = this.camDist, e = this.camElev;
    this.camera.position.set(0, Math.sin(e) * d, Math.cos(e) * d);
    this.camera.lookAt(0, 0, 0);
  }

  zoom(f) {
    this.camDist = Math.min(10, Math.max(0.35, this.camDist * f));
    this._placeCamera();
  }

  /** Camera distance that fits the block across the narrower screen dimension. */
  _fit() {
    const t = Math.tan((this.camera.fov * Math.PI) / 360);
    this.camDist = Math.max(2.4, 0.95 / (t * Math.min(1, this.camera.aspect)));
    this._placeCamera();
  }

  /** Turn the specimen about a world axis (trackball). */
  turn(axis, angle) {
    const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    this.root.quaternion.premultiply(q);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this._fitted === undefined || Math.abs(this._fitted - this.camera.aspect) > 0.2) {
      this._fitted = this.camera.aspect;
      this._fit();
    }
    this._layoutShowcase();
  }

  setSpecimen(sp) {
    for (const m of this.chunks.values()) {
      this.off.remove(m);
      m.geometry.dispose();
    }
    this.chunks.clear();
    for (const f of this.fine?.values() ?? []) {
      this.off.remove(f.mesh);
      f.mesh.geometry.dispose();
    }
    this.fine = new Map();
    this.sp = sp;
    this.setOpal(sp.opal);
    // Marks people left on the rock, drawn once fonts are in.
    this.uniforms.uInkOn.value = 0;
    makeMarks(sp, sp.level).then((m) => this.sp === sp && this.setMarks(m)).catch((e) => console.warn('marks', e));
    // The shell, finely meshed from the animal's exact shape.
    const v = sp.vol;
    const t0 = performance.now();
    const chunks = buildFine({ origin: v.origin, voxel: v.voxel, nx: v.nx, ny: v.ny, nz: v.nz, field: v.fossil0, fn: (x, y, z) => sp.tri.field(x, y, z) }, FINE);
    sp.fine = chunks.length > 0;
    for (const ch of chunks) this._addFine(ch);
    this.fineMs = performance.now() - t0;
    const c = [0, 1, 2].map((i) => (sp.bLo[i] + sp.bHi[i]) / 2);
    this.off.position.set(-c[0], -c[1], -c[2]);
    this.root.quaternion.identity();
    this._fit();
    for (let z = 0; z < v.cz; z++) for (let y = 0; y < v.cy; y++) for (let x = 0; x < v.cx; x++) this._remesh(x + y * v.cx + z * v.cx * v.cy);
    v.dirty.clear();
  }

  _addFine(ch) {
    const g = new THREE.BufferGeometry();
    const nv = ch.nv;
    const buf = { pos: new Float32Array(nv * 3), col: new Float32Array(nv * 3), rough: new Float32Array(nv), metal: new Float32Array(nv), grain: new Float32Array(nv), opal: new Float32Array(nv) };
    const idx = shadeFine(this.sp, ch, buf);
    g.setAttribute('position', new THREE.BufferAttribute(buf.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(ch.nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(buf.col, 3));
    g.setAttribute('rough', new THREE.BufferAttribute(buf.rough, 1));
    g.setAttribute('metal', new THREE.BufferAttribute(buf.metal, 1));
    g.setAttribute('grain', new THREE.BufferAttribute(buf.grain, 1));
    g.setAttribute('opal', new THREE.BufferAttribute(buf.opal, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.material);
    mesh.castShadow = mesh.receiveShadow = true;
    this.off.add(mesh);
    this.fine.set(ch.key, { ch, buf, mesh, idx });
  }

  /** Bring a fine shell chunk up to date with the simulation (marks, chips, lost pieces). */
  _refreshFine(key) {
    const f = this.fine?.get(key);
    if (!f) return;
    const idx = shadeFine(this.sp, f.ch, f.buf);
    const g = f.mesh.geometry;
    for (const a of ['position', 'color', 'rough', 'metal', 'grain', 'opal']) g.attributes[a].needsUpdate = true;
    if (idx !== f.idx) {
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      f.idx = idx;
    }
  }

  _remesh(key) {
    if (!this.skipFine) this._refreshFine(key); // the display bench only saws rock
    const v = this.sp.vol;
    const x = key % v.cx, y = Math.floor(key / v.cx) % v.cy, z = Math.floor(key / (v.cx * v.cy));
    this._applyChunk({ key, data: meshChunk(this.sp, x, y, z), fine: null });
  }

  /** Put a built chunk into the scene (see _buildChunk). */
  _applyChunk({ key, data, fine }) {
    if (fine) {
      const { f, buf, idx } = fine;
      for (const k in buf) f.buf[k].set(buf[k]);
      const g = f.mesh.geometry;
      for (const a of ['position', 'color', 'rough', 'metal', 'grain', 'opal']) g.attributes[a].needsUpdate = true;
      // shadeFine returns the chunk's own index when nothing was lost, else a new trimmed one.
      const own = idx === f.ch.idx;
      if (own ? f.idx !== f.ch.idx : true) {
        g.setIndex(new THREE.BufferAttribute(idx, 1));
        f.idx = idx;
      }
    }
    this.shadowDirty = true;
    const old = this.chunks.get(key);
    if (old) {
      this.off.remove(old);
      old.geometry.dispose();
      this.chunks.delete(key);
    }
    if (!data) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(data.nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(data.col, 3));
    g.setAttribute('rough', new THREE.BufferAttribute(data.rough, 1));
    g.setAttribute('metal', new THREE.BufferAttribute(data.metal, 1));
    g.setAttribute('grain', new THREE.BufferAttribute(data.grain, 1));
    if (data.extra) g.setAttribute('extra', new THREE.BufferAttribute(data.extra, 3));
    g.setIndex(new THREE.BufferAttribute(data.idx, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, this.material);
    m.castShadow = m.receiveShadow = true;
    this.off.add(m);
    this.chunks.set(key, m);
  }

  /** Remesh up to `budgetMs` worth of dirty chunks this frame. */
  updateDirty(budgetMs = 6) {
    const v = this.sp.vol;
    const t0 = performance.now();
    // A big break (a split) must appear all at once (half-updated chunks look like walls), but
    // building it all in one frame stalls a headset: build off-screen over a few frames, then
    // swap everything in together.
    if (!this.batch && v.dirty.size > 20) {
      this.batch = { keys: [...v.dirty], i: 0, built: [] };
      v.dirty.clear();
    }
    const b = this.batch;
    if (b) {
      while (b.i < b.keys.length && performance.now() - t0 < budgetMs) b.built.push(this._buildChunk(b.keys[b.i++]));
      if (b.i < b.keys.length) return;
      for (const c of b.built) this._applyChunk(c);
      this.batch = null;
      return;
    }
    if (!v.dirty.size) return;
    for (const key of v.dirty) {
      v.dirty.delete(key);
      this._remesh(key);
      if (performance.now() - t0 > budgetMs) break;
    }
  }

  /** Mesh one chunk (and reshade its fine shell) without touching the scene yet. */
  _buildChunk(key) {
    const v = this.sp.vol;
    const x = key % v.cx, y = Math.floor(key / v.cx) % v.cy, z = Math.floor(key / (v.cx * v.cy));
    let fine = null;
    const f = !this.skipFine && this.fine?.get(key);
    if (f) {
      const tmp = {};
      for (const k in f.buf) tmp[k] = new f.buf[k].constructor(f.buf[k].length);
      fine = { f, buf: tmp, idx: shadeFine(this.sp, f.ch, tmp) };
    }
    return { key, data: meshChunk(this.sp, x, y, z), fine };
  }

  // ---- transforms between world and volume-local space

  toLocal(p) {
    this.off.updateWorldMatrix(true, false);
    return p.clone().applyMatrix4(this._inv());
  }

  dirToLocal(d) {
    return d.clone().transformDirection(this._inv());
  }

  _inv() {
    return (this._invM ??= new THREE.Matrix4()).copy(this.off.matrixWorld).invert();
  }

  toWorld(p) {
    this.off.updateWorldMatrix(true, false);
    return p.clone().applyMatrix4(this.off.matrixWorld);
  }

  /** Ray from the camera through a screen point, in volume-local space. Also returns the camera basis there. */
  screenRay(x, y) {
    const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    const rc = (this._rc ??= new THREE.Raycaster());
    rc.setFromCamera(ndc, this.camera);
    const q = this.camera.quaternion;
    return {
      o: this.toLocal(rc.ray.origin),
      d: this.dirToLocal(rc.ray.direction).normalize(),
      right: this.dirToLocal(new THREE.Vector3(1, 0, 0).applyQuaternion(q)).normalize(),
      up: this.dirToLocal(new THREE.Vector3(0, 1, 0).applyQuaternion(q)).normalize(),
    };
  }

  /** Project a local-space point to screen pixels (null if behind the camera). */
  toScreen(pLocal) {
    const p = this.toWorld(pLocal).project(this.camera);
    if (p.z > 1) return null;
    return [(p.x + 1) / 2 * window.innerWidth, (1 - p.y) / 2 * window.innerHeight];
  }

  // ---- the tool vector and its line of action

  _initTool() {
    const g = (this.toolG = new THREE.Group());
    g.visible = false;
    this.off.add(g);
    const over = (m) => {
      m.depthTest = false;
      m.transparent = true;
      return m;
    };
    this.body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), over(new THREE.MeshBasicMaterial({ color: 0xe8e2d6, opacity: 0.55 })));
    this.body.renderOrder = 11;
    this.tipM = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), over(new THREE.MeshBasicMaterial({ color: 0xffd27a, opacity: 0.95 })));
    this.tipM.renderOrder = 12;
    // Where it comes out the far side: secondary information, kept faint.
    this.exitM = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), over(new THREE.MeshBasicMaterial({ color: 0xe8e2d6, opacity: 0.3 })));
    this.exitM.renderOrder = 11;
    // The target: a reticle lying on the surface where the tool will act.
    this.reticle = new THREE.Group();
    const rmat = over(new THREE.MeshBasicMaterial({ color: 0xffd27a, opacity: 0.95, side: THREE.DoubleSide }));
    this.reticle.add(new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), rmat));
    for (let i = 0; i < 4; i++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.45), rmat);
      const a = (i * Math.PI) / 2;
      tick.position.set(Math.cos(a) * 1.25, Math.sin(a) * 1.25, 0);
      tick.rotation.z = a + Math.PI / 2;
      this.reticle.add(tick);
    }
    for (const m of this.reticle.children) m.renderOrder = 13;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 6), 3));
    lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(64 * 6), 3));
    lg.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(64 * 2), 1));
    this.lineM = new THREE.LineSegments(lg, over(new THREE.LineDashedMaterial({ vertexColors: true, dashSize: 0.008, gapSize: 0.012, opacity: 0.45 })));
    this.lineM.renderOrder = 12;
    this.lineM.frustumCulled = false;
    g.add(this.body, this.tipM, this.exitM, this.lineM, this.reticle);
  }

  /**
   * Show the tool as a vector: body behind the tip along dir, then the line of action dotted
   * through the block (pale through matrix, amber through shell), with a ring where it exits.
   * tip/dir: local Vector3. segs: [{kind, a, b}] in local coords. r: tip radius (local units).
   */
  showTool(tip, dir, segs, r, bodyLen = 0.3) {
    if (!tip) {
      this.toolG.visible = false;
      return;
    }
    this.toolG.visible = true;
    // Reticle flat on the surface at the contact point: this is where the tool acts.
    const v = this.sp.vol, gq = v.grid(tip.x, tip.y, tip.z);
    const sn = new THREE.Vector3(...v.normal(gq[0], gq[1], gq[2]));
    this.reticle.position.copy(tip).addScaledVector(sn, v.voxel * 0.5);
    this.reticle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sn);
    this.reticle.scale.setScalar(Math.max(r * 1.6, 0.03));
    this.tipM.position.copy(tip);
    this.tipM.scale.setScalar(Math.max(r * 0.5, 0.004));
    const back = tip.clone().addScaledVector(dir, -bodyLen / 2);
    this.body.position.copy(back);
    this.body.scale.set(Math.max(r * 0.35, 0.003), bodyLen, Math.max(r * 0.35, 0.003));
    this.body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    const pos = this.lineM.geometry.attributes.position, col = this.lineM.geometry.attributes.color;
    const dist = this.lineM.geometry.attributes.lineDistance;
    const n = Math.min(segs.length, 64);
    let last = null;
    for (let i = 0; i < n; i++) {
      const s = segs[i];
      pos.setXYZ(i * 2, ...s.a);
      pos.setXYZ(i * 2 + 1, ...s.b);
      const c = s.kind === 'fossil' ? [1.0, 0.62, 0.2] : s.kind === 'model' ? [0.5, 0.78, 1.0] : [0.85, 0.82, 0.76];
      col.setXYZ(i * 2, ...c);
      col.setXYZ(i * 2 + 1, ...c);
      const da = Math.hypot(s.a[0] - tip.x, s.a[1] - tip.y, s.a[2] - tip.z);
      dist.setX(i * 2, da);
      dist.setX(i * 2 + 1, da + Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]));
      last = s.b;
    }
    this.lineM.geometry.setDrawRange(0, n * 2);
    pos.needsUpdate = col.needsUpdate = dist.needsUpdate = true;
    this.exitM.visible = !!last;
    if (last) {
      this.exitM.position.set(...last);
      this.exitM.scale.setScalar(0.004);
    }
  }

  // ---- chips and dust where material breaks away

  _initChips() {
    const N = (this.chipN = 700);
    const g = new THREE.BufferGeometry();
    const p0 = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) p0[i * 3 + 2] = -1000; // parked out of sight until spawned
    g.setAttribute('position', new THREE.BufferAttribute(p0, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.chipVel = new Float32Array(N * 3);
    this.chipLife = new Float32Array(N);
    this.chipNext = 0;
    this.chips = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.012, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true }));
    this.chips.frustumCulled = false;
    this.off.add(this.chips);
  }

  /** Burst of chips at local points; colour from the specimen's matrix colour there. */
  spawnChips(points, perPoint = 6) {
    if (!this.sp || !points.length) return;
    const pos = this.chips.geometry.attributes.position, col = this.chips.geometry.attributes.color;
    const tmp = [0, 0, 0];
    for (const p of points.slice(-40)) {
      this.sp.rockColour(p[0], p[1], p[2], 1, tmp);
      for (let k = 0; k < perPoint; k++) {
        const i = this.chipNext;
        this.chipNext = (this.chipNext + 1) % this.chipN;
        pos.setXYZ(i, p[0], p[1], p[2]);
        const f = 0.8 + 0.4 * Math.random();
        col.setXYZ(i, tmp[0] * f, tmp[1] * f, tmp[2] * f);
        this.chipVel[i * 3] = (Math.random() - 0.5) * 0.5;
        this.chipVel[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
        this.chipVel[i * 3 + 2] = 0.2 + Math.random() * 0.4;
        this.chipLife[i] = 0.7 + Math.random() * 0.7;
      }
    }
    col.needsUpdate = true;
  }

  // ---- chisel and hammer

  _initChisel() {
    const g = (this.chiselG = new THREE.Group());
    g.visible = false;
    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.85, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3b3530, roughness: 0.7 });
    // Shaft along +Y from the tip; blade at the tip, its edge along X.
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.26, 12), steel);
    this.shaft.position.y = 0.155;
    this.blade = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.012), steel);
    this.blade.position.y = 0.025;
    this.hammer = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.05), steel);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.32, 8), dark);
    handle.rotation.z = Math.PI / 2;
    handle.position.x = 0.2;
    this.hammer.add(head, handle);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, depthTest: false }));
    this.ring.renderOrder = 12;
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.3;
    g.add(this.shaft, this.blade, this.hammer, this.ring);
    this.off.add(g);
  }

  /**
   * Show the chisel at tip (local), driven along dir with its blade edge along e.
   * charge 0-1 swells the ring; swing 0-1 animates the hammer coming down (null = raised).
   */
  showChisel(tip, dir, e, widthLocal, charge, swing) {
    if (!tip) {
      this.chiselG.visible = false;
      return;
    }
    const g = this.chiselG;
    g.visible = true;
    g.position.copy(tip);
    // Basis: Y = -dir (shaft back out of the rock), X = e.
    const y = dir.clone().negate().normalize();
    const x = e.clone().addScaledVector(y, -e.dot(y)).normalize();
    const z = new THREE.Vector3().crossVectors(x, y);
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    this.blade.scale.x = Math.max(widthLocal, 0.006);
    const c = Math.min(1, charge);
    this.ring.scale.setScalar(0.6 + 1.2 * c);
    this.ring.material.color.setRGB(1, 0.85 - 0.5 * c, 0.45 - 0.4 * c);
    this.ring.visible = swing === null && c > 0;
    // Hammer: raised back by the charge, then swings down onto the shaft top.
    const raise = swing === null ? 0.05 + 0.22 * c : (0.05 + 0.22 * c) * Math.max(0, 1 - swing * 1.6);
    this.hammer.position.set(0, 0.315 + raise, 0);
    this.hammer.rotation.z = swing === null ? 0.5 * c : 0.5 * c * Math.max(0, 1 - swing * 1.6);
  }

  // ---- the mind model: a ghost of what you believe is inside, seen through the rock

  setMind(m) {
    if (this.mindMesh) {
      this.off.remove(this.mindMesh);
      this.mindMesh.geometry.dispose();
      this.mindMesh = null;
    }
    if (!m || !m.placed || !m.visible) return;
    const v = this.sp.vol, step = v.voxel * 2;
    let rmax = 0;
    for (const r of m.shape) rmax = Math.max(rmax, r);
    const R = rmax * m.len + 3 * step;
    const lo = [m.cx - R, m.cy - R, m.z0 - 0.04];
    const dims = [Math.ceil((2 * R) / step) + 1, Math.ceil((2 * R) / step) + 1, Math.ceil((m.height + 0.08) / step) + 1];
    const field = new Float32Array(dims[0] * dims[1] * dims[2]);
    for (let k = 0; k < dims[2]; k++)
      for (let j = 0; j < dims[1]; j++)
        for (let i = 0; i < dims[0]; i++) {
          const d = m.sdf(lo[0] + i * step, lo[1] + j * step, lo[2] + k * step);
          field[i + j * dims[0] + k * dims[0] * dims[1]] = Math.max(-4, Math.min(4, -d / step));
        }
    const data = meshGrid(field, new Float32Array(field.length), dims, (x, y, z, f, out) => { out[0] = out[1] = out[2] = 1; }, { fossilMat: { gloss: 0, metal: 0 } });
    if (!data) return;
    const P = data.pos;
    for (let i = 0; i < P.length; i += 3) {
      P[i] = lo[0] + P[i] * step;
      P[i + 1] = lo[1] + P[i + 1] * step;
      P[i + 2] = lo[2] + P[i + 2] * step;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(data.nrm, 3));
    g.setIndex(new THREE.BufferAttribute(data.idx, 1));
    this.mindMat ??= new THREE.MeshLambertMaterial({ color: 0x7ec4ff, emissive: 0x1d4466, transparent: true, opacity: this.mindOpacity ?? 0.1, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(g, this.mindMat);
    mesh.renderOrder = 9;
    this.off.add(mesh);
    this.mindMesh = mesh;
  }

  /** Strong while editing the model, faint while working so the rock stays readable. */
  setMindOpacity(o) {
    this.mindOpacity = o;
    if (this.mindMat) this.mindMat.opacity = o;
  }

  // ---- debris: pieces cut free by a fracture tumble away

  /** piece: { field, fos, dims, origin (grid), stride }, vel/spin in local units. */
  addDebris(piece, vel, spin) {
    const sp = this.sp, v = sp.vol;
    const tmp = [0, 0, 0];
    const st = piece.stride, o = piece.origin;
    const toLocal = (gx, gy, gz) => [v.origin[0] + (o[0] + gx * st) * v.voxel, v.origin[1] + (o[1] + gy * st) * v.voxel, v.origin[2] + (o[2] + gz * st) * v.voxel];
    const data = meshGrid(piece.field, piece.fos, piece.dims, (x, y, z, isF, out) => {
      const p = toLocal(x, y, z);
      if (isF) sp.fossilColour(p[0], p[1], p[2], 0, out);
      else sp.rockColour(p[0], p[1], p[2], 1, out);
    }, sp);
    if (!data) return;
    // Positions to local units, centred on the piece's centroid so it can spin about it.
    const P = data.pos;
    let cx = 0, cy = 0, cz = 0;
    const n = P.length / 3;
    for (let i = 0; i < n; i++) {
      const p = toLocal(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      P[i * 3] = p[0]; P[i * 3 + 1] = p[1]; P[i * 3 + 2] = p[2];
      cx += p[0]; cy += p[1]; cz += p[2];
    }
    cx /= n; cy /= n; cz /= n;
    for (let i = 0; i < n; i++) {
      P[i * 3] -= cx; P[i * 3 + 1] -= cy; P[i * 3 + 2] -= cz;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(data.nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(data.col, 3));
    g.setAttribute('rough', new THREE.BufferAttribute(data.rough, 1));
    g.setAttribute('metal', new THREE.BufferAttribute(data.metal, 1));
    g.setAttribute('grain', new THREE.BufferAttribute(data.grain, 1));
    if (data.extra) g.setAttribute('extra', new THREE.BufferAttribute(data.extra, 3));
    g.setIndex(new THREE.BufferAttribute(data.idx, 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, this.material);
    m.castShadow = true;
    m.position.set(cx, cy, cz);
    this.off.add(m);
    const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.debris.push({ m, v: new THREE.Vector3(...vel), axis, w: spin, t: 0 });
    if (this.debris.length > 12) this._dropDebris(this.debris.shift());
  }

  _dropDebris(d) {
    this.off.remove(d.m);
    d.m.geometry.dispose();
  }

  /** A brief expanding ring where the shell lost integrity. */
  pulse(pLocal) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff7a4a, transparent: true, opacity: 0.6, depthTest: false }));
    m.renderOrder = 13;
    m.position.set(...pLocal);
    this.off.add(m);
    this.pulses.push({ m, t: 0 });
  }

  update(dt) {
    // Chips and debris fall under world gravity (local frame turns with the specimen).
    const gl = this.dirToLocal(new THREE.Vector3(0, -1, 0));
    for (const d of this.debris) {
      d.t += dt;
      d.v.addScaledVector(gl, 2.2 * dt);
      d.m.position.addScaledVector(d.v, dt);
      d.m.rotateOnAxis(d.axis, d.w * dt);
    }
    this.debris = this.debris.filter((d) => {
      if (d.t < 2.6) return true;
      this._dropDebris(d);
      return false;
    });
    const pos = this.chips.geometry.attributes.position;
    let any = false;
    for (let i = 0; i < this.chipN; i++) {
      if (this.chipLife[i] <= 0) continue;
      any = true;
      this.chipLife[i] -= dt;
      const v = this.chipVel;
      v[i * 3] += gl.x * 2.5 * dt;
      v[i * 3 + 1] += gl.y * 2.5 * dt;
      v[i * 3 + 2] += gl.z * 2.5 * dt;
      pos.setXYZ(i, pos.getX(i) + v[i * 3] * dt, pos.getY(i) + v[i * 3 + 1] * dt, pos.getZ(i) + v[i * 3 + 2] * dt);
      if (this.chipLife[i] <= 0) pos.setXYZ(i, 0, 0, -1000);
    }
    if (any) pos.needsUpdate = true;
    for (const p of this.pulses) {
      p.t += dt;
      p.m.scale.setScalar(0.01 + p.t * 0.06);
      p.m.material.opacity = Math.max(0, 0.6 - p.t * 1.2);
    }
    this.pulses = this.pulses.filter((p) => {
      if (p.t < 0.5) return true;
      this.off.remove(p.m);
      p.m.geometry.dispose();
      return false;
    });
  }

  // ---- landing-page showcase

  setShowcase(sc) {
    if (this.showG) {
      this.scene.remove(this.showG);
      this.showG.traverse((o) => o.geometry?.dispose());
    }
    this.showG = sc ? showcaseGroup(sc, this.material) : null;
    if (this.showG) {
      this.scene.add(this.showG);
      this.showG.visible = !!this.showcaseOn;
    }
    this._layoutShowcase();
  }

  /** Landing page: the work block hides and the showcase turns on its plinth. */
  showcaseMode(on) {
    this.showcaseOn = on;
    this.root.visible = !on;
    if (this.showG) this.showG.visible = on;
    if (on) this._layoutShowcase();
    else this._placeCamera();
  }

  _layoutShowcase() {
    if (!this.showcaseOn) return;
    const wide = this.camera.aspect > 1.1;
    this.camera.position.set(0, wide ? 1.35 : 1.6, wide ? 1.75 : 2.6);
    this.camera.lookAt(0, wide ? 0 : -0.25, 0);
    if (this.showG) this.showG.position.set(wide ? 0.62 : 0, 0, wide ? 0 : 0);
    this.setLight(-1.0, 0.42);
  }

  /** Victory lap: slowly turn the specimen and frame it. */
  celebrate(on) {
    this.celebrating = on;
    if (on) {
      this.zoom(0.85);
      this.setMindOpacity(0);
      this.showTool(null);
      this.showChisel(null);
    }
  }

  /** Camera and lights in specimen space, for effects that depend on the viewing geometry. */
  _objUniforms() {
    const u = this.uniforms;
    this.off.updateWorldMatrix(true, false);
    const inv = this._inv();
    const cam = this.renderer.xr.isPresenting ? this.renderer.xr.getCamera() : this.camera;
    u.uCamObj.value.setFromMatrixPosition(cam.matrixWorld).applyMatrix4(inv);
    u.uKeyObj.value.copy(this.key.position).transformDirection(inv);
    u.uSkyObj.value.set(0.3, 1, 0.5).transformDirection(inv);
  }

  /** Opal grade -> shader (see gradeOpal in specimen.js). */
  setOpal(o) {
    if (!o) return;
    this.uniforms.uOpalA.value.set(o.scale, o.width, o.roll, o.seed);
    this.uniforms.uOpalB.value.set(o.lmin, o.lmax, (o.tone - 1) / 6, [0, 2.2, 1.7, 1.3, 0.95, 0.65][o.bright]);
  }

  render() {
    this._objUniforms();
    // Shadows: only when the block, its pose, the lamp or flying debris changed.
    const q = this.root.quaternion, k = this.key.position, sg = this._shSig;
    const now = [q.x, q.y, q.z, q.w, k.x, k.y, k.z];
    let moved = false;
    for (let i = 0; i < 7; i++) if (Math.abs(now[i] - sg[i]) > 1e-5) { moved = true; sg[i] = now[i]; }
    if (moved || this.shadowDirty || this.debris.length || this.showcaseOn) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
    }
    if (this.showcaseOn && this.showG) {
      const now = performance.now();
      const dt = Math.min(0.05, (now - (this._lastShow ?? now)) / 1000);
      this._lastShow = now;
      this.showG.rotation.y += dt * 0.22;
    }
    if (this.celebrating && !this.renderer.xr.isPresenting) {
      const now = performance.now();
      const dt = Math.min(0.05, (now - (this._lastSpin ?? now)) / 1000);
      this._lastSpin = now;
      this.turn(new THREE.Vector3(0, 1, 0), dt * 0.45);
    } else this._lastSpin = undefined;
    this.renderer.render(this.scene, this.camera);
  }
}
