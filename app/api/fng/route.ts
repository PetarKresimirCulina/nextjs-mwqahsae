import { NextResponse } from "next/server";

const CACHE_TTL = 5 * 60 * 1000;
let cache: { data: unknown; ts: number } = { data: null, ts: 0 };

export async function GET() {
  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1");
    const json = await res.json();
    const result = { value: +json.data[0].value, label: json.data[0].value_classification };
    cache = { data: result, ts: Date.now() };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ value: 50, label: "Neutral" });
  }
}