import { NameService } from './NameService.js';

export const DEFAULT_CAR = 'sedan';
export const CASH_PER_COIN = 50;
const FIREBASE_SAVE_INTERVAL = 10000;

let _fb = null;
const fb = () => (_fb ||= import('./FirebaseService.js'));

export const CAR_PRICES = {
  'race': 8000,
  'race-future': 15000,
  'sedan-sports': 4000,
  'hatchback-sports': 2500,
  'suv-luxury': 5000,
  'sedan': 0,
  'suv': 3000,
  'truck': 2000,
  'police': 9000,
  'taxi': 1000
};

export const UPGRADES = {
  engine: { name: 'Engine', icon: '⚡', maxLevel: 5, prices: [500, 1500, 3000, 6000, 12000], stat: 'maxSpeedMult', values: [1, 1.1, 1.2, 1.35, 1.5] },
  tires: { name: 'Tires', icon: '🛞', maxLevel: 5, prices: [300, 1000, 2500, 5000, 10000], stat: 'gripMult', values: [1, 1.1, 1.2, 1.35, 1.5] },
  nitro: { name: 'Nitro', icon: '💨', maxLevel: 5, prices: [400, 1200, 2800, 5500, 11000], stat: 'boostMult', values: [1, 1.1, 1.2, 1.35, 1.5] },
  armor: { name: 'Armor', icon: '🛡', maxLevel: 5, prices: [600, 1800, 4000, 8000, 15000], stat: 'damageResist', values: [0, 0.1, 0.2, 0.35, 0.5] }
};

const KEY = 'nitroProgress_v1';

function uid() {
  const name = NameService.get();
  return (name || 'guest').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export const ACHIEVEMENTS = {
  first_lap: { name: 'First Lap', desc: 'Complete your first lap', icon: '🏁', reward: 200 },
  speed_demon: { name: 'Speed Demon', desc: 'Reach 200 km/h', icon: '💨', reward: 500 },
  drift_king: { name: 'Drift King', desc: 'Score 5000 drift points', icon: '🔥', reward: 300 },
  coin_collector: { name: 'Coin Collector', desc: 'Collect 100 coins', icon: '🪙', reward: 1000 },
  car_collector: { name: 'Car Collector', desc: 'Own 5 different cars', icon: '🚗', reward: 1500 },
  max_level: { name: 'Max Level', desc: 'Reach level 10', icon: '⭐', reward: 2000 },
  all_upgrades: { name: 'Fully Upgraded', desc: 'Max all upgrades on any car', icon: '🔧', reward: 3000 },
  weather_racer: { name: 'Weather Racer', desc: 'Race in rain 5 times', icon: '🌧️', reward: 400 },
  night_owl: { name: 'Night Owl', desc: 'Race at night', icon: '🌙', reward: 300 },
  social_driver: { name: 'Social Driver', desc: 'Race with 3+ players', icon: '👥', reward: 600 },
};

function defaults() {
   return { cash: 0, owned: [DEFAULT_CAR], selectedCar: DEFAULT_CAR, upgrades: {}, xp: 0, level: 1, achievements: {}, totalCoins: 0, totalLaps: 0, maxSpeed: 0, totalDrift: 0, racesInRain: 0, nightRaces: 0, maxPlayers: 0 };
 }

export const ProgressService = {
  cash: 0,
  owned: [],
  selectedCar: DEFAULT_CAR,
  _timer: null,

  init() {
    this.loadLocal();
    this.loadRemote();
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this.save(true), FIREBASE_SAVE_INTERVAL);
  },

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.save(true);
  },

  loadLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
this.cash = Math.max(0, parseInt(d.cash, 10) || 0);
         this.owned = Array.isArray(d.owned) ? d.owned.filter(Boolean) : [DEFAULT_CAR];
         this.selectedCar = d.selectedCar || DEFAULT_CAR;
         this.upgrades = d.upgrades || {};
         this.xp = Math.max(0, parseInt(d.xp, 10) || 0);
         this.level = Math.max(1, parseInt(d.level, 10) || 1);
         this.achievements = d.achievements || {};
         this.totalCoins = d.totalCoins || 0;
         this.totalLaps = d.totalLaps || 0;
         this.maxSpeed = d.maxSpeed || 0;
         this.totalDrift = d.totalDrift || 0;
         this.racesInRain = d.racesInRain || 0;
         this.nightRaces = d.nightRaces || 0;
         this.maxPlayers = d.maxPlayers || 0;
} else {
const s = defaults();
         this.cash = s.cash; this.owned = s.owned; this.selectedCar = s.selectedCar; this.upgrades = s.upgrades || {}; this.xp = s.xp; this.level = s.level; this.achievements = s.achievements; this.totalCoins = s.totalCoins; this.totalLaps = s.totalLaps; this.maxSpeed = s.maxSpeed; this.totalDrift = s.totalDrift; this.racesInRain = s.racesInRain; this.nightRaces = s.nightRaces; this.maxPlayers = s.maxPlayers;
       }
     } catch (e) {
       const s = defaults();
       this.cash = s.cash; this.owned = s.owned; this.selectedCar = s.selectedCar; this.upgrades = s.upgrades || {}; this.xp = s.xp; this.level = s.level; this.achievements = s.achievements; this.totalCoins = s.totalCoins; this.totalLaps = s.totalLaps; this.maxSpeed = s.maxSpeed; this.totalDrift = s.totalDrift; this.racesInRain = s.racesInRain; this.nightRaces = s.nightRaces; this.maxPlayers = s.maxPlayers;
    }
    if (!this.owned.includes(DEFAULT_CAR)) this.owned.unshift(DEFAULT_CAR);
  },

  loadRemote() {
    fb().then(({ db, ref, get }) => {
      get(ref(db, `users/${uid()}/progress`)).then(snap => {
        if (!snap.exists()) return;
        const d = snap.val();
        if (!d) return;
        if (d.cash !== undefined && d.cash > this.cash) this.cash = Math.max(0, parseInt(d.cash, 10) || 0);
        if (Array.isArray(d.owned) && d.owned.length >= this.owned.length) {
          this.owned = d.owned.filter(Boolean);
          if (!this.owned.includes(DEFAULT_CAR)) this.owned.unshift(DEFAULT_CAR);
        }
        if (d.selectedCar) this.selectedCar = d.selectedCar;
        this.persistLocal();
        window.dispatchEvent(new CustomEvent('nitro-progress'));
      }).catch(() => {});
    }).catch(() => {});
  },

  save(toFirebase = true) {
    this.persistLocal();
    if (!toFirebase) return;
    fb().then(({ db, ref, set }) => {
set(ref(db, `users/${uid()}/progress`), {
         cash: this.cash,
         owned: this.owned,
         selectedCar: this.selectedCar,
         upgrades: this.upgrades,
         xp: this.xp,
         level: this.level,
         achievements: this.achievements,
         totalCoins: this.totalCoins,
         totalLaps: this.totalLaps,
         maxSpeed: this.maxSpeed,
         totalDrift: this.totalDrift,
         racesInRain: this.racesInRain,
         nightRaces: this.nightRaces,
         maxPlayers: this.maxPlayers
       }).catch(() => {});
    }).catch(() => {});
  },

  persistLocal() {
    try {
localStorage.setItem(KEY, JSON.stringify({
         cash: this.cash,
         owned: this.owned,
         selectedCar: this.selectedCar,
         upgrades: this.upgrades,
         xp: this.xp,
         level: this.level,
         achievements: this.achievements,
         totalCoins: this.totalCoins,
         totalLaps: this.totalLaps,
         maxSpeed: this.maxSpeed,
         totalDrift: this.totalDrift,
         racesInRain: this.racesInRain,
         nightRaces: this.nightRaces,
         maxPlayers: this.maxPlayers
       }));
    } catch (e) {}
  },

  addCash(amount) {
    const v = Math.max(0, Math.round(amount));
    if (!v) return;
    this.cash += v;
    this.save(false);
    window.dispatchEvent(new CustomEvent('nitro-progress'));
  },

  spendCash(amount) {
    const v = Math.max(0, Math.round(amount));
    if (this.cash < v) return false;
    this.cash -= v;
    this.save(false);
    window.dispatchEvent(new CustomEvent('nitro-progress'));
    return true;
  },

  owns(carId) { return this.owned.includes(carId); },
  price(carId) { return CAR_PRICES[carId] || 0; },

buyCar(carId) {
     if (this.owns(carId)) return true;
     const price = this.price(carId);
     if (this.cash < price) return false;
     this.cash -= price;
     this.owned.push(carId);
     this.selectedCar = carId;
     this.save(false);
     window.dispatchEvent(new CustomEvent('nitro-progress'));
     this.trackStat('ownedCars', this.owned.length);
     return true;
   },

  select(carId) {
    if (!this.owns(carId)) return;
    this.selectedCar = carId;
    this.save(false);
    window.dispatchEvent(new CustomEvent('nitro-progress'));
  },

  getUpgradeLevel(carId, upgradeKey) {
    const key = `${carId}_${upgradeKey}`;
    return this.upgrades[key] || 0;
  },

  buyUpgrade(carId, upgradeKey) {
    const upgrade = UPGRADES[upgradeKey];
    if (!upgrade) return false;
    const level = this.getUpgradeLevel(carId, upgradeKey);
    if (level >= upgrade.maxLevel) return false;
    const price = upgrade.prices[level];
    if (this.cash < price) return false;
    this.cash -= price;
    const key = `${carId}_${upgradeKey}`;
    this.upgrades[key] = level + 1;
    this.save(false);
    window.dispatchEvent(new CustomEvent('nitro-progress'));
    return true;
  },

getUpgradeStats(carId) {
     const stats = { maxSpeedMult: 1, gripMult: 1, boostMult: 1, damageResist: 0 };
     for (const [key, upgrade] of Object.entries(UPGRADES)) {
       const level = this.getUpgradeLevel(carId, key);
       if (level > 0) {
         stats[upgrade.stat] = upgrade.values[level - 1];
       }
     }
     return stats;
   },

   getXP() { return this.xp; },
   getLevel() { return this.level; },
   xpForLevel(lvl) { return lvl * 1000; },

addXP(amount) {
      const v = Math.max(0, Math.round(amount));
      if (!v) return;
      this.xp += v;
      let leveled = false;
      while (this.xp >= this.xpForLevel(this.level)) {
        this.xp -= this.xpForLevel(this.level);
        this.level++;
        leveled = true;
      }
      this.save(false);
      window.dispatchEvent(new CustomEvent('nitro-progress'));
      if (leveled) {
        window.dispatchEvent(new CustomEvent('nitro-levelup', { detail: { level: this.level } }));
      }
    },

    unlockAchievement(id) {
      if (this.achievements[id]) return;
      const ach = ACHIEVEMENTS[id];
      if (!ach) return;
      this.achievements[id] = true;
      this.addCash(ach.reward);
      this.save(false);
      window.dispatchEvent(new CustomEvent('nitro-achievement', { detail: { id, name: ach.name, icon: ach.icon, reward: ach.reward } }));
    },

    trackStat(stat, value) {
      if (stat === 'coins') { this.totalCoins += value; if (this.totalCoins >= 100) this.unlockAchievement('coin_collector'); }
      if (stat === 'laps') { this.totalLaps += value; if (this.totalLaps >= 1) this.unlockAchievement('first_lap'); }
      if (stat === 'maxSpeed') { if (value > this.maxSpeed) { this.maxSpeed = value; if (value >= 200) this.unlockAchievement('speed_demon'); } }
      if (stat === 'drift') { this.totalDrift += value; if (this.totalDrift >= 5000) this.unlockAchievement('drift_king'); }
      if (stat === 'rainRace') { this.racesInRain++; if (this.racesInRain >= 5) this.unlockAchievement('weather_racer'); }
      if (stat === 'nightRace') { this.nightRaces++; if (this.nightRaces >= 1) this.unlockAchievement('night_owl'); }
      if (stat === 'maxPlayers') { if (value > this.maxPlayers) this.maxPlayers = value; if (this.maxPlayers >= 3) this.unlockAchievement('social_driver'); }
      if (stat === 'ownedCars') { if (value >= 5) this.unlockAchievement('car_collector'); }
      if (stat === 'level') { if (value >= 10) this.unlockAchievement('max_level'); }
      this.save(false);
    },

    getDailyChallenge() {
      const today = new Date().toDateString();
      const seed = today.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const types = ['coins', 'laps', 'speed', 'drift', 'weather'];
      const type = types[seed % types.length];
      const targets = { coins: 20, laps: 3, speed: 150, drift: 2000, weather: 3 };
      const rewards = { coins: 300, laps: 500, speed: 400, drift: 350, weather: 250 };
      return { type, target: targets[type], reward: rewards[type], date: today, progress: 0 };
    }
  };
