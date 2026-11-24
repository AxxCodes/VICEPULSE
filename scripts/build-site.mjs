// Deploy-time build, run by .github/workflows/pages.yml after the site files are copied:
//   node scripts/build-site.mjs _site
// Writes the article pages, news archive, RSS feed, sitemap and IndexNow key into the site folder.
// It also compares the new sitemap with the one that's live now and, if any URL is new or changed,
// writes indexnow.json (outside the site folder) for the workflow to send once the deploy is live.
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { esc } from '../assets/js/news-shared.js';
import { dirname, join } from 'node:path';
import { buildSite, changedUrls, indexNowPayload } from './lib/site-build.mjs';

const args = process.argv.slice(2);
const local = args.includes('--local');
const out = args.find((arg) => !arg.startsWith('--')) || '_site';
const siteUrl = process.env.SITE_URL ? new URL(process.env.SITE_URL).href.replace(/\/?$/, '/') : '';
const indexNowKey = process.env.INDEXNOW_KEY || '';
if (indexNowKey && !/^[a-zA-Z0-9-]{8,128}$/.test(indexNowKey)) {
  throw new Error('Invalid IndexNow key');
}
if (local) {
  await mkdir(out, { recursive: true });
  for (const path of ['index.html', 'assets', 'data']) {
    await cp(path, join(out, path), { recursive: true });
  }
  await writeFile(join(out, '.nojekyll'), '');
}

const data = JSON.parse(await readFile('data/tracker.json', 'utf8'));
const { files, entries } = buildSite(data, { siteUrl, indexNowKey });
if (siteUrl) {
  const home = await readFile('index.html', 'utf8');
  const url = esc(siteUrl);
  const metadata = [
    `  <link rel="canonical" href="${url}">`,
    `  <meta property="og:url" content="${url}">`,
    `  <meta property="og:image" content="${url}assets/img/social.jpg">`,
  ].join('\n');
  await writeFile(join(out, 'index.html'), home.replace('</head>', `${metadata}\n</head>`));
}

for (const [path, content] of Object.entries(files)) {
  const target = join(out, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

if (local) {
  console.log(`Wrote ${Object.keys(files).length} generated files and the static site to ${out}/.`);
} else if (siteUrl && indexNowKey) {
  await prepareIndexNow();
}

async function prepareIndexNow() {
  let previous = null;
  try {
    const res = await fetch(`${siteUrl}sitemap.xml`, { signal: AbortSignal.timeout(15000) });
    if (res.ok) previous = await res.text();
  } catch (err) {
    console.log(`Couldn't read the live sitemap (${err.message}); treating every URL as new.`);
  }
  const urls = changedUrls(previous, entries);
  if (urls.length) await writeFile('indexnow.json', JSON.stringify(indexNowPayload(urls, siteUrl, indexNowKey)));

  console.log(`Wrote ${Object.keys(files).length} files to ${out}/.`);
  console.log(urls.length ? `New or changed since the last deploy:\n  ${urls.join('\n  ')}` : 'No URL changed since the last deploy.');
}
