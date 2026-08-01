export class Boat {
  constructor(scene, model, x, z, name, scale = 2) {
    this.scene = scene;
    this.name = name.replace(/-/g, ' ');
    this.mesh = model.clone();
    this.mesh.position.set(x, 0, z);
    this.mesh.scale.set(scale, scale, scale);
    this.mesh.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    scene.add(this.mesh);

    this.speed = 0;
    this.mesh.rotation.y = 0;
    this.occupied = false;
    this.boost = false;
    this.bobTime = 0;
    this.waterY = 0.35;

    this.maxSpeed = 16;
    this.acceleration = 8;
    this.braking = 12;
    this.friction = 0.985;
    this.steerSpeed = 1.6;
  }

  drive(input, dt) {
    if (input.forward) this.speed += this.acceleration * dt;
    else if (input.backward) this.speed -= this.braking * dt;
    else this.speed *= this.friction;

    const max = this.boost ? this.maxSpeed * 1.4 : this.maxSpeed;
    this.speed = Math.max(-max * 0.3, Math.min(max, this.speed));

    if (Math.abs(this.speed) > 0.3) {
      const turn = this.speed / max;
      if (input.left) this.mesh.rotation.y += this.steerSpeed * turn * dt;
      if (input.right) this.mesh.rotation.y -= this.steerSpeed * turn * dt;
    }

    this.mesh.position.x += Math.sin(this.mesh.rotation.y) * this.speed * dt;
    this.mesh.position.z += Math.cos(this.mesh.rotation.y) * this.speed * dt;

    this.bobTime += dt * (2.5 + Math.abs(this.speed) * 0.15);
    const bob = Math.sin(this.bobTime) * 0.06;
    this.mesh.position.y = this.waterY + bob;
    this.mesh.rotation.x = Math.sin(this.bobTime * 0.8) * 0.015;
    this.mesh.rotation.z = Math.sin(this.bobTime * 1.3) * 0.01 + Math.min(0.03, Math.abs(this.speed) * 0.002);
  }

  occupy() { this.occupied = true; }
  vacate() { this.occupied = false; this.speed = 0; }

  get position() { return this.mesh.position; }

  destroy() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(c => { if (c.isMesh) { c.geometry?.dispose(); c.material?.dispose(); } });
  }
}
