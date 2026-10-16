import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_INPUT = path.join(PROJECT_ROOT, 'data', 'crawler-snapshots', 'raw-tools.sample.json');
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, 'data', 'tools-data.json');
const CURATED_INPUT = path.join(PROJECT_ROOT, 'data', 'curated-tools.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    urlCheck: false,
    urlCheckLimit: 20,
    urlCheckTimeoutMs: 6000,
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--input') options.input = path.resolve(args[index + 1]);
    if (token === '--output') options.output = path.resolve(args[index + 1]);
    if (token === '--url-check') options.urlCheck = true;
    if (token === '--url-check-limit') options.urlCheckLimit = Number(args[index + 1]);
    if (token === '--url-check-timeout-ms') options.urlCheckTimeoutMs = Number(args[index + 1]);
  }
  return options;
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function decodeHtmlEntities(value) {
  const text = String(value || '');
  if (!text) return '';
  return text
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
    });
}

function normalizeInputText(value) {
  return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
}

function normalizePricing(model) {
  const raw = String(model || '').toLowerCase();
  if (raw.includes('free') && raw.includes('premium')) return ['freemium', '免费增值'];
  if (raw.includes('free') || raw.includes('免费')) return ['free', '免费'];
  return ['paid', '付费'];
}

const CATEGORY_META = {
  'lesson-planning': '备课助手',
  'ppt-generation': 'PPT生成',
  'quiz-generation': '题库生成',
  grading: '作业批改',
  'teaching-management': '教学管理',
  research: '教学管理',
};

const CATEGORY_KEYWORDS = {
  'lesson-planning': [
    'lesson plan', 'lesson planning', 'syllabus', 'curriculum', 'worksheet',
    'teaching material', 'teaching resources', 'homework', 'reading comprehension',
    'math worksheet', 'english worksheet', 'chinese worksheet',
    '教案', '备课', '教学设计', '课程设计', '课堂活动', '教学素材', '作业',
    '语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治',
  ],
  'ppt-generation': [
    'presentation', 'slide', 'powerpoint', 'deck', 'ppt', 'slides',
    'slide deck', 'presentation generator', 'slideshow',
    'class slides', 'teaching slides',
    '演示文稿', '幻灯片', '课件', 'PPT', '课堂课件',
  ],
  'quiz-generation': [
    'quiz', 'question bank', 'question', 'exam', 'test generator', 'multiple choice',
    'mcq', 'assessment generator', 'question generator',
    'practice test', 'assessment quiz', 'math quiz', 'english quiz',
    '题库', '出题', '测验', '试题', '考试', '练习题', '单元测验', '多项选择',
  ],
  grading: [
    'grading', 'assessment', 'rubric', 'feedback', 'evaluation',
    'homework grading', 'essay feedback', 'writing feedback',
    '批改', '评分', '评价', '反馈', '量规', '作文批改', '作业讲评',
  ],
  'teaching-management': [
    'lms', 'classroom management', 'school admin', 'attendance', 'analytics',
    'student management', 'parent communication', 'curriculum tracking',
    '教学管理', '班级管理', '排课', '学情分析', '教务', '班主任', '家校沟通',
  ],
};

const LEVEL_KEYWORDS = {
  elementary: [
    'elementary', 'primary school', 'k-6', 'k12', 'k-12', 'k-5', 'k-8', 'kids',
    '小学', '小学生', '低龄',
  ],
  secondary: [
    'secondary', 'middle school', 'high school', 'k12', 'k-12', 'grade 6', 'grade 7', 'grade 8', 'grade 9', 'grade 10', 'grade 11', 'grade 12', 'teen',
    '中学', '初中', '高中', '中学生',
  ],
  'higher-ed': [
    'higher education', 'university', 'college', 'research', 'academy',
    '高等教育', '大学', '高校', '研究生', '学术',
  ],
};

const EDUCATION_KEYWORDS = [
  'education', 'teacher', 'classroom', 'student', 'school', 'learning', 'lms',
  'tutor', 'curriculum', 'syllabus', 'homework', 'worksheet', 'lesson',
  'education ai', 'edtech', 'k12', 'k-12',
  'chinese language', 'english language', 'math', 'mathematics', 'science', 'stem', 'history', 'geography',
  '教育', '教师', '课堂', '学生', '学校', '教学', '学习', '学情', '作业', '教研',
  '语文', '数学', '英语', '科学', 'STEM', '历史', '地理', '课堂互动',
];

const SCENE_KEYWORDS = [
  ...CATEGORY_KEYWORDS['lesson-planning'],
  ...CATEGORY_KEYWORDS['ppt-generation'],
  ...CATEGORY_KEYWORDS['quiz-generation'],
  ...CATEGORY_KEYWORDS.grading,
  ...CATEGORY_KEYWORDS['teaching-management'],
];

const SOURCE_PRIOR_SCORE = {
  futurepedia: 6,
  theresanaiforthat: 6,
  producthunt: 4,
};

const ADMISSION_EDU_KEYWORDS = [
  'lesson plan', 'quiz', 'grading', 'lms', 'education', 'school', 'teacher', 'classroom',
  'tutor', 'worksheet', 'homework', 'curriculum', 'syllabus', 'lesson',
  'math', 'english', 'chinese', 'science', 'stem', 'history', 'geography',
  '教案', '备课', '题库', '出题', '批改', '评分', '教学', '课堂', '教师', '学校',
  '语文', '数学', '英语', '科学', '历史', '地理',
];

const ADMISSION_GENERIC_HIGH_FIT = [
  'ppt', 'presentation', 'slide', 'powerpoint',
  'document', 'docs', 'notion', 'word', '文档',
  'automation', 'workflow', 'agent', '自动化',
  'chatbot', 'assistant', 'copilot', 'writing', 'reading', 'transcript',
  'problem solver', 'exam prep', 'study', 'revision',
  '课件', '演示文稿', '幻灯片',
  '写作', '阅读', '口语', '听力', '解题', '备考',
];

const NAME_TRANSLATIONS = {
  Curipod: 'Curipod课堂互动',
  Diffit: 'Diffit分层材料助手',
  Khanmigo: 'Khanmigo学习导师',
  'MagicSchool AI': 'MagicSchool教师助手',
  'Eduaide.ai': 'Eduaide教学设计助手',
};

const PHRASE_TRANSLATIONS = [
  ['connect ai workflows', '连接AI工作流'],
  ['build ai literacy', '构建AI素养'],
  ['develop ai readiness', '提升AI就绪能力'],
  ['lesson plan generator', '教案生成器'],
  ['presentation generator', '演示文稿生成器'],
  ['worksheet generator', '工作表生成器'],
  ['rubric maker', '评分量规生成器'],
  ['multiple choice quiz maker', '多项选择测验生成器'],
  ['multiple choice quiz', '多项选择测验'],
  ['multiple choice', '多项选择'],
  ['create anything tool', '万能创作工具'],
  ['quiz generator', '题库生成器'],
  ['ai literacy', 'AI素养'],
  ['ai readiness', 'AI就绪能力'],
  ['ai workflows', 'AI工作流'],
  ['workflows', '工作流'],
  ['special educators and ell teachers', '特殊教育与ELL教师'],
  ['special educators and ell teacher', '特殊教育与ELL教师'],
  ['special educators', '特殊教育教师'],
  ['lesson plan', '教案'],
  ['lesson planning', '备课设计'],
  ['quiz maker', '测验生成器'],
  ['quiz', '测验'],
  ['maker', '生成器'],
  ['generator', '生成器'],
  ['grading', '作业评价'],
  ['assessment', '评价'],
  ['special educator', '特殊教育教师'],
  ['ell teacher', 'ELL教师'],
  ['teacher', '教师'],
  ['teachers', '教师'],
  ['student', '学生'],
  ['students', '学生'],
  ['classroom', '课堂'],
  ['school', '学校'],
  ['education', '教育'],
  ['learning', '学习'],
  ['tutor', '导师'],
  ['ppt', 'PPT'],
  ['presentation', '演示文稿'],
  ['automation', '自动化'],
  ['workflow', '工作流'],
];

const TITLE_BAD_PATTERNS = [
  'for teachers',
  'for students',
  'see all',
  "what's new",
  'winter release',
  'featured resource',
  'read whitepaper',
  'explore the findings',
  'read white paper',
  'schools & districts',
  'schools and districts',
  'elementary teachers',
  'english teachers',
  'math teachers',
  'google teachers',
  'click here',
];

function normalizeCategoryKey(raw) {
  const key = String(raw || '').trim().toLowerCase();
  const alias = {
    'lesson-planning': 'lesson-planning',
    'lesson planning': 'lesson-planning',
    'ppt-generation': 'ppt-generation',
    'ppt generation': 'ppt-generation',
    'quiz-generation': 'quiz-generation',
    'quiz generation': 'quiz-generation',
    grading: 'grading',
    assessment: 'grading',
    'teaching-management': 'teaching-management',
    'teaching management': 'teaching-management',
    research: 'teaching-management',
  };
  return alias[key] || key;
}

function normalizeCategory(raw) {
  const key = normalizeCategoryKey(raw);
  if (CATEGORY_META[key]) return [key, CATEGORY_META[key]];
  return ['lesson-planning', CATEGORY_META['lesson-planning']];
}

function containsAny(text, keywords) {
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

function countMatches(text, keywords) {
  const matched = new Set();
  keywords.forEach((kw) => {
    if (text.includes(kw.toLowerCase())) matched.add(kw);
  });
  return matched.size;
}

function matchKeywords(text, keywords) {
  return keywords.filter((kw) => text.includes(kw.toLowerCase()));
}

function hasChinese(text) {
  return /[\u4e00-\u9fa5]/.test(String(text || ''));
}

function looksBadTitle(text) {
  const value = String(text || '').trim().toLowerCase();
  return TITLE_BAD_PATTERNS.some((bad) => value.includes(bad));
}

function looksPlaceholderDescription(text) {
  const value = normalizeInputText(text).toLowerCase();
  if (!value) return true;
  const badPatterns = [
    '网页抓取结果',
    'web crawl result',
    'crawl result',
    'scraped from',
    '抓取结果',
    'from magicschool',
    'from toolify',
    'from futurepedia',
    'from theresanaiforthat',
  ];
  return badPatterns.some((pattern) => value.includes(pattern));
}

function isOverGenericDescription(text) {
  const value = normalizeInputText(text).toLowerCase();
  if (!value) return true;
  const genericPatterns = [
    '使用 ai 辅助生成教案、课堂活动与教学素材',
    '适用于通用ai教学场景',
    '适用于小学、中学教学场景',
  ];
  return genericPatterns.some((pattern) => value.includes(pattern));
}

function translateTextToChinese(text) {
  const source = normalizeInputText(text);
  if (!source) return source;
  if (hasChinese(source)) return source;

  let translated = source;
  PHRASE_TRANSLATIONS.forEach(([from, to]) => {
    const pattern = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    translated = translated.replace(pattern, to);
  });

  const mostlyAscii = /^[\x00-\x7F\s.,:;!?()\-_/&%+]+$/.test(translated);
  if (mostlyAscii) {
    return '';
  }
  return translated;
}

function translateNameToChinese(name) {
  const source = normalizeInputText(name);
  if (!source) return source;
  if (NAME_TRANSLATIONS[source]) return NAME_TRANSLATIONS[source];

  let translated = source;
  PHRASE_TRANSLATIONS.forEach(([from, to]) => {
    const pattern = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    translated = translated.replace(pattern, to);
  });

  translated = translated
    .replace(/\b(for|and|with|the|of|to)\b/gi, ' ')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+(生成器|助手|教师|学校|课堂|工具)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!hasChinese(translated)) return source;

  const cleaned = translated
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned || source;
}

function inferCategory(text) {
  const normalized = String(text || '').toLowerCase();
  const semanticBoost = {
    'ppt-generation': [
      { pattern: /\b(presentation|slide|slides|slide deck|powerpoint|ppt|slideshow)\b/i, weight: 2.2 },
      { pattern: /(演示文稿|幻灯片|课件)/, weight: 2.2 },
    ],
    'quiz-generation': [
      { pattern: /\b(quiz|multiple choice|mcq|question bank|question generator|assessment generator)\b/i, weight: 2.2 },
      { pattern: /(题库|测验|出题|多项选择|试题)/, weight: 2.2 },
    ],
    grading: [
      { pattern: /\b(rubric|grading|gradebook|feedback|assessment)\b/i, weight: 1.9 },
      { pattern: /(作业批改|评分|量规|评价|反馈)/, weight: 1.9 },
    ],
    'lesson-planning': [
      { pattern: /\b(lesson plan|lesson planning|worksheet|teaching material|curriculum)\b/i, weight: 1.8 },
      { pattern: /(教案|备课|教学设计|工作表|课堂活动)/, weight: 1.8 },
    ],
    'teaching-management': [
      { pattern: /\b(lms|classroom management|student management|analytics|school admin)\b/i, weight: 1.8 },
      { pattern: /(教学管理|班级管理|教务|排课|学情分析)/, weight: 1.8 },
    ],
  };

  const scores = Object.entries(CATEGORY_KEYWORDS).map(([category, kws]) => {
    const keywordScore = countMatches(normalized, kws);
    const boostRules = semanticBoost[category] || [];
    const boost = boostRules.reduce((acc, rule) => (rule.pattern.test(normalized) ? acc + rule.weight : acc), 0);
    return {
      category,
      score: keywordScore + boost,
    };
  });
  scores.sort((a, b) => b.score - a.score);
  if (!scores[0] || scores[0].score === 0) {
    return { category: 'lesson-planning', confidence: 0 };
  }
  const scoreGap = (scores[0]?.score || 0) - (scores[1]?.score || 0);
  const confidence = Math.max(0, Math.min(1, scoreGap >= 1.2 ? 1 : scores[0].score / 4));
  return {
    category: scores[0].category,
    confidence,
  };
}

function normalizeLevels(levels) {
  const allowed = ['elementary', 'secondary', 'higher-ed', 'general-ai'];
  const result = Array.from(new Set((Array.isArray(levels) ? levels : []).filter((item) => allowed.includes(item))));
  if (result.length === 0) return ['general-ai'];
  if (result.length > 1 && result.includes('general-ai')) return result.filter((item) => item !== 'general-ai');
  return result;
}

function inferLevels(text) {
  const inferred = Object.entries(LEVEL_KEYWORDS)
    .filter(([, kws]) => containsAny(text, kws))
    .map(([level]) => level);
  const unique = Array.from(new Set(inferred));
  if (unique.length === 0) return ['general-ai'];
  return unique;
}

function admissionCheck(record, text) {
  const eduHit = containsAny(text, ADMISSION_EDU_KEYWORDS);
  const genericHit = containsAny(text, ADMISSION_GENERIC_HIGH_FIT);
  const hasKnownCategory = Object.keys(CATEGORY_META).includes(normalizeCategoryKey(record.category || ''));

  return {
    passed: eduHit || genericHit || hasKnownCategory,
    matchedEduKeywords: matchKeywords(text, ADMISSION_EDU_KEYWORDS),
    matchedGenericKeywords: matchKeywords(text, ADMISSION_GENERIC_HIGH_FIT),
  };
}

function scoreEducation(record) {
  const text = [
    record.name,
    record.subtitle,
    record.description,
    record.category || '',
    record.categoryLabel || '',
    record.source || '',
    record.url || '',
  ]
    .join(' ')
    .toLowerCase();

  const admission = admissionCheck(record, text);
  if (!admission.passed) {
    return {
      total: 0,
      tier: 'excluded',
      breakdown: {
        keyword: 0,
        caseEvidence: 0,
        sceneFit: 0,
        levelFit: 0,
        quality: 0,
        sourcePrior: 0,
      },
      admission,
    };
  }

  const educationKeywordCount = countMatches(text, EDUCATION_KEYWORDS);
  const hasClassroomSignals = containsAny(text, ['teacher', 'school', 'classroom', '教师', '学校', '课堂']);
  const levelSignals = Object.values(LEVEL_KEYWORDS).filter((kws) => containsAny(text, kws)).length;

  const matchedSceneCount = Object.values(CATEGORY_KEYWORDS).reduce((acc, keywords) => {
    return acc + (containsAny(text, keywords) ? 1 : 0);
  }, 0);

  const scoreKeyword = Math.min(40, educationKeywordCount * 8); // 40%
  const sourcePrior = SOURCE_PRIOR_SCORE[record.source] || 0;
  const scoreCases = hasClassroomSignals ? 20 : 0; // 20%
  const scoreScene = Math.min(20, matchedSceneCount * 4); // 20%
  const scoreLevel = Math.min(10, levelSignals * 5); // 10%
  const popularityScore = Number(record.popularityScore || record.ratingCount || 0);
  const ratingScore = Number(record.ratingScore || 0);
  const scoreQuality = Math.min(10, Math.round((Math.min(5, ratingScore) / 5) * 6 + Math.min(4000, popularityScore) / 1000)); // 10%

  const total = Math.min(100, scoreKeyword + scoreCases + scoreScene + scoreLevel + scoreQuality + sourcePrior);

  let tier = 'excluded';
  if (total >= 60) tier = 'education-core';
  else if (total >= 40) tier = 'education-adaptable';

  return {
    total,
    tier,
    breakdown: {
      keyword: scoreKeyword,
      caseEvidence: scoreCases,
      sceneFit: scoreScene,
      levelFit: scoreLevel,
      quality: scoreQuality,
      sourcePrior,
    },
    admission,
  };
}

function qualityGate(record) {
  const name = String(record.name || '').trim();
  if (name.length < 2 || name.length > 60) return false;
  if (looksBadTitle(name)) return false;
  const lowerName = name.toLowerCase();
  const lowerUrl = String(record.url || '').toLowerCase();
  const personaLike =
    /(^|[\s-])(teacher|teachers|student|students|district|districts)([\s-]|$)/i.test(lowerName) &&
    !/(generator|maker|assistant|copilot|ai|tool|tools|平台|助手|生成器)/i.test(lowerName);
  const chinesePersonaLike =
    /(教师|学生|学区|院系|学校)/.test(name) &&
    !/(生成器|助手|工具|平台|系统|AI)/.test(name);
  if (personaLike || chinesePersonaLike) return false;
  if (lowerUrl.includes('/use-cases/')) return false;

  const hasLetters = /[a-zA-Z\u4e00-\u9fa5]/.test(name);
  if (!hasLetters) return false;

  const desc = String(record.description || '').trim().toLowerCase();
  const descHasEduHint = containsAny(desc, EDUCATION_KEYWORDS) || containsAny(desc, SCENE_KEYWORDS);
  const categoryKnown = Object.keys(CATEGORY_META).includes(normalizeCategoryKey(record.category || ''));

  return descHasEduHint || categoryKnown;
}

function hasUsableWebsite(url) {
  const value = String(url || '').trim().toLowerCase();
  if (!value || value === '#') return false;
  if (!/^https?:\/\//.test(value)) return false;
  if (value.includes('example.com')) return false;
  return true;
}

function sceneSummary(category) {
  const map = {
    'lesson-planning': '备课设计与课堂活动组织',
    'ppt-generation': '教学课件与PPT内容生成',
    'quiz-generation': '题库生成与课堂测验',
    grading: '作业评价与反馈生成',
    'teaching-management': '教学管理与班级运营',
  };
  return map[category] || '教学场景支持';
}

function levelSummary(levels) {
  const labels = {
    elementary: '小学',
    secondary: '中学',
    'higher-ed': '高等教育',
    'general-ai': '通用AI',
  };
  const mapped = (Array.isArray(levels) ? levels : []).map((lv) => labels[lv]).filter(Boolean);
  if (mapped.length === 0) return '通用AI';
  return mapped.join('、');
}

function buildProgrammaticDescription(tool) {
  const levelText = levelSummary(tool.teachingLevels);
  const map = {
    'lesson-planning': `使用 AI 辅助生成教案、课堂活动与教学素材，适用于${levelText}教学场景。`,
    'ppt-generation': `使用 AI 快速生成教学演示文稿与课堂可视化内容，适用于${levelText}课堂授课。`,
    'quiz-generation': `使用 AI 批量生成题库与随堂测验，支持${levelText}阶段的练习与评估。`,
    grading: `使用 AI 进行作业评价与反馈建议生成，帮助${levelText}阶段提升批改效率。`,
    'teaching-management': `使用 AI 辅助教学管理、学情跟踪与班级运营，服务于${levelText}教育场景。`,
  };
  return map[tool.category] || `使用 AI 提升${sceneSummary(tool.category)}效率，适用于${levelText}教育场景。`;
}

function buildNameAwareDescription(tool) {
  const nameText = `${tool.nameOriginal || ''} ${tool.name || ''}`.toLowerCase();
  const levelText = levelSummary(tool.teachingLevels);

  if (nameText.includes('worksheet') || nameText.includes('工作表')) {
    return `围绕课程主题自动生成分层工作表与课堂练习，适用于${levelText}教学活动。`;
  }
  if (nameText.includes('rubric') || nameText.includes('grading') || nameText.includes('量规')) {
    return `根据评分标准生成评价量规与反馈建议，帮助${levelText}阶段提升作业评价效率。`;
  }
  if (nameText.includes('lesson plan') || nameText.includes('lesson planning') || nameText.includes('教案')) {
    return `根据教学目标快速生成教案、活动流程与讲授要点，服务${levelText}备课设计。`;
  }
  if (nameText.includes('presentation') || nameText.includes('slide') || nameText.includes('ppt') || nameText.includes('演示文稿') || nameText.includes('幻灯片')) {
    return `将教学主题转化为结构化演示文稿，帮助${levelText}课堂高效完成课件制作。`;
  }
  if (nameText.includes('quiz') || nameText.includes('question') || nameText.includes('测验') || nameText.includes('题库')) {
    return `基于课程内容自动产出测验题目与题库，支持${levelText}课堂练习与阶段评估。`;
  }
  if (nameText.includes('workflow') || nameText.includes('automation') || nameText.includes('工作流')) {
    return `连接教学相关 AI 工作流与自动化流程，提升${levelText}场景下的教务执行效率。`;
  }
  if (nameText.includes('ai literacy') || nameText.includes('ai素养')) {
    return `面向${levelText}教育场景构建 AI 素养能力，帮助教师与学生理解并规范使用生成式AI工具。`;
  }
  if (nameText.includes('ai readiness') || nameText.includes('ai就绪')) {
    return `提供学校 AI 落地准备支持，包括教师培训、实施路径与课堂使用规范，服务${levelText}场景。`;
  }

  return buildProgrammaticDescription(tool);
}

function buildSearchTags(tool) {
  const levelLabels = {
    elementary: '小学教育',
    secondary: '中学教育',
    'higher-ed': '高等教育',
    'general-ai': '通用AI',
  };

  const tags = [];
  const normalizedLevels = Array.isArray(tool.teachingLevels) ? tool.teachingLevels : [];
  const resolvedLevels = normalizedLevels.length > 0 ? normalizedLevels : ['general-ai'];
  resolvedLevels
    .map((lv) => levelLabels[lv])
    .filter(Boolean)
    .slice(0, 2)
    .forEach((levelTag) => tags.push(levelTag));

  if (tool.categoryLabel) tags.push(tool.categoryLabel);

  return Array.from(new Set(tags)).slice(0, 3);
}

function normalizeDetailText(text) {
  const source = String(text || '').trim();
  if (!source) return '';
  const localized = translateTextToChinese(source);
  if (localized && localized.length > 8 && !looksPlaceholderDescription(localized)) return localized;
  return source;
}

function firstValidDetailText(values = []) {
  const list = Array.isArray(values) ? values : [];
  for (const item of list) {
    const text = normalizeDetailText(item);
    if (!text) continue;
    if (looksPlaceholderDescription(text)) continue;
    if (looksBadTitle(text)) continue;
    if (String(text).trim().length < 12) continue;
    return text;
  }
  return '';
}

function normalizeDetailList(values, limit = 4) {
  if (!Array.isArray(values)) return [];
  const bucket = [];
  const seen = new Set();
  const detailBadPatterns = [
    'for teachers save time',
    'for students give students',
    'featured resource',
    'read white paper',
    'explore the findings',
    '网页抓取结果',
  ];
  for (const item of values) {
    const text = normalizeDetailText(item);
    if (!text) continue;
    const lower = text.toLowerCase();
    if (detailBadPatterns.some((bad) => lower.includes(bad))) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    bucket.push(text);
    if (bucket.length >= limit) break;
  }
  return bucket;
}

function normalizePricingPlans(values) {
  if (!Array.isArray(values)) return [];
  const plans = [];
  for (const item of values) {
    const name = normalizeDetailText(item?.name || '');
    const price = normalizeDetailText(item?.price || '');
    const desc = normalizeDetailText(item?.desc || '');
    if (!name && !price && !desc) continue;
    plans.push({ name, price, desc });
    if (plans.length >= 4) break;
  }
  return plans;
}

function clausesFromDescription(description, limit = 3) {
  const text = String(description || '').trim();
  if (!text) return [];
  const split = text
    .split(/[。；;.!?]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8 && item.length <= 80);
  return split.slice(0, limit);
}

function buildProgrammaticFeatures(tool, description = '') {
  const descClauses = clausesFromDescription(description, 3);
  if (descClauses.length > 0) return descClauses;
  const map = {
    'lesson-planning': ['自动生成教案与课堂流程', '提供分层练习与教学材料改写', '支持课堂目标对齐与进度追踪'],
    'ppt-generation': ['根据主题生成教学演示文稿', '自动优化版式与课堂可视化内容', '支持图文内容快速整理与导出'],
    'quiz-generation': ['批量生成章节题库与随堂测验', '支持难度分层与题型组合', '提供答题结果分析与错题定位'],
    grading: ['按评分标准进行自动初评', '生成个性化反馈建议', '提升批改效率并缩短反馈周期'],
    'teaching-management': ['提供教学任务与班级管理支持', '汇总学情数据并形成看板', '辅助排课与教学协同'],
  };
  return (map[tool.category] || ['支持常见教学场景的 AI 能力', '可用于课堂实施与教学优化', '帮助教师提升教学效率']).slice(0, 4);
}

function buildProgrammaticUseCases(tool, description = '') {
  const levelText = levelSummary(tool.teachingLevels);
  const descClauses = clausesFromDescription(description, 2);
  if (descClauses.length > 0) {
    return descClauses.map((item) => `在${levelText}教学场景中可用于：${item}`);
  }
  const map = {
    'lesson-planning': [`在${levelText}场景下快速生成课堂导入与活动设计`, '用于课前备课与课后复盘优化'],
    'ppt-generation': [`在${levelText}课程中快速制作授课PPT`, '用于公开课与教研汇报的内容整理'],
    'quiz-generation': [`在${levelText}教学中进行随堂测验与阶段评估`, '用于错题复训与题库扩充'],
    grading: [`在${levelText}课堂中完成作业评价与反馈`, '用于批量批改与个性化建议生成'],
    'teaching-management': [`在${levelText}阶段进行教学管理与学情跟踪`, '用于班级任务协同与进度提醒'],
  };
  return (map[tool.category] || [`在${levelText}教育场景中辅助教学实施`, '用于提升日常教学组织效率']).slice(0, 3);
}

function buildProgrammaticPricingPlans(tool) {
  const officialPlan = { name: '官网方案', price: '以官网为准', desc: '该工具价格可能随版本与地区变化，请访问官网查看最新报价。' };
  const trialPlan = { name: '试用信息', price: tool.pricingModel === 'free' ? '免费' : '请查看官网', desc: '是否提供免费试用由官方页面实时发布。' };
  return [officialPlan, trialPlan];
}

function toTool(record) {
  const safeName = normalizeInputText(record.name || '');
  const safeSubtitle = normalizeInputText(record.subtitle || '');
  const safeDescription = normalizeInputText(record.description || '');
  const safeOverview = normalizeInputText(record.overview || '');
  const text = [safeName, safeSubtitle, safeDescription, safeOverview].join(' ').toLowerCase();
  const inferredCategory = inferCategory(text);
  const sourceCategoryRaw = normalizeCategoryKey(record.category || '');
  const categoryRaw = inferredCategory.confidence > 0 ? inferredCategory.category : (sourceCategoryRaw || inferredCategory.category);
  const [category, categoryLabel] = normalizeCategory(categoryRaw);
  const [pricingModel, pricingLabel] = normalizePricing(record.pricingModel || 'paid');
  const inferredLevels = inferLevels(text);
  const finalLevels = normalizeLevels(inferredLevels);
  const eduScore = scoreEducation({
    ...record,
    category,
    categoryLabel,
    popularityScore: record.popularityScore,
  });
  const localizedName = translateNameToChinese(safeName || record.name);
  const detailCandidate = firstValidDetailText([
    safeDescription || '',
    safeOverview || '',
    ...(Array.isArray(record.features) ? record.features.slice(0, 2) : []),
    ...(Array.isArray(record.useCases) ? record.useCases.slice(0, 1) : []),
  ]);

  let localizedDescription = translateTextToChinese(detailCandidate || safeDescription || '');
  const originalName = safeName || record.name;
  const originalDescription = safeDescription || '';

  if (
    !localizedDescription ||
    looksBadTitle(localizedDescription) ||
    localizedDescription.length < 18 ||
    looksPlaceholderDescription(localizedDescription) ||
    looksPlaceholderDescription(originalDescription) ||
    isOverGenericDescription(localizedDescription)
  ) {
    localizedDescription = buildNameAwareDescription({
      category,
      teachingLevels: finalLevels,
      name: localizedName,
      nameOriginal: originalName,
    });
  }

  const overviewRaw = safeOverview || '';
  const overview = normalizeDetailText(overviewRaw) || localizedDescription;
  const features = normalizeDetailList(record.features, 4);
  const useCases = normalizeDetailList(record.useCases, 3);
  const pricingPlans = normalizePricingPlans(record.pricingPlans);
  const finalFeatures = features.length > 0 ? features : buildProgrammaticFeatures({ category, teachingLevels: finalLevels }, localizedDescription);
  const finalUseCases = useCases.length > 0 ? useCases : buildProgrammaticUseCases({ category, teachingLevels: finalLevels }, localizedDescription);
  const finalPricingPlans = pricingPlans.length > 0 ? pricingPlans : buildProgrammaticPricingPlans({ pricingModel });

  const normalizedSubtitle = safeSubtitle && safeSubtitle !== originalName ? safeSubtitle : '';

  return {
    id: slugify(record.id || record.name),
    name: localizedName || safeName || record.name,
    subtitle: normalizedSubtitle,
    description: localizedDescription || safeDescription || '',
    nameOriginal: originalName,
    descriptionOriginal: originalDescription,
    url: record.url || '#',
    category,
    categoryLabel,
    teachingLevels: finalLevels,
    pricingModel,
    pricingLabel,
    ratingScore: Number(record.ratingScore || 0),
    ratingCount: Number(record.ratingCount || 0),
    popularityScore: Number(record.popularityScore || record.ratingCount || 0),
    publishedAt: record.publishedAt || '2026-01-01',
    icon: record.icon || 'apps',
    iconColorClass: record.iconColorClass || 'bg-slate-100 dark:bg-slate-700 text-slate-600',
    badge: record.badge || null,
    overview,
    overviewOriginal: overviewRaw,
    features: finalFeatures,
    useCases: finalUseCases,
    pricingPlans: finalPricingPlans,
    educationScore: eduScore.total,
    educationTier: eduScore.tier,
    educationScoreBreakdown: eduScore.breakdown,
    admission: eduScore.admission,
    searchTags: [],
    classification: {
      category,
      categoryLabel,
      teachingLevels: finalLevels,
      categoryConfidence: Number(inferredCategory.confidence.toFixed(2)),
    },
    source: record.source || 'unknown',
    sourceUrl: record.sourceUrl || '',
    isPriority: Boolean(record.isPriority),
    priorityRank: Number(record.priorityRank || 0),
  };
}

function dedupe(items) {
  const bucket = new Map();

  items.forEach((item) => {
    const key = item.source === 'curated-manual'
      ? `curated:${item.id || item.name}`
      : (item.url && item.url !== '#' ? item.url : item.name);
    const current = bucket.get(key);
    if (!current) {
      bucket.set(key, item);
      return;
    }

    const currentScore = current.popularityScore + current.ratingScore * 10;
    const nextScore = item.popularityScore + item.ratingScore * 10;
    if (nextScore > currentScore) {
      bucket.set(key, item);
    }
  });

  return Array.from(bucket.values());
}

function toolKey(item) {
  if (item.source === 'curated-manual' || item.isPriority) {
    const id = String(item.id || '').trim().toLowerCase();
    if (id) return `curated:${id}`;
  }
  const url = String(item.url || '').trim().toLowerCase();
  if (url && url !== '#') return `url:${url}`;
  const name = String(item.nameOriginal || item.name || '').trim().toLowerCase();
  const subtitle = String(item.subtitle || '').trim().toLowerCase();
  return `name:${name}|${subtitle}`;
}

async function isUrlUnavailable(url, timeoutMs) {
  if (!url || url === '#') return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': 'AIedu2-link-check/1.0',
      },
    });

    if (response.status === 404 || response.status === 410) return true;
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const options = parseArgs();
  const raw = JSON.parse(await fs.readFile(options.input, 'utf8'));
  const records = Array.isArray(raw.tools) ? raw.tools : [];
  const previous = await readJsonSafe(options.output, { tools: [] });
  const previousTools = Array.isArray(previous.tools) ? previous.tools : [];
  const now = new Date().toISOString();

  const normalized = dedupe(records.map(toTool)).sort((a, b) => b.popularityScore - a.popularityScore);
  const curatedRaw = await readJsonSafe(CURATED_INPUT, { tools: [] });
  const curatedRecords = Array.isArray(curatedRaw.tools) ? curatedRaw.tools : [];
  const curatedNormalized = dedupe(
    curatedRecords.map((item, index) => {
      const isPriority = item.isPriority !== false;
      return toTool({
        ...item,
        source: 'curated-manual',
        isPriority,
        priorityRank: isPriority ? index + 1 : 0,
      });
    })
  );
  let published = normalized
    .filter((item) => hasUsableWebsite(item.url))
    .filter((item) => item.educationTier !== 'excluded')
    .filter((item) => qualityGate(item));
  let fallbackUsed = false;

  if (published.length === 0) {
    published = curatedNormalized.filter((item) => item.educationTier !== 'excluded');
    fallbackUsed = true;
  }

  const currentMap = new Map(published.map((item) => [toolKey(item), item]));
  const mergedMap = new Map();

  // 1) New crawl results override previous records with same key.
  currentMap.forEach((item, key) => {
    const prev = previousTools.find((p) => toolKey(p) === key);
    mergedMap.set(key, {
      ...prev,
      ...item,
      firstSeenAt: prev?.firstSeenAt || prev?.lastSeenAt || prev?.updatedAt || now,
      lastSeenAt: now,
      missCount: 0,
      status: 'active',
    });
  });

  // 2) Keep historical tools not found this run; optionally drop if URL is gone.
  let urlCheckUsed = 0;
  const droppedKeys = [];
  for (const prev of previousTools) {
    const key = toolKey(prev);
    if (mergedMap.has(key)) continue;

    const nextMiss = Number(prev.missCount || 0) + 1;
    let shouldDrop = false;
    if (options.urlCheck && urlCheckUsed < options.urlCheckLimit) {
      urlCheckUsed += 1;
      shouldDrop = await isUrlUnavailable(prev.url, options.urlCheckTimeoutMs);
    }

    if (shouldDrop) {
      droppedKeys.push(key);
      continue;
    }

    mergedMap.set(key, {
      ...prev,
      firstSeenAt: prev.firstSeenAt || prev.lastSeenAt || prev.updatedAt || now,
      missCount: nextMiss,
      status: 'active',
      lastSeenAt: prev.lastSeenAt || prev.updatedAt || now,
    });
  }

  const mergedPublished = Array.from(mergedMap.values())
    .map((item) => toTool(item))
    .filter(Boolean)
    .filter((item) => hasUsableWebsite(item.url))
    .filter((item) => item.educationTier !== 'excluded')
    .filter((item) => qualityGate(item));

  const mergedPublishedMap = new Map(mergedPublished.map((item) => [toolKey(item), item]));

  // 3) Always upsert curated priority tools and ensure they win over same URL/name records.
  for (const curated of curatedNormalized) {
    const curatedUrl = String(curated.url || '').trim().toLowerCase();
    const curatedName = String(curated.name || '').trim().toLowerCase();
    for (const [key, item] of mergedPublishedMap.entries()) {
      if (item.source === 'curated-manual') continue;
      const itemUrl = String(item.url || '').trim().toLowerCase();
      const itemName = String(item.name || '').trim().toLowerCase();
      const sameUrl = curatedUrl && itemUrl && curatedUrl === itemUrl;
      const sameName = curatedName && itemName && curatedName === itemName;
      if (sameUrl || sameName) {
        mergedPublishedMap.delete(key);
      }
    }
    mergedPublishedMap.set(toolKey(curated), {
      ...curated,
      source: 'curated-manual',
      isPriority: Boolean(curated.isPriority),
      priorityRank: Number(curated.priorityRank || 0),
      firstSeenAt: now,
      lastSeenAt: now,
      missCount: 0,
      status: 'active',
    });
  }

  const mergedPublishedFinal = Array.from(mergedPublishedMap.values()).sort((a, b) => {
    const ap = Number(Boolean(a.isPriority));
    const bp = Number(Boolean(b.isPriority));
    if (ap !== bp) return bp - ap;
    const ar = Number(a.priorityRank || 999999);
    const br = Number(b.priorityRank || 999999);
    if (ar !== br) return ar - br;
    return (b.popularityScore || 0) - (a.popularityScore || 0);
  });
  const tierStats = normalized.reduce(
    (acc, item) => {
      const tier = item.educationTier || 'excluded';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    },
    { 'education-core': 0, 'education-adaptable': 0, excluded: 0 }
  );
  const publishedTierStats = mergedPublishedFinal.reduce(
    (acc, item) => {
      const tier = item.educationTier || 'excluded';
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    },
    { 'education-core': 0, 'education-adaptable': 0, excluded: 0 }
  );

  const output = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    stats: {
      totalRaw: normalized.length,
      totalPublished: mergedPublishedFinal.length,
      fallbackUsed,
      mergeMode: 'retain-history-and-upsert',
      retainedFromHistory: mergedPublishedFinal.length - published.length,
      droppedByUrlCheck: droppedKeys.length,
      urlCheckEnabled: options.urlCheck,
      urlCheckUsed,
      rawTiers: tierStats,
      publishedTiers: publishedTierStats,
    },
    tools: mergedPublishedFinal.map((item) => {
      const description = looksPlaceholderDescription(item.description) || String(item.description || '').trim().length < 18
        ? buildNameAwareDescription(item)
        : (isOverGenericDescription(item.description) ? buildNameAwareDescription(item) : item.description);
      return {
        ...item,
        description,
        searchTags: buildSearchTags(item),
      };
    }),
  };

  await fs.writeFile(options.output, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`updated: ${options.output}`);
  console.log(`tools(raw): ${normalized.length}`);
  console.log(`tools(published): ${published.length}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
