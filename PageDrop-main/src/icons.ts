/**
 * 内联 SVG 图标（路径来自 Lucide，MIT）。
 * 全站统一从这里取，不使用任何 emoji。
 */

const PATHS: Record<string, string> = {
  folder: 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z',
  file: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
  fileFold: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z / M14 2v5h6',
  code: 'm16 18 6-6-6-6 / M8 6l-6 6 6 6',
  image: 'M3 3h18v18H3z / m3 16 5-5a2 2 0 0 1 3 0l4 4 / m14-4a1 1 0 1 0 2 0 1 1 0 1 0-2 0',
  archive: 'M21 8v13H3V8 / M1 3h22v5H1z / M10 12h4',
  back: 'm15 18-6-6 6-6',
  chevronRight: 'm9 18 6-6-6-6',
  chevronDown: 'm6 9 6 6 6-6',
  plus: 'M12 5v14 / M5 12h14',
  trash: 'M3 6h18 / M8 6V4h8v2 / M19 6l-1 14H6L5 6',
  upload: 'M12 3v12 / m6 9 6-6 6 6 / M4 21h16',
  download: 'M12 17V5 / m6 11 6 6 6-6 / M4 21h16',
  external: 'M15 3h6v6 / M10 14 21 3 / M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5',
  search: 'm21 21-4.3-4.3 / M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2 / M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18 / M6 6l12 12',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 / M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z / M17 21v-8H7v8 / M7 3v5h8',
  branch: 'M6 3v12 / M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z / M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z / M18 9a9 9 0 0 1-9 9',
  lock: 'M5 11h14v10H5z / M8 11V7a4 4 0 0 1 8 0v4',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z / M3 12h18 / M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z',
  repo: 'M4 3h13a2 2 0 0 1 2 2v14 / M4 3v18h15 / M8 7h7 / M8 11h7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z / M12 7v5l3 2',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z / M12 11v5 / M12 8h.01',
  key: 'M2 18a5 5 0 0 0 7 0l2-2 2 2 2-2-2-2 3-3a5 5 0 1 0-7-7l-9 9v5z',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
};

export type IconName = keyof typeof PATHS | string;

export function icon(name: IconName, size = 16, color = 'currentColor'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', color);
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.flex = 'none';
  svg.style.display = 'block';

  const raw = PATHS[name] ?? PATHS.file;
  for (const seg of raw.split(' / ')) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('d', seg.trim());
    svg.append(el);
  }
  return svg;
}

/** 按扩展名挑图标 */
export function fileIcon(name: string, size = 15): SVGSVGElement {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'].includes(ext)) return icon('image', size);
  if (['zip', 'rar', '7z', 'gz', 'tar', 'apk', 'jar'].includes(ext)) return icon('archive', size);
  if (['js', 'mjs', 'ts', 'tsx', 'json', 'html', 'htm', 'css', 'java', 'kt', 'py', 'sh', 'yml', 'yaml'].includes(ext)) {
    return icon('code', size);
  }
  return icon('fileFold', size);
}
