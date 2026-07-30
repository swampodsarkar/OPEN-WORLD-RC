import * as THREE from 'three';
import { CONFIG } from '../config.js';

const CAR_IDS = [
  'sedan', 'sedan-sports', 'suv', 'suv-luxury', 'taxi', 'police',
  'ambulance', 'race', 'race-future', 'van', 'truck', 'truck-flat',
  'delivery', 'delivery-flat', 'firetruck', 'garbage-truck', 'tractor',
  'tractor-shovel', 'hatchback-sports'
];
const CAR_NAMES = CAR_IDS.map(id => CONFIG.cars[id] || id.replace(/-/g, ' '));

const css = document.createElement('style');
css.textContent = `
  .mm-tile { border-radius:16px; border:1px solid rgba(255,255,255,0.1); box-shadow:0 8px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08); overflow:hidden; position:relative }
  .mm-tile-pink { background:linear-gradient(135deg,#ec4899,#db2777) }
  .mm-tile-map { background:#0c1821; border-color:rgba(255,255,255,0.12) }
  .mm-tile-orange { background:linear-gradient(135deg,#ff7a18,#ff4500) }
  .mm-tile-cyan { background:linear-gradient(135deg,#00e5ff,#00b0ff) }
  .mm-tile-white { background:linear-gradient(135deg,#f3f3f3,#dcdcdc); color:#111; border-color:rgba(0,0,0,0.08) }
  .mm-tile-orange-dark { background:linear-gradient(135deg,#ff5722,#d84315) }
  .mm-tab { background:rgba(255,255,255,0.05); color:#aab; border:1px solid rgba(255,255,255,0.08); padding:8px 14px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; letter-spacing:1px; transition:all 0.2s; font-family:Rajdhani,sans-serif }
  .mm-tab:hover { background:rgba(255,255,255,0.1); color:#fff }
  .mm-tab-active { background:rgba(0,0,0,0.45); color:#fff; border-color:rgba(255,255,255,0.25); box-shadow:inset 0 0 0 1px rgba(255,255,255,0.05) }
  .mm-arrow { width:28px; height:28px; border-radius:6px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#aab; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer }
  .mm-hint { font-size:11px; color:#5a6; letter-spacing:1px; background:rgba(0,0,0,0.3); padding:4px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; gap:6px }
  .mm-hint-key { color:#88a; font-weight:700; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.08) }
  .mm-overlay-btn { margin-top:24px; padding:10px 40px; font-size:16px; font-weight:700; color:#fff; border:none; border-radius:10px; cursor:pointer; background:linear-gradient(135deg,#44aaff,#2266cc); box-shadow:0 4px 20px rgba(68,170,255,0.3); letter-spacing:2px; font-family:Rajdhani,sans-serif }
  .mm-overlay-btn:hover { transform:translateY(-2px); box-shadow:0 6px 30px rgba(68,170,255,0.4) }
  .mm-stat { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; text-align:left }
`;
document.head.appendChild(css);

export class MainMenuScene {
  constructor(manager) {
    this.manager = manager;
    this.overlay = null;
    this.lastCarIdx = parseInt(localStorage.getItem('lastCarIdx') || '0', 10);
    this._keyHandler = null;
  }

  enter() {
    const d = document.createElement('div');
    d.id = 'menu-screen';
    d.style.cssText = 'position:fixed;inset:0;z-index:1000;overflow:hidden;font-family:Rajdhani,sans-serif;color:#fff;background:#0f2b2b';

    const bg = document.createElement('div');
    bg.style.cssText = 'position:absolute;inset:0;background:linear-gradient(160deg,#0f2b2b 0%,#14303a 40%,#0f2530 100%)';

    const pattern = document.createElement('div');
    pattern.style.cssText = 'position:absolute;inset:0;opacity:0.25;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.03) 0px,rgba(255,255,255,0.03) 1px,transparent 1px,transparent 40px)';

    const root = document.createElement('div');
    root.style.cssText = 'position:relative;z-index:2;display:flex;flex-direction:column;height:100vh;padding:16px 24px 14px';

    const header = this.createHeader();
    const tabs = this.createTabs();
    const tiles = this.createTiles();
    const footer = this.createFooter();

    root.appendChild(header);
    root.appendChild(tabs);
    root.appendChild(tiles);
    root.appendChild(footer);

    d.appendChild(bg);
    d.appendChild(pattern);
    d.appendChild(root);
    document.body.appendChild(d);
    this.overlay = d;

    this._keyHandler = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.startPlay(); }
    };
    document.addEventListener('keydown', this._keyHandler);

    requestAnimationFrame(() => this.drawMenuMap());
  }

  createHeader() {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:18px;padding:4px 6px 10px';

    const card = document.createElement('div');
    card.style.cssText = 'width:110px;height:54px;border-radius:8px;background:#0a0a0a;border:2px solid rgba(255,255,255,0.25);overflow:hidden;flex-shrink:0;position:relative';
    const cg = document.createElement('div');
    cg.style.cssText = 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(68,170,255,0.15),rgba(0,0,0,0.6))';
    const badge = document.createElement('div');
    badge.style.cssText = 'position:absolute;bottom:6px;left:8px;font-size:10px;font-weight:700;color:#ffcc00;background:rgba(0,0,0,0.55);padding:3px 8px;border-radius:4px;letter-spacing:1px';
    badge.textContent = 'A 677';
    card.appendChild(cg);
    card.appendChild(badge);

    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0';

    const title = document.createElement('div');
    title.style.cssText = 'font-family:Orbitron,monospace;font-size:18px;font-weight:900;background:linear-gradient(135deg,#ffcc00,#ffaa44);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:1px;line-height:1.1';
    title.textContent = '2005 Ford GT';

    const stats = document.createElement('div');
    stats.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:6px';

    const player = document.createElement('div');
    player.style.cssText = 'display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.35);padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)';
    const avatar = document.createElement('div');
    avatar.style.cssText = 'width:32px;height:32px;border-radius:50%;background:#333;border:2px solid rgba(255,255,255,0.3);overflow:hidden;flex-shrink:0';
    const ag = document.createElement('div');
    ag.style.cssText = 'width:100%;height:100%;background:linear-gradient(135deg,#556,#334)';
    avatar.appendChild(ag);
    const pname = document.createElement('div');
    const pnameLabel = document.createElement('div');
    pnameLabel.style.cssText = 'font-size:11px;color:#888;font-weight:600;letter-spacing:1px';
    pnameLabel.textContent = 'PLAYER';
    const pnameVal = document.createElement('div');
    pnameVal.style.cssText = 'font-size:13px;font-weight:700;color:#fff;letter-spacing:1px';
    pnameVal.textContent = '139';
    pname.appendChild(pnameLabel);
    pname.appendChild(pnameVal);
    const crown = document.createElement('div');
    crown.style.cssText = 'width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:10px;color:#aaa';
    crown.textContent = '♛';
    player.appendChild(avatar);
    player.appendChild(pname);
    player.appendChild(crown);

    const credits = document.createElement('div');
    credits.style.cssText = 'background:rgba(0,0,0,0.35);padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:6px';
    const cval = document.createElement('span');
    cval.style.cssText = 'color:#ffcc00;font-size:16px;font-weight:900;font-family:Orbitron,monospace';
    cval.textContent = '5,300,606';
    const clbl = document.createElement('span');
    clbl.style.cssText = 'color:#886600;font-size:10px;font-weight:700';
    clbl.textContent = 'CR';
    credits.appendChild(cval);
    credits.appendChild(clbl);

    stats.appendChild(player);
    stats.appendChild(credits);
    info.appendChild(title);
    info.appendChild(stats);
    row.appendChild(card);
    row.appendChild(info);

    const gpu = document.createElement('div');
    gpu.style.cssText = 'position:absolute;top:24px;right:24px;font-size:11px;color:#667;font-family:Rajdhani,sans-serif;letter-spacing:1px';
    gpu.textContent = '127 GPU:85%';
    row.appendChild(gpu);

    return row;
  }

  createTabs() {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;background:rgba(0,0,0,0.3);padding:6px 10px;border-radius:10px;margin-bottom:12px;border:1px solid rgba(255,255,255,0.06);backdrop-filter:blur(10px);position:relative';

    const tabs = [
      { key: 'campaign', label: 'CAMPAIGN' },
      { key: 'cars', label: 'CARS' },
      { key: 'map', label: 'WORLD MAP' },
      { key: 'horizon', label: 'MY HORIZON' },
      { key: 'online', label: 'ONLINE' },
      { key: 'creative', label: 'CREATIVE HUB' },
      { key: 'store', label: 'STORE' },
    ];
    tabs.forEach(t => {
      const b = document.createElement('button');
      b.className = 'mm-tab' + (t.key === 'map' ? ' mm-tab-active' : '');
      b.dataset.tab = t.key;
      b.textContent = t.label;
      b.onclick = () => {
        row.querySelectorAll('.mm-tab').forEach(x => x.classList.remove('mm-tab-active'));
        b.classList.add('mm-tab-active');
        const tab = b.dataset.tab;
        if (tab === 'campaign' || tab === 'cars') this.startPlay();
        else if (tab === 'map') this.startWorld();
        else if (tab === 'horizon') this.showStats();
        else if (tab === 'online') this.startMulti();
        else if (tab === 'creative') this.startCreative();
        else if (tab === 'store') this.showStore();
      };
      row.appendChild(b);
    });

    const spacer = document.createElement('div');
    spacer.style.cssText = 'margin-left:auto';
    row.appendChild(spacer);

    const a1 = document.createElement('button');
    a1.className = 'mm-arrow';
    a1.textContent = '▶';
    const a2 = document.createElement('button');
    a2.className = 'mm-arrow';
    a2.textContent = '◀';
    row.appendChild(a1);
    row.appendChild(a2);

    return row;
  }

  createTiles() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;flex:1;min-height:0';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:240px 1fr 240px;grid-template-rows:minmax(0,1fr) auto;gap:10px;height:100%';

    grid.appendChild(this.makeTile('journal', 'pink', [`
      <div style="width:48px;height:48px;background:rgba(0,0,0,0.25);border-radius:12px;border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;margin-bottom:10px">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M20 7H6.5A2.5 2.5 0 0 0 4 9.5v0"/><path d="M4 9.5V14"/><rect x="7" y="4" width="10" height="16" rx="1"/></svg>
      </div>
      <div style="font-size:26px;font-weight:900;line-height:1.05;letter-spacing:0.5px">Collection<br>Journal</div>
      <div style="margin-top:8px;font-size:12px;color:rgba(255,255,255,0.7);line-height:1.3">View your Collection Progress</div>
    `, `
      <div style="display:flex;align-items:flex-end;justify-content:flex-end">
        <div style="width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff">3</div>
      </div>
    `], '1/3'));

    grid.appendChild(this.makeTile('map', 'map', [`
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
    `], null, true));

    grid.appendChild(this.makeTile('playlist', 'orange', [`
      <div>
        <div style="font-family:Orbitron,monospace;font-size:14px;font-weight:900;font-style:italic;line-height:1;letter-spacing:0.5px;text-shadow:0 2px 6px rgba(0,0,0,0.4)">festival<br>playlist</div>
        <div style="margin-top:14px;width:40px;height:40px;background:rgba(0,0,0,0.25);border-radius:50%;border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:18px">🎵</div>
      </div>
    `, `
      <div style="align-self:flex-end">
        <div style="width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff">1</div>
      </div>
    `], '1/3'));

    grid.appendChild(this.makeTile('next', 'cyan', [`
      <div>
        <div style="font-size:22px;font-weight:900;letter-spacing:0.5px;line-height:1.1">What's<br>Next</div>
        <div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:1px">Recommended Content</div>
      </div>
      <div style="display:flex;gap:6px;transform:rotate(-12deg)">
        <div style="width:18px;height:28px;background:linear-gradient(180deg,#ff00cc,#aa00ff);border-radius:4px;transform:rotate(-15deg)"></div>
        <div style="width:18px;height:36px;background:linear-gradient(180deg,#00ccff,#0066ff);border-radius:4px;transform:rotate(-5deg)"></div>
        <div style="width:18px;height:24px;background:linear-gradient(180deg,#ffcc00,#ff6600);border-radius:4px;transform:rotate(10deg)"></div>
      </div>
    `], null));

    grid.appendChild(this.makeTile('settings', 'white', [`
      <div>
        <div style="font-size:22px;font-weight:900;color:#111;letter-spacing:0.5px">Settings</div>
      </div>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    `], null));

    grid.appendChild(this.makeTile('decades', 'orange-dark', [`
      <div>
        <div style="font-size:20px;font-weight:900;line-height:1.1;letter-spacing:0.5px">Horizon<br>Decades</div>
        <div style="margin-top:8px;font-size:10px;color:rgba(255,255,255,0.7);letter-spacing:1px">Season Ends In:</div>
        <div style="margin-top:4px;background:rgba(0,0,0,0.45);display:inline-block;padding:4px 10px;border-radius:6px;font-family:Orbitron,monospace;font-size:12px;font-weight:700;color:#fff;border:1px solid rgba(255,255,255,0.15)">8d 23h 13min</div>
      </div>
    `], null));

    wrap.appendChild(grid);
    return wrap;
  }

  makeTile(id, color, parts, rowSpan, absolute) {
    const tile = document.createElement('div');
    tile.className = 'mm-tile mm-tile-' + color;
    if (rowSpan) tile.style.gridRow = rowSpan;
    if (absolute) tile.style.cssText += ';position:relative;overflow:hidden';
    tile.style.padding = '14px';
    tile.style.display = 'flex';
    tile.style.flexDirection = 'column';
    tile.style.justifyContent = 'space-between';
    tile.style.height = '100%';

    const top = document.createElement('div');
    top.innerHTML = parts[0] || '';
    tile.appendChild(top);
    if (parts[1]) {
      const bottom = document.createElement('div');
      bottom.innerHTML = parts[1];
      tile.appendChild(bottom);
    }
    return tile;
  }

  createFooter() {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;padding-top:10px;flex-wrap:wrap';
    const items = [
      ['Enter', 'Select'], ['Esc', 'Back'], ['X', 'Reset Car Position'],
      ['Y', 'Convoy'], ['Backspace', 'Series Update']
    ];
    items.forEach(([key, label]) => {
      const h = document.createElement('div');
      h.className = 'mm-hint';
      h.innerHTML = `${key} <span class="mm-hint-key">${label}</span>`;
      row.appendChild(h);
    });
    return row;
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

  startWorld() {
    document.removeEventListener('keydown', this._keyHandler);
    this.exit();
    this.manager.start('loading', {
      mode: 'world',
      carIdx: this.lastCarIdx || 0,
      color: null,
      charIdx: 0,
      displayName: CAR_NAMES[this.lastCarIdx]
    });
  }

  startCreative() {
    document.removeEventListener('keydown', this._keyHandler);
    this.exit();
    this.manager.start('loading', {
      mode: 'creative',
      carIdx: this.lastCarIdx || 0,
      color: '#ff6b35',
      charIdx: 0,
      displayName: CAR_NAMES[this.lastCarIdx]
    });
  }

  startMulti() {
    document.removeEventListener('keydown', this._keyHandler);
    this.exit();
    this.manager.start('rooms');
  }

  showStats() {
    this.showOverlay('horizon');
  }

  showStore() {
    this.showOverlay('store');
  }

  showOverlay(type) {
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }

    const d = document.createElement('div');
    d.id = 'menu-overlay';
    d.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);z-index:1200;font-family:Rajdhani,sans-serif;color:#fff';

    const box = document.createElement('div');
    box.style.cssText = 'text-align:center;max-width:420px;width:92%;background:rgba(10,10,20,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:32px 28px';

    const heading = document.createElement('div');
    heading.style.cssText = 'font-family:Orbitron,monospace;font-size:20px;color:#44aaff;letter-spacing:3px;margin-bottom:6px';
    heading.textContent = type === 'horizon' ? 'MY HORIZON' : 'STORE';
    box.appendChild(heading);

    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:11px;color:#556;letter-spacing:2px;margin-bottom:24px';
    sub.textContent = type === 'horizon' ? 'Player Profile' : 'Car Shop Coming Soon';
    box.appendChild(sub);

    if (type === 'horizon') {
      const bestTime = localStorage.getItem('bestTime');
      const mins = bestTime ? Math.floor(parseFloat(bestTime) / 60) : 0;
      const secs = bestTime ? Math.floor(parseFloat(bestTime) % 60) : 0;
      const topSpeed = parseFloat(localStorage.getItem('topSpeed') || '0').toFixed(0);
      const driftScore = localStorage.getItem('driftScore') || '0';

      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px;text-align:left';

      const stats = [
        ['BEST TIME', `${mins}:${secs.toString().padStart(2, '0')}`, '#44ff44'],
        ['CARS OWNED', `${CAR_IDS.length}`, '#ffaa00'],
        ['TOP SPEED', `${topSpeed} km/h`, '#ff44ff'],
        ['DRIFT SCORE', `${driftScore}`, '#ff6b35']
      ];
      stats.forEach(([label, value, color]) => {
        const card = document.createElement('div');
        card.className = 'mm-stat';
        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:10px;color:#556;letter-spacing:1px';
        lbl.textContent = label;
        const val = document.createElement('div');
        val.style.cssText = `font-family:Orbitron,monospace;font-size:18px;font-weight:700;color:${color};margin-top:4px`;
        val.textContent = value;
        card.appendChild(lbl);
        card.appendChild(val);
        grid.appendChild(card);
      });
      box.appendChild(grid);
    } else {
      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;gap:10px;text-align:left';
      [
        ['Premium Paint Pack', 'Exclusive colors for your ride', 'CR 500'],
        ['Carbon Decal Set', 'Race-style livery edit', 'CR 350'],
        ['Rim Upgrade', 'Performance wheels pack', 'CR 200']
      ].forEach(([name, desc, price]) => {
        const item = document.createElement('div');
        item.className = 'mm-stat';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        const left = document.createElement('div');
        const n = document.createElement('div');
        n.style.cssText = 'font-size:13px;font-weight:700';
        n.textContent = name;
        const p = document.createElement('div');
        p.style.cssText = 'font-size:11px;color:#556;margin-top:2px';
        p.textContent = desc;
        left.appendChild(n);
        left.appendChild(p);
        const priceEl = document.createElement('div');
        priceEl.style.cssText = 'font-size:12px;color:#ffcc00;font-weight:700';
        priceEl.textContent = price;
        item.appendChild(left);
        item.appendChild(priceEl);
        list.appendChild(item);
      });
      box.appendChild(list);
    }

    const btn = document.createElement('button');
    btn.className = 'mm-overlay-btn';
    btn.textContent = 'CLOSE';
    btn.onclick = () => { if (this.overlay) { this.overlay.remove(); this.overlay = null; } };
    box.appendChild(btn);

    d.appendChild(box);
    document.body.appendChild(d);
    this.overlay = d;

    d.onclick = (e) => { if (e.target === d) { if (this.overlay) { this.overlay.remove(); this.overlay = null; } } };
  }

  exit() {
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
  }
}
