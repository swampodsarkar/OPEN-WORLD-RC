export class BootScene {
  constructor(manager) {
    this.manager = manager;
    this._timeout = null;
  }

  enter() {
    if (this.manager.crazyGames) this.manager.crazyGames.init();
    const d = document.createElement('div');
    d.id = 'boot-screen';
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,#0d1b2a 0%,#060810 70%,#04050a 100%);z-index:1000;flex-direction:column;font-family:Orbitron,monospace;overflow:hidden';
    d.innerHTML = `
      <style>
        @keyframes smFadeUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes smGlow { 0%,100% { text-shadow:0 0 22px rgba(68,170,255,0.45); } 50% { text-shadow:0 0 42px rgba(68,170,255,0.85); } }
        @keyframes smPulse { 0%,100% { opacity:0.55; } 50% { opacity:1; } }
      </style>
      <div style="animation:smFadeUp 0.7s ease-out both;text-align:center">
        <div style="font-size:15px;color:#556;letter-spacing:10px;text-transform:uppercase;margin-bottom:18px">A Game By</div>
        <div id="sm-studio" style="font-size:64px;font-weight:900;letter-spacing:8px;background:linear-gradient(135deg,#44aaff,#ffffff,#44aaff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:smFadeUp 0.9s ease-out 0.15s both, smGlow 3s ease-in-out 1s infinite">SM STUDIO</div>
        <div style="font-size:14px;color:#889;letter-spacing:8px;text-transform:uppercase;margin-top:22px;animation:smFadeUp 0.8s ease-out 0.5s both, smPulse 2s ease-in-out 1.2s infinite">Presents</div>
        <div style="font-family:Orbitron,monospace;font-size:34px;font-weight:900;margin-top:30px;letter-spacing:5px;background:linear-gradient(135deg,#ff6b35,#ffaa44);-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:smFadeUp 1s ease-out 0.8s both">NITRO ROAM</div>
      </div>
    `;
    document.body.appendChild(d);

    this._timeout = setTimeout(() => {
      d.style.transition = 'opacity 0.5s ease';
      d.style.opacity = '0';
      setTimeout(() => {
        d.remove();
        this.manager.start('preload');
      }, 500);
    }, 5000);
  }

  exit() {
    if (this._timeout) { clearTimeout(this._timeout); this._timeout = null; }
    const d = document.getElementById('boot-screen');
    if (d) d.remove();
  }
}
