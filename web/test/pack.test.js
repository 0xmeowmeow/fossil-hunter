// Packing a baked specimen for the network: it comes back the same shape, close enough to look
// identical, and much smaller.
//   node test/pack.test.js
import { bake } from '../src/bake.js';
import { packMesh, unpackMesh } from '../src/net.js';

// A lumpy sphere as rock and a smaller one as shell, like a real bake's input.
function blob(r, n, wob) {
  const pos = [], nrm = [], col = [], idx = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n * 2; j++) {
    const th = (i / n) * Math.PI, ph = (j / (2 * n)) * Math.PI * 2;
    const k = r * (1 + wob * Math.sin(th * 7) * Math.cos(ph * 5));
    const d = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
    pos.push(...d.map((x) => x * k));
    nrm.push(...d);
    col.push(0.4, 0.35, 0.3);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n * 2; j++) {
    const a = i * (2 * n + 1) + j, b = a + 2 * n + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col), idx: new Uint32Array(idx) };
}
const shell = blob(0.3, 60, 0.05);
shell.rough = new Float32Array(shell.pos.length / 3).fill(0.4);
shell.metal = new Float32Array(shell.pos.length / 3);
shell.opal = new Float32Array(shell.pos.length / 3).fill(0.5);
const m = await bake({ rock: [blob(1, 80, 0.1)], shell: [shell] });
m.opal = { tone: 2, bright: 2 };
const raw = ['rock', 'shell'].reduce((s, g) => s + Object.values(m[g]).reduce((t, a) => t + (a.byteLength ?? 0), 0), 0);
const gz = await packMesh(m);
const back = await unpackMesh(gz);
let err = 0;
for (const g of ['rock', 'shell']) for (let i = 0; i < m[g].pos.length; i++) err = Math.max(err, Math.abs(m[g].pos[i] - back[g].pos[i]));
const same = ['rock', 'shell'].every((g) => back[g].idx.length === m[g].idx.length && back[g].col.every((c, i) => c === m[g].col[i]));
console.log(`${m.tris} triangles: ${(raw / 1024).toFixed(0)} KB raw -> ${(gz.length / 1024).toFixed(0)} KB packed; worst position error ${err.toExponential(1)} (block is ~2 wide)`);
const ok = same && err < 1e-4 && gz.length < raw / 2 && back.opal.tone === 2 && Math.abs(back.shell.opal[0] - 0.5) < 0.01;
console.log(ok ? 'ok' : 'FAIL');
process.exit(ok ? 0 : 1);
