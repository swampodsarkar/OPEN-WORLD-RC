import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SceneManager } from './scenes/SceneManager.js';
import { SettingsService } from './services/SettingsService.js';
import { ProgressService } from './services/ProgressService.js';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('game-container').appendChild(renderer.domElement);

const manager = new SceneManager(renderer);
window.__nitroManager = manager;
window.__THREE = THREE;

ProgressService.init();
window.__progress = ProgressService;

const composer = new EffectComposer(renderer);
window.__composer = composer;
composer.addPass(new RenderPass(manager.scene, manager.camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.35, 0.4, 0.85
);
composer.addPass(bloomPass);

const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
composer.addPass(smaaPass);

composer.addPass(new OutputPass());

SettingsService.applyGfx(renderer, composer);
SettingsService.applyBrightness();

window.addEventListener('resize', scheduleResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleResize);

let _rsRaf = 0;
function scheduleResize() {
  if (_rsRaf) return;
  _rsRaf = requestAnimationFrame(() => {
    _rsRaf = 0;
    const w = window.innerWidth;
    const h = window.innerHeight;
    manager.camera.aspect = w / h;
    manager.camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    smaaPass.setSize(w, h);
  });
}

renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  window.__glLost = true;
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  window.__glLost = false;
  const reupload = (obj) => {
    obj.traverse((o) => {
      if (!o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        Object.keys(m).forEach((k) => {
          if (k === 'map' || k.endsWith('Map') || k === 'envMap') {
            const t = m[k];
            if (t && t.isTexture) { t.needsUpdate = true; }
          }
        });
      });
    });
  };
  reupload(manager.scene);
});

document.addEventListener('touchmove', (e) => { if (e.target === renderer.domElement) e.preventDefault(); }, { passive: false });

const clock = new THREE.Clock();
let lastFrame = performance.now();
window.__frames = 0;

function animate() {
  requestAnimationFrame(animate);
  const fpsCap = SettingsService.get().fps || 0;
  const frameMs = fpsCap > 0 ? 1000 / fpsCap : 0;
  const now = performance.now();
  if (frameMs > 0 && (now - lastFrame) < frameMs) return;
  lastFrame = now;
  window.__frames++;
  const dt = Math.min(clock.getDelta(), 0.05);
  manager.update(dt);
  composer.render();
}

manager.start('boot');
animate();
