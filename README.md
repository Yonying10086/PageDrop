# PageDrop

填一串 GitHub 密钥，选个网页，几秒后拿到网址。

一个**纯静态**的 GitHub Pages 一键部署器：没有后端、没有数据库、没有账号体系。所有操作都在浏览器里直接和 `api.github.com` 通信，密钥只存在当前标签页的 `sessionStorage` 里，关掉就失效。

## 它能做什么

- 支持三种上传方式：单个 HTML、整个文件夹、zip 压缩包（浏览器内解压）
- 自动建仓 → 用 Git Data API 批量提交 → 写入 GitHub Actions 工作流 → 开启 Pages
- 部署后轮询 Actions 与 Pages 状态，成功后直接给出访问链接
- 基础安全扫描：`eval`、`new Function`、`document.write`、外链脚本、iframe、已知恶意域名/挖矿脚本
- zip 解压做路径穿越（Zip Slip）、体积、压缩比（Zip Bomb）校验

## 技术栈

Vite 5 + TypeScript + 原生 DOM（无框架）；JSZip 通过 `import()` 动态加载，只在选 zip 时才下载。

构建产物（gzip）：首屏约 16 KB，JSZip 单独 30 KB，总计远低于 250 KB。

## 本地开发

```bash
npm install
npm run build      # 类型检查 + 打包
npm run preview    # 预览 dist
npm run dev        # 开发服务器
```

## 目录

```
src/
├── main.ts          # 入口：导航、路由挂载
├── router.ts        # hash 路由 + token 守卫
├── config.ts        # 常量、限制、scope
├── api/             # github / auth / deploy / poll
├── pages/           # Welcome / Auth / Workspace / Deploy / Result / Help
├── components/      # TokenInput / RepoList / FileTree / ScanResult / ProgressSteps / ErrorBanner
├── utils/           # storage / zip / scan / validate / rateLimit / dom
└── styles/
```

## 安全说明

- 密钥仅存 `sessionStorage`，不进 `localStorage`、不进 cookie、不进 URL
- CSP 锁死：`script-src 'self'`、`connect-src 'self' https://api.github.com`、禁止被 iframe 嵌入
- 只请求 `repo` 与 `workflow` 两个 scope，不碰 `delete_repo`、`admin:org`

## 已知限制
- 单文件上限 50 MB，文件数上限 500，总大小上限 50 MB
- 部署记录只存在内存里，刷新即丢；没有跨设备同步
- 文件夹上传在移动端浏览器不可用（浏览器限制），手机上请用单个 HTML 或 zip

## 许可证

MIT
