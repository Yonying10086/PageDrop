import { deploy, type DeployFile } from '../api/deploy';
import { GhError } from '../api/github';
import { LIMITS } from '../config';
import { createBanner } from '../components/ErrorBanner';
import { createFileTree, type TreeEntry } from '../components/FileTree';
import { createProgressSteps } from '../components/ProgressSteps';
import { createScanResult } from '../components/ScanResult';
import { go } from '../router';
import { state } from '../state';
import { el, clear, fmtBytes } from '../utils/dom';
import { scanFiles, type ScanHit, type ScanSummary } from '../utils/scan';
import { checkPath } from '../utils/validate';
import { getToken } from '../utils/storage';
import { readZip, sanitize, type ArchiveEntry } from '../utils/zip';
import { DEPLOY_STEPS } from '../config';

interface Entry {
  path: string;
  bytes: Uint8Array;
  text: string;
}

const TEXT_EXT = new Set(['html', 'htm', 'css', 'js', 'mjs', 'json', 'svg', 'txt', 'md', 'yml', 'yaml', 'xml']);

function isText(path: string): boolean {
  const i = path.lastIndexOf('.');
  return i >= 0 && TEXT_EXT.has(path.slice(i + 1).toLowerCase());
}

async function fileToEntry(file: File, path?: string): Promise<Entry> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const p = path ?? file.name;
  return { path: p, bytes, text: isText(p) ? new TextDecoder('utf-8', { fatal: false }).decode(bytes) : '' };
}

export function mount(root: HTMLElement): void {
  const token = getToken();
  const repo = state.selectedRepo;
  if (!token) {
    go('auth');
    return;
  }
  if (!repo) {
    go('workspace');
    return;
  }

  const banner = createBanner();
  let entries: Entry[] = [];
  let summary: ScanSummary | null = null;
  let branch = 'main';
  let overwrite = false;
  let deploying = false;

  const tree = createFileTree();
  const scanBox = createScanResult();
  const steps = createProgressSteps(DEPLOY_STEPS);
  steps.node.classList.add('hide');

  const statLine = el('p', { class: 'small faint' }, '还没有选择文件。');
  const entryPicker = el('div', { class: 'hide' });
  const deployBtn = el('button', { class: 'btn', type: 'button' }, '开始部署');

  const fileOnce = el('input', { type: 'file', accept: '.html,.htm', class: 'hide' });
  const folderInput = el('input', { type: 'file', class: 'hide' });
  folderInput.setAttribute('webkitdirectory', '');
  const zipInput = el('input', { type: 'file', accept: '.zip', class: 'hide' });

  const hitsByFile = (): Map<string, ScanHit> => {
    const m = new Map<string, ScanHit>();
    for (const h of summary?.hits ?? []) {
      const prev = m.get(h.file);
      if (!prev || (prev.level === 'warn' && h.level === 'reject')) m.set(h.file, h);
    }
    return m;
  };

  const refresh = (): void => {
    const hits = hitsByFile();
    const treeEntries: TreeEntry[] = entries.map((e) => ({
      path: e.path,
      size: e.bytes.length,
      level: hits.get(e.path)?.level,
    }));
    tree.render(treeEntries);
    scanBox.render(summary);

    const total = entries.reduce((n, e) => n + e.bytes.length, 0);
    if (entries.length === 0) {
      statLine.textContent = '还没有选择文件。';
    } else {
      statLine.textContent = `${entries.length} 个文件 · 共 ${fmtBytes(total)}${
        total > LIMITS.maxTotalBytes ? '（超出 50 MB 上限）' : ''
      }`;
    }

    const hasReject = (summary?.rejects ?? 0) > 0;
    deployBtn.disabled = deploying || entries.length === 0 || hasReject || total > LIMITS.maxTotalBytes;

    // 入口规范化：根目录没有 index.html 时，让用户选一个
    const hasIndex = entries.some((e) => e.path === 'index.html');
    clear(entryPicker);
    if (!hasIndex && entries.length > 0) {
      const htmls = entries.filter((e) => /\.html?$/i.test(e.path));
      if (htmls.length === 0) {
        entryPicker.className = 'banner warn';
        entryPicker.replaceChildren(el('span', {}, '没有找到 .html 文件，请确认上传的是网页。'));
      } else {
        entryPicker.className = 'banner warn';
        const select = el('select', { 'aria-label': '指定入口页面' });
        select.append(el('option', { value: '' }, '选择一个作为首页'));
        for (const h of htmls) select.append(el('option', { value: h.path }, h.path));
        select.addEventListener('change', () => {
          const picked = select.value;
          if (!picked) return;
          const src = entries.find((e) => e.path === picked);
          if (!src) return;
          entries = entries.filter((e) => e.path !== 'index.html');
          entries.push({ ...src, path: 'index.html' });
          scan(entries);
          refresh();
        });
        entryPicker.replaceChildren(
          el('span', { class: 'grow' }, '根目录没有 index.html，请指定首页：'),
          select,
        );
      }
    } else {
      entryPicker.className = 'hide';
    }
  };

  const scan = (list: Entry[]): void => {
    const textFiles = list.filter((e) => isText(e.path)).map((e) => ({ path: e.path, text: e.text }));
    summary = scanFiles(textFiles);
  };

  const setEntries = (list: Entry[]): void => {
    banner.hide();
    const seen = new Set<string>();
    const clean: Entry[] = [];
    for (const e of list) {
      const p = sanitize(e.path);
      const check = checkPath(p);
      if (!check.ok) {
        banner.show(check.message ?? '存在非法路径');
        return;
      }
      if (seen.has(p)) continue;
      seen.add(p);
      clean.push({ ...e, path: p });
    }
    if (clean.length > LIMITS.maxFiles) {
      banner.show(`文件数 ${clean.length} 超过上限 ${LIMITS.maxFiles}`);
      return;
    }
    entries = clean;
    scan(entries);
    refresh();
  };

  fileOnce.addEventListener('change', async () => {
    const f = fileOnce.files?.[0];
    if (!f) return;
    setEntries([await fileToEntry(f)]);
    fileOnce.value = '';
  });

  folderInput.addEventListener('change', async () => {
    const files = Array.from(folderInput.files ?? []);
    if (files.length === 0) return;
    const list: Entry[] = [];
    for (const f of files) {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      list.push(await fileToEntry(f, rel));
    }
    setEntries(list);
    folderInput.value = '';
  });

  zipInput.addEventListener('change', async () => {
    const f = zipInput.files?.[0];
    if (!f) return;
    const res = await readZip(f);
    if (!res.ok) {
      banner.show(res.error ?? '压缩包处理失败');
    } else {
      const list: Entry[] = res.entries.map((e: ArchiveEntry) => ({
        path: e.path,
        bytes: e.bytes,
        text: e.text,
      }));
      setEntries(list);
    }
    zipInput.value = '';
  });

  const dropZone = el('div',
    {
      class: 'feature',
      style:
        'border-style:dashed;text-align:center;padding:26px 16px;color:var(--ink-3);font-size:13.5px',
    },
    '把文件或 zip 拖到这里',
  );
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--blue)';
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '';
  });
  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      const res = await readZip(files[0]);
      if (!res.ok) banner.show(res.error ?? '压缩包处理失败');
      else setEntries(res.entries.map((x) => ({ path: x.path, bytes: x.bytes, text: x.text })));
      return;
    }
    const list: Entry[] = [];
    for (const f of files) list.push(await fileToEntry(f));
    setEntries(list);
  });

  deployBtn.addEventListener('click', async () => {
    if (deploying) return;
    deploying = true;
    deployBtn.disabled = true;
    deployBtn.textContent = '部署中…';
    banner.hide();
    steps.node.classList.remove('hide');

    const files: DeployFile[] = entries.map((e) => ({ path: e.path, bytes: e.bytes }));
    try {
      const result = await deploy({
        token,
        owner: repo.owner?.login ?? '',
        repo: repo.name,
        branch,
        files,
        overwrite,
        onProgress: (i, st, note) => steps.set(i, st, note),
      });
      state.deployTask = {
        owner: repo.owner?.login ?? '',
        repo: repo.name,
        branch,
        startTime: Date.now(),
        siteUrl: result.siteUrl,
        repoUrl: result.repoUrl,
      };
      state.pendingFiles = [];
      go('result');
    } catch (e) {
      banner.show(e instanceof GhError ? e.message : e instanceof Error ? e.message : '部署失败');
      deploying = false;
      deployBtn.disabled = false;
      deployBtn.textContent = '重新部署';
    }
  });

  const branchInput = el('input', { type: 'text', value: 'main', 'aria-label': '分支名' });
  branchInput.addEventListener('input', () => {
    branch = branchInput.value.trim() || 'main';
  });
  const overwriteBox = el('input', { type: 'checkbox', id: 'pd-overwrite' });
  overwriteBox.addEventListener('change', () => {
    overwrite = overwriteBox.checked;
  });

  root.append(
    el('div', { class: 'page' },
      el('div', { class: 'row-actions' },
        el('span', { class: 'tag' }, repo.private ? '私有' : '公开'),
        el('span', { class: 'mono' }, repo.full_name ?? repo.name),
        el('span', { class: 'spacer' }),
        el('button', { class: 'btn ghost small', type: 'button', onclick: () => go('workspace') },
          '更换仓库'),
      ),
      banner.node,
      el('h1', { style: 'margin-top:16px;font-size:30px' }, '放进你的网页'),
      el('p', { class: 'lede' }, '单个 HTML、整个文件夹、或者一个 zip 都行。'),
      el('div', { class: 'row-actions', style: 'margin-top:22px' },
        el('button', { class: 'btn', type: 'button', onclick: () => fileOnce.click() }, '选单个 HTML'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => folderInput.click() }, '选整个文件夹'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => zipInput.click() }, '选 zip 压缩包'),
      ),
      fileOnce, folderInput, zipInput,
      el('div', { style: 'margin-top:14px' }, dropZone),
      el('p', { class: 'small faint', style: 'margin-top:10px' },
        '文件夹上传在手机上不可用（浏览器限制），手机上请用单个 HTML 或 zip。'),
      statLine,
      entryPicker,
      el('div', { class: 'section' }, tree.node),
      el('div', { class: 'section' }, scanBox.node),
      el('details', { class: 'card', style: 'margin-top:22px' },
        el('summary', { style: 'cursor:pointer;font-weight:500' }, '部署选项'),
        el('div', { style: 'margin-top:14px' },
          el('label', { class: 'field' }, el('span', {}, '目标分支'), branchInput),
          el('label', { style: 'display:flex;gap:8px;align-items:center;font-size:14px' },
            overwriteBox, el('span', {}, '覆盖仓库里已有的其它文件（默认只合并）')),
        ),
      ),
      el('div', { class: 'row-actions cta-row', style: 'margin-top:20px' },
        deployBtn,
        el('button', { class: 'btn ghost', type: 'button', onclick: () => go('workspace') }, '取消'),
      ),
      steps.node,
    ),
  );

  refresh();
}
