const DEFAULTS = {
  master: 0.8,
  music: 0.7,
  sfx: 0.9,
  brightness: 1.0,
  gfx: 'medium',
  fps: 60
};

const VER = '2';

function load() {
  try {
    const ver = localStorage.getItem('nitroSettingsVer');
    if (ver !== VER) {
      localStorage.setItem('menuSettings', JSON.stringify(DEFAULTS));
      localStorage.setItem('nitroSettingsVer', VER);
      return { ...DEFAULTS };
    }
    const raw = localStorage.getItem('menuSettings');
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...DEFAULTS };
}

export const SettingsService = {
  data: load(),

  save() {
    try { localStorage.setItem('menuSettings', JSON.stringify(this.data)); } catch (e) {}
  },

  get() { return this.data; },

  applyBrightness() {
    const c = document.getElementById('game-container');
    if (c) c.style.filter = `brightness(${this.data.brightness})`;
  },

  applyGfx(renderer, composer) {
    if (!renderer) return;
    const gfx = this.data.gfx || 'medium';
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(gfx === 'low' ? 1 : gfx === 'medium' ? Math.min(dpr, 1.25) : Math.min(dpr, 1.5));
    renderer.shadowMap.enabled = gfx !== 'low';
    if (composer) {
      const bloom = composer.passes && composer.passes[1];
      if (bloom) {
        bloom.enabled = gfx !== 'low';
        bloom.strength = gfx === 'medium' ? 0.25 : 0.4;
      }
      const smaa = composer.passes && composer.passes[2];
      if (smaa) smaa.enabled = gfx !== 'low';
    }
  },

  applyVolumes(sound) {
    if (!sound) return;
    sound.setMaster(this.data.master);
    sound.setMusic(this.data.music);
    sound.setSfx(this.data.sfx);
  }
};
