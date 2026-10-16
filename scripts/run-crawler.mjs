import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_CONFIG = path.join(PROJECT_ROOT, 'scripts', 'crawler-config.json');
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, 'data', 'crawler-snapshots', 'raw-tools.latest.json');
const SAMPLE_INPUT = path.join(PROJECT_ROOT, 'data', 'crawler-snapshots', 'raw-tools.sample.json');
const TITLE_BLACKLIST = [
  'for teachers',
  'for students',
  'see all',
  "what's new",
  'winter release',
  'schools & districts',
  'schools and districts',
  'elementary teachers',
  'english teachers',
  'math teachers',
  'google teachers',
  'featured resource',
  'read whitepaper',
  'read white paper',
  'explore the findings',
  'sign in',
  'log in',
  'login',
  'pricing',
  'about',
  'contact',
  'terms',
  'privacy',
  'cookie',
  'home',
  'community',
  'blog',
  'newsletter',
];
const DETAIL_GENERIC_BLACKLIST = [
  'for teachers save time',
  'for students give students',
  'featured resource',
  'read white paper',
  'read whitepaper',
  'explore the findings',
  'sign in',
  'log in',
  'get started',
  'book a demo',
];

const SOURCE_URL_ALLOWLIST = {
  futurepedia: ['/tool/', '/ai-tools/'],
  theresanaiforthat: ['/ai/', '/tool/'],
  toolify: ['/tool/', '/toolkit/', '/ai/'],
  'aigc-cn': ['/'],
  'ai-bot-cn': ['/'],
  sspai: ['/post/', '/tag/', '/topic/'],
  '36kr': ['/p/', '/newsflashes/', '/video/'],
  topai: ['/tool/', '/ai-tools/'],
  aitoolhunt: ['/tool/', '/tools/'],
  futuretools: ['/ai-tools/', '/tools/', '/tool/'],
  'insidr-tools': ['/tools/', '/tool/'],
  'ai-scout': ['/tool/', '/tools/'],
  'ai-library': ['/tools/', '/tool/'],
  opentools: ['/tool/', '/tools/', '/ai-tools/'],
  dang: ['/tool/', '/tools/', '/ai/'],
  betalist: ['/startup/', '/startups/'],
  startupstash: ['/ai-tools/', '/startup/', '/tools/'],
  alternativeto: ['/software/', '/list/'],
  saashub: ['/software/', '/compare/'],
  producthunt: ['/posts/', '/products/'],
  'github-trending': ['/'],
  'github-topics-ai': ['/topics/ai', '/topics/artificial-intelligence'],
  'github-topics-education': ['/topics/education', '/topics/edtech'],
  'huggingface-spaces': ['/spaces/'],
  paperswithcode: ['/task/', '/method/', '/paper/', '/area/'],
  curipod: ['/'],
  diffit: ['/'],
  khanmigo: ['/khan-labs', '/ai'],
  magicschool: ['/tools/', '/ai-operating-system-for-schools'],
  eduaide: ['/'],
  quizizz: ['/ai/', '/resources/', '/product/'],
  briskteaching: ['/ai-tools/'],
  teachmateai: ['/'],
  classpoint: ['/ai', '/'],
  lessonplans: ['/'],
  'youtube-ai-teachers': ['/watch', '/playlist'],
  'medium-ai-education': ['/tag/', '/'],
  'substack-ai-education': ['/p/', '/'],
  'reddit-teachers': ['/r/teachers/', '/r/edtech/'],
  'hacker-news': ['/item', '/news'],
};

const SOURCE_PRIORITY_DEFAULTS = {
  futurepedia: 'high',
  theresanaiforthat: 'high',
  toolify: 'high',
  'aigc-cn': 'high',
  'ai-bot-cn': 'high',
  sspai: 'high',
  '36kr': 'high',
  producthunt: 'high',
  magicschool: 'high',
  eduaide: 'high',
  curipod: 'high',
  diffit: 'high',
  khanmigo: 'high',
  quizizz: 'high',
  briskteaching: 'high',
  teachmateai: 'high',
  classpoint: 'high',
  lessonplans: 'high',
  topai: 'medium',
  aitoolhunt: 'medium',
  futuretools: 'medium',
  opentools: 'medium',
  saashub: 'medium',
  alternativeto: 'medium',
  'github-trending': 'medium',
  'github-topics-ai': 'medium',
  'github-topics-education': 'medium',
  'huggingface-spaces': 'medium',
  paperswithcode: 'medium',
  betalist: 'low',
  startupstash: 'low',
  'insidr-tools': 'low',
  'ai-scout': 'low',
  'ai-library': 'low',
  dang: 'low',
  'youtube-ai-teachers': 'low',
  'medium-ai-education': 'low',
  'substack-ai-education': 'low',
  'reddit-teachers': 'low',
  'hacker-news': 'low',
};

const PRIORITY_WEIGHT = {
  high: 1,
  medium: 2,
  low: 3,
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    config: DEFAULT_CONFIG,
    output: DEFAULT_OUTPUT,
    useMock: false,
    timeoutMs: 12000,
    disableKeywordFallback: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--config') options.config = path.resolve(args[i + 1]);
    if (token === '--output') options.output = path.resolve(args[i + 1]);
    if (token === '--timeout-ms') options.timeoutMs = Number(args[i + 1]);
    if (token === '--use-mock') options.useMock = true;
    if (token === '--no-keyword-fallback') options.disableKeywordFallback = true;
  }

  return options;
}

function nowIso() {
  return new Date().toISOString();
}

function toDateOnly(input) {
  if (!input) return nowIso().slice(0, 10);
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return nowIso().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'AIedu2-crawler/1.1 (+educational-indexing)',
        accept: 'application/json,text/xml,text/html;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return '';
  }
}

function sameHost(urlA, urlB) {
  try {
    return new URL(urlA).hostname === new URL(urlB).hostname;
  } catch {
    return false;
  }
}

function cleanText(value) {
  return String(value || '')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hitsDetailGenericBlacklist(text) {
  const value = cleanText(text).toLowerCase();
  return DETAIL_GENERIC_BLACKLIST.some((bad) => value.includes(bad));
}

function uniqueStrings(items, limit = 6) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const text = cleanText(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function textFromMeta(html, key, attr = 'name') {
  const regex = new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i');
  return cleanText(html.match(regex)?.[1] || '');
}

function parsePricePlans(html) {
  const plans = [];
  const text = cleanText(html);
  const lines = text.split(/(?<=月|年|month|year|\$|¥|€)\s+/i).slice(0, 400);
  const planKeywords = /(free|basic|pro|team|enterprise|免费|基础|专业|教师|学校)/i;
  const moneyPattern = /((?:¥|\$|€)\s?\d+(?:\.\d+)?(?:\/(?:月|年|month|year))?|免费|free|定制报价|custom)/i;
  for (const line of lines) {
    if (hitsDetailGenericBlacklist(line)) continue;
    if (!planKeywords.test(line)) continue;
    if (!moneyPattern.test(line)) continue;
    const price = cleanText(line.match(moneyPattern)?.[1] || '');
    let name = '方案';
    if (/free|免费/i.test(line)) name = '免费版';
    else if (/basic|基础/i.test(line)) name = '基础版';
    else if (/pro|专业|teacher/i.test(line)) name = '专业版';
    else if (/team|学校|school/i.test(line)) name = '学校版';
    else if (/enterprise|企业|custom|定制/i.test(line)) name = '企业版';
    plans.push({
      name,
      price: price || '定制报价',
      desc: cleanText(line).slice(0, 80),
    });
    if (plans.length >= 4) break;
  }
  return plans;
}

function normalizeHost(url) {
  const host = hostOf(url || '').toLowerCase();
  return host.replace(/^www\./, '');
}

function splitSentences(text, limit = 4) {
  const value = cleanText(text);
  if (!value) return [];
  return uniqueStrings(
    value
      .split(/[。.!?;；]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 12 && item.length <= 160),
    limit
  );
}

function headingMatches(html) {
  return [...html.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((match) => ({
    index: match.index || 0,
    end: (match.index || 0) + match[0].length,
    title: cleanText(match[2]),
  }));
}

function blockAfterHeading(html, headingKeywords, maxChars = 7000) {
  const headings = headingMatches(html);
  const target = headings.find((item) => {
    const title = item.title.toLowerCase();
    return headingKeywords.some((kw) => title.includes(kw.toLowerCase()));
  });
  if (!target) return '';
  const next = headings.find((item) => item.index > target.index);
  const end = next ? next.index : Math.min(html.length, target.end + maxChars);
  return html.slice(target.end, end);
}

function parseListFromBlock(block, options = {}) {
  const limit = Number(options.limit || 4);
  const keywords = Array.isArray(options.keywords) ? options.keywords : [];
  if (!block) return [];
  const liMatches = [...block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => cleanText(m[1]));
  const pMatches = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => cleanText(m[1]));
  const candidates = [...liMatches, ...pMatches].filter(
    (item) => item.length >= 12 && item.length <= 180 && !hitsDetailGenericBlacklist(item)
  );
  if (keywords.length === 0) return uniqueStrings(candidates, limit);

  const scored = candidates
    .map((text) => {
      const lower = text.toLowerCase();
      const score = keywords.reduce((acc, kw) => (lower.includes(kw.toLowerCase()) ? acc + 1 : acc), 0);
      return { text, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.text);
  return uniqueStrings(scored, limit);
}

function parsePricingFromBlock(block, maxPlans = 4) {
  if (!block) return [];
  return parsePricePlans(block).slice(0, maxPlans);
}

function pickOverview(html) {
  const ogDesc = textFromMeta(html, 'og:description', 'property');
  const twitterDesc = textFromMeta(html, 'twitter:description', 'name');
  const metaDesc = textFromMeta(html, 'description', 'name');
  const h1 = cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
  const title = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const firstParagraph = cleanText(html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '');
  return cleanText(ogDesc || twitterDesc || metaDesc || firstParagraph || h1 || title);
}

function parseListByKeywords(html, keywords, limit = 4) {
  const liMatches = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => cleanText(m[1]));
  const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => cleanText(m[1]));
  const candidates = [...liMatches, ...pMatches].filter(
    (item) => item.length >= 14 && item.length <= 140 && !hitsDetailGenericBlacklist(item)
  );
  const scored = candidates
    .map((text) => {
      const lower = text.toLowerCase();
      const score = keywords.reduce((acc, kw) => (lower.includes(kw) ? acc + 1 : acc), 0);
      return { text, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.text);
  return uniqueStrings(scored, limit);
}

function extractDetailFromHtml(html, options = {}) {
  const overviewEnabled = options.overview !== false;
  const featuresEnabled = options.features !== false;
  const useCasesEnabled = options.useCases !== false;
  const pricingEnabled = options.pricingPlans !== false;
  const maxFeatures = Number(options.maxFeatures || 4);
  const maxUseCases = Number(options.maxUseCases || 3);
  const maxPricingPlans = Number(options.maxPricingPlans || 4);
  const overview = overviewEnabled ? pickOverview(html) : '';
  const featureTexts = featuresEnabled
    ? parseListByKeywords(
        html,
        ['feature', 'tool', 'lesson', 'quiz', 'grading', 'ai', '教学', '课堂', '教案', '批改'],
        maxFeatures
      )
    : [];
  const useCaseTexts = useCasesEnabled
    ? parseListByKeywords(
        html,
        ['for teacher', 'classroom', 'school', 'case', 'scenario', '教师', '课堂', '学校', '场景', '应用'],
        maxUseCases
      )
    : [];
  const pricingPlans = pricingEnabled ? parsePricePlans(html).slice(0, maxPricingPlans) : [];

  return {
    overview: cleanText(overview),
    features: featureTexts,
    useCases: useCaseTexts,
    pricingPlans,
  };
}

function extractMagicSchoolDetail(html, options = {}) {
  const maxFeatures = Number(options.maxFeatures || 4);
  const maxUseCases = Number(options.maxUseCases || 3);
  const maxPricingPlans = Number(options.maxPricingPlans || 4);
  const featureBlock = blockAfterHeading(html, ['features', 'what it does', 'tools', 'lesson plan']);
  const useCaseBlock = blockAfterHeading(html, ['for teachers', 'for students', 'classroom', 'use cases']);
  const pricingBlock = blockAfterHeading(html, ['pricing', 'plans']);

  return {
    overview: pickOverview(html),
    features: parseListFromBlock(featureBlock, {
      limit: maxFeatures,
      keywords: ['lesson', 'quiz', 'rubric', 'worksheet', 'presentation', 'teacher', 'classroom'],
    }),
    useCases: parseListFromBlock(useCaseBlock, {
      limit: maxUseCases,
      keywords: ['teacher', 'student', 'classroom', 'school', 'lesson', 'instruction'],
    }),
    pricingPlans: parsePricingFromBlock(pricingBlock, maxPricingPlans),
  };
}

function extractEduaideDetail(html, options = {}) {
  const maxFeatures = Number(options.maxFeatures || 4);
  const maxUseCases = Number(options.maxUseCases || 3);
  const maxPricingPlans = Number(options.maxPricingPlans || 4);
  const featureBlock = blockAfterHeading(html, ['features', 'capabilities', 'what you can do', 'ai teaching']);
  const useCaseBlock = blockAfterHeading(html, ['use cases', 'for educators', 'classroom', 'teacher']);
  const pricingBlock = blockAfterHeading(html, ['pricing', 'plans']);

  return {
    overview: pickOverview(html),
    features: parseListFromBlock(featureBlock, {
      limit: maxFeatures,
      keywords: ['teacher', 'instruction', 'lesson', 'assessment', 'feedback', 'classroom'],
    }),
    useCases: parseListFromBlock(useCaseBlock, {
      limit: maxUseCases,
      keywords: ['teacher', 'school', 'classroom', 'students', 'learning'],
    }),
    pricingPlans: parsePricingFromBlock(pricingBlock, maxPricingPlans),
  };
}

function extractCuripodDetail(html, options = {}) {
  const maxFeatures = Number(options.maxFeatures || 4);
  const maxUseCases = Number(options.maxUseCases || 3);
  const maxPricingPlans = Number(options.maxPricingPlans || 4);
  const featureBlock = blockAfterHeading(html, ['interactive lessons', 'features', 'how it works', 'engage']);
  const useCaseBlock = blockAfterHeading(html, ['teachers', 'classroom', 'k-12', 'student']);
  const pricingBlock = blockAfterHeading(html, ['pricing', 'plans', 'free']);

  return {
    overview: pickOverview(html),
    features: parseListFromBlock(featureBlock, {
      limit: maxFeatures,
      keywords: ['interactive', 'lesson', 'student', 'engagement', 'teacher'],
    }),
    useCases: parseListFromBlock(useCaseBlock, {
      limit: maxUseCases,
      keywords: ['classroom', 'teacher', 'student', 'k-12', 'school'],
    }),
    pricingPlans: parsePricingFromBlock(pricingBlock, maxPricingPlans),
  };
}

function extractDiffitDetail(html, options = {}) {
  const maxFeatures = Number(options.maxFeatures || 4);
  const maxUseCases = Number(options.maxUseCases || 3);
  const maxPricingPlans = Number(options.maxPricingPlans || 4);
  const featureBlock = blockAfterHeading(html, ['features', 'how diffit works', 'create resources']);
  const useCaseBlock = blockAfterHeading(html, ['for teachers', 'classroom', 'use cases', 'learning']);
  const pricingBlock = blockAfterHeading(html, ['pricing', 'plans']);

  return {
    overview: pickOverview(html),
    features: parseListFromBlock(featureBlock, {
      limit: maxFeatures,
      keywords: ['reading', 'level', 'resource', 'lesson', 'teacher', 'differentiation'],
    }),
    useCases: parseListFromBlock(useCaseBlock, {
      limit: maxUseCases,
      keywords: ['classroom', 'teacher', 'student', 'instruction', 'assignment'],
    }),
    pricingPlans: parsePricingFromBlock(pricingBlock, maxPricingPlans),
  };
}

function extractBriskDetail(html, options = {}) {
  const maxFeatures = Number(options.maxFeatures || 4);
  const maxUseCases = Number(options.maxUseCases || 3);
  const maxPricingPlans = Number(options.maxPricingPlans || 4);
  const featureBlock = blockAfterHeading(html, ['ai tools', 'features', 'what you can do', 'teaching']);
  const useCaseBlock = blockAfterHeading(html, ['for teachers', 'classroom', 'use cases', 'instructional']);
  const pricingBlock = blockAfterHeading(html, ['pricing', 'plans']);

  return {
    overview: pickOverview(html),
    features: parseListFromBlock(featureBlock, {
      limit: maxFeatures,
      keywords: ['lesson', 'quiz', 'feedback', 'presentation', 'teacher'],
    }),
    useCases: parseListFromBlock(useCaseBlock, {
      limit: maxUseCases,
      keywords: ['classroom', 'teacher', 'students', 'instruction', 'school'],
    }),
    pricingPlans: parsePricingFromBlock(pricingBlock, maxPricingPlans),
  };
}

const DETAIL_EXTRACTOR_REGISTRY = [
  { domains: ['magicschool.ai'], id: 'magicschool', extractor: extractMagicSchoolDetail },
  { domains: ['eduaide.ai'], id: 'eduaide', extractor: extractEduaideDetail },
  { domains: ['curipod.com'], id: 'curipod', extractor: extractCuripodDetail },
  { domains: ['diffit.me'], id: 'diffit', extractor: extractDiffitDetail },
  { domains: ['briskteaching.com'], id: 'briskteaching', extractor: extractBriskDetail },
];

function resolveDetailExtractor(targetUrl) {
  const host = normalizeHost(targetUrl);
  for (const item of DETAIL_EXTRACTOR_REGISTRY) {
    if (item.domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return item;
    }
  }
  return { id: 'generic', extractor: extractDetailFromHtml };
}

function mergeDetailResult(primary, fallback) {
  const p = primary || {};
  const f = fallback || {};
  const overview = cleanText(p.overview || f.overview || '');
  const features = uniqueStrings([...(Array.isArray(p.features) ? p.features : []), ...(Array.isArray(f.features) ? f.features : [])], 6);
  const useCases = uniqueStrings([...(Array.isArray(p.useCases) ? p.useCases : []), ...(Array.isArray(f.useCases) ? f.useCases : [])], 4);
  const pricingPlans = [...(Array.isArray(p.pricingPlans) ? p.pricingPlans : []), ...(Array.isArray(f.pricingPlans) ? f.pricingPlans : [])]
    .filter((item) => item && (item.name || item.price || item.desc))
    .slice(0, 6);
  return { overview, features, useCases, pricingPlans };
}

async function enrichToolFromDetailPage(tool, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 10000);
  const targetUrl = String(tool.url || '').trim();
  if (!targetUrl || targetUrl === '#') return tool;

  try {
    const html = await fetchText(targetUrl, timeoutMs);
    const matched = resolveDetailExtractor(targetUrl);
    const specific = matched.extractor(html, options);
    const generic = matched.id === 'generic' ? specific : extractDetailFromHtml(html, options);
    const details = mergeDetailResult(specific, generic);
    const currentDescription = cleanText(tool.description || '');
    const shouldReplaceDescription = !currentDescription || currentDescription === '暂无描述' || hitsDetailGenericBlacklist(currentDescription);
    const nextDescription = shouldReplaceDescription
      ? cleanText(details.overview || tool.subtitle || tool.name || '')
      : currentDescription;
    return {
      ...tool,
      description: nextDescription || currentDescription || '暂无描述',
      overview: details.overview || tool.overview || '',
      features: Array.isArray(details.features) ? details.features : [],
      useCases: Array.isArray(details.useCases) ? details.useCases : [],
      pricingPlans: Array.isArray(details.pricingPlans) ? details.pricingPlans : [],
      detailExtractor: matched.id,
    };
  } catch {
    return tool;
  }
}

async function enrichToolsWithDetails(tools, options = {}) {
  const enabled = options.enabled !== false;
  if (!enabled) return tools;
  const maxTools = Number(options.maxTools || 0);
  const timeoutMs = Number(options.timeoutMs || 10000);
  const concurrency = Math.max(1, Number(options.concurrency || 3));

  const list = [...tools];
  const targets = maxTools > 0 ? list.slice(0, maxTools) : list;
  const rest = list.slice(targets.length);

  const enriched = [];
  let index = 0;

  async function worker() {
    while (index < targets.length) {
      const currentIndex = index;
      index += 1;
      const item = targets[currentIndex];
      const nextItem = await enrichToolFromDetailPage(item, options);
      enriched[currentIndex] = nextItem;
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return [...enriched.filter(Boolean), ...rest];
}

function isLikelyToolName(name) {
  const text = cleanText(name);
  if (text.length < 2 || text.length > 90) return false;

  const badEqual = new Set([
    'sign in', 'login', 'log in', 'pricing', 'about', 'contact',
    'terms', 'privacy', 'cookie', 'home', 'community', 'blog',
  ]);

  return !badEqual.has(text.toLowerCase());
}

function hitsTitleBlacklist(name) {
  const text = cleanText(name).toLowerCase();
  return TITLE_BLACKLIST.some((bad) => text.includes(bad));
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function allowBySourceUrl(sourceId, url) {
  const rules = SOURCE_URL_ALLOWLIST[sourceId];
  if (!rules || rules.length === 0) return true;
  return rules.some((segment) => url.includes(segment));
}

function resolvePriorityTier(source, defaultTier = 'medium') {
  const raw = String(source.priorityTier || SOURCE_PRIORITY_DEFAULTS[source.id] || defaultTier).toLowerCase();
  if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  return defaultTier;
}

function toTool(record, source) {
  const name = cleanText(record.name || record.title);
  if (!isLikelyToolName(name) || hitsTitleBlacklist(name)) return null;

  const url = cleanText(record.url || record.link || '#') || '#';
  const description = cleanText(record.description || '');
  if (description && hitsTitleBlacklist(description) && description.length < 120) return null;

  return {
    source: source.id,
    sourceUrl: source.url || source.endpoint || '',
    id: cleanText(record.id) || undefined,
    name,
    subtitle: cleanText(record.subtitle) || name,
    description: description || '暂无描述',
    url,
    category: cleanText(record.category || source.defaultCategory || 'lesson-planning'),
    teachingLevels: Array.isArray(record.teachingLevels)
      ? record.teachingLevels
      : Array.isArray(source.defaultTeachingLevels)
      ? source.defaultTeachingLevels
      : ['secondary'],
    pricingModel: cleanText(record.pricingModel || source.defaultPricingModel || 'paid'),
    ratingScore: Number(record.ratingScore || 0),
    ratingCount: Number(record.ratingCount || 0),
    popularityScore: Number(record.popularityScore || record.ratingCount || 0),
    publishedAt: toDateOnly(record.publishedAt || record.pubDate),
    icon: cleanText(record.icon || source.defaultIcon || 'apps'),
    iconColorClass: cleanText(record.iconColorClass || source.defaultIconColorClass || 'bg-slate-100 dark:bg-slate-700 text-slate-600'),
    badge: record.badge || null,
    overview: cleanText(record.overview || ''),
    features: Array.isArray(record.features) ? record.features.map((item) => cleanText(item)).filter(Boolean) : [],
    useCases: Array.isArray(record.useCases) ? record.useCases.map((item) => cleanText(item)).filter(Boolean) : [],
    pricingPlans: Array.isArray(record.pricingPlans)
      ? record.pricingPlans
          .map((plan) => ({
            name: cleanText(plan?.name || ''),
            price: cleanText(plan?.price || ''),
            desc: cleanText(plan?.desc || ''),
          }))
          .filter((plan) => plan.name || plan.price || plan.desc)
      : [],
  };
}

function parseJsonSource(text, source) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }

  const candidates =
    (Array.isArray(data) && data) ||
    data.tools ||
    data.items ||
    data.data ||
    [];

  if (!Array.isArray(candidates)) return [];
  return candidates.map((item) => toTool(item, source)).filter(Boolean);
}

function parseRssSource(text, source) {
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const entryRegex = /<entry[\s\S]*?<\/entry>/gi;

  const items = text.match(itemRegex) || [];
  const entries = text.match(entryRegex) || [];

  const rssTools = items
    .map((chunk) => {
      const title = cleanText(chunk.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i)?.[1] || chunk.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i)?.[2]);
      const link = cleanText(chunk.match(/<link>([\s\S]*?)<\/link>/i)?.[1]);
      const description = cleanText(chunk.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/i)?.[1] || chunk.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/i)?.[2]);
      const pubDate = cleanText(chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]);

      return toTool({
        name: title,
        subtitle: title,
        description,
        url: link,
        publishedAt: toDateOnly(pubDate),
        popularityScore: 1,
      }, source);
    })
    .filter(Boolean);

  const atomTools = entries
    .map((chunk) => {
      const title = cleanText(chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
      const link = cleanText(chunk.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?/i)?.[1]);
      const description = cleanText(chunk.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] || chunk.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1]);
      const publishedAt = cleanText(chunk.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] || chunk.match(/<published>([\s\S]*?)<\/published>/i)?.[1]);

      return toTool({
        name: title,
        subtitle: title,
        description,
        url: link,
        publishedAt: toDateOnly(publishedAt),
        popularityScore: 1,
      }, source);
    })
    .filter(Boolean);

  return [...rssTools, ...atomTools];
}

function parseHtmlSource(text, source) {
  const tools = [];
  const baseUrl = source.url || source.endpoint || '';

  const jsonLdMatches = [...text.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of jsonLdMatches) {
    try {
      const payload = JSON.parse(match[1].trim());
      const records = Array.isArray(payload) ? payload : [payload];
      records.forEach((item) => {
        if (!item) return;
        const mapped = toTool(
          {
            name: item.name || item.headline,
            subtitle: item.alternateName || item.name,
            description: item.description,
            url: item.url,
            publishedAt: item.datePublished,
          },
          source
        );
        if (mapped) tools.push(mapped);
      });
    } catch {
      // ignore invalid json-ld
    }
  }

  if (tools.length > 0) return tools;

  const anchorMatches = [...text.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const fromAnchors = anchorMatches
    .slice(0, 500)
    .map((m) => {
      const label = cleanText(m[2]);
      if (!isLikelyToolName(label) || hitsTitleBlacklist(label)) return null;

      const resolved = normalizeUrl(m[1], baseUrl);
      if (!resolved) return null;
      if (!allowBySourceUrl(source.id, resolved)) return null;
      if (source.url && !sameHost(resolved, source.url) && source.id !== 'producthunt') return null;

      return toTool(
        {
          name: label,
          subtitle: label,
          description: '',
          url: resolved,
          popularityScore: 1,
        },
        source
      );
    })
    .filter(Boolean);

  return fromAnchors;
}

async function crawlSource(source, timeoutMs) {
  const url = source.endpoint || source.url;
  if (!url) {
    return { sourceId: source.id, tools: [], error: 'missing endpoint/url' };
  }

  try {
    const text = await fetchText(url, timeoutMs);
    let tools = [];

    if (source.type === 'api') tools = parseJsonSource(text, source);
    else if (source.type === 'rss') tools = parseRssSource(text, source);
    else tools = parseHtmlSource(text, source);

    return { sourceId: source.id, tools, error: null };
  } catch (error) {
    return { sourceId: source.id, tools: [], error: String(error.message || error) };
  }
}

async function crawlKeywords(queries, maxPerQuery, timeoutMs) {
  const source = {
    id: 'keyword-search',
    defaultCategory: 'lesson-planning',
    defaultTeachingLevels: ['secondary'],
    defaultPricingModel: 'freemium',
    defaultIcon: 'manage_search',
    defaultIconColorClass: 'bg-slate-100 dark:bg-slate-700 text-slate-600',
  };

  const tools = [];
  const details = [];

  for (const query of queries) {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
      const html = await fetchText(url, timeoutMs);
      const matches = [...html.matchAll(/<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];

      const current = matches
        .slice(0, Math.max(1, maxPerQuery))
        .map((m) => {
          const link = cleanText(m[1]);
          const title = cleanText(m[2]);
          if (!isLikelyToolName(title)) return null;
          return toTool(
            {
              name: title,
              subtitle: title,
              description: `关键词扩展抓取：${query}`,
              url: link,
              category: 'lesson-planning',
              popularityScore: 1,
            },
            source
          );
        })
        .filter(Boolean);

      tools.push(...current);
      details.push({ query, count: current.length, error: null });
    } catch (error) {
      details.push({ query, count: 0, error: String(error.message || error) });
    }
  }

  return { tools, details };
}

function dedupeRawTools(tools) {
  const map = new Map();
  tools.forEach((tool) => {
    if (hitsTitleBlacklist(tool.name)) return;
    if (!allowBySourceUrl(tool.source, tool.url || '')) return;
    if (tool.sourceUrl && hostOf(tool.sourceUrl) && hostOf(tool.url || '') && !sameHost(tool.url, tool.sourceUrl) && tool.source !== 'producthunt') {
      return;
    }
    const key = tool.url && tool.url !== '#' ? tool.url : `${tool.source}:${tool.name}`;
    if (!map.has(key)) map.set(key, tool);
  });
  return Array.from(map.values());
}

async function runMock(outputPath) {
  const sample = JSON.parse(await fs.readFile(SAMPLE_INPUT, 'utf8'));
  const tools = Array.isArray(sample.tools) ? [...sample.tools] : [];

  tools.push({
    source: 'mock-live-test',
    sourceUrl: 'https://mock.example.edu/new-tool',
    name: `测试工具-${new Date().toISOString().slice(11, 19)}`,
    subtitle: 'CrawlerSmokeTest',
    description: '用于验证爬虫更新链路是否成功。',
    url: 'https://mock.example.edu/new-tool',
    category: 'lesson-planning',
    teachingLevels: ['secondary'],
    pricingModel: 'free',
    ratingScore: 4.1,
    ratingCount: 12,
    popularityScore: 12,
    publishedAt: new Date().toISOString().slice(0, 10),
    icon: 'science',
    iconColorClass: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600',
  });

  const payload = {
    capturedAt: nowIso(),
    mode: 'mock',
    tools,
    sourceStats: [{ sourceId: 'mock', count: tools.length, error: null }],
  };

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`mock crawl saved: ${outputPath}`);
  console.log(`tools: ${tools.length}`);
}

async function runReal(configPath, outputPath, timeoutMs, disableKeywordFallback) {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const sources = (config.sources || []).filter((item) => item.enabled !== false);
  const strategy = config.priorityStrategy || {};
  const priorityEnabled = strategy.enabled !== false;
  const tiersOrder = Array.isArray(strategy.tiersOrder) && strategy.tiersOrder.length
    ? strategy.tiersOrder
    : ['high', 'medium', 'low'];
  const defaultTier = String(strategy.defaultTier || 'medium').toLowerCase();
  const stopWhenToolsAtLeast = Number(strategy.stopWhenToolsAtLeast || 0);

  const sourcesWithTier = sources.map((source) => ({
    ...source,
    priorityTier: resolvePriorityTier(source, defaultTier),
  }));

  const results = [];
  const crawledTiers = [];
  let stoppedEarly = false;

  if (!priorityEnabled) {
    const ordered = [...sourcesWithTier].sort((a, b) => {
      const aw = PRIORITY_WEIGHT[a.priorityTier] || 99;
      const bw = PRIORITY_WEIGHT[b.priorityTier] || 99;
      return aw - bw;
    });
    for (const source of ordered) {
      const result = await crawlSource(source, timeoutMs);
      results.push({ ...result, priorityTier: source.priorityTier });
      if (result.error) {
        console.warn(`[${source.id}] failed: ${result.error}`);
      } else {
        console.log(`[${source.id}] tools: ${result.tools.length}`);
      }
    }
  } else {
    for (const tier of tiersOrder) {
      const tierSources = sourcesWithTier.filter((source) => source.priorityTier === tier);
      if (tierSources.length === 0) continue;
      crawledTiers.push(tier);

      for (const source of tierSources) {
        const result = await crawlSource(source, timeoutMs);
        results.push({ ...result, priorityTier: tier });
        if (result.error) {
          console.warn(`[${source.id}] failed: ${result.error}`);
        } else {
          console.log(`[${source.id}] tools: ${result.tools.length}`);
        }
      }

      if (stopWhenToolsAtLeast > 0) {
        const currentTools = dedupeRawTools(results.flatMap((item) => item.tools));
        if (currentTools.length >= stopWhenToolsAtLeast) {
          stoppedEarly = true;
          console.log(`[priority] stop early at tier "${tier}" (tools=${currentTools.length}, threshold=${stopWhenToolsAtLeast})`);
          break;
        }
      }
    }
  }

  let tools = dedupeRawTools(results.flatMap((item) => item.tools));
  const sourceStats = results.map((r) => ({
    sourceId: r.sourceId,
    priorityTier: r.priorityTier || resolvePriorityTier({ id: r.sourceId }, defaultTier),
    count: r.tools.length,
    error: r.error,
  }));

  const fallback = config.keywordFallback || {};
  const canRunKeywordFallback = fallback.enabled && !disableKeywordFallback;
  const triggerMinTools = Number(fallback.triggerMinTools || 0);

  let keywordStats = [];
  if (canRunKeywordFallback && tools.length < triggerMinTools) {
    const queries = Array.isArray(fallback.queries) ? fallback.queries : [];
    const maxPerQuery = Number(fallback.maxPerQuery || 8);
    const keywordResult = await crawlKeywords(queries, maxPerQuery, timeoutMs);
    keywordStats = keywordResult.details;
    tools = dedupeRawTools([...tools, ...keywordResult.tools]);
    console.log(`[keyword-fallback] appended tools: ${keywordResult.tools.length}`);
  }

  const detailEnrichment = config.detailEnrichment || {};
  const detailModules = detailEnrichment.modules || {};
  tools = await enrichToolsWithDetails(tools, {
    enabled: detailEnrichment.enabled !== false,
    maxTools: Number(detailEnrichment.maxTools || 20),
    timeoutMs: Number(detailEnrichment.timeoutMs || Math.max(6000, timeoutMs)),
    concurrency: Number(detailEnrichment.concurrency || 3),
    overview: detailModules.overview !== false,
    features: detailModules.features !== false,
    useCases: detailModules.useCases !== false,
    pricingPlans: detailModules.pricingPlans !== false,
    maxFeatures: Number(detailModules.maxFeatures || 4),
    maxUseCases: Number(detailModules.maxUseCases || 3),
    maxPricingPlans: Number(detailModules.maxPricingPlans || 4),
  });

  const payload = {
    capturedAt: nowIso(),
    mode: 'real',
    priorityStrategy: {
      enabled: priorityEnabled,
      tiersOrder,
      defaultTier,
      stopWhenToolsAtLeast,
      crawledTiers,
      stoppedEarly,
    },
    sourceStats,
    keywordFallback: {
      enabled: Boolean(canRunKeywordFallback),
      triggerMinTools,
      used: keywordStats.length > 0,
      stats: keywordStats,
    },
    detailEnrichment: {
      enabled: detailEnrichment.enabled !== false,
      maxTools: Number(detailEnrichment.maxTools || 20),
      timeoutMs: Number(detailEnrichment.timeoutMs || Math.max(6000, timeoutMs)),
      concurrency: Number(detailEnrichment.concurrency || 3),
      modules: {
        overview: detailModules.overview !== false,
        features: detailModules.features !== false,
        useCases: detailModules.useCases !== false,
        pricingPlans: detailModules.pricingPlans !== false,
        maxFeatures: Number(detailModules.maxFeatures || 4),
        maxUseCases: Number(detailModules.maxUseCases || 3),
        maxPricingPlans: Number(detailModules.maxPricingPlans || 4),
      },
    },
    tools,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`real crawl saved: ${outputPath}`);
  console.log(`tools: ${tools.length}`);
}

async function main() {
  const options = parseArgs();
  if (options.useMock) {
    await runMock(options.output);
    return;
  }

  await runReal(options.config, options.output, options.timeoutMs, options.disableKeywordFallback);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
