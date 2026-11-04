import { KEY_TOKEN, KEY_USER } from '../config';

export interface GhUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export function getToken(): string | null {
  try {
    const v = sessionStorage.getItem(KEY_TOKEN);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(KEY_TOKEN, token);
  } catch {
    /* 隐私模式下可能失败，忽略 */
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(KEY_TOKEN);
    sessionStorage.removeItem(KEY_USER);
  } catch {
    /* 忽略 */
  }
}

export function getUser(): GhUser | null {
  try {
    const raw = sessionStorage.getItem(KEY_USER);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GhUser;
    if (!parsed || typeof parsed.login !== 'string') return null;
    return parsed;
  } catch {
    try {
      sessionStorage.removeItem(KEY_USER);
    } catch {
      /* 忽略 */
    }
    return null;
  }
}

export function setUser(user: GhUser): void {
  try {
    sessionStorage.setItem(KEY_USER, JSON.stringify(user));
  } catch {
    /* 忽略 */
  }
}
