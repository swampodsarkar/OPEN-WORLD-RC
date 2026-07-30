export class MainMenuScene {
  constructor(manager) {
    this.manager = manager;
    this.overlay = null;
  }

  enter() {
    const d = document.createElement('div');
    d.id = 'menu-screen';
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:1000;flex-direction:column;font-family:Arial;overflow:hidden';
    d.innerHTML = `
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,#0a0a1a 0%,#111133 50%,#0a0a1a 100%)"></div>
      <div id="menu-bg-particles" style="position:absolute;inset:0;overflow:hidden"></div>
      <div style="position:relative;z-index:1;text-align:center">
        <div id="menu-title-top" style="font-family:Orbitron,monospace;font-size:28px;color:#44aaff;letter-spacing:8px;text-transform:uppercase;opacity:0;transform:translateY(-20px);transition:all 0.6s ease">Open World</div>
        <div id="menu-title-bottom" style="font-family:Orbitron,monospace;font-size:72px;font-weight:900;background:linear-gradient(135deg,#ff6b35,#ffaa44);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-shadow:none;margin:0 0 40px;letter-spacing:6px;opacity:0;transform:scale(0.8);transition:all 0.6s ease 0.2s">DRIVING</div>
        <div id="menu-divider" style="width:0;height:2px;background:linear-gradient(90deg,transparent,#44aaff,transparent);margin:0 auto 30px;transition:width 0.8s ease 0.4s"></div>
        <button id="menu-play" class="menu-btn menu-btn-primary" style="opacity:0;transform:translateY(20px);transition:all 0.5s ease 0.6s">▶ SINGLE PLAYER</button>
        <button id="menu-multi" class="menu-btn menu-btn-secondary" style="opacity:0;transform:translateY(20px);transition:all 0.5s ease 0.8s">🌐 MULTIPLAYER</button>
        <div id="menu-footer" style="margin-top:40px;color:#444;font-family:Rajdhani,sans-serif;font-size:12px;letter-spacing:2px;opacity:0;transition:opacity 0.6s ease 1s">
          WASD Drive · SPACE Boost · V Camera · ESC Pause
        </div>
      </div>
      <style>
        .menu-btn { display:block; margin:10px auto; padding:14px 60px; font-size:20px; font-weight:700; color:#fff; border:none; border-radius:10px; cursor:pointer; width:280px; letter-spacing:2px; position:relative; overflow:hidden; font-family:Rajdhani,sans-serif }
        .menu-btn::after { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.1),transparent); opacity:0; transition:opacity 0.3s }
        .menu-btn:hover::after { opacity:1 }
        .menu-btn-primary { background:linear-gradient(135deg,#44aaff,#2266cc); box-shadow:0 4px 20px rgba(68,170,255,0.3) }
        .menu-btn-primary:hover { transform:translateY(-2px) scale(1.02); box-shadow:0 6px 30px rgba(68,170,255,0.4) }
        .menu-btn-secondary { background:linear-gradient(135deg,#ff6b35,#cc4422); box-shadow:0 4px 20px rgba(255,107,53,0.3) }
        .menu-btn-secondary:hover { transform:translateY(-2px) scale(1.02); box-shadow:0 6px 30px rgba(255,107,53,0.4) }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 10px rgba(68,170,255,0.2)} 50%{box-shadow:0 0 30px rgba(68,170,255,0.5)} }
      </style>
    `;
    document.body.appendChild(d);
    this.overlay = d;

    this.createBgParticles();

    requestAnimationFrame(() => {
      document.getElementById('menu-title-top').style.opacity = '1';
      document.getElementById('menu-title-top').style.transform = 'translateY(0)';
      document.getElementById('menu-title-bottom').style.opacity = '1';
      document.getElementById('menu-title-bottom').style.transform = 'scale(1)';
      document.getElementById('menu-divider').style.width = '80px';
      document.getElementById('menu-play').style.opacity = '1';
      document.getElementById('menu-play').style.transform = 'translateY(0)';
      document.getElementById('menu-multi').style.opacity = '1';
      document.getElementById('menu-multi').style.transform = 'translateY(0)';
      document.getElementById('menu-footer').style.opacity = '1';
    });

    document.getElementById('menu-play').onclick = () => this.startSingle();
    document.getElementById('menu-multi').onclick = () => this.startMulti();

    document.addEventListener('keydown', this._keyHandler = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.startSingle(); }
    });
  }

  createBgParticles() {
    const container = document.getElementById('menu-bg-particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
      const dot = document.createElement('div');
      const size = 2 + Math.random() * 3;
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const dur = 3 + Math.random() * 4;
      dot.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:${size}px;height:${size}px;border-radius:50%;background:rgba(68,170,255,${0.1 + Math.random() * 0.15});animation:float ${dur}s ease-in-out infinite;animation-delay:${Math.random() * 2}s`;
      container.appendChild(dot);
    }
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
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
  }
}
