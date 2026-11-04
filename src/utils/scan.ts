export type ScanLevel = 'warn' | 'reject';

export interface ScanHit {
  file: string;
  line: number;
  rule: string;
  level: ScanLevel;
  message: string;
}

export interface ScanSummary {
  files: number;
  hits: ScanHit[];
  warnings: number;
  rejects: number;
}

/** 已知恶意域名黑名单（静态维护，够用即可） */
const BLACKLIST = [
  'coinhive.com',
  'coin-hive.com',
  'cryptoloot.pro',
  'webminepool.com',
  'authedmine.com',
  'minero.cc',
  'jsecoin.com',
  'moneropool.com',
  'crypto-loot.com',
  'deepMiner.js',
  'projectpoi.com',
  'webmine.cz',
  'minexmr.com',
  'nerohut.com',
  'coinimp.com',
  'cryptonight.wasm',
  'cryptonight.js',
  'monero-miner.com',
  'cpufan.club',
  'hashvault.pro',
];

const CDN_ALLOWLIST = ['cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com'];

interface Rule {
  id: string;
  level: ScanLevel;
  message: string;
  /** 只对这些扩展名生效 */
  exts?: string[];
  test: (text: string) => boolean;
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}

const RULES: Rule[] = [
  {
    id: 'R01',
    level: 'warn',
    message: '检测到 eval 调用，可能存在安全风险',
    test: (t) => /eval\s*\(/.test(t),
  },
  {
    id: 'R02',
    level: 'warn',
    message: '检测到动态函数构造，可能存在安全风险',
    test: (t) => /new\s+Function\s*\(/.test(t),
  },
  {
    id: 'R03',
    level: 'warn',
    message: '检测到 document.write，可能影响页面渲染',
    test: (t) => /document\.write\s*\(/.test(t),
  },
  {
    id: 'R04',
    level: 'warn',
    message: '检测到 iframe 嵌入，请确认来源可信',
    exts: ['html', 'htm'],
    test: (t) => /<iframe/i.test(t),
  },
  {
    id: 'R05',
    level: 'warn',
    message: '检测到外部脚本地址，请确认来源可信',
    exts: ['html', 'htm'],
    test: (t) => {
      const re = /<script[^>]+src\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null) {
        const host = safeHost(m[1]);
        if (host && !CDN_ALLOWLIST.some((d) => host === d || host.endsWith(`.${d}`))) return true;
      }
      return false;
    },
  },
  {
    id: 'R06',
    level: 'warn',
    message: '检测到跳转外部地址，请确认目标可信',
    test: (t) => /window\.location\s*=\s*["']https?:\/\//.test(t),
  },
  {
    id: 'R07',
    level: 'reject',
    message: '检测到疑似挖矿脚本，已阻止部署',
    test: (t) => /coinhive|cryptonight|cryptoloot|crypto-loot/i.test(t),
  },
  {
    id: 'R08',
    level: 'reject',
    message: '检测到已知恶意域名引用，已阻止部署',
    test: (t) => BLACKLIST.some((d) => t.toLowerCase().includes(d.toLowerCase())),
  },
];

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function extOf(path: string): string {
  const i = path.lastIndexOf('.');
  return i < 0 ? '' : path.slice(i + 1).toLowerCase();
}

export interface ScannableFile {
  path: string;
  text: string;
}

export function scanFiles(files: ScannableFile[]): ScanSummary {
  const hits: ScanHit[] = [];
  for (const f of files) {
    const ext = extOf(f.path);
    if (!['html', 'htm', 'js', 'mjs', 'svg'].includes(ext)) continue;
    for (const rule of RULES) {
      if (rule.exts && !rule.exts.includes(ext)) continue;
      const idx = firstMatchIndex(rule, f.text);
      if (idx < 0) continue;
      hits.push({
        file: f.path,
        line: lineOf(f.text, idx),
        rule: rule.id,
        level: rule.level,
        message: rule.message,
      });
    }
  }
  return {
    files: files.length,
    hits,
    warnings: hits.filter((h) => h.level === 'warn').length,
    rejects: hits.filter((h) => h.level === 'reject').length,
  };
}

function firstMatchIndex(rule: Rule, text: string): number {
  if (rule.id === 'R05' || rule.id === 'R08') {
    return rule.test(text) ? Math.max(0, text.search(/<script/i)) : -1;
  }
  if (rule.id === 'R07' && rule.test(text)) {
    const m = /coinhive|cryptonight|cryptoloot|crypto-loot/i.exec(text);
    return m ? m.index : 0;
  }
  const m = rule.test(text) ? 0 : -1;
  if (m < 0) return -1;
  // 对简单正则，尽量给出准确行号
  const patterns: Record<string, RegExp> = {
    R01: /eval\s*\(/,
    R02: /new\s+Function\s*\(/,
    R03: /document\.write\s*\(/,
    R04: /<iframe/i,
    R06: /window\.location\s*=\s*["']https?:\/\//,
  };
  const re = patterns[rule.id];
  if (!re) return 0;
  const hit = re.exec(text);
  return hit ? hit.index : 0;
}
