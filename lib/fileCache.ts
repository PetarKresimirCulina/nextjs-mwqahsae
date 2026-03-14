import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".cache");

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

interface CacheEntry<T> {
  data: T;
  ts: number;
}

export function cacheGet<T>(key: string, ttlMs: number): T | null {
  try {
    const file = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(file)) return null;
    const entry: CacheEntry<T> = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (Date.now() - entry.ts > ttlMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T): void {
  try {
    const file = path.join(CACHE_DIR, `${key}.json`);
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    fs.writeFileSync(file, JSON.stringify(entry), "utf-8");
  } catch {}
}