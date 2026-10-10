// Pulls the latest Shower Essays from Substack's RSS feed and writes essays.json,
// which scripts/build.mjs reads to build the homepage's "Read" list.
//
// Run:   node scripts/fetch-essays.mjs
// Needs: Node 18+ (built-in fetch). No packages.
//
// .github/workflows/publish.yml runs this before every deploy and once a day,
// so a new post shows up on the site within a day without you doing anything.

import { readFile, writeFile } from "node:fs/promises";

const FEED_URL = "https://showeressays.substack.com/feed";
const OUT_FILE = process.env.OUT_FILE || "essays.json";
const HOW_MANY = 10;

// Pull a tag's text out of one <item>, handling Substack's CDATA wrapping.
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
}

function decode(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function parseFeed(xml) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  return items
    .map((item) => {
      const date = new Date(tag(item, "pubDate"));
      return {
        title: decode(tag(item, "title")),
        url: decode(tag(item, "link")),
        subtitle: decode(tag(item, "description")),
        date: isNaN(date) ? null : date.toISOString(),
      };
    })
    .filter((e) => e.title && e.url)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, HOW_MANY);
}

async function main() {
  // FEED_FILE lets you test against a saved copy of the feed.
  const xml = process.env.FEED_FILE
    ? await readFile(process.env.FEED_FILE, "utf8")
    : await (async () => {
        const res = await fetch(FEED_URL, { headers: { "User-Agent": "russhamer.com essay list" } });
        if (!res.ok) throw new Error(`Feed request failed: ${res.status}`);
        return res.text();
      })();

  const essays = parseFeed(xml);
  if (essays.length === 0) {
    // Keep the old file rather than blanking the list if Substack hiccups.
    console.error("No essays found in feed; leaving essays.json unchanged.");
    process.exit(0);
  }
  await writeFile(OUT_FILE, JSON.stringify({ updated: new Date().toISOString(), essays }, null, 2) + "\n");
  console.log(`Wrote ${essays.length} essays to ${OUT_FILE}. Latest: ${essays[0].title}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
