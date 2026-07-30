import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const carList = [
  'sedan', 'sedan-sports', 'suv', 'suv-luxury', 'taxi', 'police',
  'ambulance', 'race', 'race-future', 'van', 'truck', 'truck-flat',
  'delivery', 'delivery-flat', 'firetruck', 'garbage-truck', 'tractor',
  'tractor-shovel', 'hatchback-sports'
];

const cityBuildings = [
  'building-a', 'building-b', 'building-c', 'building-d', 'building-e',
  'building-f', 'building-g', 'building-h', 'building-i', 'building-j',
  'building-k', 'building-l', 'building-m', 'building-n',
  'building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c',
  'building-skyscraper-d', 'building-skyscraper-e',
  'low-detail-building-a', 'low-detail-building-b', 'low-detail-building-c',
  'low-detail-building-d', 'low-detail-building-e', 'low-detail-building-f',
  'low-detail-building-g', 'low-detail-building-h', 'low-detail-building-i',
  'low-detail-building-j', 'low-detail-building-k', 'low-detail-building-l',
  'low-detail-building-m', 'low-detail-building-n',
  'low-detail-building-wide-a', 'low-detail-building-wide-b'
];

export class PreloadScene {
  constructor(manager) {
    this.manager = manager;
    this.totalModels = carList.length + cityBuildings.length;
    this.completed = 0;
    this.startTime = Date.now();
  }

  enter() {
    const div = document.getElementById('overlay') || this.createOverlay();
    div.innerHTML = this.getLoadingHTML();
    div.style.display = 'flex';

    this.loader = new GLTFLoader();
    this.barFill = document.getElementById('load-bar-fill');
    this.statusText = document.getElementById('load-status');

    this.manager.models = {};
    this.manager.cityModels = {};

    const texLoader = new THREE.TextureLoader();
    this.manager.skyboxes = {};
    let skyLoaded = 0;
    const skyboxList = ['day', 'night', 'morning'];
    skyboxList.forEach(name => {
      texLoader.load(`assets/skybox/${name}.png`, (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        this.manager.skyboxes[name] = tex;
        skyLoaded++;
        if (skyLoaded >= skyboxList.length && this.completed >= this.totalModels) this.done();
      });
    });

    const allItems = [
      ...carList.map(n => ({ type: 'car', path: `assets/cars/${n}.glb`, name: n })),
      ...cityBuildings.map(n => ({ type: 'building', path: `assets/city/buildings/${n}.glb`, name: n }))
    ];

    allItems.forEach(item => {
      this.loader.load(
        item.path,
        (gltf) => {
          const group = gltf.scene;
          group.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
          if (item.type === 'car') this.manager.models[item.name] = group;
          else if (item.type === 'building') this.manager.cityModels[item.name] = group;
          this.completed++;
          this.updateBar();
          if (this.completed >= this.totalModels && skyLoaded >= skyboxList.length) this.done();
        },
        (xhr) => {
          if (this.barFill && xhr.total) {
            const pct = Math.floor((this.completed + xhr.loaded / xhr.total) / this.totalModels * 100);
            this.barFill.style.width = Math.min(99, pct) + '%';
          }
        },
        (err) => {
          console.warn(`Fallback for ${item.name}`);
          this.completed++;
          this.updateBar();
          if (this.completed >= this.totalModels && skyLoaded >= skyboxList.length) this.done();
        }
      );
    });
  }

  updateBar() {
    if (this.barFill) this.barFill.style.width = Math.floor(this.completed / this.totalModels * 100) + '%';
    if (this.statusText) this.statusText.textContent = `Loading... ${this.completed}/${this.totalModels}`;
  }

  done() {
    const wait = Math.max(0, 800 - (Date.now() - this.startTime));
    setTimeout(() => {
      this.manager.start('menu');
    }, wait);
  }

  createOverlay() {
    const d = document.createElement('div');
    d.id = 'overlay';
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0a1a;z-index:1000;flex-direction:column';
    document.body.appendChild(d);
    return d;
  }

  getLoadingHTML() {
    return `
      <div style="text-align:center;color:#fff;font-family:Arial">
        <h1 style="font-size:42px;color:#44aaff;margin:0">OPEN WORLD</h1>
        <h2 style="font-size:56px;color:#ff6b35;margin:0 0 40px">DRIVING</h2>
        <div style="width:300px;height:20px;background:#333;border-radius:10px;overflow:hidden;margin:0 auto">
          <div id="load-bar-fill" style="height:100%;width:0%;background:#44aaff;border-radius:10px;transition:width 0.15s"></div>
        </div>
        <p id="load-status" style="margin-top:12px;color:#888;font-size:14px">Loading assets...</p>
      </div>
    `;
  }

  exit() {
    const div = document.getElementById('overlay');
    if (div) div.style.display = 'none';
  }
}
