// 动图 SVG 交互控制引擎（本地阅读器与静态博客共用，零依赖）
// 自动识别含 @keyframes 的 SVG，将其安全作用域化并内联，提供：暂停/播放、①②③④ 单步定格、全局开关与放大灯箱。
(function (global) {
  let seq = 0;

  function getAnimPref() {
    try {
      const v = localStorage.getItem("elysia-anim");
      if (v === "0" || v === "1") return v === "1";
    } catch (_) {}
    return true;
  }

  // 将 SVG 内部 <style> 规则与 id/url(#...) 加上唯一作用域前缀，避免多图或与宿主页冲突
  function scopeSvgMarkup(raw, scopeId) {
    let s = raw.replace(/<\?xml[\s\S]*?\?>/gi, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "").trim();

    // 1. 收集并重写 id="xxx" -> id="scopeId-xxx"
    const ids = new Set();
    s.replace(/\bid="([^"]+)"/g, (_, id) => { ids.add(id); return ""; });
    if (ids.size) {
      ids.forEach((id) => {
        const safe = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const nid = `${scopeId}-${id}`;
        s = s.replace(new RegExp(`\\bid="${safe}"`, "g"), `id="${nid}"`);
        s = s.replace(new RegExp(`url\\(#${safe}\\)`, "g"), `url(#${nid})`);
        s = s.replace(new RegExp(`(xlink:href|href)="#${safe}"`, "g"), `$1="#${nid}"`);
      });
    }

    // 2. 给 <style> 中非 @keyframes 的普通规则加上 .scopeId 前缀，同时重命名 @keyframes 防止撞名
    s = s.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (m, css) => {
      const kfNames = [];
      let out = css.replace(/@keyframes\s+([a-zA-Z0-9_-]+)/g, (_, name) => {
        kfNames.push(name);
        return `@keyframes ${scopeId}-${name}`;
      });
      // 把 animation: name ... 中的 keyframes 名字同步改名
      kfNames.forEach((name) => {
        const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(`(animation(?:-name)?\\s*:[^;]*?)\\b${safe}\\b`, "g"), `$1${scopeId}-${name}`);
      });

      // 分离 @keyframes 块后给普通选择器加 .scopeId 前缀
      const blocks = [];
      let i = 0;
      let res = "";
      while (i < out.length) {
        const idx = out.indexOf("@keyframes", i);
        const chunk = idx === -1 ? out.slice(i) : out.slice(i, idx);
        res += chunk.replace(/(^|[}\n])\s*([^{}@\n][^{}]*?)\s*\{/g, (all, pre, sel) => {
          const trimmed = sel.trim();
          if (!trimmed || trimmed.startsWith("/*")) return all;
          const scopedSel = trimmed
            .split(",")
            .map((part) => `.${scopeId} ${part.trim()}`)
            .join(", ");
          return `${pre} ${scopedSel} {`;
        });
        if (idx === -1) break;
        // 找到 @keyframes 对应的大括号闭合位置
        let depth = 0;
        let j = idx;
        let started = false;
        while (j < out.length) {
          if (out[j] === "{") { depth++; started = true; }
          else if (out[j] === "}") { depth--; if (started && depth === 0) { j++; break; } }
          j++;
        }
        blocks.push(out.slice(idx, j));
        res += `\n__KF_BLOCK_${blocks.length - 1}__\n`;
        i = j;
      }
      blocks.forEach((blk, k) => {
        res = res.replace(`__KF_BLOCK_${k}__`, blk);
      });
      return `<style>${res}</style>`;
    });

    // 3. 给根 <svg> 加上 scopeId class，确保样式作用域生效
    s = s.replace(/<svg\b([^>]*)>/i, (tag, attrs) => {
      if (/\bclass="/i.test(attrs)) {
        return `<svg${attrs.replace(/\bclass="([^"]*)"/i, `class="$1 ${scopeId}"`)}>`;
      }
      return `<svg class="${scopeId}"${attrs}>`;
    });
    return s;
  }

  function setSvgPlayState(fig, play, stepIndex) {
    const svg = fig.querySelector(".anim-stage svg");
    if (!svg) return;
    fig.dataset.playing = play ? "1" : "0";
    fig.dataset.step = stepIndex != null ? String(stepIndex) : "";
    fig.classList.toggle("is-paused", !play);

    const anims = typeof svg.getAnimations === "function" ? svg.getAnimations({ subtree: true }) : [];
    const stepTimes = [1000, 3000, 5000, 7000]; // 8s 4 阶段每段中点（0-2s / 2-4s / 4-6s / 6-8s）

    if (anims.length) {
      anims.forEach((a) => {
        try {
          if (stepIndex != null) {
            const timing = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
            const dur = timing && typeof timing.duration === "number" ? timing.duration : 0;
            a.pause();
            if (dur >= 7000 && dur <= 9000) {
              a.currentTime = stepTimes[stepIndex] ?? 1000;
            }
          } else if (play) {
            a.play();
          } else {
            a.pause();
          }
        } catch (_) {}
      });
    } else {
      // 极旧浏览器兜底：用 CSS animation-play-state 控制
      svg.style.setProperty("--anim-state", play ? "running" : "paused");
    }

    const playBtn = fig.querySelector('[data-act="toggle"]');
    if (playBtn) {
      playBtn.textContent = play ? "⏸ 暂停" : "▶ 播放";
      playBtn.classList.toggle("on", play);
    }
    fig.querySelectorAll("[data-step-btn]").forEach((b) => {
      const on = !play && stepIndex != null && Number(b.dataset.stepBtn) === stepIndex;
      b.classList.toggle("on", on);
    });
  }

  async function upgradeOneImage(img, onLightbox) {
    const src = img.getAttribute("src") || "";
    if (!src || !/\.svg(\?|#|$)/i.test(src) || img.dataset.animChecked) return;
    img.dataset.animChecked = "1";

    let text = "";
    try {
      const resp = await fetch(src);
      if (!resp.ok) return;
      text = await resp.text();
    } catch (_) {
      return;
    }
    if (!/@keyframes\b/.test(text) || !/<svg\b/i.test(text)) return;

    const isFourStep = /\b8s\b/.test(text) && /(step4|pill4|p4\b|s4\b)/i.test(text);
    const scopeId = `asvg-${++seq}`;
    const scoped = scopeSvgMarkup(text, scopeId);
    const alt = img.getAttribute("alt") || "";
    const parentP = img.parentElement;
    // 读取紧跟在 <img> 后面的图注 <em>
    const nextEm = img.nextElementSibling && img.nextElementSibling.tagName === "EM" ? img.nextElementSibling : null;
    const capText = nextEm ? nextEm.textContent : alt;

    const fig = document.createElement("div");
    fig.className = "anim-fig";
    fig.dataset.src = src;

    const bar = document.createElement("div");
    bar.className = "anim-bar";
    bar.innerHTML = `
      <div class="anim-bar-left">
        <button type="button" class="anim-btn" data-act="toggle" title="暂停或恢复动图播放">⏸ 暂停</button>
        ${isFourStep ? `
          <span class="anim-sep" aria-hidden="true"></span>
          <span class="anim-lbl">单步定格</span>
          <button type="button" class="anim-step" data-step-btn="0" title="定格在第 1 步">①</button>
          <button type="button" class="anim-step" data-step-btn="1" title="定格在第 2 步">②</button>
          <button type="button" class="anim-step" data-step-btn="2" title="定格在第 3 步">③</button>
          <button type="button" class="anim-step" data-step-btn="3" title="定格在第 4 步">④</button>
        ` : ""}
      </div>
      <button type="button" class="anim-btn anim-zoom" data-act="zoom" title="全屏放大查看">⤢ 放大</button>
    `;

    const stage = document.createElement("div");
    stage.className = "anim-stage";
    stage.innerHTML = scoped;
    const svgEl = stage.querySelector("svg");
    if (!svgEl) return;
    svgEl.removeAttribute("width");
    svgEl.removeAttribute("height");

    fig.appendChild(bar);
    fig.appendChild(stage);

    // 替换原 <img>（若原 <img> 和 <em> 同在一个 <p> 内，将 fig 置于 <p> 前面并保留 <p> 里的图注）
    if (parentP && parentP.tagName === "P") {
      parentP.parentNode.insertBefore(fig, parentP);
      img.remove();
      if (!parentP.textContent.trim() && !parentP.querySelector("img")) {
        parentP.remove();
      } else {
        parentP.classList.add("anim-cap");
      }
    } else {
      img.replaceWith(fig);
    }

    bar.querySelector('[data-act="toggle"]').onclick = (e) => {
      e.stopPropagation();
      const nowPlay = fig.dataset.playing === "1";
      setSvgPlayState(fig, !nowPlay, null);
    };
    bar.querySelectorAll("[data-step-btn]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        setSvgPlayState(fig, false, Number(btn.dataset.stepBtn));
      };
    });
    const openZoom = () => {
      if (typeof onLightbox === "function") onLightbox(src, capText);
    };
    bar.querySelector('[data-act="zoom"]').onclick = (e) => {
      e.stopPropagation();
      openZoom();
    };
    stage.onclick = openZoom;

    // 下一帧应用全局默认偏好（若用户关了动图自动播放，默认定格在第 1 步或当前帧）
    requestAnimationFrame(() => {
      const autoPlay = getAnimPref();
      setSvgPlayState(fig, autoPlay, autoPlay ? null : (isFourStep ? 0 : null));
    });
  }

  function enhanceAnimatedSvgs(container, onLightbox) {
    if (!container) return;
    const imgs = [...container.querySelectorAll("img")];
    imgs.forEach((img) => { upgradeOneImage(img, onLightbox); });
  }

  function applyGlobalAnimPref(play) {
    document.querySelectorAll(".anim-fig").forEach((fig) => {
      const hasSteps = Boolean(fig.querySelector("[data-step-btn]"));
      setSvgPlayState(fig, play, play ? null : (hasSteps ? 0 : null));
    });
  }

  global.ElysiaSvgAnim = {
    getAnimPref,
    enhanceAnimatedSvgs,
    applyGlobalAnimPref,
  };
})(window);
