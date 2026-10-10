# russhamer.com: build handoff

You're building Russ Hamer's personal site from a finished design. The design and all of the copy are settled. Your job is to turn them into a small, fast, static site that Russ can update by editing one data file. Please don't redesign anything or rewrite any copy. If something here seems wrong, ask Russ.

Repo: `Jurgioslakiv/personal-website`. Domain: `russhamer.com` (registered at Squarespace Domains; the old Weebly site is being retired).

## What's in this package

| Path | What it is |
|---|---|
| `content/site.json` | **All content.** Every timeline item, the "What's new" box, the Read and Get sections, and contact details. The site is generated from this file. |
| `design-reference/homepage.dc.html` | The approved homepage design, as built on a design canvas. Treat it as the visual and behavioral source of truth. |
| `design-reference/strategy-exercises.dc.html` | The approved strategy exercises page (copy is final). |
| `design-reference/essays-list-snippet.html` | A working snippet for the auto-updating essay list. |
| `scripts/fetch-essays.mjs` | Pulls the latest essays from Substack's RSS feed into `essays.json`. It's tested against a sample feed but hasn't been run against the live feed yet. |
| `.github/workflows/publish.yml` | A GitHub Pages deploy that runs daily and on push. Extend it to run your build step (see Deploy). |

### Reading the `.dc.html` reference files

They're in a design-canvas component format. Everything inside `<x-dc>` is real HTML with inline CSS. Use those exact values (colors, sizes, spacing, fonts).

- `{{name}}` is a value filled in by the `renderVals()` method in the `<script type="text/x-dc">` block at the bottom.
- `<sc-for list="{{x}}" as="y">` is a loop, and `<sc-if value="{{x}}">` is a conditional.
- The script block holds the timeline math and interaction logic. Port that logic; don't ship the format.
- Ignore `support.js`, `<helmet>` (it's just a `<head>`), `data-props` and `hint-*` attributes.
- Image boxes that say `[image: …]` are placeholders. In production, see Images below.

## Stack and structure

- Plain HTML, CSS and a little vanilla JS. No framework, no CSS framework, no client-side rendering of the main content.
- One small Node build script (no dependencies, or very few) reads `content/site.json` and writes static HTML. Content should be readable with JavaScript off. JS only adds interaction.
- Suggested output:
  ```
  index.html
  strategy-exercises/index.html
  essays.json            (written by scripts/fetch-essays.mjs; commit a seed copy)
  assets/site.css
  assets/site.js
  CNAME                  (russhamer.com)
  404.html
  ```
- Fonts from Google Fonts: **Familjen Grotesk** (400, 500, 700, italic 400) and **DM Mono** (400, 500).

## Visual system (from the reference)

- Page background `#ebebe5`, panel background `#f5f5f1`, text `#1b2232`, secondary text `#43464d`, muted `#5a5d64`, hairlines `#cfcfc7`.
- The "looking for someone" orange is `#e0531f` for dots, and `#b8410e` for status text (passes contrast).
- Thread colors come from `site.json` (`threads[].color`). They were checked for color-blind separation and contrast against the background. Don't change them.
- Content max-width is 1240px with 22px side padding. The strategy page is 860px.
- Name heading: `clamp(56px, 8.4vw, 116px)`, weight 700, letter-spacing -0.04em, set on two lines ("Russ / Hamer"). Tagline under it is "Too curious not to." at `clamp(26px, 3vw, 34px)`, weight 500.

## The homepage, top to bottom

1. Top row: `russhamer.com` on the left, "Updated {site.updated}" on the right (DM Mono, 12px).
2. Name, tagline, and the hint line (`intro.hint`).
3. Legend: a solid bar = "a job", a thin line = "on my own time", a diamond = "something you can read, play or wear", an orange dot = "I'm looking for someone". Then the note "Recent years get more room."
4. **The timeline** (spec below).
5. **Details panel.** It shows "What's new" by default and an item's details after a click.
6. Two columns: **Read** (essays) and **Get** (things to buy or read).
7. Footer (`id="contact"`): `contact.closingLine`, the email large, LinkedIn, and the newsletter sign-up.

## Timeline spec

**Layout.** A 170px column of thread names, then the track. Each thread is a row block, `rows × 52 + 8` px tall, with a hairline on top. Items are absolutely positioned inside the track. An item's `top` is `row × 52 + 2`, and the item box is 46px tall: the label sits on top and a 12px-tall "track" on the bottom holds the mark.

**Time scale.** Recent years get more room. With `now` = today and `start` = `timeline.start`:
```
age  = now - t                (in years)
x(t) = (1 - ln(1 + age/K) / ln(1 + (now - start)/K)) × 100%,   K = timeline.scaleK (1.5)
```
Convert "YYYY-MM" to a fractional year (`YYYY + (MM-1)/12`). `end: "now"` means today. Ticks are at `timeline.ticks`, plus a dashed vertical "now" line at the right edge.

**Marks by `type`:**

| type | mark |
|---|---|
| `job` | 12px-tall bar in the thread color |
| `own-time` | 4px-tall line in the thread color |
| `series` | 12px tall: a 4px center line plus 2px tick marks every 5px, as `linear-gradient(c,c) center / 100% 4px no-repeat, repeating-linear-gradient(90deg, c 0 2px, transparent 2px 5px)` |
| `visits` | one 9px dot per entry in `visits`. Only the first dot is labeled. All dots open the same item. |
| `thing` | an 11px diamond at `date` |

- **Past items** (anything with an `end` before now) use the thread color at 45% alpha (`#RRGGBB73`) and an italic, muted label.
- **Labels.** Bars always show their label. Diamonds show their label only when `alwaysShowLabel` is set, on hover or focus, or when selected. Labels for items starting past 78% of the width are right-aligned so they don't run off the edge.
- **Looking for someone.** An orange `●` after the label.
- **Selected item.** A ring: `0 0 0 3px #ebebe5, 0 0 0 5px #1b2232`.
- **Width.** The minimum timeline width is 1040px. Below the mobile breakpoint, use the mobile layout instead.
- **Every item is a `<button>`** with an `aria-label`. Thread names are toggle buttons with `aria-pressed`.

## Interactions

- **Click a thread name:** every other thread fades to 22% opacity. Click again to clear.
- **Click an item:** the details panel swaps from "What's new" to that item:
  - a meta line: `thread name · detailLabel (or type label) · when`
  - the name, `text`, `status` (orange text if `lookingForSomeone`)
  - one button per `links` entry
  - a "← What's new" button

  Then scroll the panel into view (`block: "nearest"`, or `"start"` if it's taller than the viewport; use `behavior: "auto"` under `prefers-reduced-motion`) and focus it (`tabindex="-1"`, `preventScroll`). The panel is `aria-live="polite"`.
- **Deep links:** please add these. Opening `/#precedent`, or any item id, opens that item on load. Clicking an item updates the hash with `history.replaceState`, so Russ can send people straight to one thing.
- **"What's new"** lists `whatsNew.items`: the item name as a button that opens the item, the month, and the note.
- **Image slot.** The panel has a 16:10 image slot. If an item has no `image`, drop the slot entirely in production, with no grey box. Russ will add `image` paths to items later (put images in `assets/img/`).

## Mobile (under ~760px)

This layout was never mocked up, so keep it simple and consistent with the rest.

- Replace the timeline with a vertical list per thread: the thread name with its color swatch, then its items in reverse date order.
- Each item row shows a small mark of the right type (bar, line, diamond, dot), the name, `when`, and the orange dot if relevant. Tapping a row opens its details inline beneath it, accordion style, with the same content as the panel.
- "What's new" stays above the threads. Read and Get stack into one column.
- All touch targets should be at least 44px.

## Read: auto-updating essays

- `scripts/fetch-essays.mjs` writes `essays.json` (title, url, subtitle, date; newest first).
- At build time, render the newest three into the Read list. The snippet in `design-reference/` shows a client-side refresh as an extra layer, which is optional if you render at build time.
- Keep a committed `essays.json` as the fallback. The script leaves it alone if the feed is empty or down.
- Under the list: "All essays ↗" goes to `read.archive`, and "Subscribe on Substack ↗" (dark button) goes to `read.subscribe`. Then `read.olderWriting`.

## Get

Render `get.blurb`, then each `get.items` entry as a row: name (italic if `italic`), text, and a link. `href: "#contact"` scrolls to the footer.

## Contact and spam protection

- The email is `hello@russhamer.com`. It forwards to Russ's personal inbox, which is already set up.
- **Don't put the address in the HTML source as plain text or as a plain `mailto:`.** Render it with JS from parts (e.g. `data-u="hello" data-d="russhamer.com"`) into a real `mailto:` link. For no-JS visitors, show a `<noscript>` fallback: "hello [at] russhamer [dot] com". Every "Email me" / "Tell me when" button links to `#contact`.
- LinkedIn: `contact.linkedin`.
- **Newsletter:** the form goes to Buttondown (`https://buttondown.com/api/emails/embed-subscribe/{username}`, `method="post"`, field `email`). `contact.newsletter.username` is `TODO` until Russ makes the account. While it's `TODO`, hide the form.

## Strategy exercises page (`/strategy-exercises/`)

Port `design-reference/strategy-exercises.dc.html` exactly; its copy is final. The accent color is the Ventures purple, `#7a45c7`. "← russhamer.com" goes back to `/`, and the email footer uses the same obfuscation as the homepage.

## Copy rules

- Use the strings in `site.json` and the strategy page exactly as written.
- No em dashes or en dashes anywhere. Russ doesn't use them (date ranges use a hyphen).
- **Unveiled is deliberately low-key.** Don't give it an image, don't feature it, and don't add descriptive copy beyond what's in `site.json`.
- Links marked `"href": "TODO"` are still missing. Render those items without that link button, and list the TODOs in your PR description so Russ can fill them in.

## Page metadata

- `<title>Russ Hamer</title>`
- Meta description: "Russ Hamer: philosophy, education, ventures, games, esports, and a rock collection he can't identify." Have Russ confirm it.
- Basic Open Graph tags.
- A plain favicon: a small rounded square in `#1b2232` with an "R" in `#ebebe5` is fine.
- `lang="en"`. A 404 page that links home.

## Deploy

1. Add the build step to `.github/workflows/publish.yml`, after "Fetch latest essays" and before uploading the Pages artifact. Upload only the built site, not the whole repo.
2. In the repo: Settings → Pages → Source: **GitHub Actions**. Commit a `CNAME` file containing `russhamer.com`.
3. Russ makes these changes in Squarespace Domains → DNS, after checking the site at the GitHub Pages address:
   - Remove the old Weebly records.
   - Add four **A** records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   - Add a **CNAME** record: `www` → `jurgioslakiv.github.io`.
   - Keep the existing MX/forwarding records for hello@russhamer.com. **Don't delete those.**
4. Settings → Pages → Custom domain: `russhamer.com`. Once the certificate is issued, enable "Enforce HTTPS".
5. Only then can Russ cancel Weebly.

## README for Russ

Write a short `README.md` in the repo that explains how he updates the site:
- Edit `content/site.json` (an item, "What's new", `updated`), commit, and the site republishes in about a minute.
- Essays update themselves daily.
- How to add an image to an item.
- How to rerun the deploy from the Actions tab.

## Done when

- [ ] Homepage matches `homepage.dc.html` at 1280px wide: layout, colors, type, marks and labels (no overlapping labels).
- [ ] Thread focus, item selection, "What's new" and back, scroll and focus to the panel, and deep links all work.
- [ ] Mobile layout works at 390px with no sideways scrolling.
- [ ] The page is readable with JS off (timeline items visible as a list is fine).
- [ ] The email address doesn't appear in the HTML source, and clicking it opens a mail draft.
- [ ] The essay list shows the newest three from the live feed after a deploy run.
- [ ] The strategy exercises page matches its reference and links home.
- [ ] Keyboard: every control is reachable, focus is visible, and contrast passes WCAG AA.
- [ ] Lighthouse accessibility and performance scores are both 95+.
- [ ] The PR description lists the remaining TODO links and the Buttondown username.
