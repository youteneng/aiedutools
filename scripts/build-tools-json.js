#!/usr/bin/env node
/**
 * 师航AI - 工具数据半自动构建脚本（最小可行版）
 *
 * 用途：
 * 1) 读取 data/raw 下的原始数据（JSON / CSV）
 * 2) 做字段映射、清洗、去重、默认值补全
 * 3) 过滤无效工具
 * 4) 输出到 data/processed/tools.json（前端默认读取）
 *
 * 后续接爬虫方式（建议）：
 * - 爬虫只负责把结果写到 data/raw/*.json 或 data/raw/*.csv
 * - 不直接改前端页面，不直接改 processed/tools.json
 * - 每次更新后执行：node ./scripts/build-tools-json.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");
const OUTPUT_FILE = path.join(PROCESSED_DIR, "tools.json");
const STANDARDS_FILE = path.join(ROOT, "data", "standards.json");
const REVIEW_OVERRIDES = path.join(PROCESSED_DIR, "review-overrides.json");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`JSON 读取失败: ${filePath}\n${error.message}`);
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return rows;
  const headers = lines[0].split(",").map((h) => h.trim());
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const item = {};
    headers.forEach((key, idx) => {
      item[key] = cells[idx] || "";
    });
    rows.push(item);
  }
  return rows;
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined || v === "") return [];
  return [v];
}

function uniq(arr) {
  return [...new Set(arr.map((x) => String(x || "").trim()).filter(Boolean))];
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\(.+?\)/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "") || "tool";
}

function normalizeUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "").toLowerCase();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function pickEnum(value, enumList, fallback) {
  return enumList.includes(value) ? value : fallback;
}

function mapChineseSupport(raw, standards) {
  const s = String(raw || "").trim();
  if (["强", "高", "strong", "high"].includes(s.toLowerCase())) return "强";
  if (["弱", "低", "weak", "low"].includes(s.toLowerCase())) return "弱";
  if (s === "中") return "中";
  return standards.chinese_support[1] || "中";
}

function mapAccessType(raw, standards) {
  const s = String(raw || "").trim();
  if (s.includes("特殊网络")) return "需特殊网络";
  if (s.includes("直连") || s.includes("免注册") || s.includes("无需注册")) return "国内可直连";
  if (s.includes("注册")) return "需注册";
  return standards.access_type[1] || "需注册";
}

function mapPricingType(raw, standards) {
  const s = String(raw || "").trim();
  if (["免费", "free"].includes(s.toLowerCase())) return "免费";
  if (["付费", "paid", "订阅"].some((k) => s.toLowerCase().includes(k))) return "付费";
  if (s.includes("免费增值")) return "免费增值";
  return standards.pricing_type[1] || "免费增值";
}

function mapSourceType(raw, standards) {
  const s = String(raw || "").trim().toLowerCase();
  if (["官方", "official", "官网", "官方信息"].includes(s)) return "官方信息";
  if (["社区", "community", "社区实测"].includes(s)) return "社区实测";
  return standards.source_type[1] || "编辑整理";
}

function mapTargetUser(raw, standards) {
  const s = String(raw || "").trim();
  if (s.includes("师范生")) return "师范生";
  if (s.includes("实习")) return "实习教师";
  if (s.includes("新教师")) return "新教师";
  if (s.includes("一线")) return "一线教师";
  if (s.includes("教研")) return "教研员";
  if (s.includes("高校")) return "高校教师";
  return standards.target_users[0] || "师范生";
}

function mapStage(raw, standards) {
  const s = String(raw || "").trim();
  if (s.includes("小学")) return "小学";
  if (s.includes("初中")) return "初中";
  if (s.includes("高中")) return "高中";
  if (s.includes("大学") || s.includes("高校")) return "大学";
  if (s.includes("职教")) return "职教";
  return standards.education_stages[1] || "初中";
}

function mapSubject(raw, standards) {
  const s = String(raw || "").trim();
  if (s.includes("语文")) return "语文";
  if (s.includes("数学")) return "数学";
  if (s.includes("英语")) return "英语";
  if (s.includes("物理")) return "物理";
  if (s.includes("化学")) return "化学";
  if (s.includes("生物")) return "生物";
  if (s.includes("道法") || s.includes("政治")) return "道法/政治";
  if (s.includes("历史")) return "历史";
  if (s.includes("地理")) return "地理";
  if (s.includes("信息")) return "信息技术";
  return "综合通用";
}

function mapUsageScenario(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s.includes("教案")) return "教案";
  if (s.includes("PPT") || s.includes("课件")) return "PPT课件";
  if (s.includes("说课")) return "说课稿";
  if (s.includes("反思")) return "教学反思";
  if (s.includes("论文") || s.includes("文献")) return "论文写作";
  if (s.includes("批改")) return "作业批改";
  if (s.includes("出题") || s.includes("测验") || s.includes("题库")) return "出题测验";
  if (s.includes("班会") || s.includes("德育")) return "班会设计";
  if (s.includes("实习") || s.includes("见习")) return "教育实习";
  if (s.includes("教研")) return "教研活动";
  return null;
}

function normalizeScenarios(input) {
  const arr = toArray(input);
  if (!arr.length) return [];
  return arr.map((item) => {
    if (typeof item === "string") {
      return { title: item, context: "教学场景", value: item };
    }
    return {
      title: String(item.title || "课堂案例"),
      context: String(item.context || "教学场景"),
      value: String(item.value || item.title || "暂无说明")
    };
  });
}

function normalizeRawTool(raw, idx, standards) {
  // 字段映射（raw -> standard）
  // title -> name
  // url -> official_url
  // description -> short_description
  // source -> source_type
  const name = raw.name || raw.title || `未命名工具${idx + 1}`;
  const slug = raw.slug || slugify(name);
  const officialUrl = raw.official_url || raw.url || raw.link || "";
  const shortDesc = raw.short_description || raw.description || raw.summary || "";
  const fullDesc = raw.full_description || raw.long_description || shortDesc;
  const usageScenarios = uniq(
    [
      ...(raw.usage_scenarios || []),
      ...(raw.tags || []),
      ...(raw.keywords || []),
      raw.kind,
      raw.category
    ]
      .map(mapUsageScenario)
      .filter(Boolean)
  );

  const item = {
    id: String(raw.id || `tool_${slug}`),
    slug: String(slug),
    name: String(name),
    short_description: String(shortDesc || "暂无简介"),
    full_description: String(fullDesc || shortDesc || "暂无详细介绍"),
    category: String(raw.category || raw.kind || "未分类"),
    scenarios: normalizeScenarios(raw.scenarios || raw.use_cases),
    target_users: uniq(toArray(raw.target_users || raw.target_groups || raw.users || []).map((v) => mapTargetUser(v, standards))),
    usage_scenarios: usageScenarios.length ? usageScenarios : ["教案"],
    education_stages: uniq(toArray(raw.education_stages || raw.stages || []).map((v) => mapStage(v, standards))),
    subjects: uniq(toArray(raw.subjects || []).map((v) => mapSubject(v, standards))),
    chinese_support: mapChineseSupport(raw.chinese_support || raw.zh_support, standards),
    access_type: mapAccessType(raw.access_type || raw.access, standards),
    pricing_type: mapPricingType(raw.pricing_type || raw.pricing, standards),
    source_type: mapSourceType(raw.source_type || raw.source, standards),
    rating: Number.isFinite(Number(raw.rating ?? raw.score)) ? Math.max(0, Math.min(5, Number(raw.rating ?? raw.score))) : 4.0,
    editor_note: String(raw.editor_note || raw.note || "暂无编辑点评"),
    tags: uniq([...(raw.tags || []), ...(raw.keywords || [])]),
    official_url: String(officialUrl || "https://example.com"),
    cover_image: String(raw.cover_image || raw.image || "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80"),
    review_status: pickEnum(raw.review_status || "pending", standards.review_status, "pending"),
    verified_at: raw.verified_at || null,
    reviewer_note: String(raw.reviewer_note || ""),
    is_active: typeof raw.is_active === "boolean" ? raw.is_active : typeof raw.active === "boolean" ? raw.active : true,
    featured: Boolean(raw.featured ?? raw.recommended ?? false),
    is_member_only: Boolean(raw.is_member_only || false),
    last_updated: String(raw.last_updated || raw.updated_at || today()),
    updated_at: today()
  };

  if (!item.target_users.length) item.target_users = [standards.target_users[0]];
  if (!item.education_stages.length) item.education_stages = [standards.education_stages[1]];
  if (!item.subjects.length) item.subjects = ["综合通用"];
  if (!item.tags.length) item.tags = [item.category];
  return item;
}

function mergeTool(base, next) {
  return {
    ...base,
    ...next,
    tags: uniq([...(base.tags || []), ...(next.tags || [])]),
    target_users: uniq([...(base.target_users || []), ...(next.target_users || [])]),
    usage_scenarios: uniq([...(base.usage_scenarios || []), ...(next.usage_scenarios || [])]),
    education_stages: uniq([...(base.education_stages || []), ...(next.education_stages || [])]),
    subjects: uniq([...(base.subjects || []), ...(next.subjects || [])]),
    scenarios: (next.scenarios && next.scenarios.length) ? next.scenarios : base.scenarios
  };
}

function applyReviewOverrides(tool, overrides, standards) {
  const patch = overrides[tool.slug] || overrides[tool.id];
  if (!patch) return tool;
  const merged = { ...tool, ...patch };
  merged.review_status = pickEnum(merged.review_status, standards.review_status, "pending");
  merged.updated_at = today();
  return merged;
}

function isValidTool(tool) {
  // 无效工具过滤：
  // 1) 名称为空
  // 2) URL 为空
  // 3) review_status 为 rejected（默认不进入前端数据）
  if (!tool.name || !tool.official_url) return false;
  if (tool.review_status === "rejected") return false;
  return true;
}

function loadRawRows() {
  ensureDir(RAW_DIR);
  const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".json") || f.endsWith(".csv"));
  const rows = [];
  for (const file of files) {
    const full = path.join(RAW_DIR, file);
    if (file.endsWith(".json")) {
      const data = readJson(full, []);
      const list = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
      rows.push(...list);
    } else if (file.endsWith(".csv")) {
      const text = fs.readFileSync(full, "utf8");
      rows.push(...parseCsv(text));
    }
  }
  return rows;
}

function main() {
  ensureDir(PROCESSED_DIR);
  const standards = readJson(STANDARDS_FILE, {});
  const overrides = readJson(REVIEW_OVERRIDES, {});
  const rawRows = loadRawRows();

  const normalized = rawRows.map((row, i) => normalizeRawTool(row, i, standards));

  const dedupedMap = new Map();
  for (const tool of normalized) {
    const key = normalizeUrl(tool.official_url) || tool.slug || tool.id;
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, tool);
    } else {
      dedupedMap.set(key, mergeTool(dedupedMap.get(key), tool));
    }
  }

  const finalTools = Array.from(dedupedMap.values())
    .map((tool) => applyReviewOverrides(tool, overrides, standards))
    .filter(isValidTool)
    .sort((a, b) => String(b.last_updated).localeCompare(String(a.last_updated)));

  writeJson(OUTPUT_FILE, finalTools);

  const approved = finalTools.filter((t) => t.review_status === "approved").length;
  console.log(`构建完成：${finalTools.length} 条（approved=${approved}）`);
  console.log(`输出文件：${path.relative(ROOT, OUTPUT_FILE)}`);
}

main();
