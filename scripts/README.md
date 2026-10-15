# 师航AI 数据更新流程（静态站点版）

本项目采用“`raw -> processed/tools.json -> 前端渲染`”的半自动链路，适配 GitHub Pages / 任意静态托管。

## 目录说明

- `data/raw/`
  - 放原始数据（爬虫导出、人工整理、第三方表格转 JSON）。
  - 可以有多个 JSON 文件，脚本会自动合并读取。
- `data/processed/`
  - 放审核与中间产物。
  - `review-overrides.json`：人工审核结果与可见性控制。
  - `tools.json`：脚本输出的标准化工具数据（前端默认读取）。
- `data/schema/tool.schema.json`
  - 工具标准结构 schema，便于后续校验和协作。
- `data/standards.json`
  - 全站统一枚举标准（录入、清洗、展示共用）。
- `scripts/build-tools-json.js`
  - 本地构建脚本：清洗、映射、去重、补默认值、合并审核。

## 字段映射规则（核心）

脚本已内置以下映射：

- `raw.title` / `raw.name` -> `name`
- `raw.url` / `raw.link` -> `official_url`
- `raw.description` / `raw.summary` -> `short_description`
- `raw.long_description` -> `full_description`
- `raw.source` -> `source_type`
- `raw.kind` / `raw.type` -> `category`
- `raw.target_groups` -> `target_users`
- `raw.stages` -> `education_stages`
- `raw.keywords` -> `tags`
- `raw.score` -> `rating`

## 统一枚举标准（面向中国教育场景）

- `chinese_support`: `强 / 中 / 弱`
- `access_type`: `国内可直连 / 需注册 / 需特殊网络`
- `pricing_type`: `免费 / 免费增值 / 付费`
- `source_type`: `官方信息 / 编辑整理 / 社区实测`
- `review_status`: `pending / approved / rejected`

- `target_users`:
  - `师范生 / 实习教师 / 新教师 / 一线教师 / 教研员 / 高校教师`
- `usage_scenarios`:
  - `教案 / PPT课件 / 说课稿 / 教学反思 / 论文写作 / 作业批改 / 出题测验 / 班会设计 / 教育实习 / 教研活动`
- `education_stages`:
  - `小学 / 初中 / 高中 / 大学 / 职教`
- `subjects`:
  - `语文 / 数学 / 英语 / 物理 / 化学 / 生物 / 道法/政治 / 历史 / 地理 / 信息技术 / 综合通用`

## 人工审核字段

在 `data/processed/review-overrides.json` 中按 `slug`（或 `id`）维护：

- `review_status`: `pending | approved | rejected`
- `verified_at`: `YYYY-MM-DD | null`
- `reviewer_note`: 审核备注

## 可见性控制字段

- `is_active`：是否前台可见（首页/目录默认只展示 `true`）
- `featured`：是否首页推荐
- `is_member_only`：是否会员专属（后续可用于前端标记与权限逻辑）

## 如何新增工具（手动）

1. 在 `data/raw/` 新建或追加 JSON 文件（可继续用 `tools-seed.json`）。
2. 只需保证原始字段尽可能齐全，脚本会做默认补齐。
3. 在 `data/processed/review-overrides.json` 增加对应 `slug` 审核结论。
4. 运行构建脚本并检查输出。

## 如何构建

在项目根目录执行：

```bash
node ./scripts/build-tools-json.js
```

输出结果：

- `data/processed/tools.json`（前端读取）

## 前端联动说明

- 首页：读取 `data/processed/tools.json`，筛选 `featured=true && is_active=true`
- 目录页：读取 `data/processed/tools.json`，支持搜索与筛选
- 详情页：通过 `?slug=` 或 `?id=` 查询 `data/processed/tools.json` 渲染

## 给后续爬虫的接入建议

爬虫只负责把原始结果写入 `data/raw/*.json`，不直接改前端文件。
审核人员只维护 `review-overrides.json`。
最终统一由 `build-tools-json.js` 产出 `data/processed/tools.json`，实现“可回溯、可审核、可自动化”。
