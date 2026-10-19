import test from "node:test";
import assert from "node:assert/strict";
const local = {
    settings: {
      mode: "live",
      symbols: [{ symbol: "AAPL", market: "US stocks" }],
      interval: "1day",
      refresh: 120,
    },
    apiKey: "test-key",
  },
  session = {};
let handler,
  calls = 0,
  fail = false;
const event = { addListener() {} };
globalThis.chrome = {
  runtime: {
    id: "test",
    getURL: (p) => "chrome-extension://test/" + p,
    onInstalled: event,
    onMessage: {
      addListener(fn) {
        handler = fn;
      },
    },
  },
  permissions: { onAdded: event, onRemoved: event },
  storage: {
    local: { get: async () => local },
    session: {
      get: async (key) => ({ [key]: session[key] }),
      set: async (value) => Object.assign(session, value),
      clear: async () => {
        for (const k of Object.keys(session)) delete session[k];
      },
    },
  },
};
globalThis.fetch = async () => {
  calls++;
  await new Promise((r) => setTimeout(r, 5));
  if (fail) throw new Error("Failed to fetch");
  return {
    ok: true,
    json: async () => ({
      values: [
        { datetime: "2026-10-19", close: "120" },
        { datetime: "2026-10-18", close: "100" },
      ],
    }),
  };
};
await import("../background.js");
const sender = { id: "test", url: "chrome-extension://test/app.html" };
const request = (symbol = "AAPL") =>
  new Promise((resolve) => handler({ type: "quote", symbol }, sender, resolve));
test("background shares concurrent requests, caches, restricts symbols, and labels stale results", async () => {
  const [a, b] = await Promise.all([request(), request()]);
  assert.equal(calls, 1);
  assert.equal(a.data.price, 120);
  assert.deepEqual(a, b);
  await request();
  assert.equal(calls, 1);
  assert.match((await request("OTHER")).error, /watchlist/);
  session["quote:AAPL:1day"].fetchedAt = 0;
  fail = true;
  const stale = await request();
  assert.equal(stale.data.stale, true);
  assert.equal(stale.data.price, 120);
  await chrome.storage.session.clear();
  assert.match((await request()).error, /connection/);
  local.apiKey = "";
  assert.match((await request()).error, /API key/);
  assert.equal(
    handler(
      { type: "quote", symbol: "AAPL" },
      { id: "external", url: "https://example.org" },
      () => assert.fail("untrusted sender received data"),
    ),
    undefined,
  );
});
