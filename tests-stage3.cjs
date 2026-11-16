const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parseWorld, Game } = require('./world.js');
const source = fs.readFileSync(__dirname + '/карта мира.txt', 'utf8');
const world = parseWorld(source);
assert.equal(world.characters.length, 4);
assert.equal(world.rules.length, 2);
assert.equal(world.characterByName.get('Нина').dialogs.size, 3);
assert.equal(world.characterByName.get('Смотритель').dialogs.size, 3);
assert.equal(world.characterByName.get('Вера').dialogs.size, 2);
assert.equal(world.characterByName.get('Илья').dialogs.size, 2);

// Полное прохождение: предмет появляется только после применения, состояния не теряются.
const game = new Game(world, () => 1);
const door = world.rules.find(r => r.object === 'дверь на лестницу');
const cabinet = world.rules.find(r => r.object === 'служебный шкаф');
assert.equal(game.performAction(door.id), false);
game.move('Коридор'); game.move('Пост медсестры'); game.inspect('служебный шкаф');
assert.equal(game.availableRules().length, 0);
assert.equal(game.use(cabinet.id), false);
assert.equal(game.take('ключ от лестницы'), false);
game.move('Коридор'); game.move('Палата № 13'); game.inspect('тумбочка'); game.take('пропуск посетителя');
game.move('Коридор'); game.move('Пост медсестры'); game.inspect('служебный шкаф');
assert.deepEqual(game.availableRules().map(r => r.id), [cabinet.id]);
const beforeUse = game.turn;
assert.equal(game.use(cabinet.id), true);
assert.equal(game.turn, beforeUse + 1);
assert.match(game.message.text, /\{ключ от лестницы\}/);
assert.equal(game.use(cabinet.id), false);
game.move('Коридор'); game.move('Пост медсестры'); game.inspect('служебный шкаф');
assert.equal(game.availableRules().length, 0);
assert.equal(game.take('ключ от лестницы'), true);
assert.equal(game.take('ключ от лестницы'), false);
assert.equal(game.owns('пропуск посетителя'), true); // предметы не расходуются
game.move('Коридор'); game.inspect('дверь на лестницу');
assert.equal(game.use(door.id), true);
assert.equal(game.ended, false); // открыть дверь ещё не значит выйти
game.move('Палата № 13'); game.move('Коридор'); game.inspect('дверь на лестницу');
assert.match(game.message.text, /Дверь открыта/);
assert.equal(game.availableActions()[0].action, 'Выйти на лестницу');
assert.equal(game.performAction(door.id), true);
assert.equal(game.ended, true);
assert.equal(game.move('Палата № 13'), false);
assert.equal(game.inspect('табличка отделения'), false);
assert.equal(game.use(door.id), false);
assert.equal(game.startDialogue('Нина'), false);
assert.equal(game.inspectItem([...game.inventory.keys()][0]), false);
const reset = new Game(world, () => 1);
assert.equal(reset.current, world.start);
assert.deepEqual([...reset.visited], [world.start]);
for (const key of ['inventory', 'found', 'usedLinks', 'completedActions', 'secretsFound', 'seenRandomEvents', 'objectChanges', 'roomChanges']) assert.equal(reset[key].size, 0);
assert.equal(reset.turn, 0); assert.equal(reset.ended, false);
assert.equal(reset.message, null); assert.equal(reset.dialogue, null);
assert.equal(reset.selectedCharacter, null); assert.deepEqual(reset.events, []);
assert.deepEqual(reset.characters.map(c => [c.location, c.ticks]), world.characters.map(c => [c.route[0], 0]));
reset.inspect('тумбочка'); assert.equal(reset.take('пропуск посетителя'), true);

// Все реплики остаются в одной беседе. Такт начисляется ровно на последней.
const talk = new Game(world, () => 1);
talk.move('Коридор'); talk.move('Пост медсестры');
assert.equal(talk.presentCharacters().length, 2);
assert.equal(talk.selectCharacter('Нина'), true);
const beforeTalk = talk.turn;
assert.equal(talk.startDialogue('Нина'), true);
assert.equal(talk.dialogue.count, 1); assert.equal(talk.turn, beforeTalk);
talk.nextDialogue(); assert.equal(talk.dialogue.count, 2); assert.equal(talk.turn, beforeTalk);
talk.nextDialogue(); assert.equal(talk.dialogue.count, 3); assert.equal(talk.dialogue.complete, true);
assert.equal(talk.turn, beforeTalk + 1);
assert.equal(talk.nextDialogue(), false); assert.equal(talk.turn, beforeTalk + 1);
assert.equal(talk.startDialogue('Нина'), true); assert.equal(talk.dialogue.count, 1);
assert.equal(talk.turn, beforeTalk + 1);

// Два обязательных такта, соседство, сброс возраста, направления и отсутствие удалённых событий.
const walk = new Game(world, () => 0);
walk.inspect('плотная штора'); walk.inspect('плотная штора');
assert.ok(walk.characters.every(c => c.ticks === 2 && c.location === world.characterByName.get(c.name).route[0]));
walk.move('Коридор');
assert.ok(walk.characters.every(c => c.ticks === 0 && c.location === 'Коридор'));
assert.ok(walk.events.includes('Вы вышли из палаты № 13 и попали в коридор.'));
assert.ok(walk.events.includes('Нина пришла слева.'));
assert.ok(walk.events.includes('Смотритель пришёл слева.'));
walk.inspect('табличка отделения'); walk.inspect('табличка отделения');
assert.ok(walk.characters.every(c => c.location === 'Коридор' && c.ticks === 2));
walk.inspect('табличка отделения');
assert.ok(walk.events.includes('Нина ушла влево.'));
assert.ok(walk.events.includes('Смотритель ушёл вперёд.'));
assert.ok(walk.events.length <= world.characters.length);
const unseen = new Game(world, () => 0);
for (let i = 0; i < 3; i++) unseen.inspect('плотная штора');
assert.deepEqual(unseen.events, ['Вера ушла назад.']); // остальные движутся за пределами видимости
for (let i = 0; i < 30; i++) {
  const previous = unseen.characters.map(c => ({ ...c }));
  unseen.inspect('плотная штора');
  unseen.characters.forEach((c, j) => {
    assert.ok(world.characterByName.get(c.name).route.includes(c.location));
    if (c.location !== previous[j].location) {
      assert.ok(previous[j].ticks >= 2);
      assert.ok(world.byName.get(previous[j].location).exits.some(e => e.target === c.location));
      assert.equal(c.ticks, 0);
    }
  });
}

// Независимый мир с другими именами, несколькими связями и однострочной беседой.
const fixture = 'ЛОКАЦИЯ\nЗал\nОПИСАНИЕ\n[ниша] и [панель].\nПЕРЕХОДЫ\nвосток -> Двор\nОБЪЕКТЫ\n[ниша]\nЗдесь {лента} и {диск}.\n[панель]\nТёмная панель.\nПРЕДМЕТЫ\n{лента}\nКрасная.\n{диск}\nКруглый.\n{жетон}\nСветлый.\nСВЯЗАННЫЕ ОБЪЕКТЫ\n{лента} -> [панель]\nРЕЗУЛЬТАТ\nПоявился {жетон}.\n{диск} -> [панель]\nРЕЗУЛЬТАТ\nЭкран ожил.\nДЕЙСТВИЕ\nЗавершить путь\nЛОКАЦИЯ\nДвор\nОПИСАНИЕ\nНебо.\nПЕРЕХОДЫ\nзапад -> Зал\nПЕРСОНАЖ\nГость\nОПИСАНИЕ\nСилуэт.\nМАРШРУТ\nЗал, Двор\nДИАЛОГ\nЗал\nГость: Добрый вечер.\nКОНЕЦ ИГРЫ\nУСЛОВИЕ\nДЕЙСТВИЕ: Завершить путь\nТЕКСТ\nПуть окончен.\nКНОПКА\nПовторить';
const other = parseWorld(fixture), generic = new Game(other, () => 1);
generic.startDialogue('Гость'); assert.equal(generic.turn, 1); assert.equal(generic.dialogue.complete, true);
generic.inspect('ниша'); generic.take('лента'); generic.take('диск'); generic.inspect('панель');
assert.equal(generic.availableRules().length, 2);
generic.use(other.rules[0].id); generic.use(other.rules[1].id);
assert.equal(generic.take('жетон'), true); // результат первой связи не теряется после второй
assert.equal(generic.performAction(other.rules[1].id), true); assert.equal(generic.ended, true);
const neutral = new Game(other, () => 0);
neutral.inspect('ниша'); neutral.inspect('ниша'); neutral.inspect('ниша');
assert.deepEqual(neutral.events, ['Гость: выход вправо.']);

// Глобальные связи после персонажей, иные явные условия финала, ошибки данных.
const globalSource = fixture.replace('СВЯЗАННЫЕ ОБЪЕКТЫ\n{лента} -> [панель]\nРЕЗУЛЬТАТ\nПоявился {жетон}.\n{диск} -> [панель]\nРЕЗУЛЬТАТ\nЭкран ожил.\nДЕЙСТВИЕ\nЗавершить путь\n', '');
const globalRules = globalSource.replace('КОНЕЦ ИГРЫ', 'СВЯЗАННЫЕ ОБЪЕКТЫ\n{лента} -> [панель]\nРЕЗУЛЬТАТ\nПоявился {жетон}.\nДЕЙСТВИЕ\nЗавершить путь\nКОНЕЦ ИГРЫ');
assert.equal(parseWorld(globalRules).rules.length, 1);
for (const condition of ['В ИНВЕНТАРЕ: {лента}', 'ПРИМЕНЕНО: {лента} -> [панель]', 'ЛОКАЦИЯ: Двор', 'Выполнено действие «Завершить путь».']) {
  assert.ok(parseWorld(fixture.replace('ДЕЙСТВИЕ: Завершить путь', condition)).ending.condition);
}
assert.throws(() => parseWorld(fixture.replace('Зал, Двор', 'Зал, Лес')), /маршрута/);
assert.throws(() => parseWorld(fixture.replace('ДЕЙСТВИЕ: Завершить путь', 'Когда-нибудь')), /явное условие/);
assert.throws(() => parseWorld(fixture.replace('Появился {жетон}.', 'Появился {несуществующий}.')), /Нет описания предмета/);

// Проверяем частоту перемещений среди разрешённых ходов на воспроизводимой выборке.
let seed = 123456789;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const probability = new Game(other, random);
let eligible = 0, moves = 0;
for (let i = 0; i < 10000; i++) {
  const actor = probability.characters[0], old = actor.location;
  if (actor.ticks >= 2) eligible++;
  probability.inspect('ниша');
  if (actor.location !== old) moves++;
}
assert.ok(moves / eligible > 0.30 && moves / eligible < 0.40);
console.log('Этап 3: полное прохождение и сброс, 10 диалогов, такты/соседство/направления, вероятность ' + Math.round(100 * moves / eligible) + '%, несколько связей, новые предметы и проверки TXT — пройдены.');
