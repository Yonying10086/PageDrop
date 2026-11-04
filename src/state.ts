import type { Repo } from './api/types';
import type { RateLimitInfo } from './utils/rateLimit';

export interface DeployTask {
  owner: string;
  repo: string;
  branch: string;
  startTime: number;
  siteUrl?: string;
  repoUrl?: string;
}

export type RepoFilter = 'all' | 'public' | 'private';

/** 内存状态：切页面保留，刷新即丢（符合企划书「不持久化」的要求） */
export const state = {
  repos: [] as Repo[],
  page: 1,
  filter: 'all' as RepoFilter,
  search: '',
  selectedRepo: null as Repo | null,
  deployTask: null as DeployTask | null,
  pendingFiles: [] as { path: string; bytes: Uint8Array; text: string }[],
  rate: { remaining: 0, limit: 0, reset: 0 } as RateLimitInfo,
};

export function setRate(rate: RateLimitInfo): void {
  if (rate.limit > 0) state.rate = rate;
}

export function resetAfterLogout(): void {
  state.repos = [];
  state.page = 1;
  state.filter = 'all';
  state.search = '';
  state.selectedRepo = null;
  state.deployTask = null;
  state.pendingFiles = [];
  state.rate = { remaining: 0, limit: 0, reset: 0 };
}
