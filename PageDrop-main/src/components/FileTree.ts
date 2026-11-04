import { el, fmtBytes } from '../utils/dom';
import { fileIcon } from '../icons';

export interface TreeEntry {
  path: string;
  size: number;
  /** 扫描级别：命中则标色 */
  level?: 'warn' | 'reject';
}

export function createFileTree(): { node: HTMLElement; render(entries: TreeEntry[]): void } {
  const node = el('div', { class: 'tree' });

  return {
    node,
    render(entries: TreeEntry[]) {
      if (entries.length === 0) {
        node.replaceChildren(el('div', { class: 'faint' }, '还没有选择文件'));
        return;
      }
      node.replaceChildren(
        ...entries
          .slice()
          .sort((a, b) => a.path.localeCompare(b.path))
          .map((entry) => {
            const depth = entry.path.split('/').length - 1;
            const name = entry.path.split('/').slice(-1)[0];
            const color =
              entry.level === 'reject'
                ? 'var(--err)'
                : entry.level === 'warn'
                  ? 'var(--warn)'
                  : 'var(--ink)';
            return el(
              'div',
              { class: 'line' },
              el(
                'span',
                { class: 'fico', style: `margin-left:${depth * 14}px` },
                fileIcon(name, 13),
              ),
              el('span', { class: 'path', style: `color:${color}` }, name),
              el('span', { class: 'size' }, fmtBytes(entry.size)),
            );
          }),
      );
    },
  };
}
