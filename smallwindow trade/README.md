# Smallwindow Trade

A lightweight Chrome extension that keeps one to three market charts in a movable window while you browse. Built with plain JavaScript, CSS, and SVG; no runtime libraries, build step, account server, analytics, or remote scripts.

## Install

1. Download and unzip the release, or clone this repository.
2. Open `chrome://extensions` in Chrome 120 or later.
3. Turn on **Developer mode**, choose **Load unpacked**, and select the **smallwindow trade** folder containing `manifest.json`.
4. Pin **Smallwindow Trade** using Chrome’s Extensions menu beside the address bar.
5. Open a normal website, click the extension, and select **Float on this page**.

The toolbar popup sits below the address/bookmarks area. The floating window sits inside the current webpage; Chrome extensions cannot draw over Chrome’s toolbar itself. Drag the top handle to move it, or focus the handle and use the arrow keys. Minimize, expand, and close with the window controls. Minimize shrinks the entire frame; the window stays within the visible viewport when resized. Each tab has its own window.

## Customize

Use **Settings** to pick one to three symbols, market presets, bar interval (1 minute, 5 minutes, 1 hour, or 1 day), refresh frequency (1, 2, or 5 minutes), dark/light theme, and compact cards. Symbol inputs offer suggestions for the selected market. New cards start with an unused symbol. Use **Pause / Resume** to stop and restart refreshing without closing the window. Symbols, preferences, and the API key are saved locally. Changes propagate to open windows. Compact mode hides charts to reduce the window height.

**Show automatically on websites** is optional. Chrome asks for access to websites; once granted, newly loaded HTTP/HTTPS pages display the window automatically. Turn it off to revoke access. Existing windows remain until closed or their page reloads. By default, the extension only gets access to the current page when you click **Float on this page**.

Chrome internal pages, the Chrome Web Store, some managed browser policies, and some website frame restrictions prevent overlays. Use the toolbar popup there. Automatic display does not work on `file://` pages.

## Market data

The extension starts in **Demo** mode. Sample prices are deterministic illustrations and are explicitly labeled; they are never presented as live prices.

For market prices:

1. Get an API key from https://twelvedata.com/apikey.
2. Choose **Twelve Data · market data** in Settings, enter the key, and save.
3. Enter symbols supported by your plan, such as `AAPL`, `MSFT`, `EUR/USD`, or `BTC/USD`. Exchange-qualified symbols can use the provider’s `SYMBOL:EXCHANGE` syntax. Market presets are starting points; selecting a market changes the symbol rather than acting as a market-wide feed.

Coverage, real-time access, exchange entitlements, delays, request credits, and daily limits depend on the Twelve Data plan. An API key alone does not guarantee real-time data for every exchange. The chart displays up to 48 provider bars; price is the close of the newest returned bar. Percentage change is across the displayed chart, **not daily performance**. The exchange timezone, latest bar timestamp, and fetch time are shown. Daily intervals may show the last daily close; select a smaller interval for intraday tracking.

Each uncached symbol consumes one time-series request per refresh: three symbols at the default two-minute interval use about 1.5 requests/minute while visible. Manual refresh respects the cache. Requests from open extension views share a session cache and in-flight requests. Refresh stops when a view is hidden, minimized, or showing Settings. Live requests time out after 12 seconds. Failed requests are held for at least the refresh interval (minimum one minute) so reopening the popup cannot repeatedly hit a failing or rate-limited provider. Changing themes or compact mode keeps cached prices. Changing API keys uses a separate cache, including when older requests are still pending. Offline views stop provider polling and resume when the connection returns. If the provider fails, previously cached prices remain explicitly labeled **Stale**; otherwise, an error is shown. Demo prices never replace failed market requests.

This version provides market monitoring. It does not connect to brokers, place orders, or manage funds.

## Privacy and permissions

- `storage`: local settings/API key and a temporary session price cache. No Chrome Sync.
- `activeTab` and `scripting`: mount the floating window on the page you choose.
- `https://api.twelvedata.com/*`: fetch market data only in provider mode. Symbols, interval, and API key are sent to Twelve Data over HTTPS.
- Optional HTTP/HTTPS site access: display the overlay automatically if enabled.

No bookmarks, browsing history, page content, brokerage credentials, or account balances are collected. The overlay lives in a separate extension iframe inside a closed shadow root. Page content scripts cannot read local extension storage. The key is stored as local Chrome extension data, not encrypted by this application; use your own key and do not distribute it with the extension. Website scripts remain responsible for their own page content.

## Development and verification

No build is needed. Edit files and click **Reload** in `chrome://extensions`; refresh open webpages to replace existing windows.

Run the dependency-free unit tests with Node 20+:

```sh
cd "smallwindow trade"
npm test
```

The tests cover provider-account isolation and pending-request races, failure backoff/recovery, settings validation, provider response parsing, finite SVG charts, demo labels, request deduplication/cache, stale results, missing keys, and message/symbol restrictions. Browser checks cover rendering, editing, persistence, input validation, pause/resume, preset suggestions, actual frame collapse, small-viewport fitting, overlay mounting, and close controls.

To repeat browser checks, install Playwright in a separate development directory, install its Chromium browser, then run `npm run test:browser` with `PLAYWRIGHT_MODULE` pointing to that Playwright module. Optionally set `CHROMIUM_PATH` to an existing Chromium executable. Screenshots are written to the system temporary directory. Runtime installation needs no npm packages.

The implementation was checked in Chromium as a local web preview with separate mocked service-worker tests. This development environment’s administrator policy prohibits loading unpacked extensions, so actual installed-extension injection, Chrome permission prompts, and live provider access still require manual verification in a browser that allows extensions and with a valid API key.

Manual release checks:

- Load unpacked; open a regular HTTPS site; float, drag, minimize, expand, and close.
- Save one, two, and three symbols; reload the popup and verify persistence.
- Enable automatic display, accept permissions, reload a website, and verify the overlay. Disable and verify a newly loaded site has no overlay.
- Add a valid API key and supported symbols; check latest provider timestamps. Try an invalid symbol, a disconnected network, and a rate-limited key.
- Switch tabs/minimize; confirm network polling stops for that view.

## Package

To regenerate the installable ZIP from the current source, run `python3 scripts/package.py` from this directory. The script uses only the Python standard library and includes only runtime files, icons, and this README. It checks that manifest resources exist and validates the ZIP. The result is `dist/smallwindow-trade.zip`.

### 1.0.1

- Fixed minimized windows leaving a large empty iframe and windows extending off-screen.
- Added Pause / Resume and market-specific symbol suggestions, with unused symbols for new cards.
- Preserved data caches for appearance changes; isolated caches and pending requests by provider key.
- Added failure cooldown, automatic reconnect handling, and robust ordering/validation of provider bars.

## Sponsor

Want to support continued development? Use **Sponsor me** in the popup or floating window to open https://umair.sbs/pay/ in a new tab. Sponsorship is optional and all extension features remain available.

### 1.0.2

- Added an optional sponsorship link in the popup and floating-window footer.

### 1.0.3

- Renamed the footer link to **Sponsor me** and kept the popup footer visible at the bottom while scrolling. Clicking it opens the payment page; visitors choose whether to contribute there.
