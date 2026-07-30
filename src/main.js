import * as THREE from 'three';
import { SceneManager } from './scenes/SceneManager.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('game-container').appendChild(renderer.domElement);

const manager = new SceneManager(renderer);

window.addEventListener('resize', () => {
  manager.camera.aspect = window.innerWidth / window.innerHeight;
  manager.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  manager.update(dt);
  renderer.render(manager.scene, manager.camera);
}

manager.start('boot');
animate();
