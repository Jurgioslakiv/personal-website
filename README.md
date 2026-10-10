# russhamer.com

The site is built from one file: `content/site.json`. Edit it, commit, and the site republishes in about a minute.

## Updating the site

Everything on the homepage comes from `content/site.json`. You can edit it right on GitHub (open the file, click the pencil, then "Commit changes"). Pushing to `main` republishes the site.

- **A timeline item:** find it under `threads` → `items`. `text`, `status`, `when` and `links` are what show in the details panel. `"end": "now"` keeps a bar running to today.
- **"What's new":** edit `whatsNew.items`. Each entry points at a timeline item by its `id`. Update `whatsNew.date` too.
- **"Updated" date** (top right): sets itself to the date of the last change to `content/` or `pages/`.
- **A link you don't have yet:** set `"href": "TODO"`. The button is left off until you fill it in.
- **Italics:** wrap a title in asterisks, like `*Black Mirror*`.
- **Orange dot:** `"lookingForSomeone": true`.
- **A caption over a row of diamonds** (like "Book chapters"): `rowLabels` on the thread, keyed by row number.
- **Newsletter:** once you have a Buttondown account, put your username in `contact.newsletter.username`. The sign-up form appears when it's no longer `TODO`.

Use a hyphen for date ranges, not an en or em dash. The build warns you if one sneaks in.

## Sharing one thing

Send `russhamer.com/precedent` (any item's `id`) rather than `russhamer.com/#precedent`. The first shows that item's own title, text, and image in link previews, then opens it on the homepage. The second always previews as the homepage, because link previews never see what comes after a `#`.

The preview images for the homepage and the strategy page are `assets/og-home.png` and `assets/og-strategy.png`. Their sources are in `og/`.

## Analytics

GoatCounter, which needs no cookie banner. Put your site code (the `xyz` in `xyz.goatcounter.com`) in `analytics.goatcounter`. Besides page views, every item someone opens is counted as an event, like `item/precedent`.

## Essays

They update themselves. Every day the deploy pulls the newest posts from Substack into `essays.json` and shows the latest three. If Substack is down, the last saved list is used.

## Adding an image to an item

1. Put the image in `assets/img/` (for example `assets/img/rocks.jpg`). A 16:10 shape fits best; around 1200 × 750 is plenty.
2. On the item in `site.json`, add `"image": "assets/img/rocks.jpg"` and, if the picture shows something worth describing, `"imageAlt": "A tray of tumbled rocks"`. For a tall image like a book cover, also add `"imageShape": "portrait"` so link previews use a small square card.

Items without an image just don't show the image slot.

## Rerunning the deploy

Actions tab → "Publish site" → "Run workflow". It also runs on every push to `main` and once a day around 7am Eastern.

## Previewing on your computer (optional)

With Node installed, from this folder:

```
node scripts/build.mjs
node scripts/preview.mjs
```

Then open http://localhost:8080.

## What's where

| Path | What it is |
|---|---|
| `content/site.json` | All homepage content |
| `essays.json` | Latest essays from Substack (rewritten daily) |
| `pages/strategy-exercises/index.html` | The strategy exercises page, as plain HTML |
| `pages/404.html` | The not-found page |
| `assets/` | Stylesheet, script, icons, preview images, and `img/` for item images |
| `og/` | Sources for the preview images |
| `scripts/build.mjs` | Builds the site into `_site/` |
| `scripts/fetch-essays.mjs` | Pulls essays from Substack |
| `.github/workflows/publish.yml` | Fetch, build, deploy to GitHub Pages |
| `design-reference/` | The approved designs and the original build handoff |
