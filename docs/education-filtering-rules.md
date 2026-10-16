# 教育 AI 工具筛选规则（发布版）

## 1. 适用范围
本规则用于 `tools-data.json` 产出阶段（标准化脚本：`scripts/update-tools-data.mjs`）。

目标：
- 先做“准入过滤”，避免明显无关工具进入评分。
- 再做“教育适配评分”，按阈值决定是否展示在页面。

## 2. 第一层：准入过滤（不过于死）
工具满足以下任意条件即可进入评分层：

1. 教学相关关键词命中
- 典型关键词：
  - `lesson plan`、`quiz`、`grading`、`LMS`、`education`、`school`、`teacher`、`classroom`
  - 及中文同义词：`教案`、`备课`、`题库`、`批改`、`评分`、`教学`、`课堂`、`教师`、`学校`

2. 通用但高适配关键词命中
- 典型关键词：
  - `PPT/presentation/slide/powerpoint`
  - `document/docs/文档`
  - `automation/workflow/agent/自动化`

3. 已识别为五大教育场景之一（分类字段可映射）
- 备课设计
- PPT生成
- 题库生成
- 作业评价
- 教学管理

说明：不满足准入条件的工具直接标记为 `excluded`，不进入页面。

## 3. 第二层：教育适配评分（0-100）
评分结构如下：

1. 教育关键词匹配（40%）
- 上限 40 分

2. 教师/学校案例信号（20%）
- 有 `teacher/school/classroom`（含中文）信号给满分 20

3. 五大场景支持度（20%）
- 根据场景关键词命中程度计分，上限 20

4. 阶段匹配（10%）
- 小学/中学/高教信号命中计分，上限 10

5. 评价与活跃度（10%）
- 依据评分与热度（rating/popularity）计分，上限 10

附加：来源先验分（`sourcePrior`）
- 用于轻微修正不同来源的数据质量差异（不改变主阈值原则）

## 4. 发布阈值（强约束）
- `educationScore >= 60`：`education-core`（主列表）
- `40 <= educationScore <= 59`：`education-adaptable`（通用工具，可教育化）
- `educationScore < 40`：`excluded`（不展示）

页面最终只展示：
- `education-core`
- `education-adaptable`

当实时爬虫结果全部被过滤（`totalPublished = 0`）时：
- 启用预留工具回填（`data/curated-tools.json`）
- 回填工具同样经过同一套评分与阈值判断
- `stats.fallbackUsed = true`

## 5. 输出字段
每条工具输出：
- `educationScore`
- `educationTier`
- `educationScoreBreakdown`
- `admission`（准入命中详情）
- `classification`（分类与阶段推断）

## 5.1 质量修复补丁（已启用）
为避免抓到导航/营销文案，发布前增加三道质量门禁：
1. 站点级 URL 白名单（仅保留工具详情路径模式）\n
2. 标题黑名单（过滤 CTA/导航句，如 `For teachers...`、`Featured Resource...`）\n
3. 工具名质量校验（长度、字符形态、关键词约束）\n

同时，若简介不合规（过短/营销句/英文直译质量差），会自动生成程序化中文简介，风格与预留回填工具一致。

汇总统计（`stats`）：
- `totalRaw`：去重后的总工具数
- `totalPublished`：阈值筛选后可展示数量
- `fallbackUsed`：是否启用预留工具回填
- `rawTiers`：原始抓取集层级分布
- `publishedTiers`：最终发布集层级分布

## 6. 执行命令
```bash
node /Users/apple/Desktop/AIedu2/scripts/update-tools-data.mjs \
  --input /Users/apple/Desktop/AIedu2/data/crawler-snapshots/raw-tools.latest.json \
  --output /Users/apple/Desktop/AIedu2/data/tools-data.json
```
