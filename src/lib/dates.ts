/** All dates are handled as local-time YYYY-MM-DD strings — logs belong to the
 *  day the user was living, not to a UTC instant. */

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = (): string => toISO(new Date());

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Monday-start weeks, so the Sunday review covers the week that just ended. */
export function weekStart(iso: string): string {
  const d = fromISO(iso);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return toISO(d);
}

export function weekDays(startISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startISO, i));
}

export function dayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  if (iso === addDays(today, 1)) return 'Tomorrow';
  return fromISO(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export const weekdayShort = (iso: string): string =>
  fromISO(iso).toLocaleDateString(undefined, { weekday: 'narrow' });

export const monthDay = (iso: string): string =>
  fromISO(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function weekLabel(startISO: string): string {
  const end = addDays(startISO, 6);
  const thisWeek = weekStart(todayISO());
  if (startISO === thisWeek) return 'This week';
  if (startISO === addDays(thisWeek, -7)) return 'Last week';
  return `${monthDay(startISO)} – ${monthDay(end)}`;
}
