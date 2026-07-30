import { db, ref, set, push, onValue, off, remove, get, child, update } from '../services/FirebaseService.js';

const CAR_IDS = [
  'sedan', 'sedan-sports', 'suv', 'suv-luxury', 'taxi', 'police',
  'ambulance', 'race', 'race-future', 'van', 'truck', 'truck-flat',
  'delivery', 'delivery-flat', 'firetruck', 'garbage-truck', 'tractor',
  'tractor-shovel', 'hatchback-sports'
];

export class RoomScene {
  constructor(manager) {
    this.manager = manager;
    this.overlay = null;
    this.roomsListener = null;
    this.playerId = null;
    this.currentRoomId = null;
  }

  enter() {
    this.renderUI();
    this.loadRooms();
  }

  renderUI() {
    const d = document.createElement('div');
    d.id = 'room-screen';
    d.style.cssText = 'position:fixed;inset:0;display:flex;background:#0a0a1a;z-index:1000;font-family:Arial;color:#fff;flex-direction:column';
    d.innerHTML = `
      <div style="padding:20px;text-align:center">
        <h1 style="font-size:32px;color:#44aaff;margin:0">ONLINE MULTIPLAYER</h1>
        <p style="color:#666;margin:4px 0 16px">Up to 5 drivers per room</p>
        <div style="margin-bottom:16px">
          <input id="room-name-input" type="text" placeholder="Your Name" style="padding:8px 16px;font-size:16px;border-radius:6px;border:none;background:#222;color:#fff;width:200px;text-align:center">
        </div>
        <button id="create-room-btn" style="padding:10px 30px;font-size:18px;background:#44aaff;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-bottom:16px">+ CREATE ROOM</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 20px 20px">
        <h3 style="color:#888;font-size:14px;margin:0 0 8px">AVAILABLE ROOMS</h3>
        <div id="room-list" style="display:flex;flex-direction:column;gap:8px"></div>
        <p id="room-status" style="color:#555;font-size:13px;text-align:center;margin-top:20px">Loading rooms...</p>
      </div>
      <div style="padding:12px;text-align:center;border-top:1px solid #222;display:flex;gap:12px;justify-content:center">
        <button id="room-share-btn" style="padding:8px 24px;font-size:14px;background:#222;color:#44aaff;border:1px solid rgba(68,170,255,0.2);border-radius:6px;cursor:pointer">📤 Share Link</button>
        <button id="room-back-btn" style="padding:8px 24px;font-size:14px;background:#333;color:#aaa;border:none;border-radius:6px;cursor:pointer">← BACK TO MENU</button>
      </div>
    `;
    document.body.appendChild(d);
    this.overlay = d;

    document.getElementById('create-room-btn').onclick = () => this.createRoom();
    document.getElementById('room-back-btn').onclick = () => { this.exit(); this.manager.start('menu'); };
    document.getElementById('room-name-input').onkeydown = (e) => { if (e.key === 'Enter') this.createRoom(); };
    const shareBtn = document.getElementById('room-share-btn');
    if (shareBtn) shareBtn.onclick = () => {
      const url = window.location.href;
      if (navigator.share) { navigator.share({ title: 'Open World Drive', text: 'Race with me!', url }).catch(() => {}); }
      else { navigator.clipboard.writeText(url).then(() => { shareBtn.textContent = '✓ Copied!'; setTimeout(() => shareBtn.textContent = '📤 Share Link', 2000); }).catch(() => {}); }
    };
  }

  loadRooms() {
    const roomsRef = ref(db, 'rooms');
    this.roomsListener = onValue(roomsRef, (snapshot) => {
      const data = snapshot.val();
      this.displayRooms(data);
    });
  }

  displayRooms(data) {
    const list = document.getElementById('room-list');
    const status = document.getElementById('room-status');
    if (!list) return;

    list.innerHTML = '';

    if (!data) {
      status.textContent = 'No rooms yet. Create one!';
      return;
    }

    const entries = Object.entries(data);
    status.textContent = entries.length + ' room(s) found';

    entries.forEach(([roomId, room]) => {
      const players = room.players || {};
      const count = Object.keys(players).length;
      const max = room.maxPlayers || 5;
      const full = count >= max;
      const card = document.createElement('div');
      card.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#151525;border-radius:8px;border:1px solid ${full ? '#442' : '#1a2a3a'}`;
      card.innerHTML = `
        <div>
          <div style="font-weight:bold;color:#ddd">${room.name || 'Room'}</div>
          <div style="font-size:12px;color:#888">${count}/${max} players</div>
        </div>
        <button ${full ? 'disabled' : ''} class="join-btn" data-room="${roomId}" style="padding:6px 20px;font-size:14px;background:${full ? '#333' : '#44aaff'};color:#fff;border:none;border-radius:6px;cursor:${full ? 'not-allowed' : 'pointer'}">
          ${full ? 'FULL' : 'JOIN'}
        </button>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll('.join-btn').forEach(btn => {
      btn.onclick = () => this.joinRoom(btn.dataset.room, data[btn.dataset.room]);
    });
  }

  createRoom() {
    const nameInput = document.getElementById('room-name-input');
    const name = nameInput?.value.trim() || 'Driver';
    if (!name) { nameInput.focus(); return; }
    if (this.currentRoomId) return;

    const roomsRef = ref(db, 'rooms');
    const newRoomRef = push(roomsRef);
    const roomId = newRoomRef.key;

    this.playerId = 'p' + Date.now() + Math.random().toString(36).slice(2, 6);

    set(newRoomRef, {
      name: name + "'s Room",
      maxPlayers: 5,
      createdAt: Date.now(),
      players: {
        [this.playerId]: {
          name: name,
          carIdx: Math.floor(Math.random() * CAR_IDS.length),
          x: 0, z: 0, rot: 0, speed: 0,
          connected: true
        }
      },
      started: false
    });

    this.currentRoomId = roomId;
    this.enterLobby(name);
  }

  joinRoom(roomId, roomData) {
    const nameInput = document.getElementById('room-name-input');
    const name = nameInput?.value.trim() || 'Guest';
    if (!name) { nameInput.focus(); return; }
    if (this.currentRoomId) return;

    const players = roomData.players || {};
    const count = Object.keys(players).length;
    if (count >= (roomData.maxPlayers || 5)) return;

    this.playerId = 'p' + Date.now() + Math.random().toString(36).slice(2, 6);

    const playerRef = ref(db, `rooms/${roomId}/players/${this.playerId}`);
    set(playerRef, {
      name: name,
      carIdx: Math.floor(Math.random() * CAR_IDS.length),
      x: 0, z: 0, rot: 0, speed: 0,
      connected: true
    });

    this.currentRoomId = roomId;
    this.enterLobby(name);
  }

  enterLobby(name) {
    document.getElementById('room-screen').innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px">
        <h2 style="color:#44aaff;margin:0 0 20px">WAITING FOR PLAYERS</h2>
        <div id="lobby-players" style="margin-bottom:20px;color:#aaa;font-size:14px">Loading...</div>
        <button id="start-game-btn" style="padding:14px 50px;font-size:22px;background:#44aaff;color:#fff;border:none;border-radius:10px;cursor:pointer">🚗 START DRIVING</button>
        <p style="color:#666;font-size:12px;margin-top:12px">Others will auto-join when you start</p>
        <button id="leave-room-btn" style="margin-top:20px;padding:8px 24px;font-size:14px;background:#333;color:#aaa;border:none;border-radius:6px;cursor:pointer">← LEAVE ROOM</button>
      </div>
    `;

    document.getElementById('start-game-btn').onclick = () => this.startGame();
    document.getElementById('leave-room-btn').onclick = () => this.leaveRoom();

    const playersRef = ref(db, `rooms/${this.currentRoomId}/players`);
    this.lobbyListener = onValue(playersRef, (snap) => {
      const players = snap.val();
      const el = document.getElementById('lobby-players');
      if (!el) return;
      if (!players) { el.textContent = 'No players'; return; }
      const list = Object.entries(players).map(([id, p]) =>
        `<div style="padding:4px 0">${id === this.playerId ? '⭐ ' : '· '}${p.name || 'Unknown'} ${id === this.playerId ? '(you)' : ''}</div>`
      ).join('');
      el.innerHTML = list;
    });

    const roomRef = ref(db, `rooms/${this.currentRoomId}`);
    this.roomListener = onValue(roomRef, (snap) => {
      const data = snap.val();
      if (!data || data.started) {
        if (data && data.started) {
          off(roomRef);
          this.manager.start('game', { roomId: this.currentRoomId, playerId: this.playerId, players: data.players });
        }
      }
    });
  }

  startGame() {
    if (!this.currentRoomId) return;
    const roomRef = ref(db, `rooms/${this.currentRoomId}`);
    update(roomRef, { started: true });

    const playersRef = ref(db, `rooms/${this.currentRoomId}/players`);
    get(playersRef).then((snap) => {
      const players = snap.val();
      this.cleanup();
      this.manager.start('game', { roomId: this.currentRoomId, playerId: this.playerId, players });
    });
  }

  leaveRoom() {
    if (this.currentRoomId && this.playerId) {
      remove(ref(db, `rooms/${this.currentRoomId}/players/${this.playerId}`));
      get(ref(db, `rooms/${this.currentRoomId}/players`)).then((snap) => {
        if (!snap.exists()) {
          remove(ref(db, `rooms/${this.currentRoomId}`));
        }
      });
    }
    this.cleanup();
    this.exit();
    this.manager.start('menu');
  }

  cleanup() {
    if (this.roomsListener) { off(ref(db, 'rooms'), this.roomsListener); this.roomsListener = null; }
    if (this.lobbyListener) { off(ref(db, `rooms/${this.currentRoomId}/players`), this.lobbyListener); this.lobbyListener = null; }
    if (this.roomListener) { off(ref(db, `rooms/${this.currentRoomId}`), this.roomListener); this.roomListener = null; }
  }

  exit() {
    this.cleanup();
    if (this.currentRoomId && this.playerId) {
      remove(ref(db, `rooms/${this.currentRoomId}/players/${this.playerId}`));
      get(ref(db, `rooms/${this.currentRoomId}/players`)).then((snap) => {
        if (!snap.exists()) remove(ref(db, `rooms/${this.currentRoomId}`));
      });
    }
    const d = document.getElementById('room-screen');
    if (d) d.remove();
    this.currentRoomId = null;
    this.playerId = null;
  }
}
