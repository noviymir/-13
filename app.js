'use strict';
const $ = id => document.getElementById(id);
const directionLabels = { север: 'впереди', юг: 'позади', запад: 'слева', восток: 'справа' };
let world, game;
let renderedDialogue = null;
let renderedRandomEvent = null;
const music = new MusicPlayer({
  createAudio(path) {
    const audio = document.createElement('audio'); audio.src = encodeURI(path);
    $('music-audio').append(audio); return audio;
  },
  onChange: updateMusicControls
});
function updateMusicControls() {
  $('music-toggle').textContent = music.enabled ? 'Выключить музыку' : 'Включить музыку';
  $('music-toggle').setAttribute('aria-pressed', String(music.enabled));
  $('music-toggle').disabled = !music.track && !music.enabled;
  $('music-volume-value').textContent = Math.round(music.volume * 100) + '%';
  $('music-status').textContent = music.error;
}
$('music-toggle').addEventListener('click', () => music.toggle());
$('music-volume').addEventListener('input', event => music.setVolume(event.target.value / 100));
function paragraphs(element, text) {
  element.replaceChildren();
  for (const part of text.split(/\n\s*\n/).filter(Boolean)) {
    const p = document.createElement('p'); p.textContent = part; element.append(p);
  }
}
function interactiveText(element, text, mode, roomName = game.current) {
  element.replaceChildren();
  for (const part of text.split(/\n\s*\n/).filter(Boolean)) {
    const p = document.createElement('p');
    const pattern = /\[([^\[\]]+)\]|\{([^{}]+)\}/g;
    let end = 0;
    for (const match of part.matchAll(pattern)) {
      p.append(document.createTextNode(part.slice(end, match.index)));
      const isObject = match[1] !== undefined, name = (match[1] ?? match[2]).trim();
      const allowed = isObject ? mode === 'objects' && game.room.objects.has(name) : mode === 'items';
      if (!allowed) p.append(document.createTextNode(match[0]));
      else if (!isObject && game.hasItem(roomName, name)) {
        const taken = document.createElement('span'); taken.className = 'taken-item';
        taken.textContent = name + ' (в инвентаре)'; p.append(taken);
      } else {
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'text-action ' + (isObject ? 'object-action' : 'item-action');
        button.textContent = name;
        button.setAttribute('aria-label', (isObject ? 'Осмотреть: ' : 'Взять: ') + name);
        button.addEventListener('click', () => {
          const changed = isObject ? game.inspect(name) : game.take(name);
          if (changed) refreshInteraction('message-panel');
        });
        p.append(button);
      }
      end = match.index + match[0].length;
    }
    p.append(document.createTextNode(part.slice(end))); element.append(p);
  }
}
function renderResearch() {
  renderSecrets();
  const message = game.message;
  $('message-panel').hidden = !message;
  $('message-title').textContent = message ? message.title : '';
  $('secret-notice').hidden = !message?.secret;
  $('secret-notice').textContent = message?.secret ? 'Секрет найден: ' + message.secret : '';
  if (message) {
    interactiveText($('message-text'), message.text, message.type === 'object' ? 'items' : 'plain', message.roomName);
    $('message-notice').textContent = message.notice;
    $('message-notice').hidden = !message.notice;
  } else {
    $('message-text').replaceChildren(); $('message-notice').textContent = '';
  }
  $('object-actions').replaceChildren();
  for (const rule of game.availableRules()) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'apply-button';
    button.textContent = 'Применить: ' + rule.item;
    button.addEventListener('click', () => { if (game.use(rule.id)) refreshInteraction('message-panel'); });
    $('object-actions').append(button);
  }
  for (const rule of game.availableActions()) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'apply-button exit-button';
    button.textContent = rule.action;
    button.addEventListener('click', () => { if (game.performAction(rule.id)) refreshInteraction('message-panel'); });
    $('object-actions').append(button);
  }
  $('inventory-panel').hidden = game.inventory.size === 0;
  $('inventory').replaceChildren();
  for (const item of game.inventory.values()) {
    const li = document.createElement('li'), button = document.createElement('button');
    button.type = 'button'; button.textContent = item.name;
    button.setAttribute('aria-label', 'Осмотреть предмет: ' + item.name + ' (' + item.roomName + ')');
    button.addEventListener('click', () => { if (game.inspectItem(item.key)) refreshInteraction('message-panel'); });
    li.append(button); $('inventory').append(li);
  }
}
function renderSecrets() {
  const total = world.secretCount, found = game.secretsFound.size;
  $('secrets-panel').hidden = total === 0;
  const label = 'Найдено ' + found + ' из ' + total;
  if ($('secrets-progress').textContent !== label) $('secrets-progress').textContent = label;
  $('ending-secrets').hidden = total === 0;
  $('ending-secrets').textContent = 'Секреты отделения: найдено ' + found + ' из ' + total + '.';
}
function renderEvents() {
  $('movement-events').hidden = game.events.length === 0;
  $('movement-events').replaceChildren();
  for (const text of game.events) {
    const p = document.createElement('p'); p.textContent = text; $('movement-events').append(p);
  }
  const event = game.randomEvent;
  $('random-event-panel').hidden = !event;
  if (event !== renderedRandomEvent) {
    $('random-event-title').textContent = event ? event.name : '';
    paragraphs($('random-event-text'), event ? event.text : '');
    $('location-visual').classList.remove('event-dim');
    if (event?.effect === 'свет') $('location-visual').classList.add('event-dim');
    renderedRandomEvent = event;
  }
}
function renderCharacters() {
  const present = game.presentCharacters();
  $('characters-panel').hidden = present.length === 0;
  $('characters').replaceChildren();
  for (const actor of present) {
    const character = game.world.characterByName.get(actor.name);
    const paragraph = document.createElement('p'); paragraph.className = 'character-summary';
    const name = document.createElement('a'); name.href = '#character-card'; name.className = 'text-action character-link';
    name.textContent = actor.name; name.setAttribute('aria-label', 'Осмотреть персонажа: ' + actor.name);
    name.addEventListener('click', event => {
      event.preventDefault();
      if (game.selectCharacter(actor.name)) refreshInteraction('character-card');
    });
    paragraph.append(name, document.createTextNode(' — ' + character.shortDescription));
    $('characters').append(paragraph);
  }
  const character = game.world.characterByName.get(game.selectedCharacter);
  $('character-card').hidden = !character;
  if (character) {
    $('character-name').textContent = character.name;
    paragraphs($('character-description'), character.description);
    const hasDialogue = character.dialogs.has(game.current);
    $('start-dialogue').hidden = !hasDialogue;
    $('start-dialogue').setAttribute('aria-label', 'Начать разговор: ' + character.name);
    $('no-dialogue').hidden = hasDialogue;
  }
  renderDialogue();
}
function renderDialogue() {
  const dialogue = game.dialogue;
  $('dialogue-panel').hidden = !dialogue;
  if (renderedDialogue !== dialogue) { $('dialogue-lines').replaceChildren(); renderedDialogue = dialogue; }
  if (!dialogue) return;
  $('dialogue-title').textContent = 'Разговор · ' + dialogue.name;
  // Уже показанные реплики остаются в DOM: добавляется только следующая.
  for (let i = $('dialogue-lines').childElementCount; i < dialogue.count; i++) {
    const speech = dialogue.speeches[i], row = document.createElement('div');
    row.className = 'dialogue-line' + (speech.speaker === dialogue.name ? ' npc-line' : ' player-line');
    const speaker = document.createElement('strong'); speaker.textContent = speech.speaker;
    const body = document.createElement('p'); body.textContent = speech.text;
    row.append(speaker, body); $('dialogue-lines').append(row);
  }
  $('dialogue-next').hidden = dialogue.complete || dialogue.interrupted;
  $('dialogue-interrupted').hidden = !dialogue.interrupted;
}
function renderEnding() {
  music.setTrack(game.ended ? null : game.room.music);
  $('game').hidden = game.ended;
  $('ending-panel').hidden = !game.ended;
  if (game.ended) {
    paragraphs($('ending-text'), world.ending.text);
    $('ending-restart').textContent = world.ending.button;
  }
}
function refreshInteraction(focus) {
  interactiveText($('description'), game.description, 'objects');
  renderResearch(); renderCharacters(); renderEvents(); renderEnding();
  if (!game.ended) renderMap(false);
  if (game.ended) $('ending-title').focus();
  else if (focus && !$(focus).hidden) $(focus).focus({ preventScroll: focus === 'message-panel' });
}
function restart() {
  game = new WorldEngine.Game(world); render();
}
function beginGame() {
  if (!world) return;
  $('start-screen').hidden = true;
  $('gameplay-chapter').hidden = false;
  $('sound-controls').hidden = false;
  restart();
}
$('start-game').addEventListener('click', beginGame);
$('start-dialogue').addEventListener('click', event => {
  event.preventDefault();
  if (game.startDialogue(game.selectedCharacter)) refreshInteraction('dialogue-panel');
});
$('dialogue-next').addEventListener('click', () => {
  if (game.nextDialogue()) {
    refreshInteraction();
    if (game.ended) return;
    if ($('dialogue-next').hidden) $('dialogue-panel').focus({ preventScroll: true });
    const latest = $('dialogue-lines').lastElementChild;
    if (latest) latest.scrollIntoView({ block: 'nearest' });
  }
});
function start(text) {
  // Сначала проверяем весь файл; при ошибке существующий мир не повреждается.
  const parsed = WorldEngine.parseWorld(text);
  world = parsed;
  $('loader').hidden = true;
  $('start-game').disabled = false;
  $('start-status').hidden = true;
}
function render(focus = true) {
  $('location-title').textContent = game.room.name;
  renderLocationImage();
  $('first-visit').hidden = !game.isFirstVisit || !game.room.firstVisit;
  paragraphs($('first-visit'), game.isFirstVisit ? game.room.firstVisit : '');
  interactiveText($('description'), game.description, 'objects');
  renderResearch();
  renderCharacters(); renderEvents(); renderEnding();
  $('progress').textContent = 'Исследовано: ' + game.visited.size + ' / ' + world.rooms.length;
  renderMap();
  if (focus) $(game.ended ? 'ending-title' : 'location-title').focus();
}
function renderLocationImage() {
  const figure = $('location-visual'), room = game.room;
  figure.replaceChildren(); figure.hidden = true;
  if (!room.image) return;
  const image = document.createElement('img');
  image.id = 'location-image'; image.alt = room.imageAlt;
  image.decoding = 'async';
  image.addEventListener('load', () => {
    if (figure.firstElementChild === image) figure.hidden = false;
  });
  // Неудачная загрузка иллюстрации не мешает тексту, карте и прохождению.
  image.addEventListener('error', () => {
    if (figure.firstElementChild === image) figure.hidden = true;
  });
  image.src = encodeURI(room.image);
  figure.append(image);
}
function mapBadge(icon, className, title, count = 1) {
  const badge = document.createElement('span');
  badge.className = 'map-badge ' + className; badge.title = title; badge.setAttribute('aria-hidden', 'true');
  badge.append(createMapIcon(icon));
  if (count > 1) badge.append(document.createTextNode(String(count)));
  return badge;
}
function centerMap() {
  const node = $('map').querySelector('[aria-current="location"]');
  if (!node) return;
  const viewport = $('map-viewport');
  viewport.scrollLeft = node.offsetLeft + node.offsetWidth / 2 - viewport.clientWidth / 2;
  viewport.scrollTop = node.offsetTop + node.offsetHeight / 2 - viewport.clientHeight / 2;
}
function setupMapLegend() {
  const entries = [
    ['игрок', 'Вы здесь', 'legend-player'],
    ['комната', 'Посещено', ''],
    ['персонаж', 'Персонажи', 'legend-character'],
    ['замок', 'Запертый объект', 'legend-locked'],
    ['открыто', 'Открытый объект', 'legend-opened'],
    ['вопрос', 'Неизвестно', '']
  ];
  $('map-legend').replaceChildren();
  for (const [icon, label, className] of entries) {
    const entry = document.createElement('span'); entry.className = className;
    entry.append(createMapIcon(icon), document.createTextNode(label)); $('map-legend').append(entry);
  }
  $('map-center').prepend(createMapIcon('прицел'));
}
function renderMap(recenter = true) {
  const map = $('map'), viewport = $('map-viewport'), visible = game.visible();
  const savedScroll = { left: viewport.scrollLeft, top: viewport.scrollTop };
  const names = [...visible], coords = names.map(name => world.positions.get(name));
  const minX = Math.min(...coords.map(p => p.x)), minY = Math.min(...coords.map(p => p.y));
  const maxX = Math.max(...coords.map(p => p.x)), maxY = Math.max(...coords.map(p => p.y));
  const cardWidth = 146, cardHeight = 108, stepX = 174, stepY = 140, pad = 24;
  const spanWidth = (maxX - minX) * stepX + cardWidth;
  const width = Math.max(spanWidth + pad * 2, viewport.clientWidth);
  const height = (maxY - minY) * stepY + cardHeight + pad * 2;
  const offsetX = (width - spanWidth) / 2;
  const point = name => {
    const p = world.positions.get(name);
    return { x: (p.x - minX) * stepX + offsetX, y: (p.y - minY) * stepY + pad };
  };
  map.replaceChildren(); map.style.width = width + 'px'; map.style.height = height + 'px';
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.classList.add('map-links'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  const drawn = new Set();
  for (const name of names) {
    for (const exit of world.byName.get(name).exits) {
      if (!visible.has(exit.target)) continue;
      if (!game.visited.has(name) && !game.visited.has(exit.target)) continue;
      const key = [name, exit.target].sort().join('\u0000');
      if (drawn.has(key)) continue;
      drawn.add(key);
      const a = point(name), b = point(exit.target), line = document.createElementNS(ns, 'line');
      if (name === game.current || exit.target === game.current) line.classList.add('active-link');
      for (const [attr, value] of Object.entries({ x1: a.x + cardWidth / 2, y1: a.y + cardHeight / 2, x2: b.x + cardWidth / 2, y2: b.y + cardHeight / 2 })) line.setAttribute(attr, value);
      svg.append(line);
    }
  }
  map.append(svg);
  for (const name of names) {
    const current = name === game.current, details = game.mapDetails(name), known = Boolean(details);
    const exit = game.room.exits.find(e => e.target === name), available = Boolean(exit) && !current;
    const node = document.createElement(available ? 'button' : 'div'), p = point(name);
    node.className = 'room' + (current ? ' current' : '') + (!known ? ' unknown' : '') + (available ? ' available' : '');
    node.style.left = p.x + 'px'; node.style.top = p.y + 'px';
    if (current) node.setAttribute('aria-current', 'location');
    const header = document.createElement('span'); header.className = 'room-header';
    const type = document.createElement('span'); type.className = 'room-type';
    type.append(createMapIcon(known ? details.icon : 'вопрос')); header.append(type);
    const badges = document.createElement('span'); badges.className = 'room-badges';
    const descriptions = [];
    if (known) {
      if (details.characters.length) {
        const title = 'Персонажи: ' + details.characters.join(', ');
        badges.append(mapBadge('персонаж', 'npc-marker', title, details.characters.length)); descriptions.push(title);
      }
      if (details.locked.length) {
        const title = 'Заперто: ' + details.locked.join(', ');
        badges.append(mapBadge('замок', 'lock-marker', title, details.locked.length)); descriptions.push(title);
      } else if (details.opened.length) {
        const title = 'Открыто: ' + details.opened.join(', ');
        badges.append(mapBadge('открыто', 'open-marker', title, details.opened.length)); descriptions.push(title);
      }
    }
    if (current) { badges.append(mapBadge('игрок', 'player-marker', 'Вы здесь')); descriptions.push('Вы здесь'); }
    header.append(badges); node.append(header);
    const label = document.createElement('span'); label.className = 'room-label';
    label.textContent = known ? name : 'Неизвестная комната'; node.append(label);
    const state = document.createElement('span'); state.className = 'room-state';
    state.textContent = current ? 'Вы здесь' : available ? (known ? 'Перейти →' : 'Исследовать →') : 'Посещено';
    node.append(state);
    if (descriptions.length) { node.title = descriptions.join('. '); node.setAttribute('aria-description', descriptions.join('. ')); }
    if (available) {
      node.type = 'button';
      node.setAttribute('aria-label', known ? 'Перейти: ' + name : 'Неизвестная комната ' + directionLabels[exit.direction] + '. Перейти');
      node.addEventListener('click', () => { if (game.move(name)) render(); });
    }
    map.append(node);
  }
  if (recenter) centerMap();
  else { viewport.scrollLeft = savedScroll.left; viewport.scrollTop = savedScroll.top; }
}
setupMapLegend();
$('map-center').addEventListener('click', centerMap);
function showError(error) {
  $('start-screen').hidden = true;
  $('loader').hidden = false;
  $('load-message').textContent = 'Не удалось открыть историю. ' + error.message + '\nПопробуйте обновить страницу.';
  $('retry-load').hidden = false;
}
$('retry-load').addEventListener('click', () => location.reload());
$('restart').addEventListener('click', restart);
$('ending-restart').addEventListener('click', restart);
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (game) renderMap(); }, 100); });
WorldLoader.load(location.protocol, globalThis.PALATA_WORLD_TEXT, (...args) => fetch(...args))
  .then(start).catch(showError);
