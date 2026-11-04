import { verifyToken } from '../api/auth';
import { GhError } from '../api/github';
import { SCOPES } from '../config';
import { go } from '../router';
import { setRate } from '../state';
import { createBanner } from '../components/ErrorBanner';
import { createTokenInput } from '../components/TokenInput';
import { el, copyText } from '../utils/dom';
import { checkToken } from '../utils/validate';
import { clearToken, getToken, setToken, setUser } from '../utils/storage';

/** GitHub 新建 token 的直达链接（预填名字和权限） */
const NEW_TOKEN_URL =
  'https://github.com/settings/tokens/new?scopes=repo,workflow&description=PageDrop';

type Mode = 'quick' | 'manual';

export function mount(root: HTMLElement): void {
  const banner = createBanner();
  const tokenInput = createTokenInput('粘贴你的 GitHub Personal Access Token');
  let mode: Mode = 'quick';

  const verifyBtn = el('button', { class: 'btn', type: 'button' }, '验证并继续');
  const clearBtn = el(
    'button',
    { class: `btn danger ${getToken() ? '' : 'hide'}`, type: 'button' },
    '清除已保存的密钥',
  );

  const panel = el('div', { class: 'card', style: 'margin-top:18px' });

  clearBtn.addEventListener('click', () => {
    clearToken();
    tokenInput.input.value = '';
    clearBtn.classList.add('hide');
    banner.show('已清除当前标签页里的密钥', 'info');
  });

  const pasteBtn = el('button', { class: 'btn ghost small', type: 'button' }, '从剪贴板粘贴');
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      tokenInput.input.value = text.trim();
      banner.show('已从剪贴板取到内容，核对一下再验证', 'info');
    } catch {
      banner.show('浏览器不让读剪贴板，手动粘贴一下吧', 'warn');
    }
  });

  verifyBtn.addEventListener('click', async () => {
    banner.hide();
    const raw = tokenInput.getValue();
    const check = checkToken(raw);
    if (!check.ok) {
      banner.show(check.message ?? '密钥格式不正确');
      return;
    }
    verifyBtn.disabled = true;
    const prevText = verifyBtn.textContent;
    verifyBtn.textContent = '验证中…';
    tokenInput.setDisabled(true);
    try {
      const { user, rate } = await verifyToken(raw);
      setToken(raw);
      setUser(user);
      setRate(rate);
      go('workspace');
    } catch (e) {
      banner.show(e instanceof GhError ? e.message : '网络异常，请检查网络后重试');
      verifyBtn.disabled = false;
      verifyBtn.textContent = prevText;
      tokenInput.setDisabled(false);
    }
  });

  const renderPanel = (): void => {
    if (mode === 'quick') {
      panel.replaceChildren(
        el('h3', {}, '1. 打开 GitHub 授权页'),
        el('p', { class: 'small muted', style: 'margin:6px 0 12px' },
          '链接里已经把权限勾好了（repo + workflow），你只要登录、点一下绿色按钮。'),
        el('div', { class: 'row-actions' },
          el('a', {
            class: 'btn',
            href: NEW_TOKEN_URL,
            target: '_blank',
            rel: 'noopener',
          }, '打开 GitHub 生成密钥'),
          el('button', {
            class: 'btn ghost small',
            type: 'button',
            onclick: async () => {
              await copyText(NEW_TOKEN_URL);
              banner.show('链接已复制，可以发到自己手机上打开', 'info');
            },
          }, '复制链接'),
        ),
        el('h3', { style: 'margin-top:22px' }, '2. 把生成的密钥粘回来'),
        el('p', { class: 'small muted', style: 'margin:6px 0 12px' },
          'GitHub 生成后只显示一次，点右边的复制，回来粘到这里。'),
        el('div', { class: 'token-line', style: 'display:flex;gap:8px;align-items:center' },
          tokenInput.node, pasteBtn),
        el('div', { class: 'row-actions', style: 'margin-top:14px' }, verifyBtn, clearBtn),
      );
    } else {
      panel.replaceChildren(
        el('h3', {}, '粘贴已有的密钥'),
        el('p', { class: 'small muted', style: 'margin:6px 0 12px' },
          '如果你之前生成过 token，直接粘进来。需要 repo 和 workflow 两个权限。'),
        el('div', { class: 'token-line', style: 'display:flex;gap:8px;align-items:center' },
          tokenInput.node, pasteBtn),
        el('div', { class: 'row-actions', style: 'margin-top:14px' }, verifyBtn, clearBtn),
        el('p', { class: 'small faint', style: 'margin-top:14px' },
          '没有 token？点上面「第一次用」那个标签，30 秒就能弄到一个。'),
      );
    }
  };

  const tabQuick = el('button', { type: 'button', 'aria-pressed': 'true' }, '第一次用');
  const tabManual = el('button', { type: 'button', 'aria-pressed': 'false' }, '我有密钥了');
  const setMode = (m: Mode): void => {
    mode = m;
    tabQuick.setAttribute('aria-pressed', String(m === 'quick'));
    tabManual.setAttribute('aria-pressed', String(m === 'manual'));
    renderPanel();
    tokenInput.input.focus();
  };
  tabQuick.addEventListener('click', () => setMode('quick'));
  tabManual.addEventListener('click', () => setMode('manual'));

  const scopeItems = SCOPES.map((s) =>
    el('div', { class: 'row' },
      el('span', { class: 'tag' }, s.name),
      el('span', { class: 'muted small' }, s.desc),
    ),
  );

  root.append(
    el('div', { class: 'page narrow' },
      el('h1', {}, '填写 GitHub 密钥'),
      el('p', { class: 'lede' },
        '密钥是 GitHub 提供的临时通行证，只用于本次操作，不会上传到任何服务器。'),
      banner.node,
      el('div', { class: 'segmented' }, tabQuick, tabManual),
      panel,
      el('div', { class: 'card' },
        el('h3', {}, '需要的权限'),
        el('p', { class: 'small muted', style: 'margin:6px 0 12px' },
          '只勾这两个就够，不要勾 admin:org、delete_repo 这类。'),
        el('div', { class: 'list' }, ...scopeItems),
      ),
      el('p', { class: 'small faint', style: 'margin-top:18px' },
        '为什么不能直接登录？因为 GitHub 换 token 必须带一个服务器端密钥，纯静态页面做不到——所以这里用「一键预填好的授权页 + 粘贴」来代替。'),
    ),
  );

  renderPanel();
}
