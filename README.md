# 医学 AI 研究快速评估

适用于临床决策辅助场景，当前为项目汇报演示版，由 GitHub Pages 托管。默认载入颅内出血研究；点击“生成评估报告”后显示约 5 秒加载状态，再展示此前由 DeepSeek 生成的完整报告。可切换至口咽癌研究查看对应报告。页面与 TXT 均标注“演示报告 · DeepSeek 预先生成”，时间表示本次展示时间。

演示过程无需访问码或 API 密钥，不调用在线报告接口。完整报告与保存的研究输入逐项匹配；修改研究内容后可使用简版报告，重新载入原始示例可继续演示完整报告。填写内容变更时取消正在等待的演示，防止旧报告覆盖新记录。保留确定性评分、重点高亮、草稿保存和 TXT 导出。报告来源见 [演示报告说明](docs/demo-reports.md)。

[在线工具](https://dujian-pku.github.io/clinical-ai-evidence-assessment/) · [GitHub 仓库](https://github.com/dujian-pku/clinical-ai-evidence-assessment)

页面采用黑白配色、直角边框和紧凑布局。桌面宽屏的基本信息按三列排列；输入字号为 19 px，报告正文为 20 px，重点内容使用灰底加粗与下划线。

页眉仅展示北京大学、北京大学医学部、北京大学健康医疗大数据国家研究院的彩色图形标识，不展示标识旁的名称文字，来源见 [标识资源说明](docs/branding.md)。面向项目汇报，页面与导出报告使用完整场景名称。

## 开发与验证

使用 Node.js 24、pnpm 11.25.0。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

`PAGES_BASE_PATH` 是 Pages 项目路径，例如 `/clinical-ai-evidence-assessment/`。演示版前端不使用报告接口配置。

## 服务器部署
仓库保留独立 Node.js 报告接口，供后续接入。当前演示页面不调用该接口，也不需要服务器。以下命令可部署同源静态页面与接口；启用在线生成时需要另行连接前端交互。当前不使用 Sites 或用户自有 Cloudflare 服务。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build:server
cp deploy/environment.example .env.production
# 由服务器管理员填写 .env.production 中的秘密变量和网页来源。
pnpm start
```

需要 Node.js 24。默认在 127.0.0.1:3000 提供网页和接口，正式使用由服务器反向代理提供 HTTPS。应用入口为 `scripts/start-server.mjs`。接口路径为 `/api/report`，`/health` 可检查进程状态；静态演示页面保持本地展示模式。

保留接口的秘密变量为 `DEEPSEEK_API_KEY` 和 `REPORT_ACCESS_CODE`。前者仅供服务端调用 DeepSeek，后者作为接口请求的访问凭证；当前演示页面不读取或使用这些变量。`ALLOWED_ORIGINS` 填入允许调用接口的来源；多个来源使用英文逗号分隔。

接口校验来源、访问码、填写内容及请求大小，按单个实例内的连接 IP 记录限制每分钟 6 次调用。反向代理部署时，此计数按代理连接统计；更多并发需求可在反向代理层配置按访客 IP 的限流。账户费用按 DeepSeek 后台记录管理。

## GitHub Pages

1. 将本目录作为独立仓库推送到 `main`。
2. 在仓库 Settings → Pages 中将 Source 设置为 GitHub Actions。
3. 运行 `Deploy GitHub Pages` 工作流。它会测试、构建并发布 `dist/`。

工作流只上传静态构建产物，包括两项示例的预生成报告。原始 Excel、讨论记录、API 密钥和访问码均不随源码或网页发布。

## 评分与报告

- 证据完整性是已报告维度的权重之和，满分 5。不适用项不重新分配权重。
- 模型效果按综合评价、主要性能数值乘 5、患者报告结局三项平均。
- 改善 5 分、等效 3 分、劣势 0 分。综合评价和患者报告结局未报告计 3 分，性能未报告计 0 分；未报告与等效的含义不同。
- 不合并总分，不设置高价值阈值。
- 真实示例为口咽癌包膜外侵犯预测（PMID:37087370）和颅内出血 CT 辅助诊断（PMID:37029272），出处和提取范围见页面及 `lib/research-examples.ts`。
- 演示报告沿用此前保存的 DeepSeek 正文，两项研究各为 4 个自然段，分别保留 4 处和 5 处高亮。报告与其输入快照存放在 `lib/demo-reports.json`。

本版本从同项目原网页迁移，源码不依赖 Sites。当前报告演示完全由静态页面完成。
