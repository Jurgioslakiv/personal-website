# russhamer.com

The site is built from one file: `content/site.json`. Edit it, commit, and the site republishes in about a minute.

## Updating the site

Everything on the homepage comes from `content/site.json`. You can edit it right on GitHub (open the file, click the pencil, then "Commit changes"). Pushing to `main` republishes the site.

- **A timeline item:** find it under `threads` → `items`. `text`, `status`, `when` and `links` are what show in the details panel. `"end": "now"` keeps a bar running to today.
- **"What's new":** edit `whatsNew.items`. Each entry points at a timeline item by its `id`. Update `whatsNew.date` too.
- **"Updated" date** (top right): `updated`.
- **A link you don't have yet:** set `"href": "TODO"`. The button is left off until you fill it in.
- **Italics:** wrap a title in asterisks, like `*Black Mirror*`.
- **Orange dot:** `"lookingForSomeone": true`.
- **Newsletter:** once you have a Buttondown account, put your username in `contact.newsletter.username`. The sign-up form appears when it's no longer `TODO`.

Use a hyphen for date ranges, not an en or em dash. The build warns you if one sneaks in.

## Essays

They update themselves. Every day the deploy pulls the newest posts from Substack into `essays.json` and shows the latest three. If Substack is down, the last saved list is used.

## Adding an image to an item

1. Put the image in `assets/img/` (for example `assets/img/rocks.jpg`). A 16:10 shape fits best; around 1200 × 750 is plenty.
2. On the item in `site.json`, add `"image": "assets/img/rocks.jpg"` and, if the picture shows something worth describing, `"imageAlt": "A tray of tumbled rocks"`.

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
| `assets/` | Stylesheet, script, favicon, and `img/` for item images |
| `scripts/build.mjs` | Builds the site into `_site/` |
| `scripts/fetch-essays.mjs` | Pulls essays from Substack |
| `.github/workflows/publish.yml` | Fetch, build, deploy to GitHub Pages |
| `design-reference/` | The approved designs and the original build handoff |
