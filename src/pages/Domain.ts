import { GhError, ghFetch } from '../api/github';
import { createBanner } from '../components/ErrorBanner';
import { icon } from '../icons';
import { go } from '../router';
import { state } from '../state';
import { copyText, el, clear } from '../utils/dom';
import { getToken } from '../utils/storage';

const A_RECORDS = ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'];
const AAAA_RECORDS = [
  '2606:50c0:8000::153',
  '2606:50c0:8001::153',
  '2606:50c0:8002::153',
  '2606:50c0:8003::153',
];

interface PagesInfo {
  cname?: string | null;
  status?: string | null;
  html_url?: string | null;
  https_enforced?: boolean;
  https_certificate?: { state?: string } | null;
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
  const base = `/repos/${owner}/${name}/pages`;
  const banner = createBanner();

  const statusBox = el('div', { class: 'card' });
  const input = el('input', {
    type: 'text',
    placeholder: '例如：mysite.com',
    'aria-label': '自定义域名',
    autocomplete: 'off',
    spellcheck: 'false',
  });

  const renderStatus = (info: PagesInfo | null, err?: string): void => {
    clear(statusBox);
    if (err) {
      statusBox.append(
        el('h3', {}, '当前状态'),
        el('p', { class: 'muted', style: 'margin-top:8px' }, err),
        el('p', { class: 'small faint', style: 'margin-top:6px' },
          '这个仓库还没有开启 Pages。先去部署一个页面，再回来绑域名。'),
      );
      return;
    }
    if (!info) {
      statusBox.append(el('h3', {}, '当前状态'), el('p', { class: 'muted' }, '正在读取…'));
      return;
    }
    const stateMap: Record<string, string> = {
      null: '未配置自定义域名',
      authorization_created: '证书申请中',
      authorization_pending: '证书校验中',
      authorization_approved: '证书已批准',
      issued: '证书已签发',
      errored: '证书出错',
    };
    const cert = info.https_certificate?.state ?? null;
    statusBox.append(
      el('h3', {}, '当前状态'),
      el('div', { class: 'kv-line' },
        el('span', { class: 'k' }, '已绑域名'),
        el('span', { class: 'v' }, info.cname || '还没有绑')),
      el('div', { class: 'kv-line' },
        el('span', { class: 'k' }, '强制 HTTPS'),
        el('span', { class: 'v' }, info.https_enforced ? '已开启' : '未开启')),
      el('div', { class: 'kv-line' },
        el('span', { class: 'k' }, '证书'),
        el('span', { class: 'v' }, stateMap[cert ?? 'null'] ?? String(cert))),
      info.html_url
        ? el('div', { class: 'kv-line' },
            el('span', { class: 'k' }, '站点'),
            el('a', { class: 'v', href: info.html_url, target: '_blank', rel: 'noopener' }, info.html_url))
        : el('span', { class: 'hide' }),
    );
  };

  const loadStatus = async (): Promise<void> => {
    renderStatus(null);
    try {
      const { data } = await ghFetch<PagesInfo>(base, { token });
      renderStatus(data);
    } catch (e) {
      if (e instanceof GhError && e.status === 404) {
        renderStatus(null, 'Pages 还没开启');
        return;
      }
      renderStatus(null, e instanceof GhError ? e.message : '读取失败');
    }
  };

  const bindBtn = el('button', { class: 'btn', type: 'button' }, '用 API 绑定');
  bindBtn.addEventListener('click', async () => {
    const value = input.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
      banner.show('域名格式不对，别带 https:// 和路径');
      return;
    }
    bindBtn.disabled = true;
    bindBtn.textContent = '绑定中…';
    banner.hide();
    try {
      await ghFetch(base, {
        method: 'PUT',
        token,
        body: { cname: value },
      });
      banner.show(`已把 ${value} 写进仓库设置`, 'info');
      // 证书就绪后再开强制 HTTPS
      try {
        await ghFetch(base, { method: 'PUT', token, body: { https_enforced: true } });
      } catch {
        /* 证书没签发时会被拒，属正常 */
      }
      await loadStatus();
    } catch (e) {
      banner.show(
        e instanceof GhError
          ? `${e.message}（常见原因：DNS 还没指向 GitHub，或这个域名已被别的仓库占用）`
          : '绑定失败',
      );
    } finally {
      bindBtn.disabled = false;
      bindBtn.textContent = '用 API 绑定';
    }
  });

  const recordRow = (type: string, host: string, value: string): HTMLElement => {
    const copyBtn = el('button', { class: 'btn ghost small', type: 'button' }, '复制');
    copyBtn.addEventListener('click', async () => {
      await copyText(value);
      copyBtn.textContent = '已复制';
      window.setTimeout(() => {
        copyBtn.textContent = '复制';
      }, 1200);
    });
    return el('div', { class: 'rec-row' },
      el('span', { class: 'rec-type' }, type),
      el('span', { class: 'rec-host' }, host),
      el('span', { class: 'rec-value' }, value),
      copyBtn,
    );
  };

  root.append(
    el('div', { class: 'page' },
      el('button', { class: 'backlink', type: 'button', onclick: () => go('files') },
        icon('back', 15), `${owner}/${name}`),
      el('h1', { style: 'font-size:26px;margin-bottom:6px' }, '绑定自己的域名'),
      el('p', { class: 'lede', style: 'margin-bottom:20px' },
        '把仓库接到你自己的域名上，访问地址就变成你的域名，而不是 github.io。'),

      banner.node,

      el('div', { class: 'section', style: 'margin-top:0' },
        el('h2', { style: 'font-size:16px' }, '第 1 步 · 在域名商添加记录'),
        el('p', { class: 'small muted', style: 'margin:6px 0 12px' },
          '登录买域名的地方（阿里云 / 腾讯云 / Cloudflare 等），找到「DNS 解析」，加下面这些记录。主机记录填 @ 就是域名本身。'),
        el('div', { class: 'rec-table' },
          el('div', { class: 'rec-head' },
            el('span', {}, '类型'), el('span', {}, '主机'), el('span', {}, '值'), el('span', {})),
          ...A_RECORDS.map((ip) => recordRow('A', '@', ip)),
          ...AAAA_RECORDS.map((ip) => recordRow('AAAA', '@', ip)),
          recordRow('CNAME', 'www', `${owner}.github.io`),
        ),
        el('p', { class: 'small faint', style: 'margin-top:10px' },
          'A 记录四条都要加，少一条也能用但不稳；AAAA 是 IPv6，可选；www 那条让 www.你的域名 也能打开。'),
      ),

      el('div', { class: 'section' },
        el('h2', { style: 'font-size:16px' }, '第 2 步 · 告诉 GitHub 你的域名'),
        el('p', { class: 'small muted', style: 'margin:6px 0 12px' },
          'DNS 配好后点这里，会自动写进仓库的 Pages 设置。也可以自己去仓库 Settings → Pages 填。'),
        el('div', { class: 'token-line', style: 'display:flex;gap:8px;align-items:center' },
          input,
          bindBtn,
        ),
      ),

      el('div', { class: 'section' },
        el('h2', { style: 'font-size:16px' }, '第 3 步 · 等证书'),
        el('p', { class: 'small muted', style: 'margin:6px 0 0' },
          'DNS 生效一般几分钟，证书签发通常 5~30 分钟。签发完把「强制 HTTPS」打开就行——上面按钮会自动帮你试着打开。'),
        el('div', { style: 'margin-top:12px' },
          el('button', { class: 'btn ghost small', type: 'button', onclick: () => void loadStatus() },
            icon('clock', 14), '刷新状态'),
        ),
      ),

      el('div', { class: 'section' }, statusBox),

      el('div', { class: 'section' },
        el('h2', { style: 'font-size:16px' }, '常见问题'),
        el('div', { class: 'plain-card' },
          el('ul', {},
            el('li', {}, '绑定后 github.io 那个地址还能用吗？能，会自动跳到你的域名。'),
            el('li', {}, '显示 404 或证书错误？多半是 DNS 还没生效，等十分钟再看。'),
            el('li', {}, '一个域名能绑几个仓库？只能一个。要多站点请用子域名，比如 a.你的域名、b.你的域名。'),
            el('li', {}, '想解绑？把仓库 Settings → Pages 里的 Custom domain 清空即可。'),
          ),
        ),
      ),
    ),
  );

  void loadStatus();
}
