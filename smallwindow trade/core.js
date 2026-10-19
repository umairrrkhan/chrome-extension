export const DEFAULTS = {
  mode: "demo",
  symbols: [
    { symbol: "AAPL", market: "US stocks" },
    { symbol: "MSFT", market: "US stocks" },
    { symbol: "BTC/USD", market: "Crypto" },
  ],
  interval: "1day",
  refresh: 120,
  theme: "dark",
  compact: false,
};
export const MARKETS = {
  "US stocks": ["AAPL", "MSFT", "NVDA", "TSLA", "SPY"],
  India: ["RELIANCE:NSE", "TCS:NSE", "INFY:NSE"],
  Europe: ["SAP:XETR", "ASML:Euronext"],
  Forex: ["EUR/USD", "GBP/USD", "USD/JPY"],
  Crypto: ["BTC/USD", "ETH/USD", "SOL/USD"],
};
export function cleanSettings(raw = {}) {
  if (!raw || typeof raw !== "object") raw = {};
  const symbols = Array.isArray(raw.symbols)
    ? raw.symbols
        .filter(
          (x) =>
            x &&
            typeof x.symbol === "string" &&
            /^[A-Z0-9:^./ -]{1,40}$/i.test(x.symbol),
        )
        .slice(0, 3)
        .map((x) => ({
          symbol: x.symbol.toUpperCase(),
          market:
            typeof x.market === "string" ? x.market.slice(0, 40) : "Custom",
        }))
    : DEFAULTS.symbols;
  return {
    ...DEFAULTS,
    mode: raw.mode === "live" ? "live" : "demo",
    symbols: symbols.length ? symbols : DEFAULTS.symbols,
    interval: ["1min", "5min", "1h", "1day"].includes(raw.interval)
      ? raw.interval
      : "1day",
    refresh: [60, 120, 300].includes(Number(raw.refresh))
      ? Number(raw.refresh)
      : 120,
    theme: raw.theme === "light" ? "light" : "dark",
    compact: raw.compact === true,
  };
}
export function parseSeries(body, symbol) {
  if (body.status === "error")
    throw new Error(body.message || "Data provider rejected this symbol.");
  if (!Array.isArray(body.values) || body.values.length < 2)
    throw new Error("No chart data available for this symbol.");
  const points = body.values
    .slice()
    .reverse()
    .map((x) => ({ time: x.datetime, value: Number(x.close) }))
    .filter((x) => Number.isFinite(x.value) && x.value > 0);
  if (points.length < 2)
    throw new Error("The provider returned invalid prices.");
  return {
    symbol,
    points,
    currency: body.meta?.currency || "",
    exchange: body.meta?.exchange || body.meta?.type || "Market",
    time: points.at(-1).time,
    timezone: body.meta?.exchange_timezone || "Exchange time",
    price: points.at(-1).value,
    change: 100 * (points.at(-1).value / points[0].value - 1),
  };
}
export function demoSeries(symbol, interval) {
  let seed = [...symbol].reduce((n, c) => n + c.charCodeAt(0), 0);
  const start = symbol.includes("BTC")
    ? 67000
    : symbol.includes("/")
      ? 1.08
      : 100 + (seed % 400);
  let price = start;
  const points = Array.from({ length: 48 }, (_, i) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    price *= 1 + (seed / 4294967296 - 0.46) * 0.009;
    return { time: `Sample ${i + 1}`, value: price };
  });
  return {
    symbol,
    points,
    currency: "USD",
    exchange: "Simulated data",
    time: "Illustrative prices",
    timezone: "",
    price,
    change: 100 * (price / points[0].value - 1),
    demo: true,
  };
}
export function chartPath(points, width = 300, height = 70) {
  const values = points.map((x) => x.value),
    lo = Math.min(...values),
    hi = Math.max(...values),
    range = hi - lo || 1;
  return points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${((i * width) / (points.length - 1)).toFixed(2)},${(height - 5 - ((p.value - lo) / range) * (height - 10)).toFixed(2)}`,
    )
    .join(" ");
}
