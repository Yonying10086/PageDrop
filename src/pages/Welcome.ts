import { go } from '../router';
import { getToken, getUser } from '../utils/storage';
import { el } from '../utils/dom';

const PHRASES = [
  '填一串密钥，选个网页，几秒后拿到网址。',
  '不用 Git，不用命令行，不用服务器。',
  '把文件丢进来，剩下的交给它。',
  '你的网页，三分钟上线。',
];

const GUIDE = [
  { n: 1, t: '填一串密钥', d: '去 GitHub 生成一个只带 repo 和 workflow 权限的 token，粘进来。' },
  { n: 2, t: '选个仓库', d: '用现成的，或者现场新建一个，名字随便起。' },
  { n: 3, t: '把网页丢进去', d: '单个 HTML、整个文件夹、或者一个 zip 都行，点部署等结果。' },
];

const SPECS = [
  { t: '三种上传方式', d: '单文件、文件夹、zip，拖进来也行' },
  { t: '自动建仓 + 开 Pages', d: '建仓库、提交、写工作流、开 Pages，一次做完' },
  { t: '实时构建状态', d: '每 3 秒查一次，好了直接给链接' },
  { t: '手机也能用', d: '除了文件夹上传，其它单手就能操作' },
];

export function mount(root: HTMLElement): void {
  const user = getUser();

  /* ---------- 动态宣传语 ---------- */
  let idx = 0;
  const current = el('span', { class: 'rot-text' }, PHRASES[0]);
  const caret = el('span', { class: 'caret', 'aria-hidden': 'true' });
  const rotator = el('span', { class: 'rotator' }, current, caret);
  const timer = window.setInterval(() => {
    if (!rotator.isConnected) {
      window.clearInterval(timer);
      return;
    }
    idx = (idx + 1) % PHRASES.length;
    current.textContent = PHRASES[idx];
    current.classList.remove('swap');
    void current.offsetWidth;
    current.classList.add('swap');
  }, 3400);

  /* ---------- 已有密钥提示 ---------- */
  const notice = el('div', { class: 'banner info hide' });
  const startBtn = el('button', { class: 'btn', type: 'button' }, '开始使用');
  startBtn.addEventListener('click', () => {
    if (getToken()) {
      notice.className = 'banner info';
      notice.replaceChildren(
        el('span', { class: 'grow' },
          user ? `检测到 ${user.login} 的密钥，已经存在当前标签页里。` : '检测到已有密钥。'),
        el('button', { class: 'btn small', type: 'button', onclick: () => go('workspace') }, '继续用'),
        el('button', { class: 'btn ghost small', type: 'button', onclick: () => go('auth') }, '重新填写'),
      );
      return;
    }
    go('auth');
  });

  const section = (title: string, sub: string, body: HTMLElement): HTMLElement =>
    el('div', { class: 'section reveal' },
      el('h2', { style: 'font-size:20px' }, title),
      el('p', { class: 'small muted', style: 'margin:6px 0 16px' }, sub),
      body,
    );

  root.append(
    el('div', { class: 'page hero-wrap' },

      el('div', { class: 'row-actions tag-row', style: 'margin-bottom:16px' },
        el('span', { class: 'tag' }, '纯静态'),
        el('span', { class: 'tag' }, '零后端'),
        el('span', { class: 'tag' }, '密钥不落地'),
      ),

      el('h1', {}, 'PageDrop'),
      el('p', { class: 'lede' }, rotator),

      el('div', { class: 'row-actions cta-row', style: 'margin-top:26px' },
        startBtn,
        el('button', { class: 'btn ghost', type: 'button', onclick: () => go('help') },
          '先看看怎么生成密钥'),
      ),
      notice,

      el('div', { class: 'mini-stats' },
        el('span', {}, el('b', {}, '< 1s'), '打开页面'),
        el('span', {}, el('b', {}, '0'), '行后端代码'),
        el('span', {}, el('b', {}, '50 MB'), '单次上传上限'),
        el('span', {}, el('b', {}, '3 分钟'), '从零到上线'),
      ),

      el('div', { class: 'guide' },
        ...GUIDE.map((s) =>
          el('div', { class: 'guide-step' },
            el('div', { class: 'num' }, String(s.n)),
            el('h4', {}, s.t),
            el('p', {}, s.d),
          ),
        ),
      ),

      section('它能做什么', '左边是能力，右边是你能省下的步骤。',
        el('div', { class: 'spec-grid' },
          ...SPECS.map((s) => el('div', { class: 'spec' }, el('b', {}, s.t), s.d)),
        ),
      ),

      el('p', { class: 'small faint reveal', style: 'margin-top:26px' },
        '密钥只存在当前标签页，关掉就没了；页面有 CSP，除了 api.github.com 连不出去；只申请 repo 和 workflow 两个权限。'),
      el('p', { class: 'small faint', style: 'margin-top:18px' },
        '本工具不存储你的任何数据，所有操作直接与 GitHub 通信。'),

      el('div', { class: 'section center', style: 'padding-top:34px;border-top:1px solid var(--hair)' },
        el('h2', { style: 'font-size:18px;color:var(--ink-2)' }, '支持一下'),
        el('p', { class: 'small faint', style: 'margin-top:8px' },
          '不点也没关系，用着顺手就够了。愿意请我喝瓶水的话，扫这里。'),
        el('div', { style: 'display:flex;justify-content:center;gap:16px;margin-top:20px;flex-wrap:wrap' },
          ...[
            { src: './qr-alipay.png', label: '支付宝' },
            { src: './qr-wechat.png', label: '微信' },
          ].map((q) =>
            el('figure', { style: 'margin:0;padding:9px 9px 6px;border:1px solid var(--hair);border-radius:14px;background:#fff' },
              el('img', { src: q.src, alt: `${q.label}赞赏码`, width: '132', height: '132', loading: 'lazy', style: 'border-radius:8px' }),
              el('figcaption', { class: 'small faint', style: 'margin-top:7px' }, q.label),
            ),
          ),
        ),
      ),

      el('div', { class: 'section center', style: 'padding-bottom:10px' },
        el('p', { class: 'muted', style: 'margin-bottom:14px' }, '准备好了就开始，第一分钟就能看到结果。'),
        el('button', { class: 'btn', type: 'button', onclick: () => go(getToken() ? 'workspace' : 'auth') },
          '开始使用'),
      ),
    ),
  );

  /* ---------- 滚动出现 ---------- */
  const items = Array.from(root.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    items.forEach((i) => io.observe(i));
  } else {
    items.forEach((i) => i.classList.add('in'));
  }
}
