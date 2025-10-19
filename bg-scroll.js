(function () {
  'use strict';

  const root = document.documentElement;
  
  const TOP_COLOR_HEX = '#071025';   // exact original top color (kept unchanged at scroll top)
  const END_COLOR_HEX = '#02121b';   // original gradient end
  const STEPS = 30;                  // number of discrete colors across scroll (more => finer changes)
  const HUE_SPREAD = 360;            // degrees of hue spanned across the steps
  const SATURATION = 36;             // saturation % (keeps tones muted)
  const LIGHTNESS_MIN = 6;           // lightness % at top
  const LIGHTNESS_MAX = 12;          // lightness % at full scroll
  const BOTTOM_BLEND_START = 0.92;   // last fraction of page where we blend back toward dark top
  const TOP_DARKEN_AT_BOTTOM = 8;    // how much darker (in L%) top becomes at final page
  const TWEEN_SPEED = 0.22;          // per-frame lerp speed toward target (0..1). smaller = slower
  const END_CROSSFADE_MAX = 0.30;    // max amount the computed color influences the gradient-end (0..1)

  // convert hex -> {r,g,b}
  function hexToRgb(hex) {
    hex = (hex || '').replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }

  // rgb -> hsl (h in deg 0..360, s,l in 0..100)
  function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h: (h || 0), s: s * 100, l: l * 100 };
  }

  // hsl -> css string
  function hslToCss(hsl) {
    return `hsl(${(hsl.h).toFixed(2)}, ${(hsl.s).toFixed(2)}%, ${(hsl.l).toFixed(2)}%)`;
  }

  // shortest-path hue interpolatiob (handles wraparound)
  function interpHue(a, b, t) {
    let d = ((b - a + 540) % 360) - 180;
    return (a + d * t + 360) % 360;
  }

  // generic lerp
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ease for smooth feel inside a step
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  const STYLE_ID = 'bg-scroll-opt-style';
  let styleEl = document.getElementById(STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      :root {
        --bg: ${TOP_COLOR_HEX};
        --bg-end: ${END_COLOR_HEX};
      }
      html, body {
        background: linear-gradient(180deg, var(--bg) 0%, var(--bg-end) 140%) !important;
        will-change: background;
      }
    `;
    document.head.appendChild(styleEl);
  }

  // parse base colors
  const topRgb = hexToRgb(TOP_COLOR_HEX);
  const topHsl = rgbToHsl(topRgb);
  const endRgb = hexToRgb(END_COLOR_HEX);
  const endHsl = rgbToHsl(endRgb);

  // compute per-step hue increment (anchor start at topHsl.h)
  const deltaHue = HUE_SPREAD / Math.max(1, STEPS - 1);

  // cache layout metrics
  let maxScroll = 0;
  function recomputeLayout() {
    const docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      document.documentElement.offsetHeight
    );
    const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
    maxScroll = Math.max(0, docHeight - viewport);
  }

  // compute color HSL pair (bgHsl, endHsl) given frac in [0,1]
  function computeTargetHSL(frac) {
    if (frac <= 0) {
      return {
        bg: { h: topHsl.h, s: topHsl.s, l: topHsl.l },
        end: { h: endHsl.h, s: endHsl.s, l: endHsl.l },
      };
    }
    const f = Math.max(0, Math.min(1, frac));
    const pos = f * (STEPS - 1);
    const idx = Math.floor(pos);
    const local = pos - idx;
    const t = easeInOutCubic(local);

    const hueA = (topHsl.h + idx * deltaHue) % 360;
    const hueB = (topHsl.h + Math.min(idx + 1, STEPS - 1) * deltaHue) % 360;
    const hue = interpHue(hueA, hueB, t);

    let lightness = lerp(LIGHTNESS_MIN, LIGHTNESS_MAX, f);

    if (f >= BOTTOM_BLEND_START) {
      const localBottom = (f - BOTTOM_BLEND_START) / Math.max(1e-6, 1 - BOTTOM_BLEND_START);
      const darkTopL = Math.max(0, topHsl.l - TOP_DARKEN_AT_BOTTOM);
      const hueBack = interpHue(hue, topHsl.h, localBottom * 0.85);
      const sBack = lerp(SATURATION, SATURATION * 0.92, localBottom);
      const lBack = lerp(lightness, darkTopL, localBottom);
      const bgHsl = { h: hueBack, s: sBack, l: lBack };

      const mix = Math.min(END_CROSSFADE_MAX, f * END_CROSSFADE_MAX);
      const endH = interpHue(endHsl.h, bgHsl.h, mix);
      const endS = lerp(endHsl.s, bgHsl.s, mix * 0.7);
      const endL = lerp(endHsl.l, bgHsl.l, mix * 0.9);

      return { bg: bgHsl, end: { h: endH, s: endS, l: endL }, idx };
    }

    const bgHsl = { h: hue, s: SATURATION, l: lightness };
    const mix = Math.min(END_CROSSFADE_MAX, 0.02 + f * END_CROSSFADE_MAX);
    const endH = interpHue(endHsl.h, bgHsl.h, mix);
    const endS = lerp(endHsl.s, bgHsl.s, mix * 0.7);
    const endL = lerp(endHsl.l, bgHsl.l, mix * 0.9);

    return { bg: bgHsl, end: { h: endH, s: endS, l: endL }, idx };
  }

  // small helpers for color compare and per-frame lerp of HSL
  function closeEnough(a, b, eps = 0.02) {
    return Math.abs(a - b) <= eps;
  }
  function hslCloseEnough(a, b, eps = 0.02) {
    return closeEnough(a.h, b.h, eps * 10) && closeEnough(a.s, b.s, eps * 100) && closeEnough(a.l, b.l, eps * 100);
  }
  function lerpHsl(a, b, t) {
    return {
      h: interpHue(a.h, b.h, t),
      s: lerp(a.s, b.s, t),
      l: lerp(a.l, b.l, t),
    };
  }

  // state for tweening
  let currentBg = { h: topHsl.h, s: topHsl.s, l: topHsl.l };
  let currentEnd = { h: endHsl.h, s: endHsl.s, l: endHsl.l };
  let targetBg = currentBg;
  let targetEnd = currentEnd;
  let lastStepIdx = -1;
  let ticking = false;
  let needStyleWrite = true; // write intial

  // tiny function to apply CSS variables when current values changed enough
  function applyIfChanged() {
    // convert to CSS strings
    const bgCss = hslToCss(currentBg);
    const endCss = hslToCss(currentEnd);
    
    const prevBg = getComputedStyle(root).getPropertyValue('--bg').trim();
    const prevEnd = getComputedStyle(root).getPropertyValue('--bg-end').trim();
    if (prevBg !== bgCss || prevEnd !== endCss || needStyleWrite) {
      root.style.setProperty('--bg', bgCss);
      root.style.setProperty('--bg-end', endCss);
      needStyleWrite = false;
    }
  }

  // rAF loop to gradually move current colors toward target colors
  function tick() {
    ticking = true;
    currentBg = lerpHsl(currentBg, targetBg, TWEEN_SPEED);
    currentEnd = lerpHsl(currentEnd, targetEnd, TWEEN_SPEED);

    applyIfChanged();

    // stop ticking when close enough
    if (hslCloseEnough(currentBg, targetBg, 0.05) && hslCloseEnough(currentEnd, targetEnd, 0.05)) {
      // snap exact (avoid lingering tiny diffs)
      currentBg = targetBg = { ...targetBg };
      currentEnd = targetEnd = { ...targetEnd };
      applyIfChanged();
      ticking = false;
      return;
    }

    requestAnimationFrame(tick);
  }
  
  function onScroll() {
    const scrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);
    const frac = maxScroll > 0 ? Math.min(1, scrollY / maxScroll) : 0;

    // compute discrete pos & idx to minimize churn
    const pos = frac * (STEPS - 1);
    const idx = Math.floor(pos);

    // if index changed, compute new tagret HSL (expensive-ish) and kick tween
    if (idx !== lastStepIdx) {
      lastStepIdx = idx;
      const { bg, end } = computeTargetHSL(frac);
      targetBg = bg;
      targetEnd = end;
      // start rAF tween if not running
      if (!ticking) requestAnimationFrame(tick);
    } else {
      // inside same step we still want a subtle motion when local t changes meaningfully.
      // compute local eased t and apply if different enough (cheap check).
      const { bg, end } = computeTargetHSL(frac);
      // If the computed bg differs noticeably from the current target, update target.
      if (!hslCloseEnough(bg, targetBg, 0.25) || !hslCloseEnough(end, targetEnd, 0.25)) {
        targetBg = bg;
        targetEnd = end;
        if (!ticking) requestAnimationFrame(tick);
      }
    }
  }

  // finaly
  function init() {
    // ensure exact top color at load
    root.style.setProperty('--bg', TOP_COLOR_HEX);
    root.style.setProperty('--bg-end', END_COLOR_HEX);
    needStyleWrite = true;

    recomputeLayout();
    // handle cases where page is already scrolled
    onScroll();

    // lightweight listeners
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', recomputeLayout, { passive: true });

    // observe content/size changes to recompute layout
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(recomputeLayout);
      ro.observe(document.documentElement);
      ro.observe(document.body);
    }

    // MutationObserver fallback to recompute layout if content changes drastically (rare)
    if (window.MutationObserver) {
      const mo = new MutationObserver(() => {
        // debounce a little
        setTimeout(recomputeLayout, 50);
      });
      mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
