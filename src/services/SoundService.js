export class SoundService {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.bgmGain = null;
    this.tireNoise = null;
    this.tireGain = null;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) { this.enabled = false; }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  startEngine() {
    if (!this.enabled || !this.ctx) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 80;
    this.engineGain.gain.value = 0.04;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineGain2 = this.ctx.createGain();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 60;
    this.engineGain2.gain.value = 0.015;
    this.engineOsc2.connect(this.engineGain2);
    this.engineGain2.connect(this.masterGain);
    this.engineOsc2.start();
  }

  updateEngine(speed, maxSpeed) {
    if (!this.enabled || !this.engineOsc) return;
    const pct = Math.min(1, Math.abs(speed) / maxSpeed);
    this.engineOsc.frequency.linearRampToValueAtTime(60 + pct * 150, this.ctx.currentTime + 0.1);
    this.engineGain.gain.linearRampToValueAtTime(0.02 + pct * 0.08, this.ctx.currentTime + 0.1);
    this.engineOsc2.frequency.linearRampToValueAtTime(40 + pct * 100, this.ctx.currentTime + 0.1);
    this.engineGain2.gain.linearRampToValueAtTime(0.005 + pct * 0.025, this.ctx.currentTime + 0.1);
  }

  startTire() {
    if (!this.enabled || this.tireNoise) return;
    this.tireNoise = this.ctx.createOscillator();
    this.tireGain = this.ctx.createGain();
    this.tireNoise.type = 'sawtooth';
    this.tireNoise.frequency.value = 200;
    this.tireGain.gain.value = 0;
    this.tireNoise.connect(this.tireGain);
    this.tireGain.connect(this.masterGain);
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

  playCollision(intensity) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 100 + intensity * 80;
    gain.gain.value = Math.min(0.3, intensity * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playCoin() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1);
    gain.gain.value = 0.1;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playDrift() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.08);
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  startBGM() {
    if (!this.enabled || this.bgmGain) return;
    try {
      const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 349.23, 329.63, 293.66];
      let idx = 0;
      const playNote = () => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = notes[idx % notes.length] * 0.5;
        gain.gain.value = 0.02;
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
        idx++;
        if (idx < 64) setTimeout(playNote, 400);
      };
      playNote();
    } catch (e) {}
  }

  stopBGM() {
    this.bgmGain = null;
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
}
