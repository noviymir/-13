const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseWorld, Game } = require('./world.js');
const source = fs.readFileSync(__dirname + '/карта мира.txt', 'utf8');
const world = parseWorld(source), game = new Game(world, () => 0);
assert.equal(game.mapDetails('Палата № 13').icon, 'кровать');
assert.equal(game.mapDetails('Пост медсестры'), null); // не выдаёт местоположение NPC до посещения
assert.equal(game.mapDetails('Коридор'), null);
game.move('Коридор');
assert.deepEqual(game.mapDetails('Коридор').locked, ['Выход на лестницу']);
assert.equal(game.mapDetails('Пост медсестры'), null);
game.move('Пост медсестры');
assert.equal(game.mapDetails('Пост медсестры').characters.length, 2);
assert.deepEqual(game.mapDetails('Пост медсестры').locked, ['Служебный шкаф']);
game.inspect('Настенные часы'); // третий такт: персонажи из разных частей карты сходятся в коридоре
assert.deepEqual(game.mapDetails('Пост медсестры').characters, []);
assert.equal(game.mapDetails('Коридор').characters.length, world.characters.length);
// Собираем пропуск, открываем шкаф и дверь; маркеры следуют состояниям объектов.
game.move('Коридор'); game.move('Палата № 13'); game.inspect('тумбочка'); game.take('пропуск посетителя');
game.move('Коридор'); game.move('Пост медсестры'); game.inspect('служебный шкаф'); game.use(game.availableRules()[0].id);
assert.deepEqual(game.mapDetails('Пост медсестры').locked, []);
assert.deepEqual(game.mapDetails('Пост медсестры').opened, ['Служебный шкаф']);
game.take('ключ от лестницы'); game.move('Коридор'); game.inspect('дверь на лестницу'); game.use(game.availableRules()[0].id);
assert.deepEqual(game.mapDetails('Коридор').locked, []);
assert.deepEqual(game.mapDetails('Коридор').opened, ['Выход на лестницу']);
assert.equal(game.current, 'Коридор'); assert.equal(game.ended, false);
assert.equal(game.mapDetails('Процедурная'), null);
const reset = new Game(world);
assert.equal(reset.mapDetails('Коридор'), null);
assert.equal(world.rooms.length, 4); // выход остаётся объектом, пятой локации нет
const generic = parseWorld('ЛОКАЦИЯ\nЗал\nОПИСАНИЕ\nПусто.');
assert.deepEqual(new Game(generic).mapDetails('Зал'), { icon: 'комната', characters: [], locked: [], opened: [] });
assert.throws(() => parseWorld(source.replace('[служебный шкаф]\nСлужебный шкаф', '[неизвестный шкаф]\nСлужебный шкаф')), /Значок замка/);
console.log('Карта: типы комнат, скрытые сведения, несколько NPC и их перемещение, закрытые/открытые объекты, сброс и произвольные названия — пройдены.');
