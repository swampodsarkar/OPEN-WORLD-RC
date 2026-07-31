import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { THEME, css } from '../styles/theme.js';

export class MainMenuScene {
  constructor(manager) {
    this.manager = manager;
    this.overlay = null;
    this.lastCarIdx = parseInt(localStorage.getItem('lastCarIdx') || '0', 10);
    this._keyHandler = null;
    this._resumeHandler = null;
    this.settings = {
      master: 0.8,
      music: 0.7,
      sfx: 0.9,
      brightness: 1.0,
      gfx: 'high',
      fps: 60
    };
    try {
      const saved = localStorage.getItem('menuSettings');
      if (saved) this.settings = { ...this.settings, ...JSON.parse(saved) };
    } catch (e) {}
  }

  saveSettings() {
    localStorage.setItem('menuSettings', JSON.stringify(this.settings));
    this.applySettings();
  }

  applySettings() {
    const root = document.documentElement;
    root.style.setProperty('--menu-brightness', this.settings.brightness);
    if (this.overlay) {
      this.overlay.style.filter = `brightness(${this.settings.brightness})`;
    }
    const mainScene = this.manager.scene;
    if (mainScene && mainScene.background instanceof THREE.Color) {
      const c = mainScene.background;
      const r = Math.min(255, (c.r * 255 * this.settings.brightness) | 0);
      const g = Math.min(255, (c.g * 255 * this.settings.brightness) | 0);
      const b = Math.min(255, (c.b * 255 * this.settings.brightness) | 0);
      mainScene.background = new THREE.Color(`rgb(${r},${g},${b})`);
    }
  }

  enter() {
    const d = document.createElement('div');
    d.id = 'menu-screen';
    d.style.cssText = 'position:fixed;inset:0;z-index:1000;overflow:hidden;font-family:Rajdhani,sans-serif;color:#fff;background:#0f2b2b';
    d.style.filter = `brightness(${this.settings.brightness})`;

    const bg = document.createElement('div');
    bg.style.cssText = 'position:absolute;inset:0;background:linear-gradient(160deg,#0f2b2b 0%,#14303a 40%,#0f2530 100%)';

    const root = document.createElement('div');
    root.style.cssText = 'position:relative;z-index:2;display:flex;flex-direction:column;height:100vh;padding:24px 32px 18px';

    const header = this.createHeader();
    root.appendChild(header);

    const main = document.createElement('div');
    main.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:0';

    const playBtn = document.createElement('button');
    playBtn.className = 'btn';
    playBtn.textContent = 'PLAY';
    playBtn.onclick = () => { this.exit(); this.manager.start('select'); };

    const worldBtn = document.createElement('button');
    worldBtn.className = 'btn btn-secondary';
    worldBtn.textContent = 'WORLD MAP';
    worldBtn.style.minWidth = '280px';
    worldBtn.onclick = () => {
      this.exit();
      this.manager.start('loading', {
        mode: 'world',
        carIdx: this.lastCarIdx || 0,
        color: null,
        charIdx: 0,
        displayName: this.getCarName(this.lastCarIdx)
      });
    };

    const onlineBtn = document.createElement('button');
    onlineBtn.className = 'btn btn-secondary';
    onlineBtn.textContent = 'PLAY ONLINE';
    onlineBtn.style.minWidth = '280px';
    onlineBtn.onclick = () => { this.exit(); this.manager.start('rooms'); };

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'btn btn-secondary';
    settingsBtn.textContent = 'SETTINGS';
    settingsBtn.style.minWidth = '280px';
    settingsBtn.onclick = () => this.showSettings();

    main.appendChild(playBtn);
    main.appendChild(worldBtn);
    main.appendChild(onlineBtn);
    main.appendChild(settingsBtn);

    root.appendChild(main);
    d.appendChild(bg);
    d.appendChild(root);
    document.body.appendChild(d);
    this.overlay = d;

    this._keyHandler = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        playBtn.click();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  createHeader() {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:8px';

    const title = document.createElement('div');
    title.style.cssText = 'display:flex;align-items:baseline;gap:12px';
    const t1 = document.createElement('span');
    t1.style.cssText = 'font-family:Orbitron,monospace;font-size:13px;color:#6688ff;letter-spacing:6px;opacity:0.8';
    t1.textContent = 'OPEN WORLD';
    const t2 = document.createElement('span');
    t2.style.cssText = 'font-family:Orbitron,monospace;font-size:26px;font-weight:900;background:linear-gradient(135deg,#ff6b35,#ffaa44);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:2px';
    t2.textContent = 'DRIVING';
    title.appendChild(t1);
    title.appendChild(t2);

    const right = document.createElement('div');
    right.style.cssText = 'display:flex;align-items:center;gap:12px';
    const carName = document.createElement('span');
    carName.style.cssText = 'font-size:12px;color:#667;letter-spacing:1px';
    carName.textContent = this.getCarName(this.lastCarIdx);
    right.appendChild(carName);

    row.appendChild(title);
    row.appendChild(right);
    return row;
  }

  getCarName(idx) {
    const ids = [
      'Ford Mustang','Nissan Skyline GT-R','Toyota RAV4','BMW X5',
      'Chevrolet Suburban Taxi','Ford Crown Victoria Police','Ford F-150 Ambulance',
      'Porsche 911 GT3','Tesla Cybertruck','Mercedes-Benz Sprinter','Ford F-150',
      'Chevrolet Silverado Flatbed','Ford Transit Delivery','Isuzu NPR Flatbed',
      'Pierce Arrow Fire Truck','Peterbilt 520 Garbage Truck','John Deere 6155M',
      'Caterpillar 420F Shovel','Honda Civic Type R'
    ];
    return ids[idx % ids.length] || 'Car';
  }

  showSettings() {
    if (this.overlay) {
      this.overlay.style.pointerEvents = 'none';
      this.overlay.style.opacity = '0.4';
    }
    const s = this.settings;

    const d = document.createElement('div');
    d.id = 'settings-overlay';
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);backdrop-filter:blur(10px);z-index:1200;font-family:Rajdhani,sans-serif;color:#fff;padding:20px';

    const box = document.createElement('div');
    box.style.cssText = 'text-align:center;max-width:520px;width:100%;background:rgba(10,10,20,0.97);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:32px 28px';

    const heading = document.createElement('div');
    heading.style.cssText = 'font-family:Orbitron,monospace;font-size:22px;color:#ff6b35;letter-spacing:3px;margin-bottom:20px;text-transform:uppercase';
    heading.textContent = 'Settings';
    box.appendChild(heading);

    const makeSlider = (label, min, max, step, value, onChange) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;text-align:left';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:13px;color:#889;letter-spacing:1px;min-width:70px';
      lbl.textContent = label;
      const slider = document.createElement('input');
      slider.type = 'range'; slider.min = min; slider.max = max; slider.step = step; slider.value = value;
      slider.className = 'slider'; slider.style.flex = '1';
      const val = document.createElement('span');
      val.style.cssText = 'font-family:Orbitron,monospace;font-size:12px;color:#ff6b35;min-width:36px;text-align:right';
      val.textContent = Math.round(value * 100) + '%';
      slider.oninput = () => {
        const v = parseFloat(slider.value);
        val.textContent = Math.round(((v - min) / (max - min)) * 100) + '%';
        onChange(v);
      };
      row.appendChild(lbl); row.appendChild(slider); row.appendChild(val);
      return row;
    };

    box.appendChild(makeSlider('MASTER', 0, 1, 0.05, s.master, v => { s.master = v; }));
    box.appendChild(makeSlider('MUSIC', 0, 1, 0.05, s.music, v => { s.music = v; }));
    box.appendChild(makeSlider('SFX', 0, 1, 0.05, s.sfx, v => { s.sfx = v; }));
    box.appendChild(makeSlider('BRIGHTNESS', 0.5, 1.5, 0.05, s.brightness, v => {
      s.brightness = v;
      this.applySettings();
    }));

    const gfxRow = document.createElement('div');
    gfxRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;text-align:left';
    const gfxLbl = document.createElement('span');
    gfxLbl.style.cssText = 'font-size:13px;color:#889;letter-spacing:1px;min-width:70px';
    gfxLbl.textContent = 'GRAPHICS';
    const gfxGroup = document.createElement('div');
    gfxGroup.style.cssText = 'display:flex;gap:8px;flex:1;justify-content:flex-end';
    ['low', 'medium', 'high'].forEach(level => {
      const opt = document.createElement('div');
      opt.className = 'fh-option' + (s.gfx === level ? ' active' : '');
      opt.textContent = level.toUpperCase();
      opt.onclick = () => {
        gfxGroup.querySelectorAll('.fh-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        s.gfx = level;
        this.applyGfx(level);
      };
      gfxGroup.appendChild(opt);
    });
    gfxRow.appendChild(gfxLbl);
    gfxRow.appendChild(gfxGroup);
    box.appendChild(gfxRow);

    const fpsRow = document.createElement('div');
    fpsRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px;text-align:left';
    const fpsLbl = document.createElement('span');
    fpsLbl.style.cssText = 'font-size:13px;color:#889;letter-spacing:1px;min-width:70px';
    fpsLbl.textContent = 'FPS LIMIT';
    const fpsGroup = document.createElement('div');
    fpsGroup.style.cssText = 'display:flex;gap:8px;flex:1;justify-content:flex-end';
    [60, 120].forEach(fps => {
      const opt = document.createElement('div');
      opt.className = 'fh-option' + (s.fps === fps ? ' active' : '');
      opt.textContent = fps + ' FPS';
      opt.onclick = () => {
        fpsGroup.querySelectorAll('.fh-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        s.fps = fps;
        this.applyFps(fps);
      };
      fpsGroup.appendChild(opt);
    });
    fpsRow.appendChild(fpsLbl);
    fpsRow.appendChild(fpsGroup);
    box.appendChild(fpsRow);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'fh-btn';
    saveBtn.style.marginTop = '6px';
    saveBtn.style.minWidth = '160px';
    saveBtn.textContent = 'SAVE & BACK';
    saveBtn.onclick = () => {
      this.saveSettings();
      if (d) d.remove();
      if (this.overlay) {
        this.overlay.style.pointerEvents = '';
        this.overlay.style.opacity = '';
      }
    };
    box.appendChild(saveBtn);

    d.appendChild(box);
    document.body.appendChild(d);
    this._settingsOverlay = d;

    d.onclick = (e) => { if (e.target === d) saveBtn.click(); };
  }

  applyGfx(level) {
    const renderer = this.manager.renderer;
    const composer = window.__composer;
    if (!composer) return;
    const passes = composer.passes || [];
    if (level === 'low') {
      renderer.shadowMap.enabled = false;
      if (passes[1]) passes[1].enabled = false;
    } else if (level === 'medium') {
      renderer.shadowMap.enabled = true;
      if (passes[1]) passes[1].enabled = true;
      if (passes[1]) passes[1].strength = 0.25;
    } else {
      renderer.shadowMap.enabled = true;
      if (passes[1]) passes[1].enabled = true;
      if (passes[1]) passes[1].strength = 0.4;
    }
  }

  applyFps(fps) {
    const renderer = this.manager.renderer;
    if (!renderer) return;
    renderer.setPixelRatio(fps === 120 ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.5));
  }

  exit() {
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    if (this._settingsOverlay) { this._settingsOverlay.remove(); this._settingsOverlay = null; }
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    this.saveSettings();
  }
}
