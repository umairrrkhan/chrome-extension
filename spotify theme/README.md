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

- **Twelve bundled themes:** Violet muse (anime girl), Moonlight waifu, Sakura dreams, Midnight in Tokyo, Forest daydream, Ocean drive, Golden hour, Soft graphite, Neon afterglow, Stargazer, Matcha morning, and Rose quartz. Character wallpapers are original illustrations made for Aura.
- **Corner characters:** Violet muse and Moonlight waifu each show an actual transparent anime character near the bottom-right of Spotify, above the playback bar. They use quiet scene backgrounds so the small character is the focus. Characters stay still and let clicks pass through. Studio’s **Corner character** switch hides them; switching to another theme or disabling Aura removes them. They hide on short windows and fullscreen views. There are no character animations, sounds, or tracking.
- **Find your mood:** browse All moods, Anime, Waifu, Aesthetic, or Minimal; search by name, mood, or description. Anime includes the two character themes and the two anime-inspired landscapes. Waifu shows the two character themes. **Surprise me** chooses within your current search and filter and avoids repeating the selected theme when alternatives exist.
- **Instant themes:** choose a card to apply across open Spotify tabs. Choosing a theme enables Aura and resets the custom wallpaper and accent to that preset. Your font, darkness, and layout preferences are preserved.
- **Font styles:** Studio includes Spotify original, Clean modern, Soft rounded, Editorial, Terminal, and Bookish. Preview each style on your theme title; the selected style applies to Spotify text and stays selected across themes and popup sessions. These use fonts installed on your device with sensible fallbacks; appearance varies by operating system. Spotify original restores Spotify’s own font, and the master switch also removes font overrides.
- **Studio:** custom accent, background darkness, or your own JPG/PNG/WebP wallpaper. Images stay local and are resized to at most 1600 pixels before saving.
- **Focus mode:** hide Spotify’s right sidebar while keeping the library and player.
- **Compact tracklists:** fit more tracks on screen.
- **Less motion:** minimize interface transitions and animations.
- **Sleep timer:** pause all open Spotify web tabs after 15, 30, 45, or 60 minutes. It survives closing the popup and browser restart. Chrome must be running; a sleeping device handles overdue alarms when it wakes. It does not control Spotify in other applications or other devices.
- **Player controls:** previous, play/pause, and next on a connected web player. If several tabs are open, prefer a playing tab, then the most recently used available player.
- **Master switch:** remove all Aura styling without losing your saved choices. This switch controls appearance; an already running sleep timer remains active until cancelled.
- **Sponsor Aura:** the small Sponsor link in the header opens [your creator’s support page](https://umair.sbs/pay/) in a new tab. Support is optional; all extension features remain available.

Changes save automatically on this device. Keyboard users can use arrow keys, Home, and End to move between tabs. The popup also respects the operating system’s reduced-motion preference.

The sponsor page opens only when you click Sponsor. Aura does not load payment scripts or contact that site in the background.

## Privacy and permissions

`storage` saves settings and the optional resized wallpaper in `chrome.storage.local`. `alarms` runs the sleep timer. Host access is limited to `https://open.spotify.com/*`, where bundled CSS changes the appearance and content scripts operate the visible player controls. Aura does not read login tokens, connect to Spotify’s API, send network requests, or collect listening history. Track text is read only when you open the popup and is never saved.

## Performance

Plain JavaScript and CSS, static local artwork, and no background animation. Ten lightweight SVG scenes, two WebP character illustrations, and two transparent character cutouts are bundled. The corner characters total about 87 KB; theme thumbnails total about 49 KB. Theme cards load lazily. Character themes use bundled scene backgrounds with a single small character image above the player. Fonts never require a network download. Themes apply with a handful of root attributes and CSS variables. No DOM observers, continuous page scans, or timers run in the Spotify content script. The service worker sleeps except for Chrome events. Player status updates every five seconds only while the popup’s extras panel is visible.

The popup uses a compact theme preview and direct controls, without a decorative mock player or large promotional heading.

## Development and verification

Requires Node 18+ only for checks:

```sh
npm test
npm run check
```

`tests/` verifies input validation, manifest resources and permission boundaries, and the timer service-worker lifecycle with mocked Chrome APIs. The extension itself needs no Node runtime.

Optional browser checks use Playwright as a development-only tool (`npm install --no-save playwright`, then `npm run test:browser`; set `CHROMIUM_PATH` to an existing Chromium executable, or install a Playwright browser). They exercise the popup and the real content script on a local Spotify-shaped fixture. They do not require a Spotify account. Installation and real Spotify playback still need a manual check in a browser that permits unpacked extensions.

To preview the interface, open `popup.html` in Chrome. Outside an installed extension it explicitly shows **Design preview** and saves preview choices in local browser storage; player and timer actions are disabled. For full functionality load the unpacked extension.

For a manual acceptance check: choose each theme in Spotify, navigate to an album and playlist, upload a wallpaper, pick a font in Studio, switch themes, reopen the popup, and confirm the font persists. Restore Spotify original, toggle compact/focus/motion, disable Aura, then re-enable. Start and cancel a timer, and verify a timer actually pauses a playing web tab. Check a non-English Spotify UI if you use one: Spotify’s button labels and DOM can vary between versions and locales.

## Compatibility

Spotify changes its private page markup frequently. Player actions and sidebar/tracklist selectors are isolated in `content.js` and `content.css` for easy maintenance. If Aura reports “Refresh Spotify once,” reload a web-player tab opened before installing or reloading the extension. Artwork is original bundled scenery and generated anime character illustrations, rather than existing franchise characters. See `assets/README.md` for asset details.

No logged-in Spotify account is included with this project; final compatibility with the user’s current Spotify layout should be checked on their account before publishing to the Chrome Web Store. Store publication also requires listing assets and a privacy policy.
