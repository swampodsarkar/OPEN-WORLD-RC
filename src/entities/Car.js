import { CONFIG } from '../config.js';
import { ProgressService } from '../services/ProgressService.js';

export class Car {
  constructor(scene, model, x, z, name, carId = null, upgrades = null) {
    this.scene = scene;
    this.name = name.replace(/-/g, ' ');
    this.carId = carId || name.replace(/\s/g, '-').toLowerCase();
    this.mesh = model.clone();
    this.mesh.position.set(x, 0, z);
    this.mesh.scale.set(3, 3, 3);
        this.mesh.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; c.frustumCulled = false; } });
    scene.add(this.mesh);

    this.speed = 0;
    this.mesh.rotation.y = 0;
    this.occupied = false;
    this.boost = false;
    this.bobTime = 0;

    this.damage = 0;
    this.maxDamage = 100;
    this.fuel = 100;
    this.maxFuel = 100;
    this.fuelConsumption = 0.08;
    this.damageSpeedPenalty = 0.4;
    this.lowFuelPenalty = 0.3;

    this.upgrades = upgrades || ProgressService.getUpgradeStats(this.carId);
    this.maxSpeed = CONFIG.car.maxSpeed * this.upgrades.maxSpeedMult;
    this.gripMult = this.upgrades.gripMult;
    this.boostMultiplier = this.upgrades.boostMult;
    this.damageResist = this.upgrades.damageResist;
  }

  drive(input, dt) {
    const dmgMult = 1 - (this.damage / this.maxDamage) * this.damageSpeedPenalty * (1 - this.damageResist);
    const fuelMult = this.fuel < 20 ? 0.3 + (this.fuel / 20) * 0.7 : 1;

    if (this.fuel > 0) {
      if (input.forward) this.speed += CONFIG.car.acceleration * dmgMult * fuelMult * dt;
      else if (input.backward) this.speed -= CONFIG.car.braking * dmgMult * fuelMult * dt;
      else this.speed *= CONFIG.car.friction;
    } else {
      this.speed *= 0.95;
    }

    const max = this.boost ? this.maxSpeed * CONFIG.car.boostMultiplier * this.boostMultiplier : this.maxSpeed;
    const adjMax = max * dmgMult * (this.fuel <= 0 ? 0.1 : 1);
    this.speed = Math.max(-adjMax * 0.3, Math.min(adjMax, this.speed));

    if (Math.abs(this.speed) > 0.5) {
      const turn = this.speed / max;
      if (input.left) this.mesh.rotation.y += CONFIG.car.steerSpeed * turn * dt * dmgMult * this.gripMult;
      if (input.right) this.mesh.rotation.y -= CONFIG.car.steerSpeed * turn * dt * dmgMult * this.gripMult;
    }

    if (this.fuel > 0 && Math.abs(this.speed) > 1) {
      this.fuel = Math.max(0, this.fuel - this.fuelConsumption * Math.abs(this.speed) * dt * 0.1);
    }

    this.mesh.position.x += Math.sin(this.mesh.rotation.y) * this.speed * dt;
    this.mesh.position.z += Math.cos(this.mesh.rotation.y) * this.speed * dt;

    this.bobTime += dt * (4 + Math.abs(this.speed) * 0.25);
    const bump = Math.sin(this.bobTime) * 0.015;
    const lean = Math.abs(this.speed) > 1 ? Math.sin(this.mesh.rotation.y) * Math.min(0.025, Math.abs(this.speed) * 0.0005) : 0;
    this.mesh.rotation.z = lean;
    this.mesh.position.y = bump;

     const hw = CONFIG.world.half - 10;
     this.mesh.position.x = Math.max(-hw, Math.min(hw, this.mesh.position.x));
     this.mesh.position.z = Math.max(-hw, Math.min(hw, this.mesh.position.z));

     const rx = Math.abs(this.mesh.position.z);
     const ry = Math.abs(this.mesh.position.x);
     const onHRoad = rx <= ROAD_EDGE && ry <= ROAD_HALF + 8;
     const onVRoad = ry <= ROAD_EDGE && rx <= ROAD_HALF + 8;
     if (!onHRoad && !onVRoad) {
       const pushBack = 15 * dt;
       if (rx > ROAD_EDGE + 2) {
         const sign = this.mesh.position.z > 0 ? -1 : 1;
         this.mesh.position.z += sign * pushBack;
       }
       if (ry > ROAD_EDGE + 2) {
         const sign = this.mesh.position.x > 0 ? -1 : 1;
         this.mesh.position.x += sign * pushBack;
       }
       if (Math.abs(this.speed) > 5) this.speed *= 0.95;
     }
  }

  takeDamage(amount) {
    this.damage = Math.min(this.maxDamage, this.damage + amount);
  }

  repair(amount) {
    this.damage = Math.max(0, this.damage - amount);
  }

  addFuel(amount) {
    this.fuel = Math.min(this.maxFuel, this.fuel + amount);
  }

  getDamageLevel() {
    if (this.damage < 20) return 'good';
    if (this.damage < 50) return 'fair';
    if (this.damage < 80) return 'damaged';
    return 'critical';
  }

  getFuelLevel() {
    if (this.fuel > 60) return 'full';
    if (this.fuel > 30) return 'medium';
    if (this.fuel > 10) return 'low';
    return 'empty';
  }

  occupy() { this.occupied = true; }
  vacate() { this.occupied = false; this.speed = 0; }

  get position() { return this.mesh.position; }

  destroy() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(c => { if (c.isMesh) { c.geometry?.dispose(); c.material?.dispose(); } });
  }
}
