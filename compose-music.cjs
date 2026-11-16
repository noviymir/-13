// Оригинальная процедурная музыка для игры. Повторное создание: node compose-music.cjs
// Не использует внешние записи, библиотеки, интернет или API.
const fs = require('node:fs');
const path = require('node:path');
const rate = 22050, duration = 32, count = rate * duration;
const themes = [
  { name: 'Палата № 13', chords: [[50,57,60,64],[46,53,57,62],[43,50,57,62],[45,52,57,62]], melody: [76,69,72,64,74,69,67,69], tone: .14, air: .012, seed: 13 },
  { name: 'Коридор', chords: [[38,45,50,57],[38,46,53,57],[43,50,57,62],[45,52,55,62]], melody: [62,0,69,0,65,0,64,0], tone: .07, air: .035, seed: 27 },
  { name: 'Пост медсестры', chords: [[48,55,59,64],[45,52,55,60],[41,48,55,60],[43,50,55,62]], melody: [72,76,71,67,69,72,67,62], tone: .17, air: .008, seed: 41 },
  { name: 'Процедурная', chords: [[50,57,64,69],[46,53,60,65],[43,50,57,64],[45,52,59,64]], melody: [81,0,76,0,77,0,74,76], tone: .10, air: .018, seed: 59 }
];
const frequency = midi => 440 * Math.pow(2, (midi - 69) / 12);
function render(theme) {
  const dry = new Float64Array(count);
  const events = [];
  theme.chords.forEach((chord, index) => chord.forEach((note, voice) => events.push({
    start: index * 8, length: 11, note, kind: 'pad', amp: (voice === 0 ? .105 : .065)
  })));
  theme.melody.forEach((note, index) => {
    if (note) events.push({ start: index * 4 + 1, length: 6, note, kind: 'key', amp: theme.tone });
  });
  for (const event of events) {
    const length = Math.round(event.length * rate), start = Math.round(event.start * rate), hz = frequency(event.note);
    for (let sample = 0; sample < length; sample++) {
      const t = sample / rate, phase = 2 * Math.PI * hz * t;
      const attack = 1 - Math.exp(-t * (event.kind === 'pad' ? 1.3 : 12));
      const release = Math.pow(Math.sin(Math.PI * sample / length), 2);
      const decay = event.kind === 'pad' ? 1 : Math.exp(-t * .75);
      const wave = Math.sin(phase) + .14 * Math.sin(phase * 2 + .12) + .035 * Math.sin(phase * 3);
      dry[(start + sample) % count] += wave * event.amp * attack * release * decay;
    }
  }
  let seed = theme.seed, filtered = 0;
  for (let i = 0; i < count; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    filtered += .06 * ((seed / 2147483648 - 1) - filtered);
    const edge = Math.min(1, i / 2205, (count - 1 - i) / 2205);
    dry[i] += filtered * theme.air * edge;
  }
  const mixed = new Float64Array(count);
  const delayA = Math.round(.375 * rate), delayB = Math.round(.875 * rate);
  let peak = 0;
  for (let i = 0; i < count; i++) {
    // Кольцевое эхо сохраняет непрерывность при повторе петли.
    mixed[i] = dry[i] + .22 * dry[(i - delayA + count) % count] + .12 * dry[(i - delayB + count) % count];
    peak = Math.max(peak, Math.abs(mixed[i]));
  }
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) wav.writeInt16LE(Math.round(mixed[i] / Math.max(peak, .01) * .55 * 32767), 44 + i * 2);
  return wav;
}
fs.mkdirSync(path.join(__dirname, 'media'), { recursive: true });
for (const theme of themes) {
  const target = path.join(__dirname, 'media', theme.name + '.wav');
  fs.writeFileSync(target, render(theme));
  console.log(theme.name + '.wav — 32 секунды, зацикленный оригинальный фон');
}
