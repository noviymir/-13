/* Музыкальные дорожки задаются миром. Плеер не знает названий комнат. */
(function (root) {
  'use strict';
  class MusicPlayer {
    constructor(options = {}) {
      this.createAudio = options.createAudio || (path => new Audio(path));
      // Таймер продолжает завершать переход, даже если вкладка ушла в фон.
      this.requestFrame = options.requestFrame || (callback => setTimeout(() => callback(performance.now()), 40));
      this.cancelFrame = options.cancelFrame || (id => clearTimeout(id));
      this.now = options.now || (() => performance.now());
      this.onChange = options.onChange || (() => {});
      this.volume = .18; this.enabled = false; this.track = null; this.error = '';
      this.current = null; this.retiring = null; this.frame = null; this.revision = 0;
    }
    dispose(record) {
      if (!record) return;
      record.audio.pause(); record.audio.removeAttribute('src'); record.audio.load(); record.audio.remove();
    }
    cancelFade() {
      if (this.frame !== null) this.cancelFrame(this.frame);
      this.frame = null;
    }
    setVolume(value) {
      this.volume = Math.max(0, Math.min(1, Number(value) || 0));
      for (const record of [this.current, this.retiring]) if (record) record.audio.volume = this.volume * record.gain;
      this.onChange();
    }
    setTrack(path) {
      path = path || null;
      if (this.track === path) return;
      this.track = path; this.error = '';
      if (this.enabled && path) this.play();
      else if (!path) this.silence();
      this.onChange();
    }
    toggle() {
      this.error = ''; this.enabled = !this.enabled;
      if (this.enabled && this.track) this.play();
      else this.silence();
      this.onChange();
    }
    fade(incoming, outgoing, duration) {
      this.cancelFade();
      const start = this.now(), previousGain = outgoing ? outgoing.gain : 0;
      const tick = time => {
        const progress = Math.max(0, Math.min(1, (time - start) / duration));
        if (incoming) { incoming.gain = progress; incoming.audio.volume = this.volume * progress; }
        if (outgoing) { outgoing.gain = previousGain * (1 - progress); outgoing.audio.volume = this.volume * outgoing.gain; }
        if (progress < 1) this.frame = this.requestFrame(tick);
        else {
          this.frame = null; this.dispose(outgoing);
          if (this.retiring === outgoing) this.retiring = null;
        }
      };
      this.frame = this.requestFrame(tick);
    }
    silence() {
      this.revision++; this.cancelFade(); this.dispose(this.retiring);
      this.retiring = this.current; this.current = null;
      if (this.retiring) this.fade(null, this.retiring, 500);
    }
    play() {
      const revision = ++this.revision;
      this.cancelFade(); this.dispose(this.retiring); this.retiring = null;
      const previous = this.current;
      const record = { audio: this.createAudio(this.track), gain: 0 };
      record.audio.loop = true; record.audio.preload = 'auto'; record.audio.volume = 0;
      this.current = record; this.retiring = previous;
      const fail = () => {
        if (revision !== this.revision || this.current !== record) return;
        this.enabled = false; this.error = 'Не удалось включить музыку. Попробуйте ещё раз.';
        this.silence(); this.onChange();
      };
      record.audio.addEventListener('error', fail, { once: true });
      // play вызывается прямо из действия игрока, до любых ожиданий.
      try {
        Promise.resolve(record.audio.play()).then(() => {
          if (revision !== this.revision || this.current !== record) return;
          this.fade(record, previous, 1400); this.onChange();
        }).catch(fail);
      } catch { fail(); }
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { MusicPlayer };
  else root.MusicPlayer = MusicPlayer;
})(typeof globalThis !== 'undefined' ? globalThis : this);
