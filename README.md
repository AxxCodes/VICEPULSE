# VICEPULSE — GTA VI PC Progress

VICEPULSE follows independent community efforts to run GTA VI on PC and shows Rockstar announcements separately with a dated source.

- The overview shows the best community score, the furthest milestone, an interactive route and a history table. The leaderboard supports search, scope and evidence filters, sorting by progress, stars, or activity and a side-by-side comparison.
- The green Live updates button checks the published tracker and pinned message. Open, visible tabs also revalidate both files every minute. The relative timestamp follows the most recent publication time and shows the exact time on hover.
- The journal separates score changes, Scout finds, unverified claims, and safety events. News, the Watchlist, Toolkit, new candidates, scam alerts and the maintainer's pinned message all use the project's original data.
- The new identity uses a custom symbol and wordmark, midnight violet, vivid pink, soft peach and a new Miami waterfront illustration. Inter, Inter Tight and Instrument Serif are bundled with their SIL Open Font Licenses. The share image and square social artwork are in `assets/img/social.jpg` and `assets/img/social-square.jpg`.

## Preview and verify locally

Use Node.js 20 or newer. The public site builds without installing npm dependencies.

```sh
npm test
npm run build
python3 -m http.server 8080 --bind 127.0.0.1 --directory _site
```

Open `http://127.0.0.1:8080/`. On Windows use `py -m http.server 8080 --bind 127.0.0.1 --directory _site` if Python is installed. The build includes the homepage, articles, news archive, RSS, sitemap and search verification files. For the private dashboard, run `tools/serve.ps1` from the source checkout or point a loopback-only HTTP server at that checkout and open `/dashboard/`. The normal public build excludes the dashboard.

## Integrate into the existing GitHub repository

1. Extract the source ZIP. Create a branch from the latest `main`, for example `refactor/vicepulse`.
2. Copy the files from the ZIP into the checkout, including `.github/workflows/`. If the Scout or maintainer has updated the live data since this snapshot, keep the latest `data/tracker.json` and `data/pinned.json`. Reapply the three `site` branding fields, the two revised safety descriptions, and CGBJ's dated `observation` only when the current assessment still matches the report. These are the only changes to tracker data in this ZIP.
3. Run the preview and tests above, then commit to the branch and open a pull request. Merge only when ready to publish. A push to `main` triggers the configured production workflow.

GitHub Pages builds the news archive, RSS feed, and sitemap using the Pages URL. Set the repository variable `SITE_URL` if you use a custom domain. Optional Cloudflare mirroring uses `CLOUDFLARE_PAGES_PROJECT` and your own Cloudflare credentials. Set `INDEXNOW_KEY` to enable IndexNow.

To deploy on GitHub Pages, configure **Settings → Pages → Source → GitHub Actions** and enable Actions. The Scout runs every three hours at minute 17 UTC. Set `GITHUB_REPOSITORY` in `assets/js/config.js` to enable publishing pins through the private dashboard. The same file accepts your Supabase configuration for optional analytics.

## Private dashboard and Supabase

Keep the existing Supabase project and its access policies. The two existing values in `assets/js/config.js` are the project URL and **public publishable key**. Service credentials belong in the provider's secret store. This upgrade requires no database migration.

The local dashboard includes Supabase sign-in, analytics and moderation controls. The independent pin editor previews locally and uses a fine-grained GitHub token supplied by the maintainer to publish. Keep the dashboard on a trusted loopback origin. For a new Supabase project, configure the authorized callback URL and establish the owner account before allowing additional sign-ins. Publishing through the dashboard writes to the configured production branch and invokes the deploy workflow.

## What the scout does (`scripts/scout.mjs`)

1. **Refreshes** every tracked repo: stars, forks, issues, last push, commits in the last 7 days, and whether it's gone (404, or 451 for a DMCA block). It also hashes each README to notice changes.
2. **Spots claims.** If a README newly says GTA VI boots, reaches the menu or runs at some FPS, the card shows an "unverified claim" banner and the change feed records it.
3. **Discovers** new repos from GitHub and GitLab searches (`scout.queries` in `data/tracker.json`), Hacker News, Bluesky, Mastodon, Lemmy and 4chan, plus Reddit and X when keys are set, by pulling GitHub links out of posts. It also gathers **headlines** from the Google News and Bing News feeds, keeping only stories about the leak, ports, takedowns, scams or official news. And it **watches GitHub's public DMCA log** for new Take-Two or Rockstar notices, flagging any tracked project they name. On 4chan it uses the free read-only API, at one request per second. It opens only /v/ threads that mention GTA VI together with port terms (recomp, emulator, leak, executable, GitHub…), plus /vg/'s /gtag/ and /emugen/ generals. Change the boards with `scout.chan.boards`. Nothing from 4chan is shown on the site except, indirectly, repo names that pass every filter.
4. **Filters out spam** such as clone networks, download lures and "PC installer" repos. Their names are counted under *There is no download*, never linked.
5. **Filters out copies.** Re-uploads of tracked projects are flagged when they reuse a tracked project's name or have a README that is 60% or more identical, renamed copies included. Original fan games and repos without a real README are skipped too. Candidates already waiting are re-checked every run.
6. **Scores substance** from code language, size, technical depth, status tables, tests and commit activity. Repos with real code go to **New candidates**, shown as plain text and not linked until reviewed. Thin or off-topic ones are remembered and skipped.
7. **Writes news** (needs `ANTHROPIC_API_KEY`). Claude searches the web for takedowns, bans, confirmed leaks, legal news, scams and official announcements, then writes up to two short original articles. It runs at most every 11 hours, not on every 3-hourly scout run, to keep costs down. A source is kept only if it came up in Claude's own search. Each article's image is the source's preview image, credited and linked back; it falls back to a generated cover.
8. **Records** a change feed, the day's leader score for the sparkline, and a run summary.

### Optional secrets (Settings → Secrets and variables → Actions)

| Secret | What it enables |
|---|---|
| `ANTHROPIC_API_KEY` | **Claude review.** When a tracked README changes, or a new candidate shows up, Claude (`claude-opus-5-5`) reads the README and recent commits and re-scores the effort. It also promotes or rejects candidates automatically. Guardrails clamp the output: a GTA VI milestone only counts if Claude quotes text that really appears in the repo, and groundwork can rise at most 0.3 per run. Reviews are capped at 12 per run. Each costs very roughly $0.05–0.20, depending on README size. |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Reddit search. Reddit blocks anonymous API and RSS access, so Reddit is skipped without these. The API is free for small non-commercial use, but since late 2025 every new app needs Reddit's manual approval. Create a "script" app at reddit.com/prefs/apps, request access, and paste the client ID and secret here once approved. |
| `X_BEARER_TOKEN` | X recent search. This needs a paid X API tier. |

Without any secrets the scout still runs on every keyless source, and new finds wait in *New candidates* for review.

### Daily Claude editor (alternative to an API key)

Instead of `ANTHROPIC_API_KEY`, a scheduled Claude session on the maintainer's PC can run once a day, following [EDITOR.md](EDITOR.md). It re-scores changed projects, reviews candidates, verifies leads, keeps the countdown accurate and writes news, then commits `data/tracker.json`. It also reads 4chan's /v/, /vg/ and /g/ in full through `tools/chan-scan.ps1`, which gathers GTA VI port discussion from live threads and the public archives into a local digest (`.chan/`, never committed). The scout only picks GitHub links out of those threads. It uses the maintainer's Claude plan and needs no separate billing. It runs while the Claude desktop app is open; a missed run happens on the next launch.

## Editing the data by hand

Everything lives in `data/tracker.json`:

- `efforts[]`: each effort has a `tier` (`tracked` puts it in the race, `watchlist` lists it below). Each also carries `groundwork` (four 0–1 values), `gta` (`loads`/`boots`/`menu`/`ingame` are 0, 0.5 or 1, plus `fps` and `stability`), and short `highlights` and `blockers`.
- `exe`: drives the countdown. If the release time is announced, set `expectedAt` (ISO time) and `timeAnnounced: true`. When it drops, set `status: "released"` and `releasedAt`, and the countdown turns into a "time since release" clock.
- `candidates[]`: move one into `efforts` to promote it, or into `ignored` to dismiss it.
- `site.heroImage` / `site.heroCredit`: hero artwork (see below).

Scoring is in `assets/js/scoring.js`, shared by the site and the scout. Groundwork fills 0–25%. After that, milestones sit at Exe runs 25, First frame 40, Main menu 55, In-game 70, 30 FPS 85 and Stable 100.

## Editorial evidence and artwork

An **observed** label points to a dated editorial report. It applies when the observation date matches the current project assessment. **Reproduced** retains the tracker’s existing verification field. Remaining project results are **self-reported**. Automated README claims and external headlines require editorial assessment. The site preserves archived project records and excludes taken-down efforts from the headline ranking.

The default hero uses the original VICEPULSE artwork in two WebP sizes. To use a different image, set `site.heroImage` to a new file under `assets/img/` and provide `site.heroCredit`. The sourced Rockstar platform note is a dated editorial item in the homepage and its locale files. Update both the text and the date when Rockstar changes the published platforms.

See [VERIFICATION.md](VERIFICATION.md) for the test results and deployment checks still pending.

## Disclaimer

Fan-made and unofficial. Not affiliated with Rockstar Games, Take-Two or Microsoft. Scores are editorial estimates from public READMEs, commits and issues, and self-reported claims are labelled. Maintainers who think their project is mis-scored can open an issue with evidence.
