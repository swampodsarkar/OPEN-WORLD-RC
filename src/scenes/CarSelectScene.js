import * as THREE from 'three';
import { CONFIG } from '../config.js';

const CAR_IDS = [
  'sedan', 'sedan-sports', 'suv', 'suv-luxury', 'taxi', 'police',
  'ambulance', 'race', 'race-future', 'van', 'truck', 'truck-flat',
  'delivery', 'delivery-flat', 'firetruck', 'garbage-truck', 'tractor',
  'tractor-shovel', 'hatchback-sports'
];

const COLORS = [
  { name: 'Red', hex: '#cc2222' },
  { name: 'Blue', hex: '#2266cc' },
  { name: 'Green', hex: '#22aa44' },
  { name: 'Yellow', hex: '#ffcc00' },
  { name: 'White', hex: '#eeeeee' },
  { name: 'Black', hex: '#222222' },
  { name: 'Orange', hex: '#ff6b35' },
  { name: 'Purple', hex: '#8844cc' }
];

export class CarSelectScene {
  constructor(manager) {
    this.manager = manager;
    this.selectedIdx = 0;
    this.selectedColor = 0;
    this.carPreview = null;
    this.overlay = null;
  }

  enter() {
    const scene = this.manager.scene;
    scene.background = new THREE.Color(0x111122);
    this.spawnPreview();
    this.renderUI();
  }

  spawnPreview() {
    const scene = this.manager.scene;
    const model = this.manager.models[CAR_IDS[this.selectedIdx]];
    if (!model) return;

    this.carPreview = model.clone();
    this.carPreview.scale.set(3, 3, 3);
    this.carPreview.position.set(0, 1, 0);
    this.carPreview.traverse(c => { if (c.isMesh) { c.castShadow = true; } });
    this.applyColor(this.carPreview, COLORS[this.selectedColor].hex);
    scene.add(this.carPreview);

    const amb = new THREE.AmbientLight(0x445566, 0.4);
    amb.name = '_select_light_amb';
    scene.add(amb);

    const sun = new THREE.DirectionalLight(0xffeedd, 1.5);
    sun.name = '_select_light_sun';
    sun.position.set(10, 20, 10);
    scene.add(sun);

    const cam = this.manager.camera;
    cam.position.set(0, 5, 10);
    cam.lookAt(0, 1, 0);
  }

  applyColor(mesh, hex) {
    mesh.traverse(c => {
      if (c.isMesh && c.material) {
        if (Array.isArray(c.material)) {
          c.material.forEach(m => { if (m.color) m.color.setHex(parseInt(hex.replace('#', ''), 16)); });
        } else {
          if (c.material.color) c.material.color.setHex(parseInt(hex.replace('#', ''), 16));
        }
      }
    });
  }

  renderUI() {
    const d = document.createElement('div');
    d.id = 'car-select';
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:500;pointer-events:none';
    d.innerHTML = `
      <div style="text-align:center;color:#fff;pointer-events:auto">
        <div style="font-family:Orbitron,monospace;font-size:18px;color:#44aaff;letter-spacing:4px;text-transform:uppercase;margin-bottom:4px">Select Your</div>
        <div style="font-family:Orbitron,monospace;font-size:32px;font-weight:900;background:linear-gradient(135deg,#ff6b35,#ffaa44);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:20px">CAR</div>
        <p id="sel-name" style="font-family:Rajdhani,sans-serif;font-size:28px;font-weight:700;color:#fff;margin:0 0 16px;letter-spacing:2px">${CAR_IDS[0].replace(/-/g, ' ').toUpperCase()}</p>
        <div style="display:flex;gap:16px;justify-content:center;align-items:center;margin-bottom:16px">
          <button id="sel-prev" style="font-size:24px;padding:8px 16px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.12);border-radius:8px;cursor:pointer;transition:all 0.15s">◀</button>
          <span id="sel-count" style="font-family:Rajdhani,sans-serif;font-size:16px;color:#888">1 / ${CAR_IDS.length}</span>
          <button id="sel-next" style="font-size:24px;padding:8px 16px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.12);border-radius:8px;cursor:pointer;transition:all 0.15s">▶</button>
        </div>
        <div style="margin-bottom:20px">
          <div style="font-family:Rajdhani,sans-serif;font-size:12px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Color</div>
          <div style="display:flex;gap:6px;justify-content:center" id="color-picker"></div>
        </div>
        <button id="sel-drive" class="sel-btn-primary">DRIVE</button>
        <br>
        <button id="sel-back" class="sel-btn-back">← Back</button>
      </div>
      <style>
        .sel-btn-primary { padding:14px 60px; font-size:20px; font-weight:700; background:linear-gradient(135deg,#44aaff,#2266cc); color:#fff; border:none; border-radius:10px; cursor:pointer; letter-spacing:2px; font-family:Rajdhani,sans-serif; box-shadow:0 4px 20px rgba(68,170,255,0.3); transition:all 0.15s; margin:4px }
        .sel-btn-primary:hover { transform:translateY(-2px) scale(1.02); box-shadow:0 6px 30px rgba(68,170,255,0.4) }
        .sel-btn-back { margin-top:12px; padding:8px 30px; font-size:14px; background:rgba(255,255,255,0.06); color:#888; border:1px solid rgba(255,255,255,0.08); border-radius:6px; cursor:pointer; font-family:Rajdhani,sans-serif; transition:all 0.15s }
        .sel-btn-back:hover { background:rgba(255,255,255,0.1); color:#ccc }
        .color-dot { width:28px; height:28px; border-radius:50%; border:2px solid transparent; cursor:pointer; transition:all 0.15s }
        .color-dot:hover { transform:scale(1.15) }
        .color-dot.active { border-color:#fff; box-shadow:0 0 12px rgba(255,255,255,0.3) }
      </style>
    `;
    document.body.appendChild(d);
    this.overlay = d;

    const picker = document.getElementById('color-picker');
    COLORS.forEach((c, i) => {
      const dot = document.createElement('div');
      dot.className = 'color-dot' + (i === 0 ? ' active' : '');
      dot.style.background = c.hex;
      dot.onclick = () => this.pickColor(i);
      picker.appendChild(dot);
    });

    document.getElementById('sel-prev').onclick = () => this.selectCar(-1);
    document.getElementById('sel-next').onclick = () => this.selectCar(1);
    document.getElementById('sel-drive').onclick = () => this.startGame();
    document.getElementById('sel-back').onclick = () => { this.exit(); this.manager.start('menu'); };

    document.addEventListener('keydown', this._keyHandler = (e) => {
      if (e.key === 'ArrowLeft') this.selectCar(-1);
      else if (e.key === 'ArrowRight') this.selectCar(1);
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.startGame(); }
      else if (e.key === 'Escape') { this.exit(); this.manager.start('menu'); }
    });
  }

  pickColor(idx) {
    this.selectedColor = idx;
    document.querySelectorAll('.color-dot').forEach((d, i) => d.className = 'color-dot' + (i === idx ? ' active' : ''));
    if (this.carPreview) this.applyColor(this.carPreview, COLORS[idx].hex);
  }

  selectCar(dir) {
    this.selectedIdx = (this.selectedIdx + dir + CAR_IDS.length) % CAR_IDS.length;

    if (this.carPreview) {
      this.manager.scene.remove(this.carPreview);
      this.carPreview.traverse(c => { if (c.isMesh) { c.geometry?.dispose(); } });
    }
    const model = this.manager.models[CAR_IDS[this.selectedIdx]];
    if (model) {
      this.carPreview = model.clone();
      this.carPreview.scale.set(3, 3, 3);
      this.carPreview.position.set(0, 1, 0);
      this.carPreview.traverse(c => { if (c.isMesh) c.castShadow = true; });
      this.applyColor(this.carPreview, COLORS[this.selectedColor].hex);
      this.manager.scene.add(this.carPreview);
    }

    const nameEl = document.getElementById('sel-name');
    const countEl = document.getElementById('sel-count');
    if (nameEl) nameEl.textContent = CAR_IDS[this.selectedIdx].replace(/-/g, ' ').toUpperCase();
    if (countEl) countEl.textContent = `${this.selectedIdx + 1} / ${CAR_IDS.length}`;
  }

  startGame() {
    this.exit();
    this.manager.start('game', { carIdx: this.selectedIdx, color: COLORS[this.selectedColor].hex });
  }

  update(dt) {
    if (this.carPreview) this.carPreview.rotation.y += dt * 0.8;
  }

  exit() {
    if (this.carPreview) { this.manager.scene.remove(this.carPreview); this.carPreview = null; }
    const names = ['_select_light_amb', '_select_light_sun'];
    names.forEach(n => {
      const o = this.manager.scene.getObjectByName(n);
      if (o) this.manager.scene.remove(o);
    });
    document.removeEventListener('keydown', this._keyHandler);
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
  }
}
