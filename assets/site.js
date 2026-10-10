// russhamer.com. Everything here is an extra: the page is readable without it.

(() => {
  // Email: assembled here so the address never sits in the HTML source.
  for (const a of document.querySelectorAll("a.email[data-u]")) {
    const addr = a.dataset.u + "@" + a.dataset.d;
    a.href = "mailto:" + addr;
    a.textContent = addr;
    a.hidden = false;
  }

  const tl = document.getElementById("timeline");
  const panel = document.getElementById("detail");
  if (!tl || !panel) return;

  const news = panel.querySelector(".news");
  const sel = panel.querySelector(".sel");
  const mobile = window.matchMedia("(max-width: 759.98px)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const items = [...tl.querySelectorAll(".it")];
  let current = null;

  const behavior = () => (reduce.matches ? "auto" : "smooth");
  const template = (id) => document.getElementById("t-" + id);

  function setHash(id) {
    const url = id ? "#" + id : location.pathname + location.search;
    history.replaceState(null, "", url);
  }

  function mark(id) {
    for (const b of items) b.setAttribute("aria-pressed", b.dataset.id === id ? "true" : "false");
  }

  function showInPanel(id, scroll) {
    sel.replaceChildren(template(id).content.cloneNode(true));
    sel.hidden = false;
    news.hidden = true;
    if (scroll) {
      const tall = panel.getBoundingClientRect().height > window.innerHeight;
      panel.scrollIntoView({ behavior: behavior(), block: tall ? "start" : "nearest" });
    }
    panel.focus({ preventScroll: true });
  }

  function showInList(id, scroll) {
    const d = document.getElementById(id);
    if (!d) return;
    d.open = true;
    if (scroll) d.scrollIntoView({ behavior: behavior(), block: "start" });
    d.querySelector("summary").focus({ preventScroll: true });
  }

  function openItem(id, scroll = true) {
    if (!template(id)) return false;
    current = id;
    mark(id);
    setHash(id);
    if (mobile.matches) showInList(id, scroll);
    else showInPanel(id, scroll);
    return true;
  }

  function clearItem() {
    current = null;
    mark(null);
    setHash(null);
    sel.hidden = true;
    sel.replaceChildren();
    news.hidden = false;
    panel.focus({ preventScroll: true });
  }

  // Timeline items.
  tl.addEventListener("click", (e) => {
    const it = e.target.closest(".it");
    if (it) return openItem(it.dataset.id);
    const lane = e.target.closest(".lane-btn");
    if (lane) {
      const id = tl.dataset.focus === lane.dataset.thread ? null : lane.dataset.thread;
      if (id) tl.dataset.focus = id;
      else delete tl.dataset.focus;
      for (const l of tl.querySelectorAll(".lane")) l.classList.toggle("on", l.dataset.thread === id);
      for (const b of tl.querySelectorAll(".lane-btn")) b.setAttribute("aria-pressed", b.dataset.thread === id ? "true" : "false");
    }
  });

  // "What's new" links and the back button.
  panel.addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]");
    if (open && openItem(open.dataset.open)) return e.preventDefault();
    if (e.target.closest("[data-back]")) clearItem();
  });

  // Mobile list: keep the address in step with whichever row is open.
  document.addEventListener(
    "toggle",
    (e) => {
      const d = e.target;
      if (!(d instanceof HTMLDetailsElement) || !d.closest(".mlist") || !mobile.matches) return;
      if (d.open) {
        current = d.id;
        mark(d.id);
        setHash(d.id);
      } else if (current === d.id) {
        current = null;
        mark(null);
        setHash(null);
      }
    },
    true
  );

  // Moving across the breakpoint carries the open item with it.
  mobile.addEventListener("change", () => {
    if (!current) return;
    if (mobile.matches) {
      clearPanelOnly();
      const d = document.getElementById(current);
      if (d) d.open = true;
    } else {
      showInPanel(current, false);
    }
  });
  function clearPanelOnly() {
    sel.hidden = true;
    sel.replaceChildren();
    news.hidden = false;
  }

  // Deep links: /#precedent opens Precedent.
  const fromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) openItem(id);
  };
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
