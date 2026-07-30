import * as THREE from 'three';
import { CONFIG } from '../config.js';

const CAR_IDS = [
  'sedan', 'sedan-sports', 'suv', 'suv-luxury', 'taxi', 'police',
  'ambulance', 'race', 'race-future', 'van', 'truck', 'truck-flat',
  'delivery', 'delivery-flat', 'firetruck', 'garbage-truck', 'tractor',
  'tractor-shovel', 'hatchback-sports'
];

export class CarSelectScene {
  constructor(manager) {
    this.manager = manager;
    this.selectedIdx = 0;
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
    this.carPreview.scale.set(1.2, 1.2, 1.2);
    this.carPreview.position.set(0, 0.5, 0);
    this.carPreview.traverse(c => { if (c.isMesh) { c.castShadow = true; } });
    scene.add(this.carPreview);

    const amb = new THREE.AmbientLight(0x445566, 0.4);
    amb.name = '_select_light_amb';
    scene.add(amb);

    const sun = new THREE.DirectionalLight(0xffeedd, 1.5);
    sun.name = '_select_light_sun';
    sun.position.set(10, 20, 10);
    scene.add(sun);

    const cam = this.manager.camera;
    cam.position.set(0, 4, 8);
    cam.lookAt(0, 0.5, 0);
  }

  renderUI() {
    const d = document.createElement('div');
    d.id = 'car-select';
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:500;font-family:Arial;pointer-events:none';
    d.innerHTML = `
      <div style="text-align:center;color:#fff;pointer-events:auto">
        <h2 style="font-size:24px;color:#44aaff;margin:0 0 10px">SELECT YOUR CAR</h2>
        <p id="sel-name" style="font-size:28px;color:#ff6b35;margin:0 0 20px;font-weight:bold">${CAR_IDS[0].replace(/-/g, ' ').toUpperCase()}</p>
        <div style="display:flex;gap:20px;justify-content:center;align-items:center;margin-bottom:20px">
          <button id="sel-prev" style="font-size:28px;padding:8px 20px;background:#333;color:#fff;border:none;border-radius:8px;cursor:pointer">◀</button>
          <span style="font-size:18px;color:#aaa" id="sel-count">1 / ${CAR_IDS.length}</span>
          <button id="sel-next" style="font-size:28px;padding:8px 20px;background:#333;color:#fff;border:none;border-radius:8px;cursor:pointer">▶</button>
        </div>
        <button id="sel-drive" style="padding:14px 50px;font-size:22px;background:#44aaff;color:#fff;border:none;border-radius:10px;cursor:pointer">🚗 DRIVE</button>
        <br>
        <button id="sel-back" style="margin-top:12px;padding:8px 30px;font-size:14px;background:#333;color:#999;border:none;border-radius:6px;cursor:pointer">← Back</button>
      </div>
    `;
    document.body.appendChild(d);
    this.overlay = d;

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

  selectCar(dir) {
    this.selectedIdx = (this.selectedIdx + dir + CAR_IDS.length) % CAR_IDS.length;

    if (this.carPreview) {
      this.manager.scene.remove(this.carPreview);
      this.carPreview.traverse(c => { if (c.isMesh) { c.geometry?.dispose(); } });
    }
    const model = this.manager.models[CAR_IDS[this.selectedIdx]];
    if (model) {
      this.carPreview = model.clone();
      this.carPreview.scale.set(1.2, 1.2, 1.2);
      this.carPreview.position.set(0, 0.5, 0);
      this.carPreview.traverse(c => { if (c.isMesh) c.castShadow = true; });
      this.manager.scene.add(this.carPreview);
    }

    const nameEl = document.getElementById('sel-name');
    const countEl = document.getElementById('sel-count');
    if (nameEl) nameEl.textContent = CAR_IDS[this.selectedIdx].replace(/-/g, ' ').toUpperCase();
    if (countEl) countEl.textContent = `${this.selectedIdx + 1} / ${CAR_IDS.length}`;
  }

  startGame() {
    this.exit();
    this.manager.start('game', { carIdx: this.selectedIdx });
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
