# 一键运行说明（run-once.sh）

## 命令
```bash
cd /Users/apple/Desktop/AIedu2
./scripts/run-once.sh
```

## 脚本做了什么
1. 执行真实爬虫（多站点 + 关键词兜底）
2. 执行工具官网详情增强抓取（概述/功能/场景/价格）
3. 执行标准化、翻译、评分、阈值过滤
4. 输出统计摘要（抓取来源、关键词兜底、发布结果）

## 产出文件
- 原始快照：`/Users/apple/Desktop/AIedu2/data/crawler-snapshots/raw-tools.latest.json`
- 页面数据：`/Users/apple/Desktop/AIedu2/data/tools-data.json`

## 预览页面
```bash
cd /Users/apple/Desktop/AIedu2
python3 -m http.server 5500
```
打开：`http://localhost:5500/tools.html`

## 常见情况
- 如果所有网站抓取失败：
  - 会自动启用预留工具回填
  - 页面仍会展示基础可用工具
- 如果抓取量不足：
  - 自动触发关键词扩展抓取（AI education / AI tutor / AI learning 等）

## 统一详情页字段（已同步规则）
当前发布数据默认包含详情页核心字段：
- `overview`
- `features[]`
- `useCases[]`
- `pricingPlans[]`

如果官网抓取不到，会由标准化阶段自动生成兜底字段，确保详情页结构完整。

## 留存与更新规则（当前版本）
- 默认策略：`旧工具保留 + 新工具加入`
- 同名或同 URL：用新抓取结果覆盖旧数据（upsert）
- 当期没抓到的历史工具：不会立刻删除，会继续展示并累计 `missCount`
- 仅当你启用 URL 可用性检查并确认链接失效时，才会下线该工具

### 可选：启用“下线检查后删除”
```bash
cd /Users/apple/Desktop/AIedu2
node scripts/update-tools-data.mjs --url-check --url-check-limit 30 --url-check-timeout-ms 6000
```
- `--url-check`：开启链接可用性检查（HEAD）
- `--url-check-limit`：本轮最多检查多少个“本次未抓到的历史工具”
- `--url-check-timeout-ms`：单条链接检查超时

也可以直接在一键脚本中启用：
```bash
cd /Users/apple/Desktop/AIedu2
URL_CHECK=1 URL_CHECK_LIMIT=30 URL_CHECK_TIMEOUT_MS=6000 ./scripts/run-once.sh
```
