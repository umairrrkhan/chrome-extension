/* Run with npm test. Set CHROMIUM_PATH if using a system Chromium. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const directory = path.resolve(__dirname, '..');
const engine = fs.readFileSync(path.join(directory, 'engine.js'), 'utf8');
const origin = 'http://localhost:8172';
const errors = [];

const fixture = `<!doctype html><html><body style="margin:0;background:#15202b;color:white">
  <input id="composer" aria-label="Compose post"><div id="noise"></div><main style="width:550px;margin:20px">
  ${Array.from({ length: 1000 }, (_, id) => `<article data-testid="tweet" style="min-height:150px;padding:20px;border-bottom:1px solid gray" tabindex="0"><a href="/user/status/${id + 10000}"><time>Today</time></a><p>Post ${id}</p></article>`).join('')}
  </main></body></html>`;

function instrument() {
  window.metrics = { frames: 0, layouts: 0, scans: 0 };
  const request = window.requestAnimationFrame;
  window.requestAnimationFrame = callback => request.call(window, timestamp => {
    window.metrics.frames++;
    callback(timestamp);
  });
  const rect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () {
    window.metrics.layouts++;
    return rect.call(this);
  };
  const query = document.querySelectorAll;
  document.querySelectorAll = function (...args) {
    window.metrics.scans++;
    return query.apply(this, args);
  };
}

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 80)));
}

async function targetPost(page, locator = page.locator('article').first()) {
  await locator.hover();
  await page.locator('#tpd-world .target').click();
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    args: ['--no-sandbox']
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await context.route(`${origin}/**`, route => {
      const filename = new URL(route.request().url()).pathname.slice(1);
      if (filename === 'fixture') return route.fulfill({ contentType: 'text/html', body: fixture });
      return route.fulfill({ path: path.join(directory, filename) });
    });

    const demo = await context.newPage();
    await demo.goto(`${origin}/demo.html`);
    for (const weapon of ['rpg', 'hammer', 'laser']) {
      await demo.locator(`[data-weapon="${weapon}"]`).click();
      await targetPost(demo);
      await demo.waitForFunction(() => !window.PostDestroyer.getState().busy);
      assert.equal(await demo.locator('[data-tpd-hidden]').count(), 1, weapon);
      assert.equal(await demo.locator('#count').textContent(), '01');
      await demo.locator('#tpd-world #undo').click();
      assert.equal(await demo.locator('[data-tpd-hidden]').count(), 0);
    }
    await demo.keyboard.press('2');
    assert.equal(await demo.locator('[data-weapon="hammer"]').getAttribute('aria-pressed'), 'true');
    await demo.locator('#tpd-world #menu').click();
    await demo.locator('#tpd-world #pause').click();
    await demo.locator('article').first().hover();
    assert.equal(await demo.locator('#tpd-world .target').isVisible(), false);
    await demo.locator('#tpd-world #menu').click();
    await demo.locator('#tpd-world #pause').click();
    await demo.setViewportSize({ width: 390, height: 844 });
    assert.equal(await demo.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await targetPost(demo);
    await demo.waitForFunction(() => !window.PostDestroyer.getState().busy);
    await demo.locator('#reset').click();
    assert.equal(await demo.locator('[data-tpd-hidden]').count(), 0);
    await demo.setViewportSize({ width: 1280, height: 900 });
    await demo.mouse.move(1, 1);
    await demo.waitForFunction(() => document.querySelector('#tpd-world').shadowRoot.querySelector('.toast').hidden);
    await demo.screenshot({ path: path.join(directory, 'test-results', 'playground.png'), fullPage: true });

    const feed = await context.newPage();
    await feed.addInitScript(instrument);
    await feed.goto(`${origin}/fixture`);
    await feed.addScriptTag({ content: engine });
    await settle(feed);
    const before = await feed.evaluate(() => ({ ...window.metrics }));
    await feed.waitForTimeout(400);
    const idle = await feed.evaluate(() => ({ ...window.metrics }));
    assert.equal(idle.frames - before.frames, 0, 'idle must not run a JS animation loop');
    assert.equal(idle.layouts - before.layouts, 0, 'idle must not measure posts');
    const canvas = await feed.locator('#tpd-world canvas').evaluate(el => ({ width: el.width, height: el.height }));
    assert.ok(canvas.width * canvas.height <= 40000, 'resting canvas must stay small');
    await feed.locator('article').first().hover();
    await settle(feed);
    const hovering = await feed.evaluate(() => ({ ...window.metrics }));
    await feed.evaluate(() => {
      const post = document.querySelector('article p');
      for (let i = 0; i < 300; i++) {
        post.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
        post.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
      }
      for (let i = 0; i < 100; i++) document.querySelector('#noise').append(document.createElement('span'));
    });
    await settle(feed);
    const after = await feed.evaluate(() => ({ ...window.metrics }));
    assert.equal(after.layouts - hovering.layouts, 0, 'movement inside a post must not cause layouts');
    assert.equal(after.scans - hovering.scans, 0, 'unrelated DOM updates must not rescan the feed');
    assert.equal(await feed.locator('#tpd-world .target').count(), 1, '1000 posts share one target button');
    // Coalesced scroll events do one target measurement per frame, regardless of feed size.
    const scrollBefore = await feed.evaluate(() => window.metrics.layouts);
    await feed.evaluate(() => { for (let i = 0; i < 100; i++) window.dispatchEvent(new Event('scroll')); });
    await settle(feed);
    assert.equal(await feed.evaluate(() => window.metrics.layouts) - scrollBefore, 1);
    await feed.locator('#composer').fill('');
    await feed.keyboard.press('3');
    assert.equal(await feed.evaluate(() => window.PostDestroyer.getState().weapon), 'rpg', 'typing must not change weapons');

    // Reduced motion makes bounded history and virtualization checks immediate.
    await feed.emulateMedia({ reducedMotion: 'reduce' });
    await targetPost(feed);
    assert.equal(await feed.locator('[data-tpd-hidden]').count(), 1);
    await feed.evaluate(() => {
      const hidden = document.querySelector('[data-tpd-hidden]');
      hidden.style.color = 'lime';
      hidden.style.display = 'flex';
      hidden.querySelector('a').href = '/user/status/999999';
    });
    await settle(feed);
    assert.equal(await feed.locator('[data-tpd-hidden]').count(), 0, 'recycled post must be restored');
    assert.equal(await feed.locator('article').first().evaluate(el => el.style.color), 'lime', 'Undo must preserve site style changes');
    assert.equal(await feed.locator('article').first().evaluate(el => el.style.display), 'flex', 'recycling must preserve a later site display change');
    await feed.evaluate(() => {
      const article = document.createElement('article');
      article.dataset.testid = 'tweet';
      article.style.cssText = 'height:160px;display:grid!important';
      article.innerHTML = '<a href="/user/status/77777">New post</a>';
      document.querySelector('main').prepend(article);
    });
    await targetPost(feed);
    await feed.locator('#tpd-world #undo').click();
    assert.equal(await feed.locator('article').first().evaluate(el => el.style.getPropertyPriority('display')), 'important');
    assert.equal(await feed.locator('article').first().evaluate(el => el.style.display), 'grid');
    await feed.evaluate(async () => {
      const root = document.querySelector('#tpd-world').shadowRoot;
      const posts = [...document.querySelectorAll('article')].slice(0, 35);
      for (const post of posts) {
        post.scrollIntoView();
        post.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
        await new Promise(resolve => requestAnimationFrame(resolve));
        root.querySelector('.target').click();
      }
    });
    assert.equal(await feed.locator('[data-tpd-hidden]').count(), 30, 'hidden post retention must be bounded');
    assert.equal(await feed.locator('[data-tpd-placeholder]').count(), 30);
    await feed.evaluate(() => window.PostDestroyer.reset());
    assert.equal(await feed.locator('[data-tpd-hidden]').count(), 0);
    // Destroy removes listeners, observers, DOM, animations, and the public handle.
    await settle(feed);
    await feed.evaluate(() => window.PostDestroyer.destroy());
    await settle(feed);
    const destroyed = await feed.evaluate(() => ({ ...window.metrics }));
    await feed.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('scroll'));
      document.querySelector('article').dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    });
    await settle(feed);
    assert.equal(await feed.locator('#tpd-world').count(), 0);
    assert.equal(await feed.evaluate(() => typeof window.PostDestroyer), 'undefined');
    assert.deepEqual(await feed.evaluate(() => window.metrics), destroyed, 'destroyed engine must not keep working');
    await feed.addScriptTag({ content: engine });
    assert.equal(await feed.locator('#tpd-world').count(), 1, 'engine can be cleanly mounted again');
    await targetPost(feed);
    await feed.evaluate(() => window.PostDestroyer.destroy());
    assert.equal(await feed.locator('[data-tpd-hidden]').count(), 0, 'destroy must restore hidden posts');
    assert.equal(await feed.locator('[data-tpd-placeholder]').count(), 0);
    await feed.emulateMedia({ reducedMotion: 'no-preference' });
    await feed.addScriptTag({ content: engine });
    await targetPost(feed);
    await feed.evaluate(() => window.PostDestroyer.configure({ enabled: false }));
    await settle(feed);
    const paused = await feed.evaluate(() => ({ ...window.metrics }));
    await feed.waitForTimeout(150);
    assert.deepEqual(await feed.evaluate(() => window.metrics), paused, 'pausing mid-attack must stop the JS loop');
    assert.equal(await feed.locator('[data-tpd-hidden]').count(), 0, 'pausing before impact cancels the attack');
    // Simulate the visibility lifecycle deterministically; elapsed attack time is frozen.
    await feed.evaluate(() => window.PostDestroyer.configure({ enabled: true }));
    await targetPost(feed);
    await feed.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const sleeping = await feed.evaluate(() => ({ ...window.metrics }));
    await feed.waitForTimeout(180);
    assert.deepEqual(await feed.evaluate(() => window.metrics), sleeping);
    await feed.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await feed.evaluate(() => window.PostDestroyer.getState().busy), true);
    await feed.waitForFunction(() => !window.PostDestroyer.getState().busy);
    await feed.waitForFunction(() => document.querySelector('#tpd-world').shadowRoot.querySelector('canvas').width === 100);
    const rested = await feed.evaluate(() => ({ ...window.metrics }));
    await feed.waitForTimeout(120);
    assert.deepEqual(await feed.evaluate(() => window.metrics), rested, 'attack loop must stop after returning home');
    await feed.evaluate(() => window.PostDestroyer.destroy());

    const popup = await context.newPage();
    await popup.addInitScript(() => {
      window.chrome = {
        storage: { local: {
          get: async defaults => ({ ...defaults, ...JSON.parse(localStorage.getItem('settings') || '{}') }),
          set: async patch => {
            if (window.failSave) throw Error('Simulated failure');
            localStorage.setItem('settings', JSON.stringify({ ...JSON.parse(localStorage.getItem('settings') || '{}'), ...patch }));
          }
        } },
        tabs: { create: async options => { window.lastOpened = options.url; } },
        runtime: { getURL: filename => `${location.origin}/${filename}` }
      };
    });
    await popup.goto(`${origin}/popup.html`);
    await popup.locator('[data-weapon="laser"]').click();
    await popup.locator('#enabled').click();
    await popup.reload();
    await popup.waitForFunction(() => !document.getElementById('enabled').disabled);
    assert.equal(await popup.locator('#enabled').getAttribute('aria-pressed'), 'false');
    assert.equal(await popup.locator('[data-weapon="laser"]').getAttribute('aria-pressed'), 'true');
    await popup.evaluate(() => { window.failSave = true; });
    await popup.locator('#enabled').click();
    await popup.locator('#error').waitFor({ state: 'visible' });
    assert.equal(await popup.locator('#enabled').getAttribute('aria-pressed'), 'false');
    await popup.locator('#playground').click();
    assert.ok(await popup.evaluate(() => window.lastOpened.endsWith('/demo.html')));
    await popup.locator('#open-x').click();
    assert.equal(await popup.evaluate(() => window.lastOpened), 'https://x.com/home');
    assert.ok(await popup.locator('body').evaluate(el => el.getBoundingClientRect().height <= 600), 'popup must fit Chrome popup height even with an error');
    await popup.locator('body').screenshot({ path: path.join(directory, 'test-results', 'popup.png') });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', idleAnimationCallbacks: idle.frames - before.frames,
      idlePostMeasurements: idle.layouts - before.layouts, movementPostMeasurements: after.layouts - hovering.layouts,
      unrelatedFeedScans: after.scans - hovering.scans, restingCanvas: canvas, fixturePosts: 1000,
      checks: 'three weapons, Undo, pause, shortcuts, typing, mobile, reset, recycling, bounded history, cleanup/remount, popup persistence and save failure' }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
