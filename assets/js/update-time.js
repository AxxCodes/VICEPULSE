const MINUTE_MS = 60_000;

// A timestamp describes the data publication, while "Updated" displays elapsed time.
export function getUpdateAge(iso, now = Date.now()) {
  const publishedAt = Date.parse(iso);
  if (!Number.isFinite(publishedAt)) return null;
  const elapsed = Math.max(0, now - publishedAt);
  return {
    minutes: Math.floor(elapsed / MINUTE_MS),
    nextTick: MINUTE_MS - (elapsed % MINUTE_MS),
  };
}
