// Builds the crawlable parts of the site at deploy time from data/tracker.json: one page per news
// article, a news archive, an RSS feed, the sitemap and the IndexNow key file.
// Pure functions with no Node or DOM APIs, so the same code can be checked in a browser;
// scripts/build-site.mjs does the file I/O in GitHub Actions.

import { esc, NEWS_ID_RE, articlePath, coverHtml, storyImageUrl } from '../../assets/js/news-shared.js';

const SITE_NAME = 'VICEPULSE';
const articleUrl = (n, siteUrl) => siteUrl
  ? `${siteUrl}${articlePath(n)}`
  : `${n.id}.html`;
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const httpsOnly = (u) => (/^https:\/\/[^\s"'<>]+$/.test(u || '') ? u : null);
const fmtDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const jsonLd = (o) => JSON.stringify(o, null, 1).replace(/</g, '\\u003c');
const isoTime = (s) => { const t = Date.parse(s || ''); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/** News entries that get a page: valid slug id, date and title; newest first; duplicate ids dropped. */
export function publishableNews(data) {
  const seen = new Set();
  return (data.news || [])
    .filter((n) => n && NEWS_ID_RE.test(n.id || '') && isDay(n.date) && n.title && !seen.has(n.id) && seen.add(n.id))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

const BRAND = `<img class="brand-mark" src="../assets/img/vice-mark.svg" width="32" height="32" alt="">`;

// Article pages live in news/, so every site link is relative to the parent folder.
function shell({ title, description, canonical, ogType = 'website', image, imageIsSocial, siteUrl, head = '', main, track }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${siteUrl ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
  <meta name="robots" content="max-image-preview:large">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:type" content="${ogType}">
  ${siteUrl ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(image)}">${imageIsSocial ? `
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#100e16">
  <link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
  <link rel="alternate" type="application/rss+xml" title="VICEPULSE news" href="feed.xml">
  <link rel="stylesheet" href="../assets/css/style.css">
  <link rel="stylesheet" href="../assets/css/vicepulse.css">
  <script src="../assets/js/theme.js"></script>${head}
</head>
<body class="page-news">
  <header class="nav is-scrolled">
    <div class="wrap nav-inner">
      <a class="brand" href="../" aria-label="VICEPULSE home">
        ${BRAND}
        <span>VICE<b>PULSE</b></span>
      </a>
      <nav class="nav-links" aria-label="Sections">
        <a href="../#race">Race</a>
        <a href="./" class="is-current">News</a>
        <a href="../#method">Scoring</a>
        <a href="../#safety" class="nav-warn">Fake downloads</a>
      </nav>
    </div>
  </header>

  <main class="wrap page">
${main}
  </main>

  <footer class="footer">
    <div class="wrap footer-inner">
      <div>
        <a class="brand brand-sm" href="../"><span>VICE<b>PULSE</b></span></a>
        <p>Fan-made tracker. Not affiliated with or endorsed by Rockstar Games, Take-Two or Microsoft. Grand Theft Auto and related marks belong to their owners. No game files, keys or executables are hosted or linked here.</p>
      </div>
      <div class="footer-meta">
        <p><a href="../">See the GTA VI PC progress tracker.</a></p>
        <p><a href="feed.xml">News RSS feed</a></p>
      </div>
    </div>
  </footer>
  <script type="module">
    import { trackView } from '../assets/js/backend.js';
    trackView(${JSON.stringify(track)});
  </script>
</body>
</html>
`;
}

// Cover art sits under the photo, so a photo that fails to load (hotlink blocked, gone) shows the cover instead.
function media(n, cls = '') {
  const img = storyImageUrl(n.image?.url, '../');
  return `<div class="story-media page-media ${cls}">${coverHtml(n.category)}${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span class="story-cat">${esc(n.category)}</span></div>`;
}

const card = (n, small) => `
      <a class="story ${small ? 'is-small' : ''}" href="${esc(n.id)}.html">
        ${media(n)}
        <div class="story-body">
          <time datetime="${n.date}">${esc(fmtDay(n.date))}</time>
          <h3>${esc(n.title)}</h3>
          <p>${esc(n.dek)}</p>
        </div>
      </a>`;

function sourceItem(s) {
  const label = `${esc(s.outlet)}${s.title ? `: ${esc(s.title)}` : ''}`;
  if (/^#[\w-]+$/.test(s.url || '')) return `<li><a href="../${esc(s.url)}">${label}</a></li>`;
  const url = httpsOnly(s.url);
  return url ? `<li><a href="${esc(url)}" target="_blank" rel="noopener">${label}</a></li>` : `<li>${label}</li>`;
}

function articlePage(n, others, siteUrl) {
  const url = articleUrl(n, siteUrl);
  const socialImage = `${siteUrl || '../'}assets/img/social.jpg`;
  const img = storyImageUrl(n.image?.url, siteUrl || '../');
  const modified = isDay(n.updatedAt) ? n.updatedAt : n.date;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: String(n.title).slice(0, 110),
    description: n.dek || undefined,
    datePublished: n.date,
    dateModified: modified,
    image: [img || socialImage],
    articleSection: n.category || undefined,
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: SITE_NAME, url: siteUrl || undefined },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: siteUrl || undefined },
    citation: (n.sources || []).map((s) => httpsOnly(s.url)).filter(Boolean),
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: siteUrl || undefined },
  };
  const credit = n.image?.credit && img
    ? `Image: ${storyImageUrl(n.image.link, '../') ? `<a href="${esc(storyImageUrl(n.image.link, '../'))}" target="_blank" rel="noopener">${esc(n.image.credit)}</a>` : esc(n.image.credit)}. `
    : '';
  const byline = n.by === 'claude' ? 'Written automatically by Claude from the linked sources.'
    : n.by === 'report' ? 'Reported by a third party; independent public confirmation is pending.'
    : 'Based on the linked sources.';
  const more = others.slice(0, 6);
  const main = `    <nav class="crumbs" aria-label="Breadcrumb"><a href="../">VICEPULSE</a><span aria-hidden="true">/</span><a href="./">News</a></nav>
    <article class="reader reader-page">
      ${media(n)}
      <div class="reader-inner">
        <p class="meta">${esc(n.category)} · <time datetime="${n.date}">${esc(fmtDay(n.date))}</time></p>
        <h1>${esc(n.title)}</h1>
        ${n.dek ? `<p class="dek">${esc(n.dek)}</p>` : ''}
        <div class="article">
          ${(n.body || []).map((p) => `<p>${esc(p)}</p>`).join('\n          ')}
        </div>
        <div class="sources">
          <h2>Sources</h2>
          <ul>${(n.sources || []).map(sourceItem).join('')}</ul>
          <p class="fine">${credit}${byline}</p>
        </div>
      </div>
    </article>
${more.length ? `    <section class="more-news" aria-labelledby="more-title">
      <h2 class="mini-title" id="more-title">More news</h2>
      <div class="news-list">${more.map((o) => card(o, true)).join('')}
      </div>
      <p><a class="more-link" href="./">All news</a> <a class="more-link" href="../">Live tracker</a></p>
    </section>` : ''}`;
  return shell({
    title: `${n.title} · ${SITE_NAME}`,
    description: n.dek || n.title,
    canonical: url,
    siteUrl,
    ogType: 'article',
    image: img || socialImage,
    imageIsSocial: !img,
    head: `
  <meta property="article:published_time" content="${n.date}">
  <meta property="article:modified_time" content="${modified}">
  <meta property="article:section" content="${esc(n.category)}">
  <script type="application/ld+json">${jsonLd(ld)}</script>`,
    main,
    track: `/news/${n.id}`,
  });
}

function archivePage(news, siteUrl) {
  const url = siteUrl ? `${siteUrl}news/` : './';
  const socialImage = `${siteUrl || '../'}assets/img/social.jpg`;
  const description = 'Every VICEPULSE story about the leaked GTA VI build and PC ports: takedowns, legal news, scams and real port milestones, with links to the original reporting.';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'VICEPULSE news',
    description,
    url,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: siteUrl || undefined },
    mainEntity: { '@type': 'ItemList', itemListElement: news.map((n, i) => ({ '@type': 'ListItem', position: i + 1, url: articleUrl(n, siteUrl) })) },
  };
  const main = `    <nav class="crumbs" aria-label="Breadcrumb"><a href="../">VICEPULSE</a><span aria-hidden="true">/</span><span>News</span></nav>
    <div class="section-head">
      <div>
        <p class="kicker">What's happening</p>
        <h1 class="page-title">GTA VI on PC: the news</h1>
        <p class="sub">The moves that matter around the leak: takedowns, confirmed leaks, legal news and scams. Short summaries in our own words, with links to the original reporting.</p>
      </div>
      <a class="more-link" href="feed.xml">RSS feed</a>
    </div>
    <div class="archive">${news.map((n) => card(n, false)).join('') || '\n      <p class="empty">No stories yet.</p>'}
    </div>`;
  return shell({
    title: `GTA VI on PC news: leaks, takedowns and port progress · ${SITE_NAME}`,
    description,
    canonical: url,
    siteUrl,
    image: socialImage,
    imageIsSocial: true,
    head: `
  <script type="application/ld+json">${jsonLd(ld)}</script>`,
    main,
    track: '/news',
  });
}

function rssFeed(news, updated, siteUrl) {
  const items = news.slice(0, 30).map((n) => {
    const link = articleUrl(n, siteUrl);
    return `  <item>
    <title>${esc(n.title)}</title>
    <link>${link}</link>
    <guid isPermaLink="${Boolean(siteUrl)}">${link}</guid>
    <pubDate>${new Date(`${n.date}T12:00:00Z`).toUTCString()}</pubDate>
    <category>${esc(n.category)}</category>
    <description>${esc(n.dek || '')}</description>
  </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>VICEPULSE news</title>
  <link>${siteUrl ? `${siteUrl}news/` : './'}</link>
  <description>Takedowns, leaks, legal news, scams and real progress on running GTA VI on PC.</description>
  <language>en</language>
  <lastBuildDate>${new Date(updated || Date.now()).toUTCString()}</lastBuildDate>
  <atom:link href="${siteUrl ? `${siteUrl}news/feed.xml` : 'feed.xml'}" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
}

function sitemap(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${esc(e.lastmod)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

/**
 * @returns {{ files: Record<string, string>, entries: { loc: string, lastmod?: string }[] }}
 *   files: path (relative to the site folder) → content; entries: what's in the sitemap.
 */
export function buildSite(data, { siteUrl = '', indexNowKey = '' } = {}) {
  const news = publishableNews(data);
  const updated = isoTime(data.updated);
  const entries = siteUrl ? [
    { loc: siteUrl, lastmod: updated || undefined },
    { loc: `${siteUrl}news/`, lastmod: news[0]?.date },
    ...news.map((n) => ({ loc: articleUrl(n, siteUrl), lastmod: isDay(n.updatedAt) ? n.updatedAt : n.date })),
  ] : [];
  const files = {
    'news/index.html': archivePage(news, siteUrl),
    'news/feed.xml': rssFeed(news, updated, siteUrl),
  };
  if (siteUrl) files['sitemap.xml'] = sitemap(entries);
  if (siteUrl && indexNowKey) files[`${indexNowKey}.txt`] = indexNowKey;
  for (const n of news) files[articlePath(n)] = articlePage(n, news.filter((o) => o !== n), siteUrl);
  return { files, entries };
}

/** URLs that are new or have a different lastmod than in the previously deployed sitemap (all of them if there was none). */
export function changedUrls(previousSitemap, entries) {
  if (!previousSitemap) return entries.map((e) => e.loc);
  const prev = new Map();
  for (const m of previousSitemap.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g)) prev.set(m[1].trim(), (m[2] || '').trim());
  return entries.filter((e) => !prev.has(e.loc) || prev.get(e.loc) !== (e.lastmod || '')).map((e) => e.loc);
}

export function indexNowPayload(urls, siteUrl, key) {
  return { host: new URL(siteUrl).host, key, keyLocation: `${siteUrl}${key}.txt`, urlList: urls };
}
