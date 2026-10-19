# Twitter Post Destroyer

Created by **Umair Khan**.

A small stickman that walks, climbs, and hides the posts you choose. Rocket launcher, hammer, and laser. A plain JavaScript Chrome Manifest V3 extension with no runtime dependencies, external fonts, or network requests.

## Install

1. Download this repository and keep the `twitterpostdestroyer` folder.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select that folder.
4. Refresh X / Twitter. Hover a post and click **Destroy**.

To update an existing installation, replace the folder, click **Reload** on the extension's card in `chrome://extensions`, and refresh X.

## Playground

Open `demo.html` directly in a browser, or click **Try the playground** in the extension popup. The practice feed needs no installation or account.

## Controls

- Hover or focus a post to reveal its target button.
- Open the small corner menu to choose a tool, toggle sound, or pause.
- **1 / 2 / 3** select the rocket launcher, hammer, or laser outside text fields.
- **Escape** closes the corner menu.
- **Undo** in the corner or below a hidden post restores it.
- **Reset feed** restores all playground posts and clears effects.

Sound starts off. Reduced-motion mode skips travel and destruction effects. Background tabs suspend JavaScript animation and audio. Pausing before impact cancels the attack.

## Lightweight by design

- One shared target button, regardless of timeline length.
- No feed-wide mutation observer, repeated feed scans, or per-post mouse handlers.
- Moving inside a post does not trigger layout measurements. Scroll events are combined into one measurement per frame.
- A 100 × 96 CSS-pixel canvas at rest, with a subtle compositor animation and no JavaScript animation loop.
- A viewport canvas only during an action, with a 2.4-million-pixel budget. It shrinks back after the character returns home.
- Forty short-lived particles per action, and transform/opacity effects without animated blur or brightness filters.
- Up to 30 hidden posts per tab. The oldest is restored when that limit is reached to bound retained DOM and Undo state.
- Each hidden post has a scoped observer to restore it if X reuses the element for another post.
- Cleanup removes listeners, observers, animations, audio, placeholders, and retained post references.

See [VERIFICATION.md](VERIFICATION.md) for measured comparisons and testing limits.

## Privacy

Posts are hidden only in the current page. Nothing is deleted from X; refreshing restores the feed. Preferences live in Chrome's local extension storage. The only permission is `storage`; content scripts run only on `x.com` and `twitter.com`. No analytics, cookies, account credentials, or browsing-history access.

X may change its HTML. Post detection uses `article[data-testid="tweet"]`, and recycling detection uses the post's status link.

## Support development

[Sponsor this project](https://umair.sbs/pay/) to support Umair Khan’s work. The popup and playground include this link; it opens in a new tab only when clicked.

## Development checks

The installed extension needs no build or package installation. Development tests use Playwright:

```sh
npm install
npx playwright install chromium
npm test
```

For a system Chromium, use `CHROMIUM_PATH=/usr/bin/chromium npm test`. Tests use local HTML fixtures and a mocked Chrome storage API; they do not access your X account. Screenshots are written to the ignored `test-results/` folder.
