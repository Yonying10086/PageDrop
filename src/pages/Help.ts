import { go } from '../router';
import { el } from '../utils/dom';
import { icon } from '../icons';

const STEPS = [
  '登录 GitHub，点右上角头像，进 Settings。',
  '左侧菜单最下面点 Developer settings。',
  '点 Personal access tokens，选 Tokens (classic) 或 Fine-grained tokens。',
  '点 Generate new token。',
  '填 Note（比如 PageDrop），过期时间建议 7 天。',
  '勾选权限：repo（完整仓库权限）、workflow（工作流权限）。',
  '点 Generate token，复制生成的字符串（以 ghp_ 或 github_pat_ 开头）。',
  '回到本工具，粘贴到授权页。',
];

const FAQ: { q: string; a: string }[] = [
  {
    q: '密钥会不会泄露？',
    a: '密钥只存在当前标签页的 sessionStorage 里，关掉标签页就没了；本工具没有后端，不会把密钥发到除 GitHub 以外的任何地方。',
  },
  {
    q: '部署要多久？',
    a: '通常 30 秒到 2 分钟，取决于 GitHub Actions 的排队情况。首次开启 Pages 会慢一点。',
  },
  {
    q: '链接打不开怎么办？',
    a: 'github.io 在国内访问可能不稳定，可以先刷新或换网络；要长期用建议绑定自己的域名。',
  },
  {
    q: '可以部署多个站点吗？',
    a: '可以。每个仓库对应一个站点，同一个密钥重复用就行。',
  },
  {
    q: '部署失败怎么办？',
    a: '去仓库的 Actions 页面看日志。常见原因是文件路径冲突、仓库里没有 index.html，或者 Pages 配置冲突。',
  },
  {
    q: '会把我的仓库删掉吗？',
    a: '不会。默认是「合并」模式，只覆盖同名文件，其它文件原样保留；除非你在部署选项里主动勾了「覆盖」，才会用新文件树替换。',
  },
];

/** 用 CSS 画的小示意图，替代空截图占位 */
function mockList(title: string, rows: string[], highlight?: number): HTMLElement {
  return el(
    'div',
    { class: 'feature', style: 'padding:14px' },
    el('div', { class: 'small faint', style: 'margin-bottom:8px' }, title),
    el(
      'div',
      {
        style:
          'border:1px solid var(--hair);border-radius:9px;overflow:hidden;background:#fff;font-size:12.5px',
      },
      ...rows.map((r, i) =>
        el(
          'div',
          {
            style: `padding:7px 10px;border-bottom:${i === rows.length - 1 ? '0' : '1px solid var(--hair)'};${
              highlight === i ? 'background:#eaf4ff;color:var(--blue);font-weight:500' : 'color:var(--ink-2)'
            }`,
          },
          r,
        ),
      ),
    ),
  );
}

function mockChecks(): HTMLElement {
  const row = (label: string, desc: string): HTMLElement =>
    el(
      'div',
      {
        style:
          'display:flex;gap:9px;align-items:flex-start;padding:8px 10px;border:1px solid var(--hair);border-radius:9px;margin-top:6px;background:#fff',
      },
      el(
        'span',
        {
          style:
            'width:15px;height:15px;border-radius:4px;background:var(--blue);color:#fff;font-size:11px;display:grid;place-items:center;flex:none;margin-top:2px',
        },
        icon('check', 11),
      ),
      el('span', {},
        el('b', { style: 'font-size:12.5px' }, label),
        el('span', { class: 'faint', style: 'display:block;font-size:11.5px' }, desc),
      ),
    );
  return el(
    'div',
    { class: 'feature', style: 'padding:14px' },
    el('div', { class: 'small faint', style: 'margin-bottom:8px' }, '勾选这两项'),
    row('repo', '读写仓库'),
    row('workflow', '写入工作流'),
  );
}

function mockToken(): HTMLElement {
  return el(
    'div',
    { class: 'feature', style: 'padding:14px' },
    el('div', { class: 'small faint', style: 'margin-bottom:8px' }, '复制这一串'),
    el(
      'div',
      {
        class: 'mono',
        style:
          'border:1px solid var(--hair);border-radius:9px;background:#fff;padding:9px 10px;display:flex;gap:8px;align-items:center',
      },
      el('span', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, 'ghp_xxxxxxxxxxxxxxxxxxxx'),
      el('span', { style: 'margin-left:auto;color:var(--blue);flex:none' }, '复制'),
    ),
    el('p', { class: 'faint', style: 'font-size:11.5px;margin-top:8px' },
      '这串只显示一次，关掉页面就看不到了。'),
  );
}

export function mount(root: HTMLElement): void {
  root.append(
    el('div', { class: 'page narrow' },
      el('h1', {}, '如何生成 GitHub 密钥'),
      el('p', { class: 'lede' }, '照着点就行，两分钟。'),

      el('ol', { class: 'card', style: 'margin-top:22px;padding-left:38px' },
        ...STEPS.map((s) => el('li', { style: 'margin:8px 0;font-size:15px' }, s)),
      ),

      el('div', { class: 'section' },
        el('h2', {}, '看图更快'),
        el('div', { class: 'grid-3', style: 'margin-top:12px' },
          mockList('第 1 步 · 进 Developer settings', ['Settings', 'Integrations', 'Developer settings'], 2),
          mockChecks(),
          mockToken(),
        ),
      ),

      el('div', { class: 'section' },
        el('h2', {}, '常见问题'),
        el('div', { style: 'margin-top:12px' },
          ...FAQ.map((item) =>
            el('details', { class: 'card', style: 'padding:16px 20px' },
              el('summary', { style: 'cursor:pointer;font-weight:500' }, item.q),
              el('p', { class: 'muted', style: 'margin-top:10px;font-size:14.5px' }, item.a),
            ),
          ),
        ),
      ),

      el('div', { class: 'row-actions', style: 'margin-top:26px' },
        el('button', { class: 'btn', type: 'button', onclick: () => go('auth') }, '去填密钥'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => go('welcome') }, '回首页'),
      ),
    ),
  );
}
