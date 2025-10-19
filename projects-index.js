const PROJECTS = [
  {
    name: "ThrottleStopPoC",
    repo: "fxrstor/ThrottleStopPoC",
    description: "A PoC on CVE-2025-7771: exploiting arbitrary ring0 physical memory and I/O port read/write. Written in C.",
    language: "C",
    href: "https://github.com/fxrstor/ThrottleStopPoC"
  },
  {
    name: "SectorIO",
    repo: "fxrstor/SectorIO",
    description: "Kernel mode driver for arbitrary sector read and write on the physical disk. Written in C++.",
    language: "C++",
    href: "https://github.com/fxrstor/SectorIO"
  },
  {
    name: "jds",
    repo: "fxrstor/jds",
    description: "Julia Set renderer written in C (private currently).",
    language: "C",
    href: "https://github.com/fxrstor/jds"
  },
  {
    name: "defer",
    repo: "fxrstor/defer",
    description: "Tiny C++ implementation of golang `defer` keyword.",
    language: "C++"
  },
  {
    name: "SigScanner",
    repo: "fxrstor/SigScanner",
    description: "A simple PE function signature dumper written in C11 with no external dependencies.",
    language: "C"
  },
  {
    name: "Moonstone",
    repo: "fxrstor/Moonstone",
    description: "A simple cipher based on XOR",
    language: "C"
  }
];

// runtime caches
const cache = { repoInfo: {} };

const PROJECTS_PER_PAGE = 9;
let currentPage = 1;
let currentFiltered = [];

function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  for (const k in props) {
    if (k === 'class') e.className = props[k];
    else if (k === 'html') e.innerHTML = props[k]; // used when we intentionally want HTML
    else e.setAttribute(k, props[k]);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (!c) return;
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else e.appendChild(c);
  });
  return e;
}

function niceDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d)) return iso;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function fetchRepoInfo(repo, token) {
  if (cache.repoInfo[repo]) return cache.repoInfo[repo];
  const url = `https://api.github.com/repos/${repo}`;
  const headers = { Accept: 'application/vnd.github.v3+json' };
  if (token) headers.Authorization = `token ${token}`;
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) {
      console.warn('GitHub API error for', repo, r.status);
      cache.repoInfo[repo] = null;
      return null;
    }
    const data = await r.json();
    cache.repoInfo[repo] = data;
    return data;
  } catch (e) {
    console.error('Fetch error', e);
    cache.repoInfo[repo] = null;
    return null;
  }
}

async function loadAllRepoInfo(token) {
  const promises = PROJECTS.map(p => fetchRepoInfo(p.repo, token));
  return Promise.all(promises);
}

function buildLangOptions() {
  const langsSet = new Set();
  PROJECTS.forEach(p => { if (p.language) langsSet.add(p.language); });
  Object.values(cache.repoInfo).forEach(info => {
    if (info && info.language) langsSet.add(info.language);
  });
  const langs = Array.from(langsSet).filter(Boolean).sort();
  const sel = document.getElementById('langFilter');

  // Clear and build via DOM (avoid raw innerHTML)
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'All languages';
  sel.appendChild(defaultOpt);

  langs.forEach(l => {
    const o = document.createElement('option');
    o.value = l;
    o.textContent = l;
    sel.appendChild(o);
  });
}

function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  let out = escapeHtml(text);
  tokens.forEach(tok => {
    const safe = tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re = new RegExp(`(${safe})`, 'ig');
    out = out.replace(re, '<mark>$1</mark>');
  });
  return out;
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fuzzyScore(hay, query) {
  if (!query) return 1;
  hay = (hay || '').toLowerCase();
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) {
      score += 100 + (t.length * 2); // strong match
      continue;
    }
    // subsequence check
    let i = 0, j = 0;
    while (i < hay.length && j < t.length) {
      if (hay[i] === t[j]) j++;
      i++;
    }
    if (j === t.length) {
      // matched as subsequence; give a smaller score based on length ratio
      score += 30 + Math.floor((t.length / Math.max(1, hay.length)) * 100);
    } else {
      // no match => heavy penalty
      score -= 25;
    }
  }
  return score;
}

function renderList() {
  const container = document.getElementById('projectsList');
  container.innerHTML = '';

  // merge PROJECTS + repo info
  const rows = PROJECTS.map(p => {
    const data = cache.repoInfo[p.repo] || {};
    return {
      ...p,
      language: p.language || (data.language || ''),
      stars: (data && data.stargazers_count) ? data.stargazers_count : 0,
      pushed_at: (data && (data.pushed_at || data.updated_at)) ? (data.pushed_at || data.updated_at) : null
    };
  });

  // filters
  const q = document.getElementById('projSearch').value.trim();
  const lang = document.getElementById('langFilter').value;
  let filtered = rows.filter(r => {
    if (lang && (r.language || '') !== lang) return false;
    if (!q) return true;
    const hay = ((r.name||'') + ' ' + (r.description||'') + ' ' + (r.language||'')).toLowerCase();
    // allow fuzzy match
    return fuzzyScore(hay, q) > -10; // keep fairly permissive so partial matches show up
  });

  // attach score and sort by score first when searching
  if (q) {
    filtered = filtered.map(r => {
      const hay = ((r.name||'') + ' ' + (r.description||'') + ' ' + (r.language||'')).toLowerCase();
      return { ...r, _score: fuzzyScore(hay, q) };
    }).sort((a,b) => {
      if ((b._score || 0) !== (a._score || 0)) return (b._score || 0) - (a._score || 0);
      // fallback to stars if scores tie
      return b.stars - a.stars;
    });
  }

  // sort according to UI control (but only when NOT actively searching)
  const sort = document.getElementById('projSort').value;
  if (!q) { // when not searching, apply chosen sort
    if (sort === 'stars_desc') filtered.sort((a,b) => b.stars - a.stars);
    else if (sort === 'stars_asc') filtered.sort((a,b) => a.stars - b.stars);
    else if (sort === 'updated_desc') filtered.sort((a,b) => (new Date(b.pushed_at || 0)) - (new Date(a.pushed_at || 0)));
    else if (sort === 'updated_asc') filtered.sort((a,b) => (new Date(a.pushed_at || 0)) - (new Date(b.pushed_at || 0)));
  }

  currentFiltered = filtered;
  // render pagination aware
  renderPagination(filtered);
}

function renderPageItems(items) {
  const container = document.getElementById('projectsList');
  container.innerHTML = '';

  items.forEach(p => {
    // make the whole card an anchor
    const card = el('a', { class: 'project-row', href: p.href, target: '_blank', rel: 'noopener noreferrer' });

    // left column: title + desc
    const left = el('div', {}, [
      el('h3', {}, [ el('span', { html: highlight(p.name, document.getElementById('projSearch').value) }) ]),
      el('div', { class: 'project-desc', html: highlight(p.description || '', document.getElementById('projSearch').value) })
    ]);

    // middle: small meta (language + stars)
    // Note: meta uses innerHTML for convenience (values are escaped earlier)
    const meta = el('div', { class: 'meta', html: `<div>Language: ${escapeHtml(p.language || '—')}</div><div>Stars: ${p.stars||0}</div>` });

    // right: last push and a button. Button prevents nested anchor problem.
    const lastPushHtml = `<div>Last push: ${p.pushed_at ? niceDate(p.pushed_at) : 'Unknown'}</div>`;
    const right = el('div', { class: 'right-col' }, [
      el('div', { class: 'meta', html: lastPushHtml }),
      // button to open the repo in a new window; avoids nested <a> inside <a>
      el('button', { class: 'link-btn', type: 'button' }, ['View on GitHub'])
    ]);

    // assemble card
    card.appendChild(left);
    card.appendChild(meta);
    card.appendChild(right);

    // attach button click handler to open the repo and stop propagation
    const btn = right.querySelector('button.link-btn');
    if (btn) {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation(); // don't let the anchor click fire
        window.open(p.href, '_blank', 'noopener');
      });
    }

    container.appendChild(card);
  });

  if (items.length === 0) {
    container.innerHTML = '<p style="color:var(--muted-2)">No projects match your filters.</p>';
  }
}

function renderPagination(list) {
  const totalPages = Math.max(1, Math.ceil(list.length / PROJECTS_PER_PAGE));
  const cont = document.getElementById('pagination');
  cont.innerHTML = '';

  // clamp currentPage
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;

  if (totalPages <= 8) {
    for (let i = 1; i <= totalPages; i++) addPageButton(i);
  } else {
    // show a sliding window of page buttons centered on currentPage (up to 8 buttons)
    let start = Math.max(1, currentPage - 3);
    let end = Math.min(totalPages, start + 7);
    if (end - start < 7) start = end - 7;

    for (let i = start; i <= end; i++) addPageButton(i);

    if (end < totalPages) {
      // compact jump input for large page counts
      const jumpInput = document.createElement('input');
      jumpInput.type = 'number';
      jumpInput.min = 1;
      jumpInput.max = totalPages;
      jumpInput.placeholder = 'Page';
      jumpInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          let val = parseInt(jumpInput.value);
          if (val >= 1 && val <= totalPages) {
            currentPage = val;
            renderPagination(currentFiltered);
          }
        }
      });
      cont.appendChild(jumpInput);

      addPageButton(totalPages);
    }
  }

  function addPageButton(i) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.disabled = i === currentPage;
    btn.addEventListener('click', () => {
      currentPage = i;
      renderPagination(currentFiltered);
    });
    cont.appendChild(btn);
  }

  const start = (currentPage - 1) * PROJECTS_PER_PAGE;
  renderPageItems(list.slice(start, start + PROJECTS_PER_PAGE));
}

async function refresh(token) {
  const btn = document.getElementById('refreshBtn');
  const old = btn.textContent;
  btn.textContent = 'Loading...';
  btn.disabled = true;
  await loadAllRepoInfo(token);
  buildLangOptions();
  renderList();
  btn.textContent = old;
  btn.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  // initial render from local PROJECTS (repo info will be fetched async)
  buildLangOptions();
  renderList();

  // wire up inputs so that any change resets to page 1 and re-renders
  ['projSearch','langFilter','projSort'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      currentPage = 1;
      renderList();
    });
  });

  // manual refresh button to re-fetch GitHub metadata (optional token field supported)
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    // const token = document.getElementById('ghToken').value.trim() || null;
    const token = null;
    await refresh(token);
  });

  // auto-fetch once for UX (non-blocking IIFE)
  (async () => {
    const token = null;
    await refresh(token);
  })();
});
