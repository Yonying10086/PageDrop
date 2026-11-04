import { DEPLOY_STEPS } from '../config';
import { GhError, ghFetch } from './github';
import type { BlobResult, GitCommit, GitRef, GitTree } from './types';

export interface DeployFile {
  path: string;
  bytes: Uint8Array;
}

export type StepState = 'active' | 'done' | 'error';
export type ProgressFn = (step: number, state: StepState, note?: string) => void;

export interface DeployOptions {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  files: DeployFile[];
  description?: string;
  /** true = 用新树整体替换（会删掉仓库里其他文件）；false = 在现有树上合并 */
  overwrite?: boolean;
  onProgress?: ProgressFn;
}

export interface DeployResult {
  repoUrl: string;
  siteUrl: string;
  pagesExisted: boolean;
}

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function workflowYaml(branch: string): string {
  return `name: Deploy to GitHub Pages

on:
  push:
    branches: [${branch}]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v4
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length || 1)).fill(0).map(async () => {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** 仓库不存在就建一个 */
async function ensureRepo(opts: DeployOptions): Promise<boolean> {
  try {
    await ghFetch(`/repos/${opts.owner}/${opts.repo}`, { token: opts.token });
    return false;
  } catch (e) {
    if (!(e instanceof GhError) || e.status !== 404) throw e;
  }
  await ghFetch('/user/repos', {
    method: 'POST',
    token: opts.token,
    body: {
      name: opts.repo,
      description: opts.description ?? '由 PageDrop 部署的静态站点',
      private: false,
      auto_init: true,
    },
  });
  return true;
}

/** 用 Git Data API 一次性提交所有文件 */
async function uploadFiles(opts: DeployOptions): Promise<void> {
  const base = `/repos/${opts.owner}/${opts.repo}`;
  let baseCommit: string | null = null;
  let baseTree: string | null = null;

  try {
    const ref = await ghFetch<GitRef>(`${base}/git/ref/heads/${opts.branch}`, { token: opts.token });
    baseCommit = ref.data.object.sha;
    const commit = await ghFetch<{ tree: { sha: string } }>(
      `${base}/git/commits/${baseCommit}`,
      { token: opts.token },
    );
    baseTree = commit.data.tree.sha;
  } catch (e) {
    if (!(e instanceof GhError) || e.status !== 404) throw e;
  }

  const blobs = await mapLimit(opts.files, 4, async (f) => {
    const { data } = await ghFetch<BlobResult>(`${base}/git/blobs`, {
      method: 'POST',
      token: opts.token,
      body: { content: toBase64(f.bytes), encoding: 'base64' },
    });
    return { path: f.path, sha: data.sha };
  });

  const treeBody: Record<string, unknown> = {
    tree: blobs.map((b) => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha })),
  };
  if (baseTree && !opts.overwrite) treeBody.base_tree = baseTree;

  const tree = await ghFetch<GitTree>(`${base}/git/trees`, {
    method: 'POST',
    token: opts.token,
    body: treeBody,
  });

  const commitBody: Record<string, unknown> = {
    message: 'PageDrop: 部署静态站点',
    tree: tree.data.sha,
  };
  if (baseCommit) commitBody.parents = [baseCommit];

  const commit = await ghFetch<GitCommit>(`${base}/git/commits`, {
    method: 'POST',
    token: opts.token,
    body: commitBody,
  });

  if (baseCommit) {
    await ghFetch(`${base}/git/refs/heads/${opts.branch}`, {
      method: 'PATCH',
      token: opts.token,
      body: { sha: commit.data.sha, force: true },
    });
  } else {
    await ghFetch(`${base}/git/refs`, {
      method: 'POST',
      token: opts.token,
      body: { ref: `refs/heads/${opts.branch}`, sha: commit.data.sha },
    });
  }
}

/** 写入 .github/workflows/deploy.yml（已存在则更新） */
async function writeWorkflow(opts: DeployOptions): Promise<void> {
  const path = '.github/workflows/deploy.yml';
  const base = `/repos/${opts.owner}/${opts.repo}/contents/${path}`;
  const content = toBase64(new TextEncoder().encode(workflowYaml(opts.branch)));

  let sha: string | undefined;
  try {
    const existing = await ghFetch<{ sha: string }>(`${base}?ref=${opts.branch}`, {
      token: opts.token,
    });
    sha = existing.data.sha;
  } catch (e) {
    if (!(e instanceof GhError) || e.status !== 404) throw e;
  }

  const body: Record<string, unknown> = {
    message: 'PageDrop: 写入 Pages 工作流',
    content,
    branch: opts.branch,
  };
  if (sha) body.sha = sha;

  await ghFetch(base, { method: 'PUT', token: opts.token, body });
}

/** 开启 Pages（workflow 构建），已开启则跳过 */
async function enablePages(opts: DeployOptions): Promise<boolean> {
  const base = `/repos/${opts.owner}/${opts.repo}/pages`;
  try {
    await ghFetch(base, { token: opts.token });
    return true;
  } catch (e) {
    if (!(e instanceof GhError) || e.status !== 404) throw e;
  }

  try {
    await ghFetch(base, { method: 'POST', token: opts.token, body: { build_type: 'workflow' } });
  } catch (e) {
    if (e instanceof GhError && e.status === 409) return true;
    throw e;
  }
  return false;
}

export async function deploy(opts: DeployOptions): Promise<DeployResult> {
  const progress = opts.onProgress ?? (() => {});
  const total = DEPLOY_STEPS.length;
  let step = 0;

  try {
    progress(step, 'active', DEPLOY_STEPS[step]);
    const created = await ensureRepo(opts);
    progress(step, 'done', created ? '已新建仓库' : '仓库已存在');
    step += 1;

    progress(step, 'active', `上传 ${opts.files.length} 个文件`);
    await uploadFiles(opts);
    progress(step, 'done', '代码已提交');
    step += 1;

    progress(step, 'active', '写入工作流');
    await writeWorkflow(opts);
    progress(step, 'done', '工作流已就绪');
    step += 1;

    progress(step, 'active', '开启 Pages');
    const pagesExisted = await enablePages(opts);
    progress(step, 'done', pagesExisted ? 'Pages 已开启' : 'Pages 已开启');
    step += 1;

    if (step < total) progress(step, 'done');
  } catch (e) {
    progress(Math.min(step, total - 1), 'error', e instanceof Error ? e.message : '部署失败');
    throw e;
  }

  // 站点真实地址：账号绑了自定义域名时，项目页会挂在那个域名下面
  let siteUrl = `https://${opts.owner}.github.io/${opts.repo}/`;
  try {
    const { data: pages } = await ghFetch<{ html_url?: string }>(
      `/repos/${opts.owner}/${opts.repo}/pages`,
      { token: opts.token },
    );
    if (pages.html_url) siteUrl = pages.html_url.replace(/^http:/, 'https:');
  } catch {
    /* 拿不到就用默认地址 */
  }

  return {
    repoUrl: `https://github.com/${opts.owner}/${opts.repo}`,
    siteUrl,
    pagesExisted: false,
  };
}
