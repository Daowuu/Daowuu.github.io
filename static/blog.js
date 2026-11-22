(function () {
  const THEMES = ["paper", "light", "dark"];
  const LABELS = { paper: "暖纸", light: "纯白", dark: "深墨" };
  function applyTheme(th) {
    const t = THEMES.includes(th) ? th : "paper";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("elysia-blog-theme", t); } catch (_) {}
    const btn = document.getElementById("theme-btn");
    if (btn) btn.textContent = "主题：" + LABELS[t];
  }
  let saved = "paper";
  try { saved = localStorage.getItem("elysia-blog-theme") || "paper"; } catch (_) {}
  applyTheme(saved);
  const tbtn = document.getElementById("theme-btn");
  if (tbtn) {
    tbtn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") || "paper";
      applyTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]);
    });
  }

  // 字号记忆调节
  let fs = 17;
  try { fs = Math.max(15, Math.min(20, Number(localStorage.getItem("elysia-blog-fs")) || 17)); } catch (_) {}
  function applyFs(v) {
    fs = Math.max(15, Math.min(20, v));
    document.documentElement.style.setProperty("--fs", fs + "px");
    try { localStorage.setItem("elysia-blog-fs", String(fs)); } catch (_) {}
  }
  applyFs(fs);
  document.getElementById("fs-dec")?.addEventListener("click", () => applyFs(fs - 1));
  document.getElementById("fs-inc")?.addEventListener("click", () => applyFs(fs + 1));

  // 首页分类筛选与搜索
  const listEl = document.getElementById("post-list");
  if (listEl) {
    let activeCat = "all";
    const qIn = document.getElementById("blog-search");
    const cards = [...listEl.querySelectorAll(".post-card")];
    const emptyEl = document.getElementById("empty-tip");
    function filter() {
      const q = (qIn ? qIn.value : "").trim().toLowerCase();
      let shown = 0;
      cards.forEach((c) => {
        const catOk = activeCat === "all" || c.dataset.cat === activeCat;
        const textOk = !q || (c.dataset.search || "").includes(q);
        const vis = catOk && textOk;
        c.hidden = !vis;
        if (vis) shown++;
      });
      if (emptyEl) emptyEl.hidden = shown > 0;
    }
    document.querySelectorAll(".pill[data-cat]").forEach((p) => {
      p.addEventListener("click", () => {
        activeCat = p.dataset.cat;
        document.querySelectorAll(".pill[data-cat]").forEach((x) => x.classList.toggle("on", x === p));
        filter();
      });
    });
    if (qIn) qIn.addEventListener("input", filter);
  }

  // 文章页 KaTeX 渲染、代码高亮、复制、进度条、目录联动与图片灯箱
  const bodyEl = document.getElementById("body");
  if (bodyEl) {
    if (window.katex) {
      bodyEl.querySelectorAll(".math").forEach((el) => {
        const tex = el.textContent;
        try { window.katex.render(tex, el, { displayMode: el.classList.contains("math-display"), throwOnError: false }); }
        catch (_) { el.textContent = tex; }
      });
    }
    if (window.hljs) {
      bodyEl.querySelectorAll("pre code").forEach((b) => { try { window.hljs.highlightElement(b); } catch (_) {} });
    }
    bodyEl.querySelectorAll(".code-copy").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const code = btn.closest(".code-wrap")?.querySelector("code")?.textContent || "";
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = "已复制";
          setTimeout(() => { btn.textContent = "复制"; }, 1400);
        } catch (_) {}
      });
    });

    const lb = document.getElementById("blog-lightbox");
    const lbImg = document.getElementById("blog-lightbox-img");
    const lbCap = document.getElementById("blog-lightbox-cap");
    if (lb && lbImg) {
      bodyEl.querySelectorAll("img").forEach((img) => {
        img.addEventListener("click", () => {
          lbImg.src = img.src;
          const capEl = img.nextElementSibling && img.nextElementSibling.tagName === "EM" ? img.nextElementSibling : null;
          if (lbCap) lbCap.textContent = (capEl ? capEl.textContent : img.alt) || "";
          lb.hidden = false;
        });
      });
      lb.addEventListener("click", () => { lb.hidden = true; });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") lb.hidden = true; });
    }

    const prog = document.getElementById("blog-progress");
    const backTop = document.getElementById("back-top");
    if (backTop) backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

    const tocLinks = [...document.querySelectorAll(".toc-link")];
    const headings = tocLinks.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
    const onScroll = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (prog) prog.style.transform = `scaleX(${Math.min(1, Math.max(0, window.scrollY / maxScroll))})`;
      if (backTop) backTop.hidden = window.scrollY < 480;
      if (headings.length) {
        let cur = headings[0];
        for (const h of headings) {
          if (h.getBoundingClientRect().top <= 116) cur = h;
        }
        tocLinks.forEach((a) => a.classList.toggle("on", cur && a.getAttribute("href") === "#" + cur.id));
      }
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
