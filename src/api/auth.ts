import type { RateLimitInfo } from '../utils/rateLimit';
import type { GhUser } from '../utils/storage';
import { ghFetch } from './github';

export interface VerifyResult {
  user: GhUser;
  rate: RateLimitInfo;
}

/** 用 token 换用户信息，顺便把 rate limit 带回来 */
export async function verifyToken(token: string): Promise<VerifyResult> {
  const { data, rate } = await ghFetch<{
    login: string;
    avatar_url: string;
    name: string | null;
  }>('/user', { token });

  return {
    user: {
      login: data.login,
      avatar_url: data.avatar_url,
      name: data.name ?? null,
    },
    rate,
  };
}
