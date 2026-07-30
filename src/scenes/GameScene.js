import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Car } from '../entities/Car.js';
import { SoundService } from '../services/SoundService.js';

const CAR_IDS = [
  'sedan', 'sedan-sports', 'suv', 'suv-luxury', 'taxi', 'police',
  'ambulance', 'race', 'race-future', 'van', 'truck', 'truck-flat',
  'delivery', 'delivery-flat', 'firetruck', 'garbage-truck', 'tractor',
  'tractor-shovel', 'hatchback-sports'
];

const TILE = 8;
const ROAD_OUT = 300;
const ROAD_INN = 220;
const ROAD_W = ROAD_OUT - ROAD_INN;
const ROAD_L = ROAD_OUT * 2;
const DAY_DURATION = 120;

export class GameScene {
  constructor(manager) {
    this.manager = manager;
    this.currentCar = null;
    this.sceneObjects = [];
    this.buildings = [];
    this.input = { forward: false, backward: false, left: false, right: false, boost: false };
    this.paused = false;
    this.hudEls = {};
    this.selectedIdx = 0;
    this.camZoom = false;
    this.multi = false;
    this.playerId = null;
    this.roomId = null;
    this.ghostCars = {};
    this.syncInterval = null;
    this.posListener = null;
    this.prevPos = { x: 0, z: 0 };
    this.collisionCooldown = 0;
    this.inRepairZone = false;
    this.inFuelZone = false;
    this.dayTime = 9;
    this.ambientLight = null;
    this.sunLight = null;
    this.hemiLight = null;
    this.headlights = [];
    this.skyDome = null;
    this.sound = new SoundService();
    this.coins = [];
    this.coinCount = 0;
    this.driftScore = 0;
    this.driftActive = false;
    this.driftCooldown = 0;
    this.screenShake = { intensity: 0, duration: 0 };
    this.particles = { exhaust: [], dust: [] };
    this.speedLines = [];
    this.nitrousFlame = null;
    this.touchInput = { forward: false, backward: false, left: false, right: false, boost: false };
    this.minimapCtx = null;
    this.timer = 0;
    this.bestTime = parseFloat(localStorage.getItem('bestTime') || '0');
    this.lapCount = 0;
    this.checkpointIdx = 0;
    this.checkpoints = [];
    this._touchStartX = 0;
    this._touchStartY = 0;
  }

  enter(data) {
    this.multi = data && data.roomId;
    if (this.multi) {
      this.roomId = data.roomId;
      this.playerId = data.playerId;
      this.selectedIdx = (data.players && data.players[this.playerId]?.carIdx) || 0;
    } else if (data && data.carIdx !== undefined) {
      this.selectedIdx = data.carIdx;
    }
    this.selectedColor = (data && data.color) || null;
    this.cameraAngle = 0;
    this.cameraOrbitDistance = CONFIG.camera.followDistance;
    this.cameraOrbitHeight = CONFIG.camera.followHeight;
    this.cameraTarget = new THREE.Vector3();
    this.buildScene();
    this.bindKeys();
    this.bindMouse();
    this.bindTouch();
    this.createHUD();
    this.createMinimap();
    this.spawnCoins();
    this.initCheckpoints();
    this.sound.init();
    if (this.multi) this.initMultiplayer(data);
  }

  addObj(obj) { this.sceneObjects.push(obj); this.manager.scene.add(obj); }

  buildScene() {
    const scene = this.manager.scene;
    this.dayTime = 9;
    this.updateSky(scene);
    this.addGround(scene);
    this.addRoads(scene);
    this.buildCity(scene);
    this.addLights(scene);
    this.spawnCar(scene);
  }

  updateSky(scene) {
    const hr = this.dayTime;
    let skyKey = 'day';
    if (hr >= 20 || hr < 5) skyKey = 'night';
    else if (hr >= 18) skyKey = 'morning';
    else if (hr >= 5 && hr < 7) skyKey = 'morning';
    const tex = this.manager.skyboxes?.[skyKey];
    scene.background = tex || new THREE.Color(CONFIG.skyColor);
    const fogColor = hr >= 20 || hr < 5 ? 0x0a0a14 : hr >= 18 ? 0x443322 : hr < 7 ? 0x665544 : 0xc8d0d8;
    scene.fog = new THREE.Fog(fogColor, hr >= 20 || hr < 5 ? 60 : 120, hr >= 20 || hr < 5 ? 300 : 600);
  }

  addGround(scene) {
    const c = document.createElement('canvas'); c.width = 2; c.height = 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a5a2a'; ctx.fillRect(0, 0, 2, 2);
    ctx.fillStyle = '#235023'; ctx.fillRect(0, 0, 1, 1); ctx.fillRect(1, 1, 1, 1);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(80, 80);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.world.size, CONFIG.world.size),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    g.rotation.x = -Math.PI / 2; g.receiveShadow = true; this.addObj(g);
  }

  addRoads(scene) {
    const out = ROAD_OUT, inn = ROAD_INN, rw = ROAD_W, rl = ROAD_L;
    const asphalt = new THREE.MeshStandardMaterial({ map: this.makeAsphaltTex(), roughness: 0.85, metalness: 0.05 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.6 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7 });
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const crossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7 });
    function p(w, h) { return new THREE.PlaneGeometry(w, h); }
    function rd(x, z, w, h) { const m = new THREE.Mesh(p(w, h), asphalt); m.position.set(x, 0.04, z); m.rotation.x = -Math.PI / 2; return m; }
    this.addObj(rd(0, -(inn + rw / 2), rl, rw)); this.addObj(rd(0, (inn + rw / 2), rl, rw));
    this.addObj(rd(-(inn + rw / 2), 0, rw, rl)); this.addObj(rd((inn + rw / 2), 0, rw, rl));
    const dl = rl / 24, cw = 0.4;
    for (let i = -12; i <= 12; i++) { if (i % 2 === 0) continue; const t = (i / 12) * out * 0.95;
      const d = new THREE.Mesh(p(dl, cw), dashMat); d.position.set(t, 0.06, -(inn + rw / 2)); d.rotation.x = -Math.PI / 2; this.addObj(d);
      const d2 = new THREE.Mesh(p(dl, cw), dashMat); d2.position.set(t, 0.06, (inn + rw / 2)); d2.rotation.x = -Math.PI / 2; this.addObj(d2); }
    for (let i = -12; i <= 12; i++) { if (i % 2 === 0) continue; const t = (i / 12) * out * 0.95;
      const d = new THREE.Mesh(p(cw, dl), dashMat); d.position.set(-(inn + rw / 2), 0.06, t); d.rotation.x = -Math.PI / 2; this.addObj(d);
      const d2 = new THREE.Mesh(p(cw, dl), dashMat); d2.position.set((inn + rw / 2), 0.06, t); d2.rotation.x = -Math.PI / 2; this.addObj(d2); }
    const sw = 2, oe = out + 1.5, ie = inn - 1.5;
    const swalk = (x, z, w, h) => { const m = new THREE.Mesh(p(w, h), sidewalkMat); m.position.set(x, 0.06, z); m.rotation.x = -Math.PI / 2; this.addObj(m); };
    swalk(0, -(oe + sw / 2), rl + sw * 2, sw); swalk(0, (oe + sw / 2), rl + sw * 2, sw);
    swalk(-(oe + sw / 2), 0, sw, rl + sw * 2); swalk((oe + sw / 2), 0, sw, rl + sw * 2);
    swalk(0, -(ie - sw / 2), rl - sw * 2, sw); swalk(0, (ie - sw / 2), rl - sw * 2, sw);
    swalk(-(ie - sw / 2), 0, sw, rl - sw * 2); swalk((ie - sw / 2), 0, sw, rl - sw * 2);
    const curb = (x, z, w, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, 0.5), curbMat); m.position.set(x, 0.125, z); m.rotation.y = ry || 0; m.castShadow = true; this.addObj(m); };
    curb(0, -(oe + 0.25), rl + sw * 2); curb(0, (oe + 0.25), rl + sw * 2);
    curb(-(oe + 0.25), 0, sw, Math.PI / 2); curb((oe + 0.25), 0, sw, Math.PI / 2);
    curb(0, -(ie - 0.25), rl - sw * 2); curb(0, (ie - 0.25), rl - sw * 2);
    curb(-(ie - 0.25), 0, sw, Math.PI / 2); curb((ie - 0.25), 0, sw, Math.PI / 2);
    const xw = (x, z, w, h) => { const m = new THREE.Mesh(p(w, h), crossMat); m.position.set(x, 0.08, z); m.rotation.x = -Math.PI / 2; this.addObj(m); };
    xw(0, -(inn + rw / 2), rw * 0.5, 4); xw(0, (inn + rw / 2), rw * 0.5, 4);
    xw(-(inn + rw / 2), 0, 4, rw * 0.5); xw((inn + rw / 2), 0, 4, rw * 0.5);
    [[-(oe + sw / 2), -(oe + sw / 2)],[-(oe + sw / 2), (oe + sw / 2)],
     [(oe + sw / 2), -(oe + sw / 2)],[(oe + sw / 2), (oe + sw / 2)]].forEach(([cx, cz]) => {
      const s = new THREE.Mesh(p(sw, sw), sideMat); s.position.set(cx, 0.06, cz); s.rotation.x = -Math.PI / 2; this.addObj(s); });
  }

  makeAsphaltTex() {
    const s = 256, c = document.createElement('canvas'); c.width = s; c.height = s;
    const ctx = c.getContext('2d');
    for (let x = 0; x < s; x++) for (let y = 0; y < s; y++) { const v = 55 + Math.random() * 25 | 0; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x, y, 1, 1); }
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(12, 12);
    return tex;
  }

   buildCity(scene) {
     const ct = this.manager.cityModels;
     if (!ct) return;

     const buildingNames = Object.keys(ct).filter(n => n.startsWith('building-') || n.startsWith('low-detail-building'));
     if (buildingNames.length < 2) { buildingNames.length = 0; buildingNames.push('building-a', 'building-c'); }

     const geoCache = {};
     const matCache = {};

     const getSharedGeo = (name) => {
       if (!geoCache[name]) {
         const model = ct[name];
         if (model && model.children.length > 0) {
           model.children.forEach(child => {
             if (child.isMesh && child.geometry) {
               geoCache[name + '_' + child.geometry.id] = child.geometry.clone();
             }
           });
         }
       }
       return Object.values(geoCache);
     };

     const place = (name, x, z, rotY, scale) => {
       const model = ct[name];
       if (!model || model.children.length === 0) return null;
       const m = model.clone();
       m.scale.set(scale || TILE, scale || TILE, scale || TILE);
       m.position.set(x, 0, z);
       if (rotY) m.rotation.y = rotY;
       m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
       this.addObj(m);
       return m;
     };

     const orients = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
     const inn = ROAD_INN, out = ROAD_OUT, rw = ROAD_W;

     for (let i = 0; i < 40; i++) {
       const name = buildingNames[Math.floor(Math.random() * buildingNames.length)];
       const angle = Math.random() * Math.PI * 2;
       const dist = 30 + Math.random() * (inn - 40);
       const x = Math.cos(angle) * dist;
       const z = Math.sin(angle) * dist;
       const rot = orients[Math.floor(Math.random() * orients.length)];
       const sc = TILE + (Math.random() - 0.5) * 5;
       const mesh = place(name, x, z, rot, sc);
       if (mesh) this.buildings.push({ mesh, x, z, r: sc * 2.2 });
     }

     for (let i = 0; i < 25; i++) {
       const name = buildingNames[Math.floor(Math.random() * buildingNames.length)];
       const angle = Math.random() * Math.PI * 2;
       const dist = out + 20 + Math.random() * 120;
       const x = Math.cos(angle) * dist;
       const z = Math.sin(angle) * dist;
       const rot = orients[Math.floor(Math.random() * orients.length)];
       const sc = TILE + (Math.random() - 0.5) * 6;
       const mesh = place(name, x, z, rot, sc);
       if (mesh) this.buildings.push({ mesh, x, z, r: sc * 2.2 });
     }

     this.addRepairShop(-(inn + rw / 2), -(inn + rw / 2));
     this.addFuelStation((inn + rw / 2), (inn + rw / 2));
   }

  addRepairShop(x, z) {
    const m = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.6 });
    const rm = new THREE.MeshStandardMaterial({ color: 0x994422, roughness: 0.7 });
    const sm = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 0.3 });
    new THREE.BoxGeometry(2, 4, 8); new THREE.BoxGeometry(10, 0.3, 8);
    const l = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 8), m); l.position.set(x - 4, 2, z); this.addObj(l);
    const r = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 8), m); r.position.set(x + 4, 2, z); this.addObj(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 2), m); b.position.set(x, 2, z + 3); this.addObj(b);
    const rf = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 8), rm); rf.position.set(x, 4, z); this.addObj(rf);
    const sg = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.3), sm); sg.position.set(x, 4.8, z - 4); this.addObj(sg);
    this.addZone(x, z, 10, 0x44ff44, 0.15);
    this.repairZones = [{ x, z, r: 10 }];
    this.buildings.push({ x, z, r: 8 });
  }

  addFuelStation(x, z) {
    const pm = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 });
    const rm = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.6 });
    const pm2 = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4 });
    const sm = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff4444, emissiveIntensity: 0.2 });
    const ch = 3.5;
    for (let px of [-3, 3]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, ch), pm); p.position.set(x + px, ch/2, z); this.addObj(p); }
    for (let pz of [-2.5, 2.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, ch), pm); p.position.set(x, ch/2, z + pz); this.addObj(p); }
    const rf = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, 7), rm); rf.position.set(x, ch, z); this.addObj(rf);
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 1.2), pm2); p1.position.set(x - 1.5, 0.9, z + 1.5); this.addObj(p1);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 1.2), pm2); p2.position.set(x + 1.5, 0.9, z - 1.5); this.addObj(p2);
    const sg = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 0.25), sm); sg.position.set(x, ch + 0.6, z); this.addObj(sg);
    this.addZone(x, z, 9, 0xff4444, 0.15);
    this.fuelZones = [{ x, z, r: 9 }];
    this.buildings.push({ x, z, r: 7 });
  }

  addZone(x, z, r, color, alpha) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.3, r, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha, side: THREE.DoubleSide }));
    ring.position.set(x, 0.12, z); ring.rotation.x = -Math.PI / 2; this.addObj(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.3, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: alpha + 0.2 }));
      dot.position.set(x + Math.cos(a) * r, 0.12, z + Math.sin(a) * r); dot.rotation.x = -Math.PI / 2; this.addObj(dot);
    }
  }

  addLights(scene) {
    this.ambientLight = new THREE.AmbientLight(0x556677, 0.5);
    this.addObj(this.ambientLight);
    this.hemiLight = new THREE.HemisphereLight(0x88ccff, 0x445533, 0.4);
    this.addObj(this.hemiLight);
    this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.4);
    this.sunLight.position.set(60, 100, 50);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(512, 512);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 250;
    this.sunLight.shadow.camera.left = -80;
    this.sunLight.shadow.camera.right = 80;
    this.sunLight.shadow.camera.top = 80;
    this.sunLight.shadow.camera.bottom = -80;
    this.addObj(this.sunLight);
  }

  updateLighting(dt) {
    this.dayTime += dt / DAY_DURATION;
    if (this.dayTime > 24) this.dayTime -= 24;
    const hr = this.dayTime;

    let intensity, ambIntensity, hemiIntensity;
    let sunColor, ambColor, hemiColor;
    let sunAngle;

    if (hr >= 6 && hr < 18) {
      const t = (hr - 6) / 12;
      intensity = 0.8 + t * 0.6;
      ambIntensity = 0.35 + t * 0.2;
      hemiIntensity = 0.3 + t * 0.15;
      sunColor = new THREE.Color(0xffeedd);
      ambColor = new THREE.Color(0x556677);
      hemiColor = new THREE.Color(0x88ccff);
      sunAngle = t * Math.PI - Math.PI * 0.3;
    } else if (hr >= 18 && hr < 20) {
      const t = (hr - 18) / 2;
      intensity = 1.4 * (1 - t * 0.7);
      ambIntensity = 0.55 * (1 - t * 0.5);
      hemiIntensity = 0.45 * (1 - t * 0.4);
      sunColor = new THREE.Color(1, 0.7 + t * 0.15, 0.4 + t * 0.2);
      ambColor = new THREE.Color(0x664433);
      hemiColor = new THREE.Color(0x885544);
      sunAngle = Math.PI * 0.7 + t * 0.3;
    } else if (hr >= 20 || hr < 5) {
      intensity = 0.05;
      ambIntensity = 0.08;
      hemiIntensity = 0.06;
      sunColor = new THREE.Color(0x222244);
      ambColor = new THREE.Color(0x111122);
      hemiColor = new THREE.Color(0x222233);
      sunAngle = hr >= 20 ? Math.PI : -Math.PI * 0.3;
    } else {
      const t = (hr - 5) / 1;
      intensity = 0.05 + t * 0.75;
      ambIntensity = 0.08 + t * 0.27;
      hemiIntensity = 0.06 + t * 0.24;
      sunColor = new THREE.Color(0.7 + t * 0.3, 0.4 + t * 0.4, 0.3 + t * 0.3);
      ambColor = new THREE.Color(0x332244);
      hemiColor = new THREE.Color(0x443355);
      sunAngle = -Math.PI * 0.3 + t * 0.8;
    }

    this.sunLight.color.copy(sunColor);
    this.sunLight.intensity = Math.max(0.05, intensity);
    this.sunLight.position.x = Math.cos(sunAngle) * 80;
    this.sunLight.position.y = Math.sin(sunAngle) * 80 + 10;
    this.sunLight.position.z = 30;

    this.ambientLight.color.copy(ambColor);
    this.ambientLight.intensity = Math.max(0.05, ambIntensity);

    this.hemiLight.color.copy(hemiColor);
    this.hemiLight.intensity = Math.max(0.03, hemiIntensity);

    this.updateSky(this.manager.scene);
  }

  spawnCar(scene) {
    const id = CAR_IDS[this.selectedIdx] || CAR_IDS[0];
    const model = this.manager.models[id];
    if (!model) return;
    const startZ = -(ROAD_INN + ROAD_W * 0.3);
    const car = new Car(scene, model, 0, startZ, id);
    this.currentCar = car;
    if (this.selectedColor) {
      const hex = parseInt(this.selectedColor.replace('#', ''), 16);
      car.mesh.traverse(c => { if (c.isMesh && c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(m => { if (m.color && !m.map) m.color.setHex(hex); });
      }});
    }
    this.prevPos = { x: 0, z: startZ };
    car.occupy();
    this.syncHUD();
    this.createHeadlights(scene);
    this.sound.startEngine();
    this.sound.startTire();
    this.createExhaust();
    this.createNitrousFlame();
    this.createSpeedLines();
  }

  createHeadlights(scene) {
    this.headlights.forEach(h => scene.remove(h));
    this.headlights = [];
    if (!this.currentCar) return;
    for (let side of [-0.6, 0.6]) {
      const light = new THREE.SpotLight(0xffffcc, 0, 20, Math.PI / 6, 0.5, 1.5);
      light.target.position.set(0, 0, -5);
      this.currentCar.mesh.add(light);
      this.currentCar.mesh.add(light.target);
      light.position.set(side, 0.4, -1.2);
      this.headlights.push(light);
    }
  }

  clampToRoad(pos) {
    const out = ROAD_OUT - 1.5, inn = ROAD_INN + 1.5, m = 1.5;
    let x = Math.max(-out + m, Math.min(out - m, pos.x));
    let z = Math.max(-out + m, Math.min(out - m, pos.z));
    let clamped = false;
    if (Math.abs(x) < inn - m && Math.abs(z) < inn - m) {
      const dx = Math.abs(x) - (inn - m), dz = Math.abs(z) - (inn - m);
      if (dx > dz) x = Math.sign(x) * (inn - m); else z = Math.sign(z) * (inn - m);
      clamped = true;
    }
    if (pos.x !== x || pos.z !== z) clamped = true;
    return { x, z, clamped };
  }

  checkBuildingCollision(car) {
    const cx = car.mesh.position.x, cz = car.mesh.position.z;
    for (const b of this.buildings) {
      const dx = cx - b.x, dz = cz - b.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < b.r) {
        const push = (b.r - dist + 0.3) * 0.5;
        const nx = dx / (dist || 1), nz = dz / (dist || 1);
        car.mesh.position.x += nx * push;
        car.mesh.position.z += nz * push;
        car.speed *= 0.6;
        if (Math.abs(car.speed) > 10 && this.collisionCooldown <= 0) {
          car.takeDamage(Math.abs(car.speed) * 0.1);
          this.collisionCooldown = 0.4;
        }
        break;
      }
    }
  }

  initMultiplayer(data) {
    import('../services/FirebaseService.js').then(({ db, ref, set, onValue, off }) => {
      const posRef = ref(db, `rooms/${this.roomId}/players/${this.playerId}`);
      this.syncInterval = setInterval(() => {
        if (this.currentCar) set(posRef, {
          x: this.currentCar.mesh.position.x, z: this.currentCar.mesh.position.z,
          rot: this.currentCar.mesh.rotation.y, speed: this.currentCar.speed,
          carIdx: this.selectedIdx, connected: true,
          damage: this.currentCar.damage, fuel: this.currentCar.fuel
        });
      }, 100);
      const allPosRef = ref(db, `rooms/${this.roomId}/players`);
      this.posListener = onValue(allPosRef, (snap) => {
        const players = snap.val(); if (!players) return;
        Object.entries(players).forEach(([pid, p]) => {
          if (pid === this.playerId) return;
          if (!this.ghostCars[pid]) {
            const model = this.manager.models[CAR_IDS[p.carIdx] || CAR_IDS[0]];
            if (model) {
              const ghost = new Car(this.manager.scene, model, p.x || 0, p.z || 0, '');
              ghost.mesh.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.5; } });
              this.ghostCars[pid] = ghost;
            }
          } else {
            const ghost = this.ghostCars[pid];
            ghost.mesh.position.x = p.x || 0; ghost.mesh.position.z = p.z || 0;
            ghost.mesh.rotation.y = p.rot || 0; ghost.speed = p.speed || 0;
          }
        });
        Object.keys(this.ghostCars).forEach(pid => { if (!players[pid]) { this.manager.scene.remove(this.ghostCars[pid].mesh); delete this.ghostCars[pid]; } });
      });
    });
  }

  bindKeys() {
    this._kd = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') this.input.forward = true;
      else if (k === 's' || k === 'arrowdown') this.input.backward = true;
      else if (k === 'a' || k === 'arrowleft') this.input.left = true;
      else if (k === 'd' || k === 'arrowright') this.input.right = true;
      else if (k === ' ') { e.preventDefault(); this.input.boost = true; }
      else if (k === 'v') { e.preventDefault(); this.camZoom = !this.camZoom; }
      else if (k === 'escape') { this.togglePause(); }
    };
    this._ku = (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'arrowup') this.input.forward = false;
      else if (k === 's' || k === 'arrowdown') this.input.backward = false;
      else if (k === 'a' || k === 'arrowleft') this.input.left = false;
      else if (k === 'd' || k === 'arrowright') this.input.right = false;
      else if (k === ' ') this.input.boost = false;
    };
    document.addEventListener('keydown', this._kd);
    document.addEventListener('keyup', this._ku);
  }

  unbindKeys() {
    document.removeEventListener('keydown', this._kd);
    document.removeEventListener('keyup', this._ku);
    document.removeEventListener('mousemove', this._mm);
    document.removeEventListener('mousedown', this._md);
    document.removeEventListener('pointerlockchange', this._plc);
    document.exitPointerLock();
  }

  bindMouse() {
    const domElement = this.manager.renderer.domElement;
    this._md = (e) => {
      if (e.target === domElement || e.target === document.body) {
        domElement.requestPointerLock();
      }
    };
    document.addEventListener('mousedown', this._md);

    this._mm = (e) => {
      if (document.pointerLockElement === domElement || document.pointerLockElement === document.body) {
        this.cameraAngle -= e.movementX * 0.003;
      }
    };
    document.addEventListener('mousemove', this._mm);

    this._plc = () => {};
    document.addEventListener('pointerlockchange', this._plc);
  }

  togglePause() {
    this.paused = !this.paused;
    const el = document.getElementById('pause-menu');
    if (el) el.style.display = this.paused ? 'flex' : 'none';
  }

  createHUD() {
    if (document.getElementById('hud')) return;

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@500;600;700&display=swap');
      #hud * { box-sizing:border-box }
      .hud-panel { background:rgba(0,0,0,0.55); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.08); border-radius:12px }
      .hud-panel-light { background:rgba(0,0,0,0.35); backdrop-filter:blur(6px); border:1px solid rgba(255,255,255,0.06); border-radius:10px }
      .speedo-arc { position:relative; width:140px; height:70px; overflow:hidden }
      .speedo-arc::before { content:''; position:absolute; top:0; left:0; width:100%; height:140px; border-radius:50%; background:conic-gradient(from 0deg, #ff4444 0deg, #ffaa00 60deg, #44ff44 120deg 240deg, #ffaa00 300deg, #ff4444 360deg); mask:radial-gradient(circle at 50% 100%, transparent 55%, #000 55%); -webkit-mask:radial-gradient(circle at 50% 100%, transparent 55%, #000 55%) }
      .speedo-needle { position:absolute; bottom:0; left:50%; width:2px; height:58px; background:linear-gradient(to top, #ff4444, #fff); transform-origin:50% 100%; border-radius:2px; transition:transform 0.15s ease-out; z-index:2 }
      .speedo-center { position:absolute; bottom:-6px; left:50%; transform:translateX(-50%); width:10px; height:10px; background:#ff4444; border-radius:50%; border:2px solid #fff; z-index:3 }
      .speedo-val { font-family:'Orbitron',monospace; font-weight:900; font-size:32px; color:#fff; text-shadow:0 0 20px rgba(68,170,255,0.3); line-height:1 }
      .speedo-unit { font-family:'Rajdhani',sans-serif; font-size:10px; color:#888; letter-spacing:2px; text-transform:uppercase }
      .stat-icon { width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; margin-right:4px }
      .stat-bar { height:4px; border-radius:2px; overflow:hidden; background:rgba(255,255,255,0.1); margin-top:2px }
      .stat-fill { height:100%; border-radius:2px; transition:width 0.3s ease }
      .key-hint { font-family:'Rajdhani',sans-serif; font-size:9px; color:rgba(255,255,255,0.35); letter-spacing:1px }
      .key-hint kbd { display:inline-block; padding:0 5px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); border-radius:3px; font-family:inherit; font-size:8px; color:rgba(255,255,255,0.5) }
      @keyframes dmgFlash { 0%,100%{background-color:transparent} 50%{background-color:rgba(255,0,0,0.15)} }
      .dmg-active { animation:dmgFlash 0.3s ease }
    `;
    document.head.appendChild(style);
    this._hudStyle = style;

    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:100';

    hud.innerHTML = `
      <div style="position:absolute;top:12px;left:12px;display:flex;flex-direction:column;gap:6px">
        <div class="hud-panel" style="padding:8px 14px">
          <div id="hud-car" style="font-family:'Rajdhani',sans-serif;font-size:15px;font-weight:700;color:#44aaff;letter-spacing:1px;text-transform:uppercase"></div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:6px">
            <div class="hud-panel-light" style="padding:6px 10px;display:flex;align-items:center;gap:6px">
              <svg class="stat-icon" viewBox="0 0 16 16" fill="none"><path d="M2 14L4 6h8l2 8" stroke="#ffcc00" stroke-width="1.5" stroke-linecap="round"/><circle cx="5.5" cy="14" r="1.5" fill="#ffcc00"/><circle cx="10.5" cy="14" r="1.5" fill="#ffcc00"/><path d="M6 6V3a1 1 0 011-1h2a1 1 0 011 1v3" stroke="#ffcc00" stroke-width="1.2"/></svg>
              <span style="font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:#ffcc00"><span id="hud-fuel">100</span><span style="font-size:9px;color:#886600">%</span></span>
              <div class="stat-bar" style="width:50px"><div id="hud-fuel-bar" class="stat-fill" style="width:100%;background:#ffcc00"></div></div>
            </div>
            <div class="hud-panel-light" style="padding:6px 10px;display:flex;align-items:center;gap:6px">
              <svg class="stat-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#44ff44" stroke-width="1.5"/><path d="M8 5v3l2 1" stroke="#44ff44" stroke-width="1.5" stroke-linecap="round"/></svg>
              <span style="font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:#44ff44"><span id="hud-damage">0</span><span style="font-size:9px;color:#226622">%</span></span>
              <div class="stat-bar" style="width:50px"><div id="hud-damage-bar" class="stat-fill" style="width:0%;background:#44ff44"></div></div>
            </div>
            <div class="hud-panel-light" style="padding:6px 10px;display:flex;align-items:center;gap:6px">
              <svg class="stat-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#ffcc00" stroke-width="1.5"/><path d="M8 4v5" stroke="#ffcc00" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11" r="1" fill="#ffcc00"/></svg>
              <span style="font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:#ffcc00"><span id="hud-coins">0</span></span>
            </div>
          </div>
          <div id="hud-zone" style="margin-top:4px;font-family:'Rajdhani',sans-serif;font-size:10px;font-weight:600;color:#88ff88;letter-spacing:1px;text-transform:uppercase;min-height:14px"></div>
        </div>
      </div>

      <div style="position:absolute;top:12px;right:12px;display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div class="hud-panel" style="padding:6px 12px">
          <div style="font-family:'Rajdhani',sans-serif;font-size:11px;font-weight:600">
            <span id="hud-time" style="color:#888">00:00</span>
            <span id="hud-time-icon" style="margin-left:4px">☀️</span>
          </div>
        </div>
        <div class="hud-panel" style="padding:6px 12px">
          <div style="font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:#44ff44"><span id="hud-timer">0:00.00</span></div>
          <div style="font-family:'Rajdhani',sans-serif;font-size:9px;color:#888"><span id="hud-laps">0</span> laps &middot; <span id="hud-best">BEST: --</span></div>
        </div>
        ${this.multi ? `<div class="hud-panel" style="padding:6px 12px"><div id="hud-players" style="font-family:'Rajdhani',sans-serif;font-size:10px;color:#888"></div></div>` : ''}
        <button id="hud-share" style="padding:4px 10px;font-size:10px;background:rgba(255,255,255,0.08);color:#888;border:1px solid rgba(255,255,255,0.1);border-radius:6px;cursor:pointer;pointer-events:auto">📤 Share</button>
        <div id="share-toast" style="font-family:'Rajdhani',sans-serif;font-size:10px;color:#44ff44;opacity:0;transition:opacity 0.3s">Link copied!</div>
      </div>

      <div style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:2px">
        <div class="speedo-arc">
          <div class="speedo-needle" id="speedo-needle" style="transform:rotate(-120deg)"></div>
          <div class="speedo-center"></div>
          <div style="position:absolute;bottom:14px;left:50%;transform:translateX(-50%);text-align:center">
            <div class="speedo-val"><span id="hud-speed-val">0</span></div>
            <div class="speedo-unit">km/h</div>
          </div>
        </div>
      </div>

      <div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%)">
        <div class="hud-panel" style="padding:4px 12px">
          <div class="key-hint">
            <kbd>W</kbd> Drive &nbsp;<kbd>A</kbd><kbd>D</kbd> Steer &nbsp;<kbd>Space</kbd> Boost &nbsp;<kbd>V</kbd> Zoom &nbsp;<kbd>Esc</kbd> Pause
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(hud);

    document.body.classList.add('dmg-active');

    const pm = document.createElement('div');
    pm.id = 'pause-menu';
    pm.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);backdrop-filter:blur(10px);z-index:200;font-family:Rajdhani,sans-serif';
    pm.innerHTML = `
      <div style="text-align:center;color:#fff">
        <h1 style="font-size:52px;margin:0 0 6px;font-family:Orbitron,monospace;font-weight:900;color:#fff;text-shadow:0 0 30px rgba(68,170,255,0.3);letter-spacing:4px">PAUSED</h1>
        <div style="width:60px;height:2px;background:linear-gradient(90deg,transparent,#44aaff,transparent);margin:0 auto 24px"></div>
        <button class="pause-btn" data-action="resume" style="background:linear-gradient(135deg,#44aaff,#2266cc)">▶ RESUME</button>
        <button class="pause-btn" data-action="restart">↻ RESTART</button>
        <button class="pause-btn" data-action="select">🏎 CHANGE CAR</button>
        <button class="pause-btn" data-action="menu">⌂ MAIN MENU</button>
      </div>
      <style>
        .pause-btn { display:block; margin:8px auto; padding:12px 50px; font-size:18px; font-weight:600; color:#fff; border:none; border-radius:8px; cursor:pointer; width:240px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); transition:all 0.15s ease; font-family:inherit; letter-spacing:1px }
        .pause-btn:hover { background:rgba(255,255,255,0.15) !important; transform:scale(1.03); border-color:rgba(255,255,255,0.2) }
      </style>
    `;
    pm.querySelectorAll('.pause-btn').forEach(b => {
      b.onclick = () => {
        switch (b.dataset.action) {
          case 'resume': this.paused = false; pm.style.display = 'none'; break;
          case 'restart': this.exit(); this.manager.start('game', { carIdx: this.selectedIdx }); break;
          case 'select': this.exit(); this.manager.start('select'); break;
          case 'menu': this.exit(); this.manager.start('menu'); break;
        }
      };
    });
    document.body.appendChild(pm);

    this.hudEls.car = document.getElementById('hud-car');
    this.hudEls.speed = document.getElementById('hud-speed-val');
    this.hudEls.speedBar = document.getElementById('speedo-needle');
    this.hudEls.fuel = document.getElementById('hud-fuel');
    this.hudEls.fuelBar = document.getElementById('hud-fuel-bar');
    this.hudEls.damage = document.getElementById('hud-damage');
    this.hudEls.damageBar = document.getElementById('hud-damage-bar');
    this.hudEls.zone = document.getElementById('hud-zone');
    this.hudEls.time = document.getElementById('hud-time');
    this.hudEls.timeIcon = document.getElementById('hud-time-icon');
    this.hudEls.players = document.getElementById('hud-players');
    this.hudEls.dmgFlash = document.body;
    this.hudEls.coins = document.getElementById('hud-coins');
    this.hudEls.timer = document.getElementById('hud-timer');
    this.hudEls.laps = document.getElementById('hud-laps');
    this.hudEls.best = document.getElementById('hud-best');

    const shareBtn = document.getElementById('hud-share');
    if (shareBtn) shareBtn.onclick = () => this.shareGame();

    this.showCountdown();
  }

  showCountdown() {
    const c = document.createElement('div');
    c.id = 'countdown';
    c.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:150;pointer-events:none';
    c.innerHTML = '<div id="ct-text" style="font-family:Orbitron,monospace;font-weight:900;font-size:100px;color:#fff;text-shadow:0 0 40px rgba(68,170,255,0.5);opacity:0;transform:scale(0.5);transition:all 0.25s ease">3</div>';
    document.body.appendChild(c);
    const el = document.getElementById('ct-text');
    const steps = ['3', '2', '1', 'GO!'];
    let i = 0;
    const show = () => {
      if (i >= steps.length) { c.remove(); return; }
      el.textContent = steps[i];
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
      const size = steps[i] === 'GO!' ? '80px' : '100px';
      el.style.fontSize = steps[i] === 'GO!' ? '80px' : '100px';
      el.style.color = steps[i] === 'GO!' ? '#44ff44' : '#fff';
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'scale(1.5)';
        i++;
        setTimeout(show, 200);
      }, 600);
    };
    setTimeout(show, 300);
  }

  syncHUD() {
    if (this.hudEls.car && this.currentCar) this.hudEls.car.textContent = (this.multi ? '🌐 ' : '') + this.currentCar.name.toUpperCase();
  }

  update(dt) {
    if (this.paused || !this.currentCar) return;

    this.sound.resume();
    this.updateLighting(dt);

    const isNight = this.dayTime >= 20 || this.dayTime < 5;
    this.headlights.forEach(l => l.intensity = isNight ? 8 : 0);

    const car = this.currentCar;
    const mergedInput = {
      forward: this.input.forward || this.touchInput.forward,
      backward: this.input.backward || this.touchInput.backward,
      left: this.input.left || this.touchInput.left,
      right: this.input.right || this.touchInput.right,
      boost: this.input.boost || this.touchInput.boost
    };
    car.boost = mergedInput.boost;
    car.drive(mergedInput, dt);

    const result = this.clampToRoad(car.mesh.position);
    if (result.clamped) {
      car.mesh.position.x = result.x;
      car.mesh.position.z = result.z;
      if (Math.abs(car.speed) > 15 && this.collisionCooldown <= 0) {
        car.takeDamage(Math.abs(car.speed) * 0.08);
        this.collisionCooldown = 0.3;
        this.sound.playCollision(Math.min(1, Math.abs(car.speed) / 50));
        this.shakeScreen(0.3, 0.15);
      }
    }

    this.checkBuildingCollision(car);
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);

    this.inRepairZone = false;
    this.inFuelZone = false;
    if (this.repairZones) {
      this.repairZones.forEach(zone => {
        const d = Math.sqrt((car.mesh.position.x - zone.x) ** 2 + (car.mesh.position.z - zone.z) ** 2);
        if (d < zone.r) { this.inRepairZone = true; if (car.damage > 0) car.repair(15 * dt); }
      });
    }
    if (this.fuelZones) {
      this.fuelZones.forEach(zone => {
        const d = Math.sqrt((car.mesh.position.x - zone.x) ** 2 + (car.mesh.position.z - zone.z) ** 2);
        if (d < zone.r) { this.inFuelZone = true; if (car.fuel < car.maxFuel) car.addFuel(20 * dt); }
      });
    }

    this.prevPos.x = car.mesh.position.x;
    this.prevPos.z = car.mesh.position.z;

    const camDist = this.camZoom ? 5 : this.cameraOrbitDistance;
    const camHeight = this.camZoom ? 2 : this.cameraOrbitHeight;

    const dirX = -Math.sin(this.cameraAngle);
    const dirZ = -Math.cos(this.cameraAngle);
    this.cameraTarget.set(car.mesh.position.x, camHeight * 0.3, car.mesh.position.z);
    const targetCamPos = new THREE.Vector3(
      car.mesh.position.x + dirX * camDist,
      camHeight,
      car.mesh.position.z + dirZ * camDist
    );
    this.manager.camera.position.lerp(targetCamPos, 0.06);
    this.manager.camera.lookAt(this.cameraTarget);

    this.applyScreenShake();

    this.coinUpdate(dt);
    this.driftUpdate(dt);
    this.updateExhaust(dt);
    this.updateNitrous(dt);
    this.timeTrialUpdate(dt);
    this.drawMinimap();

    const maxSpd = car.boost ? CONFIG.car.maxSpeed * CONFIG.car.boostMultiplier : CONFIG.car.maxSpeed;
    const spd = Math.round(Math.abs(car.speed) * 3.6);
    const pct = Math.min(100, (Math.abs(car.speed) / maxSpd) * 100);

    this.sound.startEngine();
    this.sound.updateEngine(Math.abs(car.speed), maxSpd);
    this.updateSpeedLines(Math.abs(car.speed), maxSpd);

    if (this.hudEls.speed) this.hudEls.speed.textContent = spd;
    if (this.hudEls.speedBar) {
      const sAngle = -120 + (pct / 100) * 240;
      this.hudEls.speedBar.style.transform = `rotate(${sAngle}deg)`;
    }
    if (this.hudEls.fuel) {
      const f = Math.round(car.fuel);
      this.hudEls.fuel.textContent = f;
      if (this.hudEls.fuelBar) this.hudEls.fuelBar.style.width = f + '%';
    }
    if (this.hudEls.damage) {
      const d = Math.round(car.damage);
      this.hudEls.damage.textContent = d;
      if (this.hudEls.damageBar) {
        this.hudEls.damageBar.style.width = d + '%';
        this.hudEls.damageBar.style.background = d < 30 ? '#44ff44' : d < 60 ? '#ffaa44' : '#ff4444';
      }
      if (d > 50 && this.hudEls.dmgFlash) {
        this.hudEls.dmgFlash.classList.remove('dmg-active');
        void this.hudEls.dmgFlash.offsetWidth;
        this.hudEls.dmgFlash.classList.add('dmg-active');
      }
    }
    if (this.hudEls.zone) {
      if (this.inRepairZone) this.hudEls.zone.textContent = '● REPAIRING';
      else if (this.inFuelZone) this.hudEls.zone.textContent = '● REFUELING';
      else this.hudEls.zone.textContent = '';
    }
    if (this.hudEls.time) {
      const h = Math.floor(this.dayTime);
      const m = Math.floor((this.dayTime - h) * 60);
      this.hudEls.time.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      if (this.hudEls.timeIcon) this.hudEls.timeIcon.textContent = isNight ? '🌙' : '☀️';
    }
    if (this.hudEls.players) this.hudEls.players.textContent = '👥 ' + Object.keys(this.ghostCars).length + ' player(s)';
  }

  bindTouch() {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isMobile) return;
    const c = (id) => document.getElementById(id);

    const tc = document.createElement('div');
    tc.id = 'touch-controls';
    tc.style.cssText = 'position:fixed;inset:0;z-index:90;touch-action:none;display:flex;pointer-events:none';
    tc.innerHTML = `
      <div id="tc-left" style="flex:1;pointer-events:auto;position:relative">
        <div id="tc-pad" style="position:absolute;bottom:60px;left:30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.08);border:2px solid rgba(255,255,255,0.12)"></div>
      </div>
      <div id="tc-right" style="flex:1;pointer-events:auto;position:relative">
        <div id="tc-gas" style="position:absolute;bottom:60px;right:70px;width:64px;height:64px;border-radius:50%;background:rgba(68,170,255,0.2);border:2px solid rgba(68,170,255,0.3);display:flex;align-items:center;justify-content:center;color:#44aaff;font-size:22px;font-weight:bold">▲</div>
        <div id="tc-boost" style="position:absolute;bottom:60px;right:10px;width:50px;height:50px;border-radius:50%;background:rgba(255,107,53,0.2);border:2px solid rgba(255,107,53,0.3);display:flex;align-items:center;justify-content:center;color:#ff6b35;font-size:14px;font-weight:bold">BOOST</div>
        <div id="tc-brake" style="position:absolute;bottom:140px;right:70px;width:64px;height:64px;border-radius:50%;background:rgba(255,50,50,0.2);border:2px solid rgba(255,50,50,0.3);display:flex;align-items:center;justify-content:center;color:#ff4444;font-size:22px;font-weight:bold">▼</div>
      </div>
    `;
    document.body.appendChild(tc);

    const touchState = { left: false, right: false, gas: false, brake: false, boost: false };
    const setTouch = (key, val) => {
      touchState[key] = val;
      this.touchInput.forward = touchState.gas;
      this.touchInput.backward = touchState.brake;
      this.touchInput.left = touchState.left;
      this.touchInput.right = touchState.right;
      this.touchInput.boost = touchState.boost;
    };

    const bindArea = (id, key) => {
      const el = c(id);
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); setTouch(key, true); }, { passive: false });
      el.addEventListener('touchend', (e) => { e.preventDefault(); setTouch(key, false); }, { passive: false });
      el.addEventListener('touchcancel', (e) => { setTouch(key, false); });
    };
    bindArea('tc-gas', 'gas');
    bindArea('tc-brake', 'brake');
    bindArea('tc-boost', 'boost');

    c('tc-pad').addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const r = c('tc-pad').getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = t.clientX - cx, dy = t.clientY - cy;
      setTouch('left', dx < -10);
      setTouch('right', dx > 10);
      this._touchId = t.identifier;
    }, { passive: false });
    c('tc-pad').addEventListener('touchmove', (e) => {
      e.preventDefault();
      let t = null;
      for (let i = 0; i < e.touches.length; i++) { if (e.touches[i].identifier === this._touchId) { t = e.touches[i]; break; } }
      if (!t) return;
      const r = c('tc-pad').getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const dx = t.clientX - cx;
      setTouch('left', dx < -10);
      setTouch('right', dx > 10);
    }, { passive: false });
    c('tc-pad').addEventListener('touchend', (e) => { setTouch('left', false); setTouch('right', false); });
    c('tc-pad').addEventListener('touchcancel', (e) => { setTouch('left', false); setTouch('right', false); });

    this._touchControls = tc;
  }

  initCheckpoints() {
    const inn = ROAD_INN, rw = ROAD_W;
    const offsets = [-(inn + rw / 2), 0, (inn + rw / 2), 0];
    const offz = [0, -(inn + rw / 2), 0, (inn + rw / 2)];
    for (let i = 0; i < 4; i++) {
      this.checkpoints.push({ x: offsets[i], z: offz[i], r: 15, passed: false });
    }
  }

  spawnCoins() {
    const inn = ROAD_INN, out = ROAD_OUT;
    for (let i = 0; i < 30; i++) {
      const side = Math.floor(Math.random() * 4);
      let x, z;
      const halfRw = ROAD_W / 2 - 4;
      if (side === 0) { x = -(inn + ROAD_W / 2) + (Math.random() - 0.5) * ROAD_W; z = -(inn + halfRw); }
      else if (side === 1) { x = (inn + ROAD_W / 2) + (Math.random() - 0.5) * ROAD_W; z = (inn + halfRw); }
      else if (side === 2) { x = -(inn + halfRw); z = -(inn + ROAD_W / 2) + (Math.random() - 0.5) * ROAD_W; }
      else { x = (inn + halfRw); z = (inn + ROAD_W / 2) + (Math.random() - 0.5) * ROAD_W; }
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8),
        new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.2 })
      );
      coin.position.set(x, 0.3, z);
      coin.rotation.x = Math.PI / 2;
      coin.userData.collected = false;
      this.manager.scene.add(coin);
      this.sceneObjects.push(coin);
      this.coins.push({ mesh: coin, x, z, collected: false });
    }
  }

  createMinimap() {
    const mm = document.createElement('canvas');
    mm.id = 'minimap';
    mm.width = 140;
    mm.height = 140;
    mm.style.cssText = 'position:fixed;bottom:90px;right:12px;z-index:101;border-radius:50%;border:2px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.5)';
    document.body.appendChild(mm);
    this.minimapCtx = mm.getContext('2d');
    this._minimapEl = mm;
  }

  drawMinimap() {
    if (!this.minimapCtx || !this.currentCar) return;
    const ctx = this.minimapCtx;
    const w = 140, h = 140, cx = w / 2, cy = h / 2;
    const scale = 0.18;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, 68, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - ROAD_OUT * scale, cy - ROAD_OUT * scale, ROAD_OUT * 2 * scale, ROAD_OUT * 2 * scale);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeRect(cx - ROAD_INN * scale, cy - ROAD_INN * scale, ROAD_INN * 2 * scale, ROAD_INN * 2 * scale);

    this.buildings.forEach(b => {
      if (b.r < 6) return;
      ctx.fillStyle = 'rgba(255,200,100,0.4)';
      ctx.fillRect(cx + b.x * scale - 1, cy + b.z * scale - 1, 3, 3);
    });

    this.coins.forEach(c => {
      if (c.collected) return;
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(cx + c.x * scale, cy + c.z * scale, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    const px = this.currentCar.mesh.position.x * scale;
    const pz = this.currentCar.mesh.position.z * scale;
    ctx.fillStyle = '#44aaff';
    ctx.beginPath();
    ctx.arc(cx + px, cy + pz, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const angle = this.currentCar.mesh.rotation.y;
    ctx.strokeStyle = '#44aaff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + px, cy + pz);
    ctx.lineTo(cx + px + Math.sin(angle) * 8, cy + pz + Math.cos(angle) * 8);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, 10);
  }

  coinUpdate(dt) {
    if (!this.currentCar) return;
    const cx = this.currentCar.mesh.position.x, cz = this.currentCar.mesh.position.z;
    this.coins.forEach(c => {
      if (c.collected) return;
      c.mesh.rotation.z += dt * 3;
      const d = Math.sqrt((cx - c.x) ** 2 + (cz - c.z) ** 2);
      if (d < 3) {
        c.collected = true;
        c.mesh.visible = false;
        this.coinCount++;
        this.sound.playCoin();
        if (this.hudEls.coins) this.hudEls.coins.textContent = this.coinCount;
      }
    });
  }

  driftUpdate(dt) {
    if (!this.currentCar) return;
    const car = this.currentCar;
    const speed = Math.abs(car.speed);
    const turning = this.input.left || this.input.right;
    const drifting = speed > 15 && turning;
    this.driftCooldown = Math.max(0, this.driftCooldown - dt);

    if (drifting && !this.driftActive && this.driftCooldown <= 0) {
      this.driftActive = true;
      this.driftScore += Math.round(speed * 0.5);
      this.sound.playDrift();
      this.showDriftFlash();
      this.driftCooldown = 0.5;
    } else if (!drifting) {
      this.driftActive = false;
    }

    this.sound.updateTire(drifting ? Math.min(1, (speed - 15) / 30) : 0);
    if (!drifting) this.sound.stopTire();
  }

  showDriftFlash() {
    const el = document.getElementById('drift-flash');
    if (el) { el.remove(); }
    const d = document.createElement('div');
    d.id = 'drift-flash';
    d.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:160;pointer-events:none;font-family:Orbitron,monospace;font-weight:900;font-size:48px;color:#ff6b35;text-shadow:0 0 30px rgba(255,107,53,0.6);opacity:1;transition:opacity 0.4s ease`;
    d.textContent = 'DRIFT!';
    document.body.appendChild(d);
    document.getElementById('hud-coins').textContent = this.coinCount;
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 500); }, 200);
  }

  shakeScreen(intensity, duration) {
    this.screenShake = { intensity, duration };
  }

  applyScreenShake() {
    if (this.screenShake.duration <= 0) return;
    const shake = this.screenShake;
    const dx = (Math.random() - 0.5) * shake.intensity;
    const dy = (Math.random() - 0.5) * shake.intensity;
    this.manager.camera.position.x += dx;
    this.manager.camera.position.y += dy;
    shake.duration -= 0.016;
  }

  createSpeedLines() {
    this._speedLineContainer = document.createElement('div');
    this._speedLineContainer.id = 'speed-lines';
    this._speedLineContainer.style.cssText = 'position:fixed;inset:0;z-index:85;pointer-events:none;overflow:hidden';
    document.body.appendChild(this._speedLineContainer);
    for (let i = 0; i < 15; i++) {
      const line = document.createElement('div');
      line.style.cssText = `position:absolute;width:2px;height:${20 + Math.random() * 40}px;background:linear-gradient(to bottom,transparent,rgba(255,255,255,${0.1 + Math.random() * 0.15}));left:${Math.random() * 100}%;top:${Math.random() * 100}%;opacity:0;transition:opacity 0.1s`;
      this._speedLineContainer.appendChild(line);
      this.speedLines.push(line);
    }
  }

  updateSpeedLines(speed, maxSpeed) {
    const pct = Math.min(1, Math.abs(speed) / maxSpeed);
    const show = pct > 0.5;
    this.speedLines.forEach((line, i) => {
      line.style.opacity = show ? String((pct - 0.5) * 2 * (0.3 + (i / this.speedLines.length) * 0.3)) : '0';
      if (show) {
        const top = parseFloat(line.style.top) || 0;
        line.style.top = (top + pct * 8) % 100 + '%';
      }
    });
  }

  createExhaust() {
    this._exhaustParticles = [];
    for (let i = 0; i < 20; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0 })
      );
      this.manager.scene.add(p);
      this.sceneObjects.push(p);
      this._exhaustParticles.push({ mesh: p, life: 0, maxLife: 0 });
    }
  }

  updateExhaust(dt) {
    if (!this.currentCar || !this._exhaustParticles) return;
    const car = this.currentCar;
    const speed = Math.abs(car.speed);
    const show = speed > 5;
    const carPos = car.mesh.position;
    const angle = car.mesh.rotation.y;
    const backX = carPos.x - Math.sin(angle) * 1.5;
    const backZ = carPos.z - Math.cos(angle) * 1.5;

    this._exhaustParticles.forEach(p => {
      if (p.life <= 0) {
        if (show && Math.random() < 0.3) {
          p.mesh.position.set(backX + (Math.random() - 0.5) * 0.2, 0.1 + Math.random() * 0.1, backZ + (Math.random() - 0.5) * 0.2);
          p.life = 0.3 + Math.random() * 0.4;
          p.maxLife = p.life;
          p.mesh.material.opacity = 0.3;
          p.mesh.scale.set(1, 1, 1);
        }
      }
      if (p.life > 0) {
        p.life -= dt;
        const t = p.life / p.maxLife;
        p.mesh.material.opacity = t * 0.3;
        p.mesh.position.y += dt * 0.1;
        p.mesh.position.x += Math.sin(angle) * speed * dt * 0.3;
        p.mesh.position.z += Math.cos(angle) * speed * dt * 0.3;
        p.mesh.scale.setScalar(1 + (1 - t) * 2);
      }
    });
  }

  createNitrousFlame() {
    const g = new THREE.BoxGeometry(0.4, 0.3, 0.8);
    const m = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0 });
    this.nitrousFlame = new THREE.Mesh(g, m);
    this.manager.scene.add(this.nitrousFlame);
    this.sceneObjects.push(this.nitrousFlame);
  }

  updateNitrous(dt) {
    if (!this.nitrousFlame || !this.currentCar) return;
    const car = this.currentCar;
    const angle = car.mesh.rotation.y;
    const boost = this.input.boost || this.touchInput.boost;
    if (boost && Math.abs(car.speed) > 5) {
      this.nitrousFlame.position.set(
        car.mesh.position.x - Math.sin(angle) * 1.8,
        0.1,
        car.mesh.position.z - Math.cos(angle) * 1.8
      );
      this.nitrousFlame.rotation.y = angle;
      this.nitrousFlame.material.opacity = 0.4 + Math.random() * 0.3;
      this.nitrousFlame.scale.set(1, 1, 0.8 + Math.random() * 0.4);
      this.nitrousFlame.material.color.setHex(Math.random() < 0.5 ? 0xff4400 : 0xffaa00);
    } else {
      this.nitrousFlame.material.opacity = 0;
    }
  }

  timeTrialUpdate(dt) {
    if (!this.currentCar || this.paused) return;
    this.timer += dt;
    const carPos = this.currentCar.mesh.position;
    if (this.hudEls.timer) {
      const mins = Math.floor(this.timer / 60);
      const secs = Math.floor(this.timer % 60);
      const ms = Math.floor((this.timer % 1) * 100);
      this.hudEls.timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    const chk = this.checkpoints[this.checkpointIdx];
    if (chk) {
      const d = Math.sqrt((carPos.x - chk.x) ** 2 + (carPos.z - chk.z) ** 2);
      if (d < chk.r && !chk.passed) {
        chk.passed = true;
        this.checkpointIdx++;
        if (this.checkpointIdx >= this.checkpoints.length) {
          if (this.bestTime === 0 || this.timer < this.bestTime) {
            this.bestTime = this.timer;
            localStorage.setItem('bestTime', String(this.bestTime));
          }
          this.lapCount++;
          this.checkpoints.forEach(c => c.passed = false);
          this.checkpointIdx = 0;
          this.timer = 0;
          if (this.hudEls.laps) this.hudEls.laps.textContent = this.lapCount;
          if (this.hudEls.best) {
            const bt = this.bestTime;
            const m = Math.floor(bt / 60), s = Math.floor(bt % 60), ms = Math.floor((bt % 1) * 100);
            this.hudEls.best.textContent = `BEST: ${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
          }
        }
      }
    }
  }

  shareGame() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: 'Open World Drive', text: 'Race with me!', url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        const el = document.getElementById('share-toast');
        if (el) { el.style.opacity = '1'; setTimeout(() => el.style.opacity = '0', 1500); }
      }).catch(() => {});
    }
  }

  exit() {
    this.unbindKeys();
    this.sound.stopEngine();
    if (this._touchControls) this._touchControls.remove();
    if (this._speedLineContainer) this._speedLineContainer.remove();
    if (this._minimapEl) this._minimapEl.remove();
    if (this.syncInterval) { clearInterval(this.syncInterval); this.syncInterval = null; }
    if (this.posListener) { import('../services/FirebaseService.js').then(({ db, ref, off }) => off(ref(db, `rooms/${this.roomId}/players`), this.posListener)); }
    if (this.multi && this.roomId && this.playerId) {
      import('../services/FirebaseService.js').then(({ db, ref, remove, get }) => {
        remove(ref(db, `rooms/${this.roomId}/players/${this.playerId}`));
        get(ref(db, `rooms/${this.roomId}/players`)).then((snap) => { if (!snap.exists()) remove(ref(db, `rooms/${this.roomId}`)); });
      });
    }
    this.headlights.forEach(h => { if (h.parent) h.parent.remove(h); if (h.target?.parent) h.target.parent.remove(h.target); });
    this.headlights = [];
    if (this.currentCar) { this.manager.scene.remove(this.currentCar.mesh); this.currentCar = null; }
    Object.values(this.ghostCars).forEach(g => this.manager.scene.remove(g.mesh));
    this.ghostCars = {};
    for (const obj of this.sceneObjects) this.manager.scene.remove(obj);
    this.sceneObjects = [];
    this.buildings = [];
    this.coins = [];
    this.manager.scene.background = null;
    this.manager.scene.fog = null;
    const hud = document.getElementById('hud'); if (hud) hud.remove();
    const pm = document.getElementById('pause-menu'); if (pm) pm.remove();
    const ct = document.getElementById('countdown'); if (ct) ct.remove();
    const df = document.getElementById('drift-flash'); if (df) df.remove();
    if (this._hudStyle) this._hudStyle.remove();
  }
}
