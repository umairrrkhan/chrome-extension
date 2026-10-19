const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const http = require("http"),
  fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
const root = path.resolve(__dirname, "..");
const scratch = path.join(require("os").tmpdir(), "smallwindow-trade-preview");
fs.mkdirSync(scratch, { recursive: true });
const server = http.createServer((req, res) => {
  let file = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!file.startsWith(root)) return res.end();
  if (req.url === "/site") {
    res.setHeader("Content-Type", "text/html");
    return res.end("<html><body><h1>A regular website</h1></body></html>");
  }
  try {
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "text/javascript"
        : file.endsWith(".css")
          ? "text/css"
          : "text/html",
    );
    res.end(fs.readFileSync(file));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 900 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("404"))
        errors.push(m.text());
    });
    await page.goto(base + "/app.html");
    await page.waitForSelector(".card");
    assert.equal(await page.locator(".card").count(), 3);
    await page.screenshot({ path: path.join(scratch, "watchlist.png") });
    await page.click("#pause");
    assert.equal(
      await page.locator("#pause").getAttribute("aria-pressed"),
      "true",
    );
    assert.ok(await page.locator("#refresh").isDisabled());
    assert.match(await page.locator("#footer-status").innerText(), /Paused/);
    await page.click("#pause");
    await page.click("#settings-tab");
    await page.selectOption("#theme", "light");
    await page.locator(".editor button").last().click();
    await page.click("button[type=submit]");
    assert.equal(await page.locator(".card").count(), 2);
    assert.ok(
      (await page.locator("body").getAttribute("class")).includes("light"),
    );
    await page.reload();
    await page.waitForSelector(".card");
    assert.equal(await page.locator(".card").count(), 2);
    await page.click("#collapse");
    assert.ok(await page.locator("#expanded").isHidden());
    await page.click("#expand");
    await page.click("#settings-tab");
    await page.selectOption("#mode", "live");
    await page.click("button[type=submit]");
    assert.match(await page.locator("#save-status").innerText(), /API key/);
    await page.selectOption("#mode", "demo");
    await page.fill(".editor input >> nth=0", "<bad>");
    await page.click("button[type=submit]");
    assert.match(
      await page.locator("#save-status").innerText(),
      /valid provider/,
    );
    await page.fill(".editor input >> nth=0", "AAPL");
    await page.click("#add-symbol");
    const symbols = await page
      .locator(".editor input")
      .evaluateAll((inputs) => inputs.map((input) => input.value));
    assert.equal(new Set(symbols).size, 3);
    assert.ok((await page.locator("datalist option").count()) > 0);
    await page.locator(".editor select").last().selectOption("Forex");
    assert.equal(
      await page.locator(".editor input").last().inputValue(),
      "EUR/USD",
    );
    await page.click("button[type=submit]");
    assert.equal(await page.locator(".card").count(), 3);
    await page.screenshot({ path: path.join(scratch, "light.png") });
    await page.goto(base + "/site");
    await page.evaluate((base) => {
      window.chrome = {
        runtime: { getURL: (p) => base + "/" + p.replace(/^\//, "") },
      };
    }, base);
    await page.addScriptTag({ path: root + "/overlay.js" });
    await page.waitForSelector("#smallwindow-trade-host"); // The overlay uses a closed shadow root; access its iframe via page.frames().
    await page.waitForTimeout(300);
    const child = page.frames().find((f) => f.url().includes("app.html"));
    assert.ok(child);
    await child.waitForSelector(".card");
    const host = page.locator("#smallwindow-trade-host");
    const expandedHeight = (await host.boundingBox()).height;
    await child.click("#collapse");
    await page.waitForFunction(
      () =>
        document
          .getElementById("smallwindow-trade-host")
          .getBoundingClientRect().height < 220,
    );
    assert.ok((await host.boundingBox()).height < expandedHeight - 100);
    await child.click("#expand");
    await page.waitForFunction(
      () =>
        document
          .getElementById("smallwindow-trade-host")
          .getBoundingClientRect().height > 300,
    );
    await page.setViewportSize({ width: 320, height: 360 });
    await page.waitForFunction(() => {
      const r = document
        .getElementById("smallwindow-trade-host")
        .getBoundingClientRect();
      return (
        r.left >= 0 &&
        r.right <= innerWidth &&
        r.top >= 0 &&
        r.bottom <= innerHeight
      );
    });
    await page.setViewportSize({ width: 390, height: 900 });
    await child.click("#close");
    await page.waitForSelector("#smallwindow-trade-host", {
      state: "detached",
    });
    assert.equal(await page.locator("#smallwindow-trade-host").count(), 0);
    // Exercise provider-mode UI with a fake Chrome API; no API key or external request is needed.
    const live = await browser.newPage();
    live.on("pageerror", (error) => errors.push(error.message));
    await live.addInitScript(() => {
      const local = {
        settings: {
          mode: "live",
          symbols: [{ symbol: "AAPL", market: "US stocks" }],
          refresh: 60,
          interval: "1day",
        },
        apiKey: "test-only",
      };
      window.__requests = 0;
      window.chrome = {
        runtime: {
          id: "test",
          sendMessage: async (message) => {
            if (message.type !== "quote")
              throw new Error("Unexpected cache invalidation");
            window.__requests++;
            return {
              data: {
                symbol: "AAPL",
                currency: "USD",
                exchange: "NASDAQ",
                timezone: "America/New_York",
                time: "2026-10-19",
                price: 120,
                change: 20,
                fetchedAt: Date.now(),
                points: [{ value: 100 }, { value: 120 }],
              },
            };
          },
        },
        storage: {
          local: {
            get: async () => structuredClone(local),
            set: async (value) => Object.assign(local, value),
          },
          onChanged: { addListener() {} },
        },
        permissions: { contains: async () => false },
      };
    });
    await live.goto(base + "/app.html");
    await live.waitForSelector(".card");
    assert.equal(await live.evaluate(() => window.__requests), 1);
    await live.click("#pause");
    await live.evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    assert.equal(await live.evaluate(() => window.__requests), 1);
    await live.click("#pause");
    await live.waitForFunction(() => window.__requests === 2);
    await live.context().setOffline(true);
    await live.waitForFunction(() =>
      document.getElementById("footer-status").textContent.includes("Offline"),
    );
    assert.ok(await live.locator("#refresh").isDisabled());
    const beforeReconnect = await live.evaluate(() => window.__requests);
    await live.context().setOffline(false);
    await live.waitForFunction(
      (before) => window.__requests === before + 1,
      beforeReconnect,
    );
    await live.click("#settings-tab");
    await live.selectOption("#theme", "light");
    await live.click("button[type=submit]");
    await live.waitForFunction(() => document.body.classList.contains("light"));
    assert.ok(await live.locator("#settings-view").isHidden());
    await live.close();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: demo charts, settings, persistence, validation, collapse/expand, symbol suggestions, pause/resume, overlay mount, actual frame collapse, viewport fitting, reconnect, provider settings save, close; no page errors.",
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
