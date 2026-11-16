const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseWorld, Game } = require('./world.js');
const source = fs.readFileSync(__dirname + '/карта мира.txt', 'utf8');
const world = parseWorld(source);
assert.equal(world.rooms.length, 4);
assert.deepEqual([...world.positions.values()], [{x:0,y:0},{x:0,y:1},{x:-1,y:1},{x:1,y:1}]);
const game = new Game(world);
assert.equal(game.isFirstVisit, true);
assert.deepEqual([...game.visible()], ['Палата № 13', 'Коридор']);
assert.equal(game.move('Процедурная'), false);
assert.equal(game.move('Коридор'), true);
assert.equal(game.visible().size, 4);
assert.equal(game.visited.size, 2);
for (const room of ['Палата № 13', 'Пост медсестры', 'Процедурная']) {
  const first = !game.visited.has(room);
  assert.equal(game.move(room), true);
  assert.equal(game.isFirstVisit, first);
  assert.ok(game.room.description);
  assert.equal(game.move('Коридор'), true);
  assert.equal(game.isFirstVisit, false);
}
assert.equal(game.visited.size, 4);
for (const room of world.rooms) {
  for (const exit of room.exits) {
    const session = new Game(world);
    session.current = room.name;
    assert.equal(session.move(exit.target), true);
  }
}
// Дополнительные разделы не попадают в описание или переходы.
const extended = parseWorld(source.replace('ЛОКАЦИЯ\nКоридор', 'НОВЫЙ РАЗДЕЛ\nБудущие данные.\n\nЛОКАЦИЯ\nКоридор'));
assert.equal(extended.rooms[0].exits.length, 1);
assert.equal(extended.rooms[0].description, world.rooms[0].description);
assert.ok(extended.rooms[0].sections['НОВЫЙ РАЗДЕЛ']);
assert.throws(() => parseWorld(source.replace('юг -> Коридор', 'юг -> Несуществующая')), /Не найдена/);
assert.throws(() => parseWorld(source.replace('восток -> Процедурная', 'восток -> Палата № 13')), /Противоречивые/);
// Произвольные названия и длинный мир: движок не ограничен четырьмя комнатами.
const longWorld = parseWorld(Array.from({length:120}, (_, i) => 'ЛОКАЦИЯ\nЗал ' + i + '\nОПИСАНИЕ\nТихий зал.\nПЕРЕХОДЫ\n' + (i < 119 ? 'восток -> Зал ' + (i+1) + '\n' : '') + (i ? 'запад -> Зал ' + (i-1) + '\n' : '')).join('\n'));
assert.deepEqual(longWorld.positions.get('Зал 119'), {x:119,y:0});
console.log('Проверено: все 6 переходов, первые посещения, открытие карты, координаты, дополнительные разделы, ошибки файла и мир из 120 комнат.');

// Исследование, сюжетный предмет и защита от повторного взятия.
const research = new Game(world);
assert.equal(research.inventory.size, 0);
assert.equal(research.take('пропуск посетителя'), false);
assert.equal(research.inspect('тумбочка'), true);
assert.equal(research.found.size, 1);
assert.equal(research.take('пропуск посетителя'), true);
assert.equal(research.take('пропуск посетителя'), false);
assert.equal(research.inventory.size, 1);
assert.match(research.message.notice, /Взято: пропуск посетителя/);
assert.equal(research.take('сложенная записка'), false);
assert.equal(research.inspect('плотная штора'), true);
assert.equal(research.message.title, 'плотная штора');
assert.ok(!research.message.text.includes('Ящик'));
assert.equal(research.move('Коридор'), true);
assert.equal(research.message, null);
assert.equal(research.inventory.size, 1);
assert.equal(research.found.size, 1);
assert.equal(research.move('Палата № 13'), true);
research.inspect('тумбочка');
assert.equal(research.take('пропуск посетителя'), false);
assert.equal(research.hasItem('Палата № 13', 'пропуск посетителя'), true);
const firstItem = [...research.inventory.values()][0];
assert.equal(research.inspectItem(firstItem.key), true);
assert.equal(research.message.text, world.rooms[0].items.get(firstItem.name));
assert.equal(new Game(world).inventory.size, 0);
// Все предметы во всех комнатах доступны через данные, без специальной логики.
const exploration = new Game(world);
for (const r of world.rooms) {
  exploration.current = r.name;
  for (const [objectName, text] of r.objects) {
    assert.equal(exploration.inspect(objectName), true);
    for (const m of text.matchAll(/\{([^{}]+)\}/g)) exploration.take(m[1].trim());
  }
}
assert.deepEqual([...exploration.inventory.values()].map(item => item.name), ['пропуск посетителя']);
assert.deepEqual(world.rooms.flatMap(room => [...room.items.keys()]).sort(), ['ключ от лестницы', 'пропуск посетителя']);
// Одинаковые названия в разных локациях относятся к разным экземплярам.
const fixture = parseWorld('ЛОКАЦИЯ\nА\nОПИСАНИЕ\n[тайник]\nПЕРЕХОДЫ\nюг -> Б\nОБЪЕКТЫ\n[тайник]\nЗдесь {жетон}.\nПРЕДМЕТЫ\n{жетон}\nМедный.\nЛОКАЦИЯ\nБ\nОПИСАНИЕ\n[тайник]\nПЕРЕХОДЫ\nсевер -> А\nОБЪЕКТЫ\n[тайник]\nТут {жетон}.\nПРЕДМЕТЫ\n{жетон}\nСеребряный.');
const duplicates = new Game(fixture);
duplicates.inspect('тайник'); assert.equal(duplicates.take('жетон'), true);
duplicates.move('Б'); duplicates.inspect('тайник'); assert.equal(duplicates.take('жетон'), true);
assert.deepEqual([...duplicates.inventory.values()].map(i => i.description), ['Медный.', 'Серебряный.']);
assert.throws(() => parseWorld(source.replace('{пропуск посетителя}\nБумажный', '{другой предмет}\nБумажный')), /Нет описания предмета/);
assert.throws(() => parseWorld(source.replace('[зеркало]\nСеребристое', '[другое зеркало]\nСеребристое')), /Нет описания объекта/);
console.log('Этап 2: осмотр, замена сообщения, только сюжетные предметы, сохранение при переходах, запрет повторного взятия, одинаковые названия в разных комнатах и ошибки ссылок — пройдены.');
require('./tests-stage3.cjs');
