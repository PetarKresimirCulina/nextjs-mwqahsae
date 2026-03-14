"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface Token { symbol: string; name: string; color: string; cg: string; custom?: boolean; }
interface Zone  { from: number; to: number; color: string; label: string; }

const DEFAULT_TOKENS: Token[] = [
  { symbol: "BTC",  name: "Bitcoin",   color: "#F7931A", cg: "bitcoin" },
  { symbol: "ETH",  name: "Ethereum",  color: "#627EEA", cg: "ethereum" },
  { symbol: "SOL",  name: "Solana",    color: "#9945FF", cg: "solana" },
  { symbol: "BNB",  name: "BNB",       color: "#F3BA2F", cg: "binancecoin" },
  { symbol: "ADA",  name: "Cardano",   color: "#0033AD", cg: "cardano" },
  { symbol: "AVAX", name: "Avalanche", color: "#E84142", cg: "avalanche-2" },
];

const EXTRA_COLORS = ["#06b6d4","#8b5cf6","#ec4899","#f97316","#14b8a6","#a3e635","#fb7185","#818cf8","#34d399","#fbbf24"];
let colorIdx = 0;
const nextColor = () => EXTRA_COLORS[colorIdx++ % EXTRA_COLORS.length];
const LS_KEY = "cp_custom_tokens";

const fmtPrice = (p: number) => {
  if (!p && p !== 0) return "—";
  if (p >= 1000) return "$" + Number(p).toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1)    return "$" + Number(p).toFixed(2);
  return "$" + Number(p).toFixed(4);
};
const fmtBig = (n: number) => {
  if (!n) return "—";
  if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9)  return "$" + (n / 1e9).toFixed(2) + "B";
  return "$" + (n / 1e6).toFixed(2) + "M";
};
const sigColor = (s: string): string =>
  ({"STRONG BUY":"#4ade80","BUY":"#86efac","NEUTRAL":"#facc15","SELL":"#fca5a5","STRONG SELL":"#f87171"} as Record<string,string>)[s] || "#fff";
const lsSave = (tokens: Token[]) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(tokens.filter(t => t.custom))); } catch {}
};

// ── Napredni indikatori ────────────────────────────────────────────────────────
function calcStochRSI(prices: number[], period = 14, smoothK = 3): number {
  if (prices.length < period * 2) return 50;
  const rsiArr: number[] = [];
  for (let i = period; i < prices.length; i++) {
    let g = 0, l = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = prices[j] - prices[j-1];
      d > 0 ? (g += d) : (l -= d);
    }
    rsiArr.push(100 - 100 / (1 + g / (l || 0.0001)));
  }
  const win = rsiArr.slice(-period);
  const minR = Math.min(...win), maxR = Math.max(...win);
  const raw = maxR !== minR ? ((rsiArr[rsiArr.length-1] - minR) / (maxR - minR)) * 100 : 50;
  if (rsiArr.length < smoothK) return +raw.toFixed(1);
  const smoothed = rsiArr.slice(-smoothK).reduce((a, b, _, arr) => {
    const w2 = arr.slice(-period); const mn = Math.min(...w2), mx = Math.max(...w2);
    return a + (mx !== mn ? ((b - mn) / (mx - mn)) * 100 : 50);
  }, 0) / smoothK;
  return +smoothed.toFixed(1);
}

function calcWilliamsR(prices: number[], period = 14): number {
  if (prices.length < period) return 50;
  const slice = prices.slice(-period);
  const high = Math.max(...slice), low = Math.min(...slice);
  const close = prices[prices.length - 1];
  if (high === low) return 50;
  return +(100 + ((high - close) / (high - low)) * -100).toFixed(1);
}

function calcOBVScore(prices: number[], volumes: number[]): number {
  if (prices.length < 2 || volumes.length < 2) return 50;
  const len = Math.min(prices.length, volumes.length);
  let obv = 0;
  const obvArr: number[] = [0];
  for (let i = 1; i < len; i++) {
    obv += prices[i] > prices[i-1] ? volumes[i] : prices[i] < prices[i-1] ? -volumes[i] : 0;
    obvArr.push(obv);
  }
  const recent = obvArr.slice(-14);
  const slope = (recent[recent.length-1] - recent[0]) / (recent.length || 1);
  const priceSlope = (prices[prices.length-1] - prices[Math.max(0, prices.length-14)]) / (prices[Math.max(0, prices.length-14)] || 1);
  return slope > 0 && priceSlope > 0 ? 70 : slope < 0 && priceSlope < 0 ? 30 : slope > 0 && priceSlope < 0 ? 60 : slope < 0 && priceSlope > 0 ? 40 : 50;
}

function calcATHScore(price: number, ath: number, atl: number): number {
  if (!ath || !atl || ath === atl) return 50;
  const pctFromATH = ((price - ath) / ath) * 100;
  const pctFromATL = ((price - atl) / atl) * 100;
  const athScore = Math.max(0, Math.min(100, 50 + pctFromATH * 0.3));
  const atlScore = Math.max(0, Math.min(100, Math.log10(pctFromATL + 1) * 40));
  return +(athScore * 0.5 + atlScore * 0.5).toFixed(1);
}

// ── Shared majority vote core ──────────────────────────────────────────────────
function majorityVote(
  rsi: number, stochRSI: number, williamsR: number,
  macdBull: boolean, ma7: number, ma30: number, ma90: number,
  bollPct: number, obvScore: number
): { signal: string; score: number; bullPct: number; bearPct: number } {
  const votes: number[] = [];
  // RSI
  if (rsi < 35) votes.push(1); else if (rsi > 65) votes.push(-1); else votes.push(0);
  // Stoch RSI
  if (stochRSI < 25) votes.push(1); else if (stochRSI > 75) votes.push(-1); else votes.push(0);
  // Williams %R
  const wrD = 100 - williamsR;
  if (wrD < 25) votes.push(1); else if (wrD > 75) votes.push(-1); else votes.push(0);
  // MACD
  votes.push(macdBull ? 1 : -1);
  // MA kratkoročni
  votes.push(ma7 > ma30 ? 1 : -1);
  // MA dugoročni
  votes.push(ma30 > ma90 ? 1 : -1);
  // Bollinger
  if (bollPct < 20) votes.push(1); else if (bollPct > 80) votes.push(-1); else votes.push(0);
  // OBV
  if (obvScore > 60) votes.push(1); else if (obvScore < 40) votes.push(-1); else votes.push(0);
  // Death cross extra penalty
  if (ma7 < ma30 && ma30 < ma90) votes.push(-1);

  const bullV = votes.filter(v => v === 1).length;
  const bearV = votes.filter(v => v === -1).length;
  const total = votes.length;
  const bPct = bullV / total, rPct = bearV / total;

  let signal: string, score: number;
 if (bPct >= 0.55) {
    signal = bPct >= 0.72 ? "STRONG BUY" : "BUY";
    score = Math.round(50 + bPct * 50);
  } else if (rPct >= 0.55) {
    signal = rPct >= 0.72 ? "STRONG SELL" : "SELL";
    score = Math.round(50 - rPct * 50);
  } else {
    signal = "NEUTRAL";
    score = Math.round(50 + (bPct - rPct) * 25);
  }
  return { signal, score, bullPct: bPct, bearPct: rPct };
}

// ── Token Sentiment ────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeTokenSentiment(coin: any) {
  const vol=coin.total_volume??0, mcap=coin.market_cap??1;
  const prices:number[]=coin.sparkline_in_7d?.price??[];
  const volRatio=Math.min(100,Math.max(0,(vol/mcap)*500+40));
  let accel=50;
  if(prices.length>=48){const r=prices.slice(-24).reduce((a,b)=>a+b,0)/24,o=prices.slice(-48,-24).reduce((a,b)=>a+b,0)/24;accel=Math.min(100,Math.max(0,50+((r-o)/(o||1))*300));}
  let stability=50;
  if(prices.length>=24){const sl=prices.slice(-24),avg=sl.reduce((a,b)=>a+b,0)/sl.length,std=Math.sqrt(sl.reduce((a,b)=>a+(b-avg)**2,0)/sl.length);stability=Math.min(100,Math.max(0,100-(std/(avg||1))*400));}
  const score=+(volRatio*0.40+accel*0.35+stability*0.25).toFixed(0);
  const label=score>=70?"Bullish":score>=55?"Blago bullish":score>=45?"Neutralan":score>=30?"Blago bearish":"Bearish";
  const color=score>=70?"#4ade80":score>=55?"#86efac":score>=45?"#facc15":score>=30?"#fca5a5":"#f87171";
  return {score,label,color,breakdown:[["Vol. aktivnost",+volRatio.toFixed(0),"#f59e0b"],["Akceleracija",+accel.toFixed(0),"#22d3ee"],["Stabilnost",+stability.toFixed(0),"#60a5fa"]] as [string,number,string][]};
}

// ── Prediction engine (majority vote) ─────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computePrediction(coin: any, tokenSentiment: number, extPrices?: number[], extVolumes?: number[]) {
  const price = coin.current_price ?? 0;
  const chg24 = coin.price_change_percentage_24h ?? 0;
  const chg7  = coin.price_change_percentage_7d_in_currency ?? 0;
  const vol = coin.total_volume ?? 0, mcap = coin.market_cap ?? 1;
  const ath = coin.ath ?? 0, atl = coin.atl ?? 0;

  const prices: number[] = extPrices && extPrices.length > 30 ? extPrices : coin.sparkline_in_7d?.price ?? [];
  const volumes: number[] = extVolumes && extVolumes.length > 0 ? extVolumes : Array(prices.length).fill(vol);
  const avg = (arr: number[]) => arr.length ? arr.reduce((a,b) => a+b,0)/arr.length : price;

  // RSI
  let rsi = 50;
  if (prices.length > 14) {
    let g = 0, l = 0;
    for (let i = prices.length-14; i < prices.length; i++) { const d = prices[i]-prices[i-1]; d>0?(g+=d):(l-=d); }
    rsi = 100 - 100/(1 + g/(l||0.0001));
  }

  const ema = (arr: number[], n: number) => { const k=2/(n+1); let e=arr[0]||price; arr.forEach((v,i)=>{if(i)e=v*k+e*(1-k);}); return e; };
  const macdBull = prices.length>=26 ? ema(prices,12)>ema(prices,26) : chg24>0;

  const isDailyData = extPrices && extPrices.length >= 60;
  const maSlice = isDailyData ? extPrices! : prices;
  const ptsPerDay = isDailyData ? 1 : Math.max(1, Math.round(prices.length / 7));
  const ma7  = maSlice.length >= 7*ptsPerDay  ? avg(maSlice.slice(-7*ptsPerDay))  : price;
  const ma30 = maSlice.length >= 30*ptsPerDay ? avg(maSlice.slice(-30*ptsPerDay)) : price;
  const ma90 = maSlice.length >= 90*ptsPerDay ? avg(maSlice.slice(-90*ptsPerDay)) : ma30;

  let bollPct = 50;
  if (prices.length>=20) {
    const sl=prices.slice(-20), m=avg(sl);
    const std=Math.sqrt(sl.reduce((a,b)=>a+(b-m)**2,0)/20);
    const upper=m+2*std, lower=m-2*std;
    bollPct = upper!==lower ? ((price-lower)/(upper-lower))*100 : 50;
  }

  const stochRSI  = calcStochRSI(prices);
  const williamsR = calcWilliamsR(prices);
  const obvScore  = calcOBVScore(prices, volumes);
  const athFinal  = calcATHScore(price, ath, atl);
  const volMcapRatio = mcap > 0 ? vol/mcap : 0;
  const isMemeCoin = volMcapRatio > 0.20;

  // Majority vote → signal
  const vote = majorityVote(rsi, stochRSI, williamsR, macdBull, ma7, ma30, ma90, bollPct, obvScore);
  let signal = vote.signal;
  let finalScore = vote.score;

  // Meme coin penalty
  if (isMemeCoin) {
    finalScore = Math.max(0, finalScore - 15);
    if (signal === "STRONG BUY") signal = "BUY";
    if (signal === "BUY" && finalScore < 55) signal = "NEUTRAL";
  }

  // Score komponente za prikaz (breakdown)
  const maTrend = ma7>ma30&&ma30>ma90?75 : ma7>ma30?62 : ma7<ma30&&ma30<ma90?25 : 38;
  const rsiScore   = rsi<30?82:rsi>70?20:50+(50-rsi)*0.65;
  const stochScore = stochRSI<20?82:stochRSI>80?20:50+(50-stochRSI)*0.65;
  const wrScore    = williamsR<20?80:williamsR>80?22:50+(50-williamsR)*0.6;
  const macdScore  = macdBull?68:32;
  const bollScore  = bollPct<20?78:bollPct>80?22:50;
  const techScore  = rsiScore*0.20+stochScore*0.15+wrScore*0.10+macdScore*0.20+maTrend*0.20+bollScore*0.15;

  const volScore  = Math.min(100,Math.max(0,(vol/mcap)*1000+50+chg24*0.5));
  const volRaw    = volScore*0.6+obvScore*0.4;
  const volFinal  = volMcapRatio > 0.10 ? Math.min(volRaw, 75) : volRaw;
  const capMom = (v: number, mult: number) => Math.sign(v) * Math.log1p(Math.abs(v)) * mult;
  const momScore  = Math.min(100,Math.max(0,50+capMom(chg24,4.5)+capMom(chg7,2.4)));
  const athCapped = isMemeCoin && athFinal > 45 ? 45 : athFinal;

  // Predicted price baziran na vote score
  const pct = ((finalScore-50)/50)*30;
  const predicted7d = price*(1+pct/100);

  const scores=[tokenSentiment,volFinal,techScore,momScore,athFinal];
  const mean=scores.reduce((a,b)=>a+b,0)/scores.length;
  const variance=scores.reduce((a,b)=>a+Math.abs(b-mean),0)/scores.length;
  const confidence=Math.max(38,Math.min(94,88-variance*0.9));

  return {
    rsi:+rsi.toFixed(1), macdBull, ma7:+ma7.toFixed(2), ma30:+ma30.toFixed(2), ma90:+ma90.toFixed(2),
    bollPct:+bollPct.toFixed(0), stochRSI:+stochRSI.toFixed(1), williamsR:+williamsR.toFixed(1),
    obvScore:+obvScore.toFixed(0), athScore:+athFinal.toFixed(0),
    techScore:+techScore.toFixed(1), volScore:+volFinal.toFixed(1), momScore:+momScore.toFixed(1),
    finalScore:+finalScore.toFixed(1), pct:+pct.toFixed(2),
    predicted7d:+predicted7d.toFixed(price<1?4:price<100?2:0),
    confidence:+confidence.toFixed(0), signal, isMemeCoin,
    pctFromATH: ath ? +((price-ath)/ath*100).toFixed(1) : null,
    pctFromATL: atl ? +((price-atl)/atl*100).toFixed(1) : null,
    bullPct: +vote.bullPct.toFixed(2), bearPct: +vote.bearPct.toFixed(2),
  };
}

// ── Retroaktivni tehnički signali (majority vote) ─────────────────────────────
function buildRetroSignals(prices: number[], volumes?: number[]): { score: number; signal: string; color: string }[] {
  const n = prices.length;
  if (n < 30) return [];

  const k12=2/13, k26=2/27, k9=2/10;
  let ema12=prices[0], ema26=prices[0], emaSignal=0;
  let avgGain=0, avgLoss=0;
  for (let i=1; i<=Math.min(14,n-1); i++) {
    const d=prices[i]-prices[i-1]; d>0?(avgGain+=d):(avgLoss-=d);
  }
  avgGain/=14; avgLoss/=14;

  const avgArr = (a: number[]) => a.reduce((s,v)=>s+v,0)/a.length;
  const macdArr: number[] = [];
  const ind: { rsi:number; macd:number; ma7:number; ma30:number; ma90:number; bollPct:number; stochRSI:number; obvScore:number }[] = [];

  for (let i=0; i<n; i++) {
    if (i>0) { ema12=prices[i]*k12+ema12*(1-k12); ema26=prices[i]*k26+ema26*(1-k26); }
    const macdLine=ema12-ema26;
    if (i===0) emaSignal=macdLine; else emaSignal=macdLine*k9+emaSignal*(1-k9);
    macdArr.push(macdLine-emaSignal);
    if (i>=15) { const d=prices[i]-prices[i-1]; avgGain=(avgGain*13+Math.max(0,d))/14; avgLoss=(avgLoss*13+Math.max(0,-d))/14; }
    const rsi = avgLoss===0?100:100-100/(1+avgGain/avgLoss);
    const ma7  = avgArr(prices.slice(Math.max(0,i-6),  i+1));
    const ma30 = avgArr(prices.slice(Math.max(0,i-29), i+1));
    const ma90 = avgArr(prices.slice(Math.max(0,i-89), i+1));
    const bs=prices.slice(Math.max(0,i-19),i+1), bAvg=avgArr(bs);
    const std=Math.sqrt(bs.reduce((a,v)=>a+(v-bAvg)**2,0)/bs.length);
    const upper=bAvg+2*std, lower=bAvg-2*std;
    const bollPct = upper!==lower?((prices[i]-lower)/(upper-lower))*100:50;
    const stochRSI = calcStochRSI(prices.slice(Math.max(0,i-27),i+1));
    const sliceV = volumes ? volumes.slice(Math.max(0,i-Math.min(i,13)),i+1) : [];
    const obvScore = volumes ? calcOBVScore(prices.slice(Math.max(0,i-13),i+1), sliceV) : 50;
    ind.push({ rsi, macd:macdArr[i], ma7, ma30, ma90, bollPct, stochRSI, obvScore });
  }

  return ind.map((d, i) => {
    if (i < 20) return { score:50, signal:"—", color:"#475569" };
    const macdBull = d.macd > 0;
    const v = majorityVote(d.rsi, d.stochRSI, calcWilliamsR(prices.slice(Math.max(0,i-13),i+1)),
      macdBull, d.ma7, d.ma30, d.ma90, d.bollPct, d.obvScore);
    const color = v.signal==="STRONG BUY"?"#4ade80":v.signal==="BUY"?"#86efac":v.signal==="NEUTRAL"?"#facc15":v.signal==="SELL"?"#fca5a5":"#f87171";
    return { score:v.score, signal:v.signal, color };
  });
}

// ── Backtest logika (majority vote) ───────────────────────────────────────────
interface BacktestWeek {
  weekIdx: number; signal: string; signalScore: number;
  correct: boolean | null; priceThen: number;
  price7dLater: number | null; pctChange: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeBacktest(prices: number[], volumes: number[], coin: any): BacktestWeek[] {
  const n = prices.length;
  if (n < 30) return [];
  const results: BacktestWeek[] = [];
  const ptsPerDay = Math.max(1, Math.round(n / 90));
  const ptsPerWeek = ptsPerDay * 7;
  const avgArr = (arr: number[]) => arr.reduce((a,b)=>a+b,0)/arr.length;
  const ema = (arr: number[], period: number) => {
    const k=2/(period+1); let e=arr[0];
    arr.forEach((v,i)=>{ if(i) e=v*k+e*(1-k); }); return e;
  };

  for (let weekIdx=0; weekIdx<13; weekIdx++) {
    const endIdx = Math.min(n-1, Math.round((weekIdx/12)*(n-1-ptsPerWeek)));
    if (endIdx < 20) continue;
    const sp = prices.slice(0, endIdx+1);
    const sv = volumes.slice(0, endIdx+1);
    const cur = sp[sp.length-1];

    let rsi=50;
    if (sp.length>14) {
      let g=0,l=0;
      for (let i=sp.length-14;i<sp.length;i++) { const d=sp[i]-sp[i-1]; d>0?(g+=d):(l-=d); }
      rsi=100-100/(1+(g/(l||0.0001)));
    }
    const macdBull = sp.length>=26 ? ema(sp,12)>ema(sp,26) : false;
    const ma7  = sp.length>=7  ? avgArr(sp.slice(-7))  : cur;
    const ma30 = sp.length>=30 ? avgArr(sp.slice(-30)) : cur;
    const ma90 = sp.length>=90 ? avgArr(sp.slice(-90)) : ma30;
    let bollPct=50;
    if (sp.length>=20) {
      const sl=sp.slice(-20), m=avgArr(sl);
      const std=Math.sqrt(sl.reduce((a,b)=>a+(b-m)**2,0)/20);
      const upper=m+2*std, lower=m-2*std;
      bollPct=upper!==lower?((cur-lower)/(upper-lower))*100:50;
    }
    const stochRSI = calcStochRSI(sp);
    const williamsR = calcWilliamsR(sp);
    const obvScore = calcOBVScore(sp, sv);

    const vote = majorityVote(rsi, stochRSI, williamsR, macdBull, ma7, ma30, ma90, bollPct, obvScore);
    const volMcapRatio = (coin.market_cap??1) > 0 ? (coin.total_volume??0)/(coin.market_cap??1) : 0;
    const isMemeCoin = volMcapRatio > 0.20;
    let { signal, score: signalScore } = vote;
    if (isMemeCoin) {
      signalScore = Math.max(0, signalScore-15);
      if (signal==="STRONG BUY") signal="BUY";
      if (signal==="BUY"&&signalScore<55) signal="NEUTRAL";
    }

    const priceThen = cur;
    const futureIdx = endIdx + ptsPerWeek;
    const price7dLater = futureIdx<n ? prices[Math.min(n-1,futureIdx)] : null;
    const pctChange = price7dLater!==null ? ((price7dLater-priceThen)/priceThen)*100 : null;
    let correct: boolean|null = null;
    if (pctChange!==null) {
      if (signal==="BUY"||signal==="STRONG BUY") correct=pctChange>0;
      else if (signal==="SELL"||signal==="STRONG SELL") correct=pctChange<0;
      // NEUTRAL se NE računa u točnost (correct ostaje null)
    }
    results.push({ weekIdx, signal, signalScore, correct, priceThen, price7dLater, pctChange });
  }
  return results;
}

// ── BacktestModal ──────────────────────────────────────────────────────────────
function BacktestModal({ tokens, allHistory, coins, onClose }: {
  tokens: Token[];
  allHistory: Record<string, { prices: number[]; volumes: number[] }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coins: Record<string, any>;
  onClose: () => void;
}) {
  const [tooltip, setTooltip] = useState<{ token:string; week:number; data:BacktestWeek; x:number; y:number }|null>(null);

  const backtestData = useMemo(() => {
    const result: Record<string, BacktestWeek[]> = {};
    for (const t of tokens) {
      const h=allHistory[t.cg], c=coins[t.cg];
      if (h&&c&&h.prices.length>=30) result[t.cg]=computeBacktest(h.prices,h.volumes,c);
    }
    return result;
  }, [tokens, allHistory, coins]);

  const weeks = Array.from({length:13},(_,i)=>i);
  const weekLabel = (i:number) => { const w=12-i; return w===0?"Sad":`-${w}t`; };

  const cellColor = (wk: BacktestWeek|undefined) => {
    if (!wk) return "#0d1a2d";
    if (wk.correct===null) return "#1e2a3a";
    const str=Math.min(1,Math.abs(wk.pctChange??0)/10);
    const strong=wk.signal.includes("STRONG");
    return wk.correct
      ? `rgba(74,222,128,${strong?0.5+str*0.5:0.3+str*0.4})`
      : `rgba(248,113,113,${strong?0.5+str*0.5:0.3+str*0.4})`;
  };

  const tokenAccuracy = (cg:string) => {
    const ws=backtestData[cg]??[];
    const valid=ws.filter(w=>w.correct!==null);
    if (!valid.length) return null;
    const correct=valid.filter(w=>w.correct).length;
    return { pct:Math.round((correct/valid.length)*100), n:valid.length, correct };
  };

  const weekAccuracy = (wi:number) => {
    let correct=0,total=0;
    for (const t of tokens) {
      const wk=backtestData[t.cg]?.find(w=>w.weekIdx===wi);
      if (wk&&wk.correct!==null) { total++; if(wk.correct) correct++; }
    }
    return total>0?Math.round((correct/total)*100):null;
  };

  const tokensWithData=tokens.filter(t=>backtestData[t.cg]?.length>0);
  const totalCorrect=Object.values(backtestData).flat().filter(w=>w.correct===true).length;
  const totalValid=Object.values(backtestData).flat().filter(w=>w.correct!==null).length;
  const overallPct=totalValid>0?Math.round((totalCorrect/totalValid)*100):null;

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:300,backdropFilter:"blur(4px)"}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"min(1020px, 96vw)",maxHeight:"90vh",overflowY:"auto",zIndex:301,background:"#0a1422",border:"1px solid #1e3a5f",borderRadius:16,padding:24,boxShadow:"0 24px 64px rgba(0,0,0,0.6)",scrollbarWidth:"thin",scrollbarColor:"#1e3a5f #060d18"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <h2 style={{margin:0,fontSize:18,fontWeight:800,color:"#e2e8f0"}}>📊 Historijski Backtest</h2>
            <p style={{margin:"4px 0 0",fontSize:12,color:"#475569"}}>Točnost AI signala u zadnjih 90 dana · Majority vote · Signal točan ako cijena ide u predviđenom smjeru nakon 7d</p>
          </div>
          <button onClick={onClose} style={{background:"#0d1f2d",border:"1px solid #1e3a5f",color:"#94a3b8",borderRadius:8,width:36,height:36,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>

        {overallPct!==null&&(
          <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
            <div style={{padding:"12px 20px",background:"#060d18",borderRadius:10,border:`1px solid ${overallPct>=60?"#4ade80":overallPct>=45?"#facc15":"#f87171"}40`}}>
              <div style={{fontSize:10,color:"#475569",marginBottom:4}}>Ukupna točnost</div>
              <div style={{fontSize:28,fontWeight:900,color:overallPct>=60?"#4ade80":overallPct>=45?"#facc15":"#f87171"}}>{overallPct}%</div>
              <div style={{fontSize:10,color:"#334155"}}>{totalCorrect}/{totalValid} signala</div>
            </div>
            <div style={{padding:"12px 20px",background:"#060d18",borderRadius:10,border:"1px solid #1e2d3d"}}>
              <div style={{fontSize:10,color:"#475569",marginBottom:4}}>Tokeni s podacima</div>
              <div style={{fontSize:28,fontWeight:900,color:"#22d3ee"}}>{tokensWithData.length}</div>
              <div style={{fontSize:10,color:"#334155"}}>od {tokens.length} ukupno</div>
            </div>
            <div style={{padding:"12px 20px",background:"#060d18",borderRadius:10,border:"1px solid #1e2d3d",flex:1,minWidth:200}}>
              <div style={{fontSize:10,color:"#475569",marginBottom:8}}>Legenda</div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                {[["#4ade80","Točan signal"],["#f87171","Netočan signal"],["#1e2a3a","Nema fut. podataka"]].map(([c,l])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#64748b"}}>
                    <div style={{width:12,height:12,borderRadius:3,background:c}}/>{l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tokensWithData.length===0?(
          <div style={{textAlign:"center",padding:40,color:"#334155",fontSize:13}}>⏳ Čekam učitavanje history podataka…</div>
        ):(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"separate",borderSpacing:2}}>
              <thead>
                <tr>
                  <th style={{textAlign:"left",fontSize:11,color:"#475569",fontWeight:600,padding:"4px 8px",minWidth:80}}>Token</th>
                  {weeks.map(i=><th key={i} style={{textAlign:"center",fontSize:9,color:"#334155",fontWeight:400,padding:"4px 2px",minWidth:44}}>{weekLabel(i)}</th>)}
                  <th style={{textAlign:"center",fontSize:11,color:"#475569",fontWeight:600,padding:"4px 8px",minWidth:70}}>Točnost</th>
                </tr>
              </thead>
              <tbody>
                {tokensWithData.map(t=>{
                  const acc=tokenAccuracy(t.cg);
                  return (
                    <tr key={t.cg}>
                      <td style={{padding:"3px 8px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:t.color,flexShrink:0}}/>
                          <span style={{fontSize:12,fontWeight:700,color:"#e2e8f0"}}>{t.symbol}</span>
                        </div>
                      </td>
                      {weeks.map(wi=>{
                        const wk=backtestData[t.cg]?.find(w=>w.weekIdx===wi);
                        return (
                          <td key={wi} style={{padding:2}}>
                            <div
                              onMouseEnter={e=>{
                                if(!wk) return;
                                const r=(e.target as HTMLElement).getBoundingClientRect();
                                setTooltip({token:t.symbol,week:wi,data:wk,x:r.left,y:r.top});
                              }}
                              onMouseLeave={()=>setTooltip(null)}
                              style={{width:40,height:32,borderRadius:5,background:cellColor(wk),cursor:wk?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"rgba(255,255,255,0.7)",fontWeight:700,border:wk?.correct===null&&wk?"1px solid #1e2d3d":"none"}}
                            >
                              {wk&&wk.correct!==null?(wk.signal==="STRONG BUY"?"SB":wk.signal==="STRONG SELL"?"SS":wk.signal==="BUY"?"B":wk.signal==="SELL"?"S":"N"):""}
                            </div>
                          </td>
                        );
                      })}
                      <td style={{padding:"3px 8px",textAlign:"center"}}>
                        {acc?(
                          <div>
                            <span style={{fontSize:14,fontWeight:800,color:acc.pct>=60?"#4ade80":acc.pct>=45?"#facc15":"#f87171"}}>{acc.pct}%</span>
                            <div style={{fontSize:9,color:"#334155"}}>{acc.correct}/{acc.n}</div>
                          </div>
                        ):<span style={{color:"#334155",fontSize:11}}>—</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td style={{padding:"6px 8px",fontSize:10,color:"#475569",fontWeight:600}}>Tjedan %</td>
                  {weeks.map(i=>{
                    const pct=weekAccuracy(i);
                    return (
                      <td key={i} style={{padding:2,textAlign:"center"}}>
                        {pct!==null?<span style={{fontSize:10,fontWeight:700,color:pct>=60?"#4ade80":pct>=45?"#facc15":"#f87171"}}>{pct}%</span>:<span style={{color:"#1e2d3d",fontSize:10}}>—</span>}
                      </td>
                    );
                  })}
                  <td/>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div style={{marginTop:16,padding:"10px 14px",background:"#060d18",borderRadius:8,fontSize:11,color:"#334155",borderLeft:"3px solid #f59e0b"}}>
          ⚠️ <strong style={{color:"#f59e0b"}}>Napomena:</strong> Backtest koristi majority vote iste indikatore kao live analiza. Past performance ne garantira buduće rezultate. Zadnji tjedni nemaju future podatke (siva polja).
        </div>
      </div>

      {tooltip&&(
        <div style={{position:"fixed",left:tooltip.x+16,top:tooltip.y-10,zIndex:400,background:"#0d1a2d",border:`1px solid ${tooltip.data.correct===true?"#4ade80":tooltip.data.correct===false?"#f87171":"#1e3a5f"}`,borderRadius:10,padding:"10px 14px",fontSize:11,color:"#94a3b8",pointerEvents:"none",minWidth:180,boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}}>
          <div style={{fontWeight:700,color:"#e2e8f0",marginBottom:6}}>{tooltip.token} · {weekLabel(tooltip.week)}</div>
          {[
            ["Signal", <span style={{color:sigColor(tooltip.data.signal),fontWeight:700}}>{tooltip.data.signal}</span>],
            ["Score",  <span style={{color:"#e2e8f0"}}>{tooltip.data.signalScore}/100</span>],
            ["Cijena tada", <span style={{color:"#e2e8f0"}}>{fmtPrice(tooltip.data.priceThen)}</span>],
            ...(tooltip.data.price7dLater!==null?[["Cijena +7d", <span style={{color:tooltip.data.pctChange!>=0?"#4ade80":"#f87171"}}>{fmtPrice(tooltip.data.price7dLater)} ({tooltip.data.pctChange!>=0?"+":""}{tooltip.data.pctChange!.toFixed(2)}%)</span>]]:[]),
          ].map(([k,v],i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span>{k as string}</span>{v as React.ReactNode}
            </div>
          ))}
          <div style={{marginTop:6,paddingTop:6,borderTop:"1px solid #1e2d3d",fontWeight:700,color:tooltip.data.correct===true?"#4ade80":tooltip.data.correct===false?"#f87171":"#475569"}}>
            {tooltip.data.correct===true?"✅ Točan signal":tooltip.data.correct===false?"❌ Netočan signal":"⏳ Nema podataka"}
          </div>
        </div>
      )}
    </>
  );
}

// ── CandlestickChart ───────────────────────────────────────────────────────────
function CandlestickChart({ cgId, color }: { cgId: string; color: string }) {
  const [tf, setTf] = useState<"24h"|"3d"|"7d"|"30d"|"90d">("7d");
  const [ohlc, setOhlc] = useState<[number,number,number,number,number][]>([]);
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<{i:number;x:number;candle:[number,number,number,number,number]}|null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tfToDays: Record<string,string> = {"24h":"1","3d":"3","7d":"7","30d":"30","90d":"90"};

  useEffect(()=>{
    setLoading(true); setOhlc([]);
    fetch(`/api/ohlc?id=${cgId}&days=${tfToDays[tf]}&currency=eur`)
      .then(r=>r.json()).then(d=>{if(Array.isArray(d))setOhlc(d);})
      .catch(()=>{}).finally(()=>setLoading(false));
  },[cgId,tf]);

  const W=600,H=200,padL=60,padR=8,padT=10,padB=24;
  const chartW=W-padL-padR, chartH=H-padT-padB;
  const allVals=ohlc.flatMap(([,o,h,l,c])=>[o,h,l,c]);
  const minV=allVals.length?Math.min(...allVals):0, maxV=allVals.length?Math.max(...allVals):1;
  const range=maxV-minV||1;
  const toY=(v:number)=>padT+chartH-((v-minV)/range)*chartH;
  const n=ohlc.length;
  const candleW=Math.max(2,Math.min(16,(chartW/(n||1))*0.7));
  const spacing=n>1?chartW/(n-1):0;
  const toX=(i:number)=>padL+(n===1?chartW/2:i*spacing);
  const fmtP=(v:number)=>v>=1000?"$"+v.toLocaleString("en-US",{maximumFractionDigits:0}):v>=1?"$"+v.toFixed(2):"$"+v.toFixed(4);
  const fmtDate=(ts:number)=>{const d=new Date(ts);return tf==="24h"?d.toLocaleTimeString("hr",{hour:"2-digit",minute:"2-digit"}):d.toLocaleDateString("hr",{day:"2-digit",month:"2-digit"});};
  const gridPrices=Array.from({length:4},(_,i)=>minV+(range/3)*i);
  const handleMouseMove=(e:React.MouseEvent<SVGSVGElement>)=>{
    if(!svgRef.current||!n) return;
    const rect=svgRef.current.getBoundingClientRect();
    const rawX=(e.clientX-rect.left)*(W/rect.width)-padL;
    const i=Math.max(0,Math.min(n-1,Math.round(rawX/(spacing||1))));
    setTooltip({i,x:toX(i),candle:ohlc[i]});
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:12,color:"#64748b"}}>Svjećnjaci (OHLC)</span>
        <div style={{display:"flex",gap:4}}>
          {(["24h","3d","7d","30d","90d"] as const).map(t=>(
            <button key={t} onClick={()=>{setTf(t);setTooltip(null);}} style={{background:tf===t?color:"#0d1f2d",border:`1px solid ${tf===t?color:"#1e3a5f"}`,color:tf===t?"#060d18":"#94a3b8",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:tf===t?700:400,transition:"all 0.15s"}}>{t}</button>
          ))}
        </div>
      </div>
      <div style={{background:"#060d18",borderRadius:10,padding:"12px 8px 4px",border:"1px solid #1e2d3d",position:"relative"}}>
        {loading&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}><span style={{color:"#334155",fontSize:12}}>Učitavam svjećnjake…</span></div>}
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:"block",overflow:"visible",cursor:"crosshair",opacity:loading?0.3:1}} onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)}>
          {gridPrices.map((v,i)=>(
            <g key={i}>
              <line x1={padL} y1={toY(v)} x2={W-padR} y2={toY(v)} stroke="#1e2d3d" strokeWidth="1" strokeDasharray="4,4"/>
              <text x={padL-4} y={toY(v)+4} fill="#475569" fontSize="9" textAnchor="end">{fmtP(v)}</text>
            </g>
          ))}
          {ohlc.filter((_,i)=>n<=20||i%Math.ceil(n/10)===0).map(([ts],i)=>{
            const origI=ohlc.findIndex(c=>c[0]===ts);
            return <text key={i} x={toX(origI)} y={H-4} fill="#475569" fontSize="9" textAnchor="middle">{fmtDate(ts)}</text>;
          })}
          {ohlc.map(([ts,o,h,l,c],i)=>{
            const bull=c>=o, clr=bull?"#4ade80":"#f87171", x=toX(i);
            const bodyTop=toY(Math.max(o,c)), bodyBot=toY(Math.min(o,c)), bodyH=Math.max(1,bodyBot-bodyTop);
            const isHovered=tooltip?.i===i;
            return (
              <g key={ts}>
                <line x1={x} y1={toY(h)} x2={x} y2={toY(l)} stroke={clr} strokeWidth={isHovered?2:1} opacity={isHovered?1:0.85}/>
                <rect x={x-candleW/2} y={bodyTop} width={candleW} height={bodyH} fill={clr} stroke={clr} fillOpacity={bull?0.85:1} strokeWidth={isHovered?1.5:0.5} rx={1}/>
              </g>
            );
          })}
          {tooltip&&(()=>{
            const [ts,o,h,l,c]=tooltip.candle, bull=c>=o, clr=bull?"#4ade80":"#f87171";
            const tW=148,tH=82,tX=tooltip.x+tW+12>W?tooltip.x-tW-8:tooltip.x+8,tY=padT+4;
            return (
              <g>
                <line x1={tooltip.x} y1={padT} x2={tooltip.x} y2={H-padB} stroke="#475569" strokeWidth="1" strokeDasharray="3,3" opacity="0.5"/>
                <rect x={tX} y={tY} width={tW} height={tH} rx="7" fill="#0d1a2d" stroke={clr} strokeWidth="1.2" opacity="0.97"/>
                <text x={tX+8} y={tY+14} fill="#64748b" fontSize="9">{fmtDate(ts)}</text>
                {([["O",o],["H",h],["L",l],["C",c]] as [string,number][]).map(([lbl,val],i)=>(
                  <g key={lbl}>
                    <text x={tX+8} y={tY+28+i*14} fill="#475569" fontSize="10">{lbl}</text>
                    <text x={tX+tW-8} y={tY+28+i*14} fill={lbl==="C"?clr:"#e2e8f0"} fontSize="10" textAnchor="end" fontWeight={lbl==="C"?700:400}>{fmtP(val)}</text>
                  </g>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}

// ── Hook za extended data ──────────────────────────────────────────────────────
function useExtendedData(cgId: string | null) {
  const [history, setHistory] = useState<{prices:number[];volumes:number[]}|null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(()=>{
    if(!cgId){setHistory(null);return;}
    setHistory(null);setLoading(true);
    fetch(`/api/history?id=${cgId}&days=90&currency=eur`)
      .then(r=>r.json()).then(d=>{if(d&&!d.error)setHistory(d);}).catch(()=>{}).finally(()=>setLoading(false));
  },[cgId]);
  return {history,loading};
}

// ── Hook za lazy load history svih tokena ─────────────────────────────────────
function useAllHistory(tokens: Token[], ready: boolean) {
  const [allHistory,setAllHistory]=useState<Record<string,{prices:number[];volumes:number[]}>>({});
  const fetchedRef=useRef<Set<string>>(new Set());
  const runningRef=useRef(false);

  useEffect(()=>{
    if(!ready||tokens.length===0) return;
    const toFetch=tokens.filter(t=>!fetchedRef.current.has(t.cg));
    if(toFetch.length===0) return;
    if(runningRef.current) return;
    let cancelled=false;

    const fetchWithRetry=async(cg:string,attempt=0):Promise<{fromCache:boolean}>=>{
      try{
        const t0=Date.now(),r=await fetch(`/api/history?id=${cg}&days=90&currency=eur`),elapsed=Date.now()-t0;
        const d=await r.json();
        if(r.status===429&&attempt<3){await new Promise(res=>setTimeout(res,5000*Math.pow(2,attempt)));return fetchWithRetry(cg,attempt+1);}
        if(!cancelled&&d&&!d.error)setAllHistory(prev=>({...prev,[cg]:d}));
        return{fromCache:elapsed<400};
      }catch{return{fromCache:false};}
    };

    const run=async()=>{
      runningRef.current=true;
      for(const token of toFetch){
        if(cancelled)break;
        if(fetchedRef.current.has(token.cg))continue;
        fetchedRef.current.add(token.cg);
        const{fromCache}=await fetchWithRetry(token.cg);
        if(!cancelled&&!fromCache)await new Promise(res=>setTimeout(res,3000));
      }
      runningRef.current=false;
    };
    run();
    return()=>{cancelled=true;};
  },[ready,tokens.map(t=>t.cg).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return allHistory;
}

// ── ZoneScale ──────────────────────────────────────────────────────────────────
function ZoneScale({value,min,max,zones}:{value:number;min:number;max:number;zones:Zone[]}) {
  const pct=((value-min)/(max-min))*100;
  const activeZone=zones.find(z=>value>=z.from&&value<=z.to)??zones[zones.length-1];
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
      <div style={{textAlign:"right",minWidth:52}}><span style={{fontWeight:700,color:activeZone.color,fontSize:12}}>{value.toFixed(0)}</span></div>
      <div style={{position:"relative",width:110,flexShrink:0}}>
        <div style={{display:"flex",height:6,borderRadius:4,overflow:"hidden",gap:1}}>
          {zones.map(z=><div key={z.from} style={{width:`${((z.to-z.from)/(max-min))*100}%`,height:"100%",background:z.color,opacity:activeZone.from===z.from?1:0.2,transition:"opacity 0.3s"}}/>)}
        </div>
        <div style={{position:"absolute",top:"50%",left:`${Math.min(96,Math.max(2,pct))}%`,transform:"translate(-50%,-50%)",width:10,height:10,borderRadius:"50%",background:activeZone.color,border:"2px solid #0a1422",boxShadow:`0 0 6px ${activeZone.color}`,transition:"left 0.4s ease",zIndex:1}}/>
      </div>
    </div>
  );
}

// ── HelpTooltip ────────────────────────────────────────────────────────────────
function HelpTooltip({children}:{children:React.ReactNode}) {
  const [show,setShow]=useState(false),[openDown,setOpenDown]=useState(false);
  const ref=useRef<HTMLDivElement>(null),btnRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!show)return;
    const handler=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setShow(false);};
    document.addEventListener("mousedown",handler);return()=>document.removeEventListener("mousedown",handler);
  },[show]);
  const handleClick=(e:React.MouseEvent)=>{
    e.stopPropagation();
    if(!show&&btnRef.current)setOpenDown(btnRef.current.getBoundingClientRect().top<window.innerHeight/3);
    setShow(s=>!s);
  };
  return (
    <div ref={ref} style={{position:"relative",display:"inline-flex"}}>
      <button ref={btnRef} onClick={handleClick} style={{background:show?"#1e3a5f":"none",border:"1px solid #1e3a5f",color:"#475569",borderRadius:"50%",width:15,height:15,fontSize:9,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,flexShrink:0,transition:"all 0.15s"}}>?</button>
      {show&&(
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",...(openDown?{top:"calc(100% + 8px)",bottom:"auto"}:{bottom:"calc(100% + 8px)",top:"auto"}),left:"50%",transform:"translateX(-50%)",width:270,background:"#0d1a2d",border:"1px solid #1e3a5f",borderRadius:10,padding:"12px 14px",zIndex:999,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",fontSize:11,lineHeight:1.6,color:"#94a3b8"}}>
          <div style={{position:"absolute",...(openDown?{top:-6,bottom:"auto"}:{bottom:-6,top:"auto"}),left:"50%",transform:"translateX(-50%)",width:10,height:6,overflow:"hidden"}}>
            <div style={{width:8,height:8,background:"#1e3a5f",transform:openDown?"rotate(225deg)":"rotate(45deg)",margin:"0 auto",marginTop:openDown?3:-5}}/>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Help komponente ────────────────────────────────────────────────────────────
function FNGHelp({value}:{value:number}) {
  const zone=value>=75?{label:"Extreme Greed",color:"#f87171",bg:"#2a0f0f",desc:"Tržište je u euforiji — svi kupuju bez razmišljanja. Povijesno gledano, ovakvi momenti često prethode korekciji."}:value>=55?{label:"Greed",color:"#fb923c",bg:"#2a1500",desc:"Optimizam prevladava i investitori su skloni riziku. Dobro za trend, ali pazi na pretjeranu pohlepu."}:value>=45?{label:"Neutral",color:"#facc15",bg:"#1a1500",desc:"Tržište je uravnoteženo — nema ni straha ni pohlepe. Obično prijelazno razdoblje između trendova."}:value>=25?{label:"Fear",color:"#60a5fa",bg:"#0f1a2a",desc:"Investitori su nervozni i prodaju. Ovo može biti prilika za kupnju — 'be greedy when others are fearful'."}:{label:"Extreme Fear",color:"#4ade80",bg:"#0f2a1a",desc:"Panika na tržištu — masovna rasprodaja. Povijesno jedan od boljih trenutaka za dugoročnu kupnju."};
  return (
    <HelpTooltip>
      <div style={{fontWeight:700,color:"#e2e8f0",marginBottom:8,fontSize:12}}>😨 Što je Fear & Greed Index?</div>
      <p style={{marginBottom:8}}>Indeks mjeri <b style={{color:"#22d3ee"}}>emocije tržišta</b> na skali od <b>0 do 100</b>.</p>
      <div style={{padding:"8px 10px",borderRadius:6,background:zone.bg,border:`1px solid ${zone.color}40`}}>
        <div style={{color:zone.color,fontWeight:700,marginBottom:4}}>Trenutno: {value} — {zone.label}</div>
        <div style={{fontSize:10,color:"#94a3b8",lineHeight:1.5}}>{zone.desc}</div>
      </div>
    </HelpTooltip>
  );
}
function StochRSIHelp({value}:{value:number}) {
  const zone=value<20?"oversold":value>80?"overbought":"neutral";
  const zoneColor=zone==="oversold"?"#4ade80":zone==="overbought"?"#f87171":"#facc15";
  return <HelpTooltip><div style={{fontWeight:700,color:"#e2e8f0",marginBottom:8,fontSize:12}}>📉 Stochastic RSI</div><div style={{padding:"7px 10px",borderRadius:6,background:zone==="neutral"?"#1a1500":zone==="oversold"?"#0f2a1a":"#2a0f0f",border:`1px solid ${zoneColor}40`,color:zoneColor,fontWeight:600}}>Stoch RSI = <b>{value}</b> — {zone==="oversold"?"oversold 🟢":zone==="overbought"?"overbought 🔴":"neutralno"}</div></HelpTooltip>;
}
function WilliamsRHelp({value}:{value:number}) {
  const display=+(100-value).toFixed(1);
  const zone=display<20?"oversold":display>80?"overbought":"neutral";
  const zoneColor=zone==="oversold"?"#4ade80":zone==="overbought"?"#f87171":"#facc15";
  return <HelpTooltip><div style={{fontWeight:700,color:"#e2e8f0",marginBottom:8,fontSize:12}}>📊 Williams %R</div><div style={{padding:"7px 10px",borderRadius:6,background:zone==="neutral"?"#1a1500":zone==="oversold"?"#0f2a1a":"#2a0f0f",border:`1px solid ${zoneColor}40`,color:zoneColor,fontWeight:600}}>W%R = <b>{value>0?`-${value}`:value}</b> — {zone==="oversold"?"oversold 🟢":zone==="overbought"?"overbought 🔴":"neutralno"}</div></HelpTooltip>;
}
function OBVHelp({score}:{score:number}) {
  const bull=score>60,bear=score<40,color=bull?"#4ade80":bear?"#f87171":"#facc15";
  return <HelpTooltip><div style={{fontWeight:700,color:"#e2e8f0",marginBottom:8,fontSize:12}}>📈 OBV Signal</div><div style={{padding:"7px 10px",borderRadius:6,background:bull?"#0f2a1a":bear?"#2a0f0f":"#1a1500",border:`1px solid ${color}40`,color,fontWeight:600}}>{bull?"📈 Bullish":bear?"📉 Bearish":"➡️ Neutralno"} ({score})</div></HelpTooltip>;
}
function VolumenHelp({score}:{score:number}) {
  const color=score>60?"#4ade80":score<40?"#f87171":"#facc15";
  return <HelpTooltip><div style={{fontWeight:700,color:"#e2e8f0",marginBottom:8,fontSize:12}}>📊 Volumen skor</div><div style={{padding:"7px 10px",borderRadius:6,background:score>60?"#0f2a1a":score<40?"#2a0f0f":"#1a1500",border:`1px solid ${color}40`,color,fontWeight:600}}>{score.toFixed(0)} — {score>60?"visoka aktivnost":score<40?"nizak interes":"normalno"}</div></HelpTooltip>;
}
function MomentumHelp({chg24,chg7}:{chg24:number;chg7:number}) {
  const score24=Math.min(100,Math.max(0,50+chg24*2));
  const color=chg24>=5?"#4ade80":chg24<=-5?"#f87171":"#facc15";
  return <HelpTooltip><div style={{fontWeight:700,color:"#e2e8f0",marginBottom:8,fontSize:12}}>⚡ Momentum</div><div style={{background:"#060d18",borderRadius:7,padding:"8px 10px",marginBottom:8,border:"1px solid #1e2d3d"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{color:"#94a3b8"}}>24h</span><span style={{color:chg24>=0?"#4ade80":"#f87171",fontWeight:700}}>{chg24>=0?"+":""}{chg24.toFixed(2)}%</span></div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#94a3b8"}}>7d</span><span style={{color:chg7>=0?"#4ade80":"#f87171",fontWeight:700}}>{chg7>=0?"+":""}{chg7.toFixed(2)}%</span></div></div><div style={{padding:"7px 10px",borderRadius:6,background:score24>60?"#0f2a1a":score24<40?"#2a0f0f":"#1a1500",border:`1px solid ${color}40`,color,fontWeight:600}}>{chg24>=5?"🚀 Jak bullish":chg24<=-5?"📉 Jak bearish":"➡️ Umjeren"}</div></HelpTooltip>;
}
function TokenSentimentHelp({score,label,breakdown}:{score:number;label:string;breakdown:[string,number,string][]}) {
  const color=score>=70?"#4ade80":score>=55?"#86efac":score>=45?"#facc15":score>=30?"#fca5a5":"#f87171";
  return <HelpTooltip><div style={{fontWeight:700,color:"#e2e8f0",marginBottom:8,fontSize:12}}>🧠 Token Sentiment</div>{breakdown.map(([lbl,val,c])=><div key={lbl} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{color:"#94a3b8"}}>{lbl}</span><span style={{color:c,fontWeight:700}}>{val}</span></div>)}<div style={{padding:"7px 10px",borderRadius:6,background:score>=55?"#0f2a1a":score<=45?"#2a0f0f":"#1a1500",border:`1px solid ${color}40`,color,fontWeight:600,marginTop:6}}>{score} — {label}</div></HelpTooltip>;
}
function ATHHelp({pctFromATH,pctFromATL,athScore}:{pctFromATH:number|null;pctFromATL:number|null;athScore:number}) {
  const color=athScore>60?"#4ade80":athScore<40?"#f87171":"#facc15";
  return <HelpTooltip><div style={{fontWeight:700,color:"#e2e8f0",marginBottom:8,fontSize:12}}>📍 ATH/ATL Score</div><div style={{background:"#060d18",borderRadius:7,padding:"8px 10px",marginBottom:8,border:"1px solid #1e2d3d"}}>{pctFromATH!==null&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{color:"#94a3b8"}}>Od ATH</span><span style={{color:"#f87171",fontWeight:700}}>{pctFromATH}%</span></div>}{pctFromATL!==null&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#94a3b8"}}>Od ATL</span><span style={{color:"#4ade80",fontWeight:700}}>+{pctFromATL}%</span></div>}</div><div style={{padding:"7px 10px",borderRadius:6,background:athScore>60?"#0f2a1a":athScore<40?"#2a0f0f":"#1a1500",border:`1px solid ${color}40`,color,fontWeight:600}}>{athScore}/100 — {athScore>60?"blizu dna":athScore<40?"blizu vrha":"srednja pozicija"}</div></HelpTooltip>;
}
function RSIHelp({rsi}:{rsi:number}) {
  const zone=rsi<30?"oversold":rsi>70?"overbought":"neutral";
  const zoneColor=zone==="oversold"?"#4ade80":zone==="overbought"?"#f87171":"#facc15";
  return <HelpTooltip><div style={{fontWeight:700,color:"#e2e8f0",marginBottom:8,fontSize:12}}>📉 RSI (14)</div><div style={{padding:"7px 10px",borderRadius:6,background:zone==="neutral"?"#1a1500":zone==="oversold"?"#0f2a1a":"#2a0f0f",border:`1px solid ${zoneColor}40`,color:zoneColor,fontWeight:600}}>RSI = <b>{rsi}</b> — {zone==="oversold"?"oversold 🟢":zone==="overbought"?"overbought 🔴":"neutralno"}</div></HelpTooltip>;
}
function BollingerHelp({bollPct}:{bollPct:number}) {
  const zone=bollPct<20?"low":bollPct>80?"high":"mid";
  const zoneColor=zone==="low"?"#4ade80":zone==="high"?"#f87171":"#facc15";
  return <HelpTooltip><div style={{fontWeight:700,color:"#e2e8f0",marginBottom:8,fontSize:12}}>📐 Bollinger Bands</div><div style={{padding:"7px 10px",borderRadius:6,background:zone==="mid"?"#1a1500":zone==="low"?"#0f2a1a":"#2a0f0f",border:`1px solid ${zoneColor}40`,color:zoneColor,fontWeight:600}}>{bollPct}% — {zone==="low"?"blizu dna":zone==="high"?"blizu vrha":"unutar kanala"}</div></HelpTooltip>;
}
function MACDHelp({macdBull}:{macdBull:boolean}) {
  return <HelpTooltip><div style={{fontWeight:700,color:"#e2e8f0",marginBottom:8,fontSize:12}}>📊 MACD</div><div style={{padding:"7px 10px",borderRadius:6,background:macdBull?"#0f2a1a":"#2a0f0f",border:`1px solid ${macdBull?"#4ade8040":"#f8717140"}`,color:macdBull?"#4ade80":"#f87171",fontWeight:600}}>{macdBull?"✅ Bullish":"⚠️ Bearish"}</div></HelpTooltip>;
}
function MAHelpButton({ma7,ma30}:{ma7:number;ma30:number}) {
  const bullish=ma7>ma30;
  const fmt=(v:number)=>v>=1000?"$"+v.toLocaleString("en-US",{maximumFractionDigits:0}):v>=1?"$"+v.toFixed(2):"$"+v.toFixed(4);
  return <HelpTooltip><div style={{fontWeight:700,color:"#e2e8f0",marginBottom:8,fontSize:12}}>📊 MA7 vs MA30</div><div style={{background:"#060d18",borderRadius:7,padding:"8px 10px",marginBottom:8,border:"1px solid #1e2d3d"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{color:"#22d3ee"}}>MA7</span><span style={{color:"#e2e8f0",fontWeight:700}}>{fmt(ma7)}</span></div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#a78bfa"}}>MA30</span><span style={{color:"#e2e8f0",fontWeight:700}}>{fmt(ma30)}</span></div></div><div style={{padding:"7px 10px",borderRadius:6,background:bullish?"#0f2a1a":"#2a0f0f",border:`1px solid ${bullish?"#4ade8040":"#f8717140"}`,color:bullish?"#4ade80":"#f87171",fontWeight:600}}>{bullish?"✅ Golden Cross":"⚠️ Death Cross"}</div></HelpTooltip>;
}

// ── PriceChart ─────────────────────────────────────────────────────────────────
function PriceChart({prices,color,symbol,historyPrices,historyVolumes}:{prices:number[];color:string;symbol:string;historyPrices?:number[];historyVolumes?:number[]}) {
  const [tf,setTf]=useState<"24h"|"3d"|"7d"|"30d"|"90d">("7d");
  const [showSignal,setShowSignal]=useState(false);
  const [allRetroSignals,setAllRetroSignals]=useState<{score:number;signal:string;color:string}[]>([]);
  const [sparkSignals,setSparkSignals]=useState<{score:number;signal:string;color:string}[]>([]);
  const [tooltip,setTooltip]=useState<{x:number;y:number;price:number;label:string;retroSignal?:{score:number;signal:string;color:string};crosshairOnly?:boolean}|null>(null);
  const svgRef=useRef<SVGSVGElement>(null);
  const hasHistory=!!(historyPrices&&historyPrices.length>0);

  useEffect(()=>{
    if(!historyPrices||historyPrices.length<20){setAllRetroSignals([]);return;}
    const tid=setTimeout(()=>setAllRetroSignals(buildRetroSignals(historyPrices,historyVolumes)),0);
    return()=>clearTimeout(tid);
  },[historyPrices,historyVolumes]);

  useEffect(()=>{
    if(!showSignal||(tf!=="24h"&&tf!=="3d")||prices.length<20){setSparkSignals([]);return;}
    const tid=setTimeout(()=>setSparkSignals(buildRetroSignals(prices)),0);
    return()=>clearTimeout(tid);
  },[showSignal,tf,prices]);

  const sliced=tf==="90d"?(hasHistory?historyPrices!:prices):tf==="30d"?(hasHistory?historyPrices!.slice(-Math.floor(historyPrices!.length/3)):prices):tf==="24h"?prices.slice(-24):tf==="3d"?prices.slice(-72):prices;

  const retroSignals=useMemo(()=>{
    if(!showSignal)return[];
    if(tf==="24h"||tf==="3d"){
      if(sparkSignals.length===0)return[];
      const start=tf==="24h"?prices.length-24:prices.length-72;
      return sparkSignals.slice(Math.max(0,start));
    }
    if(!hasHistory||!historyPrices||allRetroSignals.length===0)return[];
    const totalLen=historyPrices.length;
    const startIdx=tf==="90d"?0:tf==="30d"?Math.floor(totalLen/3*2):Math.max(0,totalLen-sliced.length);
    return allRetroSignals.slice(startIdx,startIdx+sliced.length);
  },[showSignal,tf,allRetroSignals,sparkSignals,historyPrices,sliced.length,hasHistory,prices]);

  const w=600,h=180;
  const min=Math.min(...sliced),max=Math.max(...sliced),range=max-min||1;
  const getPoint=(i:number)=>({x:(i/(sliced.length-1))*w,y:h-((sliced[i]-min)/range)*(h-20)-10});
  const pts=sliced.map((_,i)=>{const{x,y}=getPoint(i);return`${x},${y}`;}).join(" ");
  const pctChange=(sliced[sliced.length-1]-sliced[0])/sliced[0]*100,up=pctChange>=0;
  const chartColor=up?"#4ade80":"#f87171",id=`chart_${symbol}`;
  const labelCount=5;
  const fmtPt=(v:number)=>v>=1000?"$"+v.toLocaleString("en-US",{maximumFractionDigits:0}):v>=1?"$"+v.toFixed(2):"$"+v.toFixed(4);
  const xLabels=Array.from({length:labelCount},(_,i)=>{
    const idx=Math.round((i/(labelCount-1))*(sliced.length-1));
    const periodsAgo=sliced.length-1-idx;
    if(periodsAgo===0)return"Sad";
    if(tf==="90d")return`-${Math.round(periodsAgo/sliced.length*90)}d`;
    if(tf==="30d")return`-${Math.round(periodsAgo/sliced.length*30)}d`;
    return periodsAgo<24?`-${periodsAgo}h`:`-${Math.round(periodsAgo/24)}d`;
  });

  const handleMouseMove=(e:React.MouseEvent<SVGSVGElement>)=>{
    if(!svgRef.current||sliced.length<2)return;
    const rect=svgRef.current.getBoundingClientRect();
    const rawX=(e.clientX-rect.left)*(w/rect.width);
    const idx=Math.max(0,Math.min(sliced.length-1,Math.round((Math.max(0,Math.min(w,rawX))/w)*(sliced.length-1))));
    const{x,y}=getPoint(idx);
    const periodsAgo=sliced.length-1-idx;
    let label="Sad";
    if(periodsAgo>0){if(tf==="90d")label=`-${Math.round(periodsAgo/sliced.length*90)}d`;else if(tf==="30d")label=`-${Math.round(periodsAgo/sliced.length*30)}d`;else label=periodsAgo<24?`-${periodsAgo}h`:`-${Math.round(periodsAgo/24)}d`;}
    const retroSignal=retroSignals.length>idx?retroSignals[idx]:undefined;
    const validRetro=retroSignal&&retroSignal.signal!=="—";
    const{x:sigX}=getPoint(idx);
    const rawXVal=Math.max(0,Math.min(w,rawX));
    const nearSignal=validRetro&&Math.abs(rawXVal-sigX)<20;
    setTooltip({x,y,price:sliced[idx],label,retroSignal:nearSignal?retroSignal:undefined,crosshairOnly:showSignal&&!nearSignal});
  };

  const tW=148,tH=44;
  return (
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{fontSize:12,color:"#64748b"}}>Kretanje cijene <span style={{marginLeft:8,fontWeight:700,color:chartColor}}>{up?"▲":"▼"} {Math.abs(pctChange).toFixed(2)}%</span></div>
          {hasHistory&&<button onClick={()=>setShowSignal(s=>!s)} style={{background:showSignal?"#0f2a1a":"#0d1f2d",border:`1px solid ${showSignal?"#4ade80":"#1e3a5f"}`,color:showSignal?"#4ade80":"#475569",borderRadius:6,padding:"2px 10px",cursor:"pointer",fontSize:10,fontWeight:showSignal?700:400,transition:"all 0.15s"}}>📊 Tehnički signal</button>}
        </div>
        <div style={{display:"flex",gap:4}}>
          {(["24h","3d","7d","30d","90d"] as const).map(t=>(
            <button key={t} onClick={()=>{setTf(t);setTooltip(null);}} style={{background:tf===t?chartColor:"#0d1f2d",border:`1px solid ${tf===t?chartColor:"#1e3a5f"}`,color:tf===t?"#060d18":"#94a3b8",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:tf===t?700:400,transition:"all 0.15s",opacity:(t==="30d"||t==="90d")&&!hasHistory?0.35:1}}>{t}</button>
          ))}
        </div>
      </div>
      {showSignal&&hasHistory&&<div style={{marginBottom:8,padding:"6px 10px",background:"#060d18",borderRadius:6,border:"1px solid #1e2d3d",fontSize:10,color:"#475569"}}>⚠️ <b style={{color:"#f59e0b"}}>Majority vote signal</b> — ≥65% indikatora mora se složiti za BUY/SELL. Hover za detalje.</div>}
      <div style={{background:"#060d18",borderRadius:10,padding:"12px 8px 4px",border:"1px solid #1e2d3d"}}>
        <svg ref={svgRef} viewBox={`0 0 ${w} ${h+24}`} width="100%" style={{display:"block",overflow:"visible",cursor:"crosshair"}} onMouseMove={handleMouseMove} onMouseLeave={()=>setTooltip(null)}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartColor} stopOpacity="0.25"/><stop offset="100%" stopColor={chartColor} stopOpacity="0"/></linearGradient>
            <clipPath id={`clip_${symbol}`}><rect x="0" y="0" width={w} height={h}/></clipPath>
          </defs>
          {[0.25,0.5,0.75].map(f=><line key={f} x1={0} y1={h-f*(h-20)-10} x2={w} y2={h-f*(h-20)-10} stroke="#1e2d3d" strokeWidth="1" strokeDasharray="4,4"/>)}
          {[0,0.5,1].map(f=>{const val=min+f*range;return<text key={f} x={w-4} y={h-f*(h-20)-6} fill="#475569" fontSize="10" textAnchor="end">{fmtPt(val)}</text>;})}
          {showSignal&&retroSignals.length>0&&sliced.map((_,i)=>{const sig=retroSignals[i];if(!sig||sig.signal==="—")return null;const{x,y}=getPoint(i);return<circle key={i} cx={x} cy={y} r={3} fill={sig.color} opacity={0.8} stroke="#060d18" strokeWidth={0.5}/>;})  }
          <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${id})`} clipPath={`url(#clip_${symbol})`}/>
          <polyline points={pts} fill="none" stroke={chartColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#clip_${symbol})`}/>
          {!tooltip&&(()=>{const lp=pts.split(" ").pop()!.split(",");return<circle cx={lp[0]} cy={lp[1]} r="4" fill={chartColor} stroke="#060d18" strokeWidth="2"/>;})()}
          {xLabels.map((label,i)=><text key={i} x={(i/(labelCount-1))*w} y={h+18} fill="#475569" fontSize="10" textAnchor={i===0?"start":i===labelCount-1?"end":"middle"}>{label}</text>)}
          {tooltip&&(()=>{
            const{x,y,price,label,retroSignal,crosshairOnly}=tooltip;
            const hasRetro=!!retroSignal&&retroSignal.signal!=="—";
            const lineColor=hasRetro&&retroSignal?retroSignal.color:chartColor;
            if(crosshairOnly)return(<><line x1={x} y1={0} x2={x} y2={h} stroke="#475569" strokeWidth="1" strokeDasharray="4,3" opacity="0.3"/><circle cx={x} cy={y} r="3" fill="#475569" opacity="0.4" stroke="#060d18" strokeWidth="1"/></>);
            const tH2=hasRetro?tH+22:tH;
            const tX=x+tW+12>w?x-tW-8:x+8,tY=Math.max(4,Math.min(h-tH2-4,y-tH2/2));
            return(<>
              <line x1={x} y1={0} x2={x} y2={h} stroke={lineColor} strokeWidth="1" strokeDasharray="4,3" opacity="0.6"/>
              <circle cx={x} cy={y} r="9" fill={lineColor} opacity="0.15"/>
              <circle cx={x} cy={y} r="5" fill={lineColor} stroke="#060d18" strokeWidth="2"/>
              <rect x={tX} y={tY} width={tW} height={tH2} rx="7" ry="7" fill="#0d1a2d" stroke={lineColor} strokeWidth="1.2" opacity="0.97"/>
              <text x={tX+tW/2} y={tY+16} fill={lineColor} fontSize="13" fontWeight="700" textAnchor="middle">{fmtPt(price)}</text>
              <text x={tX+tW/2} y={tY+30} fill="#64748b" fontSize="10" textAnchor="middle">{label}</text>
              {hasRetro&&retroSignal&&(<><line x1={tX+8} y1={tY+38} x2={tX+tW-8} y2={tY+38} stroke="#1e2d3d" strokeWidth="1"/><text x={tX+8} y={tY+52} fill="#475569" fontSize="9">Majority vote</text><text x={tX+tW-8} y={tY+52} fill={retroSignal.color} fontSize="9" textAnchor="end" fontWeight="700">{retroSignal.signal} ({retroSignal.score})</text></>)}
            </>);
          })()}
        </svg>
      </div>
    </div>
  );
}

// ── MiniChart ──────────────────────────────────────────────────────────────────
function MiniChart({prices,color}:{prices:number[];color:string}) {
  if(!prices||prices.length<2)return<div style={{height:48}}/>;
  const w=120,h=48,min=Math.min(...prices),max=Math.max(...prices),range=max-min||1;
  const pts=prices.map((p,i)=>`${(i/(prices.length-1))*w},${h-((p-min)/range)*(h-6)-3}`).join(" ");
  const id=color.replace("#","");
  return(
    <svg width={w} height={h} style={{display:"block"}}>
      <defs><linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.35"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#g${id})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
}

// ── ScoreBar ───────────────────────────────────────────────────────────────────
function ScoreBar({label,value,color,helpButton}:{label:string;value:number;color:string;helpButton?:React.ReactNode}) {
  const v=Math.min(100,Math.max(0,value||0));
  return(
    <div style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#aaa",marginBottom:3}}>
        <span style={{display:"flex",alignItems:"center",gap:5}}>{label}{helpButton}</span>
        <span style={{color:v>60?"#4ade80":v<40?"#f87171":"#facc15",fontWeight:600}}>{v.toFixed(0)}</span>
      </div>
      <div style={{background:"#1e2a3a",borderRadius:4,height:6,overflow:"hidden"}}>
        <div style={{width:`${v}%`,height:"100%",background:color,borderRadius:4,transition:"width 0.8s ease"}}/>
      </div>
    </div>
  );
}

// ── TokenSentimentPanel ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TokenSentimentPanel({coin}:{coin:any}) {
  const synth=computeTokenSentiment(coin);
  return(
    <div style={{marginTop:20,padding:16,background:"#060d18",borderRadius:12,border:"1px solid #1e2d3d"}}>
      <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:14}}>🧠 Token Sentiment</div>
      <div style={{display:"flex",alignItems:"center",gap:16,padding:"12px 14px",background:"#0a1422",borderRadius:10,border:`1px solid ${synth.color}30`}}>
        <div style={{textAlign:"center",minWidth:60}}>
          <div style={{fontSize:28,fontWeight:900,color:synth.color}}>{synth.score}</div>
          <div style={{fontSize:9,color:"#475569",marginTop:1}}>/ 100</div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:synth.color,marginBottom:6}}>{synth.label}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{synth.breakdown.map(([label,val,color])=><div key={label} style={{fontSize:10,color:"#64748b"}}><span style={{color,fontWeight:700}}>{val}</span> {label}</div>)}</div>
          <div style={{marginTop:8,background:"#1e2a3a",borderRadius:4,height:4,overflow:"hidden"}}><div style={{width:`${synth.score}%`,height:"100%",background:synth.color,borderRadius:4,transition:"width 0.8s ease"}}/></div>
        </div>
      </div>
    </div>
  );
}

// ── TokenSearch ────────────────────────────────────────────────────────────────
function TokenSearch({onAdd,existingIds}:{onAdd:(r:{id:string;symbol:string;name:string})=>void;existingIds:string[]}) {
  const [query,setQuery]=useState(""),[results,setResults]=useState<{id:string;symbol:string;name:string}[]>([]);
  const [loading,setLoading]=useState(false),[open,setOpen]=useState(false);
  const debounceRef=useRef<ReturnType<typeof setTimeout>|null>(null),wrapRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const handler=(e:MouseEvent)=>{if(wrapRef.current&&!wrapRef.current.contains(e.target as Node))setOpen(false);};
    document.addEventListener("mousedown",handler);return()=>document.removeEventListener("mousedown",handler);
  },[]);
  const handleInput=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const val=e.target.value;setQuery(val);
    if(debounceRef.current)clearTimeout(debounceRef.current);
    if(val.length<2){setResults([]);setOpen(false);return;}
    debounceRef.current=setTimeout(async()=>{
      setLoading(true);
      try{const res=await fetch(`/api/search?q=${encodeURIComponent(val)}`);const data=await res.json();setResults(Array.isArray(data)?data:[]);setOpen(true);}
      catch{setResults([]);}finally{setLoading(false);}
    },350);
  };
  const handleAdd=(token:{id:string;symbol:string;name:string})=>{onAdd(token);setQuery("");setResults([]);setOpen(false);};
  return(
    <div ref={wrapRef} style={{position:"relative",width:"100%",maxWidth:400}}>
      <div style={{display:"flex",alignItems:"center",background:"#0a1422",border:"1px solid #1e3a5f",borderRadius:10,padding:"9px 14px",gap:8}}>
        <span style={{color:"#475569",fontSize:16}}>🔍</span>
        <input value={query} onChange={handleInput} placeholder="Dodaj token... (npr. DOGE, Chainlink)" style={{background:"none",border:"none",outline:"none",color:"#e2e8f0",fontSize:13,flex:1}}/>
        {loading&&<span style={{color:"#475569",fontSize:13}}>⟳</span>}
      </div>
      {open&&results.length>0&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#0d1a2d",border:"1px solid #1e3a5f",borderRadius:10,overflow:"hidden",zIndex:100,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
          {results.map(r=>{
            const already=existingIds.includes(r.id);
            return(
              <div key={r.id} onClick={()=>!already&&handleAdd(r)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",cursor:already?"default":"pointer",borderBottom:"1px solid #1e2d3d",opacity:already?0.4:1}}
                onMouseEnter={e=>{if(!already)(e.currentTarget as HTMLDivElement).style.background="#0a1e35";}}
                onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.background="transparent";}}>
                <div><span style={{fontWeight:700,fontSize:14,color:"#e2e8f0"}}>{r.symbol}</span><span style={{fontSize:12,color:"#64748b",marginLeft:8}}>{r.name}</span></div>
                {already?<span style={{fontSize:11,color:"#475569"}}>Već dodano</span>:<span style={{fontSize:11,color:"#4ade80",background:"#0f2a1a",borderRadius:6,padding:"2px 8px",border:"1px solid #4ade8040"}}>+ Dodaj</span>}
              </div>
            );
          })}
        </div>
      )}
      {open&&results.length===0&&!loading&&query.length>=2&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#0d1a2d",border:"1px solid #1e3a5f",borderRadius:10,padding:"12px 14px",zIndex:100,fontSize:12,color:"#475569"}}>Nema rezultata za &quot;{query}&quot;</div>
      )}
    </div>
  );
}

// ── Home ───────────────────────────────────────────────────────────────────────
export default function Home() {
  const [tokens,setTokens]           = useState<Token[]>(DEFAULT_TOKENS);
  const [initialized,setInit]        = useState(false);
  const [coins,setCoins]             = useState<Record<string,unknown>>({});
  const [fng,setFng]                 = useState<{value:number;label:string}|null>(null);
  const [selected,setSelected]       = useState<string|null>(null);
  const [status,setStatus]           = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [errMsg,setErrMsg]           = useState("");
  const [chartTab,setChartTab]       = useState<"line"|"candle">("line");
  const [showBacktest,setShowBacktest] = useState(false);

  useEffect(()=>{
    try{const saved=localStorage.getItem(LS_KEY);const custom:Token[]=saved?JSON.parse(saved):[];if(custom.length>0)setTokens([...DEFAULT_TOKENS,...custom]);}catch{}
    setInit(true);
  },[]);

  const doFetch=useCallback(async(tokenList:Token[])=>{
    setStatus("loading");setErrMsg("");
    try{
      const ids=tokenList.map(t=>t.cg).join(",");
      const [priceRes,fngRes]=await Promise.all([fetch(`/api/crypto?ids=${ids}&currency=eur`),fetch("/api/fng")]);
      if(!priceRes.ok)throw new Error(`API error ${priceRes.status}`);
      const priceJson=await priceRes.json(),fngJson=await fngRes.json();
      const map:Record<string,unknown>={};
      (priceJson.data||[]).forEach((c:{id:string})=>{const tok=tokenList.find(t=>t.cg===c.id);if(tok)map[tok.cg]=c;});
      setCoins(map);setFng(fngJson);setStatus("ok");
    }catch(e){setErrMsg(e instanceof Error?e.message:"Nepoznata greška");setStatus(prev=>prev==="ok"?"ok":"error");}
  },[]);

  useEffect(()=>{if(!initialized)return;doFetch(tokens);},[initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddToken=async(sr:{id:string;symbol:string;name:string})=>{
    if(tokens.find(t=>t.cg===sr.id))return;
    const nt:Token={symbol:sr.symbol,name:sr.name,color:nextColor(),cg:sr.id,custom:true};
    setTokens(prev=>{const next=[...prev,nt];lsSave(next);return next;});
    try{const res=await fetch(`/api/crypto?ids=${sr.id}`);if(!res.ok)throw new Error();const json=await res.json();if(json.data?.[0])setCoins(prev=>({...prev,[nt.cg]:json.data[0]}));}
    catch(e){console.error("Greška:",e);}
  };

  const handleRemoveToken=(cg:string)=>{
    if(selected===cg)setSelected(null);
    setChartTab("line");
    setTokens(prev=>{const next=prev.filter(t=>t.cg!==cg);lsSave(next);return next;});
    setCoins(prev=>{const n={...prev};delete n[cg];return n;});
  };

  const sel=selected?coins[selected]:null;
  const selMeta=tokens.find(t=>t.cg===selected);
  const{history,loading:extLoading}=useExtendedData(selected);
  const allHistory=useAllHistory(tokens,status==="ok");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selSentiment=sel?computeTokenSentiment(sel as any):null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pred=sel?computePrediction(sel as any,selSentiment!.score,history?.prices,history?.volumes):null;

  if(status==="loading"&&Object.keys(coins).length===0) return(
    <div style={{background:"#060d18",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,color:"#e2e8f0",textAlign:"center",padding:24}}>
      <div style={{fontSize:38}}>⚡</div>
      <div style={{fontSize:18,fontWeight:800,background:"linear-gradient(135deg,#4ade80,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CryptoPulse AI</div>
      <div style={{fontSize:13,color:"#4ade80"}}>Dohvaćam live podatke…</div>
    </div>
  );

  if(status==="error"&&Object.keys(coins).length===0) return(
    <div style={{background:"#060d18",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,color:"#f87171",textAlign:"center",padding:24}}>
      <div style={{fontSize:32}}>⚠️</div>
      <div style={{fontSize:16,fontWeight:700}}>Greška pri dohvaćanju</div>
      <div style={{fontSize:12,color:"#64748b",maxWidth:320}}>{errMsg}</div>
      <button onClick={()=>doFetch(tokens)} style={{marginTop:12,background:"#0d1f2d",border:"1px solid #1e3a5f",color:"#4ade80",borderRadius:8,padding:"8px 18px",cursor:"pointer",fontSize:13}}>↻ Pokušaj ponovo</button>
    </div>
  );

  return(
    <div style={{background:"#060d18",minHeight:"100vh",padding:"20px 16px"}}>
      <div style={{maxWidth:980,margin:"0 auto"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:10}}>
          <div>
            <h1 style={{margin:0,fontSize:24,fontWeight:800,background:"linear-gradient(135deg,#4ade80,#22d3ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>⚡ CryptoPulse AI</h1>
            <p style={{margin:"2px 0 0",fontSize:12,color:"#64748b"}}>Live podaci · CoinGecko + Alternative.me · {tokens.length} tokena</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {status==="ok"&&<button onClick={()=>setShowBacktest(true)} style={{background:"#0a1a2a",border:"1px solid #1e3a5f",borderRadius:8,padding:"5px 12px",color:"#22d3ee",fontSize:12,cursor:"pointer",fontWeight:600}}>📊 Backtest</button>}
            {fng&&(
              <div style={{fontSize:12,background:"#0a1a2a",border:"1px solid #1e3a5f",borderRadius:8,padding:"5px 10px",color:fng.value>60?"#4ade80":fng.value<40?"#f87171":"#facc15",display:"flex",alignItems:"center",gap:6}}>
                Fear & Greed: <b>{fng.value}</b> <span style={{color:"#475569"}}>({fng.label})</span>
                <FNGHelp value={fng.value}/>
              </div>
            )}
          </div>
        </div>

        <div style={{marginBottom:20}}>
          <TokenSearch onAdd={handleAddToken} existingIds={tokens.map(t=>t.cg)}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:14,marginBottom:22}}>
          {tokens.map(t=>{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const c=coins[t.cg] as any;
            if(!c)return(
              <div key={t.cg} style={{background:"#0a1422",border:"1px solid #1e2d3d",borderRadius:14,padding:16,height:130,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{color:"#334155",fontSize:12}}>{t.symbol} — učitavam…</span>
              </div>
            );
            const tokenSentScore=computeTokenSentiment(c).score;
            const tokenHistory=allHistory[t.cg];
            const p=computePrediction(c,tokenSentScore,tokenHistory?.prices,tokenHistory?.volumes);
            const isSel=selected===t.cg;
            const spark:number[]=c.sparkline_in_7d?.price??[];
            return(
              <div key={t.cg} onClick={()=>setSelected(isSel?null:t.cg)}
                style={{background:isSel?"#0a1e35":"#0a1422",border:`1px solid ${isSel?t.color:"#1e2d3d"}`,borderRadius:14,padding:16,cursor:"pointer",transition:"all 0.2s",boxShadow:isSel?`0 0 20px ${t.color}30`:"none",position:"relative"}}>
                {t.custom&&<button onClick={e=>{e.stopPropagation();handleRemoveToken(t.cg);}} style={{position:"absolute",top:8,right:10,background:"none",border:"none",color:"#475569",cursor:"pointer",fontSize:18,lineHeight:1,padding:"0 4px"}}>×</button>}
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:t.color,boxShadow:`0 0 6px ${t.color}`}}/>
                      <span style={{fontWeight:700,fontSize:16}}>{t.symbol}</span>
                      <span style={{fontSize:11,color:"#475569"}}>{t.name}</span>
                    </div>
                    <div style={{fontSize:20,fontWeight:700,marginTop:4}}>{fmtPrice(c.current_price)}</div>
                    <div style={{fontSize:11,color:(c.price_change_percentage_24h||0)>=0?"#4ade80":"#f87171",marginTop:1}}>
                      {(c.price_change_percentage_24h||0)>=0?"▲":"▼"} {Math.abs(c.price_change_percentage_24h||0).toFixed(2)}% 24h
                    </div>
                  </div>
                  <div style={{paddingRight:t.custom?22:0}}/>
                </div>
                <MiniChart prices={spark} color={t.color}/>
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:8,fontSize:11}}>
                  {!allHistory[t.cg]
                    ?<span style={{display:"flex",alignItems:"center",gap:5,color:"#334155"}}><span style={{display:"inline-block",width:10,height:10,border:"2px solid #1e3a5f",borderTopColor:"#22d3ee",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>analiza…</span>
                    :<span style={{display:"flex",alignItems:"center",gap:6}}>
                        {p.isMemeCoin&&<span style={{fontSize:13,color:"#f87171",fontWeight:700,lineHeight:1}} title="Meme coin">⚠️</span>}
                        <span style={{color:sigColor(p.signal),fontWeight:700}}>{p.signal}</span>
                      </span>}
                </div>
              </div>
            );
          })}
        </div>

        {sel&&pred&&selMeta&&selSentiment&&(()=>{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c=sel as any,p=pred;
          const chg24=c.price_change_percentage_24h||0,chg7=c.price_change_percentage_7d_in_currency||0;
          return(
            <>
              <div onClick={()=>{setSelected(null);setChartTab("line");}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,backdropFilter:"blur(4px)"}}/>
              <div className="modal-scroll" style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"min(960px, 95vw)",maxHeight:"90vh",overflowY:"auto",zIndex:201,background:"#0a1422",border:`1px solid ${selMeta.color}50`,borderRadius:16,padding:24,boxShadow:`0 0 60px ${selMeta.color}20, 0 24px 64px rgba(0,0,0,0.6)`,scrollbarWidth:"thin",scrollbarColor:"#1e3a5f #060d18"}}>

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
                  <h2 style={{margin:0,fontSize:18,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{width:12,height:12,borderRadius:"50%",background:selMeta.color,boxShadow:`0 0 8px ${selMeta.color}`,display:"inline-block"}}/>
                    {selMeta.name} — Live Analiza
                  </h2>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{textAlign:"center",padding:"10px 14px",background:"#060d18",borderRadius:10,border:`1px solid ${p.finalScore>60?"#4ade80":p.finalScore<40?"#f87171":"#facc15"}40`}}>
                      <div style={{fontSize:10,color:"#64748b",marginBottom:2}}>AI Composite Score</div>
                      <div style={{fontSize:26,fontWeight:900,color:p.finalScore>60?"#4ade80":p.finalScore<40?"#f87171":"#facc15",lineHeight:1}}>{p.finalScore.toFixed(0)}</div>
                      <div style={{fontSize:11,color:sigColor(p.signal),fontWeight:700,marginTop:2}}>{p.signal}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:11,color:"#64748b"}}>Predviđena cijena (7d)</div>
                      <div style={{fontSize:24,fontWeight:800,color:p.pct>=0?"#4ade80":"#f87171"}}>{fmtPrice(p.predicted7d)}</div>
                      <div style={{fontSize:12,color:p.pct>=0?"#4ade80":"#f87171"}}>{p.pct>=0?"+":""}{p.pct.toFixed(2)}%</div>
                    </div>
                    <button onClick={()=>{setSelected(null);setChartTab("line");}} style={{background:"#0d1f2d",border:"1px solid #1e3a5f",color:"#94a3b8",borderRadius:8,width:36,height:36,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
                  </div>
                </div>

                {/* Majority vote breakdown */}
                <div style={{marginBottom:16,padding:"10px 14px",background:"#060d18",borderRadius:8,border:"1px solid #1e2d3d",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  <div style={{fontSize:11,color:"#475569"}}>🗳️ Majority vote</div>
                  <div style={{display:"flex",gap:8,flex:1,flexWrap:"wrap"}}>
                    <div style={{fontSize:11}}><span style={{color:"#4ade80",fontWeight:700}}>{Math.round(p.bullPct*100)}%</span> <span style={{color:"#475569"}}>bullish glasova</span></div>
                    <div style={{fontSize:11}}><span style={{color:"#f87171",fontWeight:700}}>{Math.round(p.bearPct*100)}%</span> <span style={{color:"#475569"}}>bearish glasova</span></div>
                    <div style={{fontSize:11,color:"#475569"}}>Prag za signal: ≥55%</div>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,color:sigColor(p.signal)}}>{p.signal}</div>
                </div>

                <div style={{marginBottom:20}}>
                  <div style={{display:"flex",gap:6,marginBottom:10}}>
                    {(["line","candle"] as const).map(tab=>(
                      <button key={tab} onClick={()=>setChartTab(tab)} style={{background:chartTab===tab?"#1e3a5f":"#0d1f2d",border:`1px solid ${chartTab===tab?"#22d3ee":"#1e3a5f"}`,color:chartTab===tab?"#22d3ee":"#475569",borderRadius:7,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:chartTab===tab?700:400,transition:"all 0.15s"}}>
                        {tab==="line"?"📈 Linijski":"🕯️ Svjećnjaci"}
                      </button>
                    ))}
                  </div>
                  {chartTab==="line"
                    ?<PriceChart prices={c.sparkline_in_7d?.price??[]} color={selMeta.color} symbol={selMeta.cg} historyPrices={history?.prices} historyVolumes={history?.volumes}/>
                    :<CandlestickChart cgId={selMeta.cg} color={selMeta.color}/>}
                </div>

                {p.isMemeCoin&&(
                  <div style={{marginBottom:16,padding:"10px 14px",background:"#1a0a0a",borderRadius:8,fontSize:11,color:"#f87171",borderLeft:"3px solid #f87171"}}>
                    ⚠️ <strong>Meme coin upozorenje:</strong> Visok Vol/MCap omjer ({c.market_cap?((c.total_volume/c.market_cap)*100).toFixed(0):"-"}%). AI score korigiran, signal downgradeан.
                  </div>
                )}

                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:20}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:"#22d3ee",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>💬 Sentiment</div>
                    <ScoreBar label="Token Sentiment" value={selSentiment.score} color={selSentiment.color} helpButton={<TokenSentimentHelp score={selSentiment.score} label={selSentiment.label} breakdown={selSentiment.breakdown}/>}/>
                    <ScoreBar label="Momentum 24h" value={Math.min(100,Math.max(0,50+chg24*2))} color="#a78bfa" helpButton={<MomentumHelp chg24={chg24} chg7={chg7}/>}/>
                    <ScoreBar label="Momentum 7d"  value={Math.min(100,Math.max(0,50+chg7*1.2))} color="#60a5fa"/>
                    <div style={{marginTop:10,fontSize:11,color:"#64748b"}}>
                      24h: <span style={{color:chg24>=0?"#4ade80":"#f87171",fontWeight:700}}>{chg24>=0?"+":""}{chg24.toFixed(2)}%</span>
                      {" · "}
                      7d: <span style={{color:chg7>=0?"#4ade80":"#f87171",fontWeight:700}}>{chg7>=0?"+":""}{chg7.toFixed(2)}%</span>
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:"#f59e0b",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>📊 Volumen</div>
                    <ScoreBar label="Volumen skor" value={p.volScore} color="#f59e0b" helpButton={<VolumenHelp score={p.volScore}/>}/>
                    {([["24h volumen",fmtBig(c.total_volume)],["Market cap",fmtBig(c.market_cap)],["Vol/MCap",c.market_cap?((c.total_volume/c.market_cap)*100).toFixed(2)+"%":"—"],["CMC Rank",c.market_cap_rank?"#"+c.market_cap_rank:"—"]] as [string,string][]).map(([k,v])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#aaa",marginBottom:5}}>
                        <span>{k}</span><span style={{color:"#94a3b8",fontWeight:600}}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:"#a78bfa",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>
                      📈 Tehnika {extLoading&&<span style={{color:"#334155",fontSize:10}}>↻</span>}
                    </div>
                    <ScoreBar label="Tehnički skor" value={p.techScore} color="#a78bfa"/>
                    {([
                      ["RSI (14)",    null,null,<RSIHelp key="rsi" rsi={p.rsi}/>],
                      ["Stoch RSI",  null,null,<StochRSIHelp key="stoch" value={p.stochRSI}/>],
                      ["Williams %R",null,null,<WilliamsRHelp key="wr" value={p.williamsR}/>],
                      ["MACD",       p.macdBull?"Bullish ▲":"Bearish ▼",p.macdBull?"#4ade80":"#f87171",<MACDHelp key="macd" macdBull={p.macdBull}/>],
                      ["MA7 vs MA30",p.ma7>p.ma30?"Golden Cross ▲":"Death Cross ▼",p.ma7>p.ma30?"#4ade80":"#f87171",<MAHelpButton key="ma" ma7={p.ma7} ma30={p.ma30}/>],
                      ["Bollinger",  null,null,<BollingerHelp key="boll" bollPct={p.bollPct}/>],
                    ] as [string,string|null,string|null,React.ReactNode][]).map(([k,v,cl,help])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,color:"#aaa",marginBottom:6}}>
                        <span style={{display:"flex",alignItems:"center",gap:5}}>{k}{help}</span>
                        {k==="RSI (14)"?<ZoneScale value={p.rsi} min={0} max={100} zones={[{from:0,to:30,color:"#4ade80",label:"Oversold"},{from:30,to:70,color:"#facc15",label:"Neutral"},{from:70,to:100,color:"#f87171",label:"Overbought"}]}/>
                        :k==="Stoch RSI"?<ZoneScale value={p.stochRSI} min={0} max={100} zones={[{from:0,to:20,color:"#4ade80",label:"Oversold"},{from:20,to:80,color:"#facc15",label:"Neutral"},{from:80,to:100,color:"#f87171",label:"Overbought"}]}/>
                        :k==="Williams %R"?<ZoneScale value={100-p.williamsR} min={0} max={100} zones={[{from:0,to:20,color:"#4ade80",label:"Oversold"},{from:20,to:80,color:"#facc15",label:"Neutral"},{from:80,to:100,color:"#f87171",label:"Overbought"}]}/>
                        :k==="Bollinger"?<ZoneScale value={p.bollPct} min={0} max={100} zones={[{from:0,to:20,color:"#4ade80",label:"Dno"},{from:20,to:80,color:"#facc15",label:"Kanal"},{from:80,to:100,color:"#f87171",label:"Vrh"}]}/>
                        :<span style={{color:cl??"#94a3b8",fontWeight:600}}>{v}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {(p.pctFromATH!==null||p.pctFromATL!==null)&&(
                  <div style={{marginTop:20,padding:16,background:"#060d18",borderRadius:12,border:"1px solid #1e2d3d"}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:12,display:"flex",alignItems:"center",gap:5}}>📍 ATH / ATL Pozicija<ATHHelp pctFromATH={p.pctFromATH} pctFromATL={p.pctFromATL} athScore={p.athScore}/></div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                      <div style={{background:"#0a1422",borderRadius:8,padding:"10px 12px",border:"1px solid #1e2d3d"}}>
                        <div style={{fontSize:10,color:"#475569",marginBottom:4}}>Od All-Time High</div>
                        <div style={{fontSize:18,fontWeight:800,color:"#f87171"}}>{p.pctFromATH}%</div>
                        <div style={{fontSize:10,color:"#334155",marginTop:2}}>{fmtPrice(c.ath)}</div>
                      </div>
                      <div style={{background:"#0a1422",borderRadius:8,padding:"10px 12px",border:"1px solid #1e2d3d"}}>
                        <div style={{fontSize:10,color:"#475569",marginBottom:4}}>Od All-Time Low</div>
                        <div style={{fontSize:18,fontWeight:800,color:"#4ade80"}}>+{p.pctFromATL}%</div>
                        <div style={{fontSize:10,color:"#334155",marginTop:2}}>{fmtPrice(c.atl)}</div>
                      </div>
                    </div>
                    <div style={{marginTop:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#475569",marginBottom:4}}>
                        <span>ATL {fmtPrice(c.atl)}</span><span>Trenutno {fmtPrice(c.current_price)}</span><span>ATH {fmtPrice(c.ath)}</span>
                      </div>
                      <div style={{background:"#1e2a3a",borderRadius:4,height:6,overflow:"hidden"}}>
                        <div style={{width:`${Math.min(100,Math.max(2,(c.current_price-c.atl)/(c.ath-c.atl)*100))}%`,height:"100%",background:"linear-gradient(90deg,#4ade80,#facc15,#f87171)",borderRadius:4}}/>
                      </div>
                    </div>
                    <div style={{marginTop:8,fontSize:11,color:"#475569",textAlign:"center"}}>
                      ATH/ATL Score: <b style={{color:p.athScore>60?"#4ade80":p.athScore<40?"#f87171":"#facc15"}}>{p.athScore}/100</b>
                    </div>
                  </div>
                )}

                <div style={{marginTop:12,padding:"10px 14px",background:"#060d18",borderRadius:10,border:"1px solid #1e2d3d",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:11,color:"#475569",display:"flex",alignItems:"center",gap:5}}>OBV Signal<OBVHelp score={p.obvScore}/></span>
                  <span style={{fontSize:12,fontWeight:700,color:p.obvScore>60?"#4ade80":p.obvScore<40?"#f87171":"#facc15"}}>
                    {p.obvScore>60?"📈 Bullish":p.obvScore<40?"📉 Bearish":"➡️ Neutralno"} <span style={{color:"#334155"}}>({p.obvScore})</span>
                  </span>
                </div>

                <div style={{marginTop:12,padding:16,background:"#060d18",borderRadius:12,border:"1px solid #1e2d3d"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>🗳️ Majority Vote Score</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
                    {([
                      ["🧠 Token Sent.", selSentiment.score, selSentiment.color],
                      ["📊 Vol+OBV",     p.volScore,         "#f59e0b"],
                      ["📈 Tehnika",     p.techScore,        "#a78bfa"],
                      ["⚡ Momentum",    p.momScore,         "#4ade80"],
                      ["📍 ATH/ATL",     p.athScore,         "#fb923c"],
                    ] as [string,number,string][]).map(([label,val,color])=>(
                      <div key={label} style={{flex:1,minWidth:90,background:"#0a1422",borderRadius:8,padding:"10px 12px",border:`1px solid ${color}30`}}>
                        <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{label}</div>
                        <div style={{fontSize:20,fontWeight:800,color}}>{(+val).toFixed(0)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginBottom:10,padding:"8px 12px",background:"#0a1422",borderRadius:8,border:"1px solid #1e2d3d"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <div style={{flex:1,height:8,borderRadius:4,background:"#1e2a3a",overflow:"hidden",position:"relative"}}>
                        <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${Math.round(p.bullPct*100)}%`,background:"#4ade80",borderRadius:4}}/>
                        <div style={{position:"absolute",right:0,top:0,height:"100%",width:`${Math.round(p.bearPct*100)}%`,background:"#f87171",borderRadius:4}}/>
                      </div>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#475569"}}>
                      <span>🟢 Bull: <b style={{color:"#4ade80"}}>{Math.round(p.bullPct*100)}%</b></span>
                      <span style={{color:sigColor(p.signal),fontWeight:700}}>{p.signal} (prag ≥55%)</span>
                      <span>Bear: <b style={{color:"#f87171"}}>{Math.round(p.bearPct*100)}%</b> 🔴</span>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:16}}>
                    <div style={{flex:1}}>
                      <div style={{background:"#1e2a3a",borderRadius:8,height:12,overflow:"hidden"}}>
                        <div style={{width:`${p.finalScore}%`,height:"100%",background:"linear-gradient(90deg,#4ade80,#22d3ee)",borderRadius:8,transition:"width 1s ease"}}/>
                      </div>
                    </div>
                    <div style={{fontSize:30,fontWeight:900,color:p.finalScore>60?"#4ade80":p.finalScore<40?"#f87171":"#facc15"}}>
                      {p.finalScore.toFixed(0)}<span style={{fontSize:13,color:"#475569"}}>/100</span>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:15,fontWeight:700,color:sigColor(p.signal)}}>{p.signal}</div>
                      <div style={{fontSize:11,color:"#475569"}}>Pouzdanost: {p.confidence}%</div>
                    </div>
                  </div>
                </div>

                <TokenSentimentPanel coin={c}/>

                <div style={{marginTop:12,padding:"10px 14px",background:"#0d1a2a",borderRadius:8,fontSize:11,color:"#64748b",borderLeft:"3px solid #f59e0b"}}>
                  ⚠️ <strong style={{color:"#f59e0b"}}>Upozorenje:</strong> Edukativni alat. Nije financijski savjet.
                </div>
              </div>
            </>
          );
        })()}

        {showBacktest&&(
          <BacktestModal
            tokens={tokens}
            allHistory={allHistory}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            coins={coins as Record<string,any>}
            onClose={()=>setShowBacktest(false)}
          />
        )}

        {!selected&&status==="ok"&&(
          <div style={{textAlign:"center",color:"#475569",fontSize:13,padding:"12px 0"}}>↑ Klikni na token za detaljnu live analizu</div>
        )}
        <div style={{marginTop:16,textAlign:"center",fontSize:10,color:"#1e2d3d"}}>CoinGecko Public API · Alternative.me FNG · Server-side cache · Majority Vote Engine</div>
      </div>
    </div>
  );
}