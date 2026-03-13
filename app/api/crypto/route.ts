import { NextResponse } from 'next/server';

const CACHE_TTL = 60 * 1000; // 60 sekundi
let cache: { data: unknown; ts: number } = { data: null, ts: 0 };

export async function GET() {
  // Vrati cache ako je svjež
  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ source: 'cache', data: cache.data });
  }

  const IDS = [
    'bitcoin',
    'ethereum',
    'solana',
    'binancecoin',
    'cardano',
    'avalanche-2',
  ].join(',');

  const url =
    `https://api.coingecko.com/api/v3/coins/markets` +
    `?vs_currency=usd&ids=${IDS}&order=market_cap_desc` +
    `&per_page=6&page=1&sparkline=true&price_change_percentage=24h,7d`;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-pro-api-key'] = process.env.COINGECKO_API_KEY;
  }

  try {
    const res = await fetch(url, { headers, next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    cache = { data, ts: Date.now() };
    return NextResponse.json({ source: 'live', data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
