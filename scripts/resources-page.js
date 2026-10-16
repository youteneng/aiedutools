const searchInput = document.querySelector('#resourceSearchInput');
const stageChecks = Array.from(document.querySelectorAll('input[data-filter-group="stage"]'));
const subjectChecks = Array.from(document.querySelectorAll('input[data-filter-group="subject"]'));
const typeChecks = Array.from(document.querySelectorAll('input[data-filter-group="type"]'));
const sortSelect = document.querySelector('#resourceSortSelect');
const resetBtn = document.querySelector('#resetResourceFilters');
const gridEl = document.querySelector('#resourceGrid');
const countEl = document.querySelector('#resourceCount');
const emptyEl = document.querySelector('#resourceEmpty');
const paginationEl = document.querySelector('#resourcePagination');
const sourceNoticeEl = document.querySelector('#sourceNotice');
const filterPanelEl = document.querySelector('#resourceFilterPanel');

const state = {
  resources: [],
  keyword: '',
  currentPage: 1,
  pageSize: 8,
};

const STAGE_LABELS = {
  elementary: '小学',
  secondary: '初中',
  highschool: '高中',
};

const SUBJECT_LABELS = {
  chinese: '语文',
  math: '数学',
  english: '英语',
  science: '科学',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  history: '历史',
  geography: '地理',
  politics: '政治',
  it: '信息技术',
  music: '音乐',
  art: '美术',
  pe: '体育',
};

const TYPE_LABELS = {
  textbook: '教材',
  'question-bank': '题库',
  'curriculum-standard': '课程标准',
  worksheet: '练习单',
  'mock-paper': '试卷',
};

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function selectedValues(items) {
  return items.filter((item) => item.checked).map((item) => item.dataset.filterValue);
}

function resourceText(item) {
  return normalizeText([
    item.title,
    item.description,
    SUBJECT_LABELS[item.subject] || item.subject,
    STAGE_LABELS[item.stage] || item.stage,
    TYPE_LABELS[item.type] || item.type,
    item.source,
  ].join(' '));
}

function toDateTs(value) {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function sortItems(items) {
  const mode = sortSelect?.value || 'latest';
  const list = [...items];
  if (mode === 'title') {
    return list.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'));
  }
  return list.sort((a, b) => toDateTs(b.updatedAt) - toDateTs(a.updatedAt));
}

function renderCard(item) {
  const stage = STAGE_LABELS[item.stage] || '未标注';
  const subject = SUBJECT_LABELS[item.subject] || '综合';
  const type = TYPE_LABELS[item.type] || '资源';
  const source = String(item.source || 'ChinaTextbook').replace(/^GitHub\s*[·-]\s*/i, '').trim() || 'ChinaTextbook';
  const sourceUrl = item.sourceUrl || item.url || '#';
  const downloadUrl = item.downloadUrl || sourceUrl || '#';
  const downloadLabel = item.downloadType === 'direct-file' ? '直链下载' : '下载入口';
  return `
    <article class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 hover:shadow-lg transition-all">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white leading-snug">${item.title}</h3>
        <span class="text-[11px] font-semibold text-slate-400 whitespace-nowrap">${item.format || '文件'}</span>
      </div>
      <p class="mt-3 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">${item.description || ''}</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <span class="text-[11px] font-semibold px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">${stage}</span>
        <span class="text-[11px] font-semibold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">${subject}</span>
        <span class="text-[11px] font-semibold px-2 py-1 rounded bg-primary/10 text-primary">${type}</span>
      </div>
      <div class="mt-5 space-y-3">
        <p class="text-xs text-slate-400">
          来源：${source} · 更新：${item.updatedAt || '未知'}
          <a class="ml-2 text-primary hover:underline" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">来源页</a>
        </p>
        <a class="inline-flex w-full sm:w-auto items-center justify-center gap-1 rounded-lg h-9 px-3 bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors" href="${downloadUrl}" target="_blank" rel="noopener noreferrer">
          ${downloadLabel}
          <span class="material-symbols-outlined text-base">open_in_new</span>
        </a>
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
    : 'w-10 h-10 rounded-lg flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold';
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
  btn.className = 'w-10 h-10 rounded-lg flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors';
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
  if (!paginationEl) return;
  paginationEl.innerHTML = '';
  paginationEl.classList.toggle('hidden', totalPages <= 1);
  if (totalPages <= 1) return;

  paginationEl.appendChild(
    iconButton(
      'chevron_left',
      () => {
        state.currentPage -= 1;
        render();
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
          render();
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
        render();
      },
      state.currentPage === totalPages
    )
  );
}

function filterResources() {
  const keyword = normalizeText(state.keyword);
  const stages = selectedValues(stageChecks);
  const subjects = selectedValues(subjectChecks);
  const types = selectedValues(typeChecks);

  return state.resources.filter((item) => {
    const hitKeyword = !keyword || resourceText(item).includes(keyword);
    const hitStage = stages.length === 0 || stages.includes(item.stage);
    const hitSubject = subjects.length === 0 || subjects.includes(item.subject);
    const hitType = types.length === 0 || types.includes(item.type);
    return hitKeyword && hitStage && hitSubject && hitType;
  });
}

function render() {
  const filtered = sortItems(filterResources());
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  state.currentPage = Math.min(state.currentPage, totalPages);
  const start = (state.currentPage - 1) * state.pageSize;
  const pageItems = filtered.slice(start, start + state.pageSize);

  gridEl.innerHTML = pageItems.map(renderCard).join('');
  countEl.textContent = `共 ${total} 份可用资源（第 ${state.currentPage}/${totalPages} 页）`;
  emptyEl.classList.toggle('hidden', total !== 0);
  renderPagination(totalPages);
}

function resetFilters() {
  state.keyword = '';
  state.currentPage = 1;
  if (searchInput) searchInput.value = '';
  [...stageChecks, ...subjectChecks, ...typeChecks].forEach((el) => {
    el.checked = false;
  });
  if (sortSelect) sortSelect.value = 'latest';
  render();
}

function bindEvents() {
  searchInput?.addEventListener('input', (event) => {
    state.keyword = event.target.value;
    state.currentPage = 1;
    render();
  });

  [...stageChecks, ...subjectChecks, ...typeChecks].forEach((el) => {
    el.addEventListener('change', () => {
      state.currentPage = 1;
      render();
    });
  });

  sortSelect?.addEventListener('change', () => {
    state.currentPage = 1;
    render();
  });
  resetBtn?.addEventListener('click', resetFilters);

  document.querySelectorAll('[data-scroll-to-filters]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterPanelEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelectorAll('[data-scroll-to-search]').forEach((btn) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    searchInput?.focus();
  });
}

async function loadData() {
  const resp = await fetch('./data/resources-data.json', { cache: 'no-store' });
  if (!resp.ok) throw new Error(`resources-data.json 加载失败: ${resp.status}`);
  const data = await resp.json();
  state.resources = Array.isArray(data.resources) ? data.resources : [];
  if (sourceNoticeEl) {
    sourceNoticeEl.textContent = data.sourceNotice || '请遵循原始资源平台的使用条款与版权要求。';
  }
}

async function init() {
  bindEvents();
  try {
    await loadData();
    render();
  } catch (error) {
    console.error(error);
    countEl.textContent = '资源加载失败';
    emptyEl.classList.remove('hidden');
    emptyEl.textContent = '暂时无法加载资源列表，请稍后重试。';
  }
}

init();
