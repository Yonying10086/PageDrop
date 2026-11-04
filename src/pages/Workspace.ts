import { ghFetch, GhError } from '../api/github';
import type { Repo } from '../api/types';
import { createBanner } from '../components/ErrorBanner';
import { createRepoDetail } from '../components/RepoDetail';
import { createRepoList } from '../components/RepoList';
import { icon } from '../icons';
import { go } from '../router';
import { resetAfterLogout, setRate, state } from '../state';
import { el, clear } from '../utils/dom';
import { levelOf, resetIn } from '../utils/rateLimit';
import { checkRepoName } from '../utils/validate';
import { clearToken, getToken, getUser } from '../utils/storage';

export function mount(root: HTMLElement): void {
  const token = getToken();
  if (!token) {
    go('auth');
    return;
  }
  const user = getUser();
  const banner = createBanner();

  const rateChip = el('span', { class: 'rate' }, '请求数 —');
  const searchInput = el('input', { type: 'search', placeholder: '按仓库名筛选', 'aria-label': '搜索仓库' });
  const filterSelect = el('select', { 'aria-label': '筛选仓库' },
    el('option', { value: 'all' }, '全部'),
    el('option', { value: 'public' }, '公开'),
    el('option', { value: 'private' }, '私有'),
  );
  const pager = el('div', { class: 'row-actions', style: 'margin-top:14px' });
  const detail = createRepoDetail(
    token,
    (repo) => {
      state.selectedRepo = repo;
      go('deploy');
    },
    (repo) => {
      state.selectedRepo = repo;
      go('files');
    },
  );
  const repoList = createRepoList({
    onDeploy: (repo) => {
      state.selectedRepo = repo;
      go('deploy');
    },
    onDetails: (repo) => {
      void detail.open(repo);
    },
  });

  const dialog = el('div', { class: 'card hide', style: 'margin-top:14px' });
  const newRepoBtn = el('button', { class: 'btn', type: 'button' }, '新建仓库并部署');
  const logoutBtn = el('button', { class: 'btn ghost small', type: 'button' }, '退出');

  const renderRate = (): void => {
    const r = state.rate;
    if (r.limit <= 0) {
      rateChip.textContent = '请求数 —';
      rateChip.className = 'rate';
      return;
    }
    rateChip.textContent = `${r.remaining} / ${r.limit}`;
    const lv = levelOf(r);
    rateChip.className = 'rate' + (lv === 'ok' ? '' : ` ${lv}`);
    rateChip.title = `GitHub 每小时 5000 次请求，还剩 ${r.remaining} 次`;
  };

  const updatePager = (): void => {
    clear(pager);
    pager.append(
      el('button', {
        class: 'btn ghost small',
        type: 'button',
        disabled: state.page <= 1,
        onclick: () => {
          state.page = Math.max(1, state.page - 1);
          void loadRepos();
        },
      }, '上一页'),
      el('span', { class: 'small faint' }, `第 ${state.page} 页`),
      el('button', {
        class: 'btn ghost small',
        type: 'button',
        disabled: state.repos.length < 30,
        onclick: () => {
          state.page += 1;
          void loadRepos();
        },
      }, '下一页'),
    );
  };

  let loading = true;

  const skeletons = (): void => {
    clear(repoList.node);
    for (let i = 0; i < 4; i += 1) {
      repoList.node.append(
        el('div', { class: 'row', style: 'animation:none' },
          el('div', { class: 'grow' },
            el('div', { class: 'skeleton', style: 'width:38%;height:13px;margin-bottom:8px' }),
            el('div', { class: 'skeleton', style: 'width:22%;height:11px' }),
          ),
        ),
      );
    }
  };

  const renderList = (): void => {
    if (loading) {
      skeletons();
      updatePager();
      return;
    }
    startCard.classList.toggle('hide', state.repos.length > 0);
    const kw = state.search.trim().toLowerCase();
    const filtered = state.repos.filter((r) => {
      if (state.filter === 'public' && r.private) return false;
      if (state.filter === 'private' && !r.private) return false;
      if (kw && !r.name.toLowerCase().includes(kw)) return false;
      return true;
    });
    if (filtered.length === 0) {
      clear(repoList.node);
      const isFirst = state.repos.length === 0;
      repoList.node.append(
        el('div', { class: 'empty-state' },
          el('div', { class: 'ico' }, icon(isFirst ? 'inbox' : 'search', 28)),
          el('p', {}, isFirst
            ? '你还没有仓库，先建一个吧，名字随便起。'
            : '没有匹配的仓库，换个关键词试试。'),
          isFirst
            ? el('button', {
                class: 'btn small',
                type: 'button',
                onclick: () => newRepoBtn.click(),
              }, '新建第一个仓库')
            : null,
        ),
      );
      updatePager();
      return;
    }
    repoList.render(filtered);
    updatePager();
  };

  const loadRepos = async (): Promise<void> => {
    banner.hide();
    loading = true;
    renderList();
    try {
      const { data, rate } = await ghFetch<Repo[]>(
        `/user/repos?per_page=30&page=${state.page}&sort=updated&affiliation=owner`,
        { token },
      );
      setRate(rate);
      state.repos = data;
      loading = false;
      renderRate();
      renderList();
    } catch (e) {
      loading = false;
      if (e instanceof GhError) {
        if (e.status === 401) {
          clearToken();
          go('auth');
          return;
        }
        banner.show(e.status === 403 ? `请求频率超限，请在 ${resetIn(e.reset)} 重试` : e.message);
      } else {
        banner.show('网络异常，请检查网络后重试');
      }
      renderList();
    }
  };

  searchInput.addEventListener('input', () => {
    state.search = searchInput.value;
    renderList();
  });
  filterSelect.addEventListener('change', () => {
    state.filter = filterSelect.value as typeof state.filter;
    renderList();
  });

  newRepoBtn.addEventListener('click', () => {
    dialog.classList.remove('hide');
    const nameInput = el('input', {
      type: 'text',
      placeholder: 'my-site',
      'aria-label': '仓库名',
    });
    const descInput = el('input', {
      type: 'text',
      placeholder: '可选，比如：我的作品集',
      'aria-label': '仓库描述',
    });
    const localBanner = createBanner();
    const createBtn = el('button', { class: 'btn small', type: 'button' }, '创建并继续');

    createBtn.addEventListener('click', async () => {
      const check = checkRepoName(nameInput.value);
      if (!check.ok) {
        localBanner.show(check.message ?? '仓库名不合法');
        return;
      }
      createBtn.disabled = true;
      createBtn.textContent = '创建中…';
      try {
        const { data } = await ghFetch<Repo>('/user/repos', {
          method: 'POST',
          token,
          body: {
            name: nameInput.value.trim(),
            description: descInput.value.trim() || '由 PageDrop 部署的静态站点',
            private: false,
            auto_init: true,
          },
        });
        state.selectedRepo = data;
        go('deploy');
      } catch (e) {
        localBanner.show(e instanceof GhError ? e.message : '网络异常，请稍后重试');
        createBtn.disabled = false;
        createBtn.textContent = '创建并继续';
      }
    });

    dialog.replaceChildren(
      el('h3', {}, '新建仓库'),
      localBanner.node,
      el('label', { class: 'field', style: 'margin-top:12px' },
        el('span', {}, '仓库名'), nameInput),
      el('label', { class: 'field' }, el('span', {}, '描述（可选）'), descInput),
      el('div', { class: 'row-actions' },
        createBtn,
        el('button', {
          class: 'btn ghost small',
          type: 'button',
          onclick: () => dialog.classList.add('hide'),
        }, '取消'),
      ),
    );
  });

  logoutBtn.addEventListener('click', () => {
    clearToken();
    resetAfterLogout();
    go('auth');
  });

  /* ---------- 新手引导（可跳过，只弹一次） ---------- */
  const TOUR_KEY = 'pagedrop_tour_done';
  const tourSteps = [
    { t: '先有个仓库', d: '仓库就是放网站文件的地方。没有就点「新建仓库」，名字随便起，比如 my-site。' },
    { t: '把东西放进去', d: '选一个 HTML、整个文件夹，或者拖个 zip 进来。解压、提交这些它都会替你做。' },
    { t: '等一分钟', d: '它会帮你开好 GitHub Pages。构建跑完，链接就能直接发给别人。' },
  ];

  const openTour = (): void => {
    let index = 0;
    const content = el('div');
    const dots = el('div', { class: 'tour-dots' });
    const nextBtn = el('button', { class: 'btn small', type: 'button' });
    const skipBtn = el('button', { class: 'btn ghost small', type: 'button' }, '跳过');

    const finish = (): void => {
      backdrop.remove();
      document.body.style.overflow = '';
      try {
        localStorage.setItem(TOUR_KEY, '1');
      } catch {
        /* 忽略 */
      }
    };

    const renderStep = (): void => {
      const s = tourSteps[index];
      clear(content);
      content.append(el('div', { class: 'tour-step on' }, el('h3', {}, s.t), el('p', {}, s.d)));
      clear(dots);
      tourSteps.forEach((_, k) => dots.append(el('i', { class: k === index ? 'on' : '' })));
      nextBtn.textContent = index === tourSteps.length - 1 ? '知道了' : '下一步';
    };

    nextBtn.addEventListener('click', () => {
      if (index < tourSteps.length - 1) {
        index += 1;
        renderStep();
      } else {
        finish();
      }
    });
    skipBtn.addEventListener('click', finish);

    const backdrop = el('div', { class: 'backdrop' },
      el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
        el('div', { class: 'sheet-handle' }),
        el('div', { class: 'small faint', style: 'margin-bottom:10px' }, '新手引导'),
        content,
        dots,
        el('div', { class: 'sheet-actions' }, nextBtn, skipBtn),
      ),
    );
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish();
    });
    document.body.append(backdrop);
    document.body.style.overflow = 'hidden';
    renderStep();
  };

  const tourLink = el('button', { class: 'btn ghost', type: 'button', onclick: openTour }, '看一遍怎么用');

  const startCard = el('div', { class: 'start-card hide' },
    el('h3', {}, '先建一个仓库吧'),
    el('p', {}, '仓库就是放网站文件的地方。名字随便起，比如 my-site，之后它会出现在你的网址里。工具只做脚本安全提示，不对上传内容做合规审核，内容责任由上传者与 GitHub 承担"'),
    el('div', { class: 'row-actions', style: 'justify-content:center' },
      el('button', { class: 'btn', type: 'button', onclick: () => newRepoBtn.click() }, '创建第一个仓库'),
      el('button', { class: 'btn ghost', type: 'button', onclick: openTour }, '看一遍怎么用'),
    ),
    el('p', { class: 'start-hint' }, '已经有仓库的话，直接从下面的列表里挑一个'),
  );

  root.append(
    el('div', { class: 'page' },
      el('div', { class: 'account-bar' },
        user
          ? el('img', { src: user.avatar_url, alt: '' })
          : el('span', { class: 'rate' }, '已登录'),
        el('div', { class: 'who' },
          el('b', {}, user?.login ?? '已登录'),
          el('span', {}, '密钥只留在这个标签页，关掉就没了'),
        ),
        rateChip,
        logoutBtn,
      ),
      banner.node,
      el('h1', { style: 'margin-top:6px;font-size:30px' }, '选个仓库'),
      el('p', { class: 'lede' }, '部署到已有仓库，或者新建一个。'),
      startCard,
      el('div', { class: 'row-actions cta-row', style: 'margin-top:18px' }, newRepoBtn, tourLink),
      dialog,
      el('div', { class: 'list', style: 'margin-top:16px' },
        el('div', { class: 'row' },
          el('div', { class: 'grow' }, searchInput),
          el('div', { style: 'width:120px' }, filterSelect),
        ),
      ),
      el('div', { style: 'margin-top:14px' }, repoList.node),
      pager,
    ),
  );

  renderRate();
  void loadRepos().then(() => {
    let seen = '1';
    try {
      seen = localStorage.getItem(TOUR_KEY) ?? '';
    } catch {
      seen = '';
    }
    if (!seen && state.repos.length === 0) openTour();
    startCard.classList.toggle('hide', !(state.repos.length === 0 && !loading));
  });
}
