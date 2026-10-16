import { escapeHtml, hasUsableWebsite } from './tool-ui-utils.js';
import { formatToolTitle, formatToolUpdatedDate, renderScoreSummary, renderToolTaxonomyTags } from './tool-card-fragments.js';

const trendingGrid = document.querySelector('#homeTrendingGrid');

function pricingLabel(tool) {
  if (tool.pricingLabel) return tool.pricingLabel;
  if (tool.pricingModel === 'free') return '免费';
  if (tool.pricingModel === 'freemium') return '免费增值';
  return '付费';
}

function pricingClass(model) {
  if (model === 'free') return 'bg-emerald-100 text-emerald-700';
  if (model === 'freemium') return 'bg-primary/10 text-primary';
  return 'bg-amber-100 text-amber-700';
}

function pickLatestRealTools(tools, limit = 4) {
  return [...tools]
    .filter((tool) => hasUsableWebsite(tool.url))
    .sort((a, b) => {
      const ap = Number(Boolean(a.isPriority));
      const bp = Number(Boolean(b.isPriority));
      if (ap !== bp) return bp - ap;
      const ar = Number(a.priorityRank || 999999);
      const br = Number(b.priorityRank || 999999);
      if (ar !== br) return ar - br;
      const aTime = new Date(a.updatedAt || a.lastSeenAt || a.publishedAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.lastSeenAt || b.publishedAt || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, limit);
}

function renderCard(tool) {
  const desc = escapeHtml(tool.description || '暂无简介');
  const icon = escapeHtml(tool.icon || 'auto_awesome');
  const iconColorClass = escapeHtml(tool.iconColorClass || 'bg-primary/10 text-primary');
  const title = formatToolTitle(tool);
  const q = encodeURIComponent(tool.name || tool.subtitle || '');
  const link = `tools.html?q=${q}`;
  const updateText = formatToolUpdatedDate(tool).replace('更新：', '');
  const priceLabel = escapeHtml(pricingLabel(tool));
  const priceClass = pricingClass(tool.pricingModel);
  const tagsHtml = renderToolTaxonomyTags(tool);
  const ratingHtml = renderScoreSummary(tool.ratingScore, tool.ratingCount);

  return `
    <a href="${link}" class="block w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all hover:-translate-y-0.5">
      <div class="flex items-start justify-between mb-4">
        <div class="w-14 h-14 rounded-xl ${iconColorClass} flex items-center justify-center">
          <span class="material-symbols-outlined text-3xl">${icon}</span>
        </div>
        <span class="${priceClass} text-[10px] font-black uppercase px-2 py-0.5 rounded">${priceLabel}</span>
      </div>
      <h4 class="font-bold text-slate-900 dark:text-white text-base leading-snug">${title}</h4>
      <p class="mt-2 text-xs text-slate-400">更新：${updateText}</p>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">${desc}</p>
      ${ratingHtml}
      <div class="mt-3 flex flex-wrap gap-2">
        ${tagsHtml}
      </div>
    </a>
  `;
}

async function loadLatestTools() {
  const response = await fetch('./data/tools-data.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`tools-data.json 加载失败: ${response.status}`);
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.tools)) {
    throw new Error('tools-data.json 结构非法，缺少 tools 数组');
  }
    return pickLatestRealTools(data.tools, 3);
}

async function init() {
  if (!trendingGrid) return;
  try {
    const tools = await loadLatestTools();
    if (tools.length === 0) {
      trendingGrid.innerHTML = `
        <div class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
          <p class="text-sm text-slate-500 dark:text-slate-400">暂无可展示的真实工具，请先运行爬虫更新数据。</p>
        </div>
      `;
      return;
    }
    trendingGrid.innerHTML = tools.map(renderCard).join('');
  } catch (error) {
    console.error(error);
    trendingGrid.innerHTML = `
      <div class="w-full bg-slate-50 dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
        <p class="text-sm text-slate-500 dark:text-slate-400">工具数据加载失败，请稍后重试。</p>
      </div>
    `;
  }
}

init();
