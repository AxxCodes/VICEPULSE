import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { test } from 'node:test';
import { scoreEffort, overall } from '../assets/js/scoring.js';
import { spamCheck, detectClaims, normDesc } from '../scripts/lib/core.mjs';
import { buildSite, publishableNews } from '../scripts/lib/site-build.mjs';
import { runScout } from '../scripts/lib/pipeline.mjs';
import { getUpdateAge } from '../assets/js/update-time.js';
import { storyImageUrl } from '../assets/js/news-shared.js';
import { onRequestGet } from '../functions/api/live.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const data = JSON.parse(await read('../data/tracker.json'));

test('headline, milestone and top-three average use the highest active community results', () => {
  const active = { loads: 1, boots: 1, menu: 1, ingame: 1 };
  const efforts = [
    { id: 'observed', gta: { ...active, fps: 4 } },
    { id: 'menus', gta: { ...active, ingame: .8 } },
    { id: 'loading', gta: { ...active, ingame: .5 } },
    { id: 'first-frame', gta: { ...active, menu: .5, ingame: 0 } },
  ];
  const result = overall(efforts);
  assert.equal(result.leader.effort.id, 'observed');
  assert.equal(result.score, 72);
  assert.equal(result.top3, 67.2);
  assert.equal(result.furthest.key, 'ingame');
});

test('scoring handles old boolean values, partial steps, missing steps and stability', () => {
  assert.equal(scoreEffort({}).score, 0);
  assert.equal(scoreEffort({ groundwork: { loader: 1, shaders: 1, graphics: 1, proven: 1 } }).score, 25);
  assert.equal(scoreEffort({ gta: { loads: true, boots: .5, menu: true } }).score, 32.5);
  assert.equal(scoreEffort({ gta: { loads: 0, boots: 1 } }).reached, 'groundwork');
  const active = { loads: 1, boots: 1, menu: 1, ingame: 1 };
  assert.equal(scoreEffort({ gta: { ...active, fps: 4 } }).score, 72);
  assert.equal(scoreEffort({ gta: { ...active, fps: 30, stability: 'stable' } }).score, 100);
});

test('a high-score archived effort is retained in data and excluded from the headline', () => {
  const full = { loads: 1, boots: 1, menu: 1, ingame: 1, fps: 30, stability: 'stable' };
  const result = overall([{ id: 'archived', gta: full, nuked: { at: '2026-11-23' } }, { id: 'active' }]);
  assert.deepEqual(result.ranked.map(({ effort }) => effort.id), ['active']);
});

test('archive, individual articles, RSS and discovery metadata use the configured canonical origin', () => {
  const siteUrl = 'https://example.test/tracker/';
  const { files, entries } = buildSite(data, { siteUrl });
  const published = publishableNews(data);
  assert.ok(published.length > 0);
  assert.equal(Object.keys(files).filter((path) => /news\/.+\.html$/.test(path)).length, published.length + 1);
  for (const article of published) {
    const path = `news/${article.id}.html`;
    assert.ok(files[path].includes(`href="${siteUrl}${path}"`));
    assert.ok(files['news/feed.xml'].includes(`<link>${siteUrl}${path}</link>`));
    assert.ok(files['sitemap.xml'].includes(`<loc>${siteUrl}${path}</loc>`));
  }
  assert.ok(files['news/index.html'].includes('VICEPULSE'));
  assert.ok(files['sitemap.xml'].includes(siteUrl));
  assert.equal(entries.length, published.length + 2);
});

test('editor observation points to its published report with a matching assessment date', () => {
  const { files } = buildSite(data);
  for (const effort of data.efforts.filter((entry) => entry.observation)) {
    assert.match(effort.observation.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(files[effort.observation.source]);
  }
});

test('scout flags installer lures and duplicate descriptions and stores claims pending review', () => {
  const description = 'A detailed shared description from three copies of one repository';
  assert.equal(spamCheck({ name: 'fake-pc-installer' }, new Map()).cluster, 'auto-download-lures');
  assert.equal(spamCheck({ name: 'generic', description }, new Map([[normDesc(description), 3]])).cluster, 'auto-clone-networks');
  assert.equal(spamCheck({ name: 'legitimate-research', description: 'Original research notes' }, new Map()), null);
  const claim = detectClaims('GTA VI is now running in-game at 30 fps.');
  assert.ok(claim.length > 0);
});

test('scout records a daily leader and replaces that day on rerun', async () => {
  const snapshot = { efforts: [{ id: 'lead', gta: { loads: 1, boots: 1 } }] };
  const options = {
    now: new Date('2026-11-24T14:00:00Z'),
    limit: 0,
    log: () => {},
    sources: { github: false, hn: false, reddit: false, x: false, chan: false, social: false, gitlab: false, news: false, dmca: false },
  };
  await runScout(snapshot, options);
  assert.equal(snapshot.history[0].leader, 40);
  snapshot.efforts[0].gta.menu = 1;
  await runScout(snapshot, options);
  assert.equal(snapshot.history.length, 1);
  assert.equal(snapshot.history[0].leader, 55);
  assert.equal(snapshot.scout.lastRun, options.now.toISOString());
});

test('news images in the checkout stay local and external source URLs stay HTTPS', () => {
  const bundled = 'assets/img/news/2026-11-24-cgbj-in-game.webp';
  assert.equal(storyImageUrl(bundled), bundled);
  assert.equal(storyImageUrl(bundled, '../'), '../' + bundled);
  assert.equal(storyImageUrl('https://example.test/image.jpg'), 'https://example.test/image.jpg');
  assert.equal(storyImageUrl('javascript:alert(1)'), '');
});

test('public interface translations cover every new interactive label', async () => {
  const dictionaries = await Promise.all(['en', 'es', 'pt-BR'].map(async (lang) => JSON.parse(await read(`../assets/i18n/${lang}.json`))));
  const keys = Object.keys(dictionaries[0]).filter((key) => /^(official|road|search|log|compare|evidence)\./.test(key));
  for (const dict of dictionaries) for (const key of keys) assert.ok(dict[key], key);
});

test('branded image and font files referenced by the build are present', async () => {
  for (const path of ['vice-mark.svg', 'favicon.svg', 'vice-waterfront.webp', 'vice-waterfront-mobile.webp', 'social.jpg', 'social-square.jpg']) {
    await access(new URL(`../assets/img/${path}`, import.meta.url));
  }
  for (const font of ['inter', 'intertight', 'instrumentserif']) {
    await access(new URL(`../assets/fonts/${font}.woff2`, import.meta.url));
    await access(new URL(`../assets/fonts/${font}-OFL.txt`, import.meta.url));
  }
});

test('the live endpoint coalesces requests and serves cached JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(42));
  const context = {
    request: new Request('https://example.test/api/live'),
    env: { SUPABASE_URL: 'https://database.example.test', SUPABASE_KEY: 'test-key' },
  };
  const replies = await Promise.all([onRequestGet(context), onRequestGet(context)]);
  for (const response of replies) {
    assert.equal((await response.json()).n, 42);
    assert.match(response.headers.get('Cache-Control'), /^public, max-age=\d+$/);
  }
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('the update clock advances through complete minutes after the publication time', () => {
  const publishedAt = '2026-11-24T18:30:00.000-04:00';
  const start = Date.parse(publishedAt);
  assert.deepEqual(getUpdateAge(publishedAt, start + (30 * 60 + 22) * 1000), { minutes: 30, nextTick: 38_000 });
  assert.deepEqual(getUpdateAge(publishedAt, start + 31 * 60_000), { minutes: 31, nextTick: 60_000 });
  assert.deepEqual(getUpdateAge(publishedAt, start + 32 * 60_000), { minutes: 32, nextTick: 60_000 });
  assert.deepEqual(getUpdateAge(publishedAt, start - 500), { minutes: 0, nextTick: 60_000 });
  assert.equal(getUpdateAge('unknown', start), null);
});
