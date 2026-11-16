const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseWorld } = require('./world.js');
const { MusicPlayer } = require('./music.js');
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const world = parseWorld(fs.readFileSync(path.join(__dirname, 'карта мира.txt'), 'utf8'));
  const hashes = new Set();
  for (const room of world.rooms) {
    assert.ok(room.music);
    const bytes = fs.readFileSync(path.join(__dirname, room.music));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(bytes.readUInt32LE(40), bytes.length - 44);
    const rate = bytes.readUInt32LE(24);
    assert.equal((bytes.length - 44) / 2 / rate, 32);
    let peak = 0, squareSum = 0, maxStep = 0;
    for (let i = 44; i < bytes.length; i += 2) {
      const sample = bytes.readInt16LE(i) / 32768;
      peak = Math.max(peak, Math.abs(sample)); squareSum += sample * sample;
      if (i > 44) maxStep = Math.max(maxStep, Math.abs(bytes.readInt16LE(i) - bytes.readInt16LE(i - 2)));
    }
    assert.ok(peak > .4 && peak < .7); // не тишина и не клиппинг
    assert.ok(Math.sqrt(squareSum / ((bytes.length - 44) / 2)) > .03);
    assert.ok(Math.abs(bytes.readInt16LE(44) - bytes.readInt16LE(bytes.length - 2)) <= maxStep);
    hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(hashes.size, 4);
  let now = 0, nextId = 0;
  const frames = new Map(), created = [];
  const player = new MusicPlayer({
    now: () => now,
    requestFrame: callback => { frames.set(++nextId, callback); return nextId; },
    cancelFrame: id => frames.delete(id),
    createAudio(src) {
      const audio = { src, volume: 1, paused: true, removed: false,
        play() { this.paused = false; return src === 'bad' ? Promise.reject(new Error('missing')) : Promise.resolve(); },
        pause() { this.paused = true; }, removeAttribute() {}, load() {},
        remove() { this.removed = true; }, addEventListener() {} };
      created.push(audio); return audio;
    }
  });
  const step = time => {
    now = time; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time));
  };
  player.setTrack('a'); assert.equal(created.length, 0); // до согласия нет ни загрузки, ни звука
  player.toggle(); await flush(); step(1400);
  assert.equal(player.enabled, true); assert.equal(player.current.audio.loop, true);
  assert.equal(player.current.audio.volume, .18);
  player.setVolume(.3); assert.equal(player.current.audio.volume, .3);
  player.setTrack('b'); await flush(); step(2100);
  assert.equal(player.current.audio.volume, .15); assert.equal(player.retiring.audio.volume, .15);
  player.setTrack('c'); await flush(); step(3500);
  assert.equal(player.current.audio.src, 'c'); assert.equal(player.current.audio.volume, .3);
  assert.equal(created.filter(audio => !audio.removed).length, 1);
  player.setTrack('c'); assert.equal(created.length, 3); // осмотр/диалог не перезапускают трек
  player.toggle(); step(4000); assert.equal(player.enabled, false);
  assert.ok(created.every(audio => audio.paused && audio.removed));
  player.toggle(); await flush(); step(5400);
  player.setTrack(null); step(5900); assert.equal(player.current, null); // затихание в финале
  player.setTrack('bad'); await flush(); step(6400);
  assert.equal(player.enabled, false); assert.ok(player.error);
  assert.ok(created.every(audio => audio.removed));
  console.log('Музыка: четыре разные WAV-петли без клиппинга/скачка на стыке, явное включение, плавная смена, быстрые переходы, громкость, выключение, финал и ошибки — пройдены.');
})().catch(error => { console.error(error); process.exitCode = 1; });
