import { GhError, ghFetch } from '../api/github';
import { createBanner } from '../components/ErrorBanner';
import { fileIcon, icon } from '../icons';
import { go } from '../router';
import { state } from '../state';
import { el, clear, fmtBytes } from '../utils/dom';
import { getToken } from '../utils/storage';

interface Entry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  sha: string;
}

interface FilePayload {
  content: string;
  encoding: string;
  sha: string;
  size: number;
}

const TEXT_EXT = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'ts', 'json', 'svg', 'txt', 'md', 'yml', 'yaml', 'xml', 'csv', 'ini', 'toml', 'sh', 'java', 'kt', 'py',
]);

function isText(name: string): boolean {
  const i = name.lastIndexOf('.');
  return i >= 0 && TEXT_EXT.has(name.slice(i + 1).toLowerCase());
}

function b64ToText(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function textToB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function mount(root: HTMLElement): void {
  const token = getToken();
  if (!token) {
    go('auth');
    return;
  }
  let repo = state.selectedRepo;
  if (!repo) {
    const qs = new URLSearchParams(location.hash.split('?')[1] ?? '');
    const o = qs.get('owner');
    const r = qs.get('repo');
    if (o && r) {
      repo = {
        id: 0,
        name: r,
        full_name: `${o}/${r}`,
        private: false,
        updated_at: new Date().toISOString(),
        size: 0,
        html_url: `https://github.com/${o}/${r}`,
        owner: { login: o },
      };
      state.selectedRepo = repo;
    }
  }
  if (!repo) {
    go('workspace');
    return;
  }

  const owner = repo.owner?.login ?? '';
  const name = repo.name;
  const branch = 'main';
  const apiBase = `/repos/${owner}/${name}`;
  const banner = createBanner();

  const crumbs = el('div', { class: 'crumbs' });
  const body = el('div', { class: 'repo-body' });
  let path = '';

  /* ---------- 仓库头 ---------- */
  const repoHead = el('div', { class: 'repo-head' },
    el('div', { class: 'repo-title' },
      el('span', { class: 'repo-owner' }, owner),
      el('span', { class: 'repo-slash' }, '/'),
      el('span', { class: 'repo-name' }, name),
      el('span', { class: 'tag' }, repo.private ? '私有' : '公开'),
    ),
    el('div', { class: 'repo-actions' },
      el('a', {
        class: 'btn ghost small',
        href: `https://github.com/${owner}/${name}`,
        target: '_blank',
        rel: 'noopener',
      }, icon('external', 14), 'GitHub'),
      el('button', {
        class: 'btn ghost small',
        type: 'button',
        onclick: () => go('domain'),
      }, icon('globe', 14), '域名'),
      el('button', {
        class: 'btn small',
        type: 'button',
        onclick: () => go('deploy'),
      }, '部署'),
    ),
  );

  const toolbar = el('div', { class: 'repo-toolbar' },
    el('span', { class: 'branch-pill' }, icon('branch', 14), branch),
    crumbs,
  );

  const renderCrumbs = (): void => {
    clear(crumbs);
    crumbs.append(el('button', { type: 'button', onclick: () => void openDir('') }, 'root'));
    if (!path) return;
    let acc = '';
    for (const part of path.split('/')) {
      acc = acc ? `${acc}/${part}` : part;
      const target = acc;
      crumbs.append(el('span', { class: 'sep' }, '/'));
      crumbs.append(el('button', { type: 'button', onclick: () => void openDir(target) }, part));
    }
  };

  /* ---------- 目录 ---------- */
  const openDir = async (dir: string): Promise<void> => {
    banner.hide();
    path = dir;
    renderCrumbs();
    clear(body);
    for (let i = 0; i < 3; i += 1) {
      body.append(el('div', { class: 'skeleton', style: 'height:46px;margin-bottom:6px' }));
    }

    try {
      const { data } = await ghFetch<Entry[]>(`${apiBase}/contents/${encodeURI(dir)}?ref=${branch}`, { token });
      const list = Array.isArray(data) ? data.slice() : [];
      list.sort((a, b) => (a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name)));

      clear(body);
      if (list.length === 0) {
        body.append(
          el('div', { class: 'empty-state' },
            icon('inbox', 30),
            el('p', { style: 'margin-top:10px' }, '这个目录还是空的'),
          ),
        );
        return;
      }

      const table = el('div', { class: 'ftable' },
        el('div', { class: 'fhead' },
          el('span', {}, '名称'),
          el('span', {}, '大小'),
          el('span', {}, '类型'),
        ),
      );

      for (const entry of list) {
        table.append(
          el('button', {
            class: 'fitem',
            type: 'button',
            onclick: () => {
              if (entry.type === 'dir') void openDir(entry.path);
              else void openFile(entry.path, entry.name);
            },
          },
            el('span', { class: 'fname' },
              el('span', { class: 'fico' }, fileIcon(entry.name, 15)),
              entry.name,
            ),
            el('span', { class: 'fsize' }, entry.type === 'dir' ? '—' : fmtBytes(entry.size)),
            el('span', { class: 'ftype' }, entry.type === 'dir' ? '目录' : '文件'),
          ),
        );
      }
      body.append(table);
    } catch (e) {
      clear(body);
      banner.show(e instanceof GhError ? e.message : '读取目录失败');
      body.append(
        el('div', { class: 'empty-state' },
          icon('info', 26),
          el('p', { style: 'margin-top:10px' }, '读不到内容，可能仓库是空的，或者权限不够。'),
          el('button', { class: 'btn ghost small', type: 'button', onclick: () => go('workspace') }, '返回仓库列表'),
        ),
      );
    }
  };

  /* ---------- 文件 ---------- */
  const openFile = async (filePath: string, fileName: string): Promise<void> => {
    banner.hide();
    clear(body);
    body.append(el('div', { class: 'skeleton', style: 'height:160px' }));

    if (!isText(fileName)) {
      clear(body);
      body.append(
        el('div', { class: 'empty-state' },
          fileIcon(fileName, 30),
          el('p', { style: 'margin-top:10px' }, `${fileName} 不是文本文件，这里打不开。`),
          el('a', {
            class: 'btn ghost small',
            href: `https://github.com/${owner}/${name}/blob/${branch}/${filePath}`,
            target: '_blank',
            rel: 'noopener',
          }, icon('external', 14), '去 GitHub 看'),
          el('button', { class: 'btn ghost small', type: 'button', onclick: () => void openDir(path) }, '返回'),
        ),
      );
      return;
    }

    try {
      const { data } = await ghFetch<FilePayload>(`${apiBase}/contents/${encodeURI(filePath)}?ref=${branch}`, { token });
      const text = b64ToText(data.content);
      const lines = text.split('\n');

      const renderView = (): void => {
        clear(body);
        const code = el('div', { class: 'code-view' });
        lines.forEach((ln, i) => {
          code.append(
            el('div', { class: 'code-line' },
              el('span', { class: 'ln' }, String(i + 1)),
              el('span', { class: 'code' }, ln.length ? ln : ' '),
            ),
          );
        });

        body.append(
          el('div', { class: 'file-head' },
            el('span', { class: 'file-name' }, icon('fileFold', 15), fileName),
            el('span', { class: 'file-meta' }, `${fmtBytes(data.size)} · ${lines.length} 行`),
            el('span', { class: 'spacer' }),
            el('button', { class: 'btn ghost small', type: 'button', onclick: renderEdit }, icon('edit', 14), '编辑'),
            el('button', { class: 'btn ghost small', type: 'button', onclick: () => void openDir(path) }, '返回'),
          ),
          el('div', { class: 'code-box' }, code),
        );
      };

      const renderEdit = (): void => {
        clear(body);
        const ta = el('textarea', { class: 'code-edit', spellcheck: 'false', 'aria-label': `${fileName} 内容` });
        ta.value = text;

        const saveBtn = el('button', { class: 'btn small', type: 'button' }, icon('save', 14), '保存');
        const cancelBtn = el('button', { class: 'btn ghost small', type: 'button' }, '取消');

        cancelBtn.addEventListener('click', renderView);
        saveBtn.addEventListener('click', async () => {
          saveBtn.disabled = true;
          saveBtn.textContent = '保存中…';
          try {
            await ghFetch(`${apiBase}/contents/${encodeURI(filePath)}`, {
              method: 'PUT',
              token,
              body: {
                message: `PageDrop: 更新 ${fileName}`,
                content: textToB64(ta.value),
                sha: data.sha,
                branch,
              },
            });
            banner.show(`已提交 ${fileName}`, 'info');
            renderView();
          } catch (e) {
            saveBtn.disabled = false;
            saveBtn.replaceChildren(icon('save', 14), document.createTextNode('保存'));
            banner.show(e instanceof GhError ? e.message : '保存失败');
          }
        });

        body.append(
          el('div', { class: 'file-head' },
            el('span', { class: 'file-name' }, icon('edit', 15), fileName),
            el('span', { class: 'file-meta' }, '编辑中'),
            el('span', { class: 'spacer' }),
            cancelBtn,
            saveBtn,
          ),
          ta,
        );
        ta.focus();
      };

      renderView();
    } catch (e) {
      clear(body);
      banner.show(e instanceof GhError ? e.message : '读取文件失败');
    }
  };

  root.append(
    el('div', { class: 'page' },
      el('button', {
        class: 'backlink',
        type: 'button',
        onclick: () => go('workspace'),
      }, icon('back', 15), '全部仓库'),
      repoHead,
      toolbar,
      banner.node,
      body,
    ),
  );

  renderCrumbs();
  void openDir('');
}
