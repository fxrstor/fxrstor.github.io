(() => {
    const THEME_KEY = 'fxrstor_theme';

    const el = id => document.getElementById(id);
    const qs = s => document.querySelector(s);
    const once = (ev, fn, opt) => document.addEventListener(ev, fn, opt);

    // apply theme ('cool' or 'dark')
    function applyTheme(name) {
        if (name === 'cool') document.documentElement.setAttribute('data-theme', 'cool');
        else document.documentElement.removeAttribute('data-theme');
        el('theme-toggle')?.setAttribute('aria-pressed', name === 'cool' ? 'true' : 'false');
        localStorage.setItem(THEME_KEY, name);
    }

    // compact toast system (CSS handles transitions)
    function ensureToastContainer() {
        let c = el('__site_toast_container');
        if (!c) {
            c = document.createElement('div'); c.id = '__site_toast_container';
            document.body.appendChild(c);
        }
        return c;
    }
    window.showSiteToast = (msg, timeout = 2000) => {
        const c = ensureToastContainer();
        // avoid duplicates
        if ([...c.children].some(ch => ch.dataset.msg === msg)) return;
        const t = document.createElement('div');
        t.className = 'site-toast'; t.dataset.msg = msg; t.textContent = msg;
        c.appendChild(t);
        // show
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.remove(), 240);
        }, timeout);
    };

    once('DOMContentLoaded', () => {
        // theme init: prefer saved, else detect prefers-color-scheme
        const saved = localStorage.getItem(THEME_KEY);
        const prefer = window.matchMedia && window.matchMedia('(prefers-color-scheme:light)').matches ? 'cool' : 'dark';
        applyTheme(saved === 'cool' || saved === 'dark' ? saved : prefer);

        // theme toggle wiring (delegated)
        const toggle = el('theme-toggle');
        toggle?.addEventListener('click', () => {
            const cur = document.documentElement.getAttribute('data-theme') === 'cool' ? 'cool' : 'dark';
            applyTheme(cur === 'cool' ? 'dark' : 'cool');
        });

        // banner pause on hover/focus (accessible)
        const track = qs('.site-banner-track');
        if (track) {
            ['mouseenter', 'focus', 'touchstart'].forEach(e => track.addEventListener(e, () => track.style.animationPlayState = 'paused', { passive: true }));
            ['mouseleave', 'blur', 'touchend'].forEach(e => track.addEventListener(e, () => track.style.animationPlayState = 'running', { passive: true }));
            track.addEventListener('keydown', e => {
                if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); track.style.animationPlayState = getComputedStyle(track).animationPlayState === 'paused' ? 'running' : 'paused'; }
            });
        }

        // format blog link dates: match YYYY/MM/DD anywhere in href
        [...document.querySelectorAll('a[href]')].forEach(a => {
            const m = a.href.match(/20\d{2}\/\d{2}\/\d{2}/);
            if (m) {
                const d = m[0].replace(/\//g, '-');
                const parsed = Date.parse(d);
                if (!Number.isNaN(parsed)) a.innerHTML = `${new Date(parsed).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}: ${a.innerHTML}`;
            }
        });

        // name reveal / hold (compact)
        const nameEl = el('mystery-name');
        if (nameEl) {
            const reveal = () => showSiteToast("wouldn't you like to know, weather boy?");
            nameEl.addEventListener('click', reveal);
            nameEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); } });
            // long-press hint
            let timer = 0;
            const start = () => timer = window.setTimeout(() => showSiteToast("Alright, here's a tiny secret: try clicking the site title (twice)!"), 1200);
            const clear = () => { clearTimeout(timer); timer = 0; };
            nameEl.addEventListener('pointerdown', start);
            document.addEventListener('pointerup', clear);
        }

        // title double-click => disco mode
        const title = el('title');
        if (title) {
            title.addEventListener('dblclick', () => {
                document.body.classList.toggle('disco');
                if (document.body.classList.contains('disco')) {
                    const orig = title.innerText;
                    title.innerText = 'DISCO MODE ✨';
                    showSiteToast('Disco mode on!');
                    setTimeout(() => title.innerText = orig, 2500);
                } else showSiteToast('Disco mode off');
            });
        }

        // konami
        const konami = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65, 13]; let p = 0;
        document.addEventListener('keydown', e => {
            if (e.keyCode === konami[p]) { p++; if (p === konami.length) { p = 0; showSiteToast("Konami! You found the secret stash of ASCII art: (>^_^)><(^_^<)"); } }
            else p = 0;
        });

        // restart typewriter on visibilitychange
        document.addEventListener('visibilitychange', () => {
            const tw = qs('.topper .typewriter'); if (!tw) return;
            tw.style.animation = 'none'; void tw.offsetWidth; tw.style.animation = '';
        });
    });

})();
