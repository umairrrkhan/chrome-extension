# Bundled artwork

All twelve wallpapers ship with Aura and are loaded locally. No remote image URLs or account credentials are required.

- `violet-muse.webp`: original generated anime illustration of an adult woman wearing headphones at a rainy city window.
- `moonlight-waifu.webp`: original generated anime illustration of an adult woman on a moonlit seaside balcony.
- The corresponding `-thumb.webp` files are smaller browser-grid versions. Full wallpapers are about 200 KB each. Character art was generated specifically for this project and does not depict existing franchise characters.
- `sakura.svg`, `midnight.svg`, `forest.svg`, `ocean.svg`, `sunset.svg`, `mono.svg`, `cyberpunk.svg`, `stargazer.svg`, `matcha.svg`, and `rose.svg` are original vector scenery and abstract illustrations.

`core.js` is the source of truth for wallpaper filenames, palette colors, categories, and descriptions. The manifest exposes only bundled SVG/WebP resources to the Spotify web player. Image assets contain no scripts or external resources.
