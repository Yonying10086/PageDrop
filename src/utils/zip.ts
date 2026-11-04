import { LIMITS } from '../config';
import { checkPath } from './validate';

export interface ArchiveEntry {
  path: string;
  bytes: Uint8Array;
  text: string;
}

export interface ZipResult {
  ok: boolean;
  entries: ArchiveEntry[];
  error?: string;
}

const TEXT_EXT = new Set([
  'html', 'htm', 'css', 'js', 'mjs', 'json', 'svg', 'txt', 'md', 'yml', 'yaml', 'xml', 'map',
]);

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

function isTextFile(path: string): boolean {
  const i = path.lastIndexOf('.');
  if (i < 0) return false;
  return TEXT_EXT.has(path.slice(i + 1).toLowerCase());
}

/** 读 zip：动态加载 JSZip，做路径穿越 / 体积 / 压缩比校验 */
export async function readZip(file: File): Promise<ZipResult> {
  let zip: import('jszip');
  try {
    const mod = await import('jszip');
    zip = mod.default;
  } catch {
    return { ok: false, entries: [], error: '解压组件加载失败，请刷新页面重试' };
  }

  let archive: import('jszip');
  try {
    archive = await zip.loadAsync(await file.arrayBuffer(), { createFolders: false });
  } catch {
    return { ok: false, entries: [], error: '压缩包无法解析，可能已损坏' };
  }

  const entries: ArchiveEntry[] = [];
  let total = 0;
  let rawTotal = 0;

  for (const [name, entry] of Object.entries(archive.files)) {
    if (entry.dir) continue;

    const path = sanitize(name);
    const pathCheck = checkPath(path);
    if (!pathCheck.ok) {
      return { ok: false, entries: [], error: pathCheck.message ?? '压缩包内含非法路径' };
    }

    const bytes = await entry.async('uint8array');
    const declared = (entry as unknown as { _data?: { uncompressedSize?: number } })._data
      ?.uncompressedSize;
    rawTotal += typeof declared === 'number' ? declared : bytes.length;

    total += bytes.length;
    if (bytes.length > LIMITS.maxFileBytes) {
      return { ok: false, entries: [], error: `文件 ${path} 超过 50 MB，无法部署` };
    }
    if (entries.length >= LIMITS.maxFiles) {
      return { ok: false, entries: [], error: `文件数超过上限 ${LIMITS.maxFiles}` };
    }
    if (total > LIMITS.maxTotalBytes) {
      return { ok: false, entries: [], error: '解压后总大小超过 50 MB' };
    }

    entries.push({ path, bytes, text: isTextFile(path) ? decodeText(bytes) : '' });
  }

  const ratio = total / Math.max(1, file.size);
  if (ratio > LIMITS.maxZipRatio) {
    return { ok: false, entries: [], error: `压缩比 ${ratio.toFixed(0)}:1 异常，已拒绝` };
  }
  if (rawTotal > LIMITS.maxTotalBytes * 2) {
    return { ok: false, entries: [], error: '解压后体积异常，已拒绝' };
  }

  return { ok: true, entries };
}

/** 去掉 macOS 打包垃圾、统一分隔符 */
export function sanitize(name: string): string {
  return name
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^__MACOSX\//, '')
    .replace(/^\.DS_Store$/i, '')
    .trim();
}
