const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { load } = require('./load-world.js');
const { parseWorld, Game } = require('./world.js');
(async () => {
  const text = fs.readFileSync(path.join(__dirname, 'карта мира.txt'), 'utf8').replace(/\r\n?/g, '\n');
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'world-data.js'), 'utf8'), context);
  assert.equal(context.PALATA_WORLD_TEXT, text, 'После изменения TXT выполните node build-world.cjs');
  const localText = await load('file:', context.PALATA_WORLD_TEXT, () => { throw new Error('При запуске с диска fetch не нужен'); });
  const localGame = new Game(parseWorld(localText));
  assert.equal(localGame.current, 'Палата № 13');
  assert.equal(localGame.visited.size, 1);
  let requests = 0;
  const hosted = await load('https:', 'устаревшая копия', async (url, options) => {
    requests++;
    assert.equal(decodeURIComponent(url), './карта мира.txt');
    assert.equal(options.cache, 'no-store');
    return { ok: true, text: async () => text };
  });
  assert.equal(requests, 1); assert.equal(hosted, text);
  await assert.rejects(load('file:', undefined), /данные истории/);
  await assert.rejects(load('https:', text, async () => ({ ok: false, status: 404 })), /HTTP 404/);
  assert.ok(!fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').includes('type="file"'));
  console.log('Автозапуск: копия совпадает с TXT, запуск с диска без fetch и выбора файла, чтение TXT на сайте и обработка ошибок — пройдены.');
})().catch(error => { console.error(error); process.exitCode = 1; });
