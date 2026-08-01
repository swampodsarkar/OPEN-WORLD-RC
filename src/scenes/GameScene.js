import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Car } from '../entities/Car.js';
import { Boat } from '../entities/Boat.js';
import { SoundService } from '../services/SoundService.js';
import { SettingsService } from '../services/SettingsService.js';
import { NameService } from '../services/NameService.js';
import { RecordsService } from '../services/RecordsService.js';
import { ProgressService, CASH_PER_COIN } from '../services/ProgressService.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const CAR_IDS = [
  'race', 'race-future', 'sedan-sports', 'hatchback-sports',
  'suv-luxury', 'sedan', 'suv', 'truck', 'police', 'taxi'
];

window._garageSelectCar = function(carId) {
  const idx = CAR_IDS.indexOf(carId);
  if (idx >= 0 && ProgressService.owns(carId)) {
    ProgressService.select(carId);
    const gs = window.__nitroManager?.scenes?.game;
    if (gs) gs.selectedIdx = idx;
  }
};

window._garageBuyUpgrade = function(upgradeKey) {
  const gs = window.__nitroManager?.scenes?.game;
  if (!gs) return;
  const carId = CAR_IDS[gs.selectedIdx];
  if (ProgressService.buyUpgrade(carId, upgradeKey)) {
    gs.renderGarage();
  }
};

window._garageColor = function(hex) {
  const gs = window.__nitroManager?.scenes?.game;
  if (!gs) return;
  gs.garageColor = hex;
  gs.applyGarageColor(hex);
  gs.renderGarage();
};

const TILE = 8;
const ROAD_EDGE = CONFIG.road.edgeHalf;
const OUTER_RING = 2200;
const ROAD_W = CONFIG.road.width;
const ROAD_HALF = ROAD_W / 2;
const LANE_W = CONFIG.road.laneWidth;
const DAY_DURATION = 120;

const LAKE_CENTER = new THREE.Vector2(1850, 550);
const LAKE_RADIUS = 260;
const DOCK_POS = { x: 1660, z: 620 };

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
    this.firstPerson = false;
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
    this.sound = manager.sound || new SoundService();
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
    this.onFoot = true;
    this.footPos = new THREE.Vector3(0, 0, 0);
    this.footYaw = 0;
    this.footPitch = 0;
    this.footY = 0;
    this.footVelY = 0;
    this.parkedCars = [];
    this.parkedBoats = [];
    this.currentBoat = null;
    this.lakeWater = null;
    this._waterTime = 0;
this.photoMode = false;
     this.photoAngle = 0;
     this.photoDistance = 20;
     this.photoHeight = 10;
     this.photoTarget = new THREE.Vector3();
     this._screenshotCount = 0;
     this.weatherType = 0;
     this.weatherIntensity = 0;
     this.weatherTarget = 0;
     this.weatherTimer = 0;
     this.rainParticles = null;
     this.rainGeo = null;
     this.rainMat = null;
     this.roadGripMult = 1;
     this.npcCars = [];
     this.garageOpen = false;
     this.garageColor = '#44aaff';
     this.garageTab = 'upgrades';
     this.raceMode = false;
     this.raceLaps = 3;
     this.raceLap = 0;
     this.raceTimer = 0;
     this.raceTimes = [];
     this.raceFinished = false;
     this.raceStartDelay = 0;
     this.tutorialStep = 0;
     this.tutorialActive = false;
     this.tutorialTimer = 0;
     this.waypoints = [];
     this.showMinimap = true;
     this.showSpeedo = true;
     this.showCompass = true;
     this.season = 'summer';
     this.seasonTimer = 0;
     this.seasonDuration = 300;
     this.nightVision = false;
     this.thermalVision = false;
     this.spectatorMode = false;
     this.spectatorTarget = null;
     this.coopMissions = [];
     this.coopMissionActive = false;
   }

  spawnNPCCars() {
    const npcTypes = ['sedan', 'suv', 'truck', 'police', 'taxi'];
    const count = 8;
    for (let i = 0; i < count; i++) {
      const type = npcTypes[Math.floor(Math.random() * npcTypes.length)];
      const model = this.manager.models[type];
      if (!model) continue;
      const side = Math.random() < 0.5 ? -1 : 1;
      const roadEdge = ROAD_EDGE + side * (ROAD_HALF + 5);
      const z = (Math.random() - 0.5) * (ROAD_EDGE * 2);
      const npc = new Car(this.manager.scene, model, roadEdge, z, CONFIG.cars[type] || type, type);
      npc.mesh.rotation.y = side > 0 ? 0 : Math.PI;
      npc.vacate();
      npc.speed = (Math.random() * 20 + 10) * (Math.random() < 0.5 ? 1 : -1);
      npc.maxSpeed = npc.speed * 1.5;
      this.npcCars.push(npc);
    }
  }

updateNPCCars(dt) {
     for (const npc of this.npcCars) {
       npc.drive({ forward: true, backward: false, left: false, right: false, boost: false }, dt);
       const edge = CONFIG.world.half - 40;
       npc.mesh.position.x = THREE.MathUtils.clamp(npc.mesh.position.x, -edge, edge);
       npc.mesh.position.z = THREE.MathUtils.clamp(npc.mesh.position.z, -edge, edge);
       const rx = Math.abs(npc.mesh.position.z);
       const ry = Math.abs(npc.mesh.position.x);
       const onHRoad = rx <= ROAD_EDGE && ry <= ROAD_HALF + 8;
       const onVRoad = ry <= ROAD_EDGE && rx <= ROAD_HALF + 8;
       if (!onHRoad && !onVRoad) {
         const pushBack = 20 * dt;
         if (rx > ROAD_EDGE + 2) {
           const sign = npc.mesh.position.z > 0 ? -1 : 1;
           npc.mesh.position.z += sign * pushBack;
         }
         if (ry > ROAD_EDGE + 2) {
           const sign = npc.mesh.position.x > 0 ? -1 : 1;
           npc.mesh.position.x += sign * pushBack;
         }
         npc.speed *= 0.9;
       }
       if (Math.abs(npc.mesh.position.x) >= edge - 5 || Math.abs(npc.mesh.position.z) >= edge - 5) {
         npc.speed *= -1;
         npc.mesh.rotation.y = npc.speed > 0 ? 0 : Math.PI;
       }
     }
   }

  enter(data) {
    this.multi = data && data.roomId;
    ProgressService.init();
    if (this.multi) {
      this.roomId = data.roomId;
      this.playerId = data.playerId;
      this.selectedIdx = (data.players && data.players[this.playerId]?.carIdx) || 0;
    } else if (data && data.carIdx !== undefined) {
      this.selectedIdx = data.carIdx;
    }
    if (!ProgressService.owns(CAR_IDS[this.selectedIdx])) {
      this.selectedIdx = Math.max(0, CAR_IDS.indexOf(ProgressService.selectedCar));
    }
    this.selectedColor = (data && data.color) || null;
    this.cameraAngle = 0;
    this.cameraOrbitDistance = CONFIG.camera.followDistance;
    this.cameraOrbitHeight = CONFIG.camera.followHeight;
    this.cameraTarget = new THREE.Vector3();
    this.sound.init();
    SettingsService.applyVolumes(this.sound);
    SettingsService.applyGfx(this.manager.renderer, window.__composer);
    SettingsService.applyBrightness();
    this.sound.startBGM();
    this.topSpeedRecord = 0;
    this.driftZoneScore = 0;
    this.playerName = (data && data.playerName) || NameService.display();
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
    this.createBillboards();
    if (this.multi) this.initMultiplayer(data);
    if (this.manager.crazyGames) this.manager.crazyGames.gameplayStart();
    this._visHandler = () => { if (document.hidden && !this.paused) this.togglePause(); };
    document.addEventListener('visibilitychange', this._visHandler);

    window.addEventListener('nitro-achievement', (e) => {
      const { name, icon, reward } = e.detail;
      this._showToast(`${icon} Achievement: ${name} (+$${reward})`, '#ffcc00');
    });

    if (!localStorage.getItem('nitroTutorialSeen')) {
      this.tutorialActive = true;
      this.tutorialStep = 0;
      this.tutorialTimer = 0;
      localStorage.setItem('nitroTutorialSeen', '1');
    }
  }

  addObj(obj) { this.sceneObjects.push(obj); this.manager.scene.add(obj); }

  buildScene() {
    const scene = this.manager.scene;
    this.dayTime = 9;
    this.updateSky(scene);
    this.initBiomeMats();
    this.addGround(scene);
    this.addCityGround(scene);
    this.addRoads(scene);
    this.addOuterHighway(scene);
    this.addDesert(scene);
    this.addVillage(scene);
    this.addCountryside(scene);
    this.buildCity(scene);
    this.addWaterZone(scene);
    this.createDustMotes();
    this.buildCharacters(scene);
this.addLights(scene);
     this.spawnCar(scene);
     this.createRainSystem();
     this.spawnNPCCars();
   }

updateSky(scene) {
     const hr = this.dayTime;
     const season = this.season || 'summer';
     let skyKey = 'day';
     if (hr >= 20 || hr < 5) skyKey = 'night';
     else if (hr >= 18) skyKey = 'morning';
     else if (hr >= 5 && hr < 7) skyKey = 'morning';
     const tex = this.manager.skyboxes?.[skyKey];
     scene.background = tex || new THREE.Color(CONFIG.skyColor);
     let fogColor = hr >= 20 || hr < 5 ? 0x0a0a14 : hr >= 18 ? 0x443322 : hr < 7 ? 0x665544 : 0xc8d0d8;
     let fogNear = hr >= 20 || hr < 5 ? 60 : 120;
     let fogFar = hr >= 20 || hr < 5 ? 300 : 1000;
     if (season === 'winter') { fogColor = 0xccccdd; fogNear = 80; fogFar = 600; }
     else if (season === 'autumn') { fogColor = 0xaa8844; fogNear = 100; fogFar = 800; }
     else if (season === 'spring') { fogColor = 0x88bbaa; fogNear = 90; fogFar = 900; }
     scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
   }

addGround(scene) {
     const season = this.season || 'summer';
     let groundColor = '#2a5a2a';
     let groundColor2 = '#235023';
     if (season === 'winter') { groundColor = '#c8c8c8'; groundColor2 = '#b0b0b0'; }
     else if (season === 'autumn') { groundColor = '#5a4a2a'; groundColor2 = '#4a3a1a'; }
     else if (season === 'spring') { groundColor = '#3a6a3a'; groundColor2 = '#2a5a2a'; }
     const c = document.createElement('canvas'); c.width = 2; c.height = 2;
     const ctx = c.getContext('2d');
     ctx.fillStyle = groundColor; ctx.fillRect(0, 0, 2, 2);
     ctx.fillStyle = groundColor2; ctx.fillRect(0, 0, 1, 1); ctx.fillRect(1, 1, 1, 1);
     const tex = new THREE.CanvasTexture(c);
     tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(Math.round(CONFIG.world.size / 25), Math.round(CONFIG.world.size / 25));
     const g = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.world.size, CONFIG.world.size),
       new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
     g.rotation.x = -Math.PI / 2; g.receiveShadow = true; this.addObj(g);
   }

  initBiomeMats() {
    this._trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
    this._leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.85 });
    this._cactusMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.9 });
    this._rockMat = new THREE.MeshStandardMaterial({ color: 0x9a8c74, roughness: 1 });
    this._sandMat = new THREE.MeshStandardMaterial({ color: 0xd9b44a, roughness: 1 });
    this._fenceMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 });
    this._houseWood = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 });
    this._houseRoof = new THREE.MeshStandardMaterial({ color: 0x6d3b1f, roughness: 0.85 });
  }

  addCityGround(scene) {
    const half = ROAD_EDGE - ROAD_HALF - 6;
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2, half * 2),
      new THREE.MeshStandardMaterial({ color: 0x3c3f43, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    );
    g.rotation.x = -Math.PI / 2; g.position.y = 0.05; g.receiveShadow = true; this.addObj(g);
  }

  addOuterHighway(scene) {
    const O = OUTER_RING, h = ROAD_HALF;
    const asphaltMat = new THREE.MeshStandardMaterial({ map: this.makeAsphaltTex(), roughness: 0.9, metalness: 0.01, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const rd = (x, z, w, l) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l, 8, 8), asphaltMat);
      m.position.set(x, 0.12, z); m.rotation.x = -Math.PI / 2;
      m.receiveShadow = true; this.addObj(m);
    };
    const sl = (O - h) * 2;
    rd(0, -O, sl, ROAD_W);
    rd(0, O, sl, ROAD_W);
    rd(-O, 0, ROAD_W, sl);
    rd(O, 0, ROAD_W, sl);
    rd(-O, -O, ROAD_W, ROAD_W);
    rd(-O, O, ROAD_W, ROAD_W);
    rd(O, -O, ROAD_W, ROAD_W);
    rd(O, O, ROAD_W, ROAD_W);

    const q = O - h;
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const dashGeo = new THREE.PlaneGeometry(4, 0.4); dashGeo.rotateX(-Math.PI / 2);
    const hPos = [], vPos = [];
    const addDashes = (cx, cz, horizontal, a, b) => {
      const count = Math.floor((b - a) / 8);
      for (let i = 0; i < count; i++) {
        const t = a + i * 8 + 4;
        if (horizontal) hPos.push(new THREE.Vector3(cx + t, 0.18, cz));
        else vPos.push(new THREE.Vector3(cx, 0.18, cz + t));
      }
    };
    addDashes(0, -O, true, -q, q);
    addDashes(0, O, true, -q, q);
    addDashes(-O, 0, false, -q, q);
    addDashes(O, 0, false, -q, q);
    const makeInst = (pos) => {
      if (pos.length === 0) return;
      const im = new THREE.InstancedMesh(dashGeo, yellowMat, pos.length);
      const m = new THREE.Matrix4();
      pos.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m); });
      im.instanceMatrix.needsUpdate = true; this.addObj(im);
    };
    makeInst(hPos); makeInst(vPos);

    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const addEdges = (cx, cz, horizontal, a, b) => {
      const len = b - a;
      for (const side of [-1, 1]) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? len : 0.3, horizontal ? 0.3 : len), whiteMat);
        d.rotation.x = -Math.PI / 2;
        const off = side * (h - 0.7);
        d.position.set(horizontal ? cx + (a + b) / 2 : cx + off, 0.18, horizontal ? cz + off : cz + (a + b) / 2);
        this.addObj(d);
      }
    };
    addEdges(0, -O, true, -q, q);
    addEdges(0, O, true, -q, q);
    addEdges(-O, 0, false, -q, q);
    addEdges(O, 0, false, -q, q);
  }

  addTree(x, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.55 * s, 3 * s, 6), this._trunkMat);
    trunk.position.y = 1.5 * s; trunk.castShadow = true; g.add(trunk);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.1 * s, 4.6 * s, 8), this._leafMat);
    leaf.position.y = 4.8 * s; leaf.castShadow = true; g.add(leaf);
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI;
    this.addObj(g);
    this.buildings.push({ x, z, r: 2.2 * s + 0.5 });
  }

  addCactus(x, z, s) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * s, 0.5 * s, 3.2 * s, 8), this._cactusMat);
    body.position.y = 1.6 * s; g.add(body);
    for (const dir of [-1, 1]) {
      if (Math.random() < 0.7) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.3 * s, 1.6 * s, 8), this._cactusMat);
        arm.position.set(dir * (0.7 * s), 2.3 * s, (Math.random() - 0.5) * 0.6 * s);
        arm.rotation.z = dir * 0.5; g.add(arm);
      }
    }
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI;
    this.addObj(g);
  }

  addRock(x, z, s) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), this._rockMat);
    m.position.set(x, s * 0.4, z);
    m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    m.scale.y = 0.7;
    this.addObj(m);
  }

  addDune(x, z, s) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(s, s * 0.6, 12), this._sandMat);
    m.position.set(x, s * 0.25, z);
    m.rotation.y = Math.random() * Math.PI;
    m.scale.z = 2.4;
    this.addObj(m);
  }

  addVillageHouse(x, z, rotY) {
    const g = new THREE.Group();
    const w = 7 + Math.random() * 3, d = 5.5 + Math.random() * 2, hh = 3.2 + Math.random() * 1.2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), this._houseWood);
    body.position.y = hh / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const rr = Math.hypot(w + 1.2, d + 1.2) / 2 * 0.98;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(rr, 2.4, 4), this._houseRoof);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = hh + 1.2; roof.castShadow = true; g.add(roof);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    this.addObj(g);
    this.buildings.push({ x, z, r: Math.hypot(w, d) / 2 + 1.2 });
  }

  addVillageModel(name, x, z, rotY, scale) {
    const vm = this.manager.villageModels;
    if (!vm || !vm[name]) return null;
    const g = vm[name].clone();
    g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    g.position.set(x, 0, z);
    if (rotY) g.rotation.y = rotY;
    if (scale) g.scale.setScalar(scale);
    this.addObj(g);
    return g;
  }

  villageHouseTypes() {
    return [
      'building-type-a', 'building-type-b', 'building-type-c', 'building-type-d', 'building-type-e',
      'building-type-f', 'building-type-g', 'building-type-h', 'building-type-i', 'building-type-j',
      'building-type-k', 'building-type-l', 'building-type-m', 'building-type-n', 'building-type-o',
      'building-type-p', 'building-type-q', 'building-type-r', 'building-type-s', 'building-type-t',
      'building-type-u'
    ];
  }

  addFence(x, z, len, horizontal) {
    const count = Math.max(2, Math.floor(len / 2.5));
    const pos = [];
    for (let i = 0; i < count; i++) {
      const t = -len / 2 + i * (len / (count - 1));
      pos.push(new THREE.Vector3(horizontal ? x + t : x, 0.6, horizontal ? z : z + t));
    }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 1.1, 0.15), this._fenceMat, count);
    const m = new THREE.Matrix4();
    pos.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m); });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = true;
    this.addObj(im);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? len : 0.1, 0.1, horizontal ? 0.1 : len),
      this._fenceMat
    );
    rail.position.set(x, 0.85, z);
    rail.castShadow = true;
    this.addObj(rail);
  }

  addDesert(scene) {
    const bandW = OUTER_RING - ROAD_EDGE;
    const cx = (OUTER_RING + ROAD_EDGE) / 2;
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(bandW + 8, OUTER_RING * 2 + 8),
      new THREE.MeshStandardMaterial({ color: 0xd9b44a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(cx, 0.05, 0);
    sand.receiveShadow = true;
    this.addObj(sand);

    for (let i = 0; i < 34; i++) {
      const x = ROAD_EDGE + 50 + Math.random() * (bandW - 70);
      const z = (Math.random() * 2 - 1) * (OUTER_RING - 70);
      if (this.isInLake(x, z)) continue;
      this.addCactus(x, z, 0.8 + Math.random() * 0.7);
    }
    for (let i = 0; i < 26; i++) {
      const x = ROAD_EDGE + 60 + Math.random() * (bandW - 80);
      const z = (Math.random() * 2 - 1) * (OUTER_RING - 70);
      if (this.isInLake(x, z)) continue;
      this.addRock(x, z, 0.7 + Math.random() * 1.4);
    }
    for (let i = 0; i < 14; i++) {
      const x = ROAD_EDGE + 80 + Math.random() * (bandW - 100);
      const z = (Math.random() * 2 - 1) * (OUTER_RING - 70);
      if (this.isInLake(x, z)) continue;
      this.addDune(x, z, 5 + Math.random() * 7);
    }
  }

  isInLake(x, z) {
    return Math.hypot(x - LAKE_CENTER.x, z - LAKE_CENTER.y) < LAKE_RADIUS + 6;
  }

  isNearRoad(x, z) {
    const e = ROAD_EDGE, m = 45;
    if (Math.abs(x) < e + m && Math.abs(z) < e + m) return true;
    if (Math.abs(Math.abs(x) - e) < m) return true;
    if (Math.abs(Math.abs(z) - e) < m) return true;
    return false;
  }

  addVillage(scene) {
    const vm = this.manager.villageModels;
    if (!vm || Object.keys(vm).length === 0) {
      this.addVillageProcedural();
      return;
    }
    const houseTypes = this.villageHouseTypes();
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const minX = -(OUTER_RING - 40);
    const maxX = -(ROAD_EDGE + 60);
    const minZ = -(OUTER_RING - 60);
    const maxZ = OUTER_RING - 60;

    const placed = [];
    for (let i = 0; i < 34; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const z = minZ + Math.random() * (maxZ - minZ);
      if (this.isNearRoad(x, z)) continue;
      if (placed.some(h => Math.hypot(x - h.x, z - h.z) < h.r + 10)) continue;
      const g = this.addVillageModel(pick(houseTypes), x, z, Math.random() * Math.PI, 2.3);
      if (!g) continue;
      const box = new THREE.Box3().setFromObject(g);
      const size = box.getSize(new THREE.Vector3());
      const r = Math.max(size.x, size.z) / 2 + 1.2;
      this.buildings.push({ x, z, r });
      placed.push({ x, z, r, g });
    }

    placed.forEach((h) => {
      const fR = h.r + 3;
      if (Math.random() < 0.75) {
        this.addVillageModel(pick(['fence', 'fence-low', 'fence-1x2', 'fence-1x3', 'fence-1x4', 'fence-2x2', 'fence-2x3']), h.x + fR, h.z, Math.PI / 2, 1.5);
      }
      if (Math.random() < 0.6) {
        this.addVillageModel(pick(['fence', 'fence-low', 'fence-1x2', 'fence-1x3', 'fence-1x4', 'fence-2x2']), h.x - fR, h.z, Math.PI / 2, 1.5);
      }
      if (Math.random() < 0.55) {
        this.addVillageModel(pick(['fence', 'fence-low', 'fence-1x2', 'fence-1x3', 'fence-1x4']), h.x, h.z + fR, 0, 1.5);
      }
      if (Math.random() < 0.5) {
        this.addVillageModel(pick(['fence', 'fence-low', 'fence-1x2', 'fence-1x3']), h.x, h.z - fR, 0, 1.5);
      }
      if (Math.random() < 0.65) {
        this.addVillageModel(pick(['driveway-short', 'driveway-long', 'path-short', 'path-long', 'path-stones-short', 'path-stones-long', 'path-stones-messy']), h.x, h.z + fR + 1.5, 0, 1.5);
      }
      if (Math.random() < 0.5) {
        this.addVillageModel('planter', h.x + (Math.random() < 0.5 ? fR : -fR), h.z + (Math.random() < 0.5 ? fR : -fR), Math.random() * Math.PI, 1.5);
      }
      if (Math.random() < 0.4) {
        this.addVillageModel('planter', h.x + (Math.random() < 0.5 ? fR * 0.5 : -fR * 0.5), h.z + (Math.random() < 0.5 ? fR : -fR), Math.random() * Math.PI, 1.5);
      }
    });

    for (let i = 0; i < 90; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const z = minZ + Math.random() * (maxZ - minZ);
      if (this.isNearRoad(x, z)) continue;
      if (placed.some(h => Math.hypot(x - h.x, z - h.z) < h.r + 2)) continue;
      const s = 0.9 + Math.random() * 0.6;
      this.addVillageModel(Math.random() < 0.55 ? 'tree-small' : 'tree-large', x, z, Math.random() * Math.PI * 2, s);
      if (Math.random() < 0.3) this.buildings.push({ x, z, r: 0.9 * s });
    }

    for (let i = 0; i < 14; i++) {
      const z = minZ + Math.random() * (maxZ - minZ);
      if (Math.abs(Math.abs(z) - ROAD_EDGE) < 45) continue;
      const side = Math.random() < 0.5;
      const x = side ? -(ROAD_EDGE + 70) - Math.random() * 120 : -(OUTER_RING - 60);
      const g = this.addVillageModel(pick(['fence', 'fence-low', 'fence-1x2', 'fence-1x3', 'fence-2x2']), x, z, side ? 0 : Math.PI / 2, 1);
      if (g) {
        const box = new THREE.Box3().setFromObject(g);
        const size = box.getSize(new THREE.Vector3());
        this.buildings.push({ x, z, r: Math.max(size.x, size.z) / 2 + 0.6 });
      }
    }
  }

  addVillageProcedural() {
    for (let i = 0; i < 24; i++) {
      const x = -(ROAD_EDGE + 70) - Math.random() * (OUTER_RING - ROAD_EDGE - 120);
      const z = (Math.random() * 2 - 1) * (OUTER_RING - 90);
      this.addVillageHouse(x, z, Math.random() * Math.PI);
    }
    for (let i = 0; i < 90; i++) {
      const x = -(ROAD_EDGE + 90) - Math.random() * (OUTER_RING - ROAD_EDGE - 150);
      const z = (Math.random() * 2 - 1) * (OUTER_RING - 90);
      this.addTree(x, z, 0.8 + Math.random() * 0.6);
    }
    const fences = [
      { x: -(ROAD_EDGE + 150), z: -140, len: 26, horizontal: false },
      { x: -(ROAD_EDGE + 180), z: -40, len: 30, horizontal: true },
      { x: -(ROAD_EDGE + 320), z: 260, len: 26, horizontal: false },
      { x: -(ROAD_EDGE + 430), z: -300, len: 30, horizontal: true }
    ];
    fences.forEach(f => this.addFence(f.x, f.z, f.len, f.horizontal));
  }

  addCountryside(scene) {
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() * 2 - 1) * (ROAD_EDGE - 40);
      const z = -(ROAD_EDGE + 60) - Math.random() * (OUTER_RING - ROAD_EDGE - 100);
      this.addTree(x, z, 0.8 + Math.random() * 0.6);
    }
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() * 2 - 1) * (ROAD_EDGE - 40);
      const z = ROAD_EDGE + 60 + Math.random() * (OUTER_RING - ROAD_EDGE - 100);
      this.addTree(x, z, 0.8 + Math.random() * 0.6);
    }
    for (let i = 0; i < 24; i++) {
      const x = (Math.random() * 2 - 1) * (OUTER_RING + 100);
      const z = (Math.random() * 2 - 1) * (OUTER_RING + 100);
      if (Math.abs(x) > OUTER_RING + 30 && Math.abs(z) > OUTER_RING + 30) {
        this.addRock(x, z, 1 + Math.random() * 2);
      }
    }
  }

  addWaterZone(scene) {
    const cx = LAKE_CENTER.x, cz = LAKE_CENTER.y, r = LAKE_RADIUS;
    const boatModels = this.manager.boatModels;

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a75c4,
      emissive: 0x0a3a6b,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.88,
      roughness: 0.1,
      metalness: 0.2,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    const water = new THREE.Mesh(new THREE.CircleGeometry(r, 48), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, 0.16, cz);
    water.receiveShadow = true;
    this.addObj(water);
    this.lakeWater = water;

    const deepMat = new THREE.MeshStandardMaterial({
      color: 0x0e4d8c,
      transparent: true,
      opacity: 0.55,
      roughness: 0.2,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    const deep = new THREE.Mesh(new THREE.CircleGeometry(r * 0.72, 40), deepMat);
    deep.rotation.x = -Math.PI / 2;
    deep.position.set(cx, 0.14, cz);
    deep.receiveShadow = true;
    this.addObj(deep);

    const shoreMat = new THREE.MeshStandardMaterial({ color: 0xd9b44a, roughness: 1 });
    const shore = new THREE.Mesh(new THREE.RingGeometry(r - 4, r + 8, 40), shoreMat);
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(cx, 0.1, cz);
    shore.receiveShadow = true;
    this.addObj(shore);

    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const rr = r + 2 + Math.random() * 10;
      const rx = cx + Math.cos(a) * rr;
      const rz = cz + Math.sin(a) * rr;
      if (Math.hypot(rx - DOCK_POS.x, rz - DOCK_POS.z) < 26) continue;
      this.addRock(rx, rz, 0.6 + Math.random() * 1.2);
    }

    this.addDock(scene);

    if (boatModels && Object.keys(boatModels).length) {
      this.spawnBoats(scene);
    }
  }

  addDock(scene) {
    const wood = this._houseWood;
    const addPlank = (x, z, w, h, l, rotY = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), wood);
      m.position.set(x, h / 2 + 0.16, z);
      m.rotation.y = rotY;
      m.castShadow = true;
      m.receiveShadow = true;
      this.addObj(m);
    };
    const dx = DOCK_POS.x, dz = DOCK_POS.z;
    for (let i = 0; i < 14; i++) addPlank(dx + i * 2.2, dz, 2.6, 0.28, 4.6);
    for (let i = 0; i < 14; i++) addPlank(dx + i * 2.2, dz - 4.2, 2.6, 0.28, 4.6);
    addPlank(dx + 13 * 2.2 + 1.1, dz - 2.1, 2.8, 0.34, 11, Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      addPlank(dx + i * 2.2 + 1.1, dz - 2.1, 2.2, 0.24, 6.2, Math.PI / 2);
    }
    for (let i = 0; i < 7; i++) {
      const px = dx + i * 5;
      for (const pz of [dz - 3.4, dz + 1.4]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), this._rockMat);
        post.position.set(px, 0.6, pz);
        post.castShadow = true;
        this.addObj(post);
      }
    }
  }

  spawnBoats(scene) {
    const bm = this.manager.boatModels;
    if (!bm) return;
    const dx = DOCK_POS.x, dz = DOCK_POS.z;

    const driveable = [
      { name: 'boat-speed-a', x: dx + 15, z: dz - 7 },
      { name: 'boat-speed-b', x: dx + 20, z: dz - 7 },
      { name: 'boat-speed-c', x: dx + 25, z: dz - 7 },
      { name: 'boat-speed-d', x: dx + 30, z: dz - 7 }
    ];
    driveable.forEach((s, i) => {
      const model = bm[s.name];
      if (!model) return;
      const boat = new Boat(scene, model, s.x, s.z, s.name, 2);
      boat.mesh.rotation.y = -Math.PI / 2;
      boat.vacate();
      this.parkedBoats.push(boat);
    });

    if (bm['boat-house-a']) {
      const hb = new Boat(scene, bm['boat-house-a'], dx - 6, dz - 16, 'house boat', 2.4);
      hb.mesh.rotation.y = Math.PI;
      hb.vacate();
    }
    if (bm['boat-sail-a']) {
      const sa = new Boat(scene, bm['boat-sail-a'], LAKE_CENTER.x - 90, LAKE_CENTER.y + 120, 'sail boat', 2.2);
      sa.mesh.rotation.y = 0.8;
      sa.vacate();
    }
    if (bm['boat-row-large']) {
      const rb = new Boat(scene, bm['boat-row-large'], LAKE_CENTER.x + 60, LAKE_CENTER.y + 170, 'row boat', 2);
      rb.mesh.rotation.y = 2.4;
      rb.vacate();
    }
    if (bm['ship-small']) {
      const sh = new Boat(scene, bm['ship-small'], LAKE_CENTER.x + 20, LAKE_CENTER.y - 60, 'small ship', 2.6);
      sh.mesh.rotation.y = -1.2;
      sh.vacate();
    }

    for (let i = 0; i < 8; i++) {
      if (!bm['buoy']) break;
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const rr = LAKE_RADIUS - 14 - Math.random() * 20;
      const bu = new Boat(scene, bm['buoy'], LAKE_CENTER.x + Math.cos(a) * rr, LAKE_CENTER.y + Math.sin(a) * rr, 'buoy', 1.6);
      bu.vacate();
    }
  }

  nearestParkedBoat(r) {
    let best = null, bestD = r;
    for (const b of this.parkedBoats) {
      const d = Math.hypot(this.footPos.x - b.mesh.position.x, this.footPos.z - b.mesh.position.z);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  enterBoat(boat) {
    if (!boat) return;
    this.currentBoat = boat;
    boat.occupy();
    this.onFoot = false;
    this.syncHUD();
    this.manager.camera.fov = CONFIG.camera.minFov;
    this.manager.camera.updateProjectionMatrix();
this._targetFov = CONFIG.camera.minFov;
     this.sound.startEngine();
     this.sound.setEngineType(this.currentCar ? this.currentCar.carId : 'sedan');
     this.updateFootPrompt();
  }

  exitBoat() {
    const boat = this.currentBoat;
    if (!boat) return;
    const a = Math.atan2(boat.mesh.position.x - LAKE_CENTER.x, boat.mesh.position.z - LAKE_CENTER.y);
    const sx = LAKE_CENTER.x + Math.sin(a) * (LAKE_RADIUS - 6);
    const sz = LAKE_CENTER.y + Math.cos(a) * (LAKE_RADIUS - 6);
    this.footPos.set(sx, 0, sz);
    this.footYaw = a;
    this.footPitch = 0;
    this.footY = 0;
    this.footVelY = 0;
    boat.vacate();
    this.currentBoat = null;
    this.onFoot = true;
    this.sound.stopEngine();
    this.syncHUD();
    this.updateFootPrompt();
  }

  updateBoat(dt) {
    const boat = this.currentBoat;
    if (!boat) return;
    const mergedInput = {
      forward: this.input.forward || this.touchInput.forward,
      backward: this.input.backward || this.touchInput.backward,
      left: this.input.left || this.touchInput.left,
      right: this.input.right || this.touchInput.right,
      boost: this.input.boost || this.touchInput.boost
    };
    boat.boost = mergedInput.boost;
    boat.drive(mergedInput, dt);

    const dx = boat.mesh.position.x - LAKE_CENTER.x;
    const dz = boat.mesh.position.z - LAKE_CENTER.y;
    const d = Math.hypot(dx, dz);
    const maxD = LAKE_RADIUS - 7;
    if (d > maxD) {
      const nx = dx / (d || 1), nz = dz / (d || 1);
      boat.mesh.position.x = LAKE_CENTER.x + nx * maxD;
      boat.mesh.position.z = LAKE_CENTER.y + nz * maxD;
      boat.speed *= 0.55;
    }

    const cam = this.manager.camera;
    const dirX = -Math.sin(this.cameraAngle);
    const dirZ = -Math.cos(this.cameraAngle);
    const viewX = -dirX, viewZ = -dirZ;
    const camDist = this.camZoom ? 6 : 11;
    const camHeight = this.camZoom ? 2 : 7;
    const target = new THREE.Vector3(
      boat.mesh.position.x + viewX * 4,
      1.2,
      boat.mesh.position.z + viewZ * 4
    );
    this.cameraTarget.lerp(target, 0.15);
    const targetCamPos = new THREE.Vector3(
      boat.mesh.position.x + dirX * camDist,
      camHeight,
      boat.mesh.position.z + dirZ * camDist
    );
    cam.position.lerp(targetCamPos, CONFIG.camera.lerpSpeed);
    cam.lookAt(this.cameraTarget);

    const speedKmh = Math.abs(boat.speed) * 3.6;
    this._targetFov = CONFIG.camera.minFov + (CONFIG.camera.maxFov - CONFIG.camera.minFov) * Math.min(1, speedKmh / (boat.maxSpeed * 3.6));
    cam.fov = THREE.MathUtils.lerp(cam.fov, this._targetFov, dt * 5);
    cam.updateProjectionMatrix();

    this.sound.updateEngine(Math.abs(boat.speed), boat.maxSpeed);
    this.updateWater(dt);

    if (this.hudEls.speed) this.hudEls.speed.textContent = Math.round(speedKmh);
    if (this.hudEls.speedBar) {
      const pct = Math.min(100, (Math.abs(boat.speed) / boat.maxSpeed) * 100);
      this.hudEls.speedBar.style.transform = `rotate(${-120 + (pct / 100) * 240}deg)`;
    }
    if (this.hudEls.fuel) this.hudEls.fuel.textContent = '∞';
    if (this.hudEls.fuelBar) this.hudEls.fuelBar.style.width = '100%';
    if (this.hudEls.damage) this.hudEls.damage.textContent = 'WATER';
    if (this.hudEls.damageBar) this.hudEls.damageBar.style.width = '100%';
    if (this.hudEls.car) this.hudEls.car.textContent = '🚤 ' + boat.name.toUpperCase();

    this.drawMinimap();
    this.updateFootPrompt();
  }

  updateWater(dt) {
    if (!this.lakeWater) return;
    this._waterTime += dt;
this.lakeWater.material.opacity = 0.84 + Math.sin(this._waterTime * 1.6) * 0.04;
   }

   createRainSystem() {
     const count = 5000;
     const positions = new Float32Array(count * 3);
     for (let i = 0; i < count; i++) {
       positions[i * 3] = (Math.random() - 0.5) * 200;
       positions[i * 3 + 1] = Math.random() * 50;
       positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
     }
     this.rainGeo = new THREE.BufferGeometry();
     this.rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
     this.rainMat = new THREE.PointsMaterial({
       color: 0xaaaacc,
       size: 0.15,
       transparent: true,
       opacity: 0,
       depthWrite: false,
       blending: THREE.AdditiveBlending
     });
     this.rainParticles = new THREE.Points(this.rainGeo, this.rainMat);
     this.rainParticles.frustumCulled = false;
     this.manager.scene.add(this.rainParticles);
   }

   updateWeather(dt) {
     this.weatherTimer += dt;
     if (this.weatherTimer > 30 + Math.random() * 60) {
       this.weatherTimer = 0;
       this.weatherTarget = Math.random() < 0.3 ? 1 : 0;
     }
     this.weatherIntensity += (this.weatherTarget - this.weatherIntensity) * dt * 0.5;
     this.weatherType = this.weatherIntensity > 0.1 ? 1 : 0;

     if (this.rainParticles) {
       this.rainMat.opacity = this.weatherIntensity * 0.6;
       const positions = this.rainGeo.attributes.position;
       const count = positions.count;
       for (let i = 0; i < count; i++) {
         let y = positions.getY(i);
         y -= dt * (20 + this.weatherIntensity * 30);
         if (y < 0) y = 50;
         positions.setY(i, y);
       }
       positions.needsUpdate = true;
     }

     const fogDensity = this.weatherType === 1 ? 0.008 + this.weatherIntensity * 0.012 : 0.003;
     const fogColor = this.weatherType === 1 ? 0x8899aa : 0xc8d0d8;
     if (this.manager.scene.fog) {
       this.manager.scene.fog.density = THREE.MathUtils.lerp(
         this.manager.scene.fog.density || 0.003,
         fogDensity,
         dt * 0.3
       );
     }

     this.roadGripMult = this.weatherType === 1 ? 1 - this.weatherIntensity * 0.4 : 1;

     if (this.hudEls.zone) {
       if (this.weatherType === 1 && this.weatherIntensity > 0.3) {
         this.hudEls.zone.textContent = '🌧 RAIN';
       } else {
         this.hudEls.zone.textContent = '';
       }
     }
   }

  updateFootPrompt() {
    const el = document.getElementById('fp-prompt');
    const ch = document.getElementById('fp-crosshair');
    if (!el || !ch) return;
    if (!this.onFoot) { el.style.display = 'none'; ch.style.display = 'none'; return; }
    ch.style.display = 'block';
    const car = this.nearestParkedCar(3);
    const boat = this.nearestParkedBoat(4.5);
    if (boat) {
      el.style.display = 'block';
      el.textContent = 'Press E to enter boat';
    } else if (car) {
      el.style.display = 'block';
      el.textContent = 'Press E to enter car';
    } else {
      el.style.display = 'none';
    }
  }

  addRoads(scene) {
    const e = ROAD_EDGE, h = ROAD_HALF, rw = ROAD_W;
    const asphaltMat = new THREE.MeshStandardMaterial({ map: this.makeAsphaltTex(), roughness: 0.9, metalness: 0.01, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

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
      m.position.set(x, 0.12, z);
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

    const plazaMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.85, metalness: 0.02, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(rw * 0.95, 32), plazaMat);
    plaza.position.set(0, 0.14, 0); plaza.rotation.x = -Math.PI / 2; this.addObj(plaza);
    const plazaRing = new THREE.Mesh(new THREE.RingGeometry(rw * 0.75, rw * 0.8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    plazaRing.position.set(0, 0.17, 0); plazaRing.rotation.x = -Math.PI / 2; this.addObj(plazaRing);

    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const dashHGeo = new THREE.PlaneGeometry(3, 0.35); dashHGeo.rotateX(-Math.PI / 2);
    const dashVGeo = new THREE.PlaneGeometry(0.35, 3); dashVGeo.rotateX(-Math.PI / 2);
    const dashY = 0.18;
    const dashHPos = [];
    const dashVPos = [];
    const addDashes = (cx, cz, horizontal, segments) => {
      segments.forEach(([a, b]) => {
        const dashLen = 3.5, gap = 4.5;
        const count = Math.floor((b - a) / (dashLen + gap));
        for (let i = 0; i < count; i++) {
          const t = a + i * (dashLen + gap) + dashLen / 2;
          if (horizontal) dashHPos.push(new THREE.Vector3(cx + t, dashY, cz));
          else dashVPos.push(new THREE.Vector3(cx, dashY, cz + t));
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
    const makeInstanced = (geo, mat, positions, shadows = true) => {
      if (positions.length === 0) return;
      const im = new THREE.InstancedMesh(geo, mat, positions.length);
      const m = new THREE.Matrix4();
      positions.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, m); });
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = shadows;
      im.receiveShadow = shadows;
      this.addObj(im);
    };
    makeInstanced(dashHGeo, yellowMat, dashHPos, false);
    makeInstanced(dashVGeo, yellowMat, dashVPos, false);

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
    const barrierTopMat = new THREE.MeshStandardMaterial({ color: 0xff6666, roughness: 0.5, metalness: 0.2 });
    const barrierGeo = new THREE.BoxGeometry(0.15, 0.9, 2);
    const barrierTopGeo = new THREE.BoxGeometry(2.5, 0.15, 0.5); barrierTopGeo.rotateX(-Math.PI / 2);
    const postPos = [];
    const topPos = [];
    const addBarrier = (cx, cz, length, horizontal) => {
      const count = Math.floor(length / 4);
      for (let i = 0; i < count; i++) {
        const t = -length / 2 + i * 4 + 2;
        const x = horizontal ? cx + t : cx;
        const z = horizontal ? cz : cz + t;
        postPos.push(new THREE.Vector3(x, 0.45, z));
        topPos.push(new THREE.Vector3(x, 0.95, z));
      }
    };
    const bb = e + h + SW + 2;
    addBarrier(0, -bb, e * 2 - 40, true);
    addBarrier(0, bb, e * 2 - 40, true);
    addBarrier(-bb, 0, e * 2 - 40, false);
    addBarrier(bb, 0, e * 2 - 40, false);
    makeInstanced(barrierGeo, barrierMat, postPos);
    makeInstanced(barrierTopGeo, barrierTopMat, topPos);

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
      for (let x = -(e - 60); x <= e - 60; x += 600) {
        addStreetLight(x, side * (inner - 0.5), -side);
      }
    }
    for (let side = -1; side <= 1; side += 2) {
      for (let z = -(e - 80); z <= e - 80; z += 700) {
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

   _roadRects() {
     const e = ROAD_EDGE, h = ROAD_HALF + 1;
     const q = e - h;
     return [
       { minX: -h, maxX: h, minZ: -q, maxZ: q },
       { minX: -q, maxX: q, minZ: -h, maxZ: h },
       { minX: e - h, maxX: e + h, minZ: -e, maxZ: e },
       { minX: -e - h, maxX: -e + h, minZ: -e, maxZ: e },
       { minX: -e, maxX: e, minZ: e - h, maxZ: e + h },
       { minX: -e, maxX: e, minZ: -e - h, maxZ: -e + h }
     ];
   }

   _overlapsRoad(box) {
     const r = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
     for (const road of this._roadRects()) {
       if (r.maxX > road.minX && r.minX < road.maxX && r.maxZ > road.minZ && r.minZ < road.maxZ) return true;
     }
     return false;
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
     const step = 120;

     const addBuilding = (x, z, sc) => {
       const name = buildingNames[Math.floor(Math.random() * buildingNames.length)];
       const rot = orients[Math.floor(Math.random() * orients.length)];
       const mesh = place(name, x, z, rot, sc);
       if (!mesh) return;
       if (this._overlapsRoad(new THREE.Box3().setFromObject(mesh))) {
         this.manager.scene.remove(mesh);
         const i = this.sceneObjects.indexOf(mesh);
         if (i >= 0) this.sceneObjects.splice(i, 1);
         return;
       }
       this.buildings.push({ mesh, x, z, r: sc * 0.75 });
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
          c.castShadow = false;
          c.receiveShadow = false;
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

  createNameLabel(name, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.roundRect(0, 10, 256, 44, 12);
    ctx.fill();
    ctx.fillStyle = accent || '#ffffff';
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

  makeLeaderboardTexture(recs) {
    const data = recs || {};
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a1420';
    ctx.fillRect(0, 0, 512, 1024);
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 492, 1004);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffaa44';
    ctx.font = 'bold 48px Orbitron, Arial';
    ctx.fillText('TOP DRIVERS', 256, 70);
    const drawList = (label, list, y, suffix) => {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff8844';
      ctx.font = 'bold 30px Orbitron, Arial';
      ctx.fillText(label, 256, y);
      ctx.textAlign = 'left';
      const rows = Array.isArray(list) ? list.slice(0, 5) : [];
      for (let i = 0; i < 5; i++) {
        const ry = y + 42 + i * 72;
        const entry = rows[i];
        ctx.fillStyle = '#7fd4ff';
        ctx.font = 'bold 26px Orbitron, Arial';
        ctx.fillText('#' + (i + 1), 30, ry);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Orbitron, Arial';
        ctx.fillText(entry && entry.name ? entry.name : '---', 80, ry);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#7fd4ff';
        ctx.font = 'bold 26px Orbitron, Arial';
        ctx.fillText(entry && entry.value ? `${Math.round(entry.value)} ${suffix}` : '', 482, ry);
      }
    };
    drawList('TOP DRIFTER', data.bestDrift, 200, 'PTS');
    drawList('TOP SPEED', data.bestSpeed, 620, 'KM/H');
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  createBillboardMesh(x, z, rotY) {
    const mat = new THREE.MeshBasicMaterial({
      map: this.makeLeaderboardTexture(this.records),
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(11, 22), mat);
    mesh.position.set(x, 11, z);
    mesh.rotation.y = rotY;
    this.addObj(mesh);
    this.billboardScreens.push(mesh);
    return mesh;
  }

  createBillboards() {
    if (this.billboards) return;
    this.billboards = [];
    this.billboardScreens = [];
    this.records = { bestSpeed: [], bestDrift: [] };
    const e = ROAD_EDGE, O = OUTER_RING, d = 40;
    const face = (x, z) => Math.atan2(-x, -z);
    const spots = [
      [55, 45, face(55, 45)],
      [80, e - d, face(80, e - d)],
      [-80, -(e - d), face(-80, -(e - d))],
      [e - d, 80, face(e - d, 80)],
      [-(e - d), -80, face(-(e - d), -80)],
      [e - d, e - d, face(e - d, e - d)],
      [e - d, -(e - d), face(e - d, -(e - d))],
      [-(e - d), e - d, face(-(e - d), e - d)],
      [-(e - d), -(e - d), face(-(e - d), -(e - d))],
      [O - d, O - d, face(O - d, O - d)],
      [O - d, -(O - d), face(O - d, -(O - d))],
      [-(O - d), O - d, face(-(O - d), O - d)],
      [-(O - d), -(O - d), face(-(O - d), -(O - d))]
    ];
    spots.forEach(([x, z, ry]) => this.billboards.push(this.createBillboardMesh(x, z, ry)));
    RecordsService.subscribe((key, rec) => {
      if (key === 'bestSpeed') this.records.bestSpeed = rec;
      else if (key === 'bestDrift') this.records.bestDrift = rec;
      this.refreshLeaderboards();
    }).then(un => { this.recordsUnsub = un; });
    this._boardTimer = setInterval(() => this.refreshLeaderboards(RecordsService.snapshot()), 5000);
  }

  refreshLeaderboards(recs) {
    if (!this.billboards) return;
    if (recs) {
      if (Array.isArray(recs.bestSpeed)) this.records.bestSpeed = recs.bestSpeed;
      if (Array.isArray(recs.bestDrift)) this.records.bestDrift = recs.bestDrift;
    }
    const tex = this.makeLeaderboardTexture(this.records);
    if (this.billboardScreens && this.billboardScreens.length) {
      this.billboardScreens.forEach(mesh => {
        if (mesh.material) {
          mesh.material.map = tex;
          mesh.material.needsUpdate = true;
        }
      });
      return;
    }
    this.billboards.forEach(mesh => {
      if (mesh.material) {
        mesh.material.map = tex;
        mesh.material.needsUpdate = true;
      }
    });
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
              const ghost = new Car(this.manager.scene, model, p.x || 0, p.z || 0, p.name || 'Player', CAR_IDS[p.carIdx] || CAR_IDS[0]);
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
    this.addObj(this.sunLight.target);
  }

updateLighting(dt) {
     this.dayTime += dt / DAY_DURATION;
     if (this.dayTime > 24) this.dayTime -= 24;
     this.seasonTimer += dt;
     if (this.seasonTimer > this.seasonDuration) {
       this.seasonTimer = 0;
       const seasons = ['spring', 'summer', 'autumn', 'winter'];
       const idx = (seasons.indexOf(this.season) + 1) % seasons.length;
       this.season = seasons[idx];
       this._showToast(`Season changed: ${this.season.toUpperCase()}`, '#88ff88');
     }
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
    const sunOffX = Math.cos(sunAngle) * 80;
    const sunOffY = Math.sin(sunAngle) * 80 + 10;
    const sunOffZ = 30;
    const cp = this.onFoot
      ? this.footPos
      : (this.currentBoat
        ? this.currentBoat.mesh.position
        : (this.currentCar ? this.currentCar.mesh.position : { x: 0, z: 0 }));
    this.sunLight.position.set(cp.x + sunOffX, sunOffY, cp.z + sunOffZ);
    if (this.sunLight.target) this.sunLight.target.position.set(cp.x, 0, cp.z);

    this.ambientLight.color.copy(ambColor);
    this.ambientLight.intensity = Math.max(0.05, ambIntensity);

    this.hemiLight.color.copy(hemiColor);
    this.hemiLight.intensity = Math.max(0.03, hemiIntensity);

    const tex = this.manager.skyboxes?.['day'];
    this.manager.scene.background = tex || new THREE.Color(0xc8d0d8);
    this.manager.scene.fog = new THREE.Fog(0xc8d0d8, 120, 1000);
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
    const car = new Car(scene, model, startX, startZ, displayName, id);
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
    if (this.playerName) {
      const label = this.createNameLabel(this.playerName, '#ff6b35');
      car.mesh.add(label);
      this.playerLabel = label;
    }

    if (this.multi) {
      car.occupy();
      this.onFoot = false;
      this.syncHUD();
      this.createHeadlights(scene);
      this.manager.camera.fov = CONFIG.camera.minFov;
      this.manager.camera.updateProjectionMatrix();
this._targetFov = CONFIG.camera.minFov;
       this.sound.startEngine();
       this.sound.setEngineType(this.currentCar ? this.currentCar.carId : 'sedan');
       this.sound.startTire();
      this.createExhaust();
      this.createNitrousFlame();
      this.createSpeedLines();
      return;
    }

    car.vacate();
    this.parkedCars.push(car);
    this.spawnParkedCars(scene);
    this.onFoot = true;
    this.footPos.set(startX + 3, 0, startZ + 3);
    this.footYaw = 0;
    this.footPitch = 0;
    this.footY = 0;
    this.footVelY = 0;
    this.manager.camera.fov = CONFIG.camera.minFov;
    this.manager.camera.updateProjectionMatrix();
    this._targetFov = CONFIG.camera.minFov;
    this.syncHUD();
  }

  spawnParkedCars(scene) {
    if (this.multi) return;
    const spots = [
      { x: 45, z: 30 }, { x: -45, z: -30 }, { x: 30, z: -45 }, { x: -30, z: 45 },
      { x: 120, z: 90 }, { x: -120, z: -90 }, { x: 90, z: -120 }, { x: -90, z: 120 }
    ];
    spots.forEach((s, i) => {
      const id = CAR_IDS[(this.selectedIdx + i + 1) % CAR_IDS.length];
      const model = this.manager.models[id];
      if (!model) return;
      const car = new Car(scene, model, s.x, s.z, CONFIG.cars[id] || id, id);
      car.mesh.rotation.y = (i % 4) * Math.PI / 2;
      car.vacate();
      this.parkedCars.push(car);
    });
  }

  nearestParkedCar(r) {
    if (!this.currentCar) return null;
    let best = null, bestD = r;
    for (const c of this.parkedCars) {
      const d = Math.hypot(this.footPos.x - c.mesh.position.x, this.footPos.z - c.mesh.position.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

enterCar(car) {
     if (!car) return;
     if (!ProgressService.owns(car.carId)) {
       this._showToast('This car is locked! Buy it in Garage (G)', '#ff4444');
       return;
     }
     this.currentCar = car;
     car.occupy();
     this.onFoot = false;
     this.syncHUD();
     this.createHeadlights(this.manager.scene);
     this.manager.camera.fov = CONFIG.camera.minFov;
     this.manager.camera.updateProjectionMatrix();
     this._targetFov = CONFIG.camera.minFov;
     this.sound.startEngine();
     this.sound.setEngineType(this.currentCar ? this.currentCar.carId : 'sedan');
     this.sound.startTire();
     this.createExhaust();
     this.createNitrousFlame();
     this.createSpeedLines();
     this.updateFootPrompt();
   }

  exitCar() {
    const car = this.currentCar;
    if (!car) return;
    const a = car.mesh.rotation.y;
    const bx = car.mesh.position.x - Math.sin(a) * 2.2;
    const bz = car.mesh.position.z - Math.cos(a) * 2.2;
    this.footPos.set(bx, 0, bz);
    this.footYaw = a;
    this.footPitch = 0;
    this.footY = 0;
    this.footVelY = 0;
    car.vacate();
    this.onFoot = true;
    this.sound.stopEngine();
    this.sound.stopTire();
    this.headlights.forEach(h => { if (h.parent) h.parent.remove(h); if (h.target?.parent) h.target.parent.remove(h.target); });
    this.headlights = [];
    this.syncHUD();
    this.updateFootPrompt();
  }

  toggleFootCar() {
    if (this.onFoot) {
      const car = this.nearestParkedCar(3);
      const boat = this.nearestParkedBoat(4.5);
      if (boat && (!car || Math.hypot(this.footPos.x - boat.mesh.position.x, this.footPos.z - boat.mesh.position.z) < Math.hypot(this.footPos.x - car.mesh.position.x, this.footPos.z - car.mesh.position.z))) {
        this.enterBoat(boat);
      } else if (car) {
        this.enterCar(car);
      }
    } else if (this.currentBoat) {
      this.exitBoat();
    } else {
      this.exitCar();
    }
  }

  updateFoot(dt) {
    const cam = this.manager.camera;
    const speed = this.input.boost ? 8 : 4.5;
    const sinY = Math.sin(this.footYaw), cosY = Math.cos(this.footYaw);
    const fwd = { x: -sinY, z: -cosY };
    const right = { x: cosY, z: -sinY };
    let mx = 0, mz = 0;
    if (this.input.forward) { mx += fwd.x; mz += fwd.z; }
    if (this.input.backward) { mx -= fwd.x; mz -= fwd.z; }
    if (this.input.right) { mx += right.x; mz += right.z; }
    if (this.input.left) { mx -= right.x; mz -= right.z; }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx = mx / len * speed * dt;
      mz = mz / len * speed * dt;
      this.footPos.x += mx;
      this.footPos.z += mz;
    }
    if (this.input.boost && this.footY <= 0.01) this.footVelY = 6;
    this.footVelY -= 12 * dt;
    this.footY += this.footVelY * dt;
    if (this.footY < 0) { this.footY = 0; this.footVelY = 0; }

    const edge = CONFIG.world.half - 40;
    this.footPos.x = Math.max(-edge, Math.min(edge, this.footPos.x));
    this.footPos.z = Math.max(-edge, Math.min(edge, this.footPos.z));

    const ldx = this.footPos.x - LAKE_CENTER.x;
    const ldz = this.footPos.z - LAKE_CENTER.y;
    const ld = Math.hypot(ldx, ldz);
    if (ld < LAKE_RADIUS - 100) {
      const nx = ldx / (ld || 1), nz = ldz / (ld || 1);
      this.footPos.x = LAKE_CENTER.x + nx * (LAKE_RADIUS - 100);
      this.footPos.z = LAKE_CENTER.y + nz * (LAKE_RADIUS - 100);
    }

    cam.position.set(this.footPos.x, this.footY + 1.7, this.footPos.z);
    const pitch = this.footPitch;
    const lx = -sinY * Math.cos(pitch);
    const ly = Math.sin(pitch);
    const lz = -cosY * Math.cos(pitch);
    cam.lookAt(cam.position.x + lx, cam.position.y + ly, cam.position.z + lz);
    cam.fov = THREE.MathUtils.lerp(cam.fov, CONFIG.camera.minFov + 12, dt * 5);
    cam.updateProjectionMatrix();
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
    const e = ROAD_EDGE, h = ROAD_HALF, O = OUTER_RING, m = O + h;
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
    hstrip(-O);
    hstrip(O);
    vstrip(-O);
    vstrip(O);
    return best;
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

  checkLakeCollision(car) {
    if (this.isCreative) return;
    const dx = car.mesh.position.x - LAKE_CENTER.x;
    const dz = car.mesh.position.z - LAKE_CENTER.y;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < LAKE_RADIUS - 6) {
      const nx = dx / (dist || 1), nz = dz / (dist || 1);
      car.mesh.position.x = LAKE_CENTER.x + nx * (LAKE_RADIUS - 6);
      car.mesh.position.z = LAKE_CENTER.y + nz * (LAKE_RADIUS - 6);
      car.speed *= 0.5;
      if (this.collisionCooldown <= 0) {
        this.shakeScreen(0.15, 0.1);
        this.sound.playCollision(Math.min(1, Math.abs(car.speed) / 50));
        this.collisionCooldown = 0.3;
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
      else if (k === 'c') { e.preventDefault(); this.firstPerson = !this.firstPerson; }
else if (k === 'e' || k === 'f') { e.preventDefault(); this.toggleFootCar(); }
       else if (k === 'escape') { this.togglePause(); }
else if (k === 'f2') { e.preventDefault(); this.togglePhotoMode(); }
        else if (k === 'f3') { e.preventDefault(); this.takeScreenshot(); }
        else if (k === 'g') { e.preventDefault(); this.toggleGarage(); }
        else if (k === 'r') { e.preventDefault(); this.toggleRaceMode(); }
        else if (k === 't') { e.preventDefault(); this.toggleTutorial(); }
        else if (k === 'm') { e.preventDefault(); this.showMinimap = !this.showMinimap; const mm = document.getElementById('minimap'); if (mm) mm.style.display = this.showMinimap ? 'block' : 'none'; }
        else if (k === 'n') { e.preventDefault(); this.toggleNightVision(); }
        else if (k === 't') { e.preventDefault(); this.toggleThermalVision(); }
        else if (k === 's') { e.preventDefault(); this.toggleSpectatorMode(); }
        else if (k === 'r') { e.preventDefault(); this.toggleRadioStation(); }
        else if (k === 'j') { e.preventDefault(); this.startCoopMission(); }
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

   _blockCtrlW(e) { if (e.ctrlKey && (e.key === 'w' || e.key === 'W')) e.preventDefault(); }

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
        if (this.onFoot) {
          this.footYaw -= e.movementX * this.sensitivity;
          this.footPitch -= e.movementY * this.sensitivity;
          this.footPitch = Math.max(-1.4, Math.min(1.4, this.footPitch));
        } else {
          this.cameraAngle -= e.movementX * this.sensitivity;
        }
      }
    };
    document.addEventListener('mousemove', this._mm);

    this._plc = () => {};
    document.addEventListener('pointerlockchange', this._plc);
  }

togglePause() {
     this.paused = !this.paused;
     if (this.paused && this.manager.crazyGames) this.manager.crazyGames.happyTime();
     const el = document.getElementById('pause-menu');
     if (el) el.style.display = this.paused ? 'flex' : 'none';
   }

   togglePhotoMode() {
     this.photoMode = !this.photoMode;
     if (this.photoMode) {
       this.photoAngle = Math.atan2(
         this.manager.camera.position.x - (this.currentCar ? this.currentCar.mesh.position.x : 0),
         this.manager.camera.position.z - (this.currentCar ? this.currentCar.mesh.position.z : 0)
       );
       this.photoDistance = 20;
       this.photoHeight = 10;
       document.exitPointerLock();
       const el = document.getElementById('photo-mode-indicator');
       if (el) el.style.display = 'block';
     } else {
       const el = document.getElementById('photo-mode-indicator');
       if (el) el.style.display = 'none';
     }
   }

takeScreenshot() {
      this.manager.renderer.render(this.manager.scene, this.manager.camera);
      const dataUrl = this.manager.renderer.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `nitro-roam-screenshot-${++this._screenshotCount}.png`;
      link.href = dataUrl;
      link.click();
    }

    toggleGarage() {
      this.garageOpen = !this.garageOpen;
      const el = document.getElementById('garage-overlay');
      if (el) el.style.display = this.garageOpen ? 'flex' : 'none';
      if (this.garageOpen) {
        this.garageTab = 'upgrades';
        this.renderGarage();
      }
    }

    renderGarage() {
      const overlay = document.getElementById('garage-overlay');
      if (!overlay) return;
      const carId = CAR_IDS[this.selectedIdx];
      const carName = CONFIG.cars[carId] || carId;
      const owned = ProgressService.owned;
      const cash = ProgressService.cash;
      const level = ProgressService.getLevel();
      const xp = ProgressService.getXP();
      const xpNeeded = ProgressService.xpForLevel(level);
      const upgrade = ProgressService.UPGRADES;

      let carCards = '';
      for (const id of CAR_IDS) {
        const isOwned = owned.includes(id);
        const price = ProgressService.price(id);
        const isSelected = id === carId;
        const carNameStr = CONFIG.cars[id] || id;
        const color = this.garageColor;
        carCards += `
          <div style="background:${isSelected ? 'rgba(68,170,255,0.15)' : 'rgba(255,255,255,0.05)'};border:1px solid ${isSelected ? 'rgba(68,170,255,0.4)' : 'rgba(255,255,255,0.1)'};border-radius:10px;padding:10px;cursor:pointer;pointer-events:auto;min-width:120px;text-align:center" onclick="window._garageSelectCar('${id}')">
            <div style="font-size:12px;font-weight:700;color:${isSelected ? '#44aaff' : '#ccc'};text-transform:uppercase">${carNameStr}</div>
            <div style="font-size:10px;color:#888;margin-top:4px">${isOwned ? 'Owned' : '$' + price}</div>
            ${isSelected ? '<div style="font-size:9px;color:#44ff44;margin-top:2px">SELECTED</div>' : ''}
          </div>`;
      }

      let upgradeHTML = '';
      for (const [key, upg] of Object.entries(upgrade)) {
        const lvl = ProgressService.getUpgradeLevel(carId, key);
        const maxed = lvl >= upg.maxLevel;
        const price = maxed ? 0 : upg.prices[lvl];
        upgradeHTML += `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="font-size:14px">${upg.icon}</span>
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#ccc">
                <span>${upg.name}</span><span>Lv ${lvl}/${upg.maxLevel}</span>
              </div>
              <div class="stat-bar" style="width:100%"><div class="stat-fill" style="width:${(lvl/upg.maxLevel)*100}%;background:#44aaff"></div></div>
            </div>
            ${maxed ? '<span style="font-size:10px;color:#44ff44">MAX</span>' : `<button style="padding:3px 8px;font-size:10px;background:rgba(68,170,255,0.2);color:#44aaff;border:1px solid rgba(68,170,255,0.3);border-radius:4px;cursor:pointer;pointer-events:auto" onclick="window._garageBuyUpgrade('${key}')">$${price}</button>`}
          </div>`;
      }

      overlay.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;display:flex;align-items:center;justify-content:center" id="garage-backdrop">
          <div class="hud-panel" style="width:90%;max-width:700px;max-height:85vh;overflow-y:auto;padding:20px;pointer-events:auto">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
              <h2 style="font-family:'Rajdhani',sans-serif;font-size:20px;font-weight:700;color:#44aaff;letter-spacing:2px;text-transform:uppercase">Garage</h2>
              <button id="garage-close" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;pointer-events:auto">✕</button>
            </div>
            <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
              <div class="hud-panel-light" style="padding:8px 14px;flex:1;min-width:120px">
                <div style="font-size:10px;color:#888;text-transform:uppercase">Level</div>
                <div style="font-family:'Orbitron',monospace;font-size:22px;font-weight:700;color:#ffcc00">${level}</div>
              </div>
              <div class="hud-panel-light" style="padding:8px 14px;flex:1;min-width:120px">
                <div style="font-size:10px;color:#888;text-transform:uppercase">XP</div>
                <div style="font-family:'Orbitron',monospace;font-size:16px;font-weight:700;color:#44ff44">${xp} / ${xpNeeded}</div>
                <div class="stat-bar" style="width:100%;margin-top:4px"><div class="stat-fill" style="width:${(xp/xpNeeded)*100}%;background:#44ff44"></div></div>
              </div>
              <div class="hud-panel-light" style="padding:8px 14px;flex:1;min-width:120px">
                <div style="font-size:10px;color:#888;text-transform:uppercase">Cash</div>
                <div style="font-family:'Orbitron',monospace;font-size:16px;font-weight:700;color:#ff44ff">$${cash.toLocaleString()}</div>
              </div>
            </div>
            <div style="margin-bottom:16px">
              <div style="font-size:11px;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Your Cars</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">${carCards}</div>
            </div>
            <div style="margin-bottom:16px">
              <div style="font-size:11px;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Car Color</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <div style="width:32px;height:32px;border-radius:6px;background:#44aaff;cursor:pointer;border:2px solid ${color==='#44aaff'?'#fff':'transparent'}" onclick="window._garageColor('#44aaff')"></div>
                <div style="width:32px;height:32px;border-radius:6px;background:#ff4444;cursor:pointer;border:2px solid ${color==='#ff4444'?'#fff':'transparent'}" onclick="window._garageColor('#ff4444')"></div>
                <div style="width:32px;height:32px;border-radius:6px;background:#44ff44;cursor:pointer;border:2px solid ${color==='#44ff44'?'#fff':'transparent'}" onclick="window._garageColor('#44ff44')"></div>
                <div style="width:32px;height:32px;border-radius:6px;background:#ffcc00;cursor:pointer;border:2px solid ${color==='#ffcc00'?'#fff':'transparent'}" onclick="window._garageColor('#ffcc00')"></div>
                <div style="width:32px;height:32px;border-radius:6px;background:#ff44ff;cursor:pointer;border:2px solid ${color==='#ff44ff'?'#fff':'transparent'}" onclick="window._garageColor('#ff44ff')"></div>
                <div style="width:32px;height:32px;border-radius:6px;background:#00ffff;cursor:pointer;border:2px solid ${color==='#00ffff'?'#fff':'transparent'}" onclick="window._garageColor('#00ffff')"></div>
                <div style="width:32px;height:32px;border-radius:6px;background:#ffffff;cursor:pointer;border:2px solid ${color==='#ffffff'?'#fff':'transparent'}" onclick="window._garageColor('#ffffff')"></div>
                <div style="width:32px;height:32px;border-radius:6px;background:#ff8800;cursor:pointer;border:2px solid ${color==='#ff8800'?'#fff':'transparent'}" onclick="window._garageColor('#ff8800')"></div>
              </div>
            </div>
            <div>
              <div style="font-size:11px;color:#888;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Upgrades</div>
              ${upgradeHTML}
            </div>
          </div>
        </div>`;

      document.getElementById('garage-close').onclick = () => this.toggleGarage();
      document.getElementById('garage-backdrop').onclick = (e) => { if (e.target === e.currentTarget) this.toggleGarage(); };
    }

applyGarageColor(hex) {
       this.garageColor = hex;
       if (this.currentCar && this.currentCar.mesh) {
         this.currentCar.mesh.traverse(c => {
           if (c.isMesh && c.material && c.material.color) {
             try { c.material.color.setHex(hex.replace('#', '0x')); } catch (e) {}
           }
         });
       }
     }

     toggleTutorial() {
       this.tutorialActive = !this.tutorialActive;
       this.tutorialStep = 0;
       this.tutorialTimer = 0;
       const el = document.getElementById('tutorial-overlay');
       if (el) el.style.display = this.tutorialActive ? 'flex' : 'none';
       if (this.tutorialActive) this.renderTutorialStep();
     }

     renderTutorialStep() {
       const overlay = document.getElementById('tutorial-overlay');
       if (!overlay) return;
       const steps = [
         { title: 'Welcome to NITRO ROAM!', desc: 'Use W/A/S/D to drive. Space for boost. E to enter/exit vehicles.', icon: '🚗' },
         { title: 'Collect Coins', desc: 'Drive over yellow coins to earn cash. Use cash to buy cars and upgrades.', icon: '🪙' },
         { title: 'Complete Laps', desc: 'Drive through checkpoint rings to complete laps. Earn cash and XP for each lap.', icon: '🏁' },
         { title: 'Drift Zones', desc: 'Drift through orange rings to earn drift points and bonuses.', icon: '🔥' },
         { title: 'Speed Traps', desc: 'Drive through pink rings to set speed records and earn rewards.', icon: '⚡' },
         { title: 'Garage & Upgrades', desc: 'Press G to open the Garage. Upgrade your cars for better performance.', icon: '🔧' },
         { title: 'Photo Mode', desc: 'Press F2 for Photo Mode. F3 to take screenshots. Free camera orbit.', icon: '📸' },
         { title: 'Race Mode', desc: 'Press R to start a race. Complete all laps as fast as possible!', icon: '🏆' },
       ];
       const step = steps[this.tutorialStep] || steps[steps.length - 1];
       const isLast = this.tutorialStep >= steps.length - 1;
       overlay.innerHTML = `
         <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;display:flex;align-items:center;justify-content:center" id="tutorial-backdrop">
           <div class="hud-panel" style="width:90%;max-width:500px;padding:24px;text-align:center;pointer-events:auto">
             <div style="font-size:40px;margin-bottom:12px">${step.icon}</div>
             <h2 style="font-family:'Rajdhani',sans-serif;font-size:22px;font-weight:700;color:#44aaff;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">${step.title}</h2>
             <p style="font-family:'Rajdhani',sans-serif;font-size:14px;color:#ccc;line-height:1.5;margin-bottom:20px">${step.desc}</p>
             <div style="display:flex;gap:8px;justify-content:center">
               ${this.tutorialStep > 0 ? '<button id="tut-prev" style="padding:6px 16px;font-size:12px;background:rgba(255,255,255,0.1);color:#ccc;border:1px solid rgba(255,255,255,0.2);border-radius:6px;cursor:pointer;pointer-events:auto">BACK</button>' : ''}
               <button id="tut-next" style="padding:6px 16px;font-size:12px;background:rgba(68,170,255,0.2);color:#44aaff;border:1px solid rgba(68,170,255,0.3);border-radius:6px;cursor:pointer;pointer-events:auto">${isLast ? 'DONE' : 'NEXT'}</button>
             </div>
             <div style="margin-top:12px;font-size:10px;color:#555">${this.tutorialStep + 1} / ${steps.length}</div>
           </div>
         </div>`;
       document.getElementById('tutorial-backdrop').onclick = (e) => { if (e.target === e.currentTarget) this.toggleTutorial(); };
       const nextBtn = document.getElementById('tut-next');
       if (nextBtn) nextBtn.onclick = () => {
         if (isLast) { this.toggleTutorial(); } else { this.tutorialStep++; this.renderTutorialStep(); }
       };
       const prevBtn = document.getElementById('tut-prev');
       if (prevBtn) prevBtn.onclick = () => { if (this.tutorialStep > 0) { this.tutorialStep--; this.renderTutorialStep(); } };
     }

     toggleRaceMode() {
       if (this.raceMode) {
         this.raceMode = false;
         const el = document.getElementById('race-overlay');
         if (el) el.style.display = 'none';
         this.raceFinished = false;
         return;
       }
       this.raceMode = true;
       this.raceLap = 0;
       this.raceTimer = 0;
       this.raceTimes = [];
       this.raceFinished = false;
       this.raceStartDelay = 3;
       this.checkpoints.forEach(c => c.passed = false);
       this.checkpointIdx = 0;
       this.timer = 0;
       const el = document.getElementById('race-overlay');
       if (el) el.style.display = 'flex';
       this._showToast(`RACE START - ${this.raceLaps} LAPS`, '#ff4444');
     }

     updateRaceMode(dt) {
       if (!this.raceMode || this.raceFinished) return;
       if (this.raceStartDelay > 0) {
         this.raceStartDelay -= dt;
         return;
       }
       this.raceTimer += dt;
       const car = this.currentCar;
       if (!car) return;
       const chk = this.checkpoints[this.checkpointIdx];
       if (chk) {
         const d = Math.sqrt((car.mesh.position.x - chk.x) ** 2 + (car.mesh.position.z - chk.z) ** 2);
         if (d < chk.r && !chk.passed) {
           chk.passed = true;
           this.checkpointIdx++;
           if (this.checkpointIdx >= this.checkpoints.length) {
             this.raceLap++;
             this.raceTimes.push(this.raceTimer);
             this.checkpoints.forEach(c => c.passed = false);
             this.checkpointIdx = 0;
             this.raceTimer = 0;
             ProgressService.addCash(500);
             ProgressService.addXP(100);
             ProgressService.trackStat('laps', 1);
             this._showToast(`LAP ${this.raceLap}/${this.raceLaps}`, '#44ff88');
             if (this.raceLap >= this.raceLaps) {
               this.raceFinished = true;
               this.raceMode = false;
               const totalTime = this.raceTimes.reduce((a, b) => a + b, 0);
               this._showToast(`RACE FINISHED! Total: ${totalTime.toFixed(1)}s`, '#ffcc00');
               ProgressService.addCash(2000);
               ProgressService.addXP(500);
               ProgressService.trackStat('maxSpeed', Math.round(Math.abs(car.speed) * 3.6));
               const el = document.getElementById('race-overlay');
               if (el) el.style.display = 'none';
             }
           }
         }
       }
       const overlay = document.getElementById('race-overlay');
       if (overlay) {
         const lapEl = overlay.querySelector('#race-lap');
         const timeEl = overlay.querySelector('#race-time');
         if (lapEl) lapEl.textContent = `LAP ${this.raceLap}/${this.raceLaps}`;
         if (timeEl) timeEl.textContent = this.raceTimes.reduce((a, b) => a + b, 0).toFixed(1) + 's';
       }
     }

   updatePhotoCamera(dt) {
     if (!this.photoMode) return;
     const cam = this.manager.camera;
     const target = this.currentCar ? this.currentCar.mesh.position : new THREE.Vector3(0, 0, 0);
     target.y = 1;

     const moveSpeed = 30 * dt;
     if (this.input.forward) this.photoDistance -= moveSpeed;
     if (this.input.backward) this.photoDistance += moveSpeed;
     if (this.input.left) this.photoAngle += moveSpeed * 0.3;
     if (this.input.right) this.photoAngle -= moveSpeed * 0.3;
     if (this.input.boost) this.photoHeight += moveSpeed;
     if (this.input.boost && this.input.backward) this.photoHeight -= moveSpeed;

     this.photoDistance = Math.max(3, Math.min(80, this.photoDistance));
     this.photoHeight = Math.max(1, Math.min(50, this.photoHeight));

     const pos = new THREE.Vector3(
       target.x + Math.sin(this.photoAngle) * this.photoDistance,
       this.photoHeight,
       target.z + Math.cos(this.photoAngle) * this.photoDistance
     );
     cam.position.lerp(pos, 0.1);
this.photoTarget.lerp(target, 0.1);
      cam.lookAt(this.photoTarget);
      cam.fov = THREE.MathUtils.lerp(cam.fov, 60, dt * 3);
      cam.updateProjectionMatrix();
    }

updateTutorial(dt) {
       if (!this.tutorialActive) return;
       this.tutorialTimer += dt;
       if (this.tutorialTimer > 5) {
         this.tutorialTimer = 0;
         this.tutorialStep++;
         const overlay = document.getElementById('tutorial-overlay');
         if (overlay) {
           const steps = 8;
           if (this.tutorialStep >= steps) {
             this.tutorialActive = false;
             overlay.style.display = 'none';
           } else {
             this.renderTutorialStep();
           }
         }
       }
     }

     updateSpectator(dt) {
       if (!this.spectatorMode) return;
       const cam = this.manager.camera;
       const moveSpeed = 50 * dt;
       const rotSpeed = 2 * dt;
       if (this.input.forward) cam.position.y += moveSpeed;
       if (this.input.backward) cam.position.y -= moveSpeed;
       if (this.input.left) cam.rotation.y += rotSpeed;
       if (this.input.right) cam.rotation.y -= rotSpeed;
       cam.fov = THREE.MathUtils.lerp(cam.fov, 80, dt * 3);
       cam.updateProjectionMatrix();
     }

     updateCoopMission(type, amount) {
       if (!this.coopMissionActive) return;
       for (const mission of this.coopMissions) {
         if (mission.type === type) {
           mission.current = Math.min(mission.target, mission.current + amount);
           const pct = (mission.current / mission.target) * 100;
           const overlay = document.getElementById('coop-mission-overlay');
           const desc = document.getElementById('coop-mission-desc');
           const bar = document.getElementById('coop-mission-bar');
           if (overlay) overlay.style.display = 'block';
           if (desc) desc.textContent = `${mission.desc}: ${mission.current}/${mission.target}`;
           if (bar) bar.style.width = pct + '%';
           if (mission.current >= mission.target) {
             ProgressService.addCash(mission.reward);
             ProgressService.addXP(mission.reward / 10);
             this._showToast(`MISSION COMPLETE! +$${mission.reward}`, '#44ff44');
             this.coopMissions = this.coopMissions.filter(m => m !== mission);
             if (this.coopMissions.length === 0) {
               this.coopMissionActive = false;
               const overlay = document.getElementById('coop-mission-overlay');
               if (overlay) overlay.style.display = 'none';
             }
           }
           break;
         }
       }
     }

     toggleNightVision() {
       this.nightVision = !this.nightVision;
       this.thermalVision = false;
       const el = document.getElementById('night-vision-overlay');
       if (el) el.style.display = this.nightVision ? 'block' : 'none';
       this._showToast(this.nightVision ? 'Night Vision ON' : 'Night Vision OFF', '#44aaff');
     }

     toggleThermalVision() {
       this.thermalVision = !this.thermalVision;
       this.nightVision = false;
       const el = document.getElementById('thermal-overlay');
       if (el) el.style.display = this.thermalVision ? 'block' : 'none';
       this._showToast(this.thermalVision ? 'Thermal Vision ON' : 'Thermal Vision OFF', '#ff4444');
     }

     toggleSpectatorMode() {
       this.spectatorMode = !this.spectatorMode;
       if (this.spectatorMode) {
         document.exitPointerLock();
         this._showToast('SPECTATOR MODE - Use WASD to fly, Mouse to look', '#ffcc00');
       } else {
         this._showToast('SPECTATOR MODE OFF', '#888');
       }
     }

     toggleRadioStation() {
       const stations = ['pop', 'rock', 'jazz', 'electronic', 'classical'];
       const current = this._currentRadioStation || 'pop';
       const idx = (stations.indexOf(current) + 1) % stations.length;
       this._currentRadioStation = stations[idx];
       this.sound.stopBGM();
       this.sound.startRadio(stations[idx]);
       this._showToast(`Radio: ${stations[idx].toUpperCase()}`, '#ffcc00');
     }

     startCoopMission() {
       this.coopMissionActive = true;
       this.coopMissions = [
         { type: 'collect', target: 50, current: 0, reward: 1000, desc: 'Collect 50 coins' },
         { type: 'drift', target: 3000, current: 0, reward: 800, desc: 'Score 3000 drift points' },
         { type: 'speed', target: 200, current: 0, reward: 600, desc: 'Reach 200 km/h' },
       ];
       this._showToast('CO-OP MISSION STARTED', '#44ff44');
     }

    updatePhotoCamera(dt) {
     if (!this.photoMode) return;
     const cam = this.manager.camera;
     const target = this.currentCar ? this.currentCar.mesh.position : new THREE.Vector3(0, 0, 0);
     target.y = 1;

     const moveSpeed = 30 * dt;
     if (this.input.forward) this.photoDistance -= moveSpeed;
     if (this.input.backward) this.photoDistance += moveSpeed;
     if (this.input.left) this.photoAngle += moveSpeed * 0.3;
     if (this.input.right) this.photoAngle -= moveSpeed * 0.3;
     if (this.input.boost) this.photoHeight += moveSpeed;
     if (this.input.boost && this.input.backward) this.photoHeight -= moveSpeed;

     this.photoDistance = Math.max(3, Math.min(80, this.photoDistance));
     this.photoHeight = Math.max(1, Math.min(50, this.photoHeight));

     const pos = new THREE.Vector3(
       target.x + Math.sin(this.photoAngle) * this.photoDistance,
       this.photoHeight,
       target.z + Math.cos(this.photoAngle) * this.photoDistance
     );
     cam.position.lerp(pos, 0.1);
     this.photoTarget.lerp(target, 0.1);
     cam.lookAt(this.photoTarget);
     cam.fov = THREE.MathUtils.lerp(cam.fov, 60, dt * 3);
     cam.updateProjectionMatrix();
   }

  _nativeFullscreen() {
    try {
      const el = document.documentElement;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (el.requestFullscreen) {
        el.requestFullscreen();
      }
    } catch (e) {}
  }

  createHUD() {
    if (document.getElementById('hud')) return;

    const style = document.createElement('style');
    style.textContent = `
      @import url('/fonts/fonts.css');
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
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
            <span style="font-family:'Orbitron',monospace;font-size:11px;font-weight:700;color:#ffcc00">LVL <span id="hud-level">1</span></span>
            <div class="stat-bar" style="width:60px"><div id="hud-xp-bar" class="stat-fill" style="width:0%;background:#ffcc00"></div></div>
            <span style="font-family:'Rajdhani',sans-serif;font-size:10px;color:#888"><span id="hud-xp">0</span>/<span id="hud-xp-needed">1000</span></span>
          </div>
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
         ${this.raceMode ? `<div id="race-overlay" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:110;display:none;pointer-events:none;text-align:center"><div style="font-family:Orbitron,monospace;font-size:24px;font-weight:900;color:#ff4444;text-shadow:0 0 20px rgba(255,68,68,0.5)" id="race-lap">LAP 0/${this.raceLaps}</div><div style="font-family:Orbitron,monospace;font-size:16px;color:#fff;margin-top:8px" id="race-time">0.0s</div></div>` : ''}
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
<div class="key-hint" id="key-hint">
             <kbd>W</kbd> Drive &nbsp;<kbd>A</kbd><kbd>D</kbd> Steer &nbsp;<kbd>Space</kbd> Boost &nbsp;<kbd>E</kbd> Enter/Exit Vehicle &nbsp;<kbd>V</kbd> Zoom &nbsp;<kbd>C</kbd> Camera &nbsp;<kbd>F2</kbd> Photo &nbsp;<kbd>F3</kbd> Screenshot &nbsp;<kbd>G</kbd> Garage &nbsp;<kbd>R</kbd> Race &nbsp;<kbd>T</kbd> Tutorial &nbsp;<kbd>M</kbd> Minimap &nbsp;<kbd>N</kbd> Night &nbsp;<kbd>S</kbd> Spectate &nbsp;<kbd>J</kbd> Co-op &nbsp;<kbd>H</kbd> Help &nbsp;<kbd>Esc</kbd> Pause
           </div>
        </div>
      </div>

      <div id="fp-crosshair" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.85);box-shadow:0 0 8px rgba(255,255,255,0.5);display:none;z-index:110"></div>
      <div id="fp-prompt" style="position:absolute;top:62%;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.6);color:#ffcc00;font-family:'Orbitron',monospace;font-size:13px;font-weight:700;letter-spacing:1px;padding:8px 18px;border-radius:8px;border:1px solid rgba(255,204,0,0.35);display:none;z-index:110"></div>
<div id="photo-mode-indicator" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:110;display:none;pointer-events:none">
         <div style="font-family:Orbitron,monospace;font-size:14px;color:#44aaff;letter-spacing:3px;text-shadow:0 0 20px rgba(68,170,255,0.5)">PHOTO MODE</div>
         <div style="font-family:Rajdhani,sans-serif;font-size:11px;color:#888;margin-top:4px;text-align:center">F2 to exit &middot; F3 to screenshot</div>
       </div>
       <div id="tutorial-overlay" style="position:absolute;inset:0;z-index:150;display:none;pointer-events:none"></div>
       <div id="night-vision-overlay" style="position:absolute;inset:0;z-index:105;display:none;pointer-events:none;background:rgba(0,20,0,0.3);mix-blend-mode:multiply">
         <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:Orbitron,monospace;font-size:12px;color:#44ff44;opacity:0.6">NIGHT VISION</div>
       </div>
       <div id="thermal-overlay" style="position:absolute;inset:0;z-index:105;display:none;pointer-events:none;background:rgba(20,0,0,0.3);mix-blend-mode:multiply">
         <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:Orbitron,monospace;font-size:12px;color:#ff4444;opacity:0.6">THERMAL VISION</div>
       </div>
       <div id="coop-mission-overlay" style="position:absolute;top:60px;left:50%;transform:translateX(-50%);z-index:105;display:none;pointer-events:none">
         <div class="hud-panel" style="padding:6px 14px;text-align:center">
           <div style="font-family:'Rajdhani',sans-serif;font-size:11px;color:#44ff44;text-transform:uppercase;letter-spacing:1px">CO-OP MISSION</div>
           <div id="coop-mission-desc" style="font-family:'Orbitron',monospace;font-size:12px;color:#fff"></div>
           <div class="stat-bar" style="width:120px;margin-top:4px"><div id="coop-mission-bar" class="stat-fill" style="width:0%;background:#44ff44"></div></div>
         </div>
       </div>
    `;
    document.body.appendChild(hud);

    const ctrl = document.createElement('div');
    ctrl.style.cssText = 'position:absolute;top:12px;right:12px;display:flex;flex-direction:column;gap:6px;pointer-events:auto';
    ctrl.id = 'hud-controls';
    const mkBtn = (id, label) => {
      const b = document.createElement('button');
      b.id = id;
      b.textContent = label;
      b.style.cssText = 'width:40px;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);color:#fff;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s ease';
      b.onmouseenter = () => { b.style.background = 'rgba(255,255,255,0.15)'; };
      b.onmouseleave = () => { b.style.background = 'rgba(0,0,0,0.55)'; };
      return b;
    };
    const sndBtn = mkBtn('hud-sound', this.sound.muted ? '🔇' : '🔊');
    sndBtn.onclick = () => {
      this.sound.setMuted(!this.sound.muted);
      sndBtn.textContent = this.sound.muted ? '🔇' : '🔊';
    };
    const fsBtn = mkBtn('hud-fullscreen', '⛶');
    fsBtn.onclick = () => {
      if (this.manager.crazyGames) {
        this.manager.crazyGames.fullscreen().then(ok => { if (!ok) this._nativeFullscreen(); });
      } else {
        this._nativeFullscreen();
      }
    };
    ctrl.appendChild(sndBtn);
    ctrl.appendChild(fsBtn);
    hud.appendChild(ctrl);

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
        <button class="pause-btn reward-btn" data-action="reward" style="background:linear-gradient(135deg,#ffcc00,#ff8800);color:#111;font-weight:700">▶ WATCH AD · 2x COINS</button>
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
          case 'reward': this._showRewardedAd(pm); break;
          case 'restart': this.paused = false; pm.style.display = 'none'; if (this.manager.crazyGames) this.manager.crazyGames.midgameAd(); this.exit(); this.manager.start('game', { carIdx: this.selectedIdx }); break;
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
        <div class="help-row"><span class="help-key">W</span><span class="help-desc">Accelerate / Walk Forward</span></div>
        <div class="help-row"><span class="help-key">S</span><span class="help-desc">Brake / Reverse / Walk Back</span></div>
        <div class="help-row"><span class="help-key">A</span><span class="help-desc">Steer Left / Strafe Left</span></div>
        <div class="help-row"><span class="help-key">D</span><span class="help-desc">Steer Right / Strafe Right</span></div>
        <div class="help-row"><span class="help-key">SPACE</span><span class="help-desc">Boost / Jump on Foot</span></div>
        <div class="help-row"><span class="help-key">E</span><span class="help-desc">Enter / Exit Car or Boat</span></div>
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
     this.hudEls.level = document.getElementById('hud-level');
     this.hudEls.xp = document.getElementById('hud-xp');
     this.hudEls.xpNeeded = document.getElementById('hud-xp-needed');
     this.hudEls.xpBar = document.getElementById('hud-xp-bar');
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

    if (!this.onFoot) this.showCountdown();
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
     if (this.hudEls.coins) this.hudEls.coins.textContent = `$${ProgressService.cash.toLocaleString()}`;
     if (this.hudEls.level) this.hudEls.level.textContent = ProgressService.getLevel();
     if (this.hudEls.xp) this.hudEls.xp.textContent = ProgressService.getXP();
     if (this.hudEls.xpNeeded) this.hudEls.xpNeeded.textContent = ProgressService.xpForLevel(ProgressService.getLevel());
     if (this.hudEls.xpBar) {
       const lvl = ProgressService.getLevel();
       const xp = ProgressService.getXP();
       const needed = ProgressService.xpForLevel(lvl);
       this.hudEls.xpBar.style.width = Math.min(100, (xp / needed) * 100) + '%';
     }
   }

  update(dt) {
    if (this.paused) return;

    this.sound.resume();
    this.updateLighting(dt);

    if (this.onFoot) {
      this.updateFoot(dt);
      this.updateDustMotes(dt);
      this.updateWater(dt);
      this.drawMinimap();
      this.updateFootPrompt();
      return;
    }

    if (this.currentBoat) {
      this.updateBoat(dt);
      return;
    }

    if (!this.currentCar) return;

const isNight = this.dayTime >= 20 || this.dayTime < 5;
     this.headlights.forEach(l => l.intensity = isNight ? 8 : 0);
     if (this.weatherType === 1) ProgressService.trackStat('rainRace', 1);
     if (isNight) ProgressService.trackStat('nightRace', 1);
     if (this.multi) ProgressService.trackStat('maxPlayers', Object.keys(this.ghostCars).length + 1);

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

    const np = this.nearestRoadPoint(car.mesh.position.x, car.mesh.position.z);
const onRoad = np.d <= 1.5;
     if (!onRoad && !this.isCreative) {
       car.speed *= 0.985 * this.roadGripMult;
       if (Math.abs(car.speed) > 35 && this.collisionCooldown <= 0) {
         this.shakeScreen(0.12, 0.1);
         this.collisionCooldown = 0.25;
       }
     }

    const edge = CONFIG.world.half - 40;
    const ex = THREE.MathUtils.clamp(car.mesh.position.x, -edge, edge);
    const ez = THREE.MathUtils.clamp(car.mesh.position.z, -edge, edge);
    if (ex !== car.mesh.position.x || ez !== car.mesh.position.z) {
      car.mesh.position.x = ex;
      car.mesh.position.z = ez;
      car.speed *= 0.6;
      if (this.collisionCooldown <= 0) {
        this.shakeScreen(0.2, 0.12);
        this.sound.playCollision(Math.min(1, Math.abs(car.speed) / 50));
        this.collisionCooldown = 0.3;
      }
    }

    this.checkBuildingCollision(car);
    this.checkLakeCollision(car);
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);

    this.inRepairZone = false;
    this.inFuelZone = false;
    if (this.repairZones) {
      this.repairZones.forEach(zone => {
        const d = Math.sqrt((car.mesh.position.x - zone.x) ** 2 + (car.mesh.position.z - zone.z) ** 2);
        if (d < zone.r) { this.inRepairZone = true; if (car.damage > 0) { car.repair(15 * dt); if (Math.random() < 0.02) ProgressService.spendCash(Math.round(car.damage * 0.5)); } }
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

    if (this.firstPerson) {
      const fpPos = new THREE.Vector3(
        car.mesh.position.x + viewX * 0.6,
        1.35,
        car.mesh.position.z + viewZ * 0.6
      );
      this.manager.camera.position.lerp(fpPos, 0.35);
      const fpTarget = new THREE.Vector3(
        car.mesh.position.x + viewX * 30,
        1.3,
        car.mesh.position.z + viewZ * 30
      );
      this.manager.camera.lookAt(fpTarget);
    } else {
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
    }

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

 if (this.nightVision) {
       this.manager.renderer.toneMappingExposure = 0.3;
       this.manager.scene.fog.color.setHex(0x001100);
     } else if (this.thermalVision) {
       this.manager.renderer.toneMappingExposure = 1.5;
       this.manager.scene.fog.color.setHex(0x331100);
     } else {
       this.manager.renderer.toneMappingExposure = 1.0;
     }

 this.updatePhotoCamera(dt);
      this.updateWeather(dt);
      this.updateNPCCars(dt);
      this.updateRaceMode(dt);
      this.updateTutorial(dt);
      this.updateSpectator(dt);

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
     this.sound.setEngineType(this.currentCar ? this.currentCar.carId : 'sedan');
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
    if (!this.minimapCtx) return;
    if (!this.currentCar && !this.currentBoat && !this.onFoot) return;
    const ctx = this.minimapCtx;
    const w = 140, h = 140, cx = w / 2, cy = h / 2;
    const scale = 0.026;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, 68, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(40,120,200,0.55)';
    ctx.beginPath();
    ctx.arc(cx + LAKE_CENTER.x * scale, cy + LAKE_CENTER.y * scale, LAKE_RADIUS * scale, 0, Math.PI * 2);
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

    this.repairZones.forEach(z => {
       ctx.fillStyle = 'rgba(68,255,68,0.8)';
       ctx.beginPath();
       ctx.arc(cx + z.x * scale, cy + z.z * scale, 4, 0, Math.PI * 2);
       ctx.fill();
       ctx.strokeStyle = '#44ff44';
       ctx.lineWidth = 1;
       ctx.stroke();
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

    const inBoat = !!this.currentBoat;
    const px = (this.onFoot ? this.footPos.x : inBoat ? this.currentBoat.mesh.position.x : this.currentCar.mesh.position.x) * scale;
    const pz = (this.onFoot ? this.footPos.z : inBoat ? this.currentBoat.mesh.position.z : this.currentCar.mesh.position.z) * scale;
    ctx.fillStyle = '#44aaff';
    ctx.beginPath();
    ctx.arc(cx + px, cy + pz, this.onFoot ? 3 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const angle = this.onFoot ? this.footYaw : inBoat ? this.currentBoat.mesh.rotation.y : this.currentCar.mesh.rotation.y;
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

     this.waypoints.forEach(wp => {
       ctx.fillStyle = '#ff44ff';
       ctx.beginPath();
       ctx.arc(cx + wp.x * scale, cy + wp.z * scale, 4, 0, Math.PI * 2);
       ctx.fill();
       ctx.strokeStyle = '#fff';
       ctx.lineWidth = 1;
       ctx.stroke();
     });
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
        ProgressService.addCash(CASH_PER_COIN);
        ProgressService.addXP(10);
        ProgressService.trackStat('coins', 1);
        if (this.coopMissionActive) this.updateCoopMission('collect', 1);
        this.sound.playCoin();
        if (this.hudEls.coins) this.hudEls.coins.textContent = `$${ProgressService.cash.toLocaleString()}`;
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
          RecordsService.submit('bestSpeed', speedKmh, this.playerName);
          ProgressService.addCash(1000);
          ProgressService.addXP(50);
          ProgressService.trackStat('maxSpeed', Math.round(speedKmh));
          if (this.coopMissionActive) this.updateCoopMission('speed', Math.round(speedKmh));
          this._showToast('+$1,000 SPEED RECORD', '#ff44ff');
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
if (zone.active && zone.score > 0) {
           RecordsService.submit('bestDrift', zone.score, this.playerName);
           const bonus = Math.round(zone.score / 2);
           if (bonus > 0) {
             ProgressService.addCash(bonus);
             ProgressService.addXP(bonus);
             ProgressService.trackStat('drift', zone.score);
             if (this.coopMissionActive) this.updateCoopMission('drift', zone.score);
             this._showToast(`+$${bonus.toLocaleString()} DRIFT BONUS`, '#ffaa00');
           }
           zone.score = 0;
         }
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
    document.getElementById('hud-coins').textContent = `$${ProgressService.cash.toLocaleString()}`;
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 500); }, 200);
  }

  shakeScreen(intensity, duration) {
    this.screenShake = { intensity, duration };
  }

  _showToast(msg, color = '#ffcc00') {
    const el = document.getElementById('nitro-toast');
    if (el) { el.remove(); }
    const t = document.createElement('div');
    t.id = 'nitro-toast';
    t.style.cssText = `position:fixed;top:22%;left:50%;transform:translate(-50%,-50%);z-index:300;pointer-events:none;font-family:Orbitron,monospace;font-weight:900;font-size:26px;color:${color};text-shadow:0 0 20px rgba(255,200,0,0.5);opacity:1;transition:opacity 0.6s ease;text-align:center;letter-spacing:2px`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 700); }, 2200);
  }

  _showRewardedAd(pm) {
    const btn = pm.querySelector('.reward-btn');
    if (!btn) return;
    if (btn.dataset.loading) return;
    btn.dataset.loading = '1';
    const original = btn.textContent;
    btn.textContent = 'LOADING AD…';
    btn.disabled = true;
    btn.style.opacity = '0.6';
    const sdk = this.manager.crazyGames;
    const promise = sdk ? sdk.rewardedAd() : Promise.resolve(false);
    promise.then((rewarded) => {
      if (rewarded === true) {
        ProgressService.addCash(CASH_PER_COIN * 10);
        ProgressService.addXP(20);
        if (this.hudEls.coins) this.hudEls.coins.textContent = `$${ProgressService.cash.toLocaleString()}`;
        this._showToast(`+$${(CASH_PER_COIN * 10).toLocaleString()} REWARD!`, '#ffcc00');
        this.sound.playCoin();
      } else {
        this._showToast('AD NOT AVAILABLE', '#ff6b35');
      }
    }).catch(() => {
      this._showToast('AD NOT AVAILABLE', '#ff6b35');
    }).then(() => {
      btn.dataset.loading = '';
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = original;
    });
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
    if (this._speedLineContainer) return;
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
    if (this._exhaustParticles) return;
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
    if (this.nitrousFlame) return;
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
          ProgressService.addCash(500);
          ProgressService.addXP(100);
          ProgressService.trackStat('laps', 1);
          this._showToast(`+$500 LAP ${this.lapCount}`, '#44ff88');
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
      navigator.share({ title: 'NITRO ROAM', text: 'Race with me!', url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        const el = document.getElementById('share-toast');
        if (el) { el.style.opacity = '1'; setTimeout(() => el.style.opacity = '0', 1500); }
      }).catch(() => {});
    }
  }

  exit() {
    if (this._visHandler) { document.removeEventListener('visibilitychange', this._visHandler); this._visHandler = null; }
    if (this.manager.crazyGames) this.manager.crazyGames.gameplayStop();
    this.unbindKeys();
    this.sound.stopEngine();
    this.sound.stopBGM();
    if (this._touchControls) this._touchControls.remove();
    if (this._speedLineContainer) this._speedLineContainer.remove();
    if (this._minimapEl) this._minimapEl.remove();
    if (this.syncInterval) { clearInterval(this.syncInterval); this.syncInterval = null; }
    if (this.recordsUnsub) { try { this.recordsUnsub(); } catch (e) {} this.recordsUnsub = null; }
    if (this._boardTimer) { clearInterval(this._boardTimer); this._boardTimer = null; }
    this.billboards = null;
    this.billboardScreens = null;
    this.records = null;
    if (this.posListener) { import('../services/FirebaseService.js').then(({ db, ref, off }) => off(ref(db, `rooms/${this.roomId}/players`), this.posListener)); }
    if (this.multi && this.roomId && this.playerId) {
      import('../services/FirebaseService.js').then(({ db, ref, remove, get }) => {
        remove(ref(db, `rooms/${this.roomId}/players/${this.playerId}`));
        get(ref(db, `rooms/${this.roomId}/players`)).then((snap) => { if (!snap.exists()) remove(ref(db, `rooms/${this.roomId}`)); });
      });
    }
    this.headlights.forEach(h => { if (h.parent) h.parent.remove(h); if (h.target?.parent) h.target.parent.remove(h.target); });
    this.headlights = [];
    this.parkedCars.forEach(c => { if (c.mesh && c.mesh.parent) this.manager.scene.remove(c.mesh); });
    this.parkedCars = [];
    this.parkedBoats.forEach(b => { if (b.mesh && b.mesh.parent) this.manager.scene.remove(b.mesh); });
    this.parkedBoats = [];
    this.npcCars.forEach(c => { if (c.mesh && c.mesh.parent) this.manager.scene.remove(c.mesh); });
    this.npcCars = [];
    if (this.currentCar) { this.manager.scene.remove(this.currentCar.mesh); this.currentCar = null; }
    if (this.currentBoat) { this.manager.scene.remove(this.currentBoat.mesh); this.currentBoat = null; }
    this.lakeWater = null;
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
    const pi = document.getElementById('photo-mode-indicator'); if (pi) pi.remove();
    const ga = document.getElementById('garage-overlay'); if (ga) ga.remove();
    const gd = document.getElementById('garage-backdrop'); if (gd) gd.remove();
    const ro = document.getElementById('race-overlay'); if (ro) ro.remove();
    const to = document.getElementById('tutorial-overlay'); if (to) to.remove();
    const nv = document.getElementById('night-vision-overlay'); if (nv) nv.remove();
    const tv = document.getElementById('thermal-overlay'); if (tv) tv.remove();
    const co = document.getElementById('coop-mission-overlay'); if (co) co.remove();
    if (this._hudStyle) this._hudStyle.remove();
  }
}
