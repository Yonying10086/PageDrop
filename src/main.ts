import './styles/main.css';
import type { PageId } from './api/types';
import { go, startRouter } from './router';
import { el, clear } from './utils/dom';
import { getToken, getUser } from './utils/storage';
import { mount as mountAuth } from './pages/Auth';
import { mount as mountDeploy } from './pages/Deploy';
import { mount as mountDomain } from './pages/Domain';
import { mount as mountFiles } from './pages/Files';
import { mount as mountHelp } from './pages/Help';
import { mount as mountResult } from './pages/Result';
import { mount as mountWelcome } from './pages/Welcome';
import { mount as mountWorkspace } from './pages/Workspace';

const ICON = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs><linearGradient id="pdg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0A84FF"/><stop offset="1" stop-color="#5E5CE6"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="15" fill="url(#pdg)"/>
  <path d="M32 15v22m0 0 8-8m-8 8-8-8" fill="none" stroke="#fff" stroke-width="4.5"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M19 45h26" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
</svg>`;

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');

const userSlot = el('span', { class: 'nav-user' });

const nav = el(
  'header',
  { class: 'nav' },
  el(
    'a',
    {
      class: 'brand',
      href: '#/',
      onclick: (e: Event) => {
        e.preventDefault();
        go('welcome');
      },
    },
    // 内联 svg 直接塞进 a 里
    (() => {
      const wrap = el('span');
      wrap.innerHTML = ICON;
      return wrap;
    })(),
    el('span', {}, 'PageDrop'),
  ),
  el(
    'nav',
    { class: 'links' },
    el('a', { href: '#/workspace', onclick: (e: Event) => { e.preventDefault(); go('workspace'); } }, '工作台'),
    el('a', { class: 'keep-nav', href: '#/help', onclick: (e: Event) => { e.preventDefault(); go('help'); } }, '帮助'),
    el('a', {
      class: 'optional',
      href: 'https://github.com',
      target: '_blank',
      rel: 'noopener',
    }, 'GitHub'),
  ),
  userSlot,
);

const main = el('main');
const footer = el(
  'footer',
  { class: 'site' },
  el('span', {}, 'PageDrop · 纯静态，没有后端，密钥只留在当前标签页'),
  el('span', {},
    el('a', { href: '#/help', onclick: (e: Event) => { e.preventDefault(); go('help'); } }, '怎么用'),
    ' · ',
    el('a', {
      href: 'https://github.com',
      target: '_blank',
      rel: 'noopener',
    }, 'GitHub'),
  ),
);

app.append(nav, main, footer);

function renderUserSlot(): void {
  clear(userSlot);
  const user = getUser();
  if (!getToken() || !user) return;
  userSlot.append(
    el('img', {
      src: user.avatar_url,
      alt: '',
      width: '24',
      height: '24',
      style: 'border-radius:50%;display:block',
      title: user.login,
    }),
  );
}

const PAGES: Record<PageId, (root: HTMLElement) => void> = {
  welcome: mountWelcome,
  auth: mountAuth,
  workspace: mountWorkspace,
  files: mountFiles,
  domain: mountDomain,
  deploy: mountDeploy,
  result: mountResult,
  help: mountHelp,
};

startRouter((page) => {
  clear(main);
  renderUserSlot();
  PAGES[page](main);
  // 重触发进入动画
  main.classList.remove('page-in');
  void main.offsetWidth;
  main.classList.add('page-in');
  window.scrollTo({ top: 0, behavior: 'auto' });
});
