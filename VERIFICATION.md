# VICEPULSE verification

The original redesign used the supplied source snapshot dated 24 November 2026. Browser tests used a private, loopback preview.

| Area | Result |
| --- | --- |
| Automated checks | `npm test`: 12 passed. Covers shared scoring, partial milestones, archived efforts, dated evidence, static news, image URLs, translation keys, Scout classification and daily history, and the cached live endpoint with a mocked Supabase response. Also checks that the update clock follows complete elapsed minutes. |
| Static build | `npm run build`: 21 generated files, including 17 articles, the news archive, RSS, sitemap and IndexNow verification. Static references and XML checked after building. |
| Snapshot in browser | The homepage rendered 72% for CGBJ, a 67.2% top-three average, 14 race entries including two archived ones, 16 watchlist entries, 20 tools, 12 candidate previews and 6 safety entries. |
| Browser interactions | Tested milestone selection, four history rows, evidence and project search, empty results, archived projects, sorting, comparison, project details, journal expansion, article dialog and Escape, archive and individual article routes. |
| Layout | Checked Chromium at 320, 390, 768, 1024 and 1280 CSS pixels. Fixed the horizontal overflow found at the narrower widths. Captured desktop and mobile previews. |
| Accessibility and language | Tested the mobile menu with Enter and Escape, the EN, ES and PT-BR language switches and the light and dark theme choices. Reduced-motion behavior is implemented in CSS and the counter code. |
| Live refresh | With an isolated browser fixture, the reference time stayed at 18:30 AST as the label advanced from 30 to 31 to 32 minutes. The green button loaded a newer tracker snapshot, the progress bar changed to match the new score, and a later pinned message appeared through automatic polling without a page reload. The fixture is excluded from the ZIP. |
| Administration | Verified the unauthenticated dashboard displays its sign-in form and keeps admin data hidden. Typed into the pinned-message editor and observed the local preview. No pin was published. |

## Deployment checks still pending

- The GitHub connection had read access. The branch, pull request, and live deployment were therefore left to the repository owner.
- Authenticated Supabase actions, magic-link delivery, moderation, GitHub writeback, production Cloudflare Functions and scheduled network-backed Scout runs were not executed. The existing workflow files and database schema are included.
- The production count for the viewer badge depends on the Cloudflare route and Supabase. In a plain static preview, the badge may be absent.
- Browser checks covered Chromium. Keyboard controls were exercised, but this was not a full assistive-technology, cross-browser or Lighthouse audit.

## AxxCodes revision

All 12 tests and both the local and configured-origin builds passed. The generated files were checked for the AxxCodes headline, account link, pinned copy and avatar, GitHub status and removal of the prior owner’s service configuration. Chromium could not launch in the current execution environment, so the revised appearance was checked through the generated markup.
