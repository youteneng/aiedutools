import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_FILE = path.join(PROJECT_ROOT, 'data', 'resources-data.json');
const ARCHIVE_FALLBACK = 'https://codeload.github.com/TapXWorld/ChinaTextbook/zip/refs/heads/master';
const GH_API = 'https://api.github.com/search/code';

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    file: DEFAULT_FILE,
    limit: 120,
    timeoutMs: 12000,
  };
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--file') opts.file = path.resolve(args[i + 1]);
    if (token === '--limit') opts.limit = Number(args[i + 1]);
    if (token === '--timeout-ms') opts.timeoutMs = Number(args[i + 1]);
  }
  return opts;
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function scoreCandidate(href, resource) {
  const lower = normalizeText(href);
  const title = normalizeText(resource.title);
  let score = 0;

  if (/(\.pdf|\.docx|\.doc|\.zip|\.rar)$/.test(lower)) score += 5;
  if (lower.includes('/blob/')) score += 2;

  const keywords = [
    resource.stage,
    resource.subject,
    resource.type,
    ...title.split(/\s+/).filter(Boolean).slice(0, 6),
  ].map((x) => normalizeText(x));

  keywords.forEach((kw) => {
    if (kw && lower.includes(kw)) score += 1;
  });

  return score;
}

function toRawUrl(blobUrl) {
  const url = new URL(blobUrl);
  const parts = url.pathname.split('/').filter(Boolean);
  // owner/repo/blob/branch/path...
  const blobIndex = parts.indexOf('blob');
  if (blobIndex < 0 || parts.length < blobIndex + 3) return '';

  const owner = parts[0];
  const repo = parts[1];
  const branch = parts[blobIndex + 1];
  const filePath = parts.slice(blobIndex + 2).join('/');
  if (!owner || !repo || !branch || !filePath) return '';

  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'AIedu2-resource-resolver/1.0',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      'user-agent': 'AIedu2-resource-resolver/1.0',
      accept: 'application/vnd.github+json',
    };
    if (process.env.GH_TOKEN) {
      headers.authorization = `Bearer ${process.env.GH_TOKEN}`;
    }

    const resp = await fetch(url, {
      signal: controller.signal,
      headers,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

function extractBlobLinks(html) {
  const matches = [...html.matchAll(/href=["'](\/TapXWorld\/ChinaTextbook\/blob\/[^"']+)["']/gi)];
  const links = matches.map((m) => `https://github.com${m[1]}`);
  return Array.from(new Set(links));
}

function extractSearchQuery(sourceUrl) {
  try {
    const u = new URL(sourceUrl);
    return (u.searchParams.get('q') || '').trim();
  } catch {
    return '';
  }
}

async function resolveViaGitHubApi(resource, timeoutMs) {
  const query = extractSearchQuery(resource.sourceUrl || resource.url || '');
  if (!query) return '';

  const apiQuery = `${query} repo:TapXWorld/ChinaTextbook`;
  const apiUrl = `${GH_API}?q=${encodeURIComponent(apiQuery)}&per_page=5`;
  const data = await fetchJson(apiUrl, timeoutMs);
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) return '';

  const ranked = items
    .map((item) => ({
      path: item.path || '',
      score: scoreCandidate(item.path || '', resource),
      htmlUrl: item.html_url || '',
      repo: item.repository?.full_name || 'TapXWorld/ChinaTextbook',
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || !best.path) return '';

  // API gives repository + path; branch unknown so default master/main fallback.
  const repo = best.repo || 'TapXWorld/ChinaTextbook';
  const mainRaw = `https://raw.githubusercontent.com/${repo}/main/${best.path}`;
  const masterRaw = `https://raw.githubusercontent.com/${repo}/master/${best.path}`;
  return mainRaw || masterRaw;
}

async function resolveDownloadForResource(resource, timeoutMs) {
  const sourceUrl = resource.sourceUrl || resource.url;
  if (!sourceUrl) {
    return {
      ...resource,
      sourceUrl: '',
      downloadUrl: resource.downloadUrl || ARCHIVE_FALLBACK,
      downloadType: resource.downloadType || 'archive-fallback',
    };
  }

  try {
    const html = await fetchText(sourceUrl, timeoutMs);
    const links = extractBlobLinks(html);
    if (links.length === 0) {
      let apiRaw = '';
      try {
        apiRaw = await resolveViaGitHubApi({ ...resource, sourceUrl }, timeoutMs);
      } catch {
        apiRaw = '';
      }

      if (apiRaw) {
        return {
          ...resource,
          sourceUrl,
          downloadUrl: apiRaw,
          downloadType: 'direct-file',
          resolvedFrom: 'github-api',
        };
      }

      return {
        ...resource,
        sourceUrl,
        downloadUrl: resource.downloadUrl || ARCHIVE_FALLBACK,
        downloadType: 'archive-fallback',
      };
    }

    const ranked = links
      .map((href) => ({ href, score: scoreCandidate(href, resource) }))
      .sort((a, b) => b.score - a.score);

    const best = ranked[0]?.href;
    const rawUrl = best ? toRawUrl(best) : '';
    if (!rawUrl) {
      return {
        ...resource,
        sourceUrl,
        downloadUrl: resource.downloadUrl || ARCHIVE_FALLBACK,
        downloadType: 'archive-fallback',
      };
    }

    return {
      ...resource,
      sourceUrl,
      downloadUrl: rawUrl,
      downloadType: 'direct-file',
      resolvedFrom: best,
    };
  } catch {
    return {
      ...resource,
      sourceUrl,
      downloadUrl: resource.downloadUrl || ARCHIVE_FALLBACK,
      downloadType: 'archive-fallback',
    };
  }
}

async function run() {
  const opts = parseArgs();
  const raw = JSON.parse(await fs.readFile(opts.file, 'utf8'));
  const resources = Array.isArray(raw.resources) ? raw.resources : [];

  const limit = Math.max(0, Math.min(resources.length, opts.limit));
  const updated = [];

  for (let i = 0; i < resources.length; i += 1) {
    const item = resources[i];
    if (i < limit) {
      const next = await resolveDownloadForResource(item, opts.timeoutMs);
      updated.push(next);
      continue;
    }

    updated.push({
      ...item,
      sourceUrl: item.sourceUrl || item.url || '',
      downloadUrl: item.downloadUrl || ARCHIVE_FALLBACK,
      downloadType: item.downloadType || 'archive-fallback',
    });
  }

  const directCount = updated.filter((x) => x.downloadType === 'direct-file').length;

  const output = {
    ...raw,
    updatedAt: new Date().toISOString().slice(0, 10),
    stats: {
      ...(raw.stats || {}),
      total: updated.length,
      resolvedDirectFiles: directCount,
      fallbackArchive: updated.length - directCount,
    },
    resources: updated,
  };

  await fs.writeFile(opts.file, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`updated: ${opts.file}`);
  console.log(`resources: ${updated.length}`);
  console.log(`direct-file: ${directCount}`);
  console.log(`archive-fallback: ${updated.length - directCount}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
