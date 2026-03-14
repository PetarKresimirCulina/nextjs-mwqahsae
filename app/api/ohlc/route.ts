import { NextResponse, NextRequest } from "next/server";
import { cacheGet, cacheSet } from "@/lib/fileCache";

const CACHE_TTL = 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id       = searchParams.get("id");
  const days     = searchParams.get("days") ?? "7";
  const currency = "usd"; // hardkodirano
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const cacheKey = `ohlc_${currency}_${id}_${days}`;
  const cached = cacheGet(cacheKey, CACHE_TTL);
  if (cached) return NextResponse.json(cached);

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=${currency}&days=${days}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.COINGECKO_API_KEY) headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`CoinGecko OHLC ${res.status}`);

    const data = await res.json();
    cacheSet(cacheKey, data);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}