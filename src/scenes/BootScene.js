export class BootScene {
  constructor(manager) {
    this.manager = manager;
  }

  enter() {
    const d = document.createElement('div');
    d.id = 'boot-screen';
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0a1a;z-index:1000;flex-direction:column;font-family:Arial';
    d.innerHTML = `
      <h1 style="font-size:42px;color:#44aaff;margin:0">OPEN WORLD</h1>
      <h2 style="font-size:56px;color:#ff6b35;margin:0">DRIVING</h2>
      <p style="margin-top:40px;color:#666;font-size:14px">Loading...</p>
    `;
    document.body.appendChild(d);

    setTimeout(() => {
      d.remove();
      this.manager.start('preload');
    }, 600);
  }

  exit() {
    const d = document.getElementById('boot-screen');
    if (d) d.remove();
  }
}
