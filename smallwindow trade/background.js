import { cleanSettings, parseSeries } from "./core.js";
const pending = new Map();
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
  await syncAuto();
});
async function syncAuto() {
  const granted = await chrome.permissions.contains({
    origins: ["http://*/*", "https://*/*"],
  });
  await chrome.scripting
    .unregisterContentScripts({ ids: ["smallwindow-auto"] })
    .catch(() => {});
  if (granted)
    await chrome.scripting.registerContentScripts([
      {
        id: "smallwindow-auto",
        matches: ["http://*/*", "https://*/*"],
        js: ["overlay.js"],
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    ]);
}
chrome.permissions.onAdded.addListener(syncAuto);
chrome.permissions.onRemoved.addListener(syncAuto);
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const appURL = chrome.runtime.getURL("app.html");
  if (
    sender.id !== chrome.runtime.id ||
    sender.url?.split(/[?#]/)[0] !== appURL
  )
    return;
  if (msg?.type === "quote") {
    getQuote(msg.symbol)
      .then((data) => reply({ data }))
      .catch((e) => reply({ error: e.message }));
    return true;
  }
});
async function cacheScope(key) {
  // Isolate prices and pending requests when the user changes provider accounts.
  // Store only a hash, never the API key, in the temporary price cache.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
function cachedResult(saved) {
  if (saved.error) {
    if (saved.points) return { ...saved, stale: true };
    throw new Error(saved.error);
  }
  return saved;
}
async function getQuote(symbol) {
  const raw = await chrome.storage.local.get(["settings", "apiKey"]);
  const settings = cleanSettings(raw.settings);
  if (settings.mode !== "live") throw new Error("Live data is turned off.");
  if (!settings.symbols.some((x) => x.symbol === symbol))
    throw new Error("Symbol is not in your watchlist.");
  if (!raw.apiKey) throw new Error("Add your Twelve Data API key in settings.");
  const cacheKey = `quote:${await cacheScope(raw.apiKey)}:${symbol}:${settings.interval}`;
  const saved = (await chrome.storage.session.get(cacheKey))[cacheKey];
  if (saved?.retryAt > Date.now()) return cachedResult(saved);
  if (
    saved &&
    !saved.error &&
    Date.now() - saved.fetchedAt < settings.refresh * 1000
  )
    return saved;
  if (pending.has(cacheKey)) return pending.get(cacheKey);
  const task = (async () => {
    const url = new URL("https://api.twelvedata.com/time_series");
    url.search = new URLSearchParams({
      symbol,
      interval: settings.interval,
      outputsize: "48",
      apikey: raw.apiKey,
    }).toString();
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Provider request limit reached. Retrying after a short pause."
            : `Provider unavailable (${response.status}). Try again later.`,
        );
      const data = {
        ...parseSeries(await response.json(), symbol),
        fetchedAt: Date.now(),
      };
      await chrome.storage.session.set({ [cacheKey]: data });
      return data;
    } catch (e) {
      const error =
        e.name === "TimeoutError"
          ? "Provider timed out. Try again."
          : e.message === "Failed to fetch"
            ? "Unable to reach the provider. Check your connection."
            : e.message;
      // Cache failures too: reopening a view must not hammer an unavailable or rate-limited provider.
      const failed = {
        ...(saved?.points ? saved : {}),
        error,
        retryAt: Date.now() + Math.max(60, settings.refresh) * 1000,
      };
      await chrome.storage.session.set({ [cacheKey]: failed });
      return cachedResult(failed);
    }
  })().finally(() => pending.delete(cacheKey));
  pending.set(cacheKey, task);
  return task;
}
