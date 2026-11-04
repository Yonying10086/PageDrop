import type { Repo } from '../api/types';
import { el, fmtBytes } from '../utils/dom';

export interface RepoListHandlers {
  onDeploy(repo: Repo): void;
  onDetails(repo: Repo): void;
}

export interface RepoListHandle {
  node: HTMLElement;
  render(repos: Repo[]): void;
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const day = 86400000;
  if (diff < 3600000) return '刚刚更新';
  if (diff < day) return `${Math.floor(diff / 3600000)} 小时前更新`;
  if (diff < day * 30) return `${Math.floor(diff / day)} 天前更新`;
  return new Date(t).toLocaleDateString('zh-CN');
}

export function createRepoList(handlers: RepoListHandlers): RepoListHandle {
  const node = el('div', { class: 'list' });

  return {
    node,
    render(repos: Repo[]) {
      if (repos.length === 0) {
        node.replaceChildren(el('div', { class: 'empty' }, '没有匹配的仓库'));
        return;
      }
      node.replaceChildren(
        ...repos.map((repo) =>
          el(
            'div',
            { class: 'row' },
            el(
              'div',
              { class: 'grow' },
              el('div', { class: 'name' }, repo.name),
              el(
                'div',
                { class: 'meta' },
                `${repo.private ? '私有' : '公开'} · ${
                  repo.size ? fmtBytes(repo.size * 1024) : '空仓库'
                } · ${timeAgo(repo.updated_at)}`,
                repo.has_pages ? ' · 已开启 Pages' : '',
              ),
            ),
            el(
              'div',
              { class: 'row-actions' },
              el(
                'button',
                { class: 'btn small', type: 'button', onclick: () => handlers.onDeploy(repo) },
                '部署到这里',
              ),
              el(
                'button',
                { class: 'btn ghost small', type: 'button', onclick: () => handlers.onDetails(repo) },
                '详情',
              ),
            ),
          ),
        ),
      );
    },
  };
}
