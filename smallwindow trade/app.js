import {
  DEFAULTS,
  MARKETS,
  cleanSettings,
  demoSeries,
  chartPath,
} from "./core.js";
const $ = (id) => document.getElementById(id),
  extension = !!globalThis.chrome?.runtime?.id,
  overlay = location.hash === "#overlay";
let settings = { ...DEFAULTS },
  timer,
  busy = false,
  generation = 0,
  collapsed = false,
  latest = [],
  settingsOpen = false;
if (overlay) document.body.classList.add("overlay");
function parentMessage(type, extra = {}) {
  if (overlay) parent.postMessage({ type, ...extra }, "*");
}
new ResizeObserver(() =>
  parentMessage("swt-size", { height: document.documentElement.scrollHeight }),
).observe(document.body);
async function read() {
  if (extension) return chrome.storage.local.get(["settings", "apiKey"]);
  try {
    return JSON.parse(localStorage.getItem("swt") || "{}");
  } catch {
    return {};
  }
}
async function write(value) {
  if (extension) return chrome.storage.local.set(value);
  localStorage.setItem("swt", JSON.stringify({ ...(await read()), ...value }));
}
function apply() {
  document.body.classList.toggle("light", settings.theme === "light");
  document.body.classList.toggle("compact", settings.compact);
  $("mode-badge").textContent = settings.mode === "demo" ? "DEMO" : "PROVIDER";
  $("count").textContent = settings.symbols.length;
  $("range-label").textContent =
    `Up to 48 × ${{ "1min": "1 min", "5min": "5 min", "1h": "1 hour", "1day": "1 day" }[settings.interval]} bars`;
  $("notice").textContent =
    settings.mode === "demo"
      ? "Demo mode · illustrative prices, not market data. Connect Twelve Data in Settings for market prices."
      : "Twelve Data · prices may be delayed by your plan or exchange. Change is over the displayed chart. Monitoring only; no order execution.";
  $("footer-status").textContent =
    settings.mode === "demo"
      ? "Demo workspace"
      : `Refresh · every ${settings.refresh / 60} min`;
}
function element(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function render(results) {
  $("cards").replaceChildren();
  latest = results;
  results.forEach((result, i) => {
    const item = settings.symbols[i];
    if (!item) return;
    const card = element("article", "card");
    const top = element("div", "card-top");
    top.append(
      element("span", "symbol", item.symbol),
      element("span", "market", item.market),
    );
    card.append(top);
    if (result.error && !result.data) {
      card.append(element("p", "error", result.error));
      $("cards").append(card);
      return;
    }
    const d = result.data,
      row = element("div", "quote-row"),
      price = element(
        "div",
        "price",
        new Intl.NumberFormat(undefined, {
          maximumFractionDigits: d.price < 10 ? 5 : 2,
          minimumFractionDigits: 2,
        }).format(d.price),
      );
    price.append(element("span", "currency", d.currency));
    const change = element(
      "span",
      `change ${d.change < 0 ? "negative" : ""}`,
      `${d.change >= 0 ? "+" : ""}${d.change.toFixed(2)}%`,
    );
    change.title = "Change over the displayed chart, not necessarily today";
    row.append(price, change);
    card.append(row);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "chart");
    svg.setAttribute("viewBox", "0 0 300 70");
    svg.setAttribute("role", "img");
    svg.setAttribute(
      "aria-label",
      `${item.symbol} price over ${d.points.length} bars`,
    );
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", chartPath(d.points));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", d.change < 0 ? "var(--red)" : "var(--green)");
    path.setAttribute("stroke-width", "1.7");
    svg.append(path);
    card.append(svg);
    const bottom = element("div", "card-bottom");
    bottom.append(
      element(
        "span",
        "",
        d.demo ? "SAMPLE CHART" : `${d.exchange} · ${d.timezone}`,
      ),
      element("span", "", d.demo ? "Not real prices" : `${d.time}`),
    );
    card.append(bottom);
    if (d.stale) card.append(element("p", "error", `Stale · ${d.error}`));
    else if (!d.demo)
      card.append(
        element(
          "small",
          "",
          `Fetched ${new Date(d.fetchedAt).toLocaleTimeString()} · latest provider bar above`,
        ),
      );
    $("cards").append(card);
  });
  $("mini-ticker").textContent = results
    .map(
      (r, i) =>
        `${settings.symbols[i]?.symbol || ""} ${r.data ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(r.data.price) : "—"}`,
    )
    .join(" · ");
}
async function refresh() {
  if (busy || collapsed || settingsOpen || document.hidden) return;
  busy = true;
  const current = ++generation;
  $("refresh").disabled = true;
  $("refresh").textContent = "↻ Updating";
  try {
    const results = await Promise.all(
      settings.symbols.map(async (item) => {
        if (settings.mode === "demo")
          return { data: demoSeries(item.symbol, settings.interval) };
        if (!extension)
          return {
            error: "Live data works inside the installed Chrome extension.",
          };
        try {
          return (
            (await chrome.runtime.sendMessage({
              type: "quote",
              symbol: item.symbol,
            })) || { error: "Data service unavailable." }
          );
        } catch {
          return { error: "Extension reloaded. Reopen this window." };
        }
      }),
    );
    if (current === generation) render(results);
  } finally {
    busy = false;
    $("refresh").disabled = false;
    $("refresh").textContent = "↻ Refresh";
    if (current !== generation) queueMicrotask(refresh);
  }
}
function schedule() {
  clearInterval(timer);
  if (!document.hidden && !collapsed && !settingsOpen) {
    refresh();
    timer = setInterval(refresh, settings.refresh * 1000);
  }
}
function view(open) {
  settingsOpen = open;
  $("watch-view").hidden = open;
  $("settings-view").hidden = !open;
  $("watch-tab").classList.toggle("active", !open);
  $("settings-tab").classList.toggle("active", open);
  if (open) {
    fillForm();
    clearInterval(timer);
  } else schedule();
}
function editor(item) {
  const row = element("div", "editor"),
    line = element("div", "editor-line"),
    market = element("select"),
    symbol = element("input"),
    remove = element("button", "", "×");
  market.setAttribute("aria-label", "Market");
  Object.keys(MARKETS)
    .concat("Custom")
    .forEach((name) => {
      const option = element("option", "", name);
      option.value = name;
      market.append(option);
    });
  market.value = Object.hasOwn(MARKETS, item.market) ? item.market : "Custom";
  symbol.value = item.symbol;
  symbol.setAttribute("aria-label", "Trading symbol");
  symbol.required = true;
  symbol.maxLength = 40;
  symbol.spellcheck = false;
  remove.type = "button";
  remove.setAttribute("aria-label", "Remove symbol");
  remove.onclick = () => {
    if ($("symbol-editors").children.length > 1) row.remove();
    updateAdd();
  };
  market.onchange = () => {
    if (MARKETS[market.value]) symbol.value = MARKETS[market.value][0];
  };
  line.append(market, symbol, remove);
  row.append(line);
  $("symbol-editors").append(row);
  updateAdd();
}
function updateAdd() {
  $("add-symbol").disabled = $("symbol-editors").children.length >= 3;
  for (const row of $("symbol-editors").children)
    row.querySelector("button").disabled =
      $("symbol-editors").children.length === 1;
}
async function fillForm() {
  $("mode").value = settings.mode;
  $("key-field").hidden = settings.mode === "demo";
  $("api-key").value = (await read()).apiKey || "";
  $("symbol-editors").replaceChildren();
  settings.symbols.forEach(editor);
  $("interval").value = settings.interval;
  $("refresh-rate").value = settings.refresh;
  $("theme").value = settings.theme;
  $("compact").checked = settings.compact;
  $("save-status").textContent = "";
  if (extension)
    $("auto-show").checked = await chrome.permissions.contains({
      origins: ["http://*/*", "https://*/*"],
    });
  else $("auto-show").disabled = true;
}
$("watch-tab").onclick = () => view(false);
$("settings-tab").onclick = () => view(true);
$("refresh").onclick = refresh;
$("mode").onchange = () => {
  $("key-field").hidden = $("mode").value === "demo";
};
$("add-symbol").onclick = () => editor({ symbol: "NVDA", market: "US stocks" });
$("settings-form").onsubmit = async (e) => {
  e.preventDefault();
  const symbols = [...$("symbol-editors").children].map((row) => ({
    market: row.querySelector("select").value,
    symbol: row.querySelector("input").value.trim().toUpperCase(),
  }));
  if (new Set(symbols.map((x) => x.symbol)).size !== symbols.length) {
    $("save-status").textContent = "Choose different symbols for each card.";
    return;
  }
  if (symbols.some((x) => !/^[A-Z0-9:^./ -]{1,40}$/.test(x.symbol))) {
    $("save-status").textContent =
      "Use a valid provider symbol (letters, numbers, colon, slash, dot, or hyphen).";
    return;
  }
  const apiKey = $("api-key").value.trim();
  if ($("mode").value === "live" && !apiKey) {
    $("save-status").textContent = "Add an API key to enable market data.";
    return;
  }
  settings = cleanSettings({
    mode: $("mode").value,
    symbols,
    interval: $("interval").value,
    refresh: $("refresh-rate").value,
    theme: $("theme").value,
    compact: $("compact").checked,
  });
  try {
    await write({ settings, apiKey });
    if (extension) await chrome.runtime.sendMessage({ type: "clear-cache" });
    apply();
    view(false);
  } catch {
    $("save-status").textContent = "Could not save. Please try again.";
  }
};
$("float").onclick = async () => {
  if (!extension) {
    $("float-hint").textContent =
      "Install the extension to float on websites. See README.md.";
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error();
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["overlay.js"],
    });
    window.close();
  } catch {
    $("float-hint").textContent =
      "Open a regular website first. Chrome settings and the Web Store block overlays.";
  }
};
$("auto-show").onchange = async () => {
  if (!extension) return;
  try {
    if ($("auto-show").checked) {
      const ok = await chrome.permissions.request({
        origins: ["http://*/*", "https://*/*"],
      });
      $("auto-show").checked = ok;
      $("save-status").textContent = ok
        ? "Enabled. Reload websites to show your window."
        : "Website access was not granted.";
    } else {
      await chrome.permissions.remove({
        origins: ["http://*/*", "https://*/*"],
      });
      $("save-status").textContent =
        "Automatic display disabled. Existing windows close when the page reloads.";
    }
  } catch {
    $("auto-show").checked = false;
    $("save-status").textContent =
      "Open Settings from the toolbar popup to grant website access.";
  }
};
function collapse(value) {
  collapsed = value;
  $("expanded").hidden = value;
  $("collapsed").hidden = !value;
  $("collapse").hidden = value;
  if (value) clearInterval(timer);
  else schedule();
}
$("collapse").onclick = () => collapse(true);
$("expand").onclick = () => collapse(false);
$("close").onclick = () => {
  if (overlay) parentMessage("swt-close");
  else window.close();
};
document.addEventListener("visibilitychange", schedule);
if (extension) {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === "local" && changes.settings) {
      settings = cleanSettings(changes.settings.newValue);
      generation++;
      apply();
      if (!settingsOpen) schedule();
    }
  });
}
(async () => {
  settings = cleanSettings((await read()).settings);
  apply();
  if (overlay) {
    $("float").hidden = true;
    $("float-hint").textContent =
      "Drag the top handle to move · minimize to keep scrolling";
  }
  schedule();
})();
