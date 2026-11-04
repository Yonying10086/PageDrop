import { el, fmtBytes } from '../utils/dom';
import type { ScanHit, ScanSummary } from '../utils/scan';

export function createScanResult(): {
  node: HTMLElement;
  render(summary: ScanSummary | null): void;
} {
  const node = el('div', { class: 'stack' });

  return {
    node,
    render(summary) {
      if (!summary) {
        node.replaceChildren();
        return;
      }
      const head = el(
        'div',
        { class: 'row-actions' },
        el('span', { class: `tag ${summary.rejects > 0 ? 'err' : summary.warnings > 0 ? 'warn' : 'ok'}` },
          `扫描 ${summary.files} 个文件`),
        summary.warnings > 0 ? el('span', { class: 'tag warn' }, `警告 ${summary.warnings}`) : null,
        summary.rejects > 0 ? el('span', { class: 'tag err' }, `拒绝 ${summary.rejects}`) : null,
        summary.warnings === 0 && summary.rejects === 0
          ? el('span', { class: 'tag ok' }, '未发现问题')
          : null,
      );

      const list = el('div', { class: 'list' });
      for (const hit of summary.hits) {
        list.append(
          el(
            'div',
            { class: 'row' },
            el('span', { class: `tag ${hit.level === 'reject' ? 'err' : 'warn'}` },
              hit.level === 'reject' ? '拒绝' : '警告'),
            el(
              'div',
              { class: 'grow' },
              el('div', { class: 'name' }, hit.message),
              el('div', { class: 'meta mono' }, `${hit.file}:${hit.line} · ${hit.rule}`),
            ),
          ),
        );
      }

      node.replaceChildren(head, summary.hits.length > 0 ? list : el('span'));
    },
  };
}

export function scanLevelTag(hit: ScanHit | undefined): HTMLElement | null {
  if (!hit) return null;
  return el('span', { class: 'tag ' + (hit.level === 'reject' ? 'err' : 'warn') },
    hit.level === 'reject' ? '拒绝' : '警告');
}

export function summaryLine(summary: ScanSummary): string {
  return `${summary.files} 个文件 · 警告 ${summary.warnings} · 拒绝 ${summary.rejects}`;
}

export function formatSize(n: number): string {
  return fmtBytes(n);
}
