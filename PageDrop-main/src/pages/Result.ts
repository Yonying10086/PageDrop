import { fetchDeployStatus, type DeployStatus } from '../api/poll';
import { GhError } from '../api/github';
import { MAX_POLL, POLL_INTERVAL } from '../config';
import { go } from '../router';
import { setRate, state } from '../state';
import { el, copyText } from '../utils/dom';
import { icon } from '../icons';
import { getToken } from '../utils/storage';

export function mount(root: HTMLElement): void {
  const token = getToken();
  const task = state.deployTask;
  if (!token) {
    go('auth');
    return;
  }
  if (!task) {
    go('workspace');
    return;
  }

  let timer: number | null = null;
  let pollCount = 0;
  let netErrors = 0;
  let finished = false;

  const mark = el('span', { class: 'mark' }, '');
  const ring = el('div', { class: 'ring spin' }, mark);
  const title = el('h1', { style: 'font-size:32px' }, '构建中');
  const subtitle = el('p', { class: 'lede' }, '正在等 GitHub 完成第一次构建，通常一分钟左右。');
  const linkBox = el('div', { class: 'card hide' });
  const logBox = el('pre', {
    class: 'mono',
    style:
      'max-height:220px;overflow:auto;background:var(--fill);padding:12px 14px;border-radius:10px;white-space:pre-wrap',
  });

  const stop = (): void => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const log = (line: string): void => {
    const ts = new Date().toLocaleTimeString('zh-CN');
    logBox.textContent = `${logBox.textContent}[${ts}] ${line}\n`;
  };

  const renderSuccess = (siteUrl: string, repoUrl: string): void => {
    finished = true;
    stop();
    ring.className = 'ring ok';
    mark.replaceChildren(icon('check', 30));
    title.textContent = '部署成功';
    subtitle.textContent = '已经可以访问了，链接可以复制发给别人。';
    linkBox.classList.remove('hide');
    linkBox.replaceChildren(
      el('h3', {}, '访问链接'),
      el('p', { class: 'mono', style: 'margin:8px 0 12px;word-break:break-all' }, siteUrl),
      el('div', { class: 'row-actions' },
        el('a', { class: 'btn small', href: siteUrl, target: '_blank', rel: 'noopener' }, '打开'),
        el('button', {
          class: 'btn ghost small',
          type: 'button',
          onclick: async (e: Event) => {
            await copyText(siteUrl);
            const btn = e.currentTarget as HTMLButtonElement;
            btn.textContent = '已复制';
            window.setTimeout(() => {
              btn.textContent = '复制';
            }, 1500);
          },
        }, '复制'),
        el('a', { class: 'btn ghost small', href: repoUrl, target: '_blank', rel: 'noopener' }, '看仓库'),
        el('button', {
          class: 'btn ghost small',
          type: 'button',
          onclick: () => go('domain'),
        }, '绑定域名'),
      ),
    );
  };

  const renderFailure = (reason: string): void => {
    finished = true;
    stop();
    ring.className = 'ring err';
    mark.textContent = '!';
    title.textContent = '部署失败';
    subtitle.textContent = reason;
  };

  const tick = async (): Promise<void> => {
    if (finished) return;
    pollCount += 1;
    try {
      const { status, rate } = await fetchDeployStatus(token, task.owner, task.repo, task.branch);
      setRate(rate);
      netErrors = 0;
      apply(status);
    } catch (e) {
      netErrors += 1;
      if (e instanceof GhError && e.status === 403) {
        renderFailure(`请求频率超限，请稍后刷新页面重试`);
        return;
      }
      if (netErrors >= 3) {
        renderFailure('网络异常，请检查网络后刷新页面');
        return;
      }
      log('网络波动，正在重试');
    }

    if (!finished && pollCount >= MAX_POLL) {
      renderFailure('构建超时，请到仓库的 Actions 页面查看日志');
    }
  };

  const apply = (status: DeployStatus): void => {
    const repoUrl = task.repoUrl ?? `https://github.com/${task.owner}/${task.repo}`;
    const siteUrl =
      status.siteUrl ?? task.siteUrl ?? `https://${task.owner}.github.io/${task.repo}/`;

    log(
      `Actions=${status.actionsStatus}/${status.conclusion ?? '-'} · Pages=${status.pagesStatus ?? '-'}`,
    );

    // workflow 构建时 Pages 的 status 字段可能一直是空的，以 Actions 结论为准
    if (status.conclusion === 'failure') {
      renderFailure('第一次构建失败了，点下面的仓库链接，去 Actions 看报错。');
      return;
    }
    if (status.conclusion === 'success' || status.pagesStatus === 'built') {
      renderSuccess(siteUrl, repoUrl);
      return;
    }
    if (status.pagesStatus === 'errored') {
      renderFailure('Pages 构建出错，去仓库的 Actions 里看日志。');
      return;
    }

    if (status.actionsStatus === 'in_progress' || status.actionsStatus === 'queued') {
      title.textContent = '构建中';
      subtitle.textContent = 'GitHub Actions 正在跑，最多等三分钟。';
      return;
    }

    title.textContent = '等待 Pages 就绪';
    subtitle.textContent = '代码已经提交，等 Pages 完成第一次发布。';
  };

  root.append(
    el('div', { class: 'page narrow center' },
      ring,
      title,
      subtitle,
      linkBox,
      el('div', { class: 'card', style: 'text-align:left;margin-top:24px' },
        el('h3', { style: 'margin-bottom:10px' }, '进度'),
        logBox,
      ),
      el('div', { class: 'row-actions', style: 'justify-content:center;margin-top:22px' },
        el('button', { class: 'btn', type: 'button', onclick: () => go('workspace') }, '再部署一个'),
        el('button', { class: 'btn ghost', type: 'button', onclick: () => go('welcome') }, '回首页'),
        el('button', {
          class: 'btn ghost',
          type: 'button',
          onclick: () => {
            finished = false;
            pollCount = 0;
            netErrors = 0;
            void tick();
          },
        }, '重新检查'),
      ),
    ),
  );

  log(`开始轮询 ${task.owner}/${task.repo}（分支 ${task.branch}）`);
  void tick();
  timer = window.setInterval(() => void tick(), POLL_INTERVAL);
}
