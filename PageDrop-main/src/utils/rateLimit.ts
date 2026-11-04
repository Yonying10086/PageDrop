export interface RateLimitInfo {
  remaining: number;
  limit: number;
  reset: number;
}

export const EMPTY_RATE: RateLimitInfo = { remaining: 0, limit: 0, reset: 0 };

export type RateLevel = 'ok' | 'warn' | 'err';

export function levelOf(info: RateLimitInfo): RateLevel {
  if (info.limit <= 0) return 'ok';
  if (info.remaining < 100) return 'err';
  if (info.remaining < 500) return 'warn';
  return 'ok';
}

export function parseRateLimit(headers: Headers): RateLimitInfo {
  const num = (k: string): number => {
    const v = headers.get(k);
    return v === null ? 0 : Number.parseInt(v, 10) || 0;
  };
  return {
    remaining: num('x-ratelimit-remaining'),
    limit: num('x-ratelimit-limit'),
    reset: num('x-ratelimit-reset'),
  };
}

/** 把 reset 时间戳转成「X 分钟后」 */
export function resetIn(resetSec: number): string {
  if (!resetSec) return '稍后';
  const diff = resetSec * 1000 - Date.now();
  if (diff <= 0) return '现在';
  const min = Math.ceil(diff / 60000);
  return min <= 1 ? '1 分钟内' : `${min} 分钟后`;
}
