export class SoundService {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.muted = false;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineOsc2 = null;
    this.engineGain2 = null;
    this.tireNoise = null;
    this.tireGain = null;
    this.master = 0.8;
    this.sfx = 0.9;
    this.music = 0.7;
    this._bgmTimer = null;
    this._bgmPlaying = false;
    try { this.muted = localStorage.getItem('nitroMuted') === '1'; } catch (e) {}
  }

  setMuted(muted) {
    this.muted = !!muted;
    try { localStorage.setItem('nitroMuted', this.muted ? '1' : '0'); } catch (e) {}
    if (this.masterGain && this.ctx) this.masterGain.gain.value = this.muted ? 0 : 0.3 * this.master;
  }

  setMaster(v) { this.master = v; if (this.masterGain && this.ctx) this.masterGain.gain.value = this.muted ? 0 : 0.3 * v; }
  setSfx(v) { this.sfx = v; if (this.sfxGain && this.ctx) this.sfxGain.gain.value = v; }
  setMusic(v) { this.music = v; if (this.musicGain && this.ctx) this.musicGain.gain.value = v; }

  init() {
    if (this.ctx) { this.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.3 * this.master;
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfx;
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.music;
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) { this.enabled = false; }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

startEngine() {
     if (!this.enabled || !this.ctx || this.engineOsc) return;
     this.engineOsc = this.ctx.createOscillator();
     this.engineGain = this.ctx.createGain();
     this.engineOsc.type = 'sawtooth';
     this.engineOsc.frequency.value = 80;
     this.engineGain.gain.value = 0.04;
     this.engineOsc.connect(this.engineGain);
     this.engineGain.connect(this.sfxGain);
     this.engineOsc.start();

     this.engineOsc2 = this.ctx.createOscillator();
     this.engineGain2 = this.ctx.createGain();
     this.engineOsc2.type = 'square';
     this.engineOsc2.frequency.value = 60;
     this.engineGain2.gain.value = 0.015;
     this.engineOsc2.connect(this.engineGain2);
     this.engineGain2.connect(this.sfxGain);
     this.engineOsc2.start();
   }

   setEngineType(carId) {
     if (!this.engineOsc || !this.ctx) return;
     const types = {
       race: { base: 100, harmonic: 2 },
       'race-future': { base: 60, harmonic: 1.5 },
       'sedan-sports': { base: 90, harmonic: 1.8 },
       'hatchback-sports': { base: 85, harmonic: 1.7 },
       'suv-luxury': { base: 70, harmonic: 1.3 },
       sedan: { base: 80, harmonic: 1.5 },
       suv: { base: 65, harmonic: 1.2 },
       truck: { base: 50, harmonic: 1.0 },
       police: { base: 75, harmonic: 1.6 },
       taxi: { base: 70, harmonic: 1.4 }
     };
     const cfg = types[carId] || types.sedan;
     this.engineOsc.frequency.value = cfg.base;
     this.engineOsc2.frequency.value = cfg.base * cfg.harmonic;
   }

  updateEngine(speed, maxSpeed) {
    if (!this.enabled || !this.engineOsc || !this.ctx) return;
    const pct = Math.min(1, Math.abs(speed) / maxSpeed);
    this.engineOsc.frequency.linearRampToValueAtTime(60 + pct * 150, this.ctx.currentTime + 0.1);
    this.engineGain.gain.linearRampToValueAtTime(0.02 + pct * 0.08, this.ctx.currentTime + 0.1);
    this.engineOsc2.frequency.linearRampToValueAtTime(40 + pct * 100, this.ctx.currentTime + 0.1);
    this.engineGain2.gain.linearRampToValueAtTime(0.005 + pct * 0.025, this.ctx.currentTime + 0.1);
  }

  startTire() {
    if (!this.enabled || !this.ctx || this.tireNoise) return;
    this.tireNoise = this.ctx.createOscillator();
    this.tireGain = this.ctx.createGain();
    this.tireNoise.type = 'sawtooth';
    this.tireNoise.frequency.value = 200;
    this.tireGain.gain.value = 0;
    this.tireNoise.connect(this.tireGain);
    this.tireGain.connect(this.sfxGain);
    this.tireNoise.start();
  }

  updateTire(intensity) {
    if (!this.enabled || !this.tireGain) return;
    this.tireGain.gain.linearRampToValueAtTime(intensity * 0.06, this.ctx.currentTime + 0.05);
    if (this.tireNoise) this.tireNoise.frequency.value = 150 + intensity * 200;
  }

  stopTire() {
    if (this.tireGain) this.tireGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
  }

  _effect(freqStart, freqEnd, dur, vol, type) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), this.ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  playCollision(intensity) {
    if (!this.enabled || !this.ctx) return;
    const vol = Math.min(0.3, intensity * 0.15);
    this._effect(100 + intensity * 80, 30, 0.15, vol, 'sawtooth');
  }

  playCoin() {
    this._effect(880, 1760, 0.2, 0.1, 'sine');
  }

  playDrift() {
    this._effect(600, 1200, 0.15, 0.08, 'sine');
  }

  startBGM() {
    if (!this.enabled || !this.ctx || this._bgmPlaying) return;
    this._bgmPlaying = true;
    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 349.23, 329.63, 293.66];
    let idx = 0;
    const playNote = () => {
      if (!this._bgmPlaying || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = notes[idx % notes.length] * 0.5;
        gain.gain.value = 0.02;
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
      } catch (e) {}
      idx++;
      this._bgmTimer = setTimeout(playNote, 400);
    };
    playNote();
  }

  stopBGM() {
    this._bgmPlaying = false;
    if (this._bgmTimer) { clearTimeout(this._bgmTimer); this._bgmTimer = null; }
  }

stopEngine() {
     try {
       if (this.engineOsc) { this.engineOsc.stop(); this.engineOsc = null; }
       if (this.engineOsc2) { this.engineOsc2.stop(); this.engineOsc2 = null; }
       if (this.engineGain) this.engineGain.disconnect();
       if (this.engineGain2) this.engineGain2.disconnect();
       if (this.tireNoise) { this.tireNoise.stop(); this.tireNoise = null; }
       if (this.tireGain) this.tireGain.disconnect();
     } catch (e) {}
   }

   startRadio(station) {
     if (!this.enabled || !this.ctx || this._radioPlaying) return;
     this._radioPlaying = true;
     const stations = {
       pop: [523.25, 659.25, 783.99, 1046.5],
       rock: [220, 277.18, 329.63, 440],
       jazz: [261.63, 311.13, 349.23, 466.16],
       electronic: [130.81, 164.81, 196, 261.63],
       classical: [293.66, 349.23, 392, 523.25]
     };
     const notes = stations[station] || stations.pop;
     let idx = 0;
     const playNote = () => {
       if (!this._radioPlaying || !this.ctx) return;
       try {
         const osc = this.ctx.createOscillator();
         const gain = this.ctx.createGain();
         osc.type = 'triangle';
         osc.frequency.value = notes[idx % notes.length];
         gain.gain.value = 0.015;
         gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
         osc.connect(gain);
         gain.connect(this.musicGain);
         osc.start();
         osc.stop(this.ctx.currentTime + 0.8);
       } catch (e) {}
       idx++;
       this._bgmTimer = setTimeout(playNote, 500);
     };
     playNote();
   }

   stopRadio() {
     this._radioPlaying = false;
     if (this._bgmTimer) { clearTimeout(this._bgmTimer); this._bgmTimer = null; }
   }
}
