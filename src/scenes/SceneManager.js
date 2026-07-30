import * as THREE from 'three';
import { BootScene } from './BootScene.js';
import { PreloadScene } from './PreloadScene.js';
import { MainMenuScene } from './MainMenuScene.js';
import { CarSelectScene } from './CarSelectScene.js';
import { LoadingScene } from './LoadingScene.js';
import { RoomScene } from './RoomScene.js';
import { GameScene } from './GameScene.js';

export class SceneManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
    this.models = {};

    this.scenes = {};
    this.current = null;

    this.add('boot', new BootScene(this));
    this.add('preload', new PreloadScene(this));
    this.add('menu', new MainMenuScene(this));
    this.add('select', new CarSelectScene(this));
    this.add('loading', new LoadingScene(this));
    this.add('rooms', new RoomScene(this));
    this.add('game', new GameScene(this));
  }

  add(key, scene) { this.scenes[key] = scene; }

  start(key, data) {
    if (this.current) this.current.exit();
    this.current = this.scenes[key];
    this.current.enter(data);
  }

  update(dt) {
    if (this.current && this.current.update) this.current.update(dt);
  }
}
