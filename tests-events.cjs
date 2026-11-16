const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseWorld, Game } = require('./world.js');
const source = fs.readFileSync(__dirname + '/карта мира.txt', 'utf8'), world = parseWorld(source);
assert.equal(world.randomEvents.length, 8);
assert.deepEqual(world.rooms.flatMap(room => [...room.items.keys()]).sort(), ['ключ от лестницы', 'пропуск посетителя']);
for (const definition of world.randomEvents) {
  const single = new Game({ ...world, randomEvents: [definition] }, () => 1, () => 0);
  single.current = definition.roomName;
  if (definition.participant) single.characters.find(actor => actor.name === definition.participant).location = definition.roomName;
  const object = single.room.objects.keys().next().value;
  for (let i = 0; i < 3; i++) single.inspect(object);
  assert.equal(single.randomEvent.id, definition.id);
  assert.equal(single.randomEvent.text, definition.text);
  assert.equal(single.seenRandomEvents.size, 1);
}
const event = new Game(world, () => 1, () => 0); // персонажи стоят, события проверяем воспроизводимо
event.inspect('плотная штора'); event.inspect('плотная штора');
assert.equal(event.randomEvent, null); assert.equal(event.seenRandomEvents.size, 0);
event.inspect('плотная штора');
assert.equal(event.randomEvent.name, 'Дежурная лампа');
assert.equal(event.message.title, 'плотная штора'); // событие не заменяет описание объекта
assert.equal(event.message.type, 'object'); assert.equal(event.seenRandomEvents.size, 1);
for (let i = 0; i < 3; i++) { event.inspect('плотная штора'); assert.equal(event.randomEvent, null); }
event.inspect('плотная штора');
assert.equal(event.randomEvent.name, 'Забытый пропуск');
assert.equal(event.lastRandomEventTurn, 7); assert.equal(event.seenRandomEvents.size, 2);
assert.equal(event.inventory.size, 0); // предмет оставлен в мире, а не выдан автоматически
assert.equal(event.message.title, 'плотная штора');
event.inspect('тумбочка'); assert.match(event.message.text, /оставленный Верой/);
assert.equal(event.take('пропуск посетителя'), true);
assert.equal(event.take('пропуск посетителя'), false);
event.move('Коридор'); event.move('Палата № 13'); event.inspect('тумбочка');
assert.match(event.message.text, /оставленный Верой/);
assert.equal(event.take('пропуск посетителя'), false); assert.equal(event.inventory.size, 1);
for (let i = 0; i < 10; i++) event.inspect('плотная штора');
assert.equal(event.randomEvent, null); assert.equal(event.seenRandomEvents.size, 2);

// При уже взятом пропуске соответствующее событие не происходит.
const owned = new Game(world, () => 1, () => 0);
owned.inspect('тумбочка'); owned.take('пропуск посетителя');
for (let i = 0; i < 15; i++) owned.inspect('плотная штора');
assert.equal(owned.seenRandomEvents.size, 1);
assert.equal(owned.objectChanges.size, 0);
// Персонаж действительно должен присутствовать в комнате события.
const absent = new Game(world, () => 1, () => 0);
absent.characters.find(actor => actor.name === 'Вера').location = 'Коридор';
for (let i = 0; i < 15; i++) absent.inspect('плотная штора');
assert.equal(absent.seenRandomEvents.size, 1); assert.equal(absent.objectChanges.size, 0);

// Изменение комнаты и объекта переживает переход. Исходный мир остаётся неизменным.
const lampWorld = { ...world, randomEvents: world.randomEvents.filter(e => e.name === 'Лампа над столом') };
const changed = new Game(lampWorld, () => 1, () => 0);
changed.move('Коридор'); changed.move('Пост медсестры'); changed.inspect('письменный стол');
assert.equal(changed.randomEvent.name, 'Лампа над столом');
assert.equal(changed.message.secret, 'Памятка о свободной палате.');
assert.match(changed.message.text, /Под ярким кругом лампы/);
assert.match(changed.description, /Лампа над письменным столом горит ярче/);
assert.ok(!world.byName.get('Пост медсестры').description.includes('Лампа над письменным столом горит ярче'));
changed.move('Коридор'); changed.move('Пост медсестры'); changed.inspect('письменный стол');
assert.match(changed.message.text, /Под ярким кругом лампы/);
assert.match(changed.description, /Лампа над письменным столом горит ярче/);
assert.equal(changed.secretsFound.size, 1);
// Новая игра восстанавливает исходные описания и события.
const reset = new Game(world);
for (const key of ['seenRandomEvents', 'objectChanges', 'roomChanges']) assert.equal(reset[key].size, 0);
assert.equal(reset.randomEvent, null); assert.equal(reset.turn, 0);

// Ни осмотр инвентаря, ни промежуточные реплики не создают дополнительные такты.
const talking = new Game(world, () => 1, () => 0);
talking.startDialogue('Вера'); talking.nextDialogue();
assert.equal(talking.turn, 0); assert.equal(talking.randomEvent, null);
talking.nextDialogue(); assert.equal(talking.turn, 1);

// При любых выпавших событиях сюжетная цепочка по-прежнему завершается.
for (let seed = 1; seed <= 12; seed++) {
  let state = seed;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const game = new Game(world, random, random);
  game.inspect('тумбочка'); game.take('пропуск посетителя');
  game.move('Коридор'); game.move('Пост медсестры'); game.inspect('служебный шкаф');
  assert.equal(game.use(game.availableRules()[0].id), true);
  assert.equal(game.take('ключ от лестницы'), true);
  game.move('Коридор'); game.inspect('дверь на лестницу');
  assert.equal(game.use(game.availableRules()[0].id), true);
  assert.equal(game.performAction(game.availableActions()[0].id), true);
  assert.equal(game.ended, true); assert.equal(game.inventory.size, 2);
  const used = game.seenRandomEvents.size;
  game.rollRandomEvent(); assert.equal(game.seenRandomEvents.size, used);
}
assert.throws(() => parseWorld(source.replace('УЧАСТНИК\nВера', 'УЧАСТНИК\nНеизвестный')), /Неизвестный участник/);
assert.throws(() => parseWorld(source.replace('МЕСТО\nПалата № 13', 'МЕСТО\nНесуществующая комната')), /существующее МЕСТО/);
assert.throws(() => parseWorld(source.replace('ОБЪЕКТ\n[тумбочка]', 'ОБЪЕКТ\n[несуществующий]')), /Событию нужны/);
assert.throws(() => parseWorld(source.replace('ЕСЛИ НЕТ ПРЕДМЕТА\nпропуск посетителя', 'ЕСЛИ НЕТ ПРЕДМЕТА\nнеизвестный предмет')), /Неизвестный предмет/);
console.log('События: 8 сценариев, паузы и однократность, присутствие NPC, пропуск без дубликатов, постоянные изменения, сброс и 12 полных прохождений — пройдены.');
