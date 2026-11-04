import type { PageId } from './api/types';
import { getToken } from './utils/storage';

const TABLE: Record<string, PageId> = {
  '': 'welcome',
  '/': 'welcome',
  '/auth': 'auth',
  '/workspace': 'workspace',
  '/files': 'files',
  '/domain': 'domain',
  '/deploy': 'deploy',
  '/result': 'result',
  '/help': 'help',
};

const NEED_TOKEN: PageId[] = ['workspace', 'files', 'domain', 'deploy', 'result'];

export const PATH_OF: Record<PageId, string> = {
  welcome: '#/',
  auth: '#/auth',
  workspace: '#/workspace',
  files: '#/files',
  domain: '#/domain',
  deploy: '#/deploy',
  result: '#/result',
  help: '#/help',
};

export function currentPage(): PageId {
  const raw = location.hash.replace(/^#/, '').split('?')[0];
  return TABLE[raw] ?? 'welcome';
}

export function guard(page: PageId): PageId {
  if (NEED_TOKEN.includes(page) && !getToken()) return 'auth';
  return page;
}

export function go(page: PageId): void {
  const path = PATH_OF[page];
  if (location.hash === path) {
    // hash 没变时手动触发一次渲染
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  location.hash = path;
}

export type RouteHandler = (page: PageId) => void;

export function startRouter(onChange: RouteHandler): void {
  const handle = (): void => {
    const page = guard(currentPage());
    if (page !== currentPage()) {
      location.replace(PATH_OF[page]);
      return;
    }
    onChange(page);
  };
  window.addEventListener('hashchange', handle);
  handle();
}

export function back(): void {
  if (history.length > 1) history.back();
  else go('welcome');
}
