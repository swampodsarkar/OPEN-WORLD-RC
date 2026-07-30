import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SceneManager } from './scenes/SceneManager.js';

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('game-container').appendChild(renderer.domElement);

const manager = new SceneManager(renderer);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(manager.scene, manager.camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.4, 0.4, 0.85
);
composer.addPass(bloomPass);

const ssaoPass = new SSAOPass(manager.scene, manager.camera, window.innerWidth, window.innerHeight);
ssaoPass.kernelRadius = 16;
ssaoPass.minDistance = 0.005;
ssaoPass.maxDistance = 0.1;
composer.addPass(ssaoPass);

const filmPass = new FilmPass(0.35, 0.5, 2048, false);
composer.addPass(filmPass);

const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
composer.addPass(smaaPass);

composer.addPass(new OutputPass());

window.addEventListener('resize', () => {
  manager.camera.aspect = window.innerWidth / window.innerHeight;
  manager.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  smaaPass.setSize(window.innerWidth, window.innerHeight);
  ssaoPass.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('touchmove', (e) => { if (e.target === renderer.domElement) e.preventDefault(); }, { passive: false });

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  manager.update(dt);
  composer.render();
}

manager.start('boot');
animate();
