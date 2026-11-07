# 医学 AI 研究快速评估

适用于 CJ01 临床决策辅助场景。网页静态版本由 GitHub Pages 托管。面向中国大陆访问的正式服务器尚待确定，完整报告接口暂未接入。保留研究填写、确定性评分、真实研究示例、自然段评述、关键内容高亮、草稿保存和 TXT 导出。

[在线工具](https://dujian-pku.github.io/clinical-ai-evidence-assessment/) · [GitHub 仓库](https://github.com/dujian-pku/clinical-ai-evidence-assessment)

## 开发与验证

使用 Node.js 24、pnpm 11.25.0。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

`VITE_REPORT_API_URL` 是报告接口的公开 URL，例如 `https://example.org/api/report`。`PAGES_BASE_PATH` 是 Pages 项目路径，例如 `/clinical-ai-evidence-assessment/`。两个配置都不包含密钥。

## 服务器部署
面向国内使用，可以把网页与报告接口部署到同一台 Linux 服务器；也可以保留 GitHub Pages 网页，单独部署接口。当前不使用 Sites 或用户自有 Cloudflare 服务。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build:server
cp deploy/environment.example .env.production
# 由服务器管理员填写 .env.production 中的秘密变量和网页来源。
pnpm start
```

需要 Node.js 24。默认在 127.0.0.1:3000 提供网页和接口，正式使用由服务器反向代理提供 HTTPS。应用入口为 `scripts/start-server.mjs`。页面通过同源 `/api/report` 调用服务，`/health` 可检查进程状态。若只部署接口，可跳过 `build:server`，并把 GitHub Actions 变量 `REPORT_API_URL` 设为服务器的完整 HTTPS 接口地址。

秘密变量为 `DEEPSEEK_API_KEY` 和 `REPORT_ACCESS_CODE`。前者仅供服务端调用 DeepSeek，后者由使用者在网页填写，只保存在当前页面内存，不随草稿或 TXT 保存。`ALLOWED_ORIGINS` 填入网页的实际来源，例如 `https://dujian-pku.github.io` 或部署后的域名；多个来源使用英文逗号分隔。

接口校验来源、访问码、填写内容及请求大小，按单个实例内的连接 IP 记录限制每分钟 6 次调用。反向代理部署时，此计数按代理连接统计；更多并发需求可在反向代理层配置按访客 IP 的限流。账户费用按 DeepSeek 后台记录管理。

## GitHub Pages

1. 将本目录作为独立仓库推送到 `main`。
2. 在仓库 Settings → Pages 中将 Source 设置为 GitHub Actions。
3. 设置 Actions 仓库变量 `REPORT_API_URL`，填入 报告服务的完整 `/api/report` 地址。
4. 运行 `Deploy GitHub Pages` 工作流。它会测试、构建并发布 `dist/`。

工作流只上传静态构建产物。原始 Excel、讨论记录、API 密钥和访问码均不随源码或网页发布。修改接口地址后重新运行工作流。

## 评分与报告

- 证据完整性是已报告维度的权重之和，满分 5。不适用项不重新分配权重。
- 模型效果按综合评价、主要性能数值乘 5、患者报告结局三项平均。
- 改善 5 分、等效 3 分、劣势 0 分。综合评价和患者报告结局未报告计 3 分，性能未报告计 0 分；未报告与等效的含义不同。
- 不合并总分，不设置高价值阈值。
- 真实示例为口咽癌包膜外侵犯预测（PMID:37087370）和颅内出血 CT 辅助诊断（PMID:37029272），出处和提取范围见页面及 `lib/research-examples.ts`。
- 完整报告沿用 DeepSeek Flash 思考模式。服务端仅返回最终正文与高亮，正文约 500–800 汉字，通常 4–5 段。

本版本从同项目原网页迁移。源码不依赖 Sites；Node.js 服务可部署到单位服务器或云服务器。GitHub Pages 静态发布成功不代表完整报告接口已经上线。
