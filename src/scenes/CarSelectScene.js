import * as THREE from 'three';
import { CONFIG } from '../config.js';

const CAR_IDS = [
  'race', 'race-future', 'sedan-sports', 'hatchback-sports',
  'suv-luxury', 'sedan', 'suv', 'truck', 'police', 'taxi'
];
const CAR_NAMES = CAR_IDS.map(id => CONFIG.cars[id] || id.replace(/-/g, ' '));

const COLORS = [
  { name: 'Red', hex: '#cc2222' },
  { name: 'Blue', hex: '#2266cc' },
  { name: 'Green', hex: '#22aa44' },
  { name: 'Yellow', hex: '#ffcc00' },
  { name: 'White', hex: '#eeeeee' },
  { name: 'Black', hex: '#222222' },
  { name: 'Orange', hex: '#ff6b35' },
];

const css = document.createElement('style');
css.textContent = `
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
  @keyframes slideDown { from { opacity:0; transform:translateY(-12px) } to { opacity:1; transform:translateY(0) } }
  .sel-btn { padding:14px 60px; font-size:16px; font-weight:700; background:linear-gradient(135deg,#ff6b35,#ff8844); color:#fff; border:none; border-radius:10px; cursor:pointer; letter-spacing:3px; font-family:Rajdhani,sans-serif; box-shadow:0 4px 20px rgba(255,107,53,0.3); transition:all 0.2s ease; text-transform:uppercase; margin:4px }
  .sel-btn:hover { transform:translateY(-2px) scale(1.03); box-shadow:0 8px 30px rgba(255,107,53,0.45) }
  .sel-btn:active { transform:scale(0.97) }
  .sel-btn-back { margin-top:14px; padding:8px 30px; font-size:12px; background:rgba(255,255,255,0.03); color:#667; border:1px solid rgba(255,255,255,0.08); border-radius:6px; cursor:pointer; font-family:Rajdhani,sans-serif; transition:all 0.2s; letter-spacing:1px }
  .sel-btn-back:hover { background:rgba(255,255,255,0.06); color:#aab }
  .color-dot { width:32px; height:32px; border-radius:50%; border:2.5px solid transparent; cursor:pointer; transition:all 0.2s; box-shadow:0 2px 6px rgba(0,0,0,0.3) }
  .color-dot:hover { transform:scale(1.18); box-shadow:0 4px 14px rgba(0,0,0,0.4) }
  .color-dot.active { border-color:#fff; box-shadow:0 0 14px rgba(255,255,255,0.35), 0 2px 6px rgba(0,0,0,0.3) }
`;
document.head.appendChild(css);

export class CarSelectScene {
  constructor(manager) {
    this.manager = manager;
    this.selectedIdx = parseInt(localStorage.getItem('lastCarIdx') || '0', 10);
    this.selectedColor = 0;
    this.carPreview = null;
    this.overlay = null;
    this.isLoading = false;
    this.previewGroup = null;
  }

  enter() {
    const scene = this.manager.scene;
    scene.background = new THREE.Color(0x080810);
    scene.fog = new THREE.Fog(0x080810, 30, 60);
    this.createEnvironment();
    this.spawnPreview();
    this.renderUI();
    this.updateCamera();
  }

  createEnvironment() {
    const scene = this.manager.scene;
    this.previewGroup = new THREE.Group();
    this.previewGroup.name = '_select_env';
    scene.add(this.previewGroup);

    const amb = new THREE.AmbientLight(0x556677, 1.4);
    amb.name = '_select_light_amb';
    this.previewGroup.add(amb);

    const sun = new THREE.DirectionalLight(0xffeedd, 2.0);
    sun.name = '_select_light_sun';
    sun.position.set(8, 15, 8);
    sun.castShadow = true;
    this.previewGroup.add(sun);

    const fill = new THREE.DirectionalLight(0x6688ff, 0.7);
    fill.name = '_select_light_fill';
    fill.position.set(-8, 8, -8);
    this.previewGroup.add(fill);

    const rim = new THREE.DirectionalLight(0xff8844, 0.6);
    rim.name = '_select_light_rim';
    rim.position.set(0, 3, -10);
    this.previewGroup.add(rim);

    const g = new THREE.Mesh(
      new THREE.CircleGeometry(10, 64),
      new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.9 })
    );
    g.rotation.x = -Math.PI / 2;
    g.name = '_select_ground';
    this.previewGroup.add(g);
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
    if (this.carPreview) {
      this.manager.scene.remove(this.carPreview);
      this.carPreview.traverse(c => { if (c.isMesh) { c.geometry?.dispose(); if (c.material) { if (Array.isArray(c.material)) c.material.forEach(m => m.dispose()); else c.material.dispose(); } } });
      this.carPreview = null;
    }

    const model = this.manager.models[CAR_IDS[this.selectedIdx]];
    if (!model) return;

    this.carPreview = model.clone();
    this.cloneMaterials(this.carPreview);
    this.carPreview.scale.set(2.6, 2.6, 2.6);
    this.carPreview.position.set(0, 0.6, 0);
    this.carPreview.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    this.applyColor(this.carPreview, COLORS[this.selectedColor].hex);
    this.manager.scene.add(this.carPreview);
  }

  applyColor(mesh, hex) {
    mesh.traverse(c => {
      if (c.isMesh && c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(m => {
          if (m.color) {
            if (m.map) {
              m.color.setHex(0xffffff);
            } else {
              m.color.setHex(parseInt(hex.replace('#', ''), 16));
            }
          }
          if (m.emissive) m.emissive.setHex(0x000000);
          m.needsUpdate = true;
        });
      }
    });
  }

  updateCamera() {
    const cam = this.manager.camera;
    cam.position.set(0, 3.2, 7.5);
    cam.lookAt(0, 0.6, 0);
  }

  renderUI() {
    const displayName = CAR_NAMES[this.selectedIdx] || CAR_IDS[this.selectedIdx].replace(/-/g, ' ');
    const d = document.createElement('div');
    d.id = 'car-select';
    d.style.cssText = 'position:fixed;inset:0;z-index:500;pointer-events:none;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding-bottom:6vh';

    const panel = document.createElement('div');
    panel.style.cssText = 'text-align:center;color:#fff;pointer-events:auto;max-width:720px;width:92%;padding:22px 18px;background:linear-gradient(180deg, rgba(5,5,20,0.15) 0%, rgba(5,5,20,0.85) 40%, rgba(5,5,20,0.95) 100%);border-radius:18px;border:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(10px)';

    const titleTop = document.createElement('div');
    titleTop.style.cssText = 'font-family:Orbitron,monospace;font-size:12px;color:#6688ff;letter-spacing:8px;text-transform:uppercase;margin-bottom:2px;opacity:0.7;animation:slideDown 0.5s ease-out';
    titleTop.textContent = 'Welcome to';

    const titleMain = document.createElement('div');
    titleMain.style.cssText = 'font-family:Orbitron,monospace;font-size:44px;font-weight:900;background:linear-gradient(135deg,#ff6b35,#ffaa44,#ff6b35);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 25px rgba(255,107,53,0.4));margin-bottom:4px;animation:fadeUp 0.6s ease-out 0.1s both';
    titleMain.textContent = 'NITRO ROAM';

    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:13px;color:#557;letter-spacing:4px;text-transform:uppercase;margin-bottom:18px;animation:fadeUp 0.6s ease-out 0.2s both';
    subtitle.textContent = 'Choose Your Vehicle';

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:16px;align-items:center;justify-content:center;margin-bottom:18px;animation:fadeUp 0.6s ease-out 0.3s both';
    const prevBtn = document.createElement('button');
    prevBtn.id = 'sel-prev';
    prevBtn.style.cssText = 'width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.05);color:#fff;border:1px solid rgba(255,255,255,0.1);cursor:pointer;font-size:18px;transition:all 0.2s;backdrop-filter:blur(6px)';
    prevBtn.textContent = '◀';
    const nextBtn = document.createElement('button');
    nextBtn.id = 'sel-next';
    nextBtn.style.cssText = 'width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.05);color:#fff;border:1px solid rgba(255,255,255,0.1);cursor:pointer;font-size:18px;transition:all 0.2s;backdrop-filter:blur(6px)';
    nextBtn.textContent = '▶';
    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);

    const info = document.createElement('div');
    info.style.cssText = 'display:flex;gap:8px;justify-content:center;align-items:center;margin-bottom:18px;animation:fadeUp 0.6s ease-out 0.4s both';
    const countEl = document.createElement('span');
    countEl.id = 'sel-count';
    countEl.style.cssText = 'font-family:Orbitron,monospace;font-size:11px;color:#445;letter-spacing:2px';
    countEl.textContent = `1 / ${CAR_IDS.length}`;
    const sep = document.createElement('span');
    sep.style.cssText = 'color:#333';
    sep.textContent = '|';
    const nameEl = document.createElement('span');
    nameEl.id = 'sel-name';
    nameEl.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:13px;color:#889;font-weight:700;letter-spacing:1px';
    nameEl.textContent = displayName;
    info.appendChild(countEl);
    info.appendChild(sep);
    info.appendChild(nameEl);

    const colorSection = document.createElement('div');
    colorSection.style.cssText = 'margin-bottom:20px;animation:fadeUp 0.6s ease-out 0.5s both';
    const colorLabel = document.createElement('div');
    colorLabel.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:10px;color:#445;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px';
    colorLabel.textContent = 'Paint Color';
    const picker = document.createElement('div');
    picker.id = 'color-picker';
    picker.style.cssText = 'display:flex;gap:6px;justify-content:center';
    COLORS.forEach((c, i) => {
      const dot = document.createElement('div');
      dot.className = 'color-dot' + (i === 0 ? ' active' : '');
      dot.style.background = c.hex;
      dot.title = c.name;
      dot.onclick = () => this.pickColor(i);
      picker.appendChild(dot);
    });
    colorSection.appendChild(colorLabel);
    colorSection.appendChild(picker);

    const actions = document.createElement('div');
    actions.style.cssText = 'margin-bottom:10px;animation:fadeUp 0.6s ease-out 0.6s both';
    const driveBtn = document.createElement('button');
    driveBtn.id = 'sel-drive';
    driveBtn.className = 'sel-btn';
    driveBtn.textContent = 'ENTER THE WORLD';
    actions.appendChild(driveBtn);
    const backBtn = document.createElement('button');
    backBtn.id = 'sel-back';
    backBtn.className = 'sel-btn-back';
    backBtn.textContent = '← Back to Menu';
    actions.appendChild(backBtn);

    panel.appendChild(titleTop);
    panel.appendChild(titleMain);
    panel.appendChild(subtitle);
    panel.appendChild(controls);
    panel.appendChild(info);
    panel.appendChild(colorSection);
    panel.appendChild(actions);
    d.appendChild(panel);
    document.body.appendChild(d);
    this.overlay = d;

    prevBtn.onclick = () => this.selectCar(-1);
    nextBtn.onclick = () => this.selectCar(1);
    driveBtn.onclick = () => this.startGame();
    backBtn.onclick = () => { this.exit(); this.manager.start('menu'); };

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
    localStorage.setItem('lastCarIdx', String(this.selectedIdx));
    this.spawnPreview();
    const countEl = document.getElementById('sel-count');
    const nameEl = document.getElementById('sel-name');
    if (countEl) countEl.textContent = `${this.selectedIdx + 1} / ${CAR_IDS.length}`;
    if (nameEl) nameEl.textContent = CAR_NAMES[this.selectedIdx] || CAR_IDS[this.selectedIdx].replace(/-/g, ' ');
  }

  startGame() {
    if (this.isLoading) return;
    this.isLoading = true;
    this.exit();
    this.manager.start('loading', {
      carIdx: this.selectedIdx,
      color: COLORS[this.selectedColor].hex,
      charIdx: 0,
      displayName: CAR_NAMES[this.selectedIdx]
    });
  }

  update(dt) {
    if (this.carPreview) this.carPreview.rotation.y += dt * 0.6;
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
    if (this.previewGroup) {
      this.manager.scene.remove(this.previewGroup);
      this.previewGroup.traverse(c => {
        if (c.isMesh) { c.geometry?.dispose(); c.material?.dispose(); }
      });
      this.previewGroup = null;
    }
    document.removeEventListener('keydown', this._keyHandler);
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    this.isLoading = false;
  }
}
