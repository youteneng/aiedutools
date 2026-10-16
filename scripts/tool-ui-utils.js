export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatCount(value) {
  return new Intl.NumberFormat('zh-CN').format(Math.max(0, Number(value || 0)));
}

export function hasUsableWebsite(url) {
  const value = String(url || '').trim();
  if (!/^https?:\/\//i.test(value)) return false;
  if (/example\.com/i.test(value)) return false;
  return true;
}

export function renderStarsHtml(score, sizeClass = 'text-sm') {
  const rounded = Math.round(Number(score || 0));
  return Array.from({ length: 5 }, (_, index) => {
    const filled = index < rounded ? 'fill-icon' : '';
    return `<span class="material-symbols-outlined ${sizeClass} ${filled}">star</span>`;
  }).join('');
}

export function renderTagChip(label, className) {
  return `<span class="${className}">${escapeHtml(label)}</span>`;
}
