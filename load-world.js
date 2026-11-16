/* Выбор источника данных. Оба варианта возвращают исходный TXT для одного парсера. */
(function (root) {
  'use strict';
  async function load(protocol, bundledText, fetcher) {
    if (protocol === 'file:') {
      if (typeof bundledText !== 'string' || !bundledText.trim()) throw new Error('Не удалось загрузить данные истории.');
      return bundledText;
    }
    const response = await fetcher('./' + encodeURIComponent('карта мира.txt'), { cache: 'no-store' });
    if (!response.ok) throw new Error('История временно недоступна (HTTP ' + response.status + ').');
    return response.text();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { load };
  else root.WorldLoader = { load };
})(typeof globalThis !== 'undefined' ? globalThis : this);
