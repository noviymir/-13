// Обновляет копию TXT для запуска двойным щелчком: node build-world.cjs
const fs = require('node:fs');
const path = require('node:path');
const { parseWorld } = require('./world.js');
const text = fs.readFileSync(path.join(__dirname, 'карта мира.txt'), 'utf8').replace(/\r\n?/g, '\n');
parseWorld(text); // Не заменяем рабочую копию некорректным миром.
const output = '// Создано из «карта мира.txt». Не редактируйте вручную.\n' +
  'globalThis.PALATA_WORLD_TEXT = ' + JSON.stringify(text) + ';\n';
fs.writeFileSync(path.join(__dirname, 'world-data.js'), output, 'utf8');
console.log('Копия мира для запуска без сервера обновлена.');
