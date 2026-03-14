// Globalni CoinGecko queue — dijele ga sve API routes
// Max 1 poziv / 5s = ~12 poziva/min (konzervativno, Vercel multi-instance safe)

const THROTTLE_MS = 5000; // povećano s 3500 → manje šanse za 429
let lastCall = 0;
let running = false;
const queue: Array<() => Promise<void>> = [];

async function runQueue() {
  if (running) return;
  running = true;
  while (queue.length > 0) {
    const task = queue.shift()!;
    const wait = THROTTLE_MS - (Date.now() - lastCall);
    if (wait > 0) await new Promise(res => setTimeout(res, wait));
    lastCall = Date.now();
    await task();
  }
  running = false;
}

export function cgFetch(
  url: string,
  headers: Record<string, string> = {}
): Promise<Response> {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        const res = await fetch(url, { headers });
        // Ako je 429, čekamo dulje i ubacujemo natrag u red — bez rekurzije u routeu
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 10000)); // 10s cooldown
          // Vraćamo 429 dalje — route NE smije ponovo zvati GET(), samo propagira error
          resolve(res);
          return;
        }
        resolve(res);
      } catch (e) {
        reject(e);
      }
    });
    runQueue();
  });
}