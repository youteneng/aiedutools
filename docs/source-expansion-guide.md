# 爬虫源扩展指南

## 1. 配置文件
编辑：`/Users/apple/Desktop/AIedu2/scripts/crawler-config.json`

主要字段：
- `sources[]`: 网站来源列表
- `keywordFallback`: 关键词兜底抓取策略
- `priorityStrategy`: 站点优先级分层策略（高/中/低）

## 2. 新增网站来源
在 `sources` 里新增一个对象：

```json
{
  "id": "new-source",
  "type": "html",
  "enabled": true,
  "url": "https://example.com",
  "defaultCategory": "lesson-planning",
  "defaultTeachingLevels": ["secondary"],
  "defaultPricingModel": "freemium",
  "defaultIcon": "apps",
  "defaultIconColorClass": "bg-slate-100 dark:bg-slate-700 text-slate-600"
}
```

`type` 支持：
- `html`
- `rss`
- `api`

## 3. 关键词兜底策略
当站点结果总量低于 `triggerMinTools` 时，触发关键词抓取。

示例：
```json
"keywordFallback": {
  "enabled": true,
  "triggerMinTools": 25,
  "queries": [
    "AI education tools",
    "AI tutor tools",
    "AI learning tools"
  ],
  "maxPerQuery": 12
}
```

## 4. 站点优先级分层
爬虫按 `high -> medium -> low` 依次执行，并可在达到阈值后提前停止，减少低质量源影响。

示例：
```json
"priorityStrategy": {
  "enabled": true,
  "tiersOrder": ["high", "medium", "low"],
  "defaultTier": "medium",
  "stopWhenToolsAtLeast": 120
}
```

可选为单站点指定层级（不填则走 `defaultTier`）：
```json
{
  "id": "magicschool",
  "type": "html",
  "priorityTier": "high",
  "enabled": true,
  "url": "https://www.magicschool.ai"
}
```

## 5. 当前已配置来源
- Futurepedia
- ThereIsAnAIForThat
- Toolify
- TopAI
- AIToolHunt
- Product Hunt
- GitHub Trending
- Curipod
- Diffit
- Khanmigo
- MagicSchool AI
- Eduaide.ai
- Quizizz AI / Brisk Teaching / TeachMateAI / ClassPoint AI / LessonPlans.ai
- FutureTools / OpenTools.ai / BetaList / Startup Stash / AlternativeTo / SaaSHub
- GitHub Topics / Hugging Face Spaces / Papers with Code
- YouTube / Medium / Substack / Reddit / Hacker News

## 6. 推荐维护节奏
1. 每周新增 1-2 个来源
2. 观察 `raw-tools.latest.json` 的 `sourceStats`
3. 对抓取质量低的网站单独调解析策略
4. 保持评分与阈值不变，避免噪声回流
