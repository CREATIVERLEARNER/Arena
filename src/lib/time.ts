/**
 * Time & duration helpers shared by the stores, timer UI and analytics.
 */

/** Format seconds as `mm:ss`, or `h:mm:ss` once an hour is involved. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const two = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

/** Human duration, e.g. `25m` or `1h 05m` — used by stats and labels. */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${two(minutes)}m`;
}

/** Local-time day key, e.g. "2026-09-24". */
export function todayKey(date: Date = new Date()): string {
  const two = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

/** The last `n` day keys (including today), oldest → newest. Feeds the 7-day chart. */
export function lastNDayKeys(n: number, from: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(from);
    day.setDate(from.getDate() - i);
    keys.push(todayKey(day));
  }
  return keys;
}

export const minutesToSeconds = (minutes: number): number => Math.round(minutes * 60);

function two(n: number): string {
  return n.toString().padStart(2, "0");
}
