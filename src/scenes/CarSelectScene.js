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
    this.isLoading = false;
  }

  enter() {
    const scene = this.manager.scene;
    scene.background = new THREE.Color(0x0a0a1a);
    this.spawnPreview();
    this.renderUI();
  }

  cloneMaterials(mesh) {
    mesh.traverse(c => {
      if (c.isMesh && c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        const cloned = mats.map(m => {
          const n = m.clone();
          if (m.map) n.map = m.map;
          if (m.normalMap) n.normalMap = m.normalMap;
          if (m.roughnessMap) n.roughnessMap = m.roughnessMap;
          if (m.metalnessMap) n.metalnessMap = m.metalnessMap;
          if (m.emissiveMap) n.emissiveMap = m.emissiveMap;
          if (m.aoMap) n.aoMap = m.aoMap;
          if (m.bumpMap) n.bumpMap = m.bumpMap;
          n.needsUpdate = true;
          return n;
        });
        c.material = Array.isArray(c.material) ? cloned : cloned[0];
      }
    });
  }

  spawnPreview() {
    const scene = this.manager.scene;
    const model = this.manager.models[CAR_IDS[this.selectedIdx]];
    if (!model) return;

    this.carPreview = model.clone();
    this.cloneMaterials(this.carPreview);
    this.carPreview.scale.set(3, 3, 3);
    this.carPreview.position.set(0, 1, 0);
    this.carPreview.traverse(c => { if (c.isMesh) { c.castShadow = true; } });
    this.applyColor(this.carPreview, COLORS[this.selectedColor].hex);
    scene.add(this.carPreview);

    const amb = new THREE.AmbientLight(0x445566, 0.6);
    amb.name = '_select_light_amb';
    scene.add(amb);

    const sun = new THREE.DirectionalLight(0xffeedd, 2.0);
    sun.name = '_select_light_sun';
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x4488ff, 0.4);
    fill.name = '_select_light_fill';
    fill.position.set(-5, 10, -5);
    scene.add(fill);

    const cam = this.manager.camera;
    cam.position.set(0, 5, 10);
    cam.lookAt(0, 1, 0);
  }

  applyColor(mesh, hex) {
    mesh.traverse(c => {
      if (c.isMesh && c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(m => {
          if (m.color) m.color.setHex(parseInt(hex.replace('#', ''), 16));
          if (m.emissive) m.emissive.setHex(0x000000);
          m.needsUpdate = true;
        });
      }
    });
  }

  renderUI() {
    const d = document.createElement('div');
    d.id = 'car-select';
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;z-index:500;pointer-events:none;background:linear-gradient(180deg, rgba(5,5,20,0.2) 0%, rgba(5,5,20,0.85) 40%, rgba(5,5,20,0.95) 100%)';
    d.innerHTML = `
      <div style="text-align:center;color:#fff;pointer-events:auto;max-width:680px;width:92%;padding-bottom:6vh">
        <div style="font-family:Orbitron,monospace;font-size:12px;color:#6688ff;letter-spacing:8px;text-transform:uppercase;margin-bottom:2px;opacity:0.7;animation:slideDown 0.5s ease-out">Welcome to</div>
        <div style="font-family:Orbitron,monospace;font-size:46px;font-weight:900;background:linear-gradient(135deg,#ff6b35,#ffaa44,#ff6b35);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 25px rgba(255,107,53,0.4));margin-bottom:4px;animation:fadeUp 0.6s ease-out 0.1s both">DRIVING</div>
        <div style="font-family:Rajdhani,sans-serif;font-size:13px;color:#557;letter-spacing:4px;text-transform:uppercase;margin-bottom:20px;animation:fadeUp 0.6s ease-out 0.2s both">Choose Your Vehicle</div>
        <div style="display:flex;gap:16px;align-items:center;justify-content:center;margin-bottom:18px;animation:fadeUp 0.6s ease-out 0.3s both">
          <button id="sel-prev" style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.05);color:#fff;border:1px solid rgba(255,255,255,0.1);cursor:pointer;font-size:18px;transition:all 0.2s;backdrop-filter:blur(6px)">◀</button>
          <div style="position:relative;width:180px;height:110px;border-radius:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);overflow:hidden;backdrop-filter:blur(4px)">
            <div id="sel-preview-label" style="position:absolute;bottom:0;left:0;right:0;padding:7px;background:linear-gradient(transparent,rgba(0,0,0,0.7));font-family:Orbitron,monospace;font-size:12px;font-weight:700;color:#fff;letter-spacing:2px;text-transform:uppercase">SEDAN</div>
            <div id="sel-preview-color" style="position:absolute;top:6px;right:6px;width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,0.25);background:${COLORS[0].hex};box-shadow:0 0 8px ${COLORS[0].hex}">
            </div>
          </div>
          <button id="sel-next" style="width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.05);color:#fff;border:1px solid rgba(255,255,255,0.1);cursor:pointer;font-size:18px;transition:all 0.2s;backdrop-filter:blur(6px)">▶</button>
        </div>
        <div style="display:flex;gap:8px;justify-content:center;align-items:center;margin-bottom:18px;animation:fadeUp 0.6s ease-out 0.4s both">
          <span id="sel-count" style="font-family:Orbitron,monospace;font-size:11px;color:#445;letter-spacing:2px">1 / ${CAR_IDS.length}</span>
        </div>
        <div style="margin-bottom:20px;animation:fadeUp 0.6s ease-out 0.5s both">
          <div style="font-family:Rajdhani,sans-serif;font-size:10px;color:#445;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">Paint Color</div>
          <div style="display:flex;gap:6px;justify-content:center" id="color-picker"></div>
        </div>
        <button id="sel-drive" class="sel-btn-drive">ENTER THE WORLD</button>
        <br>
        <button id="sel-back" class="sel-btn-back">← Back to Menu</button>
      </div>
      <style>
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideDown { from { opacity:0; transform:translateY(-12px) } to { opacity:1; transform:translateY(0) } }
        #car-select > div { animation: fadeUp 0.5s ease-out both; animation-delay: 0.15s; }
        #sel-prev:hover { background:rgba(255,255,255,0.12); transform:scale(1.08); }
        #sel-next:hover { background:rgba(255,255,255,0.12); transform:scale(1.08); }
        #sel-prev:active { transform:scale(0.93); }
        #sel-next:active { transform:scale(0.93); }
        .sel-btn-drive { padding:14px 60px; font-size:16px; font-weight:700; background:linear-gradient(135deg,#ff6b35,#ff8844); color:#fff; border:none; border-radius:10px; cursor:pointer; letter-spacing:3px; font-family:Rajdhani,sans-serif; box-shadow:0 4px 20px rgba(255,107,53,0.3); transition:all 0.2s ease; text-transform:uppercase; margin:4px }
        .sel-btn-drive:hover { transform:translateY(-2px) scale(1.03); box-shadow:0 8px 30px rgba(255,107,53,0.45) }
        .sel-btn-drive:active { transform:scale(0.97) }
        .sel-btn-drive:disabled { opacity:0.35; cursor:not-allowed; transform:none; box-shadow:none }
        .sel-btn-back { margin-top:14px; padding:8px 30px; font-size:12px; background:rgba(255,255,255,0.03); color:#445; border:1px solid rgba(255,255,255,0.05); border-radius:6px; cursor:pointer; font-family:Rajdhani,sans-serif; transition:all 0.2s; letter-spacing:1px }
        .sel-btn-back:hover { background:rgba(255,255,255,0.06); color:#667 }
        .color-dot { width:30px; height:30px; border-radius:50%; border:2.5px solid transparent; cursor:pointer; transition:all 0.2s; box-shadow:0 2px 6px rgba(0,0,0,0.3) }
        .color-dot:hover { transform:scale(1.18); box-shadow:0 4px 14px rgba(0,0,0,0.4) }
        .color-dot.active { border-color:#fff; box-shadow:0 0 14px rgba(255,255,255,0.35), 0 2px 6px rgba(0,0,0,0.3) }
      </style>
    `;
    document.body.appendChild(d);
    this.overlay = d;

    const picker = document.getElementById('color-picker');
    COLORS.forEach((c, i) => {
      const dot = document.createElement('div');
      dot.className = 'color-dot' + (i === 0 ? ' active' : '');
      dot.style.background = c.hex;
      dot.title = c.name;
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
    const colorDot = document.getElementById('sel-preview-color');
    if (colorDot) colorDot.style.background = COLORS[idx].hex;
    if (this.carPreview) this.applyColor(this.carPreview, COLORS[idx].hex);
  }

  selectCar(dir) {
    this.selectedIdx = (this.selectedIdx + dir + CAR_IDS.length) % CAR_IDS.length;

    if (this.carPreview) {
      this.manager.scene.remove(this.carPreview);
      this.carPreview.traverse(c => {
        if (c.isMesh) {
          c.geometry?.dispose();
          if (c.material) {
            if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
            else c.material.dispose();
          }
        }
      });
      this.carPreview = null;
    }

    const model = this.manager.models[CAR_IDS[this.selectedIdx]];
    if (model) {
      this.carPreview = model.clone();
      this.cloneMaterials(this.carPreview);
      this.carPreview.scale.set(3, 3, 3);
      this.carPreview.position.set(0, 1, 0);
      this.carPreview.traverse(c => { if (c.isMesh) c.castShadow = true; });
      this.applyColor(this.carPreview, COLORS[this.selectedColor].hex);
      this.manager.scene.add(this.carPreview);
    }

    const nameEl = document.getElementById('sel-preview-label');
    const countEl = document.getElementById('sel-count');
    const colorDot = document.getElementById('sel-preview-color');
    if (nameEl) nameEl.textContent = CAR_IDS[this.selectedIdx].replace(/-/g, ' ').toUpperCase();
    if (countEl) countEl.textContent = `${this.selectedIdx + 1} / ${CAR_IDS.length}`;
    if (colorDot) colorDot.style.background = COLORS[this.selectedColor].hex;
  }

  startGame() {
    if (this.isLoading) return;
    this.isLoading = true;
    this.exit();
    this.manager.start('preload', { mode: 'world', carIdx: this.selectedIdx, color: COLORS[this.selectedColor].hex });
  }

  update(dt) {
    if (this.carPreview) this.carPreview.rotation.y += dt * 0.8;
  }

  exit() {
    if (this.carPreview) {
      this.manager.scene.remove(this.carPreview);
      this.carPreview.traverse(c => {
        if (c.isMesh) {
          c.geometry?.dispose();
          if (c.material) {
            if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
            else c.material.dispose();
          }
        }
      });
      this.carPreview = null;
    }
    const names = ['_select_light_amb', '_select_light_sun', '_select_light_fill'];
    names.forEach(n => {
      const o = this.manager.scene.getObjectByName(n);
      if (o) this.manager.scene.remove(o);
    });
    document.removeEventListener('keydown', this._keyHandler);
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    this.isLoading = false;
  }
}