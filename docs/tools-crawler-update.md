# tools.html 工具库自动更新方案

## 1. 目标
- 让 `/Users/apple/Desktop/AIedu2/tools.html` 不再手工维护卡片。
- 工具数据统一由 `/Users/apple/Desktop/AIedu2/data/tools-data.json` 提供。
- 后续通过定时爬虫更新原始数据，再由标准化脚本生成最终工具库数据。

## 2. 当前已落地的代码结构
- 页面渲染脚本：`/Users/apple/Desktop/AIedu2/scripts/tools-page.js`
- 页面数据源：`/Users/apple/Desktop/AIedu2/data/tools-data.json`
- 原始抓取样例：`/Users/apple/Desktop/AIedu2/data/crawler-snapshots/raw-tools.sample.json`
- 标准化脚本：`/Users/apple/Desktop/AIedu2/scripts/update-tools-data.mjs`
- 爬虫源配置示例：`/Users/apple/Desktop/AIedu2/scripts/crawler-config.json`

## 3. 数据流
1. 定时爬虫抓取第三方工具站点/API，输出原始快照 JSON。
2. 将原始快照写入 `data/crawler-snapshots/raw-tools.<date>.json`。
3. 执行标准化脚本，完成字段统一、去重、评分与排序。
4. 生成 `data/tools-data.json`。
5. 前端页面下次加载时自动读取新数据并展示。

## 4. 标准化脚本能力
`update-tools-data.mjs` 已包含：
- 字段归一化（分类、费用模型、教学阶段）
- ID 生成（slug）
- 去重（优先保留综合分更高的记录）
- 教育适配评分（`educationScore` + 分项得分）
- 自动分类字段（`classification`）
- 统一输出 schema（`schemaVersion / updatedAt / tools[]`）

执行命令：

```bash
node /Users/apple/Desktop/AIedu2/scripts/update-tools-data.mjs \
  --input /Users/apple/Desktop/AIedu2/data/crawler-snapshots/raw-tools.sample.json \
  --output /Users/apple/Desktop/AIedu2/data/tools-data.json
```

## 4.1 一次性测试（建议先跑）
### 冒烟测试（不访问外网）
```bash
node /Users/apple/Desktop/AIedu2/scripts/run-crawler.mjs \
  --use-mock \
  --output /Users/apple/Desktop/AIedu2/data/crawler-snapshots/raw-tools.latest.json

node /Users/apple/Desktop/AIedu2/scripts/update-tools-data.mjs \
  --input /Users/apple/Desktop/AIedu2/data/crawler-snapshots/raw-tools.latest.json \
  --output /Users/apple/Desktop/AIedu2/data/tools-data.json
```

### 真实抓取测试（访问你配置的真实来源）
先修改 `/Users/apple/Desktop/AIedu2/scripts/crawler-config.json` 为真实 URL，再执行：
```bash
node /Users/apple/Desktop/AIedu2/scripts/run-crawler.mjs \
  --config /Users/apple/Desktop/AIedu2/scripts/crawler-config.json \
  --output /Users/apple/Desktop/AIedu2/data/crawler-snapshots/raw-tools.latest.json

node /Users/apple/Desktop/AIedu2/scripts/update-tools-data.mjs \
  --input /Users/apple/Desktop/AIedu2/data/crawler-snapshots/raw-tools.latest.json \
  --output /Users/apple/Desktop/AIedu2/data/tools-data.json
```

最后本地预览：
```bash
cd /Users/apple/Desktop/AIedu2
python3 -m http.server 5500
```
打开 `http://localhost:5500/tools.html`。

## 5. 建议的定时更新方式

### 方案 A：GitHub Actions（推荐）
- 每天定时触发 workflow（例如北京时间每天 06:30）
- Steps:
  1. 运行爬虫脚本（Python/Node 均可）生成 raw JSON
  2. 运行 `update-tools-data.mjs`
  3. 自动提交 `data/tools-data.json` 变更

### 方案 B：服务器 Cron
- 在你的部署机上设置 cron：

```bash
30 6 * * * /usr/bin/node /path/to/project/scripts/run-crawler.mjs && /usr/bin/node /path/to/project/scripts/update-tools-data.mjs --input /path/to/project/data/crawler-snapshots/raw-tools.latest.json --output /path/to/project/data/tools-data.json
```

## 6. 后续需要你补齐的部分
- 真实爬虫实现（`run-crawler.mjs` 或 Python 版本）
  - API 源：直接请求 JSON
  - HTML 源：用 Playwright/Cheerio 抽取
  - RSS 源：解析 feed
- 数据质量规则
  - 工具名最短长度
  - 无效 URL 过滤
  - 重复条目阈值
- 合规策略
  - 尊重目标站点 robots 与 ToS
  - 添加访问速率限制与重试

## 7. 前端侧已具备的更新能力
`tools.html` 现在是纯数据驱动：
- 顶部搜索、左侧筛选、排序、分页均基于 `tools-data.json`
- 数据文件更新后无需改页面代码

## 7.1 新增评分与分类字段
每条工具会新增：
- `educationScore`：0-100 总分
- `educationTier`：`education-core | education-adaptable | excluded`
- `educationScoreBreakdown`：分项得分（关键词、案例信号、场景适配、阶段适配、质量、来源先验）
- `classification`：
  - `category`（5大类之一）
  - `categoryLabel`
  - `teachingLevels`（小学/中学/高教映射）
  - `categoryConfidence`（自动分类置信度）

## 8. 回滚方案
如抓取异常导致坏数据：
1. 回退 `data/tools-data.json` 到上一版本
2. 重新部署静态站点
3. 修复爬虫/标准化规则后再重跑

- 筛选规则文档：`/Users/apple/Desktop/AIedu2/docs/education-filtering-rules.md`
