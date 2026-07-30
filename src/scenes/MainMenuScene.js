export class MainMenuScene {
  constructor(manager) {
    this.manager = manager;
    this.overlay = null;
  }

  enter() {
    const d = document.createElement('div');
    d.id = 'menu-screen';
    d.style.cssText = 'position:fixed;inset:0;z-index:1000;overflow:hidden;font-family:Rajdhani,sans-serif;color:#fff;background:#0f2b2b';
    d.innerHTML = `
      <div style="position:absolute;inset:0;background:linear-gradient(160deg,#0f2b2b 0%,#14303a 40%,#0f2530 100%)"></div>
      <div style="position:absolute;inset:0;opacity:0.25;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.03) 0px,rgba(255,255,255,0.03) 1px,transparent 1px,transparent 40px)"></div>
      <div style="position:relative;z-index:2;display:flex;flex-direction:column;height:100vh;padding:16px 24px 14px">

        <div style="display:flex;align-items:center;gap:18px;padding:4px 6px 10px">
          <div style="width:110px;height:54px;border-radius:8px;background:#0a0a0a;border:2px solid rgba(255,255,255,0.25);overflow:hidden;flex-shrink:0;position:relative">
            <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(68,170,255,0.15),rgba(0,0,0,0.6))"></div>
            <div style="position:absolute;bottom:6px;left:8px;font-size:10px;font-weight:700;color:#ffcc00;background:rgba(0,0,0,0.55);padding:3px 8px;border-radius:4px;letter-spacing:1px">A 677</div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-family:Orbitron,monospace;font-size:18px;font-weight:900;background:linear-gradient(135deg,#ffcc00,#ffaa44);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:1px;line-height:1.1">2005 Ford GT</div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
              <div style="display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.35);padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
                <div style="width:32px;height:32px;border-radius:50%;background:#333;border:2px solid rgba(255,255,255,0.3);overflow:hidden;flex-shrink:0">
                  <div style="width:100%;height:100%;background:linear-gradient(135deg,#556,#334)"></div>
                </div>
                <div>
                  <div style="font-size:11px;color:#888;font-weight:600;letter-spacing:1px">PLAYER</div>
                  <div style="font-size:13px;font-weight:700;color:#fff;letter-spacing:1px">139</div>
                </div>
                <div style="width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:10px;color:#aaa">♛</div>
              </div>
              <div style="background:rgba(0,0,0,0.35);padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:6px">
                <span style="color:#ffcc00;font-size:16px;font-weight:900;font-family:Orbitron,monospace">5,300,606</span>
                <span style="color:#886600;font-size:10px;font-weight:700">CR</span>
              </div>
            </div>
          </div>
          <div style="position:absolute;top:24px;right:24px;font-size:11px;color:#667;font-family:Rajdhani,sans-serif;letter-spacing:1px">127 GPU:85%</div>
        </div>

        <div style="display:flex;align-items:center;gap:4px;background:rgba(0,0,0,0.3);padding:6px 10px;border-radius:10px;margin-bottom:12px;border:1px solid rgba(255,255,255,0.06);backdrop-filter:blur(10px);position:relative">
          <button class="tab-btn" data-tab="campaign">CAMPAIGN</button>
          <button class="tab-btn" data-tab="cars">CARS</button>
          <button class="tab-btn tab-active" data-tab="map">WORLD MAP</button>
          <button class="tab-btn" data-tab="horizon">MY HORIZON</button>
          <button class="tab-btn" data-tab="online">ONLINE</button>
          <button class="tab-btn" data-tab="creative">CREATIVE HUB</button>
          <button class="tab-btn" data-tab="store">STORE</button>
          <button class="tab-arrow" style="margin-left:auto">▶</button>
          <button class="tab-arrow">◀</button>
        </div>

        <div style="position:relative;flex:1;min-height:0">
          <div style="display:grid;grid-template-columns:240px 1fr 240px;grid-template-rows:minmax(0,1fr) auto;gap:10px;height:100%">

            <div class="tile tile-pink" style="grid-row:1/3">
              <div style="display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;height:100%;padding:16px">
                <div>
                  <div style="width:48px;height:48px;background:rgba(0,0,0,0.25);border-radius:12px;border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;margin-bottom:10px">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M20 7H6.5A2.5 2.5 0 0 0 4 9.5v0"/><path d="M4 9.5V14"/><rect x="7" y="4" width="10" height="16" rx="1"/></svg>
                  </div>
                  <div style="font-size:26px;font-weight:900;line-height:1.05;letter-spacing:0.5px">Collection<br>Journal</div>
                  <div style="margin-top:8px;font-size:12px;color:rgba(255,255,255,0.7);line-height:1.3">View your Collection Progress</div>
                </div>
                <div style="width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;align-self:flex-end">3</div>
              </div>
            </div>

            <div class="tile tile-map" style="position:relative;overflow:hidden">
              <canvas id="menu-map-canvas" style="position:absolute;inset:0;width:100%;height:100%;opacity:0.85"></canvas>
              <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(0,0,0,0.65) 100%)"></div>
              <div style="position:absolute;top:0;left:0;right:0;padding:14px 16px">
                <div style="font-size:34px;font-weight:900;letter-spacing:0.5px;text-shadow:0 2px 8px rgba(0,0,0,0.6)">World Map</div>
              </div>
              <div style="position:absolute;top:14px;right:14px;display:flex;gap:8px">
                <div style="width:28px;height:28px;border-radius:6px;background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff">❄️</div>
                <div style="width:28px;height:28px;border-radius:6px;background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff">🌙</div>
                <div style="width:28px;height:28px;border-radius:6px;background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff">🕒</div>
              </div>
              <div style="position:absolute;bottom:14px;left:14px;display:flex;align-items:center;gap:8px">
                <div style="background:rgba(0,0,0,0.55);padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;letter-spacing:1px">
                  <span style="font-size:14px">📍</span> Ohtani Region
                </div>
                <span style="font-size:11px;color:rgba(255,255,255,0.6)">Night</span>
              </div>
              <div style="position:absolute;top:14px;right:80px;width:40px;height:40px">
                <div style="width:100%;height:100%;background:rgba(255,255,255,0.08);border-radius:8px;border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:22px">🍜</div>
              </div>
            </div>

            <div class="tile tile-orange" style="grid-row:1/3">
              <div style="display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;height:100%;padding:14px">
                <div>
                  <div style="font-family:Orbitron,monospace;font-size:14px;font-weight:900;font-style:italic;line-height:1;letter-spacing:0.5px;text-shadow:0 2px 6px rgba(0,0,0,0.4)">festival<br>playlist</div>
                  <div style="margin-top:14px;width:40px;height:40px;background:rgba(0,0,0,0.25);border-radius:50%;border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:18px">🎵</div>
                </div>
                <div style="align-self:flex-end;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff">1</div>
              </div>
            </div>

            <div class="tile tile-cyan">
              <div style="display:flex;align-items:center;justify-content:space-between;height:100%;padding:12px 14px">
                <div>
                  <div style="font-size:22px;font-weight:900;letter-spacing:0.5px;line-height:1.1">What's<br>Next</div>
                  <div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:1px">Recommended Content</div>
                </div>
                <div style="display:flex;gap:6px;transform:rotate(-12deg)">
                  <div style="width:18px;height:28px;background:linear-gradient(180deg,#ff00cc,#aa00ff);border-radius:4px;transform:rotate(-15deg)"></div>
                  <div style="width:18px;height:36px;background:linear-gradient(180deg,#00ccff,#0066ff);border-radius:4px;transform:rotate(-5deg)"></div>
                  <div style="width:18px;height:24px;background:linear-gradient(180deg,#ffcc00,#ff6600);border-radius:4px;transform:rotate(10deg)"></div>
                </div>
              </div>
            </div>

            <div class="tile tile-white">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;height:100%">
                <div>
                  <div style="font-size:22px;font-weight:900;color:#111;letter-spacing:0.5px">Settings</div>
                </div>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </div>
            </div>

            <div class="tile tile-orange-dark">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;height:100%">
                <div>
                  <div style="font-size:20px;font-weight:900;line-height:1.1;letter-spacing:0.5px">Horizon<br>Decades</div>
                  <div style="margin-top:8px;font-size:10px;color:rgba(255,255,255,0.7);letter-spacing:1px">Season Ends In:</div>
                  <div style="margin-top:4px;background:rgba(0,0,0,0.45);display:inline-block;padding:4px 10px;border-radius:6px;font-family:Orbitron,monospace;font-size:12px;font-weight:700;color:#fff;border:1px solid rgba(255,255,255,0.15)">8d 23h 13min</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div style="display:flex;gap:10px;padding-top:10px;flex-wrap:wrap">
          <div class="hint">Enter <span class="hint-key">Select</span></div>
          <div class="hint">Esc <span class="hint-key">Back</span></div>
          <div class="hint">X <span class="hint-key">Reset Car Position</span></div>
          <div class="hint">Y <span class="hint-key">Convoy</span></div>
          <div class="hint">Backspace <span class="hint-key">Series Update</span></div>
        </div>
      </div>

      <style>
        .tile { border-radius:16px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 8px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08); overflow:hidden; position:relative }
        .tile-pink { background:linear-gradient(135deg,#ec4899,#db2777) }
        .tile-map { background:#0c1821; border-color:rgba(255,255,255,0.12) }
        .tile-orange { background:linear-gradient(135deg,#ff7a18,#ff4500) }
        .tile-cyan { background:linear-gradient(135deg,#00e5ff,#00b0ff) }
        .tile-white { background:linear-gradient(135deg,#f3f3f3,#dcdcdc); color:#111; border-color:rgba(0,0,0,0.08) }
        .tile-orange-dark { background:linear-gradient(135deg,#ff5722,#d84315) }
        .tab-btn { background:rgba(255,255,255,0.05); color:#aab; border:1px solid rgba(255,255,255,0.08); padding:8px 14px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; letter-spacing:1px; transition:all 0.2s; font-family:Rajdhani,sans-serif }
        .tab-btn:hover { background:rgba(255,255,255,0.1); color:#fff }
        .tab-active { background:rgba(0,0,0,0.45); color:#fff; border-color:rgba(255,255,255,0.25); box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05) }
        .tab-arrow { width:28px; height:28px; border-radius:6px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#aab; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer }
        .hint { font-size:11px; color:#5a6; letter-spacing:1px; background:rgba(0,0,0,0.3); padding:4px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; gap:6px }
        .hint-key { color:#88a; font-weight:700; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.08) }
      </style>
    `;
    document.body.appendChild(d);
    this.overlay = d;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => {
        if (btn.dataset.tab === 'campaign') this.startPlay();
      };
    });

    document.getElementById('menu-play')?.remove();

    requestAnimationFrame(() => this.drawMenuMap());
  }

  drawMenuMap() {
    const canvas = document.getElementById('menu-map-canvas');
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 400;
    canvas.height = canvas.offsetHeight || 300;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f1f28';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,170,0,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.2, canvas.height * 0.3);
    ctx.lineTo(canvas.width * 0.7, canvas.height * 0.25);
    ctx.lineTo(canvas.width * 0.75, canvas.height * 0.65);
    ctx.stroke();

    ctx.fillStyle = 'rgba(68,170,255,0.85)';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.5, canvas.height * 0.45, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  startPlay() {
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
