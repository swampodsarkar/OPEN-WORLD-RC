export class LoadingScene {
  constructor(manager) {
    this.manager = manager;
    this.steps = [
      { pct: 15, text: 'Starting engine...' },
      { pct: 35, text: 'Loading world...' },
      { pct: 60, text: 'Placing buildings...' },
      { pct: 85, text: 'Spawning vehicles...' },
      { pct: 100, text: 'Ready!' },
    ];
    this.stepIdx = 0;
    this.worldData = null;
    this.overlay = null;
  }

  enter(data) {
    this.worldData = data || {};
    this.stepIdx = 0;

    this.overlay = document.createElement('div');
    this.overlay.id = 'loading-screen';
    this.overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0a0a1a,#111133);z-index:1100;flex-direction:column';
    this.overlay.innerHTML = `
      <div style="text-align:center;color:#fff;width:320px">
        <div style="font-family:Orbitron,monospace;font-size:14px;color:#ff6b35;letter-spacing:4px;text-transform:uppercase;margin-bottom:6px">Entering World</div>
        <div style="font-family:Orbitron,monospace;font-size:34px;font-weight:900;background:linear-gradient(135deg,#44aaff,#2266cc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:20px">LOADING</div>
        <div style="position:relative;width:100%;height:4px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;margin-bottom:8px">
          <div id="load-bar-fill" style="height:100%;width:0%;background:linear-gradient(90deg,#ff6b35,#ffaa44);border-radius:4px;transition:width 0.2s ease"></div>
          <div id="load-bar-glow" style="position:absolute;top:0;left:0;height:100%;width:0%;background:linear-gradient(90deg,transparent,rgba(255,107,53,0.4),transparent);border-radius:4px;filter:blur(4px);transition:width 0.2s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span id="load-status" style="color:#888;font-family:Rajdhani,sans-serif;font-size:13px">Loading...</span>
          <span id="load-pct" style="color:#ff6b35;font-family:Orbitron,monospace;font-size:13px;font-weight:700">0%</span>
        </div>
        <div id="load-tip" style="margin-top:22px;color:#556;font-family:Rajdhani,sans-serif;font-size:13px;letter-spacing:1px">Please wait</div>
      </div>
    `;
    document.body.appendChild(this.overlay);
    this.barFill = this.overlay.querySelector('#load-bar-fill');
    this.barGlow = this.overlay.querySelector('#load-bar-glow');
    this.statusText = this.overlay.querySelector('#load-status');
    this.progressPct = this.overlay.querySelector('#load-pct');
    this.tipText = this.overlay.querySelector('#load-tip');

    this.tips = [
      'Tip: Press SPACE for boost!',
      'Tip: Visit the repair shop to fix damage.',
      'Tip: Watch your fuel gauge.',
      'Tip: Press V to zoom the camera.',
      'Tip: ESC to pause.',
      'Tip: Drift around corners for points.',
      'Tip: Buildings cause damage.',
      'Tip: Headlights turn on at night.',
    ];
    this.tipIdx = 0;
    this.tipInterval = setInterval(() => {
      this.tipIdx++;
      if (this.tipText) {
        this.tipText.style.opacity = '0';
        this.tipText.style.transform = 'translateY(8px)';
        setTimeout(() => {
          if (this.tipText && this.overlay) {
            this.tipText.textContent = this.tips[(this.tipIdx - 1) % this.tips.length];
            this.tipText.style.opacity = '1';
            this.tipText.style.transform = 'translateY(0)';
          }
        }, 250);
      }
    }, 2200);

    setTimeout(() => this.runStep(), 200);
  }

  runStep() {
    if (!this.overlay) return;
    if (this.stepIdx >= this.steps.length) {
      if (this.barFill) this.barFill.style.width = '100%';
      if (this.barGlow) this.barGlow.style.width = '100%';
      if (this.progressPct) this.progressPct.textContent = '100%';
      if (this.statusText) this.statusText.textContent = 'Entering world...';
      setTimeout(() => this.startGame(), 250);
      return;
    }
    const step = this.steps[this.stepIdx];
    if (this.barFill) this.barFill.style.width = step.pct + '%';
    if (this.barGlow) this.barGlow.style.width = step.pct + '%';
    if (this.progressPct) this.progressPct.textContent = step.pct + '%';
    if (this.statusText) this.statusText.textContent = step.text;
    this.stepIdx++;
    setTimeout(() => this.runStep(), 420);
  }

  startGame() {
    this.cleanup();
    this.manager.start('game', this.worldData);
  }

  cleanup() {
    if (this.tipInterval) { clearInterval(this.tipInterval); this.tipInterval = null; }
    if (this.overlay) {
      this.overlay.style.opacity = '0';
      this.overlay.style.transition = 'opacity 0.25s ease';
      setTimeout(() => { if (this.overlay) { this.overlay.remove(); this.overlay = null; } }, 260);
    }
  }

  exit() {
    this.cleanup();
  }
}
