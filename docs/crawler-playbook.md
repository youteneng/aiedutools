# 教育 AI 工具爬虫规则与操作手册（更新版）

最后更新：2026-03-22
适用项目：`/Users/apple/Desktop/AIedu2`

## 1. 目标与总原则
本项目爬虫采用“稳定优先 + 教育适配 + 历史留存”的发布策略：
1. 多来源抓取（分层优先级）
2. 教育准入与评分过滤
3. 新旧数据合并发布（旧工具保留，新工具加入）

核心目标：
- 页面持续有可用工具，不因单次抓取波动而大幅清空
- 优先展示教育相关工具，同时保留“可教育化”的高适配通用工具
- 工具卡片文案保持产品化描述，不展示“抓取结果”类占位文案

---

## 2. 当前数据流（端到端）

### Step 1：抓取
脚本：`scripts/run-crawler.mjs`
输入：`scripts/crawler-config.json`
输出：`data/crawler-snapshots/raw-tools.latest.json`

职责：
- 按站点配置抓取 `html/rss/api`
- 站点级 URL 白名单过滤
- 标题黑名单过滤（CTA/导航文案）
- 工具名基础质量过滤
- 去重（优先 URL 键）
- 低产出时触发关键词兜底抓取

### Step 2：标准化 + 翻译 + 评分 + 合并发布
脚本：`scripts/update-tools-data.mjs`
输入：`data/crawler-snapshots/raw-tools.latest.json`
输出：`data/tools-data.json`

职责：
- 字段标准化（图标、分类、阶段、价格模型、评分字段）
- 英文文本中文化（必要时程序化改写）
- 两层教育过滤（准入 + 评分）
- 简介质量修复（确保是“工具能力介绍”）
- 历史合并（旧保留 + 新覆盖）

### Step 3：前端展示
页面：`tools.html` + `scripts/tools-page.js`
读取：`data/tools-data.json`
支持：搜索、筛选、排序、分页（真实交互）

---

## 3. 抓取规则

### 3.1 站点优先级分层
配置项：`crawler-config.json > priorityStrategy`

默认策略：
- `high -> medium -> low`
- 当工具数达到阈值（`stopWhenToolsAtLeast`）可提前停止后续层级

作用：
- 先抓高价值且更稳定来源
- 减少低质量/高封禁来源拖慢整体流程

### 3.2 关键词兜底
配置项：`crawler-config.json > keywordFallback`

触发条件：
- 当去重后工具数 `< triggerMinTools`

作用：
- 在站点抓取不足时补充候选结果，保证有增量输入

补充（当前版本）：
- 已扩展“通用 AI + 学科 AI”关键词池，覆盖语文/数学/英语/科学/STEM/历史/地理等教学场景。
- 典型新增查询：`AI math teaching tools`、`AI English teaching tools`、`AI Chinese language teaching tools`、`AI homework assistant for school` 等。

### 3.3 质量门禁（抓取阶段）
1. 站点级 URL 白名单：仅接受工具详情路径模式
2. 标题黑名单：过滤 `for teachers`、`featured resource`、`pricing`、`login` 等
3. 工具名质量校验：长度、字符形态、可读性约束

### 3.4 详情模块抓取规范（统一详情页）
为适配统一详情页，爬虫会对工具官网做二次详情增强抓取（`detailEnrichment`），并抽取以下模块字段：
1. `overview`：工具概述
2. `features[]`：功能概览
3. `useCases[]`：使用场景
4. `pricingPlans[]`：价格方案（`name/price/desc`）

配置位置：`scripts/crawler-config.json > detailEnrichment.modules`
- 可独立开关每个模块是否抓取
- 可配置每个模块最大条数（如 `maxFeatures`）

说明：
- `教师评价` 模块属于站内用户生成内容，不从第三方官网同步抓取
- 若官网未提供可抽取信息，标准化阶段会生成结构化兜底内容，保证所有工具详情页模块完整

---

## 4. 教育筛选与评分规则
脚本实现：`scripts/update-tools-data.mjs`

### 4.1 第一层：准入过滤（不过严）
满足任一即可进入评分：
1. 命中教育关键词（lesson plan、quiz、grading、education、teacher、school 等）
2. 命中高适配通用关键词（PPT、document、automation 等）
3. 可映射到五大场景之一

五大场景：
- 备课设计
- PPT生成
- 题库生成
- 作业评价
- 教学管理

### 4.2 第二层：教育适配评分（0-100）
权重：
- 教育关键词匹配：40%
- 教师/学校案例信号：20%
- 五大场景支持：20%
- 学段匹配（小学/中学/高教）：10%
- 评价与活跃度：10%

阈值：
- `>= 60`：`education-core`（主列表）
- `40-59`：`education-adaptable`（可教育化）
- `< 40`：不展示

### 4.3 简介文案规则（关键）
- 禁止展示“来自 xxx 抓取结果”等占位文案
- 若简介为空、过短、命中占位模式或质量差：自动生成中文功能介绍
- 最终卡片文案风格统一为“使用 AI …”的能力描述

---

## 5. 历史留存与更新规则（当前已启用）

发布模式：`retain-history-and-upsert`

行为定义：
1. 旧工具保留 + 新工具加入
2. 同名或同 URL：新数据覆盖旧数据（upsert）
3. 本轮未抓到的历史工具：继续保留并累计 `missCount`
4. 仅在启用 URL 校验时，才会删除确认失效链接

可选 URL 下线检查参数：
- `--url-check`
- `--url-check-limit`
- `--url-check-timeout-ms`

---

## 6. 操作流程（实际执行）

### 6.1 一键更新（推荐）
```bash
cd /Users/apple/Desktop/AIedu2
./scripts/run-once.sh
```

### 6.2 启用“链接失效后下线”
```bash
cd /Users/apple/Desktop/AIedu2
URL_CHECK=1 URL_CHECK_LIMIT=30 URL_CHECK_TIMEOUT_MS=6000 ./scripts/run-once.sh
```

### 6.3 本地预览页面
```bash
cd /Users/apple/Desktop/AIedu2
python3 -m http.server 5500
```
浏览器打开：`http://localhost:5500/tools.html`

说明：
- `run-once.sh` 不会常驻启动网页服务
- 若服务进程已停止，需要重新执行 `python3 -m http.server 5500`

---

## 7. 结果校验清单（每轮建议）
执行完后检查：
1. `data/crawler-snapshots/raw-tools.latest.json` 的 `sourceStats`
2. `data/tools-data.json` 的 `stats`：
   - `totalRaw`
   - `totalPublished`
   - `mergeMode`
   - `retainedFromHistory`
   - `fallbackUsed`
3. 页面卡片是否满足：
   - 有图标、名称、评分、简介、标签
   - 简介为“能力描述”而非抓取占位词

---

## 8. 常见问题与处理

### Q1：`tools.html` 无法访问
- 原因：本地 HTTP 服务未运行
- 处理：重新执行 `python3 -m http.server 5500`

### Q2：单次抓到很少工具，页面是否会被清空
- 不会。当前是历史留存模式，会保留旧工具并累计 `missCount`

### Q3：为什么有些来源经常 403/521
- 站点反爬策略导致，属正常现象
- 通过分层策略 + 关键词兜底 + 历史留存可保持发布稳定

### Q4：出现重复工具
- 先看是否 URL 不同但同名（跨站重复）
- 当前按 URL 优先去重，后续可按“域名归一 + 名称相似度”继续增强

---

## 9. 你后续只需记住的最短流程
1. 运行更新：`./scripts/run-once.sh`
2. 若页面打不开，启动服务：`python3 -m http.server 5500`
3. 刷新：`http://localhost:5500/tools.html`
