import { NextResponse } from "next/server";

const CACHE_TTL = 60 * 1000;
const cache = {};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids") ||
    "bitcoin,ethereum,solana,binancecoin,cardano,avalanche-2";

  if (cache[ids] && Date.now() - cache[ids].ts < CACHE_TTL) {
    return NextResponse.json({ source: "cache", data: cache[ids].data });
  }

  const url = [
    "https://api.coingecko.com/api/v3/coins/markets",
    `?vs_currency=usd&ids=${ids}`,
    `&order=market_cap_desc&per_page=50&page=1`,
    `&sparkline=true&price_change_percentage=24h,7d`,
  ].join("");

  const headers = { Accept: "application/json" };
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-pro-api-key"] = process.env.COINGECKO_API_KEY;
  }

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    cache[ids] = { data, ts: Date.now() };
    return NextResponse.json({ source: "live", data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}