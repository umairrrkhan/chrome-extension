# Twitter Post Destroyer

Created by **Umair Khan**.

A tiny, procedural stickman that walks, climbs, and clears posts from your view. Three tools: rocket launcher, hammer, and laser. Built as a dependency-free Chrome Manifest V3 extension.

## Install in Chrome

1. Unzip the download.
2. Go to `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the **twitterpostdestroyer** folder containing `manifest.json`.
4. Refresh an open X / Twitter tab. Hover a post and click **⌖ Destroy**.
5. Pin the extension for quick access to its settings and playground.

## Try it first

Open `demo.html` directly in a browser, or use **Try the playground** in the extension popup. No installation or account is required to use the demo.

## Controls

- **1 / 2 / 3:** rocket launcher / hammer / laser (outside text fields).
- **♪:** toggle synthesized sound effects (off initially).
- **Undo:** restore the last hidden post, or use Undo on a post's placeholder.
- **Ⅱ / ▶:** pause or resume target controls and the idle character.
- **Reset feed:** restore all demo posts.

The character walks toward a post, climbs up to it, then uses your selected weapon. Each weapon has a distinct prop and effect. Animations pause in background tabs; reduced-motion preferences skip the travel and destruction animation. Hover controls track scrolling. New posts are detected as X updates the timeline.

## Privacy and behavior

Everything runs locally. The extension makes no network requests, has no analytics, and cannot delete posts from X. It hides posts only within the current page; refresh restores them. Settings are saved in Chrome's local extension storage. Only X and Twitter receive the content script. Permission: `storage` for preferences; no cookies, credentials, browsing history, or account permissions are used.

X may change its DOM in future. Post detection currently uses `article[data-testid="tweet"]`. Hidden posts are intentionally not saved between page loads; X can also recycle post DOM nodes during navigation.

## Files

- `manifest.json`: extension registration and scoped content script.
- `engine.js`: shadow-DOM controls, canvas character, weapon effects, post handling.
- `popup.html`, `popup.js`: settings and links.
- `demo.html`, `demo.js`, `ui.css`: standalone interactive playground.
- `icons/`: packaged extension icons.

No build step, external scripts, remote fonts, or dependencies.
