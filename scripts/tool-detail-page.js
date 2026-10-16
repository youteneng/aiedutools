import { getStageShortLabel } from './tool-taxonomy.js';
import { escapeHtml, formatCount, hasUsableWebsite, renderStarsHtml, renderTagChip } from './tool-ui-utils.js';

const els = {
  toolName: document.querySelector('#toolName'),
  toolBadge: document.querySelector('#toolBadge'),
  toolDescription: document.querySelector('#toolDescription'),
  toolIconWrap: document.querySelector('#toolIconWrap'),
  toolIcon: document.querySelector('#toolIcon'),
  toolStars: document.querySelector('#toolStars'),
  toolScore: document.querySelector('#toolScore'),
  toolReviewCount: document.querySelector('#toolReviewCount'),
  toolUpdatedText: document.querySelector('#toolUpdatedText'),
  overviewText: document.querySelector('#overviewText'),
  featuresGrid: document.querySelector('#featuresGrid'),
  useCasesContainer: document.querySelector('#useCasesContainer'),
  ratingSummaryScore: document.querySelector('#ratingSummaryScore'),
  ratingSummaryStars: document.querySelector('#ratingSummaryStars'),
  ratingBars: document.querySelector('#ratingBars'),
  reviewList: document.querySelector('#reviewList'),
  pricingPlans: document.querySelector('#pricingPlans'),
  relatedTools: document.querySelector('#relatedTools'),
  visitWebsiteBtn: document.querySelector('#visitWebsiteBtn'),
  copyLinkBtn: document.querySelector('#copyLinkBtn'),
  headerSearchInput: document.querySelector('#headerSearchInput'),
};

const STORAGE_KEYS = {
  favorites: 'aiedu:favorites:v1',
  reviewsPrefix: 'aiedu:reviews:v1:',
};

const CATEGORY_FEATURES = {
  'lesson-planning': [
    { icon: 'description', title: '教案生成', desc: '根据教学目标自动生成结构化教案与课堂流程。' },
    { icon: 'auto_stories', title: '材料改写', desc: '将复杂内容改写为适合不同学段的教学版本。' },
    { icon: 'quiz', title: '课堂练习', desc: '快速生成配套练习与课后巩固题目。' },
    { icon: 'analytics', title: '进度追踪', desc: '按课堂目标跟踪学习进度与知识薄弱点。' },
  ],
  'ppt-generation': [
    { icon: 'present_to_all', title: '课件生成', desc: '将提纲一键转为课堂演示文稿与板书结构。' },
    { icon: 'palette', title: '视觉优化', desc: '自动匹配教学主题风格，提升课堂可视化表达。' },
    { icon: 'image', title: '图文增强', desc: '生成教学配图、图表与重点信息提示。' },
    { icon: 'translate', title: '多语演示', desc: '支持多语言课件输出，服务不同语言背景学生。' },
  ],
  'quiz-generation': [
    { icon: 'quiz', title: '题库生成', desc: '基于课程内容批量生成单选、填空与问答题。' },
    { icon: 'rule', title: '难度分层', desc: '按学生能力自动分层题目，支持差异化教学。' },
    { icon: 'task_alt', title: '自动组卷', desc: '按章节与目标快速组卷并支持导出。' },
    { icon: 'insights', title: '答题分析', desc: '统计错题分布，辅助教师精准查漏补缺。' },
  ],
  grading: [
    { icon: 'grading', title: '自动批改', desc: '按评分标准自动完成主观题与客观题初评。' },
    { icon: 'chat', title: '反馈建议', desc: '为每位学生生成可操作的改进建议。' },
    { icon: 'tune', title: '评分规则', desc: '支持教师自定义评分维度与权重。' },
    { icon: 'schedule', title: '批改提效', desc: '减少重复性工作，缩短反馈返回周期。' },
  ],
  'teaching-management': [
    { icon: 'dashboard', title: '班级看板', desc: '集中查看课堂活跃度、作业与学情趋势。' },
    { icon: 'groups', title: '学生分组', desc: '按能力与目标自动推荐分组与教学策略。' },
    { icon: 'event_note', title: '教学计划', desc: '支持周计划、月计划与教研任务协同。' },
    { icon: 'notifications', title: '提醒联动', desc: '自动推送任务提醒，保障教学节奏落地。' },
  ],
};

const CATEGORY_SCENES = {
  'lesson-planning': [
    { level: '中学', label: '推荐用途：课堂设计', title: '生成分层教学活动', desc: '基于同一主题快速生成基础版与进阶版课堂活动。' },
    { level: '小学', label: '推荐用途：课堂导入', title: '创设情境化导入问题', desc: '围绕课程重点自动生成贴近生活的导入提问。' },
  ],
  'ppt-generation': [
    { level: '中学', label: '推荐用途：可视化讲解', title: '复杂概念图示化', desc: '把抽象知识自动转为图文页与步骤页。' },
    { level: '高等教育', label: '推荐用途：课程汇报', title: '快速形成课程演示', desc: '根据课程大纲自动生成结构清晰的课堂演示稿。' },
  ],
  'quiz-generation': [
    { level: '中学', label: '推荐用途：随堂检测', title: '章节测验快速生成', desc: '围绕章节目标一键产出随堂测验。' },
    { level: '高等教育', label: '推荐用途：阶段评估', title: '形成性评估题组', desc: '生成覆盖知识点的题组并附参考解析。' },
  ],
  grading: [
    { level: '中学', label: '推荐用途：作文反馈', title: '主观题自动初评', desc: '先完成结构、逻辑、表达维度初评，再由教师复核。' },
    { level: '小学', label: '推荐用途：作业点评', title: '个性化学习建议', desc: '针对常见错误自动输出鼓励式反馈。' },
  ],
  'teaching-management': [
    { level: '中学', label: '推荐用途：班级治理', title: '班级任务与进度协同', desc: '将作业、测验与课堂任务统一管理。' },
    { level: '高等教育', label: '推荐用途：学情追踪', title: '学情趋势预警', desc: '基于课堂行为和作业数据提供风险预警。' },
  ],
};

const state = {
  tool: null,
  tools: [],
  userReviews: [],
  isFavorite: false,
};

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function relativeDays(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '更新于近期';
  const diff = Date.now() - date.getTime();
  const days = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  return `更新于 ${days} 天前`;
}

function pickBadge(tool) {
  if (tool.badge?.label) return tool.badge.label;
  if (Number(tool.ratingScore || 0) >= 4.7) return '高分推荐';
  if (Number(tool.educationScore || 0) >= 60) return '官方认证';
  return '';
}

function levelLabel(levelKey) {
  return getStageShortLabel(levelKey);
}

function toolStorageKey(tool) {
  const base = String(tool.id || tool.url || tool.name || '').trim();
  return base || 'unknown-tool';
}

function getFavorites() {
  const raw = localStorage.getItem(STORAGE_KEYS.favorites);
  const value = safeJsonParse(raw, []);
  return Array.isArray(value) ? value : [];
}

function setFavorites(items) {
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(items));
}

function readUserReviews(tool) {
  const key = `${STORAGE_KEYS.reviewsPrefix}${toolStorageKey(tool)}`;
  const raw = localStorage.getItem(key);
  const items = safeJsonParse(raw, []);
  return Array.isArray(items) ? items : [];
}

function writeUserReviews(tool, reviews) {
  const key = `${STORAGE_KEYS.reviewsPrefix}${toolStorageKey(tool)}`;
  localStorage.setItem(key, JSON.stringify(reviews));
}

function computeAggregatedRating(tool, userReviews) {
  const baseCount = Number(tool.ratingCount || 0);
  const baseScore = Number(tool.ratingScore || 0);
  const userCount = userReviews.length;
  const userTotal = userReviews.reduce((sum, item) => sum + Number(item.rating || 0), 0);
  const totalCount = baseCount + userCount;
  const totalScore = totalCount > 0 ? (baseScore * baseCount + userTotal) / totalCount : 0;
  return { totalScore, totalCount };
}

function buildRatingDistribution(score) {
  const s = Number(score || 0);
  const five = Math.max(50, Math.min(90, Math.round(60 + s * 5)));
  const four = Math.max(5, Math.min(25, Math.round(20 - (s - 3) * 3)));
  const three = Math.max(2, Math.min(12, Math.round(100 - five - four - 4)));
  const two = 2;
  const one = Math.max(1, 100 - five - four - three - two);
  return [five, four, three, two, one];
}

function renderFeatures(tool) {
  const fromCrawler = Array.isArray(tool.features) ? tool.features.filter(Boolean) : [];
  if (fromCrawler.length > 0) {
    const iconPool = ['description', 'quiz', 'translate', 'analytics', 'auto_awesome', 'settings'];
    els.featuresGrid.innerHTML = fromCrawler
      .slice(0, 6)
      .map((text, idx) => `
        <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex items-start gap-4">
          <div class="bg-primary/10 p-2 rounded-lg text-primary">
            <span class="material-symbols-outlined">${iconPool[idx % iconPool.length]}</span>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white">功能 ${idx + 1}</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">${text}</p>
          </div>
        </div>
      `)
      .join('');
    return;
  }

  const features = CATEGORY_FEATURES[tool.category] || CATEGORY_FEATURES['lesson-planning'];
  els.featuresGrid.innerHTML = features
    .map((item) => `
      <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex items-start gap-4">
        <div class="bg-primary/10 p-2 rounded-lg text-primary">
          <span class="material-symbols-outlined">${item.icon}</span>
        </div>
        <div>
          <h3 class="font-bold text-slate-900 dark:text-white">${item.title}</h3>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">${item.desc}</p>
        </div>
      </div>
    `)
    .join('');
}

function renderUseCases(tool) {
  const fromCrawler = Array.isArray(tool.useCases) ? tool.useCases.filter(Boolean) : [];
  if (fromCrawler.length > 0) {
    els.useCasesContainer.innerHTML = fromCrawler
      .slice(0, 3)
      .map((text, index) => `
      <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
        <div class="flex items-center justify-between mb-4">
          ${renderTagChip(levelLabel((tool.teachingLevels || [])[0]), 'text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full')}
          <span class="text-slate-400 text-xs">推荐用途 ${index + 1}</span>
        </div>
        <h3 class="text-lg font-bold mb-2">教学场景 ${index + 1}</h3>
        <p class="text-slate-600 dark:text-slate-400">${escapeHtml(text)}</p>
      </div>
    `)
      .join('');
    return;
  }

  const cases = CATEGORY_SCENES[tool.category] || CATEGORY_SCENES['lesson-planning'];
  els.useCasesContainer.innerHTML = cases
    .map((item) => `
      <div class="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <span class="text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">${item.level}</span>
          <span class="text-slate-400 text-xs">${item.label}</span>
        </div>
        <h3 class="text-lg font-bold mb-2">${item.title}</h3>
        <p class="text-slate-600 dark:text-slate-400">${item.desc}</p>
      </div>
    `)
    .join('');
}

function renderPricing(tool) {
  const crawlerPlans = Array.isArray(tool.pricingPlans) ? tool.pricingPlans.filter((p) => p && (p.name || p.price || p.desc)) : [];
  if (crawlerPlans.length > 0) {
    els.pricingPlans.innerHTML = crawlerPlans
      .slice(0, 4)
      .map((plan, idx) => `
        <div class="p-3 rounded-lg ${idx === 0 ? 'border-2 border-primary bg-primary/5' : 'border border-slate-200 dark:border-slate-700'}">
          <div class="flex justify-between items-center mb-1">
            <span class="font-bold">${plan.name || `方案 ${idx + 1}`}</span>
            <span class="text-sm font-bold">${plan.price || '定制报价'}</span>
          </div>
          <p class="text-xs text-slate-500">${plan.desc || '详情请访问官网查看最新价格。'}</p>
        </div>
      `)
      .join('');
    return;
  }

  const plansByModel = {
    free: [
      { name: '官网方案', price: '以官网为准', desc: '该工具实时价格请以官网展示为准。', active: true },
      { name: '试用信息', price: '免费/请查看官网', desc: '是否提供免费试用由官方页面实时发布。' },
    ],
    freemium: [
      { name: '官网方案', price: '以官网为准', desc: '该工具实时价格请以官网展示为准。', active: true },
      { name: '试用信息', price: '请查看官网', desc: '套餐与额度可能随时间调整。' },
    ],
    paid: [
      { name: '官网方案', price: '以官网为准', desc: '该工具实时价格请以官网展示为准。', active: true },
      { name: '企业/学校版', price: '请查看官网', desc: '企业或学校计划通常需联系官方获取报价。' },
    ],
  };

  const plans = plansByModel[tool.pricingModel] || plansByModel.freemium;
  els.pricingPlans.innerHTML = plans
    .map((plan) => `
      <div class="p-3 rounded-lg ${plan.active ? 'border-2 border-primary bg-primary/5' : 'border border-slate-200 dark:border-slate-700'}">
        <div class="flex justify-between items-center mb-1">
          <span class="font-bold">${plan.name}</span>
          <span class="text-sm font-bold">${plan.price}</span>
        </div>
        <p class="text-xs text-slate-500">${plan.desc}</p>
      </div>
    `)
    .join('');
}

function detailHref(tool) {
  const id = encodeURIComponent(tool.id || '');
  const name = encodeURIComponent(tool.name || '');
  const url = encodeURIComponent(tool.url || '');
  return `./tool-detail.html?id=${id}&name=${name}&url=${url}`;
}

function renderRelated(tool, allTools) {
  const related = allTools
    .filter((item) => item.id !== tool.id && item.name !== tool.name)
    .sort((a, b) => {
      const sameCategoryA = a.category === tool.category ? 1 : 0;
      const sameCategoryB = b.category === tool.category ? 1 : 0;
      if (sameCategoryA !== sameCategoryB) return sameCategoryB - sameCategoryA;
      return Number(b.ratingScore || 0) - Number(a.ratingScore || 0);
    })
    .slice(0, 3);

  els.relatedTools.innerHTML = related
    .map((item) => `
      <a class="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group" href="${detailHref(item)}">
        <div class="size-10 ${item.iconColorClass || 'bg-slate-100 dark:bg-slate-700 text-primary'} rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
          <span class="material-symbols-outlined">${item.icon || 'apps'}</span>
        </div>
        <div class="flex-1">
          <h4 class="text-sm font-bold">${item.name}</h4>
          <p class="text-xs text-slate-500">${item.categoryLabel || '教育工具'}</p>
        </div>
        <span class="text-xs font-bold text-amber-500">${Number(item.ratingScore || 0).toFixed(1)}</span>
      </a>
    `)
    .join('');
}

function reviewFormHtml() {
  return `
    <div class="mt-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <h3 class="text-lg font-bold mb-4 text-slate-900 dark:text-white">提交你的点评</h3>
      <form id="reviewForm" class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input id="reviewName" required class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" placeholder="你的姓名" />
          <input id="reviewRole" class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" placeholder="职务（如：中学教师）" />
          <select id="reviewRating" class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
            <option value="5">5 星</option>
            <option value="4">4 星</option>
            <option value="3">3 星</option>
            <option value="2">2 星</option>
            <option value="1">1 星</option>
          </select>
        </div>
        <textarea id="reviewText" required rows="3" class="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" placeholder="请填写你对该工具的真实使用体验"></textarea>
        <button type="submit" class="inline-flex items-center justify-center rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold">提交点评</button>
      </form>
    </div>
  `;
}

function renderReviews(tool, userReviews) {
  const seeded = [
    {
      name: '张晓敏',
      role: `${levelLabel((tool.teachingLevels || [])[0])}教师`,
      rating: Math.max(4, Math.round(Number(tool.ratingScore || 4.5))),
      text: `“${tool.name} 帮我把重复性备课与反馈工作标准化了，课堂准备时间明显缩短。”`,
      createdAt: tool.publishedAt || new Date().toISOString(),
      seeded: true,
    },
  ];

  const all = [...userReviews, ...seeded];
  els.reviewList.innerHTML = all
    .map((item) => {
      const stars = renderStarsHtml(item.rating, 'text-sm');
      const created = new Date(item.createdAt || Date.now());
      const dateText = Number.isNaN(created.getTime()) ? '' : created.toISOString().slice(0, 10);
      return `
        <div class="border-b border-slate-200 dark:border-slate-800 pb-6">
          <div class="flex justify-between items-start mb-2 gap-2">
            <div class="flex items-center gap-3">
              <div class="size-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500">${String(item.name || '教').slice(0, 1)}</div>
              <div>
                <h4 class="font-bold text-slate-900 dark:text-white">${item.name || '匿名用户'}</h4>
                <p class="text-xs text-slate-500">${item.role || '教育从业者'}</p>
              </div>
            </div>
            <div class="text-right">
              <div class="flex text-amber-500 justify-end">${stars}</div>
              <p class="text-[11px] text-slate-400">${dateText}</p>
            </div>
          </div>
          <p class="text-slate-600 dark:text-slate-400 text-sm italic">${item.text || ''}</p>
        </div>
      `;
    })
    .join('');

  els.reviewList.insertAdjacentHTML('beforeend', reviewFormHtml());
}

function renderRating(tool, userReviews) {
  const agg = computeAggregatedRating(tool, userReviews);
  const score = agg.totalScore.toFixed(1);
  const count = agg.totalCount;

  els.toolStars.innerHTML = renderStarsHtml(agg.totalScore, 'text-xl');
  els.toolScore.textContent = score;
  els.toolReviewCount.textContent = `(${formatCount(count)} 条评价)`;

  els.ratingSummaryScore.textContent = score;
  els.ratingSummaryStars.innerHTML = renderStarsHtml(agg.totalScore, 'text-base');

  const dist = buildRatingDistribution(agg.totalScore);
  els.ratingBars.innerHTML = [5, 4, 3, 2, 1]
    .map((star, index) => {
      const width = dist[index];
      return `
        <div class="flex items-center gap-4">
          <span class="text-sm font-medium w-4">${star}</span>
          <div class="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div class="h-full bg-primary rounded-full" style="width:${width}%"></div>
          </div>
          <span class="text-sm text-slate-500 w-10">${width}%</span>
        </div>
      `;
    })
    .join('');
}

function updateFavoriteUI() {
  const icon = els.copyLinkBtn.querySelector('span');
  if (!icon) return;
  if (state.isFavorite) {
    icon.textContent = 'bookmark_added';
    els.copyLinkBtn.classList.add('bg-primary/10', 'border-primary/40', 'text-primary');
    els.copyLinkBtn.title = '已收藏，点击取消';
  } else {
    icon.textContent = 'bookmark';
    els.copyLinkBtn.classList.remove('bg-primary/10', 'border-primary/40', 'text-primary');
    els.copyLinkBtn.title = '收藏工具';
  }
}

function pickTool(tools) {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || '';
  const url = params.get('url') || '';
  const name = params.get('name') || '';

  if (url) {
    const byUrl = tools.find((tool) => String(tool.url || '') === url);
    if (byUrl) return byUrl;
  }
  if (id) {
    const byId = tools.find((tool) => String(tool.id || '') === id);
    if (byId) return byId;
  }
  if (name) {
    const byName = tools.find((tool) => String(tool.name || '') === name);
    if (byName) return byName;
  }

  return tools[0] || null;
}

function renderMain(tool, allTools) {
  document.title = `${tool.name} - AI 教育工具导航`;

  els.toolName.textContent = tool.subtitle ? `${tool.name} (${tool.subtitle})` : tool.name;
  const badge = pickBadge(tool);
  if (badge) {
    els.toolBadge.textContent = badge;
    els.toolBadge.classList.remove('hidden');
  }

  const overview = tool.overview || `${tool.description || ''} 该工具当前分类为“${tool.categoryLabel || '教育工具'}”，适用于${(tool.teachingLevels || []).map(levelLabel).join('、') || '中学'}场景。`;
  els.toolDescription.textContent = tool.description || '该工具可用于教育场景下的教学提效。';
  els.overviewText.textContent = overview;

  if (tool.icon) {
    els.toolIcon.textContent = tool.icon;
  }
  if (tool.iconColorClass) {
    els.toolIconWrap.className = `rounded-xl size-24 md:size-32 flex items-center justify-center border shrink-0 ${tool.iconColorClass}`;
  }

  els.toolUpdatedText.textContent = relativeDays(tool.publishedAt || tool.lastSeenAt);
  els.visitWebsiteBtn.href = hasUsableWebsite(tool.url) ? tool.url : './tools.html';

  renderRating(tool, state.userReviews);
  renderFeatures(tool);
  renderUseCases(tool);
  renderReviews(tool, state.userReviews);
  renderPricing(tool);
  renderRelated(tool, allTools);
}

function bindActions(tool) {
  els.copyLinkBtn.addEventListener('click', () => {
    const favorites = getFavorites();
    const key = toolStorageKey(tool);
    if (favorites.includes(key)) {
      setFavorites(favorites.filter((item) => item !== key));
      state.isFavorite = false;
    } else {
      setFavorites([...favorites, key]);
      state.isFavorite = true;
    }
    updateFavoriteUI();
  });

  els.headerSearchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const keyword = els.headerSearchInput.value.trim();
    const target = keyword ? `./tools.html?q=${encodeURIComponent(keyword)}` : './tools.html';
    window.location.href = target;
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'reviewForm') return;
    event.preventDefault();

    const name = String(document.querySelector('#reviewName')?.value || '').trim();
    const role = String(document.querySelector('#reviewRole')?.value || '').trim();
    const rating = Number(document.querySelector('#reviewRating')?.value || 5);
    const text = String(document.querySelector('#reviewText')?.value || '').trim();

    if (!name || !text) return;

    const nextReview = {
      name: name.slice(0, 24),
      role: role.slice(0, 36) || '教育从业者',
      rating: Math.max(1, Math.min(5, Math.round(rating))),
      text: text.slice(0, 280),
      createdAt: new Date().toISOString(),
    };

    state.userReviews = [nextReview, ...state.userReviews].slice(0, 30);
    writeUserReviews(tool, state.userReviews);
    renderRating(tool, state.userReviews);
    renderReviews(tool, state.userReviews);
  });

  if (!hasUsableWebsite(tool.url)) {
    els.visitWebsiteBtn.classList.add('opacity-60', 'pointer-events-none');
    const icon = els.visitWebsiteBtn.querySelector('span');
    if (icon) icon.textContent = 'link_off';
    els.visitWebsiteBtn.childNodes[0].textContent = '暂无官网';
  }
}

function showError(message) {
  document.title = '工具详情加载失败 - AI 教育工具导航';
  const main = document.querySelector('main');
  main.innerHTML = `
    <div class="max-w-3xl mx-auto py-24 text-center">
      <h1 class="text-3xl font-black text-slate-900 dark:text-white mb-4">工具详情暂时不可用</h1>
      <p class="text-slate-600 dark:text-slate-400 mb-8">${message}</p>
      <a href="./tools.html" class="inline-flex items-center justify-center rounded-lg h-11 px-6 bg-primary text-white font-bold">返回工具库</a>
    </div>
  `;
}

async function loadTools() {
  const response = await fetch('./data/tools-data.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`tools-data.json 加载失败: ${response.status}`);
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.tools)) {
    throw new Error('tools-data.json 结构非法，缺少 tools 数组');
  }
  return data.tools;
}

async function init() {
  try {
    state.tools = await loadTools();
    state.tool = pickTool(state.tools);
    if (!state.tool) {
      showError('没有找到可展示的工具数据，请先执行数据更新。');
      return;
    }

    state.userReviews = readUserReviews(state.tool);
    state.isFavorite = getFavorites().includes(toolStorageKey(state.tool));

    renderMain(state.tool, state.tools);
    updateFavoriteUI();
    bindActions(state.tool);
  } catch (error) {
    console.error(error);
    showError('工具数据加载失败，请稍后重试。');
  }
}

init();
