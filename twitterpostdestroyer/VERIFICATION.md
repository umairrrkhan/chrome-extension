# Verification — 1.1.0

## Measured comparison

Both engine versions ran in headless Chromium at 1280 × 900 with the same locally supplied 1,000-post fixture, default device pixel ratio, and animations enabled. The earlier engine is commit `9059d4a`.

| Measurement | Earlier engine | 1.1.0 |
| --- | ---: | ---: |
| Idle JavaScript animation callbacks during 400 ms | 25 | 0 |
| Post bounds measurements for 100 pointer moves | 100,000 | 1 |
| Resting canvas backing pixels | 1,152,000 | 9,600 |

The initial hover requires one measurement; repeated moves inside the same post require none. The resting canvas is 120 times smaller in this viewport. These are fixture-specific callback and layout counts, not claims about battery life or frame rate on every device. The resting breathing motion uses a small CSS transform animation.

## Automated checks

Run `npm test` after installing the development dependency and Chromium. `tests/browser.cjs` checks:

- Each weapon's complete animated path, hiding, and Undo.
- Pause/resume, cancellation before impact, keyboard shortcuts, and typing isolation.
- Mobile layout at 390 pixels and reset of the practice feed.
- No idle JavaScript animation loop or post measurements.
- No extra measurements for 300 repeated pointer events inside one post.
- No feed rescan after 100 unrelated DOM changes.
- One shared target control for 1,000 posts.
- A burst of 100 scroll events produces one target measurement.
- Reduced-motion behavior and newly inserted posts.
- Restoration when X-style status links change on a reused element.
- Preservation of existing display priority and later site style changes on Undo.
- A 30-post cap on hidden posts and placeholders.
- Full teardown, restoration, listener cleanup, and mounting again.
- Background visibility suspension and resumption without skipping the action.
- The canvas shrinks and the JavaScript loop stops after the action.
- Popup preference persistence, save-failure rollback, and launch links with mocked Chrome APIs.
- No JavaScript page errors.

## Integration limit

Enterprise policy in this managed Chromium blocks unpacked extension installation. Actual Chrome installation, native extension API integration, and a live signed-in X timeline have not been verified here. No browser policy was changed. Install the provided folder in your own Chrome to check those integrations.
