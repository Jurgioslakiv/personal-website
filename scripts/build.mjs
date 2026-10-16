// Builds the site into _site/ from content/site.json and essays.json.
//
// Run:   node scripts/build.mjs
// Needs: Node 18+. No packages.
//
// index.html is generated here. The strategy exercises page and the 404 page are
// plain HTML in pages/ and are copied as they are, along with everything in assets/.

import { readFile, writeFile, mkdir, cp, rm, readdir } from "node:fs/promises";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const OUT = "_site";
const site = JSON.parse(await readFile("content/site.json", "utf8"));
const BASE = (site.meta && site.meta.url) || "https://russhamer.com/";
const essays = await readFile("essays.json", "utf8")
  .then((s) => JSON.parse(s).essays || [])
  .catch(() => []);

// ---------- helpers ----------

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Escaped text, with *word* turned into italics (for book and journal titles).
const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, "<i>$1</i>");

const isTodo = (href) => !href || /^TODO/i.test(href);

// Root-relative links ("/strategy-exercises/") become relative so the site also
// works at the github.io project address before the custom domain is live.
const rel = (href) => (href.startsWith("/") && !href.startsWith("//") ? href.slice(1) || "./" : href);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

// "YYYY-MM" -> fractional year.
const ym = (s) => {
  const [y, m] = s.split("-").map(Number);
  return y + (m - 1) / 12;
};

const today = new Date();

// "Updated" is the date of the last commit that changed the content or the pages,
// so the daily essay rebuild doesn't bump it.
const updated = (() => {
  try {
    const d = execSync("git log -1 --format=%cs -- content pages assets/rocks", { encoding: "utf8" }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  } catch {}
  return today.toISOString().slice(0, 10);
})();
const NOW = (() => {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return y + (m + (today.getUTCDate() - 1) / days) / 12;
})();
const START = ym(site.timeline.start);
const K = site.timeline.scaleK;
const SPAN = Math.log(1 + (NOW - START) / K);
const x = (t) => {
  const age = Math.max(0, NOW - t);
  return Math.max(0, Math.min(100, (1 - Math.log(1 + age / K) / SPAN) * 100));
};
const endOf = (it) => (it.end === "now" ? NOW : ym(it.end));
const startOf = (it) => ym(it.date || it.start);
const isPast = (it) => !!it.end && it.end !== "now" && ym(it.end) < NOW;

const KIND = { job: "Job", "own-time": "On my own time", series: "On my own time", visits: "On my own time", thing: "Something you can get" };
const kindLabel = (it) => it.detailLabel || KIND[it.type];

const todos = [];
const links = (it) =>
  (it.links || []).filter((l) => {
    if (isTodo(l.href)) todos.push(`${it.name}: "${l.label}"`);
    return !isTodo(l.href);
  });

const dot = `<span class="look" aria-hidden="true"></span>`;

// ---------- timeline ----------

function markStyle(it, c) {
  if (it.type === "series")
    return `background:linear-gradient(${c},${c}) center/100% 4px no-repeat,repeating-linear-gradient(90deg,${c} 0 2px,transparent 2px 5px)`;
  return `background:${c}`;
}

function timelineItem(it, th) {
  const past = isPast(it);
  const c = past ? th.color + "73" : th.color;
  const aria = esc(`${it.name}${it.lookingForSomeone ? ", you can get involved" : ""}, ${it.when}`);
  const top = it.row * 52 + 2;
  // On right-aligned labels the dot goes first, so it doesn't sit under the "now" line.
  const label = (cls, end) =>
    it.lookingForSomeone && end
      ? `<span class="lb${cls}">${dot} ${esc(it.name)}</span>`
      : `<span class="lb${cls}">${esc(it.name)}${it.lookingForSomeone ? " " + dot : ""}</span>`;

  if (it.type === "thing" || it.type === "visits") {
    const points = it.type === "thing" ? [it.date] : it.visits;
    return points
      .map((p, i) => {
        const left = x(ym(p));
        const end = left > 78 ? " end" : "";
        const first = i === 0;
        const showLabel = it.type === "visits" ? first : it.alwaysShowLabel;
        const lb = it.type === "visits" && !first ? "" : label(showLabel ? "" : " plb", end);
        const shape = it.type === "visits" ? "vd" : "pt";
        const a = it.type === "visits" && !first ? esc(`${it.name}, visit ${i + 1}`) : aria;
        return `<button type="button" class="it p${end}${past ? " past" : ""}" data-id="${esc(it.id)}" aria-pressed="false" aria-label="${a}" style="left:${left.toFixed(2)}%;width:12px;top:${top}px">${lb}<span class="track"><span class="mk ${shape}" style="background:${c}"></span></span></button>`;
      })
      .join("");
  }

  const left = x(startOf(it));
  const right = x(endOf(it));
  const width = Math.max(0.6, right - left);
  const end = left > 78 ? " end" : "";
  const h = it.type === "own-time" ? "own" : "job";
  return `<button type="button" class="it${end}${past ? " past" : ""}" data-id="${esc(it.id)}" aria-pressed="false" aria-label="${aria}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;top:${top}px">${label("", end)}<span class="track"><span class="mk bar ${h}" style="${markStyle(it, c)}"></span></span></button>`;
}

// A caption for a whole row of diamonds ("Book chapters"), sitting where the first
// one's label would go. Hovering a diamond still shows its own name over it.
function rowCaptions(th) {
  return Object.entries(th.rowLabels || {})
    .map(([row, text]) => {
      const onRow = th.items.filter((it) => String(it.row) === row);
      if (!onRow.length) return "";
      const left = Math.min(...onRow.map((it) => x(startOf(it))));
      return `<span class="row-cap" aria-hidden="true" style="left:${left.toFixed(2)}%;top:${Number(row) * 52 + 2}px"><span class="lb">${esc(text)}</span><span class="track"></span></span>`;
    })
    .join("");
}

function timeline() {
  const lanes = site.threads
    .map(
      (th) => `<div class="lane" data-thread="${esc(th.id)}">
<div class="lane-name"><button type="button" class="lane-btn" data-thread="${esc(th.id)}" aria-pressed="false"><span class="sw" style="background:${th.color}"></span>${esc(th.name)}</button></div>
<div class="lane-track" style="height:${th.rows * 52 + 8}px">${rowCaptions(th)}${th.items.map((it) => timelineItem(it, th)).join("")}</div>
</div>`
    )
    .join("\n");
  const ticks = site.timeline.ticks
    .map((y) => {
      const p = x(y).toFixed(2);
      return `<span class="tk" style="left:${p}%"></span><span class="tkl" style="left:${p}%">${y}</span>`;
    })
    .join("");
  return `<div class="tl-wrap">
<div class="tl" id="timeline">
${lanes}
<div class="axis"><div class="lane-name"></div><div class="axis-track mono">${ticks}<span class="now">now</span></div></div>
<div class="now-line" aria-hidden="true"></div>
</div>
</div>`;
}

// ---------- details (panel templates and mobile list) ----------

const byId = new Map();
for (const th of site.threads) for (const it of th.items) byId.set(it.id, { it, th });

function linkButtons(it) {
  return links(it)
    .map((l) => `<a class="ext" href="${esc(rel(l.href))}">${esc(l.label)}</a>`)
    .join("");
}

function image(it) {
  if (!it.image) return "";
  return `<img class="sel-img" src="${esc(rel(it.image))}" alt="${esc(it.imageAlt || "")}" loading="lazy">`;
}

const status = (it) => (it.status ? `<p class="status${it.lookingForSomeone ? " looking" : ""}">${rich(it.status)}</p>` : "");

function panelTemplate(it, th) {
  return `<template id="t-${esc(it.id)}"><div class="sel-wrap">${image(it)}<div class="sel-body">
<p class="mono muted">${esc(th.name)} · ${esc(kindLabel(it))} · ${esc(it.when)}</p>
<h2 class="h-xl">${esc(it.name)}</h2>
<p class="sel-text">${rich(it.text)}</p>
${status(it)}
<div class="btns">${linkButtons(it)}<button type="button" class="ext back" data-back>← What’s new</button></div>
</div></div></template>`;
}

function miniMark(it, th) {
  const c = isPast(it) ? th.color + "73" : th.color;
  const shape = { job: "job", "own-time": "own", series: "series", visits: "vd", thing: "pt" }[it.type];
  return `<span class="mm mm-${shape}" style="${it.type === "series" ? markStyle(it, c) : "background:" + c}" aria-hidden="true"></span>`;
}

function mobileList() {
  return `<div class="mlist">
${site.threads
  .map((th) => {
    const items = [...th.items].sort((a, b) => startOf(b) - startOf(a));
    return `<section class="mthread" aria-labelledby="mt-${esc(th.id)}">
<h3 class="mthread-h" id="mt-${esc(th.id)}"><span class="sw" style="background:${th.color}"></span>${esc(th.name)}</h3>
<ul>${items
      .map(
        (it) => `<li><details id="${esc(it.id)}" name="item"><summary>${miniMark(it, th)}<span class="mname${isPast(it) ? " past" : ""}">${esc(it.name)}${it.lookingForSomeone ? " " + dot : ""}</span><span class="mono mwhen">${esc(it.when)}</span></summary>
<div class="mbody">${image(it)}<p class="mono muted">${esc(kindLabel(it))}</p><p>${rich(it.text)}</p>${status(it)}${links(it).length ? `<div class="btns">${linkButtons(it)}</div>` : ""}</div>
</details></li>`
      )
      .join("\n")}</ul>
</section>`;
  })
  .join("\n")}
</div>`;
}

// ---------- page sections ----------

function whatsNew() {
  const w = site.whatsNew;
  const rows = w.items
    .map((n) => {
      const hit = byId.get(n.id);
      if (!hit) throw new Error(`whatsNew item "${n.id}" isn't on the timeline`);
      return `<li><a class="news-name" href="#${esc(n.id)}" data-open="${esc(n.id)}">${esc(hit.it.name)}</a><span class="mono muted news-month">${esc(n.month)}</span><span class="news-note">${rich(n.note)}</span></li>`;
    })
    .join("\n");
  return `<div class="news">
<div class="news-head">
<p class="mono muted">${longDate(w.date)}</p>
<h2 class="h-xl">What’s new</h2>
<p class="soft">${esc(w.since)} <span class="js-only">Click anything on the timeline to open it.</span></p>
</div>
<ul class="news-list">
${rows}
</ul>
</div>`;
}

function read() {
  const r = site.read;
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
  const list = essays
    .slice(0, 3)
    .map(
      (e) =>
        `<li class="get"><b><a href="${esc(e.url)}">${esc(e.title)}</a></b>${e.date ? `<time class="mono" datetime="${esc(e.date)}">${fmt.format(new Date(e.date))}</time>` : ""}</li>`
    )
    .join("\n");
  return `<section class="col" aria-labelledby="read-h">
<h2 class="h-col" id="read-h">Read</h2>
<p class="soft">${rich(r.blurb)}</p>
<ol class="rows">
${list}
</ol>
<div class="btns"><a class="ext" href="${esc(r.archive)}">All essays ↗</a><a class="ext dark" href="${esc(r.subscribe)}">Subscribe on Substack ↗</a></div>
<p class="soft small">${rich(r.olderWriting)}</p>
</section>`;
}

function get() {
  const g = site.get;
  const rows = g.items
    .map((it) => {
      const name = it.italic ? `<i>${esc(it.name)}</i>` : esc(it.name);
      let link = "";
      if (isTodo(it.href)) todos.push(`Get: ${it.name} (${it.linkLabel})`);
      else {
        const ext = !it.href.startsWith("#") && !it.href.startsWith("/");
        link = `<a href="${esc(rel(it.href))}">${esc(it.linkLabel)}${ext ? " ↗" : ""}</a>`;
      }
      return `<li class="get"><b>${name}</b><span>${rich(it.text)}</span>${link}</li>`;
    })
    .join("\n");
  return `<section class="col" aria-labelledby="get-h">
<h2 class="h-col" id="get-h">Get</h2>
<p class="soft">${rich(g.blurb)}</p>
<ul class="rows">
${rows}
</ul>
</section>`;
}

function emailLink(cls) {
  const [u, d] = site.contact.email.split("@");
  return `<a class="email ${cls}" data-u="${esc(u)}" data-d="${esc(d)}" hidden></a><noscript><span class="${cls}">${esc(u)} [at] ${esc(d.replace(/\./g, " [dot] "))}</span></noscript>`;
}

function footer() {
  const c = site.contact;
  const n = c.newsletter;
  const form =
    n && n.username && !isTodo(n.username)
      ? `<form class="nl" action="https://buttondown.com/api/emails/embed-subscribe/${esc(n.username)}" method="post">
<label for="nl-email">${esc(n.label)}</label>
<span class="nl-row"><input id="nl-email" name="email" type="email" placeholder="Your email" autocomplete="email" required><button type="submit">Subscribe</button></span>
</form>`
      : "";
  if (!form) todos.push("Newsletter: contact.newsletter.username (Buttondown) is TODO, so the sign-up form is hidden");
  return `<footer id="contact" class="foot">
<div class="foot-l">
<p>${rich(c.closingLine)}</p>
${emailLink("big-email")}
<p class="mono muted"><a href="${esc(c.linkedin)}">LinkedIn</a></p>
</div>
${form}
</footer>`;
}

// ---------- analytics ----------

// GoatCounter: no cookies, no banner. Off until analytics.goatcounter holds a site code.
const gc = site.analytics && site.analytics.goatcounter;
const analytics =
  gc && !isTodo(gc)
    ? `<script data-goatcounter="https://${esc(gc)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`
    : "";
if (!analytics) todos.push("Analytics: analytics.goatcounter is TODO, so nothing is counted");

// ---------- page ----------

const meta = site.meta || {};
const plain = (s) => String(s ?? "").replace(/\*([^*]+)\*/g, "$1");
const abs = (path) => new URL(path.replace(/^\//, ""), BASE).href;

function socialTags({ title, description, url, image, large = true }) {
  return `<meta property="og:type" content="website">
<meta property="og:site_name" content="Russ Hamer">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="${large ? "summary_large_image" : "summary"}">`;
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title || site.intro.name)}</title>
<meta name="description" content="${esc(meta.description)}">
${socialTags({ title: meta.title || site.intro.name, description: meta.description, url: BASE, image: abs("assets/og-home.png") })}
<link rel="canonical" href="${esc(BASE)}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
${analytics}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:ital,wght@0,400;0,500;0,700;1,400&amp;family=DM+Mono:wght@400;500&amp;display=swap">
<link rel="stylesheet" href="assets/site.css">
<script>document.documentElement.classList.add("js")</script>
<script src="assets/site.js" defer></script>
</head>
<body>
<div class="wrap">

<header class="top">
<div class="mono topbar"><span>russhamer.com</span><span class="muted">Updated ${longDate(updated)}</span></div>
<div class="intro">
<h1 class="name">${site.intro.name.split(" ").map(esc).join("<br>")}</h1>
<div class="intro-r">
<p class="tagline">${esc(site.intro.tagline)}</p>
<p class="soft">${esc(site.intro.hint)}</p>
</div>
</div>
</header>

<main class="main">
<div class="mono legend" role="list" aria-label="Key">
<span class="lg" role="listitem"><i class="lg-job"></i>a job</span>
<span class="lg" role="listitem"><i class="lg-own"></i>on my own time</span>
<span class="lg" role="listitem"><span class="lg-pt"></span>something you can read, play or wear</span>
<span class="lg" role="listitem"><span class="look lg-dot" aria-hidden="true"></span>you can get involved</span>
<span class="muted" role="listitem">Recent years get more room.</span>
</div>

${timeline()}

<section id="detail" class="panel" tabindex="-1" aria-live="polite" aria-label="Details">
${whatsNew()}
<div class="sel" hidden></div>
</section>

${mobileList()}

<div class="cols">
${read()}
${get()}
</div>
</main>

${footer()}

</div>
${[...byId.values()].map(({ it, th }) => panelTemplate(it, th)).join("\n")}
</body>
</html>
`;

// ---------- checks ----------

if (html.includes(site.contact.email)) throw new Error("The email address ended up in the HTML source.");
const dashes = JSON.stringify(site).match(/[–—]/g);
if (dashes) console.warn(`Warning: ${dashes.length} em or en dash(es) in content/site.json. Use a hyphen.`);

// ---------- write ----------

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await cp("assets", `${OUT}/assets`, { recursive: true });
await cp("pages", OUT, { recursive: true });
await cp("CNAME", `${OUT}/CNAME`);
await cp("essays.json", `${OUT}/essays.json`).catch(() => {});
await writeFile(`${OUT}/index.html`, html);

// The hand-written pages mark where analytics goes with <!-- analytics -->.
for (const f of ["404.html", "strategy-exercises/index.html"]) {
  const p = `${OUT}/${f}`;
  await writeFile(p, (await readFile(p, "utf8")).replace("<!-- analytics -->", analytics));
}

// ---------- rocks page ----------

// russhamer.com/rocks/: one card per rock from content/rocks.json. Photos live in
// assets/rocks/ as <id>.jpg (full) and <id>-t.jpg (square thumbnail); the first
// photo listed is the card's cover. Tapping a card opens all of that rock's photos.
const rocksData = JSON.parse(await readFile("content/rocks.json", "utf8"));
const rocksItem = byId.get("rocks")?.it;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rockCards = rocksData.rocks
  .map((r, i) => {
    const n = r.photos.length;
    return `<li><a class="rock" href="../assets/rocks/${esc(r.photos[0])}.jpg" data-i="${i}">
<img src="../assets/rocks/${esc(r.photos[0])}-t.jpg" alt="${esc(r.name)}" width="640" height="640"${i > 5 ? ' loading="lazy"' : ""}>
<span class="rock-name">${esc(r.name)}</span>${r.note ? `<span class="rock-note">${rich(r.note)}</span>` : ""}<span class="mono muted">${n} photo${n === 1 ? "" : "s"}</span>
</a></li>`;
  })
  .join("\n");
const rocksJson = JSON.stringify(rocksData.rocks.map((r) => ({ name: r.name, slug: slug(r.name), photos: r.photos }))).replace(/</g, "\\u003c");
const rocksPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(rocksData.title)} · Russ Hamer</title>
<meta name="description" content="${esc(plain(rocksItem?.text))}">
${socialTags({ title: `${rocksData.title} · Russ Hamer`, description: plain(rocksItem?.text), url: abs("rocks/"), image: abs("assets/img/rocks.jpg") })}
<link rel="canonical" href="${esc(abs("rocks/"))}">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
${analytics}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:ital,wght@0,400;0,500;0,700;1,400&amp;family=DM+Mono:wght@400;500&amp;display=swap">
<style>
html{background:#ebebe5}
body{margin:0;background:#ebebe5;color:#1b2232;font-family:'Familjen Grotesk','Helvetica Neue',sans-serif;font-size:17px;line-height:1.5}
a{color:#1b2232;text-decoration-thickness:1px;text-underline-offset:3px}a:hover{color:#e0531f}
:focus-visible{outline:2px solid #1b2232;outline-offset:3px}
p{margin:0}
.mono{font-family:'DM Mono',ui-monospace,monospace;font-size:12px}
.muted{color:#5a5d64}
.wrap{max-width:1240px;margin:0 auto;padding:32px 22px 96px;display:flex;flex-direction:column;gap:40px}
nav{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
nav a,.back a{display:inline-block;padding:12px 0;margin:-12px 0}
header{display:flex;flex-direction:column;gap:16px;max-width:760px}
.kicker{display:flex;align-items:center;gap:10px;font-weight:500}
.kicker span{width:12px;height:12px;background:#6f6c66;display:inline-block}
h1{margin:0;font-size:clamp(48px,7vw,96px);line-height:.9;letter-spacing:-0.04em;font-weight:700}
.lede{font-size:19px;color:#43464d}
.grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:32px 20px}
.rock{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:#1b2232}
.rock img{width:100%;height:auto;aspect-ratio:1;object-fit:cover;display:block;background:#dcdcd4;transition:transform .2s}
.rock:hover img{transform:scale(1.02)}
.rock:hover .rock-name{text-decoration:underline;text-underline-offset:3px}
.rock-name{font-weight:700;font-size:18px;line-height:1.2;padding-top:4px}
.rock-note{color:#43464d;font-size:15px;line-height:1.45}
footer{border-top:2px solid #1b2232;padding-top:24px}
dialog{border:0;padding:0;margin:0;width:100%;max-width:100%;height:100%;max-height:100%;background:#ebebe5;color:#1b2232}
dialog::backdrop{background:#ebebe5}
.v{box-sizing:border-box;height:100%;display:grid;grid-template-rows:auto 1fr auto;gap:12px;padding:16px 22px 20px}
.v-top{display:flex;justify-content:space-between;align-items:center;gap:16px}
.v-name{margin:0;font-size:24px;line-height:1.15;font-weight:700;letter-spacing:-0.015em}
.v-img{min-height:0;display:flex;align-items:center;justify-content:center;touch-action:pan-y}
.v-img img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.v-bottom{display:flex;justify-content:center;align-items:center;gap:16px}
.v button{font:inherit;font-weight:500;min-width:44px;min-height:44px;padding:0 16px;border:1.5px solid #1b2232;background:none;color:#1b2232;cursor:pointer}
.v button:hover{background:#1b2232;color:#ebebe5}
.v button[disabled]{opacity:.3;cursor:default;background:none;color:#1b2232}
@media (max-width:600px){.grid{grid-template-columns:1fr 1fr;gap:24px 14px}.rock-name{font-size:16px}.rock-note{font-size:14px}}
@media (prefers-reduced-motion:reduce){.rock img{transition:none}}
</style>
</head>
<body>
<div class="wrap">
<nav class="mono" aria-label="Site"><a href="../#rocks">← russhamer.com</a><span class="muted">${esc(rocksItem?.when || "")}</span></nav>
<main style="display:flex;flex-direction:column;gap:40px">
<header>
<p class="kicker"><span></span>Hobbies</p>
<h1>${esc(rocksData.title)}</h1>
<p class="lede">${rich(rocksItem?.text)}</p>
</header>
<ul class="grid">
${rockCards}
</ul>
</main>
<footer><p class="mono back"><a href="../">← Back to everything else</a></p></footer>
</div>
<dialog id="viewer" aria-labelledby="v-name">
<div class="v">
<div class="v-top"><h2 class="v-name" id="v-name"></h2><button type="button" data-close aria-label="Close">Close</button></div>
<div class="v-img"><img alt=""></div>
<div class="v-bottom"><button type="button" data-prev aria-label="Previous photo">←</button><span class="mono v-count" aria-live="polite"></span><button type="button" data-next aria-label="Next photo">→</button></div>
</div>
</dialog>
<script>
(() => {
  const rocks = ${rocksJson};
  const dlg = document.getElementById("viewer");
  if (!dlg.showModal) return; // very old browsers just follow the link to the photo
  const img = dlg.querySelector(".v-img img"), name = dlg.querySelector(".v-name"), count = dlg.querySelector(".v-count");
  const prev = dlg.querySelector("[data-prev]"), next = dlg.querySelector("[data-next]");
  let r = 0, p = 0, opener = null;
  const src = (id) => "../assets/rocks/" + id + ".jpg";
  function show() {
    const rock = rocks[r], n = rock.photos.length;
    img.src = src(rock.photos[p]);
    img.alt = rock.name + ", photo " + (p + 1) + " of " + n;
    name.textContent = rock.name;
    count.textContent = n > 1 ? (p + 1) + " of " + n : "";
    prev.hidden = next.hidden = n < 2;
    prev.disabled = p === 0; next.disabled = p === n - 1;
    if (p + 1 < n) new Image().src = src(rock.photos[p + 1]);
  }
  const step = (d) => { const n = rocks[r].photos.length; if (p + d >= 0 && p + d < n) { p += d; show(); } };
  document.querySelector(".grid").addEventListener("click", (e) => {
    const a = e.target.closest(".rock"); if (!a) return;
    e.preventDefault(); opener = a; r = +a.dataset.i; p = 0; show(); dlg.showModal();
    const g = window.goatcounter; if (g && g.count) g.count({ path: "rock/" + rocks[r].slug, title: rocks[r].name, event: true });
  });
  prev.onclick = () => step(-1); next.onclick = () => step(1);
  dlg.querySelector("[data-close]").onclick = () => dlg.close();
  dlg.addEventListener("close", () => opener && opener.focus());
  dlg.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1); });
  let x0 = null;
  dlg.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
  dlg.addEventListener("pointerup", (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 50) step(e.clientX < x0 ? 1 : -1); x0 = null; });
})();
</script>
</body>
</html>
`;
await mkdir(`${OUT}/rocks`, { recursive: true });
await writeFile(`${OUT}/rocks/index.html`, rocksPage);

// Share pages: russhamer.com/precedent/ has Precedent's own title, text and image
// for link previews, then sends people on to /#precedent. Crawlers never see what
// comes after a #, so a plain /#precedent link always previews as the homepage.
const taken = new Set(await readdir(OUT));
let shared = 0;
for (const { it } of byId.values()) {
  if (taken.has(it.id) || !/^[a-z0-9-]+$/.test(it.id)) {
    console.warn(`No share page for "${it.id}" (the name is taken or isn't a plain slug).`);
    continue;
  }
  const url = abs(`${it.id}/`);
  const ownImage = !!it.image;
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(it.name)} · Russ Hamer</title>
<meta name="description" content="${esc(plain(it.text))}">
${socialTags({ title: `${it.name} · Russ Hamer`, description: plain(it.text), url, image: abs(ownImage ? it.image : "assets/og-home.png"), large: !ownImage || it.imageShape !== "portrait" })}
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=../#${esc(it.id)}">
<script>location.replace("../#${esc(it.id)}")</script>
</head>
<body style="font-family:sans-serif;background:#ebebe5;color:#1b2232">
<p><a href="../#${esc(it.id)}" style="color:#1b2232">${esc(it.name)} on russhamer.com</a></p>
</body>
</html>
`;
  await mkdir(`${OUT}/${it.id}`, { recursive: true });
  await writeFile(`${OUT}/${it.id}/index.html`, page);
  shared++;
}

// Old addresses (mostly from the Weebly site) that Google still sends people to.
// GitHub Pages can't do server redirects, so each gets a tiny page that forwards.
for (const [from, to] of Object.entries(site.redirects || {})) {
  if (from === "/index.html") continue; // that's the homepage itself now
  const file = from.replace(/^\//, "");
  if (taken.has(file) || existsSync(`${OUT}/${file}`)) continue;
  await writeFile(
    `${OUT}/${file}`,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Russ Hamer</title><link rel="canonical" href="${esc(abs(to))}"><meta http-equiv="refresh" content="0; url=${esc(to)}"><script>location.replace(${JSON.stringify(to)})</script></head><body><a href="${esc(to)}">russhamer.com</a></body></html>
`
  );
}

await writeFile(`${OUT}/robots.txt`, `User-agent: *
Allow: /

Sitemap: ${abs("sitemap.xml")}
`);
await writeFile(
  `${OUT}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${abs("")}</loc><lastmod>${updated}</lastmod></url>
<url><loc>${abs("strategy-exercises/")}</loc><lastmod>${updated}</lastmod></url>
<url><loc>${abs("rocks/")}</loc><lastmod>${updated}</lastmod></url>
</urlset>
`
);

console.log(`Built ${OUT}/ (${shared} share pages; ${essays.length ? "latest essay: " + essays[0].title : "no essays.json"}; updated ${updated})`);
if (todos.length) console.log("Still TODO:\n  " + [...new Set(todos)].join("\n  "));
