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
    await page.click("button[type=submit]");
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
    await child.click("#collapse");
    await page.waitForTimeout(150);
    await child.click("#expand");
    await child.click("#close");
    await page.waitForSelector("#smallwindow-trade-host", {
      state: "detached",
    });
    assert.equal(await page.locator("#smallwindow-trade-host").count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: demo charts, settings, persistence, validation, collapse/expand, overlay mount, iframe controls, close; no page errors.",
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
