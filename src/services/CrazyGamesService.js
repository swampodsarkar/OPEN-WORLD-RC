export class CrazyGamesService {
  constructor() {
    this.ready = false;
    this.environment = null;
  }

  async init() {
    try {
      if (!window.CrazyGames || !window.CrazyGames.SDK) return;
      await window.CrazyGames.SDK.init();
      this.ready = true;
      this.environment = window.CrazyGames.SDK.environment;
    } catch (e) {
      this.ready = false;
    }
  }

  _call(name, ...args) {
    if (!this.ready) return Promise.resolve();
    try {
      const fn = window.CrazyGames.SDK[name];
      return fn ? fn(...args) : Promise.resolve();
    } catch (e) {
      return Promise.resolve();
    }
  }

  loadingStart() { return this._call('loadingStart'); }
  loadingStop() { return this._call('loadingStop'); }
  gameplayStart() { return this._call('gameplayStart'); }
  gameplayStop() { return this._call('gameplayStop'); }
  happyTime() { return this._call('happyTime'); }
  midgameAd() { return this._call('midgameAd'); }
  rewardedAd() { return this._call('rewardedAd'); }

  bannerAd() {
    if (!this.ready) return;
    try {
      const b = window.CrazyGames.SDK.banner;
      if (b && b.requestBanner) b.requestBanner();
    } catch (e) {}
  }

  fullscreen() {
    if (!this.ready) return Promise.resolve(false);
    try {
      return window.CrazyGames.SDK.fullscreen.requestFullscreen();
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  getUser() {
    if (!this.ready) return Promise.resolve(null);
    try {
      return window.CrazyGames.SDK.user.getUser();
    } catch (e) {
      return Promise.resolve(null);
    }
  }
}
