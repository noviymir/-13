// Единый набор небольших векторных значков. Работает и при открытии с диска.
function createMapIcon(type) {
  const paths = {
    комната: 'M6 21V3h12v18M3 21h18M14 12h.01',
    кровать: 'M3 19V6M3 15h18v4M3 10h5a3 3 0 0 1 3 3v2M11 8h7a3 3 0 0 1 3 3v4M5 8h2',
    проход: 'M4 4h6v6H4zM14 14h6v6h-6zM7 10v7h7M14 4h6v6h-6zM10 7h4',
    крест: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    колба: 'M9 3h6M10 3v7L5 19a1 1 0 0 0 1 2h12a1 1 0 0 0 1-2l-5-9V3M8 15h8',
    персонаж: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M5 21v-3a7 7 0 0 1 14 0v3',
    замок: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
    открыто: 'M8 10V7a5 5 0 0 1 9-3M5 10h14v11H5zM12 14v3',
    игрок: 'M12 22s8-8 8-14a8 8 0 1 0-16 0c0 6 8 14 8 14zM12 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    вопрос: 'M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3M12 18h.01',
    прицел: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16'
  };
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false'); svg.classList.add('map-glyph');
  const path = document.createElementNS(ns, 'path'); path.setAttribute('d', paths[type] || paths.комната);
  svg.append(path); return svg;
}
