import { MILESTONES, GROUNDWORK, READINESS_PHASES, readinessChecks, MAX_SCORE, RANK_RUBRIC, gameplaySignals, scoreEffort, overall, ladderValue, byStars } from './scoring.js';
import { getLiveViewers, trackView } from './backend.js';
import { coverHtml, articlePath, storyImageUrl, storyVideoHtml } from './news-shared.js';
import { fillPinned } from './pinned.js';
import { initI18n, t, tr, locale } from './i18n.js';
import { getUpdateAge } from './update-time.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Everything rendered comes from data/tracker.json, part of which is written by an
// automated scout reading untrusted repos, so every string is escaped.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const repoUrl = (repo, branch) => (REPO_RE.test(repo || '') ? `https://github.com/${repo}${branch && branch !== 'main' && branch !== 'master' ? `/tree/${encodeURIComponent(branch)}` : ''}` : '#');
const owner = (repo) => (repo || '').split('/')[0];
const avatar = (repo) => (REPO_RE.test(repo || '') ? `https://github.com/${encodeURIComponent(owner(repo))}.png?size=88` : '');
// Efforts with no public code have `repo: null`. They may give a local `avatar` image and a `link` to our own article.
const hasRepo = (e) => REPO_RE.test(e.repo || '');
const effortAvatar = (e) => (/^assets\/img\/[\w/.-]+$/.test(e.avatar || '') ? e.avatar : avatar(e.repo));
const effortUrl = (e) => (hasRepo(e) ? repoUrl(e.repo, e.branch) : /^news\/[a-z0-9-]+\.html$/.test(e.link || '') ? e.link : '');
const safeHttp = (u) => (/^https:\/\//.test(u || '') ? u : '#');
const pct = (v) => `${Math.round(v * 10) / 10}`;
const axis = (score) => (score / MAX_SCORE) * 100;
const percent = (score) => `${pct(axis(score))}%`;

// Names from scoring.js, in the page's language when a translation exists.
const msLabel = (key) => tr(`ms.${key}.label`, MILESTONES.find((m) => m.key === key)?.label || key);
const msDesc = (m) => tr(`ms.${m.key}.desc`, m.desc);
const gwLabel = (g) => tr(`gw.${g.key}.label`, g.label);
const gwDesc = (g) => tr(`gw.${g.key}.desc`, g.desc);
const catLabel = (cat) => tr(`cat.${cat}`, cat);

function ago(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return t('time.justNow');
  const m = s / 60;
  if (m < 60) return t('time.minutes', { n: Math.floor(m) });
  const h = m / 60;
  if (h < 24) return t('time.hours', { n: Math.floor(h) });
  const d = h / 24;
  if (d < 30) return t('time.days', { n: Math.floor(d) });
  return new Date(ms).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}
const daysSince = (iso) => (Date.now() - Date.parse(iso)) / 864e5;
const fmtK = (n) => (n == null ? '-' : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`);

const ICON = {
  // Radiation trefoil: three 60-degree blades around a dot.
  nuke: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2"/><path d="M17.25 21.09A10.5 10.5 0 0 1 6.75 21.09L10.4 14.77A3.2 3.2 0 0 0 13.6 14.77Z"/><path d="M1.5 12A10.5 10.5 0 0 1 6.75 2.91L10.4 9.23A3.2 3.2 0 0 0 8.8 12Z"/><path d="M17.25 2.91A10.5 10.5 0 0 1 22.5 12L15.2 12A3.2 3.2 0 0 0 13.6 9.23Z"/></svg>',
  star: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .8l2.2 4.6 5 .7-3.6 3.5.9 5L8 12.2 3.5 14.6l.9-5L.8 6.1l5-.7z"/></svg>',
  fork: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5 3.3a1.8 1.8 0 1 0-2.3 1.7v.8A2.5 2.5 0 0 0 5.2 8.3h1.9v2.7a1.8 1.8 0 1 0 1.8 0V8.3h1.9a2.5 2.5 0 0 0 2.5-2.5V5a1.8 1.8 0 1 0-1.5 0v.8a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1V5A1.8 1.8 0 0 0 5 3.3Z"/></svg>',
  issue: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></svg>',
  commit: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 5a3 3 0 0 1 2.9 2.2H15v1.6h-4.1a3 3 0 0 1-5.8 0H1V7.2h4.1A3 3 0 0 1 8 5Zm0 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>',
  clock: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.5V8l2.4 1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  gh: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.5 7.5 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.8-3.6 4 .3.3.6.8.6 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 0Z"/></svg>',
};

const state = {
  data: null, filter: 'all', sort: 'score', query: '', evidence: 'all',
  changeFilter: 'milestones', changeLimit: 6, details: new Map(),
};

// Older snapshots only carry reproduction status. An editorial observation is
// tied to the dated report and does not certify a later assessment.
function evidenceOf(effort) {
  if (effort.verification === 'reproduced') return 'reproduced';
  const observation = effort.observation;
  if (observation?.date === effort.assessedAt && /^news\/[a-z0-9-]+\.html$/.test(observation?.source || '')) {
    return 'observed';
  }
  return 'self-reported';
}

function evidenceLabel(effort) {
  const evidence = evidenceOf(effort);
  return t(evidence === 'observed' ? 'evidence.observed' : evidence === 'reproduced' ? 'effort.reproduced' : 'effort.self');
}

const SNAPSHOT_REFRESH_MS = 60_000;
let trackerSource;
let pinnedSource;
let pinUpdated;
let announceRefresh = false;
let pendingRefresh;
let lastRefresh = 0;
let updateTimer;
let countdownTimer;

async function readSnapshot(name, manual) {
  // Keep the usual URL for conditional revalidation. An explicit refresh also
  // bypasses a cached CDN response without opening a realtime database connection.
  const url = `data/${name}.json${manual ? `?check=${Date.now()}` : ''}`;
  const response = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
  if (name === 'pinned' && response.status === 404) return 'null';
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function refreshSnapshots(manual = false) {
  const button = $('#live-refresh');
  const feedback = $('#live-feedback');
  if (manual) {
    announceRefresh = true;
    feedback.textContent = t('live.checking');
    button.setAttribute('aria-busy', 'true');
  }
  if (pendingRefresh) return pendingRefresh;
  lastRefresh = Date.now();
  const hadData = Boolean(state.data);

  const tracker = readSnapshot('tracker', manual).then((source) => {
    if (source === trackerSource) return false;
    const data = JSON.parse(source);
    if (!Array.isArray(data?.efforts)) throw new Error('Invalid tracker data');
    renderTracker(data);
    trackerSource = source;
    return true;
  });
  const pinned = readSnapshot('pinned', manual).then((source) => {
    if (source === pinnedSource) return false;
    const pin = JSON.parse(source);
    fillPinned($('#pinned'), pin, { ago, when: (iso) => new Date(iso).toLocaleString(locale()) });
    pinUpdated = pin?.updated;
    pinnedSource = source;
    updateClock();
    return true;
  });

  pendingRefresh = Promise.allSettled([tracker, pinned]).then(([data, pin]) => {
    const failed = data.status === 'rejected' || pin.status === 'rejected';
    const changed = data.value || pin.value;
    button.removeAttribute('aria-busy');
    if (announceRefresh || hadData && changed || !state.data && failed) {
      feedback.textContent = t(failed ? 'live.failed' : changed ? 'live.received' : 'live.current');
    }
    if (data.status === 'rejected' && !state.data) {
      $('#hero-readiness').setAttribute('aria-busy', 'false');
      $('#hero-readiness-leader').textContent = t('readiness.unavailable');
    }
    announceRefresh = false;
    return changed;
  }).finally(() => { pendingRefresh = null; });
  return pendingRefresh;
}

async function main() {
  await initI18n();
  startForecast();
  window.addEventListener('scroll', () => $('#nav').classList.toggle('is-scrolled', window.scrollY > 8), { passive: true });
  $('#live-refresh').addEventListener('click', () => refreshSnapshots(true));
  bindControls();
  renderMethod();
  refreshSnapshots();
  setInterval(() => { if (!document.hidden) refreshSnapshots(); }, SNAPSHOT_REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    updateClock();
    if (Date.now() - lastRefresh >= SNAPSHOT_REFRESH_MS) refreshSnapshots();
  });
  trackView('/').then(watchViewers);
}

function renderTracker(data) {
  const previous = state.data;
  state.data = data;
  for (const e of data.efforts) e._s = scoreEffort(e);

  updateClock();
  if (!previous || JSON.stringify(data.site) !== JSON.stringify(previous.site)) renderHeroArt(data.site || {});
  if (!previous || JSON.stringify(data.exe) !== JSON.stringify(previous.exe)) startCountdown(data.exe || {});
  renderOverall(data);
  renderChanges();
  renderRace();
  mountComparison(data.efforts);
  renderNews(data.news || []);
  renderWatchlist(data);
  renderTools(data.tools || []);
  renderInbox(data);
  renderFlags(data.flagged || []);
  observeBars();
}

/* ---------- Meta & hero ---------- */
function updateClock() {
  clearTimeout(updateTimer);
  const data = state.data;
  if (!data) return;
  const trackerTime = Date.parse(data.updated);
  const pinnedTime = Date.parse(pinUpdated);
  const latest = Number.isFinite(pinnedTime) && (!Number.isFinite(trackerTime) || pinnedTime > trackerTime)
    ? pinUpdated : data.updated;
  const age = getUpdateAge(latest);
  const stamp = age ? new Date(latest) : null;
  const exact = stamp?.toLocaleString(locale(), {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }) || '';
  const relative = age ? t('nav.updated', { ago: ago(latest) }) : t('live.unknownTime');
  for (const time of [$('#nav-updated'), $('#hero-updated')]) {
    time.textContent = relative;
    time.title = exact;
    time.dateTime = stamp?.toISOString() || '';
    time.hidden = false;
  }
  if (age) updateTimer = setTimeout(updateClock, age.nextTick + 10);

  const sc = data.scout || {};
  $('#scout-status').textContent = sc.lastRun
    ? `${t('footer.scoutRun', { ago: ago(sc.lastRun) })}${sc.lastSummary ? `: ${sc.lastSummary}` : ''}`
    : t('inbox.every');
}

function renderHeroArt(site) {
  $('#art-credit').textContent = t('hero.illustration');
  $('#hero-photo').style.backgroundImage = '';
  $('#top').classList.remove('has-photo');
  const path = site.heroImage;
  if (!/^assets\/img\/[\w/-]+\.(?:jpg|jpeg|png|webp)$/i.test(path || '') || path === 'assets/img/vice-waterfront.webp') return;
  const img = new Image();
  img.onload = () => {
    if (state.data?.site?.heroImage !== path) return;
    $('#hero-photo').style.backgroundImage = `url("${encodeURI(path)}")`;
    $('#top').classList.add('has-photo');
    $('#art-credit').textContent = site.heroCredit || '';
  };
  img.src = path;
}

/* ---------- Live viewers ----------
   Read on load, then every 5 minutes from visible tabs only: the free backend plan has tight egress, log and
   realtime-connection limits, so don't poll faster or hold a connection open. */
const LIVE_REFRESH_MS = 5 * 60_000;
function watchViewers() {
  const pill = $('#watching');
  let last = 0;
  const refresh = async () => {
    if (document.hidden) return;
    last = Date.now();
    const n = await getLiveViewers();
    pill.textContent = n === null ? t('hero.watchingUnavailable') : t('hero.watching', { n: n.toLocaleString(locale()) });
    pill.title = t(n === null ? 'hero.watchingUnavailable' : 'hero.watchingTitle');
    pill.hidden = false;
  };
  refresh();
  setInterval(refresh, LIVE_REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (Date.now() - last >= LIVE_REFRESH_MS) refresh(); });
}

/* ---------- Countdown ---------- */
function startForecast() {
  const target = Date.parse($('#forecast-target').dateTime);
  const fields = ['days', 'hours', 'minutes', 'seconds'].map((unit) => $(`#forecast-${unit}`));
  let timer;
  const tick = () => {
    const seconds = Math.max(0, Math.ceil((target - Date.now()) / 1000));
    const units = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
    fields.forEach((field, i) => {
      const digit = String(units[i]).padStart(2, '0');
      if (field.textContent !== digit) field.textContent = digit;
    });
    if (seconds === 0) {
      $('#forecast-status').textContent = 'Checkpoint reached · awaiting verified results';
      $('#forecast-live').hidden = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    }
    return seconds;
  };

  if (tick()) {
    $('#forecast-live').hidden = false;
    timer = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
  }
}

function startCountdown(exe) {
  clearInterval(countdownTimer);
  const box = $('#countdown');
  const by = exe.by ? t('cd.dropBy', { by: exe.by }) : t('cd.drop');
  const released = exe.status === 'released' && exe.releasedAt;
  const target = Date.parse(released ? exe.releasedAt : exe.expectedAt || `${exe.expected}T00:00:00Z`);
  const dayFmt = new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
  const timeFmt = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  box.classList.toggle('is-released', Boolean(released));
  box.classList.remove('is-due');
  $('#cd-digits').hidden = !Number.isFinite(target);
  $('#cd-foot').replaceChildren();
  $('#cd-title').textContent = released ? t('cd.released') : by;
  const src = exe.source ? ` · <a href="${esc(safeHttp(exe.source))}" target="_blank" rel="noopener">${esc(t('cd.source'))}</a>` : '';
  if (!Number.isFinite(target)) {
    $('#cd-status').textContent = t('cd.noDate');
    return;
  }
  if (released) {
    $('#cd-foot').innerHTML = `${esc(t('cd.outSince', { day: dayFmt.format(target), time: timeFmt.format(target) }))}${src}`;
  } else {
    const when = exe.timeAnnounced ? `${dayFmt.format(target)}, ${timeFmt.format(target)}` : t('cd.noTime', { day: dayFmt.format(target) });
    $('#cd-foot').innerHTML = `${esc(t('cd.expected', { when }))}${src}`;
  }

  const pad = (n) => String(n).padStart(2, '0');
  const tick = () => {
    let diff = released ? Math.max(0, Date.now() - target) : target - Date.now();
    const due = !released && diff <= 0;
    if (due) diff = 0;
    const d = Math.floor(diff / 864e5);
    const h = Math.floor((diff % 864e5) / 36e5);
    const m = Math.floor((diff % 36e5) / 6e4);
    const s = Math.floor((diff % 6e4) / 1e3);
    $('#cd-d').textContent = pad(d);
    $('#cd-h').textContent = pad(h);
    $('#cd-m').textContent = pad(m);
    $('#cd-s').textContent = pad(s);
    box.classList.toggle('is-due', due);
    let status;
    if (released) status = t('cd.sinceRelease');
    else if (!due) status = t('cd.left');
    else {
      const late = (Date.now() - target) / 36e5;
      status = late < 24 ? t('cd.dueNow') : t('cd.overdue', { d: Math.floor(late / 24), h: Math.floor(late % 24) });
    }
    $('#cd-status').textContent = status;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

/* ---------- Overall ---------- */
let markerResize;
function renderOverall(data) {
  const all = data.efforts;
  const ov = overall(all);
  const leader = ov.leader?.effort;
  $('#ov-score').textContent = pct(axis(ov.score));
  renderReadiness(ov);
  const hasStableRun = all.some((e) => !e.nuked && e._s.reached === 'ingame' && gameplaySignals(e.gta).sessionMinutes >= 30);
  const hasSustained30 = all.some((e) => !e.nuked && e._s.reached === 'ingame' && gameplaySignals(e.gta).sustained30);
  const answer = $('#answer');
  answer.hidden = !leader;
  answer.textContent = t(`answer.${hasStableRun ? 'yes' : hasSustained30 ? 'mostly' : ov.furthest.key === 'ingame' ? 'sortOf' : 'notYet'}`);
  $('#ov-leader').innerHTML = leader
    ? `${esc(t('ov.leader'))} <a href="#effort-${esc(leader.id)}">${esc(leader.name)}</a> ${hasRepo(leader) ? `${esc(t('ov.byOwner', { owner: owner(leader.repo) }))} ` : ''}${esc(ov.leader.reached === 'groundwork' ? t('ov.stillGroundwork') : t('ov.reached', { label: msLabel(ov.leader.reached) }))}`
    : esc(t('ov.none'));
  $('#ov-stage').textContent = msLabel(ov.furthest.key);
  $('#ov-top3').textContent = percent(ov.top3);
  const booted = all.filter((e) => ladderValue(e.gta?.boots) >= 1).length;
  $('#ov-boot').textContent = `${booted} / ${all.length}`;
  $('#ov-count').textContent = `${all.length}`;

  $('#leader-checks').innerHTML = leader ? checkList(leader) : '';
  renderRoute(ov.furthest);

  $('#mega-ticks').innerHTML = MILESTONES.slice(1, -1).map((m) => `<i style="left:${axis(m.at)}%"></i>`).join('');
  $('#mega-fill').dataset.width = axis(ov.score);

  const top = ov.ranked.slice(0, 6);
  const draw = () => drawMarkers(top, leader);
  $('#project-positions').ontoggle = (ev) => { if (ev.target.open) draw(); };
  if ($('#project-positions').open) draw();
  let raf;
  if (markerResize) window.removeEventListener('resize', markerResize);
  markerResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
  window.addEventListener('resize', markerResize);

  renderHistory(data.history || [], all);
}

function renderReadiness(overview) {
  const score = overview.score;
  const label = percent(score);
  for (const id of ['#hero-readiness-track', '#score-track']) {
    const track = $(id);
    track.setAttribute('aria-valuenow', pct(axis(score)));
    track.style.setProperty('--score', `${axis(score)}%`);
  }

  const next = READINESS_PHASES.find((phase) => phase.at > score);
  const leader = overview.leader?.effort;
  const scoreLink = $('#hero-readiness-score');
  scoreLink.hidden = !leader;
  scoreLink.textContent = label;
  $('#hero-readiness-leader').textContent = !leader ? t('ov.none')
    : next ? t('readiness.lead', { name: leader.name, phase: t(`readiness.${next.key}`), percent: percent(next.at) })
      : t('readiness.complete', { name: leader.name });
  $('#hero-readiness').setAttribute('aria-busy', 'false');
  $('#readiness-phases').innerHTML = READINESS_PHASES.map((phase) => `
    <li class="${phase === next ? 'is-next' : ''}">
      <span class="readiness-phase-score">${percent(phase.at)}</span>
      <b>${esc(t(`readiness.${phase.key}`))}</b>
      <span>${esc(t(`readiness.${phase.key}Detail`))}</span>
    </li>`).join('');
}

function renderRoute(furthest) {
  const group = $('#mega-labels');
  const detail = $('#roadmap-detail');
  const current = MILESTONES.indexOf(furthest);
  group.style.setProperty('--route-progress', `${current / (MILESTONES.length - 1) * 100}%`);
  group.innerHTML = MILESTONES.map((milestone, i) => {
    const label = msLabel(milestone.key);
    return `<button type="button" class="route-step ${i < current ? 'is-passed' : i === current ? 'is-current' : ''}"
      data-step="${i}" aria-controls="roadmap-detail" aria-pressed="false"
      ${i === current ? 'aria-current="step"' : ''}>
      <span class="route-value">${percent(milestone.at)}</span><span class="route-node" aria-hidden="true"></span><span>${esc(label)}</span>
    </button>`;
  }).join('');
  const select = (i) => {
    const step = MILESTONES[i];
    for (const btn of group.children) btn.setAttribute('aria-pressed', String(+btn.dataset.step === i));
    detail.innerHTML = `<strong>${esc(msLabel(step.key))}</strong><span>${esc(msDesc(step))}</span>`;
  };
  select(state.milestone ?? current);
  group.onclick = (event) => {
    const button = event.target.closest('[data-step]');
    if (button) {
      state.milestone = Number(button.dataset.step);
      select(state.milestone);
    }
  };
}

// Avatars sit in one row above the bar, spread apart so they never overlap,
// with a curved leader line down to each effort's true position.
function drawMarkers(ranked, leader) {
  const box = $('#mega-markers');
  const W = box.clientWidth;
  const H = box.clientHeight;
  if (!W) return;
  const GAP = Math.min(42, (W - 36) / Math.max(1, ranked.length - 1));
  const items = ranked.map((r) => ({ r, x: (r.score / MAX_SCORE) * W })).sort((a, b) => a.x - b.x);
  items.forEach((it, i) => { it.a = i ? Math.max(it.x, items[i - 1].a + GAP) : it.x; });
  const shift = items.reduce((s, it) => s + (it.x - it.a), 0) / Math.max(1, items.length);
  items.forEach((it, i) => {
    it.a += shift;
    it.a = Math.max(18, i ? Math.max(it.a, items[i - 1].a + GAP) : it.a);
  });
  const overflow = items.length ? items[items.length - 1].a - (W - 18) : 0;
  if (overflow > 0) items.forEach((it) => { it.a -= overflow; });

  const avatarY = H - 66;
  const lines = items.map((it) => {
    const y0 = avatarY + 32;
    return `<path d="M${it.a} ${y0} C ${it.a} ${y0 + 18}, ${it.x} ${H - 18}, ${it.x} ${H}" fill="none" stroke="${it.r.effort === leader ? '#ff2e7e' : 'var(--line-2)'}" stroke-width="1.6"/>
            <circle cx="${it.x}" cy="${H - 1}" r="3" fill="${it.r.effort === leader ? '#ff2e7e' : 'var(--faint)'}"/>`;
  }).join('');
  box.innerHTML = `<svg width="${W}" height="${H}" style="position:absolute;inset:0;overflow:visible" aria-hidden="true">${lines}</svg>` +
    items.map((it) => {
      const e = it.r.effort;
      const src = effortAvatar(e);
      return `<a class="marker ${e === leader ? 'is-leader' : ''}" href="#effort-${esc(e.id)}" style="left:${it.a}px;bottom:${H - avatarY - 32}px"
                data-tip-title="${esc(e.name)} · ${percent(it.r.score)}" data-tip="${esc(msLabel(it.r.reached))} · ${esc(e.approach || '')}">
                <span class="mk-name">${esc(e.name)} · ${percent(it.r.score)}</span>
                ${src ? `<img src="${esc(src)}" alt="" loading="lazy" data-fallback="${esc(e.name.slice(0, 2))}">` : `<span class="mk-fallback">${esc(e.name.slice(0, 2))}</span>`}
              </a>`;
    }).join('');
}

function renderHistory(history, efforts) {
  const box = $('#ov-history');
  const pts = history.filter((h) => h.rubric === RANK_RUBRIC && Number.isFinite(h.leader)).sort((a, b) => a.date.localeCompare(b.date));
  const names = new Map(efforts.map((effort) => [effort.id, effort.name]));
  box.hidden = pts.length === 0;
  if (box.hidden) return;
  const W = 1000, H = 70;
  const x = (i) => (i / Math.max(1, pts.length - 1)) * W;
  const y = (v) => H - (v / MAX_SCORE) * (H - 6) - 3;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.leader).toFixed(1)}`).join(' ');
  box.innerHTML = `<p>Gameplay-score history starts with the new rubric on November 24. Earlier percentage scores used a different method.</p>
    ${pts.length > 1 ? `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="${esc(t('ov.historyLabel'))}">
      <defs><linearGradient id="hg" x1="0" x2="1"><stop offset="0" stop-color="#7a5cff"/><stop offset=".55" stop-color="#ff2e7e"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient>
      <linearGradient id="hf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff2e7e" stop-opacity=".18"/><stop offset="1" stop-color="#ff2e7e" stop-opacity="0"/></linearGradient></defs>
      <path d="${d} L${W} ${H} L0 ${H} Z" fill="url(#hf)"/>
      <path d="${d}" fill="none" stroke="url(#hg)" stroke-width="3" vector-effect="non-scaling-stroke"/>
    </svg>` : ""}
    <details class="history-data"${box.querySelector(".history-data")?.open === false ? "" : " open"}>
      <summary>${esc(t('road.historyData'))}</summary>
      <table>
        <thead><tr><th scope="col">${esc(t('road.day'))}</th><th scope="col">${esc(t('ov.leader'))}</th><th scope="col">${esc(t('ov.top3'))}</th><th scope="col">${esc(t('ov.furthest'))}</th></tr></thead>
        <tbody>${[...pts].reverse().map((p) => `<tr><th scope="row"><time datetime="${esc(p.date)}">${esc(fmtDay(p.date))}</time></th><td><b>${percent(p.leader)}</b><br>${esc(names.get(p.leaderId) || p.leaderId || "–")}</td><td>${Number.isFinite(p.top3) ? percent(p.top3) : '–'}</td><td>${p.furthest ? esc(msLabel(p.furthest)) : '–'}</td></tr>`).join('')}</tbody>
      </table>
    </details>`;
}

/* ---------- Changes ---------- */
function renderChanges() {
  if (!state.data) return;
  const list = $('#changes-list');
  const changes = state.data.changes || [];
  const filters = { milestones: ['up', 'down'], claims: ['claim'], scout: ['new'], safety: ['flag', 'removed'] };
  const kindOf = (event) => event.kind === 'new' && event.text?.startsWith('News: ') ? 'news' : event.kind;
  const kinds = filters[state.changeFilter];
  const match = [...changes].reverse().filter((event) => !kinds || kinds.includes(kindOf(event)));
  const cls = { up: 'ck-up', down: 'ck-down', flag: 'ck-flag', new: 'ck-new', news: 'ck-new', removed: 'ck-down', claim: 'ck-flag' };
  list.innerHTML = match.slice(0, state.changeLimit).map((c) =>
    `<li><span class="ck ${cls[kindOf(c)] || ''}"></span><time datetime="${esc(c.date)}">${esc(new Date(`${c.date}T12:00:00Z`).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }))}</time><span>${cls[kindOf(c)] ? `<b class="event-kind">${esc(t(`log.kind.${kindOf(c)}`))}</b>` : ''}${esc(c.text)}</span></li>`
  ).join('') || `<li class="log-empty">${esc(t('log.empty'))}</li>`;
  $('#more-changes').hidden = match.length <= state.changeLimit;
}

/* ---------- Race ---------- */
function isGtaSpecific(e) { return /gta/i.test(e.target || ''); }

function renderRace() {
  const { data, filter, sort, query, evidence } = state;
  if (!data) return;
  let list = data.efforts.filter((e) => e.tier === 'tracked');
  if (filter === 'gta') list = list.filter(isGtaSpecific);
  if (filter === 'generic') list = list.filter((e) => !isGtaSpecific(e));
  if (query) list = list.filter((e) => `${e.name} ${e.repo || ''}`.toLowerCase().includes(query));
  if (evidence !== 'all') list = list.filter((e) => evidence === 'archived' ? e.nuked : !e.nuked && evidenceOf(e) === evidence);
  // Nuked efforts (taken offline) stay on the board for the record, after the ranked ones and without a rank.
  const byScore = (a, b) => b._s.score - a._s.score || byStars(a, b);
  const sorters = {
    score: byScore,
    stars: byStars,
    active: (a, b) => (Date.parse(b.stats?.pushedAt) || 0) - (Date.parse(a.stats?.pushedAt) || 0),
  };
  const ranked = [...data.efforts.filter((e) => e.tier === 'tracked' && !e.nuked)].sort(byScore);
  const rankedInFilter = list.filter((e) => !e.nuked).sort(byScore);
  const filtered = filter !== 'all';
  const sortBy = sorters[sort] || byScore;
  list.sort((a, b) => Number(!!a.nuked) - Number(!!b.nuked) || sortBy(a, b));
  $('#race-results').textContent = t(list.length === 1 ? 'search.one' : 'search.count', { n: list.length });
  $('#race-list').innerHTML = list.map((e, i) => {
    const overall = e.nuked ? null : ranked.indexOf(e) + 1;
    const rank = e.nuked ? null : filtered ? rankedInFilter.indexOf(e) + 1 : overall;
    const expanded = state.details.get(`details-${e.id}`) ?? (sort === 'score' && !e.nuked && i < 3);
    return effortCard(e, rank, expanded, filtered ? overall : null);
  }).join('') ||
    `<li class="empty">${esc(t('race.empty'))}</li>`;
  observeBars();
}

function playChecks(e) {
  const checks = readinessChecks(e);
  return [
    ...checks.rendering.map(({ key, progress }) => ({
      label: t(`metric.${key}`),
      progress,
      detail: e.visualNotes?.[key] || t(progress ? 'metric.sceneEstimate' : 'metric.noScene'),
    })),
    { label: t('metric.frameRate'), progress: checks.frameRate,
      detail: e.fpsNote || (checks.fps ? t('metric.fpsDetail', { fps: checks.fps }) : t('metric.noFps')) },
    { label: t('metric.sustained'), progress: checks.sustained,
      detail: t(checks.sustained ? 'metric.reached' : 'metric.notReached') },
    { label: t('metric.session'), progress: checks.session,
      detail: e.sessionNote || (checks.sessionMinutes ? t('metric.sessionDetail', { minutes: checks.sessionMinutes }) : t('metric.noSession')) },
  ];
}

function metricPercent(progress) {
  return `${pct(progress * 100)}%`;
}

function checkList(e) {
  return `<dl class="play-checks">${playChecks(e).map(({ label, detail, progress }) => `
    <div data-state="${progress === 1 ? 'pass' : progress ? 'partial' : ''}">
      <dt>${esc(label)}</dt>
      <dd class="check-value">${metricPercent(progress)}</dd>
      <dd class="check-meter" aria-hidden="true"><span style="--check-progress:${metricPercent(progress)}"></span></dd>
      <dd class="check-detail">${esc(detail)}</dd>
    </div>`).join('')}</dl>`;
}

function effortCard(e, rank, open, overallRank = null) {
  const s = e._s;
  const st = e.stats || {};
  const ticks = MILESTONES.slice(1, -1).map((m) => `<i style="left:${axis(m.at)}%"></i>`).join('');
  const stale = st.pushedAt && daysSince(st.pushedAt) > 3;
  const tags = [
    e.approach && `<span class="tag">${esc(e.approach)}</span>`,
    e.target && `<span class="tag ${isGtaSpecific(e) ? 'tag-gta' : ''}">${esc(e.target)}</span>`,
    evidenceOf(e) === 'observed'
      ? `<a class="tag tag-observed" href="${esc(e.observation.source)}" title="${esc(t('evidence.observedTitle'))}">${esc(evidenceLabel(e))}</a>`
      : evidenceOf(e) === 'reproduced'
        ? `<span class="tag tag-ok">${esc(evidenceLabel(e))}</span>`
        : `<span class="tag tag-self" title="${esc(t('effort.selfTitle'))}">${esc(evidenceLabel(e))}</span>`,
    e.provenOn && ladderValue(e.groundwork?.proven) > 0 && `<span class="tag tag-proven" title="${esc(t('effort.runsTitle'))}">${esc(t('effort.runs', { x: e.provenOn }))}</span>`,
    stale && `<span class="tag tag-stale">${esc(t('effort.quiet', { n: Math.floor(daysSince(st.pushedAt)) }))}</span>`,
    st.missing && `<span class="tag tag-stale">${esc(t('effort.gone'))}</span>`,
    st.dmca && `<a class="tag tag-stale" href="${esc(safeHttp(st.dmca.url))}" target="_blank" rel="noopener" title="${esc(t('effort.dmcaTitle'))}">${esc(t('effort.dmca', { date: st.dmca.date || '' }))}</a>`,
  ].filter(Boolean).join('');
  const gwRows = GROUNDWORK.map((g) => {
    const v = Math.max(0, Math.min(1, +(e.groundwork?.[g.key]) || 0));
    return `<div class="gw-row" title="${esc(gwDesc(g))}"><span>${esc(gwLabel(g))}</span><b>${Math.round(v * 100)}%</b><div class="gw-bar"><i data-width="${v * 100}"></i></div></div>`;
  }).join('');
  const claims = (e.claims || []).slice(0, 2).map((c) => `<div class="claim"><b>${esc(t('effort.claim'))}</b> “${esc(c.text)}”, ${esc(t('effort.mayMean'))} <em>${esc(MILESTONES.some((m) => m.key === c.milestone) ? msLabel(c.milestone) : c.milestone)}</em>. ${esc(t('effort.awaiting'))}</div>`).join('');
  const src = effortAvatar(e);
  const url = effortUrl(e);
  const external = hasRepo(e) ? ' target="_blank" rel="noopener"' : '';
  return `
  <li class="effort ${rank && rank <= 3 ? 'is-top' : ''}${e.nuked ? ' is-nuked' : ''}" id="effort-${esc(e.id)}">
    <div class="e-rank">${e.nuked ? `<span class="nuke-rank" title="${esc(t('effort.nukedTitle', { date: e.nuked.at || '' }))}">${ICON.nuke}</span>` : rank}${overallRank ? `<small class="e-rank-overall" title="${esc(t('race.overallTitle'))}">${esc(t('race.overall', { n: overallRank }))}</small>` : ''}</div>
    <div class="e-main">
      ${e.nuked ? `<div class="nuke-banner" title="${esc(t('effort.nukedTitle', { date: e.nuked.at || '' }))}">${ICON.nuke}<b>${esc(t('effort.nuked'))}</b><span>${esc(e.nuked.note || '')}</span></div>` : ''}
      <div class="e-top">
        ${src ? `<img class="e-avatar" src="${esc(src)}" alt="" loading="lazy" data-hide-on-error>` : ''}
        <div class="e-title">
          <h3>${url ? `<a href="${esc(url)}"${external}>${esc(e.name)}</a>` : esc(e.name)}</h3>
          <p class="e-by">${hasRepo(e) ? `${esc(e.repo)}${e.branch && !['main', 'master'].includes(e.branch) ? ` · ${esc(t('effort.branch', { b: e.branch }))}` : ''}` : esc(e.byline || '')}</p>
        </div>
        <div class="e-score"><b>${pct(axis(s.score))}<span>%</span></b><small>${esc(msLabel(s.reached))}</small></div>
      </div>
      <div class="tags">${tags}</div>
      <p class="e-summary">${esc(e.summary)}</p>
      ${e.evidence ? `<p class="e-provenance"><b>Evidence</b> ${esc(e.evidence)}</p>` : ''}
      ${e.basedOn?.length ? `<p class="e-provenance"><b>Based on</b> ${e.basedOn.map((id) => {
        const project = state.data.efforts.find((effort) => effort.id === id);
        return project ? `<a href="#effort-${esc(project.id)}">${esc(project.name)}</a>` : esc(id);
      }).join(' · ')}</p>` : ''}
      <div class="bar" aria-label="${esc(t('effort.progressLabel', { name: e.name, n: pct(axis(s.score)) }))}">
        <div class="bar-track"><div class="bar-fill" data-width="${axis(s.score)}"></div><div class="bar-ticks">${ticks}</div></div>
        ${checkList(e)}
      </div>
      ${claims}
      <div class="e-details" id="details-${esc(e.id)}" ${open ? '' : 'hidden'}>
        ${e.groundwork ? `<div class="gw">
          <h4>${esc(t('effort.gwBreakdown'))}</h4>
          ${gwRows}
          ${e.provenOn ? `<p class="gw-proven">${esc(t('effort.provenOn', { x: e.provenOn }))}</p>` : ''}
        </div>` : ''}
        <div class="notes">
          <div class="works"><h4>${esc(t('effort.works'))}</h4><ul>${(e.highlights || []).map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>
          <div class="blocks"><h4>${esc(t('effort.blocking'))}</h4><ul>${(e.blockers || []).map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>
        </div>
      </div>
      <div class="e-foot">
        ${hasRepo(e) ? `<span class="stat-i" title="${esc(t('effort.stars'))}">${ICON.star}${fmtK(st.stars)}</span>
        <span class="stat-i" title="${esc(t('effort.forks'))}">${ICON.fork}${fmtK(st.forks)}</span>
        <span class="stat-i" title="${esc(t('effort.issues'))}">${ICON.issue}${fmtK(st.openIssues)}</span>
        ${st.commits7d != null ? `<span class="stat-i" title="${esc(t('effort.commitsTitle'))}">${ICON.commit}${esc(t('effort.commits', { n: st.commits7d >= 100 ? '100+' : st.commits7d }))}</span>` : ''}
        <span class="stat-i" title="${esc(t('effort.lastPush'))}">${ICON.clock}${esc(t('effort.pushed', { ago: ago(st.pushedAt) }))}</span>` : ''}
        <span class="spacer"></span>
        <span class="w-muted" title="${esc(t('effort.reviewedTitle'))}">${esc(e.assessedBy === 'claude' ? t('effort.byClaude') : t('effort.reviewed'))} ${esc(e.assessedAt || '')}</span>
        <button class="toggle" data-toggle aria-controls="details-${esc(e.id)}" aria-expanded="${open}">${esc(open ? t('effort.hideDetails') : t('effort.details'))}</button>
        ${hasRepo(e) ? `<a class="gh-link" href="${esc(repoUrl(e.repo, e.branch))}" target="_blank" rel="noopener">${ICON.gh}GitHub</a>` : ''}
      </div>
    </div>
  </li>`;
}

function mountComparison(efforts) {
  const active = overall(efforts).ranked.map(({ effort }) => effort);
  const box = $('#comparison');
  box.hidden = active.length < 2;
  if (box.hidden) return;
  const picks = [...box.querySelectorAll('select')];
  const options = active.map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
  const selections = picks.map((select) => active.find((e) => e.id === select.value)?.id);
  selections[0] ??= active.find((e) => e.id !== selections[1]).id;
  selections[1] ??= active.find((e) => e.id !== selections[0]).id;
  picks.forEach((select, i) => {
    select.innerHTML = options;
    select.value = selections[i];
  });
  const render = () => {
    const pair = picks.map((select) => active.find((e) => e.id === select.value));
    picks.forEach((select, i) => {
      for (const opt of select.options) opt.disabled = opt.value === pair[1 - i].id;
    });
    const rows = [
      ['watch.progress', (e) => percent(e._s.score)],
      ...playChecks(pair[0]).map(({ label }, i) => [label, (e) => `${metricPercent(playChecks(e)[i].progress)} · ${playChecks(e)[i].detail}`]),
      ['ov.furthest', (e) => msLabel(e._s.reached)],
      ['search.evidence', evidenceLabel],
      ['watch.approach', (e) => e.approach || '–'],
      ['watch.lastPush', (e) => ago(e.stats?.pushedAt) || '–'],
      ['effort.blocking', (e) => e.blockers?.join(' · ') || '–'],
    ];
    $('#compare-head').innerHTML = `<tr><th scope="col">${esc(t('compare.metric'))}</th>${pair.map((e) => `<th scope="col">${esc(e.name)}</th>`).join('')}</tr>`;
    $('#compare-body').innerHTML = rows.map(([key, value]) => `<tr><th scope="row">${esc(tr(key, key))}</th>${pair.map((e) => `<td>${esc(value(e))}</td>`).join('')}</tr>`).join('');
  };
  picks.forEach((select) => { select.onchange = render; });
  render();
}

/* ---------- Watchlist ---------- */
function renderWatchlist(data) {
  const rows = data.efforts.filter((e) => e.tier === 'watchlist').sort((a, b) => b._s.score - a._s.score || byStars(a, b));
  $('#watchlist').hidden = !rows.length;
  if (!rows.length) return;
  const head = ['watch.project', 'watch.approach', 'watch.progress', 'watch.stars', 'watch.lastPush'].map((k) => `<span role="columnheader">${esc(t(k))}</span>`).join('');
  $('#watch-list').innerHTML = `
    <div class="w-row w-head" role="row">${head}</div>` +
    rows.map((e) => `
    <div class="w-row" role="row" id="effort-${esc(e.id)}">
      <div class="w-name" role="cell"><a href="${esc(repoUrl(e.repo, e.branch))}" target="_blank" rel="noopener">${esc(e.name)}</a><p>${esc(e.summary)}</p>
        ${/^https:\/\/discord\.gg\/[A-Za-z0-9-]+$/.test(e.discord || '') ? `<p><a href="${esc(e.discord)}" target="_blank" rel="noopener noreferrer">Discord</a></p>` : ''}
        ${e.highlights?.length || e.blockers?.length ? `<details class="watch-details"><summary>Project evidence</summary>${checkList(e)}
          <ul>${[...(e.highlights || []), ...(e.blockers || [])].map((note) => `<li>${esc(note)}</li>`).join('')}</ul>
        </details>` : ''}
      </div>
      <span class="w-muted" role="cell">${esc(e.approach)}${e.target && /gta|ps5/i.test(e.target) ? ` · ${esc(e.target)}` : ''}</span>
      <div class="w-bar" role="cell"><div class="bar-track"><div class="bar-fill" data-width="${axis(e._s.score)}"></div></div><b>${percent(e._s.score)}</b></div>
      <span class="w-muted" role="cell">★ ${fmtK(e.stats?.stars)}</span>
      <span class="w-muted" role="cell">${esc(ago(e.stats?.pushedAt))}</span>
    </div>`).join('');
}

/* ---------- Toolkit ---------- */
function renderTools(tools) {
  $('#tools-list').innerHTML = tools.map((x) => `
    <a class="tool" href="${esc(repoUrl(x.repo))}" target="_blank" rel="noopener">
      <span class="t-kind">${esc(x.kind)}</span>
      <h3>${esc(x.name)}</h3>
      <p>${esc(x.desc)}</p>
      <span class="t-meta">★ ${fmtK(x.stats?.stars)} · ${esc(t('effort.pushed', { ago: ago(x.stats?.pushedAt) }))}</span>
    </a>`).join('');
}

/* ---------- Inbox ---------- */
function renderInbox(data) {
  const c = (data.candidates || []).filter((x) => x.status !== 'rejected');
  if (!c.length) {
    $('#inbox-list').innerHTML = `<div class="empty">${esc(t('inbox.empty'))} ${esc(data.scout?.lastRun ? t('inbox.lastRan', { ago: ago(data.scout.lastRun) }) : t('inbox.every'))}</div>`;
    return;
  }
  // Deliberately plain text: unreviewed repos can be copies or lures, so we don't link them.
  $('#inbox-list').innerHTML = c.slice(0, 12).map((x) => `
    <div class="cand">
      <div>
        <b>${esc(x.repo)}</b> <span class="tag tag-self">${esc(t('inbox.unreviewed'))}</span>
        <p>${esc(x.description || t('inbox.noDesc'))}</p>
        <p>${esc(t('inbox.foundVia', { x: (x.sources || [x.source]).filter(Boolean).join(', ') }))} · ${esc(ago(x.foundAt))} · ★ ${fmtK(x.stars)}${x.signals?.length ? ` · ${esc(x.signals.slice(0, 4).join(', '))}` : ''}</p>
      </div>
      <div class="c-score"><b>${Math.round(x.substance || 0)}</b>${esc(t('inbox.substance'))}</div>
    </div>`).join('');
}

/* ---------- News ---------- */
const safeLink = (u) => (/^#[\w-]+$/.test(u || '') ? u : safeHttp(u));
const fmtDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });

function storyMedia(n) {
  const url = storyImageUrl(n.image?.url);
  const img = url
    ? `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-cover="${esc(n.category)}">`
    : coverHtml(n.category);
  return `<div class="story-media">${img}<span class="story-cat">${esc(catLabel(n.category))}</span></div>`;
}

function renderNews(news) {
  // Newest day first; stories from the same day keep their order in the data (newest first).
  const items = [...news].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  $('#news').hidden = !items.length;
  $('#latest-dispatch').hidden = !items.length;
  $('#headlines')?.remove();
  if (!items.length) return;

  $('#dispatch-list').innerHTML = items.slice(0, 4).map((story) => `<li>
    <time datetime="${esc(story.date)}">${esc(fmtDay(story.date))}</time>
    <a href="${esc(articlePath(story) || '#news')}" data-story="${esc(story.id)}">${esc(story.title)}</a>
  </li>`).join('');
  // Real links to each article's own page (built at deploy) so search engines can follow them;
  // a plain click opens the article in the reader instead.
  const card = (n, small) => `
    <a class="story ${small ? 'is-small' : ''}" href="${esc(articlePath(n) || '#news')}" data-story="${esc(n.id)}">
      ${storyMedia(n)}
      <div class="story-body">
        <time>${esc(fmtDay(n.date))}</time>
        <h3>${esc(n.title)}</h3>
        <p>${esc(n.dek)}</p>
        ${!small && n.image?.credit ? `<span class="story-credit">${esc(t('news.image'))} ${esc(n.image.credit)}</span>` : ''}
      </div>
    </a>`;
  $('#news-list').innerHTML = card(items[0], false) + `<div class="news-list">${items.slice(1, 7).map((n) => card(n, true)).join('')}</div>`;
  const heads = (state.data.headlines || []).slice(0, 10);
  if (heads.length) {
    $('#news-list').insertAdjacentHTML('afterend', `
      <div class="headlines card" id="headlines">
        <h3 class="mini-title">${esc(t('news.headlines'))} <span class="w-muted">${esc(t('news.headlinesNote'))}</span></h3>
        <ul>${heads.map((h) => `<li><a href="${esc(safeHttp(h.link))}" target="_blank" rel="noopener noreferrer">${esc(h.title)}</a><span>${esc(h.outlet)} · ${esc(ago(h.date))}</span></li>`).join('')}</ul>
      </div>`);
  }

  const dlg = $('#reader');
  const openStory = (ev) => {
    const btn = ev.target.closest('[data-story]');
    if (!btn) return;
    if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return; // new tab/window: let the link work
    const n = items.find((x) => x.id === btn.dataset.story);
    if (!n) return;
    ev.preventDefault();
    const page = articlePath(n);
    $('#reader-body').innerHTML = `
      ${storyMedia(n)}
      <div class="reader-inner">
        <p class="meta">${esc(catLabel(n.category))} · ${esc(fmtDay(n.date))}</p>
        <h2 id="reader-title">${esc(n.title)}</h2>
        <p class="dek">${esc(n.dek)}</p>
        ${storyVideoHtml(n)}
        <div class="article">${(n.body || []).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
        <div class="sources">
          <h4>${esc(t('news.sources'))}</h4>
          <ul>${(n.sources || []).map((s) => `<li><a href="${esc(safeLink(s.url))}" ${s.url?.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}>${esc(s.outlet)}: ${esc(s.title)}</a></li>`).join('')}</ul>
          <p class="fine">${n.image?.credit ? `${esc(t('news.image'))} <a href="${esc(storyImageUrl(n.image.link || n.image.url) || '#')}" target="_blank" rel="noopener">${esc(n.image.credit)}</a>. ` : ''}${esc(n.by === 'report' ? t('news.byReport') : t('news.bySources'))}${page ? ` <a href="${esc(page)}">${esc(t('news.link'))}</a>` : ''}</p>
        </div>
      </div>`;
    dlg.showModal();
    dlg.scrollTop = 0;
  };
  $('#news-list').onclick = openStory;
  $('#dispatch-list').onclick = openStory;
  $('#reader-close').onclick = () => dlg.close();
  dlg.onclick = (ev) => { if (ev.target === dlg) dlg.close(); };
  $('#reader-body').onclick = (ev) => { if (ev.target.closest('a[href^="#"]')) dlg.close(); };
}

/* ---------- Safety ---------- */
function renderFlags(flags) {
  $('#flag-list').innerHTML = flags.map((f) => `
    <li><b>${esc(f.pattern)}<span>${esc(f.members?.length ? t('safety.seen', { n: f.members.length }) : f.label || '')}</span></b><p>${esc(f.reason)}</p></li>`).join('');
}

/* ---------- Method ---------- */
function renderMethod() {
  $('#ladder-explain').innerHTML = MILESTONES.map((m, i) => `
    <li><span class="le-at">${i === 0 ? '0–5%' : percent(m.at)}</span><div><h4>${esc(msLabel(m.key))}</h4><p>${esc(msDesc(m))}</p></div></li>`).join('');
  $('#gw-explain').innerHTML = GROUNDWORK.map((g) => `<li><b>${esc(gwLabel(g))}<span>${percent(g.weight * 4)}</span></b>${esc(gwDesc(g))}</li>`).join('');
}

/* ---------- Interaction ---------- */
function bindControls() {
  const filters = $$('.chip[data-filter]');
  for (const button of filters) button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
  filters.forEach((b) => b.addEventListener('click', () => {
    filters.forEach((x) => {
      x.classList.toggle('is-on', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
    state.filter = b.dataset.filter;
    renderRace();
  }));
  $('#race-search').addEventListener('input', (ev) => {
    state.query = ev.target.value.trim().toLowerCase();
    renderRace();
  });
  $('#race-evidence').addEventListener('change', (ev) => {
    state.evidence = ev.target.value;
    renderRace();
  });
  $('#change-filter').addEventListener('change', (ev) => {
    state.changeFilter = ev.target.value;
    state.changeLimit = 6;
    renderChanges();
  });
  $('#more-changes').addEventListener('click', () => {
    const firstNewIndex = state.changeLimit;
    state.changeLimit += 12;
    renderChanges();
    const firstNew = $('#changes-list').children[firstNewIndex];
    if (firstNew) {
      firstNew.tabIndex = -1;
      firstNew.focus();
    }
  });
  document.addEventListener('click', (ev) => {
    const link = ev.target.closest('#overall a[href^="#effort-"]');
    if (!link || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || document.getElementById(link.hash.slice(1))) return;
    $('#race-search').value = state.query = '';
    $('#race-evidence').value = state.evidence = 'all';
    $('[data-filter="all"]').click();
  });
  $('#sort').addEventListener('change', (ev) => { state.sort = ev.target.value; renderRace(); });
  $('#race-list').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-toggle]');
    if (!btn) return;
    const det = btn.closest('.effort').querySelector('.e-details');
    det.hidden = !det.hidden;
    state.details.set(det.id, !det.hidden);
    btn.setAttribute('aria-expanded', String(!det.hidden));
    btn.textContent = det.hidden ? t('effort.details') : t('effort.hideDetails');
    observeBars();
  });

  // Avatar fallbacks without inline handlers.
  document.addEventListener('error', (ev) => {
    const img = ev.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.cover != null) {
      img.insertAdjacentHTML('afterend', coverHtml(img.dataset.cover));
      img.remove();
    } else if (img.dataset.fallback != null) {
      const span = document.createElement('span');
      span.className = 'mk-fallback';
      span.textContent = img.dataset.fallback;
      img.replaceWith(span);
    } else if (img.hasAttribute('data-hide-on-error')) {
      img.style.visibility = 'hidden';
    }
  }, true);

  const tip = $('#tooltip');
  document.addEventListener('pointerover', (ev) => {
    const el = ev.target.closest('[data-tip]');
    if (!el) { tip.hidden = true; return; }
    tip.innerHTML = `${el.dataset.tipTitle ? `<b>${esc(el.dataset.tipTitle)}</b>` : ''}${esc(el.dataset.tip)}`;
    tip.hidden = false;
  });
  document.addEventListener('pointermove', (ev) => {
    if (tip.hidden) return;
    const x = Math.min(ev.clientX + 14, window.innerWidth - tip.offsetWidth - 10);
    tip.style.left = `${x}px`;
    tip.style.top = `${Math.max(8, Math.min(ev.clientY + 16, window.innerHeight - tip.offsetHeight - 8))}px`;
  });
}

let io;
function observeBars() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    $$('[data-width]').forEach(reveal);
    return;
  }
  // Watch each bar's track, not the fill: a fill clipped to 0% counts as invisible.
  io ??= new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      for (const el of en.target.querySelectorAll('[data-width]')) reveal(el);
      io.unobserve(en.target);
    }
  }, { threshold: 0.2 });
  $$('[data-width]:not([data-seen])').forEach((el) => { el.dataset.seen = '1'; io.observe(el.parentElement); });
}
function reveal(el) {
  el.style.setProperty('--p', `${Math.max(0, Math.min(100, +el.dataset.width || 0))}%`);
}

const navButton = $('.nav-menu-toggle');
const navMenu = $('#site-nav');
const closeNav = () => navButton.setAttribute('aria-expanded', 'false');
navButton.addEventListener('click', () => {
  navButton.setAttribute('aria-expanded', String(navButton.getAttribute('aria-expanded') === 'false'));
});
document.addEventListener('click', (event) => {
  if (!navButton.contains(event.target) && (!navMenu.contains(event.target) || event.target.closest('a'))) closeNav();
});
$('#nav').addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navButton.getAttribute('aria-expanded') === 'true') {
    closeNav();
    navButton.focus();
  }
});

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin', `<p style="padding:12px 20px;background:#fff3f3;color:#b4262b;margin:0">${esc(t('error.load', { msg: err.message }))}</p>`);
});
