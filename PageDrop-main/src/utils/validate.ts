import { LIMITS } from '../config';

const TOKEN_PREFIX = /^(ghp_|github_pat_)/;
const REPO_NAME = /^[a-zA-Z0-9._-]{1,100}$/;

export interface CheckResult {
  ok: boolean;
  message?: string;
}

export function checkToken(raw: string): CheckResult {
  const token = raw.trim();
  if (token.length === 0) return { ok: false, message: '请先填写密钥' };
  if (token.length < 10) return { ok: false, message: '密钥格式不正确' };
  if (!TOKEN_PREFIX.test(token)) {
    return { ok: false, message: '密钥应以 ghp_ 或 github_pat_ 开头，请确认复制完整' };
  }
  return { ok: true };
}

export function checkRepoName(name: string): CheckResult {
  const v = name.trim();
  if (v.length === 0) return { ok: false, message: '仓库名不能为空' };
  if (!REPO_NAME.test(v)) {
    return { ok: false, message: '仓库名只能用字母、数字、点、下划线、短横线，长度 1-100' };
  }
  if (v === '.' || v === '..') return { ok: false, message: '仓库名不合法' };
  return { ok: true };
}

/** 路径安全检查：拒绝 ..、绝对路径、反斜杠、控制字符 */
export function checkPath(path: string): CheckResult {
  if (path.length === 0) return { ok: false, message: '文件路径为空' };
  if (path.includes('\\')) return { ok: false, message: `路径包含反斜杠：${path}` };
  if (path.startsWith('/')) return { ok: false, message: `不支持绝对路径：${path}` };
  if (path.split('/').includes('..')) return { ok: false, message: `路径包含 ..，已拒绝：${path}` };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(path)) return { ok: false, message: `路径含控制字符：${path}` };
  if (path.length > 400) return { ok: false, message: `路径过长：${path.slice(0, 40)}…` };
  return { ok: true };
}

export interface SizeState {
  count: number;
  total: number;
}

export function checkSize(state: SizeState): CheckResult {
  if (state.count > LIMITS.maxFiles) {
    return { ok: false, message: `文件数 ${state.count} 超过上限 ${LIMITS.maxFiles}` };
  }
  if (state.total > LIMITS.maxTotalBytes) {
    return { ok: false, message: `总大小超过上限 50 MB` };
  }
  return { ok: true };
}
