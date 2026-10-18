// Synthesised tool sounds. Preparators listen to their tools: the scribe rings higher on
// shell than on matrix, so the sound is part of the feedback, not decoration.

export class Sfx {
  constructor() {
    this.ctx = null;
  }

  /** Must be called from a user gesture. */
  resume() {
    if (!this.ctx) this._init();
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  _init() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.out = ctx.createGain();
    this.out.gain.value = 0.6;
    this.out.connect(ctx.destination);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Scribe: a buzzing sawtooth plus grit, through a band-pass that shifts with material.
    this.sOsc = ctx.createOscillator();
    this.sOsc.type = 'sawtooth';
    this.sNoise = this._loopNoise();
    this.sFilt = ctx.createBiquadFilter();
    this.sFilt.type = 'bandpass';
    this.sFilt.Q.value = 1.6;
    this.sGain = ctx.createGain();
    this.sGain.gain.value = 0;
    const nGain = ctx.createGain();
    nGain.gain.value = 0.5;
    this.sOsc.connect(this.sFilt);
    this.sNoise.connect(nGain).connect(this.sFilt);
    this.sFilt.connect(this.sGain).connect(this.out);
    this.sOsc.start();

    // Abrader: hiss.
    this.aNoise = this._loopNoise();
    this.aFilt = ctx.createBiquadFilter();
    this.aFilt.type = 'highpass';
    this.aFilt.frequency.value = 1800;
    this.aGain = ctx.createGain();
    this.aGain.gain.value = 0;
    this.aNoise.connect(this.aFilt).connect(this.aGain).connect(this.out);
  }

  _loopNoise() {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    n.loop = true;
    n.start();
    return n;
  }

  _ramp(param, v, t = 0.03) {
    param.setTargetAtTime(v, this.ctx.currentTime, t);
  }

  scribe(on, stroke, pressure, contact) {
    if (!this.ctx) return;
    const f = 70 + 160 * stroke;
    this._ramp(this.sOsc.frequency, f, 0.02);
    const band = contact === 'fossil' ? 3200 : contact === 'rock' ? 1100 : 700;
    this._ramp(this.sFilt.frequency, band, 0.02);
    const g = on ? (contact === 'none' ? 0.05 : 0.12) * (0.5 + pressure) : 0;
    this._ramp(this.sGain.gain, g, 0.03);
  }

  abrader(on, pressure, flow, contact) {
    if (!this.ctx) return;
    this._ramp(this.aFilt.frequency, contact === 'fossil' ? 3800 : 1800, 0.05);
    this._ramp(this.aGain.gain, on ? 0.08 * (0.3 + pressure) * (0.4 + flow) : 0, 0.05);
  }

  _burst(freq, q, dur, gain, type = 'bandpass') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(this.out);
    n.start(t, Math.random() * 0.5, dur + 0.05);
  }

  _thump(freq, dur, gain) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Matrix popping cleanly off the shell: a dry little click. */
  pop() {
    this._burst(2600, 1.2, 0.05, 0.5);
  }

  /** Shell cracking: sharp, high, a little longer. */
  chip() {
    this._burst(5200, 3, 0.09, 0.7);
    this._burst(1400, 2, 0.06, 0.3);
  }

  /** A spine snapping off. */
  snap() {
    this._burst(6000, 6, 0.05, 0.9);
    setTimeout(() => this._burst(3000, 4, 0.12, 0.5), 40);
  }

  /** Rock cracking and a piece coming away; bigger pieces sound deeper and longer. */
  crack(size) {
    const s = Math.min(1, Math.log10(1 + size) / 6);
    this._burst(3200 - 2200 * s, 1.5, 0.06 + 0.25 * s, 0.6 + 0.3 * s);
    this._thump(160 - 90 * s, 0.1 + 0.3 * s, 0.5 + 0.4 * s);
    setTimeout(() => this._burst(900 - 400 * s, 0.8, 0.15 + 0.4 * s, 0.25 + 0.2 * s, 'lowpass'), 60 + 120 * s);
  }

  /** A blow that only crushes: dull, gritty. */
  crush() {
    this._thump(110, 0.09, 0.5);
    this._burst(600, 0.7, 0.08, 0.35, 'lowpass');
  }

  /** Jackpot: a quick rising arpeggio of bright tones, like a fruit machine paying out. */
  jackpot() {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const t = t0 + i * 0.075;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + 0.4);
    });
  }

  /** Hammer on chisel. */
  tap() {
    this._thump(140, 0.12, 0.7);
    this._burst(1800, 1, 0.06, 0.35);
  }
}
