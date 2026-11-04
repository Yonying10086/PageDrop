export const API_BASE = 'https://api.github.com';
export const API_VERSION = '2022-11-28';

/** sessionStorage 键名 */
export const KEY_TOKEN = 'pagedrop_token';
export const KEY_USER = 'pagedrop_user';

/** 上传限制 */
export const LIMITS = {
  maxTotalBytes: 50 * 1024 * 1024,
  maxFileBytes: 50 * 1024 * 1024,
  maxFiles: 500,
  maxZipRatio: 100,
  /** GitHub Contents API 单文件上限约 100MB，这里保守取 900KB 走 blobs 更稳 */
  blobChunkBytes: 50 * 1024 * 1024,
} as const;

/** 需要用户勾选的权限 */
export const SCOPES = [
  { name: 'repo', desc: '读写仓库' },
  { name: 'workflow', desc: '写入 GitHub Actions 配置' },
] as const;

/** 部署步骤（用于进度条） */
export const DEPLOY_STEPS = ['建仓', '上传文件', '写入工作流', '开启 Pages'] as const;

export const MAX_POLL = 60;
export const POLL_INTERVAL = 3000;
