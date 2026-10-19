import test from "node:test";
import assert from "node:assert/strict";
import { cleanSettings, parseSeries, chartPath, demoSeries } from "../core.js";
test("watchlist validation bounds inputs and repairs corrupt settings", () => {
  assert.equal(cleanSettings(null).symbols.length, 3);
  assert.equal(cleanSettings({ symbols: [] }).symbols.length, 3);
  assert.equal(cleanSettings({ refresh: 0, mode: "anything" }).refresh, 120);
  assert.deepEqual(
    cleanSettings({ symbols: [{ symbol: "<script>" }, { symbol: "aapl" }] })
      .symbols,
    [{ symbol: "AAPL", market: "Custom" }],
  );
  assert.equal(
    cleanSettings({ symbols: Array(8).fill({ symbol: "MSFT" }) }).symbols
      .length,
    3,
  );
});
test("provider bars become chronological data and period performance", () => {
  const d = parseSeries(
    {
      meta: { currency: "USD" },
      values: [
        { datetime: "2026-10-19", close: "120" },
        { datetime: "2026-10-18", close: "100" },
      ],
    },
    "AAPL",
  );
  assert.equal(d.price, 120);
  assert.ok(Math.abs(d.change - 20) < 1e-10);
  assert.equal(d.points[0].value, 100);
});
test("provider errors and malformed prices never masquerade as data", () => {
  assert.throws(
    () => parseSeries({ status: "error", message: "API limit" }, "AAPL"),
    /API limit/,
  );
  assert.throws(
    () => parseSeries({ values: [{ close: "0" }, { close: "bad" }] }, "AAPL"),
    /invalid prices/,
  );
});
test("flat charts remain finite, demo prices are explicitly marked", () => {
  assert.ok(!/NaN|Infinity/.test(chartPath([{ value: 5 }, { value: 5 }])));
  assert.equal(demoSeries("AAPL").demo, true);
  assert.equal(demoSeries("AAPL").points.length, 48);
});
