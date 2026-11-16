/* Данные и правила игры отделены от браузерного интерфейса. */
(function (root) {
  'use strict';
  const directions = {
    север: { x: 0, y: -1, from: 'сзади' }, юг: { x: 0, y: 1, from: 'спереди' },
    запад: { x: -1, y: 0, from: 'справа' }, восток: { x: 1, y: 0, from: 'слева' }
  };
  const destination = { север: 'вперёд', юг: 'назад', запад: 'влево', восток: 'вправо' };
  const itemKey = (roomName, name) => JSON.stringify([roomName, name]);
  const textOf = (entity, section) => (entity.sections[section] || []).join('\n').trim();
  const itemNames = text => [...text.matchAll(/\{([^{}]+)\}/g)].map(m => m[1].trim());

  function parseEntries(lines, kind, roomName) {
    const entries = new Map();
    const pattern = kind === 'object' ? /^\[([^\[\]]+)\]$/ : /^\{([^{}]+)\}$/;
    let name = null, body = [];
    function finish() {
      if (name === null) return;
      if (!name || entries.has(name)) throw new Error('Пустая или повторная запись «' + name + '»: ' + roomName);
      const description = body.join('\n').trim();
      if (!description) throw new Error('Нет описания записи «' + name + '»: ' + roomName);
      entries.set(name, description);
    }
    for (const line of lines || []) {
      const match = line.trim().match(pattern);
      if (match) { finish(); name = match[1].trim(); body = []; }
      else if (name !== null) body.push(line);
      else if (line.trim()) throw new Error('Ожидалось название в скобках: ' + roomName);
    }
    finish(); return entries;
  }

  function parseCondition(text) {
    let match = text.match(/^ДЕЙСТВИЕ:\s*(.+)$/u) || text.match(/^Выполнено действие «(.+)»\.?$/u);
    if (match) return { type: 'action', name: match[1].trim() };
    match = text.match(/^ПРИМЕНЕНО:\s*\{([^{}]+)\}\s*->\s*\[([^\[\]]+)\]$/u);
    if (match) return { type: 'use', item: match[1].trim(), object: match[2].trim() };
    match = text.match(/^В ИНВЕНТАРЕ:\s*\{([^{}]+)\}$/u);
    if (match) return { type: 'item', name: match[1].trim() };
    match = text.match(/^ЛОКАЦИЯ:\s*(.+)$/u);
    if (match) return { type: 'room', name: match[1].trim() };
    throw new Error('Укажите явное условие финала, например «ДЕЙСТВИЕ: Выйти наружу».');
  }

  function parseWorld(text) {
    const rooms = [], characters = [], rawRules = [], rawEvents = [];
    let entity = null, section = null, linkMode = false, link = null, ending = null;
    for (const original of text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n')) {
      const line = original.trim();
      if (line === 'ЛОКАЦИЯ' || line === 'ПЕРСОНАЖ' || line === 'СОБЫТИЕ') {
        entity = { kind: line === 'ЛОКАЦИЯ' ? 'room' : line === 'ПЕРСОНАЖ' ? 'character' : 'event', name: '', sections: Object.create(null), rawDialogs: [] };
        (entity.kind === 'room' ? rooms : entity.kind === 'character' ? characters : rawEvents).push(entity);
        section = null; linkMode = false; link = null; continue;
      }
      if (line === 'КОНЕЦ ИГРЫ') {
        if (ending) throw new Error('Блок КОНЕЦ ИГРЫ должен быть один.');
        ending = { kind: 'ending', sections: Object.create(null) };
        entity = ending; section = null; linkMode = false; link = null; continue;
      }
      // Необязательный разделитель перед списком персонажей / глобальных связей.
      if (line === 'ПЕРСОНАЖИ' || line === 'СЛУЧАЙНЫЕ СОБЫТИЯ') { entity = null; section = null; linkMode = false; continue; }
      if (line === 'СВЯЗАННЫЕ ОБЪЕКТЫ') { linkMode = true; link = null; section = null; continue; }
      if (entity && entity.kind !== 'ending' && !entity.name && line) { entity.name = line; continue; }
      if (linkMode) {
        const pair = line.match(/^\{([^{}]+)\}\s*->\s*\[([^\[\]]+)\]$/);
        if (pair) {
          link = { roomName: entity?.kind === 'room' ? entity.name : null, item: pair[1].trim(), object: pair[2].trim(), sections: Object.create(null) };
          rawRules.push(link); section = null; continue;
        }
        if (line === 'РЕЗУЛЬТАТ' || line === 'ДЕЙСТВИЕ') {
          if (!link) throw new Error('Перед ' + line + ' нужна связь {предмет} -> [объект].');
          section = line; link.sections[section] ??= []; continue;
        }
        if (/^[А-ЯЁA-Z][А-ЯЁA-Z0-9 _№-]*:?$/.test(line)) {
          linkMode = false; link = null;
        } else {
          if (line && (!link || !section)) throw new Error('Неполное описание связи: ' + line);
          if (link && section) link.sections[section].push(original.trimEnd());
          continue;
        }
      }
      if (/^[А-ЯЁA-Z][А-ЯЁA-Z0-9 _№-]*:?$/.test(line)) {
        section = line.replace(/:$/, '');
        if (entity) {
          if (section === 'ДИАЛОГ' && entity.kind === 'character') {
            const lines = []; entity.rawDialogs.push(lines); entity.sections[section] = lines;
          } else entity.sections[section] ??= [];
        }
      } else if (entity && section) entity.sections[section].push(original.trimEnd());
      else if (line) throw new Error('Текст вне раздела: «' + line + '».');
    }
    if (!rooms.length) throw new Error('В файле нет разделов ЛОКАЦИЯ.');
    const byName = new Map();
    for (const r of rooms) {
      if (!r.name || byName.has(r.name)) throw new Error('Пустое или повторяющееся название локации.');
      byName.set(r.name, r);
      r.firstVisit = textOf(r, 'ПЕРВЫЙ ВХОД'); r.description = textOf(r, 'ОПИСАНИЕ');
      r.fromPhrase = textOf(r, 'ОТКУДА') || ('из локации «' + r.name + '»');
      r.toPhrase = textOf(r, 'КУДА') || ('в локацию «' + r.name + '»');
      r.image = textOf(r, 'КАРТИНКА');
      r.music = textOf(r, 'МУЗЫКА');
      r.mapIcon = textOf(r, 'ЗНАЧОК КАРТЫ') || 'комната';
      r.imageAlt = textOf(r, 'ПОДПИСЬ КАРТИНКИ') || ('Локация «' + r.name + '».');
      r.objects = parseEntries(r.sections['ОБЪЕКТЫ'], 'object', r.name);
      r.secrets = parseEntries(r.sections['СЕКРЕТЫ'], 'object', r.name);
      r.lockedObjects = parseEntries(r.sections['ЗАПЕРТЫЕ ОБЪЕКТЫ'], 'object', r.name);
      r.items = parseEntries(r.sections['ПРЕДМЕТЫ'], 'item', r.name); r.rules = []; r.exits = [];
      if (!r.description) throw new Error('Нет описания: ' + r.name);
      for (const match of r.description.matchAll(/\[([^\[\]]+)\]/g)) {
        if (!r.objects.has(match[1].trim())) throw new Error('Нет описания объекта «' + match[1] + '»: ' + r.name);
      }
      for (const name of r.secrets.keys()) {
        if (!r.objects.has(name)) throw new Error('Секрет ссылается на неизвестный объект «' + name + '»: ' + r.name);
      }
      for (const name of r.lockedObjects.keys()) {
        if (!r.objects.has(name)) throw new Error('Значок замка ссылается на неизвестный объект «' + name + '»: ' + r.name);
      }
      for (const body of r.objects.values()) validateItems(body, r);
      const used = new Set();
      for (const exitLine of r.sections['ПЕРЕХОДЫ'] || []) {
        if (!exitLine.trim()) continue;
        const match = exitLine.trim().match(/^(север|юг|запад|восток)\s*->\s*(.+)$/i);
        if (!match) throw new Error('Некорректный переход: ' + exitLine);
        const direction = match[1].toLowerCase();
        if (used.has(direction)) throw new Error('Повтор направления: ' + r.name);
        used.add(direction); r.exits.push({ direction, target: match[2].trim() });
      }
    }
    function validateItems(body, room) {
      for (const name of itemNames(body)) if (!room.items.has(name)) throw new Error('Нет описания предмета «' + name + '»: ' + room.name);
    }
    const positions = new Map([[rooms[0].name, { x: 0, y: 0 }]]);
    const occupied = new Map([['0,0', rooms[0].name]]), queue = [rooms[0]];
    for (let i = 0; i < queue.length; i++) {
      const r = queue[i], p = positions.get(r.name);
      for (const exit of r.exits) {
        const target = byName.get(exit.target);
        if (!target) throw new Error('Не найдена локация: ' + exit.target);
        const delta = directions[exit.direction], next = { x: p.x + delta.x, y: p.y + delta.y };
        const previous = positions.get(target.name);
        if (previous && (previous.x !== next.x || previous.y !== next.y)) throw new Error('Противоречивые переходы: ' + target.name);
        const key = next.x + ',' + next.y;
        if (occupied.has(key) && occupied.get(key) !== target.name) throw new Error('Две комнаты занимают одно место: ' + target.name);
        if (!previous) { positions.set(target.name, next); occupied.set(key, target.name); queue.push(target); }
      }
    }
    if (positions.size !== rooms.length) throw new Error('Есть локации, недоступные из стартовой.');
    const rules = [];
    for (const raw of rawRules) {
      const targets = rooms.filter(r => (!raw.roomName || raw.roomName === r.name) && r.objects.has(raw.object));
      if (!targets.length) throw new Error('Не найден объект связи: ' + raw.object);
      if (!rooms.some(r => r.items.has(raw.item))) throw new Error('Не найден предмет связи: ' + raw.item);
      const result = textOf(raw, 'РЕЗУЛЬТАТ'), action = textOf(raw, 'ДЕЙСТВИЕ');
      if (!result) throw new Error('Нет РЕЗУЛЬТАТА связи: ' + raw.object);
      for (const r of targets) {
        validateItems(result, r);
        const rule = { id: 'rule-' + rules.length, roomName: r.name, item: raw.item, object: raw.object, result, action };
        rules.push(rule); r.rules.push(rule);
      }
    }
    const characterByName = new Map();
    for (const c of characters) {
      if (!c.name || characterByName.has(c.name)) throw new Error('Пустое или повторяющееся имя персонажа.');
      characterByName.set(c.name, c); c.description = textOf(c, 'ОПИСАНИЕ');
      c.shortDescription = textOf(c, 'КРАТКОЕ ОПИСАНИЕ') || c.description;
      c.route = [...new Set(textOf(c, 'МАРШРУТ').split(/[,\n]/).map(s => s.trim()).filter(Boolean))];
      c.gender = textOf(c, 'РОД').toLowerCase(); c.dialogs = new Map();
      if (!c.description || !c.route.length) throw new Error('Персонажу нужны ОПИСАНИЕ и МАРШРУТ: ' + c.name);
      for (const roomName of c.route) if (!byName.has(roomName)) throw new Error('Неизвестная локация маршрута: ' + roomName);
      for (const lines of c.rawDialogs) {
        const content = lines.map(s => s.trim()).filter(Boolean), location = content.shift();
        if (!byName.has(location) || c.dialogs.has(location)) throw new Error('Неверная или повторная локация диалога: ' + c.name);
        const speeches = [];
        for (const line of content) {
          const match = line.match(/^([^:]+):\s*(.+)$/);
          if (match) speeches.push({ speaker: match[1].trim(), text: match[2].trim() });
          else if (speeches.length) speeches[speeches.length - 1].text += '\n' + line;
          else throw new Error('Реплика должна начинаться с имени и двоеточия: ' + c.name);
        }
        if (!speeches.length) throw new Error('Пустой диалог: ' + c.name);
        c.dialogs.set(location, speeches);
      }
    }
    const randomEvents = rawEvents.map((raw, index) => {
      const event = {
        id: 'event-' + index, name: raw.name, roomName: textOf(raw, 'МЕСТО'), text: textOf(raw, 'ТЕКСТ'),
        participant: textOf(raw, 'УЧАСТНИК'), missingItem: textOf(raw, 'ЕСЛИ НЕТ ПРЕДМЕТА'),
        object: '', objectDescription: textOf(raw, 'НОВОЕ ОПИСАНИЕ'), roomNote: textOf(raw, 'ИЗМЕНЕНИЕ КОМНАТЫ'),
        effect: textOf(raw, 'ЭФФЕКТ')
      };
      const room = byName.get(event.roomName), object = textOf(raw, 'ОБЪЕКТ');
      if (!event.name || !event.text || !room) throw new Error('Событию нужны название, ТЕКСТ и существующее МЕСТО: ' + event.name);
      if (event.participant && !characterByName.has(event.participant)) throw new Error('Неизвестный участник события: ' + event.participant);
      if (event.participant && !characterByName.get(event.participant).route.includes(event.roomName)) throw new Error('Участник не бывает в месте события: ' + event.name);
      if (event.missingItem && !rooms.some(r => r.items.has(event.missingItem))) throw new Error('Неизвестный предмет в условии события: ' + event.missingItem);
      if (object) {
        const match = object.match(/^\[([^\[\]]+)\]$/);
        if (!match || !room.objects.has(match[1].trim()) || !event.objectDescription) throw new Error('Событию нужны существующий [ОБЪЕКТ] и НОВОЕ ОПИСАНИЕ: ' + event.name);
        event.object = match[1].trim(); validateItems(event.objectDescription, room);
      } else if (event.objectDescription) throw new Error('Для НОВОГО ОПИСАНИЯ укажите ОБЪЕКТ: ' + event.name);
      for (const match of event.roomNote.matchAll(/\[([^\[\]]+)\]/g)) {
        if (!room.objects.has(match[1].trim())) throw new Error('Неизвестный объект в изменении комнаты: ' + event.name);
      }
      if (event.effect && event.effect !== 'свет') throw new Error('Неизвестный эффект события: ' + event.effect);
      return event;
    });
    if (ending) {
      ending.condition = parseCondition(textOf(ending, 'УСЛОВИЕ'));
      ending.text = textOf(ending, 'ТЕКСТ'); ending.button = textOf(ending, 'КНОПКА');
      if (!ending.text || !ending.button) throw new Error('Для финала нужны ТЕКСТ и КНОПКА.');
      const condition = ending.condition;
      if (condition.type === 'action' && !rules.some(r => r.action === condition.name)) throw new Error('Условие финала ссылается на неизвестное ДЕЙСТВИЕ.');
      if (condition.type === 'use' && !rules.some(r => r.item === condition.item && r.object === condition.object)) throw new Error('Условие финала ссылается на неизвестную связь.');
      if (condition.type === 'item' && !rooms.some(r => r.items.has(condition.name))) throw new Error('Неизвестный предмет в условии финала.');
      if (condition.type === 'room' && !byName.has(condition.name)) throw new Error('Неизвестная локация в условии финала.');
    }
    const secretCount = rooms.reduce((sum, room) => sum + room.secrets.size, 0);
    return { rooms, byName, positions, start: rooms[0].name, characters, characterByName, rules, ending, secretCount, randomEvents };
  }

  class Game {
    constructor(world, random = Math.random, eventRandom = random) {
      this.world = world; this.random = random; this.current = world.start; this.visited = new Set([this.current]); this.isFirstVisit = true;
      this.found = new Set(); this.inventory = new Map(); this.message = null;
      this.secretsFound = new Set();
      this.eventRandom = eventRandom; this.seenRandomEvents = new Set(); this.randomEvent = null;
      this.objectChanges = new Map(); this.roomChanges = new Map(); this.lastRandomEventTurn = -4;
      this.usedLinks = new Set(); this.completedActions = new Set(); this.ended = false;
      this.events = []; this.turn = 0; this.dialogue = null; this.selectedCharacter = null;
      this.characters = world.characters.map(c => ({ name: c.name, location: c.route[0], ticks: 0 }));
      this.checkEnding();
    }
    get room() { return this.world.byName.get(this.current); }
    get description() {
      const notes = this.roomChanges.get(this.current);
      return [this.room.description, ...(notes ? notes.values() : [])].join('\n\n');
    }
    visible() { return new Set([...this.visited, ...this.room.exits.map(e => e.target)]); }
    presentCharacters() { return this.characters.filter(c => c.location === this.current); }
    mapDetails(name) {
      // Никаких значков содержимого и имён персонажей в неизвестных комнатах.
      if (!this.visited.has(name)) return null;
      const room = this.world.byName.get(name), locked = [], opened = [];
      for (const [object, label] of room.lockedObjects) {
        const unlocked = room.rules.some(rule => rule.object === object && this.usedLinks.has(rule.id));
        (unlocked ? opened : locked).push(label);
      }
      return { icon: room.mapIcon, characters: this.characters.filter(actor => actor.location === name).map(actor => actor.name), locked, opened };
    }
    advance(events = []) {
      this.events = events; this.randomEvent = null; this.turn++;
      for (const actor of this.characters) {
        actor.ticks++;
        if (actor.ticks <= 2) continue;
        const definition = this.world.characterByName.get(actor.name);
        const exits = this.world.byName.get(actor.location).exits.filter(e => definition.route.includes(e.target));
        if (!exits.length || this.random() >= 0.35) continue;
        const exit = exits[Math.min(exits.length - 1, Math.floor(this.random() * exits.length))];
        const previous = actor.location; actor.location = exit.target; actor.ticks = 0;
        if (previous === this.current) this.events.push(this.movementText(definition, exit.direction, false));
        if (actor.location === this.current) this.events.push(this.movementText(definition, exit.direction, true));
        if (this.selectedCharacter === actor.name && actor.location !== this.current) this.selectedCharacter = null;
        if (this.dialogue?.name === actor.name && !this.dialogue.complete && actor.location !== this.current) this.dialogue.interrupted = true;
      }
      this.checkEnding();
      if (!this.ended) this.rollRandomEvent();
    }
    rollRandomEvent() {
      if (this.ended || this.turn < 3 || this.turn - this.lastRandomEventTurn < 4) return;
      const candidates = this.world.randomEvents.filter(event => {
        if (event.roomName !== this.current || this.seenRandomEvents.has(event.id)) return false;
        if (event.participant && !this.presentCharacters().some(actor => actor.name === event.participant)) return false;
        if (event.missingItem && this.owns(event.missingItem)) return false;
        if (event.object && this.room.rules.some(rule => rule.object === event.object && this.usedLinks.has(rule.id))) return false;
        return true;
      });
      if (!candidates.length || this.eventRandom() >= .28) return;
      const event = candidates[Math.min(candidates.length - 1, Math.floor(this.eventRandom() * candidates.length))];
      this.seenRandomEvents.add(event.id); this.lastRandomEventTurn = this.turn; this.randomEvent = event;
      if (event.roomNote) {
        if (!this.roomChanges.has(this.current)) this.roomChanges.set(this.current, new Map());
        this.roomChanges.get(this.current).set(event.id, event.roomNote);
      }
      if (event.object) {
        this.objectChanges.set(itemKey(this.current, event.object), event.objectDescription);
        // Обновляем открытое описание, сохраняя подтверждение взятия и отметку секрета.
        if (this.message?.type === 'object' && this.message.roomName === this.current && this.message.objectName === event.object) {
          const { notice, secret } = this.message;
          this.objectMessage(event.object); Object.assign(this.message, { notice, secret });
        }
      }
    }
    movementText(character, direction, arriving) {
      const gender = character.gender;
      const verb = gender === 'женский' ? (arriving ? 'пришла' : 'ушла') : gender === 'мужской' ? (arriving ? 'пришёл' : 'ушёл') : gender === 'средний' ? (arriving ? 'пришло' : 'ушло') : null;
      const way = arriving ? directions[direction].from : destination[direction];
      return character.name + (verb ? ' ' + verb : ': ' + (arriving ? 'вход' : 'выход')) + ' ' + way + '.';
    }
    move(target) {
      const exit = this.room.exits.find(e => e.target === target);
      if (this.ended || !exit) return false;
      const from = this.room.fromPhrase;
      this.isFirstVisit = !this.visited.has(target); this.current = target; this.visited.add(target);
      this.message = null; this.dialogue = null; this.selectedCharacter = null;
      this.advance(['Вы вышли ' + from + ' и попали ' + this.room.toPhrase + '.']); return true;
    }
    objectMessage(name) {
      const completed = this.room.rules.filter(r => r.object === name && this.usedLinks.has(r.id));
      const text = completed.length ? completed.map(r => r.result).join('\n\n') : (this.objectChanges.get(itemKey(this.current, name)) || this.room.objects.get(name));
      for (const item of itemNames(text)) this.found.add(itemKey(this.current, item));
      this.message = { type: 'object', roomName: this.current, title: name, objectName: name, text, notice: '' };
    }
    inspect(name) {
      if (this.ended || !this.room.objects.has(name)) return false;
      this.objectMessage(name);
      const secret = this.room.secrets.get(name), key = itemKey(this.current, name);
      if (secret && !this.secretsFound.has(key)) {
        this.secretsFound.add(key); this.message.secret = secret;
      }
      this.advance(); return true;
    }
    hasItem(roomName, name) { return this.inventory.has(itemKey(roomName, name)); }
    owns(name) { return [...this.inventory.values()].some(item => item.name === name); }
    take(name) {
      const key = itemKey(this.current, name);
      if (this.ended || !this.message || this.message.type !== 'object' || this.message.roomName !== this.current ||
          !itemNames(this.message.text).includes(name) || !this.found.has(key) || this.inventory.has(key) || !this.room.items.has(name)) return false;
      const item = { key, name, roomName: this.current, description: this.room.items.get(name) };
      this.inventory.set(key, item); this.message.notice = 'Взято: ' + name + '. ' + item.description;
      this.advance(); return true;
    }
    inspectItem(key) {
      const item = this.inventory.get(key);
      if (this.ended || !item) return false;
      this.message = { type: 'item', roomName: item.roomName, title: item.name, text: item.description, notice: '' }; return true;
    }
    availableRules() {
      if (this.message?.type !== 'object' || this.message.roomName !== this.current) return [];
      return this.room.rules.filter(r => r.object === this.message.objectName && !this.usedLinks.has(r.id) && this.owns(r.item));
    }
    availableActions() {
      if (this.message?.type !== 'object' || this.message.roomName !== this.current) return [];
      return this.room.rules.filter(r => r.object === this.message.objectName && this.usedLinks.has(r.id) && r.action && !this.completedActions.has(r.id));
    }
    use(ruleId) {
      const rule = this.availableRules().find(r => r.id === ruleId);
      if (this.ended || !rule) return false;
      this.usedLinks.add(rule.id); this.objectMessage(rule.object); this.advance(); return true;
    }
    performAction(ruleId) {
      const rule = this.availableActions().find(r => r.id === ruleId);
      if (this.ended || !rule) return false;
      this.completedActions.add(rule.id);
      this.events = [rule.action + '.']; this.checkEnding(); return true;
    }
    selectCharacter(name) {
      if (this.ended || !this.presentCharacters().some(c => c.name === name)) return false;
      this.selectedCharacter = name; return true;
    }
    startDialogue(name) {
      const speeches = this.world.characterByName.get(name)?.dialogs.get(this.current);
      if (this.ended || !speeches || !this.presentCharacters().some(c => c.name === name)) return false;
      this.selectedCharacter = name;
      this.dialogue = { name, location: this.current, speeches, count: 1, complete: false, interrupted: false };
      this.completeDialogueIfReady(); return true;
    }
    nextDialogue() {
      if (this.ended || !this.dialogue || this.dialogue.complete || this.dialogue.interrupted) return false;
      this.dialogue.count++; this.completeDialogueIfReady(); return true;
    }
    completeDialogueIfReady() {
      if (this.dialogue.count === this.dialogue.speeches.length && !this.dialogue.complete) {
        this.dialogue.complete = true; this.advance();
      }
    }
    checkEnding() {
      const condition = this.world.ending?.condition;
      if (!condition || this.ended) return;
      if (condition.type === 'action') this.ended = this.world.rules.some(r => r.action === condition.name && this.completedActions.has(r.id));
      if (condition.type === 'use') this.ended = this.world.rules.some(r => r.item === condition.item && r.object === condition.object && this.usedLinks.has(r.id));
      if (condition.type === 'item') this.ended = this.owns(condition.name);
      if (condition.type === 'room') this.ended = this.current === condition.name;
    }
  }
  const api = { parseWorld, Game };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WorldEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
