// Elysia 静态个人博客前端引擎（1:1 复刻本地三栏极简认知阅读器，零后端依赖）
(async function () {
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch (_) { return s; } };
  const getLS = (k, d = "") => { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } };
  const setLS = (k, v) => { try { localStorage.setItem(k, String(v)); } catch (_) {} };
  const isMobile = () => window.matchMedia("(max-width: 1180px)").matches;

  const res = await fetch("./data/blog.json");
  const DATA = await res.json();
  const POSTS = DATA.posts || [];
  const BY_SLUG = Object.fromEntries(POSTS.map((p) => [p.slug, p]));
  const DOMAINS = DATA.domains || [];

  const viewOverview = document.getElementById("view-overview");
  const viewRead = document.getElementById("view-read");
  const stage = document.getElementById("stage");
  const topicsEl = document.getElementById("topics");
  const tocList = document.getElementById("doctoc-list");
  const domainBtn = document.getElementById("domain-btn");
  const domainMenu = document.getElementById("domain-menu");
  const domainList = document.getElementById("domain-list");
  const domainName = document.getElementById("domain-name");
  const domainStat = document.getElementById("domain-stat");
  const readProgress = document.getElementById("read-progress");
  const prefPop = document.getElementById("pref-pop");
  const palette = document.getElementById("palette");
  const palIn = document.getElementById("cmd-input");
  const palRes = document.getElementById("cmd-list");
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbCap = document.getElementById("lightbox-cap");

  let currentView = "overview";
  let currentSlug = POSTS[0] ? POSTS[0].slug : "";
  let currentDomain = DOMAINS[0] ? DOMAINS[0].title : "";
  let ovCat = "all";
  let ovQuery = "";

  // ===== 外观设置（与本地阅读器 prefs.js 100% 同步：相同 key、相同字号范围 15–21px、相同标准/宽屏栏宽） =====
  const THEMES = ["paper", "light", "dark"];
  let fs = Math.max(15, Math.min(21, Number(getLS("elysia-fs", "17")) || 17));
  function setTheme(th) {
    const t = THEMES.includes(th) ? th : "paper";
    document.documentElement.dataset.theme = t;
    setLS("elysia-color-theme", t);
    document.querySelectorAll("#theme-swatches .swatch").forEach((b) => b.classList.toggle("on", b.dataset.th === t));
  }
  function setFs(v) {
    fs = Math.max(15, Math.min(21, v));
    document.documentElement.style.setProperty("--fs", fs + "px");
    setLS("elysia-fs", fs);
    const el = document.getElementById("fs-val");
    if (el) el.textContent = fs + "px";
  }
  function setWide(wide) {
    document.body.classList.toggle("wide", wide);
    setLS("elysia-wide", wide ? "1" : "0");
    document.getElementById("width-std")?.classList.toggle("on", !wide);
    document.getElementById("width-wide")?.classList.toggle("on", wide);
  }
  function setAnim(on) {
    setLS("elysia-anim", on ? "1" : "0");
    document.getElementById("anim-on")?.classList.toggle("on", on);
    document.getElementById("anim-off")?.classList.toggle("on", !on);
    window.ElysiaSvgAnim?.applyGlobalAnimPref(on);
  }
  function setZen(on) {
    document.body.classList.toggle("zen", on);
    document.getElementById("zen-toggle")?.classList.toggle("on", on);
  }
  setTheme(getLS("elysia-color-theme", "paper"));
  setFs(fs);
  setWide(getLS("elysia-wide", "0") === "1");
  setAnim(getLS("elysia-anim", "1") !== "0");

  document.getElementById("rail-pref").onclick = (e) => { e.stopPropagation(); prefPop.hidden = !prefPop.hidden; };
  document.querySelectorAll("#theme-swatches .swatch").forEach((b) => { b.onclick = () => setTheme(b.dataset.th); });
  document.getElementById("fs-dec").onclick = () => setFs(fs - 1);
  document.getElementById("fs-inc").onclick = () => setFs(fs + 1);
  document.getElementById("width-std").onclick = () => setWide(false);
  document.getElementById("width-wide").onclick = () => setWide(true);
  document.getElementById("anim-on")?.addEventListener("click", () => setAnim(true));
  document.getElementById("anim-off")?.addEventListener("click", () => setAnim(false));
  document.getElementById("zen-toggle").onclick = () => { setZen(!document.body.classList.contains("zen")); prefPop.hidden = true; };
  document.getElementById("zen-exit").onclick = () => setZen(false);

  document.getElementById("nav-collapse").onclick = () => {
    if (isMobile()) { document.body.classList.remove("mob-nav"); return; }
    document.body.classList.add("hide-nav");
  };
  document.getElementById("edge-open-nav").onclick = () => {
    if (isMobile()) { document.body.classList.remove("mob-aside"); document.body.classList.add("mob-nav"); return; }
    document.body.classList.remove("hide-nav");
  };
  document.getElementById("aside-collapse").onclick = () => {
    if (isMobile()) { document.body.classList.remove("mob-aside"); return; }
    document.body.classList.add("hide-aside");
  };
  document.getElementById("edge-open-aside").onclick = () => {
    if (isMobile()) { document.body.classList.remove("mob-nav"); document.body.classList.add("mob-aside"); return; }
    document.body.classList.remove("hide-aside");
  };

  // ===== 视图 1：总览（与本地 overview.js 同款 view-wrap wide = 1020px 宽度，无冗余标题） =====
  function renderOverview() {
    const cats = [{ id: "all", label: `全部 (${POSTS.length})` }, ...DOMAINS.map((d) => ({ id: d.title, label: `${d.title} (${d.posts.length})` }))];
    const filtered = POSTS.filter((p) => {
      const catOk = ovCat === "all" || p.category === ovCat;
      const q = ovQuery.trim().toLowerCase();
      const qOk = !q || (p.search_text || "").includes(q);
      return catOk && qOk;
    });

    viewOverview.innerHTML = `
      <div class="view-wrap wide blog-ov-wrap">
        <div class="input-row" style="margin-bottom:14px;align-items:center;flex-wrap:wrap">
          <div class="pill-row" style="margin:0;flex:1">
            ${cats.map((c) => `<button type="button" class="pill-btn ${ovCat === c.id ? "on" : ""}" data-cat="${esc(c.id)}">${esc(c.label)}</button>`).join("")}
          </div>
          <input id="ov-q" class="v-input" style="max-width:240px;flex:none" value="${esc(ovQuery)}" placeholder="筛选文章标题或关键词...">
        </div>

        <div class="sec-h" style="margin-top:20px"><span>已发布文章（${filtered.length}）</span></div>
        ${filtered.length ? filtered.map((p) => `
          <div class="v-card clickable blog-ov-card" data-open-slug="${esc(p.slug)}">
            <div class="v-head">
              <div>
                <div class="v-meta" style="margin-bottom:6px">
                  <span class="crumb-pill" style="margin-right:6px">${esc(p.category)}</span>
                  ${esc(p.date)} · 约 ${p.chars} 字 · ${p.reading_minutes} 分钟
                </div>
                <div class="v-title" style="font-size:18px">${esc(p.card_title)}</div>
              </div>
              <span class="v-arrow">→</span>
            </div>
            ${p.card_title !== p.title ? `<div class="blog-ov-sub">${esc(p.title)}</div>` : ""}
            <p class="blog-ov-excerpt">${esc(p.excerpt)}</p>
          </div>
        `).join("") : '<p class="v-meta" style="padding:18px 0">当前筛选条件下暂无已发布文章。</p>'}
      </div>
    `;

    viewOverview.querySelectorAll("[data-cat]").forEach((b) => {
      b.onclick = () => { ovCat = b.dataset.cat; renderOverview(); };
    });
    const qInput = document.getElementById("ov-q");
    if (qInput) {
      qInput.oninput = () => { ovQuery = qInput.value; renderOverview(); const el = document.getElementById("ov-q"); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
    }
    viewOverview.querySelectorAll("[data-open-slug]").forEach((c) => {
      c.onclick = () => openSlug(c.dataset.openSlug);
    });
  }

  // ===== 视图 2：1:1 本地三栏精读工作台 =====
  function renderSidebar() {
    const dom = DOMAINS.find((d) => d.title === currentDomain) || DOMAINS[0];
    if (!dom) { topicsEl.innerHTML = ""; return; }
    currentDomain = dom.title;
    domainName.textContent = dom.title;
    domainStat.textContent = `${dom.posts.length} 篇`;

    domainList.innerHTML = DOMAINS.map((d) => `
      <button type="button" class="domain-opt ${d.title === currentDomain ? "on" : ""}" data-dom="${esc(d.title)}">
        <span>${esc(d.title)}</span>
        <span class="domain-opt-meta">${d.posts.length} 篇</span>
      </button>
    `).join("");
    domainList.querySelectorAll("[data-dom]").forEach((b) => {
      b.onclick = () => {
        currentDomain = b.dataset.dom;
        domainMenu.hidden = true;
        renderSidebar();
        const targetDom = DOMAINS.find((d) => d.title === currentDomain);
        if (targetDom && targetDom.posts.length && !targetDom.posts.some((p) => p.slug === currentSlug)) {
          openSlug(targetDom.posts[0].slug);
        }
      };
    });

    const groups = [];
    const byG = new Map();
    dom.posts.forEach((p) => {
      const g = p.group || "精选文章";
      if (!byG.has(g)) { byG.set(g, []); groups.push(g); }
      byG.get(g).push(p);
    });

    topicsEl.innerHTML = groups.map((g) => {
      const list = byG.get(g);
      return `<div class="lane">${esc(g)}</div>` + list.map((p, idx) => `
        <a class="doc ${p.slug === currentSlug ? "on" : ""}" href="#read/${encodeURIComponent(p.slug)}" data-slug="${esc(p.slug)}">
          <span class="n">${idx + 1}</span>
          <span class="label">${esc(p.card_title)}</span>
        </a>
      `).join("");
    }).join("");

    topicsEl.querySelectorAll("a[data-slug]").forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        document.body.classList.remove("mob-nav");
        openSlug(a.dataset.slug);
      };
    });
  }

  function renderToc(toc) {
    const items = (toc || []).filter((t) => t.level === 2 || t.level === 3);
    if (!items.length) { tocList.innerHTML = '<p class="v-meta" style="padding:8px 10px">无二级目录</p>'; return; }
    tocList.innerHTML = items.map((t) => `
      <a class="${t.level === 3 ? "toc-l3" : ""}" href="#${esc(t.id)}" data-tid="${esc(t.id)}">${esc(t.text)}</a>
    `).join("");
    tocList.querySelectorAll("a[data-tid]").forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        document.body.classList.remove("mob-aside");
        const el = document.getElementById(a.dataset.tid);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });
  }

  function renderPost(slug) {
    const post = BY_SLUG[slug] || POSTS[0];
    if (!post) {
      stage.innerHTML = '<article class="sheet"><p class="v-meta">暂无已发布文章。</p></article>';
      return;
    }
    currentSlug = post.slug;
    currentDomain = post.category;
    document.title = `${post.card_title} · ${DATA.site_title}`;
    renderSidebar();

    const dom = DOMAINS.find((d) => d.title === post.category);
    const siblings = dom ? dom.posts : POSTS;
    const pos = siblings.findIndex((x) => x.slug === post.slug);
    const prev = pos > 0 ? siblings[pos - 1] : null;
    const next = pos >= 0 && pos + 1 < siblings.length ? siblings[pos + 1] : null;
    const hasTips = (post.html || "").includes('data-callout="tip"');

    const pagerHtml = (prev || next) ? `<nav class="pager">
      ${prev ? `<a rel="prev" href="#read/${encodeURIComponent(prev.slug)}" data-slug="${esc(prev.slug)}">← 上一篇<span>${esc(prev.card_title)}</span></a>` : "<span></span>"}
      ${next ? `<a rel="next" href="#read/${encodeURIComponent(next.slug)}" data-slug="${esc(next.slug)}">下一篇 →<span>${esc(next.card_title)}</span></a>` : "<span></span>"}
    </nav>` : "";

    stage.innerHTML = `
      <article class="sheet">
        <div class="meta-head">
          <div class="crumb-row">
            <span class="crumb-pill">${esc(post.category)}</span>
            ${post.card_title !== post.title ? `<span>${esc(post.card_title)}</span><span>·</span>` : ""}
            <span>${esc(post.date)}</span>
            <span>·</span>
            <span>约 ${post.chars} 字 · ${post.reading_minutes} 分钟</span>
          </div>
          <div class="meta-controls">
            ${hasTips ? '<button type="button" id="toggle-tips" class="act-btn">展开答案</button>' : ""}
          </div>
        </div>
        <div id="body">${post.html}</div>
        ${pagerHtml}
      </article>
    `;

    renderToc(post.toc);

    const bodyEl = document.getElementById("body");
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
      btn.onclick = async () => {
        const code = btn.closest(".code-wrap")?.querySelector("code")?.textContent || "";
        try { await navigator.clipboard.writeText(code); btn.textContent = "已复制"; setTimeout(() => { btn.textContent = "复制"; }, 1400); } catch (_) {}
      };
    });
    const openLightbox = (src, cap) => {
      lbImg.src = src;
      if (lbCap) lbCap.textContent = cap || "";
      lightbox.hidden = false;
    };
    bodyEl.querySelectorAll("img").forEach((img) => {
      img.onclick = () => {
        const cap = img.nextElementSibling && img.nextElementSibling.tagName === "EM" ? img.nextElementSibling.textContent : img.alt;
        openLightbox(img.src, cap);
      };
    });
    window.ElysiaSvgAnim?.enhanceAnimatedSvgs(bodyEl, openLightbox);
    stage.querySelectorAll("a[data-slug]").forEach((a) => {
      a.onclick = (e) => { e.preventDefault(); openSlug(a.dataset.slug); };
    });
    const tipBtn = document.getElementById("toggle-tips");
    if (tipBtn) {
      tipBtn.onclick = () => {
        const tips = [...stage.querySelectorAll('details.callout[data-callout="tip"]')];
        const allOpen = tips.every((d) => d.open);
        tips.forEach((d) => { d.open = !allOpen; });
        tipBtn.textContent = allOpen ? "展开答案" : "收起答案";
      };
    }
    window.scrollTo(0, 0);
    onScroll();
  }

  // ===== 路由与视图切换 =====
  function showView(v, slug) {
    currentView = v;
    document.body.dataset.view = v;
    document.body.classList.remove("mob-nav", "mob-aside");
    viewOverview.hidden = v !== "overview";
    viewRead.hidden = v !== "read";
    document.querySelectorAll(".top-nav .nav-link").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
    if (v === "overview") {
      document.title = DATA.site_title;
      renderOverview();
    } else {
      renderPost(slug || currentSlug);
    }
  }
  function openSlug(slug) {
    const next = "#read/" + encodeURIComponent(slug);
    if (location.hash === next) showView("read", slug);
    else location.hash = next;
  }
  function syncRoute() {
    const h = location.hash || "";
    if (h.startsWith("#read/")) {
      const slug = safeDecode(h.slice(6).split("::")[0]);
      showView("read", slug);
    } else {
      showView("overview");
    }
  }

  // ===== ⌘K 全文搜索浮窗（复用 shell.css 原生 cmd-box 样式） =====
  function renderPalette(q) {
    const kw = (q || "").trim().toLowerCase();
    const hits = POSTS.filter((p) => !kw || (p.search_text || "").includes(kw)).slice(0, 12);
    palRes.innerHTML = hits.length ? hits.map((p) => `
      <div class="cmd-item" data-pslug="${esc(p.slug)}">
        <div class="cmd-item-head">
          <span class="cmd-tag">${esc(p.category)}</span>
          <strong>${esc(p.card_title)}</strong>
        </div>
        <small>${esc(p.card_title !== p.title ? p.title : p.excerpt)}</small>
      </div>
    `).join("") : '<p class="v-meta" style="padding:14px">未找到匹配文章</p>';
    palRes.querySelectorAll("[data-pslug]").forEach((b) => {
      b.onclick = () => { palette.hidden = true; openSlug(b.dataset.pslug); };
    });
  }
  function openPalette() { palette.hidden = false; palIn.value = ""; renderPalette(""); setTimeout(() => palIn.focus(), 10); }
  document.getElementById("rail-search").onclick = openPalette;
  palIn.oninput = () => renderPalette(palIn.value);
  palette.onclick = (e) => { if (e.target === palette) palette.hidden = true; };

  // ===== 滚动进度条 & 右侧目录跟随高亮 =====
  function onScroll() {
    if (currentView !== "read") return;
    const maxS = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    readProgress.style.transform = `scaleX(${Math.min(1, Math.max(0, window.scrollY / maxS))})`;
    const links = [...tocList.querySelectorAll("a[data-tid]")];
    if (!links.length) return;
    let curId = links[0].dataset.tid;
    for (const a of links) {
      const el = document.getElementById(a.dataset.tid);
      if (el && el.getBoundingClientRect().top <= 112) curId = a.dataset.tid;
    }
    links.forEach((a) => a.classList.toggle("on", a.dataset.tid === curId));
  }
  addEventListener("scroll", onScroll, { passive: true });

  // ===== 顶栏 & 全局快捷键 =====
  document.getElementById("brand-btn").onclick = () => { location.hash = "#overview"; };
  document.querySelectorAll(".top-nav .nav-link").forEach((b) => {
    b.onclick = () => {
      if (b.dataset.view === "read" && currentSlug) location.hash = "#read/" + encodeURIComponent(currentSlug);
      else location.hash = "#" + b.dataset.view;
    };
  });
  domainBtn.onclick = (e) => { e.stopPropagation(); domainMenu.hidden = !domainMenu.hidden; };
  lightbox.onclick = (e) => { if (e.target === lightbox || e.target.id === "lightbox-close") lightbox.hidden = true; };
  document.addEventListener("click", (e) => {
    if (!domainMenu.hidden && !domainMenu.contains(e.target) && !domainBtn.contains(e.target)) domainMenu.hidden = true;
    if (!prefPop.hidden && !prefPop.contains(e.target) && e.target.id !== "rail-pref") prefPop.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
    if (e.key === "Escape") { palette.hidden = true; prefPop.hidden = true; lightbox.hidden = true; document.body.classList.remove("mob-nav", "mob-aside"); setZen(false); return; }
    if (["INPUT", "TEXTAREA", "SELECT"].includes((document.activeElement?.tagName || "").toUpperCase())) return;
    if (e.key === "/") { e.preventDefault(); openPalette(); }
    else if (e.key === "1") location.hash = "#overview";
    else if (e.key === "2" && currentSlug) location.hash = "#read/" + encodeURIComponent(currentSlug);
    else if (e.key.toLowerCase() === "d") { const cur = document.documentElement.dataset.theme || "paper"; setTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]); }
    else if (e.key.toLowerCase() === "f" && currentView === "read") setZen(!document.body.classList.contains("zen"));
    else if (e.key.toLowerCase() === "b" && currentView === "read") {
      document.body.classList.toggle("hide-nav");
    }
  });

  addEventListener("hashchange", syncRoute);
  syncRoute();
})();
