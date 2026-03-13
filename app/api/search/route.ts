import { NextResponse, NextRequest } from "next/server";

const CACHE_TTL = 60 * 60 * 1000; // 1 sat
let listCache = { data: null, ts: 0 };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  if (q.length < 2) return NextResponse.json([]);

  if (!listCache.data || Date.now() - listCache.ts > CACHE_TTL) {
    try {
      const r = await fetch(
        "https://api.coingecko.com/api/v3/coins/list?include_platform=false",
        { headers: { Accept: "application/json" } }
      );
      if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
      listCache.data = await r.json();
      listCache.ts = Date.now();
    // Novo
} catch (err) {
  const msg = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: msg }, { status: 500 });
}
  }

  const q2 = q.toLowerCase();
  // Novo
const results = (listCache.data ?? [])
.filter(c =>
      c.symbol.toLowerCase().includes(q2) ||
      c.name.toLowerCase().includes(q2)
    )
    .slice(0, 10)
    .map(c => ({ id: c.id, symbol: c.symbol.toUpperCase(), name: c.name }));

  return NextResponse.json(results);
}