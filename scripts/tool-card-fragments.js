import { getStageLabels, getToolTypeLabel } from './tool-taxonomy.js';
import { escapeHtml, formatCount, renderTagChip } from './tool-ui-utils.js';

export function formatToolTitle(tool) {
  const name = escapeHtml(tool?.name || '未命名工具');
  const subtitle = escapeHtml(tool?.subtitle || '');
  return subtitle ? `${name} (${subtitle})` : name;
}

export function formatToolUpdatedDate(tool, prefix = '更新：') {
  const value = tool?.updatedAt || tool?.lastSeenAt || tool?.publishedAt;
  const date = new Date(value);
  const suffix = Number.isNaN(date.getTime()) ? '近期更新' : date.toISOString().slice(0, 10);
  return `${prefix}${suffix}`;
}

export function renderToolTaxonomyTags(tool, options = {}) {
  const {
    maxStage = 2,
    stageClass = 'text-[10px] font-bold px-2 py-1 rounded bg-blue-100 text-blue-700',
    typeClass = 'text-[10px] font-bold px-2 py-1 rounded bg-slate-200 text-slate-600',
  } = options;

  const stageTags = getStageLabels(tool?.teachingLevels).slice(0, maxStage);
  const typeTag = getToolTypeLabel(tool?.category);

  const stageHtml = stageTags.map((tag) => renderTagChip(tag, stageClass)).join('');
  const typeHtml = renderTagChip(typeTag, typeClass);
  return `${stageHtml}${typeHtml}`;
}

export function renderScoreSummary(score, count, options = {}) {
  const {
    wrapClass = 'mt-3 flex items-center gap-2 text-primary text-xs font-bold',
    iconClass = 'material-symbols-outlined text-sm',
    suffix = '评价',
  } = options;
  const scoreText = Number(score || 0).toFixed(1);
  const countText = formatCount(count || 0);
  return `
    <div class="${wrapClass}">
      <span class="${iconClass}">star</span> ${scoreText} (${countText} ${suffix})
    </div>
  `;
}
