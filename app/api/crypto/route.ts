import { NextResponse } from "next/server";
import { cgFetch } from "@/lib/cgQueue";
import { cacheGet, cacheSet } from "@/lib/fileCache";

const CACHE_TTL = 15 * 60 * 1000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids") ||
    "bitcoin,ethereum,solana,binancecoin,cardano,avalanche-2";

  const cacheKey = `crypto_usd_${ids.replace(/,/g, "_")}`;
  const cached = cacheGet(cacheKey, CACHE_TTL);
  if (cached) {
    return NextResponse.json({ source: "cache", data: cached });
  }

  const url = [
    "https://api.coingecko.com/api/v3/coins/markets",
    `?vs_currency=usd&ids=${ids}`,
    `&order=market_cap_desc&per_page=50&page=1`,
    `&sparkline=true&price_change_percentage=24h,7d`,
  ].join("");

  const headers = { Accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }

  try {
    const res = await cgFetch(url, headers);
    if (res.status === 429) {
      const stale = cacheGet(cacheKey, Infinity); // vrati stale bez TTL provjere
      if (stale) return NextResponse.json({ source: "stale", data: stale });
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    cacheSet(cacheKey, data);
    return NextResponse.json({ source: "live", data });
  } catch (err) {
    const stale = cacheGet(cacheKey, Infinity);
    if (stale) return NextResponse.json({ source: "stale", data: stale });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}