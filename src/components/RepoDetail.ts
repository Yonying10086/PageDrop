import { ghFetch, GhError } from '../api/github';
import type { Repo } from '../api/types';
import { el, clear } from '../utils/dom';

interface RepoDetail {
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  updated_at: string;
  default_branch: string;
  size: number;
  open_issues_count: number;
  html_url: string;
  homepage: string | null;
  language: string | null;
}

export interface RepoDetailHandle {
  node: HTMLElement;
  open(repo: Repo): Promise<void>;
  hide(): void;
}

/** 站内详情面板：不跳转，直接请求仓库信息展示 */
export function createRepoDetail(
  token: string,
  onDeploy: (repo: Repo) => void,
  onFiles: (repo: Repo) => void,
): RepoDetailHandle {
  const handle = el('div', { class: 'sheet-handle', 'aria-hidden': 'true' });
  const closeBtn = el('button', {
    class: 'sheet-close',
    type: 'button',
    'aria-label': '关闭',
    onclick: () => close(),
  }, '×');
  const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
  const node = el('div', { class: 'backdrop hide' }, sheet);
  // 挂到 body：避免被页面的 transform 动画影响 fixed 定位
  document.body.append(node);

  const close = (): void => {
    node.classList.add('hide');
    document.body.style.overflow = '';
  };

  node.addEventListener('click', (e) => {
    if (e.target === node) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !node.classList.contains('hide')) close();
  });

  const row = (k: string, v: string | number): HTMLElement =>
    el('div', { class: 'kv' }, el('span', { class: 'k' }, k), el('span', { class: 'v' }, String(v)));

  const open = async (repo: Repo): Promise<void> => {
    node.classList.remove('hide');
    document.body.style.overflow = 'hidden';
    sheet.replaceChildren(
      handle,
      closeBtn,
      el('h3', {}, repo.name),
      el('p', { class: 'small faint', style: 'margin-bottom:14px' }, '正在读取仓库信息…'),
      el('div', { class: 'skeleton', style: 'width:70%;margin-bottom:10px' }),
      el('div', { class: 'skeleton', style: 'width:50%' }),
    );

    const owner = repo.owner?.login ?? '';
    try {
      const [detail, pages] = await Promise.all([
        ghFetch<RepoDetail>(`/repos/${owner}/${repo.name}`, { token }),
        ghFetch<{ html_url?: string; status?: string }>(`/repos/${owner}/${repo.name}/pages`, {
          token,
        }).catch(() => null),
      ]);
      const d = detail.data;
      const siteUrl = pages?.data?.html_url?.replace(/^http:/, 'https:') ?? null;

      clear(sheet);
      sheet.append(
        handle,
        closeBtn,
        el('h3', {}, d.name),
        el('p', { class: 'small faint', style: 'margin-bottom:14px' },
          d.description || '这个仓库没有填描述'),
        row('可见性', d.private ? '私有' : '公开'),
        row('默认分支', d.default_branch),
        row('最后更新', new Date(d.updated_at).toLocaleString('zh-CN')),
        row('体积', d.size > 1024 ? `${(d.size / 1024).toFixed(1)} MB` : `${d.size} KB`),
        row('未处理 issue', d.open_issues_count),
        row('Pages', siteUrl ? '已开启' : '未开启'),
        d.language ? row('主要语言', d.language) : el('span'),
        siteUrl
          ? el('div', { class: 'kv' },
              el('span', { class: 'k' }, '站点'),
              el('a', { href: siteUrl, target: '_blank', rel: 'noopener', class: 'v' }, siteUrl))
          : el('span'),
        el('div', { class: 'sheet-actions' },
          el('button', {
            class: 'btn small',
            type: 'button',
            onclick: () => {
              close();
              onFiles(repo);
            },
          }, '浏览文件'),
          el('button', {
            class: 'btn ghost small',
            type: 'button',
            onclick: () => {
              close();
              onDeploy(repo);
            },
          }, '部署到这里'),
          el('a', {
            class: 'btn ghost small',
            href: d.html_url,
            target: '_blank',
            rel: 'noopener',
          }, 'GitHub'),
          el('button', { class: 'btn ghost small', type: 'button', onclick: close }, '关闭'),
        ),
      );
    } catch (e) {
      clear(sheet);
      sheet.append(
        handle,
        closeBtn,
        el('h3', {}, repo.name),
        el('div', { class: 'banner', style: 'margin-top:14px' },
          e instanceof GhError ? e.message : '读取仓库信息失败'),
        el('div', { class: 'sheet-actions' },
          el('button', { class: 'btn ghost small', type: 'button', onclick: close }, '关闭'),
        ),
      );
    }
  };

  return {
    node,
    open,
    hide: close,
  };
}
