import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Car } from '../entities/Car.js';
import { SoundService } from '../services/SoundService.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const CAR_IDS = [
  'race', 'race-future', 'sedan-sports', 'hatchback-sports',
  'suv-luxury', 'sedan', 'suv', 'truck', 'police', 'taxi'
];

const TILE = 8;
const ROAD_EDGE = CONFIG.road.edgeHalf;
const ROAD_W = CONFIG.road.width;
const ROAD_HALF = ROAD_W / 2;
const LANE_W = CONFIG.road.laneWidth;
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
    this._motes = [];
    this._motesGeo = null;
    this._motesMat = null;
    this._moteTime = 0;
    this.speedLines = [];
    this.nitrousFlame = null;
    this.sensitivity = 0.003;
    this.touchInput = { forward: false, backward: false, left: false, right: false, boost: false };
    this.minimapCtx = null;
    this.timer = 0;
    this.bestTime = parseFloat(localStorage.getItem('bestTime') || '0');
    this.lapCount = 0;
    this.checkpointIdx = 0;
    this.checkpoints = [];
    this.speedTraps = [];
    this.driftZones = [];
    this.topSpeedRecord = 0;
    this.driftZoneScore = 0;
    this._raycaster = new THREE.Raycaster();
    this._targetFov = 60;
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
    this.sound.init();
    this.topSpeedRecord = 0;
    this.driftZoneScore = 0;
    this.isCreative = !!(data && data.mode === 'creative');
    this.selectedDisplayName = data?.displayName || CONFIG.cars[CAR_IDS[this.selectedIdx]] || CAR_IDS[this.selectedIdx];
    this.buildScene();
    this.bindKeys();
    this.bindMouse();
    this.bindTouch();
    this.createHUD();
    this.createMinimap();
    this.spawnCoins();
    this.initCheckpoints();
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
    this.createDustMotes();
    this.buildCharacters(scene);
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
    const e = ROAD_EDGE, h = ROAD_HALF, rw = ROAD_W;
    const asphaltMat = new THREE.MeshStandardMaterial({ map: this.makeAsphaltTex(), roughness: 0.9, metalness: 0.01 });

    const makeRoadGeo = (w, l) => {
      const geo = new THREE.PlaneGeometry(w, l, 16, 16);
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      const ux = w / 8, uz = l / 8;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ux, uv.getY(i) * uz);
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 0.6) * Math.cos(pos.getY(i) * 0.45) * 0.02);
      geo.computeVertexNormals();
      return geo;
    };

    const rd = (x, z, w, l) => {
      const m = new THREE.Mesh(makeRoadGeo(w, l), asphaltMat);
      m.position.set(x, 0.05, z);
      m.rotation.x = -Math.PI / 2;
      m.receiveShadow = true;
      m.castShadow = true;
      this.addObj(m);
    };

    const q = e - h;
    const sl = q * 2;
    rd(0, -e, sl, rw);
    rd(0, e, sl, rw);
    rd(-e, 0, rw, sl);
    rd(e, 0, rw, sl);
    rd(-e, -e, rw, rw);
    rd(e, -e, rw, rw);
    rd(-e, e, rw, rw);
    rd(e, e, rw, rw);
    rd(0, 0, rw, sl);
    rd(-(q + h) / 2, 0, q - h, rw);
    rd((q + h) / 2, 0, q - h, rw);

    const plazaMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.85, metalness: 0.02 });
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(rw * 0.95, 32), plazaMat);
    plaza.position.set(0, 0.06, 0); plaza.rotation.x = -Math.PI / 2; this.addObj(plaza);
    const plazaRing = new THREE.Mesh(new THREE.RingGeometry(rw * 0.75, rw * 0.8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    plazaRing.position.set(0, 0.09, 0); plazaRing.rotation.x = -Math.PI / 2; this.addObj(plazaRing);

    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const dashH = new THREE.PlaneGeometry(3, 0.35);
    const dashV = new THREE.PlaneGeometry(0.35, 3);
    const dashY = 0.08;
    const addDashes = (cx, cz, horizontal, segments) => {
      segments.forEach(([a, b]) => {
        const dashLen = 3.5, gap = 4.5;
        const count = Math.floor((b - a) / (dashLen + gap));
        for (let i = 0; i < count; i++) {
          const t = a + i * (dashLen + gap) + dashLen / 2;
          const d = new THREE.Mesh(horizontal ? dashH : dashV, yellowMat);
          d.position.set(horizontal ? cx + t : cx, dashY, horizontal ? cz : cz + t);
          d.rotation.x = -Math.PI / 2;
          this.addObj(d);
        }
      });
    };
    const dashSegs = [[-(q - 40), -30], [30, q - 40]];
    addDashes(0, 0, false, dashSegs);
    addDashes(0, 0, true, dashSegs);
    addDashes(0, -e, true, dashSegs);
    addDashes(0, e, true, dashSegs);
    addDashes(-e, 0, false, dashSegs);
    addDashes(e, 0, false, dashSegs);

    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const edgeH = new THREE.PlaneGeometry(1, 0.28);
    const edgeV = new THREE.PlaneGeometry(0.28, 1);
    const edgeY = 0.075;
    const addEdgeLines = (cx, cz, horizontal, a, b) => {
      const len = b - a;
      for (const side of [-1, 1]) {
        const d = new THREE.Mesh(horizontal ? edgeH : edgeV, whiteMat);
        const off = side * (h - 0.6);
        const mx = horizontal ? cx + (a + b) / 2 : cx + off;
        const mz = horizontal ? cz + off : cz + (a + b) / 2;
        d.position.set(mx, edgeY, mz);
        d.rotation.x = -Math.PI / 2;
        if (horizontal) d.scale.x = len; else d.scale.z = len;
        this.addObj(d);
      }
    };
    addEdgeLines(0, -e, true, -q, q);
    addEdgeLines(0, e, true, -q, q);
    addEdgeLines(-e, 0, false, -q, q);
    addEdgeLines(e, 0, false, -q, q);
    addEdgeLines(0, 0, false, -q, q);
    addEdgeLines(0, 0, true, -q, q);

    const clearMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
    const addCrosswalk = (cx, cz, horizontal) => {
      const geo = horizontal ? new THREE.PlaneGeometry(rw - 3, 0.5) : new THREE.PlaneGeometry(0.5, rw - 3);
      for (const o of [-0.8, 0, 0.8]) {
        const d = new THREE.Mesh(geo, clearMat);
        d.position.set(horizontal ? cx : cx + o, 0.085, horizontal ? cz + o : cz);
        d.rotation.x = -Math.PI / 2;
        this.addObj(d);
      }
    };
    addCrosswalk(0, -e, true);
    addCrosswalk(0, -e, false);
    addCrosswalk(0, e, true);
    addCrosswalk(0, e, false);
    addCrosswalk(-e, 0, true);
    addCrosswalk(-e, 0, false);
    addCrosswalk(e, 0, true);
    addCrosswalk(e, 0, false);

    const SW = 5;
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.75, metalness: 0.02 });
    const ri = e - h - SW / 2;
    const co = h + SW / 2;
    const ro = e + h + SW / 2;
    const inner = e - h;
    const addSW = (horizontal, fixed, segs) => {
      segs.forEach(([a, b]) => {
        const len = b - a;
        const cx = horizontal ? (a + b) / 2 : fixed;
        const cz = horizontal ? fixed : (a + b) / 2;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? len : SW, horizontal ? SW : len), sidewalkMat);
        m.position.set(cx, 0.07, cz);
        m.rotation.x = -Math.PI / 2;
        m.receiveShadow = true;
        this.addObj(m);
      });
    };
    addSW(true, -ri, [[-inner, -30], [30, inner]]);
    addSW(true, ri, [[-inner, -30], [30, inner]]);
    addSW(false, -ri, [[-inner, -30], [30, inner]]);
    addSW(false, ri, [[-inner, -30], [30, inner]]);
    addSW(false, -co, [[-inner, -co - 0.5], [co + 0.5, inner]]);
    addSW(false, co, [[-inner, -co - 0.5], [co + 0.5, inner]]);
    addSW(true, -co, [[-inner, -co - 0.5], [co + 0.5, inner]]);
    addSW(true, co, [[-inner, -co - 0.5], [co + 0.5, inner]]);
    addSW(true, -ro, [[-ro + 4, ro - 4]]);
    addSW(true, ro, [[-ro + 4, ro - 4]]);
    addSW(false, -ro, [[-ro + 4, ro - 4]]);
    addSW(false, ro, [[-ro + 4, ro - 4]]);

    const curbMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.05 });
    const cb = (horizontal, fixed, a, b) => {
      const len = b - a;
      const m = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? len : 0.4, 0.22, horizontal ? 0.4 : len), curbMat);
      m.position.set(horizontal ? (a + b) / 2 : fixed, 0.11, horizontal ? fixed : (a + b) / 2);
      m.castShadow = true;
      this.addObj(m);
    };
    cb(true, -(e + h + 0.1), -e + 6, e - 6);
    cb(true, e + h + 0.1, -e + 6, e - 6);
    cb(false, -(e + h + 0.1), -e + 6, e - 6);
    cb(false, e + h + 0.1, -e + 6, e - 6);

    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.6, metalness: 0.1 });
    const barrierGeo = new THREE.BoxGeometry(0.15, 0.9, 2);
    const barrierTopGeo = new THREE.BoxGeometry(2.5, 0.15, 0.5);
    const barrierTopMat = new THREE.MeshStandardMaterial({ color: 0xff6666, roughness: 0.5, metalness: 0.2 });
    const addBarrier = (cx, cz, length, horizontal) => {
      const count = Math.floor(length / 2);
      for (let i = 0; i < count; i++) {
        const t = -length / 2 + i * 2 + 1;
        const x = horizontal ? cx + t : cx;
        const z = horizontal ? cz : cz + t;
        const b = new THREE.Mesh(barrierGeo, barrierMat);
        b.position.set(x, 0.45, z); b.castShadow = true; this.addObj(b);
        const bt = new THREE.Mesh(barrierTopGeo, barrierTopMat);
        bt.position.set(x, 0.95, z); bt.rotation.x = -Math.PI / 2; this.addObj(bt);
      }
    };
    const bb = e + h + SW + 2;
    addBarrier(0, -bb, e * 2 - 40, true);
    addBarrier(0, bb, e * 2 - 40, true);
    addBarrier(-bb, 0, e * 2 - 40, false);
    addBarrier(bb, 0, e * 2 - 40, false);

    const streetLightMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4, metalness: 0.6 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.8 });
    const lightGeo = new THREE.SphereGeometry(0.35, 8, 8);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffaa, emissiveIntensity: 0.8 });
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 5, 6);
    const armGeo = new THREE.BoxGeometry(0.5, 0.1, 0.1);
    const addStreetLight = (x, z, side) => {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 2.5, z); pole.castShadow = true; this.addObj(pole);
      const arm = new THREE.Mesh(armGeo, streetLightMat);
      arm.position.set(x, 4.8, z); arm.rotation.z = -side * 0.3; this.addObj(arm);
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(x + side * 0.3, 4.9, z); this.addObj(light);
      const pl = new THREE.PointLight(0xffffcc, 2, 15);
      pl.position.set(x + side * 0.3, 4.9, z);
      this.addObj(pl);
    };
    for (let side = -1; side <= 1; side += 2) {
      for (let x = -(e - 60); x <= e - 60; x += 120) {
        addStreetLight(x, side * (inner - 0.5), -side);
      }
    }
    for (let side = -1; side <= 1; side += 2) {
      for (let z = -(e - 80); z <= e - 80; z += 180) {
        addStreetLight(side * (h + 0.5), z, -side);
      }
    }
  }

  makeAsphaltTex() {
    const s = 512, c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, s, s);

    const img = ctx.getImageData(0, 0, s, s);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 50 + Math.random() * 35 | 0;
      d[i] = v; d[i + 1] = v; d[i + 2] = v;
    }
    for (let y = 0; y < s; y += 64) {
      for (let x = 0; x < s; x += 64) {
        for (let dy = 0; dy < 64; dy++) {
          for (let dx = 0; dx < 64; dx++) {
            const idx = ((y + dy) * s + (x + dx)) * 4;
            const noise = (Math.random() - 0.5) * 20;
            d[idx] = Math.max(0, Math.min(255, d[idx] + noise));
            d[idx + 1] = Math.max(0, Math.min(255, d[idx + 1] + noise));
            d[idx + 2] = Math.max(0, Math.min(255, d[idx + 2] + noise));
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    ctx.strokeStyle = 'rgba(200,200,200,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < s; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

   buildCity(scene) {
     const ct = this.manager.cityModels;
     if (!ct) return;

     const buildingNames = Object.keys(ct).filter(n => n.startsWith('building-') || n.startsWith('low-detail-building'));
     if (buildingNames.length < 2) { buildingNames.length = 0; buildingNames.push('building-a', 'building-c'); }

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
     const e = ROAD_EDGE, h = ROAD_HALF;
     const SW = 5;
     const off = h + SW + TILE / 2;
     const range = e - h - SW - TILE / 2;
     const run = range - 40;
     const step = 64;

     const addBuilding = (x, z, sc) => {
       const name = buildingNames[Math.floor(Math.random() * buildingNames.length)];
       const rot = orients[Math.floor(Math.random() * orients.length)];
       const mesh = place(name, x, z, rot, sc);
       if (mesh) this.buildings.push({ mesh, x, z, r: sc * 0.75 });
     };

     for (const side of [-1, 1]) {
       for (let t = -run; t <= run; t += step) {
         const sc = TILE + (Math.random() - 0.5) * 4;
         addBuilding(side * off + (Math.random() - 0.5) * 4, t + (Math.random() - 0.5) * 4, sc);
         addBuilding(t + (Math.random() - 0.5) * 4, side * off + (Math.random() - 0.5) * 4, sc);
       }
     }

     for (let t = -run; t <= run; t += step) {
       const sc = TILE + (Math.random() - 0.5) * 4;
       addBuilding(t + (Math.random() - 0.5) * 4, -range, sc);
       addBuilding(t + (Math.random() - 0.5) * 4, range, sc);
       addBuilding(-range, t + (Math.random() - 0.5) * 4, sc);
       addBuilding(range, t + (Math.random() - 0.5) * 4, sc);
     }

     for (let i = 0; i < 16; i++) {
       const x = (Math.random() > 0.5 ? 1 : -1) * (60 + Math.random() * 270);
       const z = (Math.random() > 0.5 ? 1 : -1) * (60 + Math.random() * 270);
       const sc = TILE + (Math.random() - 0.5) * 6;
       addBuilding(x, z, sc);
     }

     this.addRepairShop(-198, -range);
     this.addFuelStation(198, range);
     this.spawnSpeedTraps();
     this.spawnDriftZones();
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

  buildCharacters(scene) {
    const model = this.manager.characterModel;
    if (!model || model.children.length === 0) return;
    const skins = this.manager.characterSkins || {};

    const spots = [
      { x: 150, z: 355, rot: -Math.PI / 2 },
      { x: -150, z: -355, rot: Math.PI / 2 },
      { x: 31, z: 260, rot: -Math.PI / 2 },
      { x: -31, z: 240, rot: Math.PI / 2 },
      { x: 31, z: -180, rot: -Math.PI / 2 },
      { x: -31, z: -280, rot: Math.PI / 2 },
      { x: 31, z: -320, rot: -Math.PI / 2 },
      { x: -31, z: 80, rot: Math.PI / 2 },
      { x: 250, z: 378, rot: Math.PI },
      { x: -180, z: 378, rot: Math.PI },
      { x: 60, z: 378, rot: Math.PI },
      { x: 220, z: -378, rot: 0 },
      { x: -120, z: -378, rot: 0 },
      { x: -320, z: -378, rot: 0 }
    ];

    const skinNames = Object.keys(skins);
    if (skinNames.length === 0) return;

    spots.forEach((spot, idx) => {
      const char = cloneSkeleton(model);
      char.rotation.x = Math.PI;
      char.rotation.y = spot.rot;
      char.scale.setScalar(0.0048);
      char.traverse(c => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          const tex = skins[skinNames[idx % skinNames.length]];
          if (tex && c.material) {
            const mats = Array.isArray(c.material) ? c.material.map(m => m.clone()) : [c.material.clone()];
            mats.forEach(m => { m.map = tex; m.vertexColors = false; m.needsUpdate = true; });
            c.material = mats.length === 1 ? mats[0] : mats;
          }
        }
      });
      char.position.set(spot.x, 0, spot.z);
      this.addObj(char);
    });
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

  spawnSpeedTraps() {
    const e = ROAD_EDGE;
    const placements = [
      { x: 0, z: -(e - 80) }, { x: 0, z: (e - 80) },
      { x: -(e - 80), z: 0 }, { x: (e - 80), z: 0 }
    ];
    placements.forEach(p => {
      this.addSpeedTrap(p.x, p.z);
    });
  }

  addSpeedTrap(x, z) {
    const r = 12;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.5, r, 32),
      new THREE.MeshBasicMaterial({ color: 0xff44ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.position.set(x, 0.15, z); ring.rotation.x = -Math.PI / 2; this.addObj(ring);
    const arrowGeo = new THREE.PlaneGeometry(4, 1.5);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff44ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set(x, 0.2, z); arrow.rotation.x = -Math.PI / 2; this.addObj(arrow);
    this.speedTraps.push({ x, z, r, triggered: false });
  }

  addDriftZone(x, z) {
    const r = 14;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.5, r, 32),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    ring.position.set(x, 0.15, z); ring.rotation.x = -Math.PI / 2; this.addObj(ring);
    const arrowGeo = new THREE.PlaneGeometry(4, 1.5);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set(x, 0.2, z); arrow.rotation.x = -Math.PI / 2; this.addObj(arrow);
    this.driftZones.push({ x, z, r, active: false, score: 0 });
  }

  spawnDriftZones() {
    const e = ROAD_EDGE;
    const placements = [
      { x: 150, z: -e },
      { x: -150, z: e },
      { x: -e, z: 150 },
      { x: e, z: -150 }
    ];
    placements.forEach(p => {
      this.addDriftZone(p.x, p.z);
    });
  }

  createNameLabel(name) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.roundRect(0, 10, 256, 44, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(3, 0.75, 1);
    sprite.position.y = 2.2;
    return sprite;
  }

  initMultiplayer(data) {
    import('../services/FirebaseService.js').then(({ db, ref, set, onValue, off }) => {
      const posRef = ref(db, `rooms/${this.roomId}/players/${this.playerId}`);
      this.syncInterval = setInterval(() => {
        if (this.currentCar) {
          set(posRef, {
            x: this.currentCar.mesh.position.x, z: this.currentCar.mesh.position.z,
            rot: this.currentCar.mesh.rotation.y, speed: this.currentCar.speed,
            carIdx: this.selectedIdx, connected: true,
            damage: this.currentCar.damage, fuel: this.currentCar.fuel,
            name: this.selectedDisplayName || 'Player'
          });
        }
      }, 50);

      const allPosRef = ref(db, `rooms/${this.roomId}/players`);
      this.posListener = onValue(allPosRef, (snap) => {
        const players = snap.val(); if (!players) return;
        Object.entries(players).forEach(([pid, p]) => {
          if (pid === this.playerId) return;
          if (!this.ghostCars[pid]) {
            const model = this.manager.models[CAR_IDS[p.carIdx] || CAR_IDS[0]];
            if (model) {
              const ghost = new Car(this.manager.scene, model, p.x || 0, p.z || 0, p.name || 'Player');
              ghost.mesh.traverse(c => { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.7; } });
              const label = this.createNameLabel(p.name || 'Player');
              ghost.mesh.add(label);
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
    const hr = 10;

    let intensity, ambIntensity, hemiIntensity;
    let sunColor, ambColor, hemiColor;
    let sunAngle;

    intensity = 1.0;
    ambIntensity = 0.45;
    hemiIntensity = 0.35;
    sunColor = new THREE.Color(0xffeedd);
    ambColor = new THREE.Color(0x556677);
    hemiColor = new THREE.Color(0x88ccff);
    sunAngle = Math.PI * 0.2;

    this.sunLight.color.copy(sunColor);
    this.sunLight.intensity = Math.max(0.05, intensity);
    this.sunLight.position.x = Math.cos(sunAngle) * 80;
    this.sunLight.position.y = Math.sin(sunAngle) * 80 + 10;
    this.sunLight.position.z = 30;

    this.ambientLight.color.copy(ambColor);
    this.ambientLight.intensity = Math.max(0.05, ambIntensity);

    this.hemiLight.color.copy(hemiColor);
    this.hemiLight.intensity = Math.max(0.03, hemiIntensity);

    const tex = this.manager.skyboxes?.['day'];
    this.manager.scene.background = tex || new THREE.Color(0xc8d0d8);
    this.manager.scene.fog = new THREE.Fog(0xc8d0d8, 120, 600);
  }

  spawnCar(scene) {
    const id = CAR_IDS[this.selectedIdx] || CAR_IDS[0];
    const displayName = this.selectedDisplayName || CONFIG.cars[id] || id;
    const model = this.manager.models[id];
    if (!model) return;
    let startX = 0, startZ = -(ROAD_EDGE - 120);
    if (this.multi) {
      startX = (Math.random() - 0.5) * (ROAD_EDGE - 80);
      startZ = 0;
    }
    const car = new Car(scene, model, startX, startZ, displayName);
    this.currentCar = car;
    if (this.isCreative) {
      car.fuel = Infinity;
      car.fuelConsumption = 0;
      car.maxDamage = 999999;
      car.damage = 0;
      car.damageSpeedPenalty = 0;
    }
    if (this.selectedColor) {
      const hex = parseInt(this.selectedColor.replace('#', ''), 16);
      car.mesh.traverse(c => { if (c.isMesh && c.material) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach(m => { if (m.color && !m.map) m.color.setHex(hex); });
      }});
    }
    this.prevPos = { x: startX, z: startZ };
    car.occupy();
    this.syncHUD();
    this.createHeadlights(scene);
    this.manager.camera.fov = CONFIG.camera.minFov;
    this.manager.camera.updateProjectionMatrix();
    this._targetFov = CONFIG.camera.minFov;
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

  nearestRoadPoint(x, z) {
    const e = ROAD_EDGE, h = ROAD_HALF, m = e + h;
    let best = { x, z, d: Infinity };
    const consider = (px, pz) => {
      const dx = px - x, dz = pz - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < best.d) best = { x: px, z: pz, d };
    };
    const hstrip = (zc) => {
      const px = Math.max(-m, Math.min(m, x));
      const pz = Math.max(zc - h, Math.min(zc + h, z));
      consider(px, pz);
    };
    const vstrip = (xc) => {
      const px = Math.max(xc - h, Math.min(xc + h, x));
      const pz = Math.max(-m, Math.min(m, z));
      consider(px, pz);
    };
    hstrip(-e);
    hstrip(e);
    vstrip(-e);
    vstrip(e);
    vstrip(0);
    hstrip(0);
    return best;
  }

  clampToRoad(pos) {
    const np = this.nearestRoadPoint(pos.x, pos.z);
    const onRoad = np.d <= 1.5;
    if (!onRoad && np.d < 300) {
      return { x: np.x, z: np.z, clamped: true, onRoad: false };
    }
    return { x: pos.x, z: pos.z, clamped: false, onRoad };
  }

  checkBuildingCollision(car) {
    if (this.isCreative) return;
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
      else if (k === 'h') { const ho = document.getElementById('help-overlay'); if (ho) ho.classList.toggle('visible'); }
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
        this.cameraAngle -= e.movementX * this.sensitivity;
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
            <div class="hud-panel-light" style="padding:6px 10px;display:flex;align-items:center;gap:6px">
              <svg class="stat-icon" viewBox="0 0 16 16" fill="none"><path d="M2 2h12v12H2z" stroke="#ff44ff" stroke-width="1.5"/><path d="M5 5h6v6H5z" stroke="#ff44ff" stroke-width="1.2"/></svg>
              <span style="font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:#ff44ff"><span id="hud-speed-trap">0</span><span style="font-size:9px;color:#883388">km/h</span></span>
              <div class="stat-bar" style="width:50px"><div id="hud-speed-trap-bar" class="stat-fill" style="width:0%;background:#ff44ff"></div></div>
            </div>
            <div class="hud-panel-light" style="padding:6px 10px;display:flex;align-items:center;gap:6px">
              <svg class="stat-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#ffaa00" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#ffaa00" stroke-width="1.5" stroke-linecap="round"/></svg>
              <span style="font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:#ffaa00"><span id="hud-drift">0</span></span>
              <div class="stat-bar" style="width:50px"><div id="hud-drift-bar" class="stat-fill" style="width:0%;background:#ffaa00"></div></div>
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
        <button id="hud-help" style="padding:4px 10px;font-size:10px;background:rgba(255,255,255,0.08);color:#888;border:1px solid rgba(255,255,255,0.1);border-radius:6px;cursor:pointer;pointer-events:auto">? HELP</button>
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
            <kbd>W</kbd> Drive &nbsp;<kbd>A</kbd><kbd>D</kbd> Steer &nbsp;<kbd>Space</kbd> Boost &nbsp;<kbd>V</kbd> Zoom &nbsp;<kbd>H</kbd> Help &nbsp;<kbd>Esc</kbd> Pause
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
        <button class="pause-btn" data-action="help">? CONTROLS</button>
        <button class="pause-btn" data-action="resume" style="background:linear-gradient(135deg,#44aaff,#2266cc)">? RESUME</button>
        <button class="pause-btn" data-action="restart">↻ RESTART</button>
        <button class="pause-btn" data-action="select">🏎 CHANGE CAR</button>
        <button class="pause-btn" data-action="menu">⌂ MAIN MENU</button>
      </div>
      <div id="pause-sens" style="margin-top:16px;color:#888;font-family:Rajdhani,sans-serif;font-size:13px;letter-spacing:1px">
        Mouse Sensitivity
        <input id="sens-slider" type="range" min="0.001" max="0.015" step="0.001" value="0.003" style="vertical-align:middle;width:120px;accent-color:#44aaff">
        <span id="sens-val" style="color:#44aaff;font-family:Orbitron,monospace;font-size:11px">0.003</span>
      </div>
      <style>
        .pause-btn { display:block; margin:8px auto; padding:12px 50px; font-size:18px; font-weight:600; color:#fff; border:none; border-radius:8px; cursor:pointer; width:240px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); transition:all 0.15s ease; font-family:inherit; letter-spacing:1px }
        .pause-btn:hover { background:rgba(255,255,255,0.15) !important; transform:scale(1.03); border-color:rgba(255,255,255,0.2) }
        .help-overlay { position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);z-index:250;font-family:Rajdhani,sans-serif }
        .help-overlay.visible { display:flex }
        .help-box { background:rgba(10,10,30,0.95);border:1px solid rgba(68,170,255,0.15);border-radius:16px;padding:30px 40px;max-width:420px;width:90%;text-align:center;color:#fff }
        .help-box h2 { font-family:Orbitron,monospace;font-size:22px;color:#44aaff;margin:0 0 16px;letter-spacing:3px }
        .help-row { display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05) }
        .help-row:last-child { border-bottom:none }
        .help-key { font-family:Orbitron,monospace;font-size:11px;color:#ff6b35;background:rgba(255,107,53,0.1);padding:3px 10px;border-radius:4px;min-width:60px;text-align:center }
        .help-desc { font-size:14px;color:#999;text-align:left }
        .help-close { margin-top:16px;padding:8px 30px;font-size:14px;background:rgba(255,255,255,0.08);color:#888;border:1px solid rgba(255,255,255,0.1);border-radius:6px;cursor:pointer;font-family:Rajdhani,sans-serif;transition:all 0.15s }
        .help-close:hover { background:rgba(255,255,255,0.15);color:#ccc }
      </style>
    `;
    pm.querySelectorAll('.pause-btn').forEach(b => {
      b.onclick = () => {
        switch (b.dataset.action) {
          case 'resume': this.paused = false; pm.style.display = 'none'; break;
          case 'restart': this.exit(); this.manager.start('game', { carIdx: this.selectedIdx }); break;
          case 'select': this.exit(); this.manager.start('select'); break;
          case 'menu': this.exit(); this.manager.start('menu'); break;
          case 'help': helpOverlay.classList.add('visible'); break;
        }
      };
    });

    const sensSlider = document.getElementById('sens-slider');
    const sensVal = document.getElementById('sens-val');
    if (sensSlider) {
      sensSlider.value = this.sensitivity;
      sensSlider.oninput = () => {
        this.sensitivity = parseFloat(sensSlider.value);
        if (sensVal) sensVal.textContent = this.sensitivity.toFixed(3);
      };
    }

    const helpOverlay = document.createElement('div');
    helpOverlay.id = 'help-overlay';
    helpOverlay.className = 'help-overlay';
    helpOverlay.innerHTML = `
      <div class="help-box">
        <h2>CONTROLS</h2>
        <div class="help-row"><span class="help-key">W</span><span class="help-desc">Accelerate</span></div>
        <div class="help-row"><span class="help-key">S</span><span class="help-desc">Brake / Reverse</span></div>
        <div class="help-row"><span class="help-key">A</span><span class="help-desc">Steer Left</span></div>
        <div class="help-row"><span class="help-key">D</span><span class="help-desc">Steer Right</span></div>
        <div class="help-row"><span class="help-key">SPACE</span><span class="help-desc">Boost</span></div>
        <div class="help-row"><span class="help-key">V</span><span class="help-desc">Zoom Camera</span></div>
        <div class="help-row"><span class="help-key">MOUSE</span><span class="help-desc">Look Around (360°)</span></div>
        <div class="help-row"><span class="help-key">ESC</span><span class="help-desc">Pause / Exit Pointer Lock</span></div>
        <div class="help-row"><span class="help-key">ZONES</span><span class="help-desc">Pink rings = Speed Traps, Orange rings = Drift Zones</span></div>
        <button class="help-close" id="help-close-btn">CLOSE</button>
      </div>
    `;
    document.body.appendChild(helpOverlay);
    document.getElementById('help-close-btn').onclick = () => helpOverlay.classList.remove('visible');
    helpOverlay.onclick = (e) => { if (e.target === helpOverlay) helpOverlay.classList.remove('visible'); };
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
    this.hudEls.speedTrap = document.getElementById('hud-speed-trap');
    this.hudEls.speedTrapBar = document.getElementById('hud-speed-trap-bar');
    this.hudEls.drift = document.getElementById('hud-drift');
    this.hudEls.driftBar = document.getElementById('hud-drift-bar');
    this.hudEls.timer = document.getElementById('hud-timer');
    this.hudEls.laps = document.getElementById('hud-laps');
    this.hudEls.best = document.getElementById('hud-best');

    const helpBtn = document.getElementById('hud-help');
    if (helpBtn) helpBtn.onclick = () => {
      const ho = document.getElementById('help-overlay');
      if (ho) ho.classList.toggle('visible');
    };

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
    if (this.hudEls.car && this.currentCar) {
      const carName = (this.multi ? '🌐 ' : '') + this.currentCar.name.toUpperCase();
      this.hudEls.car.textContent = carName;
    }
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
      if (Math.abs(car.speed) > 15 && this.collisionCooldown <= 0 && !this.isCreative) {
        car.takeDamage(Math.abs(car.speed) * 0.08);
        this.collisionCooldown = 0.3;
        this.sound.playCollision(Math.min(1, Math.abs(car.speed) / 50));
        this.shakeScreen(0.3, 0.15);
      }
    }
    if (!result.onRoad && !this.isCreative) {
      car.speed *= 0.92;
      if (Math.abs(car.speed) > 10 && this.collisionCooldown <= 0) {
        car.takeDamage(Math.abs(car.speed) * 0.04);
        this.collisionCooldown = 0.2;
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

    let camDist = this.camZoom ? 5 : this.cameraOrbitDistance;
    let camHeight = this.camZoom ? 2 : this.cameraOrbitHeight;
    let lookAhead = this.camZoom ? 1.5 : 5;

    const speedNorm = Math.abs(car.speed) / (car.boost ? CONFIG.car.maxSpeed * CONFIG.car.boostMultiplier : CONFIG.car.maxSpeed);
    if (car.boost && speedNorm > 0.3) {
      camHeight *= 0.82;
      lookAhead *= 1.35;
    } else if (this.input.backward && Math.abs(car.speed) > 5) {
      camHeight *= 1.12;
      lookAhead *= 0.55;
    }

    const dirX = -Math.sin(this.cameraAngle);
    const dirZ = -Math.cos(this.cameraAngle);
    const viewX = -dirX;
    const viewZ = -dirZ;
    const targetY = this.camZoom ? 1.2 : 1.4;
    const newTarget = new THREE.Vector3(
      car.mesh.position.x + viewX * lookAhead,
      targetY,
      car.mesh.position.z + viewZ * lookAhead
    );
    this.cameraTarget.lerp(newTarget, 0.15);
    const targetCamPos = new THREE.Vector3(
      car.mesh.position.x + dirX * camDist,
      camHeight,
      car.mesh.position.z + dirZ * camDist
    );

    const origin = car.mesh.position.clone();
    origin.y += 1.5;
    this._raycaster.set(origin, targetCamPos.clone().sub(origin).normalize());
    this._raycaster.far = camDist + 2;
    const intersects = this._raycaster.intersectObjects(this.sceneObjects, true);
    const hit = intersects.find(i => i.distance < camDist - 1);
    if (hit) {
      targetCamPos.copy(hit.point).add(this._raycaster.ray.direction.clone().multiplyScalar(0.5));
      targetCamPos.y = Math.max(targetCamPos.y, camHeight * 0.7);
    }

    const lerpFactor = CONFIG.camera.lerpSpeed;
    this.manager.camera.position.lerp(targetCamPos, lerpFactor);
    this.manager.camera.lookAt(this.cameraTarget);

    const maxSpeedKmh = (car.boost ? CONFIG.car.maxSpeed * CONFIG.car.boostMultiplier : CONFIG.car.maxSpeed) * 3.6;
    const speedKmh = Math.abs(car.speed) * 3.6;
    let boostFov = 0;
    if (car.boost && speedNorm > 0.3) {
      boostFov = 6;
      this.manager.camera.position.x += (Math.random() - 0.5) * 0.04;
      this.manager.camera.position.y += (Math.random() - 0.5) * 0.03;
    }
    this._targetFov = CONFIG.camera.minFov + (CONFIG.camera.maxFov - CONFIG.camera.minFov) * (speedKmh / maxSpeedKmh) + boostFov;
    this.manager.camera.fov = THREE.MathUtils.lerp(this.manager.camera.fov, this._targetFov, dt * 5);
    this.manager.camera.updateProjectionMatrix();

    this.applyScreenShake();

    this.coinUpdate(dt);
    this.driftUpdate(dt);
    this.speedTrapUpdate(dt);
    this.driftZoneUpdate(dt);
    this.updateExhaust(dt);
    this.updateNitrous(dt);
    this.updateDustMotes(dt);
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
      else if (this.speedTraps.some(t => t.triggered)) this.hudEls.zone.textContent = '⚡ SPEED RECORD';
      else if (this.driftZones.some(z => z.active)) this.hudEls.zone.textContent = '🔥 DRIFT ZONE';
      else this.hudEls.zone.textContent = '';
    }
    if (this.hudEls.speedTrap) {
      this.hudEls.speedTrap.textContent = Math.round(this.topSpeedRecord);
      if (this.hudEls.speedTrapBar) {
        const pct = Math.min(100, (this.topSpeedRecord / (CONFIG.car.maxSpeed * CONFIG.car.boostMultiplier * 3.6)) * 100);
        this.hudEls.speedTrapBar.style.width = pct + '%';
      }
    }
    if (this.hudEls.drift) {
      this.hudEls.drift.textContent = Math.round(this.driftZoneScore);
      if (this.hudEls.driftBar) {
        this.hudEls.driftBar.style.width = Math.min(100, this.driftZoneScore / 50) + '%';
      }
    }
    if (this.hudEls.time) {
      const h = Math.floor(this.dayTime);
      const m = Math.floor((this.dayTime - h) * 60);
      this.hudEls.time.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      if (this.hudEls.timeIcon) this.hudEls.timeIcon.textContent = '☀️';
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
    const e = ROAD_EDGE;
    const pts = [
      [0, 0], [0, -(e - 100)], [(e - 100), 0], [-(e - 100), 0]
    ];
    for (let i = 0; i < pts.length; i++) {
      this.checkpoints.push({ x: pts[i][0], z: pts[i][1], r: 15, passed: false });
    }
  }

   spawnCoins() {
     const e = ROAD_EDGE, h = ROAD_HALF;
     const placeCoin = (x, z) => {
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
     };
     for (let i = 0; i < 12; i++) {
       placeCoin((Math.random() - 0.5) * h * 0.8, -(e - 30) + Math.random() * (2 * (e - 30)));
     }
     for (let i = 0; i < 12; i++) {
       placeCoin(-(e - 30) + Math.random() * (2 * (e - 30)), (Math.random() - 0.5) * h * 0.8);
     }
     for (let i = 0; i < 4; i++) {
       placeCoin(-(e - 30) + Math.random() * (2 * (e - 30)), -e + (Math.random() - 0.5) * h * 0.8);
       placeCoin(-(e - 30) + Math.random() * (2 * (e - 30)), e + (Math.random() - 0.5) * h * 0.8);
       placeCoin(-e + (Math.random() - 0.5) * h * 0.8, -(e - 30) + Math.random() * (2 * (e - 30)));
       placeCoin(e + (Math.random() - 0.5) * h * 0.8, -(e - 30) + Math.random() * (2 * (e - 30)));
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

    ctx.fillStyle = 'rgba(45,45,45,0.85)';
    const rwPx = ROAD_W * scale;
    const ePx = ROAD_EDGE * scale;
    ctx.fillRect(cx - rwPx / 2, cy - ePx, rwPx, ePx * 2);
    ctx.fillRect(cx - ePx, cy - rwPx / 2, ePx * 2, rwPx);
    ctx.fillRect(cx - ePx, cy - ePx - rwPx / 2, ePx * 2, rwPx);
    ctx.fillRect(cx - ePx, cy + ePx - rwPx / 2, ePx * 2, rwPx);
    ctx.fillRect(cx - ePx - rwPx / 2, cy - ePx, rwPx, ePx * 2);
    ctx.fillRect(cx + ePx - rwPx / 2, cy - ePx, rwPx, ePx * 2);

    this.buildings.forEach(b => {
      if (b.r < 3) return;
      ctx.fillStyle = 'rgba(255,200,100,0.4)';
      ctx.fillRect(cx + b.x * scale - 1, cy + b.z * scale - 1, 3, 3);
    });

    this.speedTraps.forEach(t => {
      ctx.fillStyle = 'rgba(255,68,255,0.6)';
      ctx.beginPath();
      ctx.arc(cx + t.x * scale, cy + t.z * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    this.driftZones.forEach(z => {
      ctx.strokeStyle = z.active ? 'rgba(255,170,0,0.9)' : 'rgba(255,170,0,0.4)';
      ctx.lineWidth = z.active ? 2 : 1;
      ctx.beginPath();
      ctx.arc(cx + z.x * scale, cy + z.z * scale, 4, 0, Math.PI * 2);
      ctx.stroke();
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

  speedTrapUpdate(dt) {
    if (!this.currentCar || this.paused) return;
    const car = this.currentCar;
    const speedKmh = Math.abs(car.speed) * 3.6;
    this.speedTraps.forEach(trap => {
      if (trap.triggered) return;
      const d = Math.sqrt((car.mesh.position.x - trap.x) ** 2 + (car.mesh.position.z - trap.z) ** 2);
      if (d < trap.r) {
        trap.triggered = true;
        if (speedKmh > this.topSpeedRecord) {
          this.topSpeedRecord = speedKmh;
          this.showSpeedRecord(speedKmh);
        }
      }
    });
  }

  driftZoneUpdate(dt) {
    if (!this.currentCar || this.paused) return;
    const car = this.currentCar;
    const speed = Math.abs(car.speed);
    const turning = this.input.left || this.input.right;
    const drifting = speed > 15 && turning;
    this.driftZones.forEach(zone => {
      const d = Math.sqrt((car.mesh.position.x - zone.x) ** 2 + (car.mesh.position.z - zone.z) ** 2);
      if (d < zone.r && drifting) {
        zone.active = true;
        const pts = Math.round(speed * dt * 2.5);
        zone.score += pts;
        this.driftZoneScore += pts;
      } else {
        zone.active = false;
      }
    });
  }

  showSpeedRecord(speed) {
    const el = document.getElementById('speed-record');
    if (el) { el.remove(); }
    const d = document.createElement('div');
    d.id = 'speed-record';
    d.style.cssText = `position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);z-index:170;pointer-events:none;font-family:Orbitron,monospace;font-weight:900;font-size:36px;color:#ff44ff;text-shadow:0 0 30px rgba(255,68,255,0.6);opacity:1;transition:opacity 0.5s ease`;
    d.textContent = `SPEED RECORD ${Math.round(speed)} km/h`;
    document.body.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 600); }, 1800);
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

  makeMoteTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,250,220,0.6)');
    g.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  createDustMotes() {
    if (this._motesGeo) { this.manager.scene.remove(this._motesGeo); this._motesGeo = null; }
    const e = ROAD_EDGE, h = ROAD_HALF, q = e - h;
    const positions = [];
    const motes = [];
    const add = (bx, bz, yBase) => {
      positions.push(bx, yBase, bz);
      motes.push({
        bx, bz, yBase,
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.45,
        amp: 0.4 + Math.random() * 0.7
      });
    };
    const off = h + 3;
    for (const side of [-1, 1]) {
      for (let z = -(q - 40); z <= q - 40; z += 62) {
        add(side * (off + Math.random() * 3), z + (Math.random() - 0.5) * 26, 0.5 + Math.random() * 1.6);
      }
    }
    for (const side of [-1, 1]) {
      for (let x = -(q - 40); x <= q - 40; x += 62) {
        add(x + (Math.random() - 0.5) * 26, side * (off + Math.random() * 3), 0.5 + Math.random() * 1.6);
      }
    }
    const rin = e - h - 2;
    for (const side of [-1, 1]) {
      for (let x = -(q - 40); x <= q - 40; x += 88) {
        add(x + (Math.random() - 0.5) * 30, side * (rin + Math.random() * 2), 0.5 + Math.random() * 1.5);
      }
      for (let z = -(q - 40); z <= q - 40; z += 88) {
        add(side * (rin + Math.random() * 2), z + (Math.random() - 0.5) * 30, 0.5 + Math.random() * 1.5);
      }
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      add(Math.cos(a) * ROAD_W * 0.9, Math.sin(a) * ROAD_W * 0.9, 0.6 + Math.random() * 1.2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this._motesMat = new THREE.PointsMaterial({
      map: this.makeMoteTexture(),
      size: 1.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xfff2cc
    });
    this._motesGeo = new THREE.Points(geo, this._motesMat);
    this._motesGeo.frustumCulled = false;
    this.addObj(this._motesGeo);
    this._motes = motes;
    this._moteTime = 0;
  }

  updateDustMotes(dt) {
    if (!this._motesGeo || this._motes.length === 0) return;
    this._moteTime += dt;
    const t = this._moteTime;
    const pos = this._motesGeo.geometry.attributes.position;
    const motes = this._motes;
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      pos.setXYZ(i,
        m.bx + Math.sin(t * m.speed * 0.6 + m.phase * 2) * 1.8,
        m.yBase + Math.sin(t * m.speed + m.phase) * m.amp,
        m.bz + Math.cos(t * m.speed * 0.5 + m.phase) * 1.8
      );
    }
    pos.needsUpdate = true;
    this._motesMat.opacity = 0.4 + Math.sin(t * 0.7) * 0.12;
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
    this.speedTraps = [];
    this.driftZones = [];
    this.manager.scene.background = null;
    this.manager.scene.fog = null;
    const hud = document.getElementById('hud'); if (hud) hud.remove();
    const pm = document.getElementById('pause-menu'); if (pm) pm.remove();
    const ho = document.getElementById('help-overlay'); if (ho) ho.remove();
    const ct = document.getElementById('countdown'); if (ct) ct.remove();
    const df = document.getElementById('drift-flash'); if (df) df.remove();
    if (this._hudStyle) this._hudStyle.remove();
  }
}
