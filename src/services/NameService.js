const KEY = 'nitroPlayerName';

export const NameService = {
  get() {
    try { return (localStorage.getItem(KEY) || '').trim(); } catch (e) { return ''; }
  },
  set(name) {
    try { localStorage.setItem(KEY, (name || '').trim()); } catch (e) {}
  },
  display() {
    return NameService.get() || 'Driver';
  }
};
