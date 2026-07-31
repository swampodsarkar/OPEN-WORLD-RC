import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const carList = [
  'race', 'race-future', 'sedan-sports', 'hatchback-sports',
  'suv-luxury', 'sedan', 'suv', 'truck', 'police', 'taxi'
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

const LOADING_TIPS = [
  'Tip: Press SPACE for boost!',
  'Tip: Visit the repair shop to fix damage.',
  'Tip: Collect coins to unlock new cars!',
  'Tip: Drive through the fuel station to refuel.',
  'Tip: Press V to zoom the camera.',
  'Tip: ESC to pause the game.',
  'Tip: Drift around corners for style points!',
  'Tip: Watch your fuel gauge — don\'t run out!',
  'Tip: Headlights turn on automatically at night.',
  'Tip: Buildings cause damage — watch out!'
];

const CHARACTER_MODEL = 'assets/characters/characterMedium.fbx';
const CHARACTER_SKINS = ['criminalMaleA', 'cyborgFemaleA', 'skaterFemaleA', 'skaterMaleA'];

export class PreloadScene {
  constructor(manager) {
    this.manager = manager;
    this.totalModels = carList.length + cityBuildings.length + 1 + CHARACTER_SKINS.length;
    this.completed = 0;
    this.startTime = Date.now();
    this.tipInterval = null;
    this.mode = 'initial';
    this.worldData = null;
  }

  enter(data) {
    if (data && data.mode === 'world') {
      this.mode = 'world';
      this.worldData = data;
      this.showWorldLoading();
      return;
    }

    this.mode = 'initial';
    this.worldData = null;
    this.completed = 0;
    this.startTime = Date.now();

    if (this.manager.crazyGames) this.manager.crazyGames.loadingStart();

    const div = document.getElementById('overlay') || this.createOverlay();
    div.innerHTML = this.getLoadingHTML();
    div.style.display = 'flex';

    this.loader = new GLTFLoader();
    this.barFill = document.getElementById('load-bar-fill');
    this.barGlow = document.getElementById('load-bar-glow');
    this.statusText = document.getElementById('load-status');
    this.tipText = document.getElementById('load-tip');
    this.progressPct = document.getElementById('load-pct');

    this.manager.models = {};
    this.manager.cityModels = {};

    this.startTips();

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

    const carItems = carList.map(n => ({ type: 'car', path: `assets/cars/${n}.glb`, name: n }));
    const buildingItems = cityBuildings.map(n => ({ type: 'building', path: `assets/city/buildings/${n}.glb`, name: n }));

    const allItems = [...carItems, ...buildingItems];
    const BATCH_SIZE = 6;
    let loaded = 0;

    const loadBatch = () => {
      const batch = allItems.slice(loaded, loaded + BATCH_SIZE);
      if (batch.length === 0) return;
      loaded += batch.length;

      batch.forEach(item => {
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
              if (this.progressPct) this.progressPct.textContent = Math.min(99, pct) + '%';
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

      if (loaded < allItems.length) {
        setTimeout(loadBatch, 50);
      }
    };

    loadBatch();
    this.loadCharacters(skyLoaded, skyboxList);
  }

  loadCharacters(skyLoaded, skyboxList) {
    const done = () => {
      if (this.completed >= this.totalModels && skyLoaded >= skyboxList.length) this.done();
    };
    this.manager.characterModel = null;
    this.manager.characterSkins = {};

    const fbxLoader = new FBXLoader();
    const texLoader = new THREE.TextureLoader();

    fbxLoader.load(CHARACTER_MODEL, (object) => {
      this.manager.characterModel = object;
      this.completed++;
      this.updateBar();
      done();
    }, null, () => {
      this.completed++;
      this.updateBar();
      done();
    });

    CHARACTER_SKINS.forEach(name => {
      texLoader.load(`assets/characters/skins/${name}.png`, (tex) => {
        this.manager.characterSkins[name] = tex;
        this.completed++;
        this.updateBar();
        done();
      }, null, () => {
        this.completed++;
        this.updateBar();
        done();
      });
    });
  }

  showWorldLoading() {
    const div = document.getElementById('overlay') || this.createOverlay();
    div.innerHTML = this.getWorldLoadingHTML();
    div.style.display = 'flex';

    this.barFill = document.getElementById('load-bar-fill');
    this.barGlow = document.getElementById('load-bar-glow');
    this.statusText = document.getElementById('load-status');
    this.tipText = document.getElementById('load-tip');
    this.progressPct = document.getElementById('load-pct');

    this.updateBar();

    const steps = [
      { pct: 10, text: 'Loading your vehicle...' },
      { pct: 30, text: 'Building the world...' },
      { pct: 55, text: 'Placing buildings...' },
      { pct: 75, text: 'Setting up the track...' },
      { pct: 90, text: 'Almost ready...' },
    ];

    let stepIdx = 0;
    const totalDuration = 1600;

    const runStep = () => {
      if (stepIdx >= steps.length) {
        if (this.barFill) this.barFill.style.width = '100%';
        if (this.barGlow) this.barGlow.style.width = '100%';
        if (this.progressPct) this.progressPct.textContent = '100%';
        if (this.statusText) this.statusText.textContent = 'Entering world...';
        setTimeout(() => {
          this.manager.start('game', this.worldData);
        }, 200);
        return;
      }
      const step = steps[stepIdx];
      if (this.barFill) this.barFill.style.width = step.pct + '%';
      if (this.barGlow) this.barGlow.style.width = step.pct + '%';
      if (this.progressPct) this.progressPct.textContent = step.pct + '%';
      if (this.statusText) this.statusText.textContent = step.text;
      stepIdx++;
      setTimeout(runStep, totalDuration / steps.length);
    };

    setTimeout(runStep, 200);
  }

  startTips() {
    let idx = Math.floor(Math.random() * LOADING_TIPS.length);
    const show = () => {
      if (this.tipText) {
        this.tipText.style.opacity = '0';
        this.tipText.style.transform = 'translateY(10px)';
        setTimeout(() => {
          if (this.tipText) {
            this.tipText.textContent = LOADING_TIPS[idx % LOADING_TIPS.length];
            this.tipText.style.opacity = '1';
            this.tipText.style.transform = 'translateY(0)';
          }
        }, 300);
      }
      idx++;
    };
    show();
    this.tipInterval = setInterval(show, 3000);
  }

  updateBar() {
    const pct = Math.floor(this.completed / this.totalModels * 100);
    if (this.barFill) this.barFill.style.width = pct + '%';
    if (this.barGlow) this.barGlow.style.width = pct + '%';
    if (this.progressPct) this.progressPct.textContent = pct + '%';
    if (this.statusText) this.statusText.textContent = `Loading assets... ${this.completed}/${this.totalModels}`;
  }

  done() {
    if (this.tipInterval) { clearInterval(this.tipInterval); this.tipInterval = null; }
    if (this.manager.crazyGames) this.manager.crazyGames.loadingStop();
    const wait = Math.max(0, 800 - (Date.now() - this.startTime));
    setTimeout(() => {
      if (this.barFill) this.barFill.style.width = '100%';
      if (this.barGlow) this.barGlow.style.width = '100%';
      if (this.progressPct) this.progressPct.textContent = '100%';
      setTimeout(() => {
        this.manager.start('menu');
      }, 400);
    }, wait);
  }

  createOverlay() {
    const d = document.createElement('div');
    d.id = 'overlay';
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0a0a1a,#111133);z-index:1000;flex-direction:column';
    document.body.appendChild(d);
    return d;
  }

  getLoadingHTML() {
    return `
      <div style="text-align:center;color:#fff">
        <div style="font-family:Orbitron,monospace;font-size:22px;color:#44aaff;letter-spacing:6px;text-transform:uppercase;margin-bottom:4px">NITRO</div>
        <div style="font-family:Orbitron,monospace;font-size:52px;font-weight:900;background:linear-gradient(135deg,#ff6b35,#ffaa44);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:40px">ROAM</div>
        <div style="position:relative;width:320px;height:4px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;margin:0 auto">
          <div id="load-bar-fill" style="height:100%;width:0%;background:linear-gradient(90deg,#44aaff,#2266cc);border-radius:4px;transition:width 0.2s ease"></div>
          <div id="load-bar-glow" style="position:absolute;top:0;left:0;height:100%;width:0%;background:linear-gradient(90deg,transparent,rgba(68,170,255,0.4),transparent);border-radius:4px;filter:blur(4px);transition:width 0.2s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;width:320px;margin:6px auto 0">
          <span id="load-status" style="color:#888;font-family:Rajdhani,sans-serif;font-size:13px">Loading assets...</span>
          <span id="load-pct" style="color:#44aaff;font-family:Orbitron,monospace;font-size:13px;font-weight:700">0%</span>
        </div>
        <div id="load-tip" style="margin-top:30px;color:#555;font-family:Rajdhani,sans-serif;font-size:14px;transition:all 0.3s ease;letter-spacing:1px">Loading...</div>
      </div>
    `;
  }

  getWorldLoadingHTML() {
    return `
      <div style="text-align:center;color:#fff">
        <div style="font-family:Orbitron,monospace;font-size:18px;color:#ff6b35;letter-spacing:4px;text-transform:uppercase;margin-bottom:4px">Preparing World</div>
        <div style="font-family:Orbitron,monospace;font-size:36px;font-weight:900;background:linear-gradient(135deg,#44aaff,#2266cc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:30px">LOADING</div>
        <div style="position:relative;width:320px;height:4px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;margin:0 auto">
          <div id="load-bar-fill" style="height:100%;width:0%;background:linear-gradient(90deg,#ff6b35,#ffaa44);border-radius:4px;transition:width 0.3s ease"></div>
          <div id="load-bar-glow" style="position:absolute;top:0;left:0;height:100%;width:0%;background:linear-gradient(90deg,transparent,rgba(255,107,53,0.4),transparent);border-radius:4px;filter:blur(4px);transition:width 0.3s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;width:320px;margin:6px auto 0">
          <span id="load-status" style="color:#888;font-family:Rajdhani,sans-serif;font-size:13px">Preparing your world...</span>
          <span id="load-pct" style="color:#ff6b35;font-family:Orbitron,monospace;font-size:13px;font-weight:700">0%</span>
        </div>
        <div id="load-tip" style="margin-top:30px;color:#555;font-family:Rajdhani,sans-serif;font-size:14px;transition:all 0.3s ease;letter-spacing:1px">Loading world...</div>
      </div>
    `;
  }

  exit() {
    const div = document.getElementById('overlay');
    if (div) {
      div.style.opacity = '0';
      div.style.transition = 'opacity 0.4s ease';
      setTimeout(() => div.style.display = 'none', 400);
    }
    if (this.tipInterval) { clearInterval(this.tipInterval); this.tipInterval = null; }
  }
}