
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Tipovi ────────────────────────────────────────────────────────────────────
interface Token {
  symbol: string;
  name: string;
  color: string;
  cg: string;
  custom?: boolean;
}

// ── Konstante ─────────────────────────────────────────────────────────────────
const DEFAULT_TOKENS: Token[] = [
  { symbol: "BTC",  name: "Bitcoin",   color: "#F7931A", cg: "bitcoin" },
  { symbol: "ETH",  name: "Ethereum",  color: "#627EEA", cg: "ethereum" },
  { symbol: "SOL",  name: "Solana",    color: "#9945FF", cg: "solana" },
  { symbol: "BNB",  name: "BNB",       color: "#F3BA2F", cg: "binancecoin" },
  { symbol: "ADA",  name: "Cardano",   color: "#0033AD", cg: "cardano" },
  { symbol: "AVAX", name: "Avalanche", color: "#E84142", cg: "avalanche-2" },
];

const EXTRA_COLORS = [
  "#06b6d4","#8b5cf6","#ec4899","#f97316","#14b8a6",
  "#a3e635","#fb7185","#818cf8","#34d399","#fbbf24",
];
let colorIdx = 0;
const nextColor = () => EXTRA_COLORS[colorIdx++ % EXTRA_COLORS.length];

const COOLDOWN_MS = 65000;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtPrice = (p: number) => {
  if (!p && p !== 0) return "—";
  if (p >= 1000) return "$" + Number(p).toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1)    return "$" + Number(p).toFixed(2);
  return "$"     + Number(p).toFixed(4);
};

const fmtBig = (n: number) => {
  if (!n) return "—";
  if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9)  return "$" + (n / 1e9).toFixed(2) + "B";
  return "$"     + (n / 1e6).toFixed(2) + "M";
};

const FNG_LABEL = (v: number) =>
  v >= 75 ? "Extreme Greed" : v >= 55 ? "Greed" :
  v >= 45 ? "Neutral" : v >= 25 ? "Fear" : "Extreme Fear";

const sigColor = (s: string): string => ({
  "STRONG BUY": "#4ade80", "BUY": "#86efac", "NEUTRAL": "#facc15",
  "SELL": "#fca5a5", "STRONG SELL": "#f87171",
}[s] || "#fff");

// ── Prediction engine ─────────────────────────────────────────────────────────
function computePrediction(coin, fngValue) {
  const fng   = fngValue ?? 50;
  const price = coin.current_price ?? 0;
  const chg24 = coin.price_change_percentage_24h ?? 0;
  const chg7  = coin.price_change_percentage_7d_in_currency ?? 0;
  const vol   = coin.total_volume ?? 0;
  const mcap  = coin.market_cap ?? 1;
  const prices = coin.sparkline_in_7d?.price ?? [];

  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : price;

  let rsi = 50;
  if (prices.length > 14) {
    let g = 0, l = 0;
    for (let i = prices.length - 14; i < prices.length; i++) {
      const d = prices[i] - prices[i - 1];
      d > 0 ? (g += d) : (l -= d);
    }
    rsi = 100 - 100 / (1 + g / (l || 0.0001));
  }

  const ema = (arr, n) => {
    const k = 2 / (n + 1); let e = arr[0] || price;
    arr.forEach((v, i) => { if (i) e = v * k + e * (1 - k); });
    return e;
  };
  const macdBull = prices.length >= 26 ? ema(prices, 12) > ema(prices, 26) : chg24 > 0;
  const ma7  = prices.length >= 7  ? avg(prices.slice(-7))  : price;
  const ma30 = prices.length >= 30 ? avg(prices.slice(-30)) : price;

  let bollPct = 50;
  if (prices.length >= 20) {
    const sl = prices.slice(-20), m = avg(sl);
    const std = Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / 20);
    const upper = m + 2 * std, lower = m - 2 * std;
    bollPct = upper !== lower ? ((price - lower) / (upper - lower)) * 100 : 50;
  }

  const rsiScore  = rsi < 30 ? 80 : rsi > 70 ? 22 : 50 + (50 - rsi) * 0.6;
  const macdScore = macdBull ? 68 : 32;
  const maScore   = ma7 > ma30 ? 68 : 32;
  const bollScore = bollPct < 20 ? 78 : bollPct > 80 ? 22 : 50;
  const techScore = rsiScore * 0.35 + macdScore * 0.25 + maScore * 0.2 + bollScore * 0.2;
  const volScore  = Math.min(100, Math.max(0, (vol / mcap) * 1000 + 50 + chg24 * 0.5));
  const momScore  = Math.min(100, Math.max(0, 50 + chg24 * 1.5 + chg7 * 0.8));
  const finalScore = fng * 0.20 + volScore * 0.22 + techScore * 0.35 + momScore * 0.23;
  const pct        = ((finalScore - 50) / 50) * 30;
  const predicted7d = price * (1 + pct / 100);
  const scores   = [fng, volScore, techScore, momScore];
  const mean     = scores.reduce((a, b) => a + b, 0) / 4;
  const variance = scores.reduce((a, b) => a + Math.abs(b - mean), 0) / 4;
  const confidence = Math.max(38, Math.min(94, 88 - variance * 0.9));
  const signal =
    finalScore > 64 ? "STRONG BUY" : finalScore > 55 ? "BUY" :
    finalScore > 45 ? "NEUTRAL"    : finalScore > 36 ? "SELL" : "STRONG SELL";

  return {
    rsi: +rsi.toFixed(1), macdBull, ma7: +ma7.toFixed(2), ma30: +ma30.toFixed(2),
    bollPct: +bollPct.toFixed(0), techScore: +techScore.toFixed(1),
    volScore: +volScore.toFixed(1), momScore: +momScore.toFixed(1),
    finalScore: +finalScore.toFixed(1), pct: +pct.toFixed(2),
    predicted7d: +predicted7d.toFixed(price < 1 ? 4 : price < 100 ? 2 : 0),
    confidence: +confidence.toFixed(0), signal,
  };
}

// ── Mini sparkline ────────────────────────────────────────────────────────────
function MiniChart({ prices, color }) {
  if (!prices || prices.length < 2) return <div style={{ height: 48 }} />;
  const w = 120, h = 48;
  const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
  const pts = prices
    .map((p, i) => `${(i / (prices.length - 1)) * w},${h - ((p - min) / range) * (h - 6) - 3}`)
    .join(" ");
  const id = color.replace("#", "");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#g${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function ScoreBar({ label, value, color }) {
  const v = Math.min(100, Math.max(0, value || 0));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#aaa", marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ color: v > 60 ? "#4ade80" : v < 40 ? "#f87171" : "#facc15", fontWeight: 600 }}>
          {v.toFixed(0)}
        </span>
      </div>
      <div style={{ background: "#1e2a3a", borderRadius: 4, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${v}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.8s ease" }} />
      </div>
    </div>
  );
}

// ── Search komponenta ─────────────────────────────────────────────────────────
function TokenSearch({ onAdd, existingIds }) {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const debounceRef           = useRef(null);
  const wrapRef               = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (val.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
  };

  const handleAdd = (token) => {
    onAdd(token);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", maxWidth: 400 }}>
      <div style={{ display: "flex", alignItems: "center", background: "#0a1422", border: "1px solid #1e3a5f", borderRadius: 10, padding: "9px 14px", gap: 8 }}>
        <span style={{ color: "#475569", fontSize: 16 }}>🔍</span>
        <input
          value={query}
          onChange={handleInput}
          placeholder="Dodaj token... (npr. DOGE, Chainlink)"
          style={{ background: "none", border: "none", outline: "none", color: "#e2e8f0", fontSize: 13, flex: 1 }}
        />
        {loading && <span style={{ color: "#475569", fontSize: 13 }}>⟳</span>}
      </div>

      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#0d1a2d", border: "1px solid #1e3a5f", borderRadius: 10, overflow: "hidden", zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          {results.map((r) => {
            const already = existingIds.includes(r.id);
            return (
              <div key={r.id}
                onClick={() => !already && handleAdd(r)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: already ? "default" : "pointer", borderBottom: "1px solid #1e2d3d", opacity: already ? 0.4 : 1 }}
                onMouseEnter={e => { if (!already) e.currentTarget.style.background = "#0a1e35"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>{r.symbol}</span>
                  <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>{r.name}</span>
                </div>
                {already
                  ? <span style={{ fontSize: 11, color: "#475569" }}>Već dodano</span>
                  : <span style={{ fontSize: 11, color: "#4ade80", background: "#0f2a1a", borderRadius: 6, padding: "2px 8px", border: "1px solid #4ade8040" }}>+ Dodaj</span>
                }
              </div>
            );
          })}
        </div>
      )}

      {open && results.length === 0 && !loading && query.length >= 2 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#0d1a2d", border: "1px solid #1e3a5f", borderRadius: 10, padding: "12px 14px", zIndex: 100, fontSize: 12, color: "#475569" }}>
          Nema rezultata za &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}

// ── Glavna komponenta ─────────────────────────────────────────────────────────
export default function Home() {
  const [tokens, setTokens]       = useState(DEFAULT_TOKENS);
  const [coins, setCoins]         = useState({});
  const [fng, setFng]             = useState(null);
  const [selected, setSelected]   = useState(null);
  const [status, setStatus]       = useState("idle");
  const [errMsg, setErrMsg]       = useState("");
  const [lastFetch, setLastFetch] = useState(null);
  const [cooldown, setCooldown]   = useState(0);
  const cdRef                     = useRef(null);

  const startCooldown = () => {
    setCooldown(Math.ceil(COOLDOWN_MS / 1000));
    cdRef.current = setInterval(() => {
      setCooldown((c) => { if (c <= 1) { clearInterval(cdRef.current); return 0; } return c - 1; });
    }, 1000);
  };

  const doFetch = useCallback(async (tokenList) => {
    setStatus("loading");
    setErrMsg("");
    try {
      const ids = tokenList.map(t => t.cg).join(",");
      const [priceRes, fngRes] = await Promise.all([
        fetch(`/api/crypto?ids=${ids}`),
        fetch("/api/fng"),
      ]);
      if (!priceRes.ok) throw new Error(`API error ${priceRes.status}`);
      const priceJson = await priceRes.json();
      const fngJson   = await fngRes.json();

      const map = {};
      (priceJson.data || []).forEach((c) => {
        const tok = tokenList.find(t => t.cg === c.id);
        if (tok) map[tok.symbol] = c;
      });
      setCoins(map);
      setFng(fngJson);
      setLastFetch(new Date());
      setStatus("ok");
      startCooldown();
    } catch (e) {
      setErrMsg(e.message || "Nepoznata greška");
      setStatus(prev => prev === "ok" ? "ok" : "error");
    }
  }, []);

  useEffect(() => {
    doFetch(DEFAULT_TOKENS);
    return () => { if (cdRef.current) clearInterval(cdRef.current); };
  }, [doFetch]);

  const handleAddToken = async (searchResult) => {
    const exists = tokens.find(t => t.cg === searchResult.id);
    if (exists) return;
    const newToken = {
      symbol: searchResult.symbol,
      name:   searchResult.name,
      color:  nextColor(),
      cg:     searchResult.id,
      custom: true,
    };
    setTokens(prev => [...prev, newToken]);
    try {
      const res = await fetch(`/api/crypto?ids=${searchResult.id}`);
      const json = await res.json();
      if (json.data?.[0]) {
        setCoins(prev => ({ ...prev, [newToken.symbol]: json.data[0] }));
      }
    } catch (e) { console.error(e); }
  };

  const handleRemoveToken = (symbol) => {
    if (selected === symbol) setSelected(null);
    setTokens(prev => prev.filter(t => t.symbol !== symbol));
    setCoins(prev => { const n = { ...prev }; delete n[symbol]; return n; });
  };

  const canRefresh = cooldown === 0 && status !== "loading";
  const fngVal  = fng?.value ?? 50;
  const sel     = selected ? coins[selected] : null;
  const pred    = sel ? computePrediction(sel, fngVal) : null;
  const selMeta = tokens.find(t => t.symbol === selected);

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (status === "loading" && Object.keys(coins).length === 0) return (
    <div style={{ background: "#060d18", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "#e2e8f0", textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 38 }}>⚡</div>
      <div style={{ fontSize: 18, fontWeight: 800, background: "linear-gradient(135deg,#4ade80,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CryptoPulse AI</div>
      <div style={{ fontSize: 13, color: "#4ade80" }}>Dohvaćam live podatke…</div>
    </div>
  );

  if (status === "error" && Object.keys(coins).length === 0) return (
    <div style={{ background: "#060d18", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#f87171", textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Greška pri dohvaćanju</div>
      <div style={{ fontSize: 12, color: "#64748b", maxWidth: 320 }}>{errMsg}</div>
      <button onClick={() => doFetch(tokens)} style={{ marginTop: 12, background: "#0d1f2d", border: "1px solid #1e3a5f", color: "#4ade80", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13 }}>↻ Pokušaj ponovo</button>
    </div>
  );

  // ── Glavni UI ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#060d18", minHeight: "100vh", padding: "20px 16px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, background: "linear-gradient(135deg,#4ade80,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              ⚡ CryptoPulse AI
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
              Live podaci · CoinGecko + Alternative.me · {tokens.length} tokena
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {fng && (
              <div style={{ fontSize: 12, background: "#0a1a2a", border: "1px solid #1e3a5f", borderRadius: 8, padding: "5px 10px", color: fng.value > 60 ? "#4ade80" : fng.value < 40 ? "#f87171" : "#facc15" }}>
                Fear & Greed: <b>{fng.value}</b> <span style={{ color: "#475569" }}>({fng.label})</span>
              </div>
            )}
            <button
              onClick={canRefresh ? () => doFetch(tokens) : undefined}
              style={{ background: "#0d1f2d", border: "1px solid #1e3a5f", color: canRefresh ? "#94a3b8" : "#334155", borderRadius: 8, padding: "6px 14px", cursor: canRefresh ? "pointer" : "not-allowed", fontSize: 11, minWidth: 120, opacity: canRefresh ? 1 : 0.5 }}
            >
              {status === "loading" ? "↻ Učitavam…" : cooldown > 0 ? `⏳ ${cooldown}s` : "↻ Osvježi"}
            </button>
            {lastFetch && <div style={{ fontSize: 10, color: "#334155" }}>Zadnje: {lastFetch.toLocaleTimeString("hr")}</div>}
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <TokenSearch onAdd={handleAddToken} existingIds={tokens.map(t => t.cg)} />
        </div>

        {/* Token Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, marginBottom: 22 }}>
          {tokens.map((t) => {
            const c = coins[t.cg];
            if (!c) return (
              <div key={t.cg} style={{ background: "#0a1422", border: "1px solid #1e2d3d", borderRadius: 14, padding: 16, height: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#334155", fontSize: 12 }}>{t.symbol} — učitavam…</span>
              </div>
            );
            const p = computePrediction(c, fngVal);
            const isSel = selected === t.cg;
            const spark = c.sparkline_in_7d?.price ?? [];
            return (
              <div key={t.cg}
                onClick={() => setSelected(isSel ? null : t.cg)}
                style={{ background: isSel ? "#0a1e35" : "#0a1422", border: `1px solid ${isSel ? t.color : "#1e2d3d"}`, borderRadius: 14, padding: 16, cursor: "pointer", transition: "all 0.2s", boxShadow: isSel ? `0 0 20px ${t.color}30` : "none", position: "relative" }}
              >
                {t.custom && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveToken(t.cg); }}
                    style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}
                    title="Ukloni token"
                  >×</button>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, boxShadow: `0 0 6px ${t.color}` }} />
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{t.symbol}</span>
                      <span style={{ fontSize: 11, color: "#475569" }}>{t.name}</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{fmtPrice(c.current_price)}</div>
                    <div style={{ fontSize: 11, color: (c.price_change_percentage_24h || 0) >= 0 ? "#4ade80" : "#f87171", marginTop: 1 }}>
                      {(c.price_change_percentage_24h || 0) >= 0 ? "▲" : "▼"} {Math.abs(c.price_change_percentage_24h || 0).toFixed(2)}% 24h
                    </div>
                  </div>
                  <div style={{ textAlign: "right", paddingRight: t.custom ? 22 : 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: sigColor(p.signal), background: `${sigColor(p.signal)}15`, borderRadius: 6, padding: "3px 8px", border: `1px solid ${sigColor(p.signal)}40` }}>
                      {p.signal}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: p.pct >= 0 ? "#4ade80" : "#f87171", marginTop: 4 }}>
                      {p.pct >= 0 ? "+" : ""}{p.pct.toFixed(2)}% <span style={{ fontSize: 10, color: "#64748b" }}>7d pred.</span>
                    </div>
                  </div>
                </div>
                <MiniChart prices={spark} color={t.color} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "#64748b" }}>
                  <span>AI Score: <b style={{ color: p.finalScore > 60 ? "#4ade80" : p.finalScore < 40 ? "#f87171" : "#facc15" }}>{p.finalScore.toFixed(0)}/100</b></span>
                  <span>Pouzdanost: <b style={{ color: "#94a3b8" }}>{p.confidence}%</b></span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail Panel */}
        {sel && pred && selMeta && (() => {
          const c = sel, p = pred;
          const chg24 = c.price_change_percentage_24h || 0;
          const chg7  = c.price_change_percentage_7d_in_currency || 0;
          return (
            <div style={{ background: "#0a1422", border: `1px solid ${selMeta.color}50`, borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <h2 style={{ margin: 0, fontSize: 18, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: selMeta.color, boxShadow: `0 0 8px ${selMeta.color}`, display: "inline-block" }} />
                  {selMeta.name} — Live Analiza
                </h2>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Predviđena cijena (7d)</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: p.pct >= 0 ? "#4ade80" : "#f87171" }}>{fmtPrice(p.predicted7d)}</div>
                  <div style={{ fontSize: 12, color: p.pct >= 0 ? "#4ade80" : "#f87171" }}>{p.pct >= 0 ? "+" : ""}{p.pct.toFixed(2)}%</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#22d3ee", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>💬 Sentiment</div>
                  <ScoreBar label={`Fear & Greed (${FNG_LABEL(fngVal)})`} value={fngVal} color="#22d3ee" />
                  <ScoreBar label="Momentum 24h" value={Math.min(100, Math.max(0, 50 + chg24 * 2))} color="#a78bfa" />
                  <ScoreBar label="Momentum 7d"  value={Math.min(100, Math.max(0, 50 + chg7 * 1.2))} color="#60a5fa" />
                  <div style={{ marginTop: 10, fontSize: 11, color: "#64748b" }}>
                    24h: <span style={{ color: chg24 >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>{chg24 >= 0 ? "+" : ""}{chg24.toFixed(2)}%</span>
                    {" · "}
                    7d: <span style={{ color: chg7 >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>{chg7 >= 0 ? "+" : ""}{chg7.toFixed(2)}%</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>📊 Volumen</div>
                  <ScoreBar label="Volumen skor" value={p.volScore} color="#f59e0b" />
                  {[
                    ["24h volumen", fmtBig(c.total_volume)],
                    ["Market cap",  fmtBig(c.market_cap)],
                    ["Vol/MCap",    c.market_cap ? ((c.total_volume / c.market_cap) * 100).toFixed(2) + "%" : "—"],
                    ["CMC Rank",    c.market_cap_rank ? "#" + c.market_cap_rank : "—"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#aaa", marginBottom: 5 }}>
                      <span>{k}</span><span style={{ color: "#94a3b8", fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>📈 Tehnika</div>
                  <ScoreBar label="Tehnički skor" value={p.techScore} color="#a78bfa" />
                  {[
                    ["RSI (14)",    `${p.rsi}${p.rsi < 30 ? " 🟢" : p.rsi > 70 ? " 🔴" : ""}`, p.rsi < 30 ? "#4ade80" : p.rsi > 70 ? "#f87171" : "#94a3b8"],
                    ["MACD",        p.macdBull ? "Bullish ▲" : "Bearish ▼",                      p.macdBull ? "#4ade80" : "#f87171"],
                    ["MA7 vs MA30", p.ma7 > p.ma30 ? "Golden Cross ▲" : "Death Cross ▼",         p.ma7 > p.ma30 ? "#4ade80" : "#f87171"],
                    ["Bollinger",   `${p.bollPct}%`,                                              p.bollPct < 20 ? "#4ade80" : p.bollPct > 80 ? "#f87171" : "#94a3b8"],
                  ].map(([k, v, cl]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#aaa", marginBottom: 6 }}>
                      <span>{k}</span><span style={{ color: cl, fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Composite Score */}
              <div style={{ marginTop: 20, padding: 16, background: "#060d18", borderRadius: 12, border: "1px solid #1e2d3d" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🤖 AI Composite Score</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  {[
                    ["💬 Sentiment 20%", fngVal,      "#22d3ee"],
                    ["📊 Volumen 22%",   p.volScore,  "#f59e0b"],
                    ["📈 Tehnika 35%",   p.techScore, "#a78bfa"],
                    ["⚡ Momentum 23%",  p.momScore,  "#4ade80"],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ flex: 1, minWidth: 90, background: "#0a1422", borderRadius: 8, padding: "10px 12px", border: `1px solid ${color}30` }}>
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color }}>{(+val).toFixed(0)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ background: "#1e2a3a", borderRadius: 8, height: 12, overflow: "hidden" }}>
                      <div style={{ width: `${p.finalScore}%`, height: "100%", background: "linear-gradient(90deg,#4ade80,#22d3ee)", borderRadius: 8, transition: "width 1s ease" }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: p.finalScore > 60 ? "#4ade80" : p.finalScore < 40 ? "#f87171" : "#facc15" }}>
                    {p.finalScore.toFixed(0)}<span style={{ fontSize: 13, color: "#475569" }}>/100</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: sigColor(p.signal) }}>{p.signal}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>Pouzdanost: {p.confidence}%</div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12, padding: "10px 14px", background: "#0d1a2a", borderRadius: 8, fontSize: 11, color: "#64748b", borderLeft: "3px solid #f59e0b" }}>
                ⚠️ <strong style={{ color: "#f59e0b" }}>Upozorenje:</strong> Edukativni alat. Nije financijski savjet.
              </div>
            </div>
          );
        })()}

        {!selected && status === "ok" && (
          <div style={{ textAlign: "center", color: "#475569", fontSize: 13, padding: "12px 0" }}>
            ↑ Klikni na token za detaljnu live analizu
          </div>
        )}

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 10, color: "#1e2d3d" }}>
          CoinGecko Public API · Alternative.me FNG · Server-side cache 60s
        </div>
      </div>
    </div>
  );
}