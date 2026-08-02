import * as THREE from 'three';

export class Plane {
  constructor(scene, model, x, z, name) {
    this.scene = scene;
    this.name = (name || 'F-15 Eagle').replace(/-/g, ' ');
    this.mesh = model.clone();

    // Normalize so the longest horizontal dimension fits within the target span
    const box = new THREE.Box3().setFromObject(this.mesh);
    const size = box.getSize(new THREE.Vector3());
    const longest = Math.max(size.x, size.z, size.y);
    const TARGET = 20;
    this.mesh.scale.setScalar(TARGET / (longest || 1));

    this.mesh.position.set(x, 1.6, z);
    this.mesh.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    scene.add(this.mesh);

    this.name = this.name;
    this.speed = 0;
    this.maxSpeed = 170;
    this.accel = 42;
    this.brake = 26;
    this.drag = 0.996;
    this.altitude = 1.6;
    this.verticalSpeed = 0;
    this.climbRate = 26;
    this.gravity = 26;

    this.occupied = false;
    this.engineOn = false;

    this.damage = 0;
    this.maxDamage = 100;
    this.damageSpeedPenalty = 0.45;
    this.crashed = false;

    this.bank = 0;
    this.pitchVis = 0;
    this.bobTime = Math.random() * 10;
  }

  drive(input, dt) {
    if (this.crashed) {
      this.mesh.rotation.x += dt * 0.8;
      this.mesh.position.y = Math.max(1.2, this.mesh.position.y - 4 * dt);
      this.mesh.position.y = 1.2;
      this.speed = Math.max(0, this.speed - 20 * dt);
      return;
    }

    // Throttle
    if (input.forward) this.speed += this.accel * dt;
    else if (input.backward) this.speed = Math.max(0, this.speed - this.brake * dt);
    else this.speed *= this.drag;
    const maxSpd = input.boost ? this.maxSpeed * 1.3 : this.maxSpeed;
    this.speed = Math.min(maxSpd, this.speed);

    const groundBand = this.altitude <= 2.5;

    // Steering
    let steer = 0;
    if (input.left) { this.mesh.rotation.y += (groundBand ? 1.5 : 0.85) * dt; steer = -1; }
    if (input.right) { this.mesh.rotation.y -= (groundBand ? 1.5 : 0.85) * dt; steer = 1; }
    this.steer = steer;

    // Lift: need speed to leave the runway
    const onRunway = this.altitude >= 1.6 && this.altitude <= 2.5 && this.speed > 0;
    if (onRunway && this.speed > 58) {
      this.altitude = 2.6;
      this.verticalSpeed = 6;
    }

    // Pitch control (airborne): holding forward climbs, holding back dives
    if (this.altitude > 2.5 && this.speed > 12) {
      if (input.forward) this.verticalSpeed += this.climbRate * dt;
      if (input.backward) this.verticalSpeed -= this.climbRate * 0.9 * dt;
    }
    if (this.altitude > 2.5 && input.boost) this.verticalSpeed += this.climbRate * 1.6 * dt;

    // Gravity while airborne; small lift at speed
    if (this.altitude > 2.5) {
      const lift = Math.min(0.9, Math.max(0, (this.speed - 40) / 120));
      this.verticalSpeed += this.gravity * (1 - lift * 0.4) * dt;
    }

    this.altitude += this.verticalSpeed * dt;

    // Ground clamp
    const g = 1.6;
    if (this.altitude < g) {
      // Hard landing damage only on a fast descent
      if (this.verticalSpeed < -12 && this.speed > 40) {
        this.takeDamage(Math.min(50, Math.abs(this.verticalSpeed) * 3 + (this.speed - 40) * 0.2));
      }
      this.altitude = g;
      this.verticalSpeed = 0;
    }
    this.verticalSpeed *= 0.99;

    // Position
    this.mesh.position.x += Math.sin(this.mesh.rotation.y) * this.speed * dt;
    this.mesh.position.z += Math.cos(this.mesh.rotation.y) * this.speed * dt;
    this.mesh.position.y = this.altitude + Math.sin(this.bobTime) * (this.altitude <= 2.5 ? 0.02 : 0);
    this.bobTime += dt * 3;

    // Bank when turning
    const targetBank = this.altitude > 2.5 ? (-this.steer * 0.35) : 0;
    this.bank += (targetBank - this.bank) * dt * 4;
    this.mesh.rotation.z = this.bank;

    const wind = this.altitude > 2.5 ? 0.05 : 0.01;
    this.pitchVis += (wind * Math.sin(this.speed * 0.03 + this.bobTime) - this.pitchVis) * dt * 3;
    this.mesh.rotation.x = this.pitchVis;

    const hw = 2800;
    this.mesh.position.x = Math.max(-hw, Math.min(hw, this.mesh.position.x));
    this.mesh.position.z = Math.max(-hw, Math.min(hw, this.mesh.position.z));
  }

  takeDamage(amount) {
    if (this.crashed) return;
    this.damage = Math.min(this.maxDamage, this.damage + amount);
    if (this.damage >= this.maxDamage) {
      this.crashed = true;
      this.speed = 0;
      this.verticalSpeed = 0;
    }
  }

  repair(amount) { this.damage = Math.max(0, this.damage - amount); }

  getDamageLevel() {
    if (this.damage < 20) return 'good';
    if (this.damage < 50) return 'fair';
    if (this.damage < 80) return 'damaged';
    return 'critical';
  }

  occupy() { this.occupied = true; }
  vacate() { this.occupied = false; this.speed = 0; this.altitude = 1.6; this.verticalSpeed = 0; this.crashed = false; }

  get position() { return this.mesh.position; }

  destroy() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(c => { if (c.isMesh) { c.geometry?.dispose(); c.material?.dispose(); } });
  }
}