import { groupKey, type Entry } from "../../shared/domain/fpy.ts";

export type FpyPeriod = "today" | "week" | "month" | "custom" | `year:${string}`;
type DateRange = { from: string; to: string };

export function localDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function periodRange(period: FpyPeriod, custom: DateRange, today: string): DateRange {
  if (period === "custom") return { ...custom };
  if (period.startsWith("year:")) {
    const year = period.slice(5);
    return /^\d{4}$/.test(year) && year !== "0000"
      ? { from: `${year}-01-01`, to: `${year}-12-31` }
      : { from: "", to: "" };
  }
  const date = parseDate(today);
  if (!date) return { from: "", to: "" };
  if (period === "today") return { from: today, to: today };
  if (period === "week") {
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const from = utcDate(date);
    date.setUTCDate(date.getUTCDate() + 6);
    return { from, to: utcDate(date) };
  }
  date.setUTCDate(1);
  const from = utcDate(date);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return { from, to: utcDate(date) };
}

export function periodYears(range: DateRange): string[] {
  if (!parseDate(range.from) || !parseDate(range.to) || range.from > range.to) return [];
  const first = Number(range.from.slice(0, 4));
  const count = Number(range.to.slice(0, 4)) - first + 1;
  if (count > 12) return [];
  return Array.from({ length: count }, (_, index) => String(first + index).padStart(4, "0"));
}

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function filterFpyEntries(
  entries: Entry[],
  options: DateRange & { shift: string; line: string; search: string },
  includeDefectFields: boolean,
): Entry[] {
  if (!periodYears(options).length) return [];
  const search = normalized(options.search);
  const line = normalized(options.line);
  const eligible = entries.filter((entry) => {
    if (entry.date < options.from || entry.date > options.to) return false;
    if (options.shift !== "all" && entry.shift !== options.shift) return false;
    if (line !== "all" && normalized(entry.line) !== line) return false;
    return true;
  });
  if (!search) return eligible;
  const matching = eligible.filter((entry) => {
    const fields = [entry.pn, entry.model];
    if (includeDefectFields) fields.push(entry.code, entry.description, entry.position);
    return normalized(fields.join(" ")).includes(search);
  });
  if (includeDefectFields) return matching;
  // A model name may change between launches in the same production context.
  // Retain all its records so a text search cannot discard production or defects.
  const matchedContexts = new Set(matching.map(groupKey));
  return eligible.filter((entry) => matchedContexts.has(groupKey(entry)));
}
