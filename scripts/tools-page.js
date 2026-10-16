import { getStageLabel } from './tool-taxonomy.js';
import { escapeHtml, formatCount, hasUsableWebsite, renderStarsHtml } from './tool-ui-utils.js';
import { formatToolTitle, formatToolUpdatedDate, renderToolTaxonomyTags } from './tool-card-fragments.js';

const searchInput = document.querySelector('#toolSearchInput');
const levelChecks = Array.from(document.querySelectorAll('input[data-filter-group="level"]'));
const typeChecks = Array.from(document.querySelectorAll('input[data-filter-group="type"]'));
const priceRadios = Array.from(document.querySelectorAll('input[data-filter-group="price"]'));
const countEl = document.querySelector('#resultCount');
const resetBtn = document.querySelector('#resetFilters');
const sortSelect = document.querySelector('#sortSelect');
const toolGrid = document.querySelector('#toolGrid');
const paginationEl = document.querySelector('#pagination');
const emptyState = document.querySelector('#emptyState');
const USER_RATINGS_KEY = 'aiedu:user-ratings:v1';
const TOOL_SUBMISSIONS_KEY = 'aiedu:tool-submissions:v1';
const openSubmitModalBtn = document.querySelector('#openSubmitModal');
const submitModal = document.querySelector('#submitModal');
const submitModalMask = document.querySelector('#submitModalMask');
const closeSubmitModalBtn = document.querySelector('#closeSubmitModal');
const cancelSubmitBtn = document.querySelector('#cancelSubmitBtn');
const toolSubmitForm = document.querySelector('#toolSubmitForm');
const submitFormError = document.querySelector('#submitFormError');
const submitFormSuccess = document.querySelector('#submitFormSuccess');

const state = {
  tools: [],
  keyword: '',
  currentPage: 1,
  pageSize: 6,
  userRatings: {},
  openSubmitOnLoad: false,
};

function selectedValues(inputs) {
  return inputs.filter((item) => item.checked).map((item) => item.dataset.filterValue);
}

function activePrice() {
  const picked = priceRadios.find((item) => item.checked);
  return picked ? picked.dataset.filterValue : 'all';
}

function matchesPrice(tool, chosen) {
  if (chosen === 'all') return true;
  if (chosen === 'free') return tool.pricingModel === 'free';
  return tool.pricingModel !== 'free';
}

function normalizeText(text) {
  return String(text || '').toLowerCase();
}

function levelLabel(level) {
  return getStageLabel(level).toLowerCase();
}

function keywordTokens(keyword) {
  return normalizeText(keyword)
    .split(/[\s,，、|/]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toolText(tool) {
  const levels = Array.isArray(tool.teachingLevels) ? tool.teachingLevels : [];
  const levelTexts = levels.map((lv) => levelLabel(lv)).filter(Boolean);
  const searchTags = Array.isArray(tool.searchTags) ? tool.searchTags : [];
  return normalizeText([
    tool.name,
    tool.subtitle,
    tool.description,
    tool.categoryLabel,
    tool.pricingLabel,
    ...levelTexts,
    ...searchTags,
  ].join(' '));
}

function sortTools(list, mode) {
  const items = [...list];
  const byPriority = (a, b) => {
    const ap = Number(Boolean(a.isPriority));
    const bp = Number(Boolean(b.isPriority));
    if (ap !== bp) return bp - ap;
    const ar = Number(a.priorityRank || 999999);
    const br = Number(b.priorityRank || 999999);
    if (ar !== br) return ar - br;
    return 0;
  };
  if (mode === 'rating') {
    return items.sort((a, b) => byPriority(a, b) || (b.ratingScore || 0) - (a.ratingScore || 0));
  }
  if (mode === 'latest') {
    return items.sort(
      (a, b) => byPriority(a, b) || (new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    );
  }
  return items.sort((a, b) => byPriority(a, b) || (b.popularityScore || 0) - (a.popularityScore || 0));
}

function badgeClass(variant) {
  if (variant === 'highlight') {
    return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400';
  }
  if (variant === 'new') {
    return 'bg-primary/10 text-primary';
  }
  return 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
}

function pricingClass(model) {
  if (model === 'free') {
    return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  }
  if (model === 'freemium') {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
  }
  return 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
}

function stars(score) {
  return renderStarsHtml(score, 'text-sm');
}

function detailHref(tool) {
  const id = encodeURIComponent(tool.id || '');
  const name = encodeURIComponent(tool.name || '');
  const url = encodeURIComponent(tool.url || '');
  return `./tool-detail.html?id=${id}&name=${name}&url=${url}`;
}

function toolStorageKey(tool) {
  return String(tool.id || tool.url || tool.name || '').trim();
}

function loadUserRatings() {
  try {
    const raw = localStorage.getItem(USER_RATINGS_KEY);
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveUserRatings() {
  localStorage.setItem(USER_RATINGS_KEY, JSON.stringify(state.userRatings));
}

function readToolSubmissions() {
  try {
    const raw = localStorage.getItem(TOOL_SUBMISSIONS_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToolSubmissions(items) {
  localStorage.setItem(TOOL_SUBMISSIONS_KEY, JSON.stringify(items));
}

function openSubmitModal() {
  if (!submitModal) return;
  submitModal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  submitFormError?.classList.add('hidden');
  submitFormSuccess?.classList.add('hidden');
}

function closeSubmitModal() {
  if (!submitModal) return;
  submitModal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  toolSubmitForm?.reset();
  submitFormError?.classList.add('hidden');
  submitFormSuccess?.classList.add('hidden');
}

function setSubmitMessage(type, message) {
  if (type === 'error') {
    submitFormSuccess?.classList.add('hidden');
    if (submitFormError) {
      submitFormError.textContent = message;
      submitFormError.classList.remove('hidden');
    }
    return;
  }
  submitFormError?.classList.add('hidden');
  if (submitFormSuccess) {
    submitFormSuccess.textContent = message;
    submitFormSuccess.classList.remove('hidden');
  }
}

function normalizeWebsite(url) {
  try {
    const parsed = new URL(String(url || '').trim());
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function handleToolSubmission(event) {
  event.preventDefault();
  if (!toolSubmitForm) return;
  const formData = new FormData(toolSubmitForm);
  const payload = {
    id: `submission-${Date.now()}`,
    name: String(formData.get('name') || '').trim(),
    url: normalizeWebsite(formData.get('url')),
    category: String(formData.get('category') || '').trim(),
    stage: String(formData.get('stage') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    contact: String(formData.get('contact') || '').trim(),
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };

  if (!payload.name || !payload.url || !payload.category || !payload.stage || !payload.description || !payload.contact) {
    setSubmitMessage('error', '请完整填写所有字段后再提交。');
    return;
  }

  const existing = readToolSubmissions();
  if (existing.some((item) => normalizeWebsite(item.url) === payload.url)) {
    setSubmitMessage('error', '该工具链接已提交过，请勿重复提交。');
    return;
  }

  existing.unshift(payload);
  saveToolSubmissions(existing);
  setSubmitMessage('success', '提交成功，已进入审核队列。通过后将优先收录并展示。');
  setTimeout(() => {
    closeSubmitModal();
  }, 900);
}

function aggregateRating(tool) {
  const baseScore = Number(tool.ratingScore || 0);
  const baseCount = Number(tool.ratingCount || 0);
  const key = toolStorageKey(tool);
  const myRating = Number(state.userRatings[key] || 0);
  if (!myRating) {
    return { score: baseScore, count: baseCount, myRating: 0 };
  }
  const score = (baseScore * baseCount + myRating) / (baseCount + 1);
  return { score, count: baseCount + 1, myRating };
}

function renderCard(tool) {
  const safeTitle = formatToolTitle(tool);
  const safeDesc = escapeHtml(tool.description);
  const safeIcon = escapeHtml(tool.icon || 'apps');

  const badge = tool.badge
    ? `<span class="${badgeClass(tool.badge.variant)} text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full flex items-center gap-1"><span class="material-symbols-outlined text-xs fill-icon">star</span>${escapeHtml(tool.badge.label)}</span>`
    : '';

  const tagsHtml = renderToolTaxonomyTags(tool, {
    maxStage: 2,
    stageClass: 'text-[10px] font-bold px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    typeClass: 'text-[10px] font-bold px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  });

  const agg = aggregateRating(tool);
  const key = toolStorageKey(tool);

  const hasWebsite = hasUsableWebsite(tool.url);
  const cta = hasWebsite
    ? `
        <a
          class="inline-flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
          href="${tool.url}"
          target="_blank"
          rel="noopener noreferrer"
        >
          访问官网
          <span class="material-symbols-outlined text-base">open_in_new</span>
        </a>
      `
    : `
        <span
          class="inline-flex items-center justify-center gap-2 rounded-lg h-10 px-4 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-sm font-bold cursor-not-allowed"
          aria-disabled="true"
          title="该工具暂未提供可用官网"
        >
          暂无官网
          <span class="material-symbols-outlined text-base">link_off</span>
        </span>
      `;

  return `
    <article class="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all">
      <div class="p-6">
        <div class="flex items-start justify-between mb-4">
          <div class="w-14 h-14 rounded-xl ${tool.iconColorClass || 'bg-slate-100 dark:bg-slate-700 text-slate-600'} flex items-center justify-center">
            <span class="material-symbols-outlined text-3xl">${safeIcon}</span>
          </div>
            ${badge}
        </div>
        <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-1">${safeTitle}</h3>
        <div class="flex items-center gap-1 text-yellow-400 mb-2">
          ${stars(agg.score)}
          <span class="text-xs font-bold text-slate-500 dark:text-slate-400 ml-1">${agg.score.toFixed(1)} (${formatCount(agg.count)})</span>
        </div>
        <p class="text-xs text-slate-400 mb-3">${formatToolUpdatedDate(tool)}</p>
        <p class="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">${safeDesc}</p>
        <div class="mt-3 flex items-center gap-2">
          <span class="text-[11px] text-slate-500">我的评分</span>
          <div class="flex items-center gap-1 text-amber-500">
            ${Array.from({ length: 5 }, (_, idx) => {
              const score = idx + 1;
              const fill = agg.myRating >= score ? 'fill-icon' : '';
              return `<button type="button" data-rate-tool="${key}" data-rate-value="${score}" class="leading-none"><span class="material-symbols-outlined text-sm ${fill} pointer-events-none">star</span></button>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap gap-2">
        ${tagsHtml}
      </div>
      <div class="px-6 pb-5">
        ${cta}
      </div>
    </article>
  `;
}

function pageButton(label, onClick, isActive = false, isDisabled = false) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  btn.className = isActive
    ? 'w-10 h-10 rounded-lg flex items-center justify-center bg-primary text-white font-bold'
    : 'w-10 h-10 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-colors font-bold';

  if (isDisabled) {
    btn.disabled = true;
    btn.classList.add('opacity-40', 'cursor-not-allowed');
  } else {
    btn.addEventListener('click', onClick);
  }
  return btn;
}

function iconButton(icon, onClick, isDisabled) {
  const btn = pageButton('', onClick, false, isDisabled);
  btn.className = 'w-10 h-10 rounded-lg flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-colors';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'material-symbols-outlined';
  iconSpan.textContent = icon;
  btn.appendChild(iconSpan);
  return btn;
}

function appendEllipsis() {
  const span = document.createElement('span');
  span.className = 'px-2 text-slate-400';
  span.textContent = '...';
  paginationEl.appendChild(span);
}

function paginationWindow(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

function renderPagination(totalPages) {
  paginationEl.innerHTML = '';
  if (totalPages <= 1) return;

  paginationEl.appendChild(
    iconButton(
      'chevron_left',
      () => {
        state.currentPage -= 1;
        applyFiltersAndRender();
      },
      state.currentPage === 1
    )
  );

  const windowItems = paginationWindow(totalPages, state.currentPage);
  for (const item of windowItems) {
    if (item === 'ellipsis') {
      appendEllipsis();
      continue;
    }
    const page = Number(item);
    paginationEl.appendChild(
      pageButton(
        String(page),
        () => {
          state.currentPage = page;
          applyFiltersAndRender();
        },
        page === state.currentPage
      )
    );
  }

  paginationEl.appendChild(
    iconButton(
      'chevron_right',
      () => {
        state.currentPage += 1;
        applyFiltersAndRender();
      },
      state.currentPage === totalPages
    )
  );
}

function filterTools() {
  const tokens = keywordTokens(state.keyword);
  const levels = selectedValues(levelChecks);
  const types = selectedValues(typeChecks);
  const price = activePrice();

  return state.tools.filter((tool) => {
    const text = toolText(tool);
    const byKeyword = tokens.length === 0 || tokens.some((token) => text.includes(token));
    const byLevel = levels.length === 0 || tool.teachingLevels.some((level) => levels.includes(level));
    const byType = types.length === 0 || types.includes(tool.category);
    const byPrice = matchesPrice(tool, price);
    return byKeyword && byLevel && byType && byPrice;
  });
}

function applyFiltersAndRender() {
  const filtered = filterTools();
  const sorted = sortTools(filtered, sortSelect.value);

  const totalPages = Math.max(1, Math.ceil(sorted.length / state.pageSize));
  state.currentPage = Math.min(state.currentPage, totalPages);

  const start = (state.currentPage - 1) * state.pageSize;
  const pageItems = sorted.slice(start, start + state.pageSize);

  toolGrid.innerHTML = pageItems.map(renderCard).join('');
  emptyState.classList.toggle('hidden', pageItems.length !== 0);
  countEl.textContent = `已收录 ${formatCount(filtered.length)} 个AI 教育工具`;
  renderPagination(totalPages);
}

function resetFilters() {
  levelChecks.forEach((item) => {
    item.checked = false;
  });
  typeChecks.forEach((item) => {
    item.checked = false;
  });
  priceRadios.forEach((item) => {
    item.checked = item.dataset.filterValue === 'all';
  });

  state.keyword = '';
  state.currentPage = 1;
  searchInput.value = '';
  sortSelect.value = 'popular';
  applyFiltersAndRender();
}

function bindEvents() {
  searchInput.addEventListener('input', (event) => {
    state.keyword = event.target.value;
    state.currentPage = 1;
    applyFiltersAndRender();
  });

  [...levelChecks, ...typeChecks, ...priceRadios].forEach((item) => {
    item.addEventListener('change', () => {
      state.currentPage = 1;
      applyFiltersAndRender();
    });
  });

  sortSelect.addEventListener('change', () => {
    state.currentPage = 1;
    applyFiltersAndRender();
  });

  resetBtn.addEventListener('click', resetFilters);

  openSubmitModalBtn?.addEventListener('click', openSubmitModal);
  closeSubmitModalBtn?.addEventListener('click', closeSubmitModal);
  cancelSubmitBtn?.addEventListener('click', closeSubmitModal);
  submitModalMask?.addEventListener('click', closeSubmitModal);
  toolSubmitForm?.addEventListener('submit', handleToolSubmission);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSubmitModal();
  });

  toolGrid.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-rate-tool][data-rate-value]');
    if (!button) return;

    const key = button.dataset.rateTool;
    const rating = Number(button.dataset.rateValue || 0);
    if (!key || rating < 1 || rating > 5) return;

    state.userRatings[key] = rating;
    saveUserRatings();
    applyFiltersAndRender();
  });

}

function applyCheckedValues(inputs, values) {
  const set = new Set(values);
  inputs.forEach((item) => {
    item.checked = set.has(item.dataset.filterValue);
  });
}

function splitParamValues(text) {
  return String(text || '')
    .split(/[,\s，、|/]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hydrateFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q) {
    state.keyword = q;
    searchInput.value = q;
  }

  const types = splitParamValues(params.get('types'));
  if (types.length > 0) {
    applyCheckedValues(typeChecks, types);
  }

  const levels = splitParamValues(params.get('levels'));
  if (levels.length > 0) {
    applyCheckedValues(levelChecks, levels);
  }

  const sort = String(params.get('sort') || '').trim();
  if (sort === 'latest' || sort === 'popular' || sort === 'rating') {
    sortSelect.value = sort;
  }

  state.openSubmitOnLoad = params.get('submit') === '1';
}

async function loadToolsData() {
  const response = await fetch('./data/tools-data.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`tools-data.json 加载失败: ${response.status}`);
  }

  const data = await response.json();
  if (!data || !Array.isArray(data.tools)) {
    throw new Error('tools-data.json 结构非法，缺少 tools 数组');
  }
  state.tools = data.tools;
}

async function init() {
  state.userRatings = loadUserRatings();
  hydrateFromQuery();
  bindEvents();
  if (state.openSubmitOnLoad) {
    openSubmitModal();
  }
  try {
    await loadToolsData();
    applyFiltersAndRender();
  } catch (error) {
    console.error(error);
    countEl.textContent = '工具数据加载失败';
    emptyState.classList.remove('hidden');
    emptyState.textContent = '暂时无法加载工具列表，请稍后重试。';
  }
}

init();
