import { NextResponse, NextRequest } from "next/server";
import { cgFetch } from "@/lib/cgQueue";
import { cacheGet, cacheSet } from "@/lib/fileCache";

const CACHE_TTL = 6 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id   = searchParams.get("id");
  const days = searchParams.get("days") ?? "90";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const cacheKey = `history_usd_${id}_${days}`;
  const cached = cacheGet(cacheKey, CACHE_TTL);
  if (cached) return NextResponse.json(cached);

  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;

  try {
    const res = await cgFetch(url, headers);
    if (res.status === 429) {
      const stale = cacheGet(cacheKey, Infinity);
      if (stale) return NextResponse.json(stale);
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    if (!res.ok) throw new Error(`CoinGecko history ${res.status}`);

    const json = await res.json();
    const data = {
      prices:  (json.prices as [number, number][]).map(([, p]) => p),
      volumes: (json.total_volumes as [number, number][]).map(([, v]) => v),
    };
    cacheSet(cacheKey, data);
    return NextResponse.json(data);
  } catch (err) {
    const stale = cacheGet(cacheKey, Infinity);
    if (stale) return NextResponse.json(stale);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}