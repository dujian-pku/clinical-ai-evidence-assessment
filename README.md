# 医学 AI 研究快速评估

适用于 CJ01 临床决策辅助场景。网页由 GitHub Pages 托管，完整报告由 Sites 报告接口调用 DeepSeek 生成。保留研究填写、确定性评分、真实研究示例、自然段评述、关键内容高亮、草稿保存和 TXT 导出。

## 开发与验证

使用 Node.js 24、pnpm 11.25.0。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

`VITE_REPORT_API_URL` 是报告接口的公开 URL，例如 `https://<worker>.workers.dev/api/report`。`PAGES_BASE_PATH` 是 Pages 项目路径，例如 `/clinical-ai-evidence-assessment/`。两个配置都不包含密钥。

## 报告接口
服务端使用 Sites 托管，无需使用者注册或登录 Cloudflare。入口源码为 `api/worker.ts`，提供 `/api/report` 和 `/health`。执行 `pnpm build:api` 生成独立 Worker ESM 文件，发布时由同项目 `../report-service` 的 Sites 工作目录打包。

服务端秘密变量为 `DEEPSEEK_API_KEY` 和 `REPORT_ACCESS_CODE`。前者仅供服务端调用 DeepSeek，后者由使用者在网页填写，只保存在当前页面内存，不随草稿或 TXT 保存。允许来源 `ALLOWED_ORIGINS` 设为 `https://xuanyshi.github.io`。浏览器只发送填写内容和访问码，不接收 DeepSeek Key。

接口校验来源、访问码、填写内容及请求大小，按单个实例内的 IP 记录限制每分钟 6 次调用。该计数不构成跨实例的全局额度控制；账户费用按 DeepSeek 后台记录管理。

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

本版本从同项目的 Sites 版本迁移，独立维护 GitHub Pages 前端和 Sites 接口。原 Sites 地址在迁移期间保持可用。
