# Aura · Spotify Themes

Your music. Your atmosphere.

A lightweight Chrome Manifest V3 extension for **https://open.spotify.com**. Everything lives in this folder. No build step, account, API token, production dependencies, analytics, or external theme servers.

## Install in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select this **spotify theme** folder (the folder containing `manifest.json`). If using the ZIP, extract it first.
4. Open or refresh [Spotify Web Player](https://open.spotify.com).
5. Pin **Aura** from Chrome’s extensions menu and open it to choose your atmosphere.

No `npm install` or build command is needed. The extension works in Chrome and Chromium-based browsers with Manifest V3 support. It does not theme the native Spotify desktop/mobile app.

## Inside Aura

- **Six bundled scenes:** Sakura dreams and Midnight in Tokyo (original anime-inspired landscapes), Forest daydream, Ocean drive, Golden hour, and Soft graphite.
- **Instant themes:** choose a card to apply across open Spotify tabs. Choosing a theme enables Aura and resets the custom wallpaper and accent to that preset. Darkness and layout preferences are preserved.
- **Studio:** custom accent, background darkness, or your own JPG/PNG/WebP wallpaper. Images stay local and are resized to at most 1600 pixels before saving.
- **Focus mode:** hide Spotify’s right sidebar while keeping the library and player.
- **Compact tracklists:** fit more tracks on screen.
- **Less motion:** minimize interface transitions and animations.
- **Sleep timer:** pause all open Spotify web tabs after 15, 30, 45, or 60 minutes. It survives closing the popup and browser restart. Chrome must be running; a sleeping device handles overdue alarms when it wakes. It does not control Spotify in other applications or other devices.
- **Player controls:** previous, play/pause, and next on a connected web player. If several tabs are open, prefer a playing tab, then the most recently used available player.
- **Master switch:** remove all Aura styling without losing your saved choices. This switch controls appearance; an already running sleep timer remains active until cancelled.

Changes save automatically on this device. Keyboard users can use arrow keys, Home, and End to move between tabs. The popup also respects the operating system’s reduced-motion preference.

## Privacy and permissions

`storage` saves settings and the optional resized wallpaper in `chrome.storage.local`. `alarms` runs the sleep timer. Host access is limited to `https://open.spotify.com/*`, where bundled CSS changes the appearance and content scripts operate the visible player controls. Aura does not read login tokens, connect to Spotify’s API, send network requests, or collect listening history. Track text is read only when you open the popup and is never saved.

## Performance

Plain JavaScript and CSS, static local SVG artwork, and no background animation. Themes apply with a handful of root attributes and CSS variables. No DOM observers, continuous page scans, or timers run in the Spotify content script. The service worker sleeps except for Chrome events. Player status updates every five seconds only while the popup’s extras panel is visible.

## Development and verification

Requires Node 18+ only for checks:

```sh
npm test
npm run check
```

`tests/` verifies input validation, manifest resources and permission boundaries, and the timer service-worker lifecycle with mocked Chrome APIs. The extension itself needs no Node runtime.

Optional browser checks use Playwright as a development-only tool (`npm install --no-save playwright`, then `npm run test:browser`; set `CHROMIUM_PATH` to an existing Chromium executable, or install a Playwright browser). They exercise the popup and the real content script on a local Spotify-shaped fixture. They do not require a Spotify account. Installation and real Spotify playback still need a manual check in a browser that permits unpacked extensions.

To preview the interface, open `popup.html` in Chrome. Outside an installed extension it explicitly shows **Design preview** and saves preview choices in local browser storage; player and timer actions are disabled. For full functionality load the unpacked extension.

For a manual acceptance check: choose each theme in Spotify, navigate to an album and playlist, upload a wallpaper, reopen the popup, toggle compact/focus/motion, disable Aura, then re-enable. Start and cancel a timer, and verify a timer actually pauses a playing web tab. Check a non-English Spotify UI if you use one: Spotify’s button labels and DOM can vary between versions and locales.

## Compatibility

Spotify changes its private page markup frequently. Player actions and sidebar/tracklist selectors are isolated in `content.js` and `content.css` for easy maintenance. If Aura reports “Refresh Spotify once,” reload a web-player tab opened before installing or reloading the extension. Theme artwork is original bundled vector scenery, rather than licensed anime characters.

No logged-in Spotify account is included with this project; final compatibility with the user’s current Spotify layout should be checked on their account before publishing to the Chrome Web Store. Store publication also requires listing assets and a privacy policy.
