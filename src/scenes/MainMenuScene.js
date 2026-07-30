export class MainMenuScene {
  constructor(manager) {
    this.manager = manager;
  }

  enter() {
    const d = document.createElement('div');
    d.id = 'menu-screen';
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0a1a;z-index:1000;flex-direction:column;font-family:Arial';
    d.innerHTML = `
      <h1 style="font-size:48px;color:#44aaff;margin:0;text-shadow:0 0 20px rgba(68,170,255,0.3)">OPEN WORLD</h1>
      <h2 style="font-size:56px;color:#ff6b35;margin:0 0 40px;text-shadow:0 0 20px rgba(255,107,53,0.3)">DRIVING</h2>
      <button id="menu-play" style="padding:14px 60px;font-size:24px;background:#44aaff;color:#fff;border:none;border-radius:10px;cursor:pointer;margin:6px;transition:transform 0.1s">▶ SINGLE PLAYER</button>
      <button id="menu-multi" style="padding:14px 60px;font-size:24px;background:#ff6b35;color:#fff;border:none;border-radius:10px;cursor:pointer;margin:6px;transition:transform 0.1s">🌐 MULTIPLAYER</button>
      <p style="margin-top:30px;color:#666;font-size:12px">WASD Drive &bull; SPACE Boost &bull; V Camera &bull; ESC Pause</p>
    `;
    document.body.appendChild(d);

    document.getElementById('menu-play').onclick = () => this.startSingle();
    document.getElementById('menu-multi').onclick = () => this.startMulti();

    document.addEventListener('keydown', this._keyHandler = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.startSingle(); }
    });
  }

  startSingle() {
    document.removeEventListener('keydown', this._keyHandler);
    this.exit();
    this.manager.start('select');
  }

  startMulti() {
    document.removeEventListener('keydown', this._keyHandler);
    this.exit();
    this.manager.start('rooms');
  }

  exit() {
    const d = document.getElementById('menu-screen');
    if (d) d.remove();
  }
}
