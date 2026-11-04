import { el } from '../utils/dom';

export type BannerLevel = 'err' | 'warn' | 'info';

export interface BannerHandle {
  node: HTMLElement;
  show(message: string, level?: BannerLevel): void;
  hide(): void;
}

/** 页面顶部的错误横幅：不自动消失，需手动关闭或成功后消失 */
export function createBanner(): BannerHandle {
  const text = el('span', { class: 'grow' });
  const close = el('button', { class: 'close', type: 'button', 'aria-label': '关闭' }, '×');
  const node = el('div', { class: 'banner hide', role: 'alert' }, text, close);

  close.addEventListener('click', () => {
    node.classList.add('hide');
  });

  return {
    node,
    show(message: string, level: BannerLevel = 'err') {
      text.textContent = message;
      node.className = `banner ${level === 'err' ? '' : level}`.trim();
    },
    hide() {
      node.classList.add('hide');
    },
  };
}
