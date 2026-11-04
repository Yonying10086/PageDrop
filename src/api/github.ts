import { API_BASE, API_VERSION } from '../config';
import { parseRateLimit, resetIn, type RateLimitInfo } from '../utils/rateLimit';

export class GhError extends Error {
  readonly status: number;
  readonly ghMessage: string;
  readonly reset: number;

  constructor(status: number, message: string, ghMessage = '', reset = 0) {
    super(message);
    this.name = 'GhError';
    this.status = status;
    this.ghMessage = ghMessage;
    this.reset = reset;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token: string;
}

export interface ApiResult<T> {
  data: T;
  rate: RateLimitInfo;
}

/** 统一封装：请求头、错误映射、rate limit 解析 */
export async function ghFetch<T>(path: string, opts: RequestOptions): Promise<ApiResult<T>> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new GhError(0, '网络异常，请检查网络后重试');
  }

  const rate = parseRateLimit(res.headers);
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const ghMessage =
      parsed && typeof parsed === 'object' && 'message' in (parsed as Record<string, unknown>)
        ? String((parsed as Record<string, unknown>).message)
        : '';
    throw new GhError(res.status, mapError(res.status, ghMessage, rate), ghMessage, rate.reset);
  }

  return { data: (parsed ?? {}) as T, rate };
}

export function mapError(status: number, ghMessage: string, rate: RateLimitInfo): string {
  switch (status) {
    case 0:
      return '网络异常，请检查网络后重试';
    case 401:
      return '密钥无效或已过期，请重新填写';
    case 403:
      if (rate.remaining === 0 || /rate limit/i.test(ghMessage)) {
        return `请求频率超限，请在 ${resetIn(rate.reset)} 重试`;
      }
      return '密钥权限不足，请确认已勾选 repo 与 workflow';
    case 404:
      return '目标不存在，请返回工作台重新选择';
    case 409:
      return '该资源已存在，无需重复创建';
    case 413:
      return '文件超过 GitHub 单文件限制，请先移除超大文件';
    case 422:
      return ghMessage ? `请求参数有误：${ghMessage}` : '请求参数有误';
    default:
      if (status >= 500) return 'GitHub 服务暂时不可用，请稍后重试';
      return ghMessage || `请求失败（${status}）`;
  }
}
