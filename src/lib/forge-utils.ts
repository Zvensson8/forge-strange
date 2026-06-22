export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(xp / 80));
}

export function xpForLevel(level: number): number {
  return level * level * 80;
}

export function progressToNextLevel(xp: number): { level: number; pct: number; xpInLevel: number; xpForNext: number } {
  const level = levelFromXp(xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const xpInLevel = xp - cur;
  const xpForNext = next - cur;
  return { level, pct: Math.min(100, Math.round((xpInLevel / xpForNext) * 100)), xpInLevel, xpForNext };
}

export function formatPace(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDateSv(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
}

export function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function weekStartISO(d: Date = new Date()): string {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday=0
  date.setDate(date.getDate() - day);
  return isoDate(date);
}

export function sessionTypeLabel(t: string): string {
  if (t === "styrka") return "Styrka";
  if (t === "cirkel") return "Cirkel";
  if (t === "löpning") return "Löpning";
  if (t === "cykling") return "Cykling";
  if (t === "promenad") return "Promenad";
  return t;
}

export const BODYWEIGHT_CATEGORIES = new Set(["Push", "Pull", "Core", "Cirkel"]);
export function isBodyweightCategory(cat?: string | null): boolean {
  return !!cat && BODYWEIGHT_CATEGORIES.has(cat);
}

export const ALL_SESSION_TYPES = ["styrka", "cirkel", "löpning", "cykling", "promenad"] as const;
export const DISTANCE_SESSION_TYPES = ["löpning", "cykling", "promenad"] as const;
export type SessionType = (typeof ALL_SESSION_TYPES)[number];
export type DistanceType = (typeof DISTANCE_SESSION_TYPES)[number];
