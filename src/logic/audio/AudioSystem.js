/**
 * Agent-Logic — REQ-SND-ITM Web Audio (BGM + engine / fire / explosion).
 * Volumes from SETTINGS_UPDATED. No DOM. Procedural graph — no sample files.
 */
export class AudioSystem {
  constructor() {
    this.masterVolume = 1;
    this.sfxVolume = 1;
    /** @type {AudioContext | null} */
    this._ctx = null;
    /** @type {GainNode | null} */
    this._master = null;
    /** @type {GainNode | null} */
    this._bgmBus = null;
    /** @type {GainNode | null} */
    this._sfxBus = null;
    /** @type {OscillatorNode[]} */
    this._bgmOsc = [];
    /** @type {AudioNode[]} */
    this._bgmExtras = [];
    /** @type {OscillatorNode | null} */
    this._engineOsc = null;
    /** @type {GainNode | null} */
    this._engineGain = null;
    /** @type {BiquadFilterNode | null} */
    this._engineFilter = null;
    /** @type {AudioBuffer | null} */
    this._noise = null;
    this._paused = false;
  }

  /**
   * @param {{ masterVolume?: number, sfxVolume?: number }} payload
   */
  applySettings(payload) {
    const m = Number(payload?.masterVolume);
    const s = Number(payload?.sfxVolume);
    if (Number.isFinite(m)) this.masterVolume = Math.min(1, Math.max(0, m));
    if (Number.isFinite(s)) this.sfxVolume = Math.min(1, Math.max(0, s));
    this._applyGains();
  }

  async unlock() {
    if (!this._ensure()) return;
    if (this._ctx.state === 'suspended') {
      try {
        await this._ctx.resume();
      } catch {
        /* autoplay lock — next user gesture retries from GAME_START */
      }
    }
  }

  playBgm() {
    if (!this._ensure()) return;
    void this.unlock();
    this.stopBgm();
    const ctx = this._ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 720;
    const g = ctx.createGain();
    g.gain.value = 0.07;
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = 110;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 164.81;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.18;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 180;
    lfo.connect(lfoG);
    lfoG.connect(filter.frequency);
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(g);
    g.connect(this._bgmBus);
    o1.start();
    o2.start();
    lfo.start();
    this._bgmOsc = [o1, o2, lfo];
    this._bgmExtras = [filter, g, lfoG];
  }

  stopBgm() {
    for (const o of this._bgmOsc) {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
      o.disconnect();
    }
    for (const n of this._bgmExtras) n.disconnect();
    this._bgmOsc = [];
    this._bgmExtras = [];
  }

  /**
   * @param {number} amount 0..1 throttle magnitude
   */
  setEngine(amount) {
    if (!this._ensure()) return;
    const a = Math.min(1, Math.max(0, amount));
    if (!this._engineOsc) this._startEngine();
    const t = this._ctx.currentTime;
    this._engineGain.gain.setTargetAtTime(a * 0.1, t, 0.06);
    this._engineOsc.frequency.setTargetAtTime(46 + a * 62, t, 0.08);
  }

  /**
   * @param {'fire' | 'explosion' | 'pickup'} name
   */
  playSfx(name) {
    if (!this._ensure()) return;
    void this.unlock();
    if (name === 'fire') this._burst(0.11, 1800, 0.22);
    else if (name === 'explosion') this._boom();
    else if (name === 'pickup') this._blip();
  }

  /**
   * @param {boolean} paused
   */
  setPaused(paused) {
    this._paused = Boolean(paused);
    if (!this._ctx) return;
    if (this._paused) void this._ctx.suspend();
    else void this._ctx.resume();
  }

  dispose() {
    this.stopBgm();
    this._stopEngine();
    if (this._ctx) {
      void this._ctx.close();
    }
    this._ctx = null;
    this._master = null;
    this._bgmBus = null;
    this._sfxBus = null;
    this._noise = null;
  }

  _ensure() {
    if (this._ctx) return true;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (typeof AC !== 'function') return false;
    this._ctx = new AC();
    this._master = this._ctx.createGain();
    this._bgmBus = this._ctx.createGain();
    this._sfxBus = this._ctx.createGain();
    this._bgmBus.connect(this._master);
    this._sfxBus.connect(this._master);
    this._master.connect(this._ctx.destination);
    this._noise = this._makeNoise(this._ctx);
    this._applyGains();
    return true;
  }

  _applyGains() {
    if (!this._master) return;
    this._master.gain.value = this.masterVolume;
    this._sfxBus.gain.value = this.sfxVolume;
    this._bgmBus.gain.value = 1;
  }

  _startEngine() {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 46;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(filter);
    filter.connect(g);
    g.connect(this._sfxBus);
    osc.start();
    this._engineOsc = osc;
    this._engineGain = g;
    this._engineFilter = filter;
  }

  _stopEngine() {
    if (this._engineOsc) {
      try {
        this._engineOsc.stop();
      } catch {
        /* already stopped */
      }
      this._engineOsc.disconnect();
      this._engineOsc = null;
    }
    if (this._engineGain) {
      this._engineGain.disconnect();
      this._engineGain = null;
    }
    if (this._engineFilter) {
      this._engineFilter.disconnect();
      this._engineFilter = null;
    }
  }

  _burst(duration, hpFreq, peak) {
    const ctx = this._ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hpFreq;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this._sfxBus);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  _boom() {
    const ctx = this._ctx;
    this._burst(0.45, 90, 0.55);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 58;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g);
    g.connect(this._sfxBus);
    osc.start(t);
    osc.stop(t + 0.52);
  }

  _blip() {
    const ctx = this._ctx;
    const t = ctx.currentTime;
    for (const [i, freq] of [523.25, 783.99].entries()) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = t + i * 0.07;
      g.gain.setValueAtTime(0.12, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
      osc.connect(g);
      g.connect(this._sfxBus);
      osc.start(start);
      osc.stop(start + 0.14);
    }
  }

  /**
   * @param {AudioContext} ctx
   */
  _makeNoise(ctx) {
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
}
