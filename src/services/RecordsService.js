let _fb = null;
const fb = () => (_fb ||= import('./FirebaseService.js'));

const LS = { bestSpeed: 'nitroBestSpeed', bestDrift: 'nitroBestDrift' };
const TOP = 5;

function loadLocal(key) {
  try {
    const raw = localStorage.getItem(LS[key]);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function saveLocal(key, list) {
  try { localStorage.setItem(LS[key], JSON.stringify(list)); } catch (e) {}
}

export const RecordsService = {
  async submit(key, value, name) {
    if (typeof value !== 'number' || value <= 0) return;
    const rec = { name: (name || 'Driver').slice(0, 12), value: Math.round(value), ts: Date.now() };
    try {
      const { db, ref, runTransaction } = await fb();
      const node = ref(db, `records/${key}`);
      const outcome = await runTransaction(node, (current) => {
        const list = Array.isArray(current) ? current.slice() : [];
        list.push(rec);
        list.sort((a, b) => (b.value || 0) - (a.value || 0));
        const top = list.slice(0, TOP);
        const saved = JSON.stringify(top) === JSON.stringify(current);
        return saved ? current : top;
      });
      const saved = outcome && outcome.snapshot ? outcome.snapshot.val() : null;
      if (Array.isArray(saved)) saveLocal(key, saved);
    } catch (e) {
      const list = loadLocal(key);
      list.push(rec);
      list.sort((a, b) => (b.value || 0) - (a.value || 0));
      saveLocal(key, list.slice(0, TOP));
    }
  },

  snapshot() {
    return { bestSpeed: loadLocal('bestSpeed'), bestDrift: loadLocal('bestDrift') };
  },

  async subscribe(cb) {
    let unsubs = [];
    const fireLocal = () => {
      cb('bestSpeed', loadLocal('bestSpeed'));
      cb('bestDrift', loadLocal('bestDrift'));
    };
    fireLocal();
    try {
      const { db, ref, onValue } = await fb();
      ['bestSpeed', 'bestDrift'].forEach((key) => {
        const un = onValue(ref(db, `records/${key}`), (snap) => {
          const val = snap.val();
          cb(key, Array.isArray(val) ? val : loadLocal(key));
        });
        unsubs.push(un);
      });
    } catch (e) {}
    return () => { unsubs.forEach(un => { try { un(); } catch (e) {} }); unsubs = []; };
  }
};
