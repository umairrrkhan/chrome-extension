# Verification · 19 October 2026

## Passed

- `npm test`: ten tests passed. Covers corrupted input, appearance persistence, the twelve themes and their resources, corner-character preference migration and theme scoping, least-privilege access, font preference migration and validation, combined theme search/filter behavior, timer creation/cancellation, sender validation, pausing all tabs despite closed-tab errors, and restoring overdue alarms after browser restart.
- `npm run check`: all four production JavaScript files pass syntax checks.
- `npm run test:browser` with local Chromium and Playwright: all twelve themes, Anime/Waifu filters, character image loading, search, empty results and recovery, Surprise me, theme persistence, six font options, font persistence across theme changes and popup reload, custom accents, background darkness, image upload/removal, focus/compact/motion settings, appearance reset, and keyboard tab navigation pass.
- The same browser test executes the actual content script against a Spotify-shaped HTML fixture: initial theme, live storage changes, CSS application, serif/monospace font changes, restoration of the original font and layout when disabled, track status, and idempotent pause commands pass. No browser page errors.
- Character checks pass: actual cutout image loads, only one character element exists after switching themes, clicks pass through, the character stays above the bottom player, short windows hide it, and disabling the feature or switching to a non-character theme removes it. The popup character toggle and its saved state also pass.

## Still requires a manual check

This environment's managed Chromium policy blocks unpacked extension installation (`ExtensionInstallBlocklist: ["*"]`). Policies were not modified. The browser UI tests therefore exercise ordinary locally fulfilled pages and a mocked Chrome bridge rather than an installed extension. The timer tests use mocked Chrome APIs. No real Spotify account or audio playback was used.

Load the folder in a personal Chrome profile that permits unpacked extensions, refresh Spotify, and verify the current Spotify layout, playback controls, uploaded wallpaper, and alarm expiry against a live account. Spotify's markup and localized player labels can change, so fixture checks do not establish full compatibility with every layout or language.
