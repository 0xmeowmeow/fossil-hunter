// The prep bench around the block: oiled timber under a single lamp, a canvas sandbag the block
// sits in, a few tools of the trade and a field card. Everything is procedural (canvas
// textures, simple geometry) so it costs a headset almost nothing, and it gives the bench a
// look of its own: warm lamplight falling off into a dark workshop.
//
// Units are the block's (1 = 5 cm on the desktop). The group follows the block's position;
// in a headset only the sandbag is shown (the room-scale table is the XR controller's).

import * as THREE from 'three';
import { Rng } from './rng.js';

const TAU = Math.PI * 2;

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
function tex(c, { repeat = 1, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

/** Oiled walnut planks: long grain, the odd knot, years of scuffs, stains and pencil. */
export function timberTexture(seed = 3) {
  const rng = new Rng(seed);
  return canvas(1024, 1024, (g, w, h) => {
    const planks = 4, pw = w / planks;
    for (let p = 0; p < planks; p++) {
      const base = [44 + rng.int(12), 27 + rng.int(8), 16 + rng.int(6)];
      g.fillStyle = `rgb(${base})`;
      g.fillRect(p * pw, 0, pw, h);
      // Grain: wavy lines running the length of the plank.
      for (let i = 0; i < 160; i++) {
        const x0 = p * pw + rng.uniform(0, pw), amp = rng.uniform(1, 5), f = rng.uniform(0.5, 2.5), ph = rng.uniform(0, TAU);
        const dark = rng.next() < 0.6;
        g.strokeStyle = dark ? `rgba(20,11,5,${rng.uniform(0.08, 0.3)})` : `rgba(140,96,60,${rng.uniform(0.04, 0.14)})`;
        g.lineWidth = rng.uniform(0.4, 1.8);
        g.beginPath();
        for (let y = 0; y <= h; y += 16) g.lineTo(x0 + amp * Math.sin((y / h) * TAU * f + ph), y);
        g.stroke();
      }
      // A knot now and then, with the grain swirling round it.
      if (rng.next() < 0.5) {
        const kx = p * pw + rng.uniform(0.25, 0.75) * pw, ky = rng.uniform(0, h);
        for (let r = 22; r > 2; r -= 3) {
          g.strokeStyle = `rgba(25,13,6,${0.08 + (22 - r) * 0.012})`;
          g.lineWidth = 1.5;
          g.beginPath();
          g.ellipse(kx, ky, r * 0.6, r * 1.7, 0, 0, TAU);
          g.stroke();
        }
      }
      // The gap between planks.
      g.fillStyle = 'rgba(8,4,2,0.85)';
      g.fillRect(p * pw - 1, 0, 3, h);
    }
    // Wear: scuffs, ring stains from mugs, pencil ticks, a splash of consolidant.
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(${rng.next() < 0.5 ? '200,170,130' : '10,6,3'},${rng.uniform(0.03, 0.09)})`;
      g.lineWidth = rng.uniform(0.5, 1.5);
      const x = rng.uniform(0, w), y = rng.uniform(0, h), a = rng.uniform(0, TAU), l = rng.uniform(6, 60);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = `rgba(15,8,4,${rng.uniform(0.12, 0.22)})`;
      g.lineWidth = rng.uniform(3, 6);
      g.beginPath();
      g.arc(rng.uniform(0, w), rng.uniform(0, h), rng.uniform(26, 34), rng.uniform(0, 1), rng.uniform(4, 6.2));
      g.stroke();
    }
    g.fillStyle = 'rgba(230,220,190,0.05)';
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      g.ellipse(rng.uniform(0, w), rng.uniform(0, h), rng.uniform(20, 50), rng.uniform(10, 30), rng.uniform(0, 3), 0, TAU);
      g.fill();
    }
  });
}

/** Cotton duck canvas, sun-faded khaki, for the sandbag. */
function canvasCloth() {
  const rng = new Rng(11);
  return canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#6b5a40';
    g.fillRect(0, 0, w, h);
    // The weave.
    for (let y = 0; y < h; y += 4) {
      g.fillStyle = `rgba(25,18,8,${0.22 + 0.14 * rng.next()})`;
      g.fillRect(0, y, w, 2);
    }
    for (let x = 0; x < w; x += 4) {
      g.fillStyle = `rgba(200,175,130,${0.08 + 0.1 * rng.next()})`;
      g.fillRect(x, 0, 2, h);
    }
    // Stains: rock dust ground in, a darker patch where hands go.
    for (let i = 0; i < 40; i++) {
      const x = rng.uniform(0, w), y = rng.uniform(0, h), r = rng.uniform(10, 70);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const c = rng.next() < 0.6 ? '60,48,30' : '200,190,165';
      gr.addColorStop(0, `rgba(${c},${rng.uniform(0.05, 0.16)})`);
      gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  });
}

/** A field card in a collector's hand: where the block came from. */
function fieldCard(level, seed) {
  return canvas(512, 320, (g, w, h) => {
    g.fillStyle = '#efe6cf';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,60,50,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 62);
    g.lineTo(w, 62);
    g.stroke();
    g.strokeStyle = 'rgba(90,120,170,0.35)';
    g.lineWidth = 1;
    for (let y = 100; y < h; y += 38) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.fillStyle = '#5a4a38';
    g.font = '500 20px "IBM Plex Mono", monospace';
    g.fillText(`FIELD NO. ${String(seed % 100000).padStart(5, '0')}`, 22, 44);
    g.fillStyle = '#1d2a4a';
    g.font = '40px Caveat, cursive';
    const place = level.place.split(', ');
    g.fillText(place.slice(1).join(', ') || place[0], 26, 94, w - 50);
    g.fillText(place[0], 26, 132, w - 50);
    g.font = '34px Caveat, cursive';
    g.fillText(level.title.replace(/^A parcel of /, ''), 26, 170, w - 50);
    g.fillText('careful - prep from top', 26, 246, w - 50);
  });
}

/** A soft round dot for dust motes. */
function dot() {
  return canvas(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,240,215,1)');
    gr.addColorStop(0.4, 'rgba(255,230,200,0.35)');
    gr.addColorStop(1, 'rgba(255,230,200,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  });
}

export class BenchSet {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'set';
    this.props = new THREE.Group(); // everything but the sandbag (hidden in a headset)
    this.group.add(this.props);

    // The bench top, falling off into the dark.
    // The same drawing serves as a bump map: grain and scuffs catch the raking lamp.
    const tc = timberTexture();
    const wood = new THREE.MeshStandardMaterial({ map: tex(tc, { repeat: 3 }), bumpMap: tex(tc, { repeat: 3, srgb: false }), bumpScale: 1.5, roughness: 0.58, metalness: 0 });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), wood);
    top.rotation.x = -Math.PI / 2;
    top.receiveShadow = true;
    this.props.add(top);
    this.top = top;
    // The lamp's pool: everything beyond it sinks into shadow.
    const pool = canvas(512, 512, (g) => {
      const gr = g.createRadialGradient(256, 256, 30, 256, 256, 256);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(0.3, 'rgba(0,0,0,0.05)');
      gr.addColorStop(0.62, 'rgba(0,0,0,0.6)');
      gr.addColorStop(1, 'rgba(0,0,0,0.96)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 512, 512);
    });
    const pm = new THREE.MeshBasicMaterial({ map: tex(pool), transparent: true, depthWrite: false });
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), pm);
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.y = 0.003;
    this.pool.renderOrder = 1;
    this.props.add(this.pool);

    const cc = canvasCloth();
    this.cloth = new THREE.MeshStandardMaterial({ map: tex(cc, { repeat: 3 }), bumpMap: tex(cc, { repeat: 3, srgb: false }), bumpScale: 4, roughness: 0.97 });
    this.sandbag = null;
    this._tools();
    this._dust();
  }

  /** The hand lens, a brush and dental picks, laid down where a preparator would. */
  _tools() {
    const brass = new THREE.MeshStandardMaterial({ color: 0xb08d4a, metalness: 1, roughness: 0.32 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: 1, roughness: 0.25 });
    const beech = new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.55 });
    const black = new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fb8c0, metalness: 0.1, roughness: 0.03, transparent: true, opacity: 0.18 });
    const cast = (o) => { o.castShadow = true; o.receiveShadow = true; return o; };

    // Hand lens: brass rim, glass, a turned handle.
    const lens = new THREE.Group();
    const rim = cast(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 12, 48), brass));
    rim.rotation.x = Math.PI / 2;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.04, 40), glass);
    const handle = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.5, 16), black));
    handle.rotation.z = Math.PI / 2;
    handle.position.x = 1.38;
    const collar = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 16), brass));
    collar.rotation.z = Math.PI / 2;
    collar.position.x = 0.7;
    lens.add(rim, disc, handle, collar);
    lens.position.y = 0.08;
    this.lens = lens;

    // A soft brush for dust.
    const brush = new THREE.Group();
    const bh = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 12), beech));
    const fer = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.45, 12), steel));
    fer.position.y = 1.8;
    const hair = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0x2a1e14, roughness: 0.9 })));
    hair.position.y = 2.3;
    brush.add(bh, fer, hair);
    brush.rotation.z = Math.PI / 2;
    brush.position.y = 0.11;
    this.brush = brush;

    // Dental picks.
    const picks = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const p = new THREE.Group();
      const shaft = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), steel));
      const tip = cast(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 8), steel));
      tip.position.y = 1.35;
      p.add(shaft, tip);
      p.rotation.z = Math.PI / 2;
      p.position.set(0, 0.05, i * 0.32);
      p.rotation.y = i * 0.08;
      picks.add(p);
    }
    this.picks = picks;
    this.props.add(lens, brush, picks);
  }

  /** Motes drifting in the lamp's light. */
  _dust() {
    const n = 120, pos = new Float32Array(n * 3);
    const rng = new Rng(5);
    this.dustSeed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.dustSeed[i * 3] = rng.uniform(-1, 1);
      this.dustSeed[i * 3 + 1] = rng.next();
      this.dustSeed[i * 3 + 2] = rng.uniform(-1, 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ map: tex(dot()), size: 0.035, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe2b8 });
    this.dust = new THREE.Points(geo, m);
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 2;
    this.group.add(this.dust);
  }

  /**
   * Size the set to a block: the sandbag under its footprint, tools around it, the card with
   * its locality. `half` is the block's half-size in x and z (y up), in block units.
   */
  fit(level, seed, half) {
    const [hx, hz] = half, r = Math.hypot(hx, hz);
    this.r = r;
    this.half = half;
    if (this.sandbag) {
      this.group.remove(this.sandbag);
      this.sandbag.geometry.dispose();
    }
    // A plump cushion, a little dished where the block has bedded in.
    const geo = new THREE.SphereGeometry(1, 48, 24);
    const p = geo.attributes.position, rng = new Rng(seed + 9);
    const lump = Array.from({ length: 6 }, () => [rng.uniform(0, TAU), rng.uniform(0.03, 0.07)]);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      // Sand settles unevenly: big lobes round the rim, small wrinkles in the cloth.
      const w = 1 + lump.reduce((s, [ph, amp], k) => s + amp * Math.sin(a * (k + 2) + ph), 0) + 0.012 * Math.sin(a * 23 + y * 9) * (1 - Math.abs(y));
      x *= hx * 1.22 * w;
      z *= hz * 1.22 * w;
      y = y > 0 ? y * 0.24 * (1 - 0.5 * Math.exp(-(x * x) / (hx * hx) - (z * z) / (hz * hz))) : y * 0.05;
      p.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    const bag = new THREE.Mesh(geo, this.cloth);
    bag.castShadow = bag.receiveShadow = true;
    this.sandbag = bag;
    this.group.add(bag);
    this.bagTop = 0.24 * 0.5; // where the block's underside rests, above the bench
    this.pool.scale.setScalar((2 * (r * 1.9 + 1)) / 26); // the lamp's pool, a little wider than the block
    // Tools round about, as if just put down.
    const rr = (a, d) => [Math.cos(a) * d, Math.sin(a) * d];
    const [lx, lz] = rr(-0.5, r * 1.35 + 1.6);
    this.lens.position.set(lx, 0.08, lz);
    this.lens.rotation.y = 0.9;
    const [bx, bz] = rr(2.3, r * 1.4 + 1.2);
    this.brush.position.set(bx, 0.11, bz);
    this.brush.rotation.set(0, -0.7, Math.PI / 2);
    const [px, pz] = rr(1.0, r * 1.45 + 0.9);
    this.picks.position.set(px, 0, pz);
    this.picks.rotation.y = 2.4;
    // The field card.
    if (this.card) {
      this.props.remove(this.card);
      this.card.material.map.dispose();
    }
    const ct = tex(fieldCard(level, seed));
    ct.wrapS = ct.wrapT = THREE.ClampToEdgeWrapping;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.85 }));
    card.rotation.x = -Math.PI / 2;
    card.rotation.z = 0.18;
    const [cx, cz] = rr(-2.2, r * 1.3 + 1.8);
    card.position.set(cx, 0.006, cz);
    card.receiveShadow = true;
    this.card = card;
    this.props.add(card);
    // Fonts may still be loading: redraw the card once they're in.
    document.fonts?.ready.then(() => {
      if (this.card !== card) return;
      ct.image = fieldCard(level, seed);
      ct.needsUpdate = true;
    });
  }

  /** Height of whatever's underfoot at (x, z): the sandbag's dome, else the bench top. */
  floorAt(x, z) {
    const [hx, hz] = this.half ?? [1, 1];
    const ax = hx * 1.22, az = hz * 1.22;
    const u = (x * x) / (ax * ax) + (z * z) / (az * az);
    if (u >= 1) return 0;
    return 0.24 * Math.sqrt(1 - u) * (1 - 0.5 * Math.exp(-(x * x) / (hx * hx) - (z * z) / (hz * hz)));
  }

  /** Drift the dust; `t` in seconds. Motes hang in a column over the block. */
  update(t) {
    const a = this.dust.geometry.attributes.position, s = this.dustSeed, r = (this.r ?? 2) * 1.6;
    for (let i = 0; i < a.count; i++) {
      const sx = s[i * 3], sy = s[i * 3 + 1], sz = s[i * 3 + 2];
      const h = (sy + t * 0.012 * (0.5 + Math.abs(sx))) % 1;
      a.setXYZ(i,
        sx * r + 0.25 * Math.sin(t * 0.13 + i),
        0.4 + h * 4.5,
        sz * r + 0.25 * Math.cos(t * 0.11 + i * 1.7));
    }
    a.needsUpdate = true;
  }
}
