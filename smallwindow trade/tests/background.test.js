import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
const local = {},
  session = {};
let handler, calls, fail, responseStatus;
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
    local: { get: async () => structuredClone(local) },
    session: {
      get: async (key) => ({ [key]: structuredClone(session[key]) }),
      set: async (value) => Object.assign(session, structuredClone(value)),
    },
  },
};
const bars = (price) => ({
  values: [
    { datetime: "2026-10-19", close: String(price) },
    { datetime: "2026-10-18", close: "100" },
  ],
});
await import("../background.js");
const sender = { id: "test", url: "chrome-extension://test/app.html#overlay" };
const request = (symbol = "AAPL") =>
  new Promise((resolve) => handler({ type: "quote", symbol }, sender, resolve));
const cache = () => Object.values(session)[0];
beforeEach(() => {
  Object.keys(session).forEach((key) => delete session[key]);
  local.settings = {
    mode: "live",
    symbols: [{ symbol: "AAPL", market: "US stocks" }],
    interval: "1day",
    refresh: 120,
  };
  local.apiKey = "test-key";
  calls = 0;
  fail = false;
  responseStatus = 200;
  globalThis.fetch = async () => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (fail) throw new Error("Failed to fetch");
    return {
      ok: responseStatus === 200,
      status: responseStatus,
      json: async () => bars(120),
    };
  };
});
test("concurrent views share requests; appearance changes preserve cached prices", async () => {
  const [a, b] = await Promise.all([request(), request()]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  local.settings.theme = "light";
  local.settings.compact = true;
  assert.equal((await request()).data.price, 120);
  assert.equal(calls, 1);
});
test("failed refresh retains labeled stale prices and backs off repeated requests", async () => {
  await request();
  cache().fetchedAt = 0;
  fail = true;
  const stale = await request();
  assert.equal(stale.data.stale, true);
  assert.equal(stale.data.price, 120);
  assert.match(stale.data.error, /connection/);
  await request();
  assert.equal(calls, 2);
  cache().retryAt = 0;
  fail = false;
  const recovered = await request();
  assert.equal(recovered.data.stale, undefined);
  assert.equal(calls, 3);
});
test("rate-limit failures without previous prices also back off", async () => {
  responseStatus = 429;
  assert.match((await request()).error, /limit/);
  await request();
  assert.equal(calls, 1);
  cache().retryAt = 0;
  responseStatus = 200;
  assert.equal((await request()).data.price, 120);
  assert.equal(calls, 2);
});
test("changing provider keys never reuses another account's cached prices", async () => {
  await request();
  local.apiKey = "second-key";
  await request();
  assert.equal(calls, 2);
  assert.equal(Object.keys(session).length, 2);
  assert.ok(
    Object.keys(session).every(
      (key) => !key.includes("test-key") && !key.includes("second-key"),
    ),
  );
});
test("switching keys while a request is pending isolates old and new responses", async () => {
  const waiting = [];
  globalThis.fetch = async () => {
    calls++;
    return new Promise((resolve) =>
      waiting.push((price) =>
        resolve({ ok: true, json: async () => bars(price) }),
      ),
    );
  };
  const first = request();
  while (waiting.length < 1)
    await new Promise((resolve) => setTimeout(resolve, 1));
  local.apiKey = "new-account";
  const second = request();
  while (waiting.length < 2)
    await new Promise((resolve) => setTimeout(resolve, 1));
  waiting[1](240);
  assert.equal((await second).data.price, 240);
  waiting[0](120);
  assert.equal((await first).data.price, 120);
  assert.equal((await request()).data.price, 240);
  assert.equal(calls, 2);
});
test("missing keys, unlisted symbols, and non-app senders cannot request prices", async () => {
  assert.match((await request("OTHER")).error, /watchlist/);
  local.apiKey = "";
  assert.match((await request()).error, /API key/);
  assert.equal(calls, 0);
  for (const source of [
    { id: "external", url: sender.url },
    { id: "test", url: "chrome-extension://test/app.html.fake" },
  ]) {
    assert.equal(
      handler({ type: "quote", symbol: "AAPL" }, source, () =>
        assert.fail("untrusted reply"),
      ),
      undefined,
    );
  }
});
