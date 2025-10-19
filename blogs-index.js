const POSTS = [
  {
    title: "Using SoundCloud's API without an App",
    href: "2025/09/21-bypass.html",
    date: "2025-09-21",
    excerpt: "Interacting with SoundCloud's API and reverse engineering.",
    tags: ["api", "reverse-engineering"],
    readTime: 4
  },
  {
    title: "Wiping MFT",
    href: "2025/09/11-wipemft.html",
    date: "2025-09-11",
    excerpt: "A write-up detailing a NTFS MFT killer.",
    tags: ["mft", "ntfs"],
    readTime: 10
  }
];

const POSTS_PER_PAGE = 9;
let currentPage = 1;
let currentFiltered = POSTS;

function formatDateISO(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt)) return d;
  return dt.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildYearOptions(posts) {
  const years = Array.from(new Set(posts.map(p => (new Date(p.date)).getFullYear()))).sort((a,b)=>b-a);
  const sel = document.getElementById('yearFilter');
  years.forEach(y => {
    const o = document.createElement('option');
    o.value = String(y);
    o.textContent = String(y);
    sel.appendChild(o);
  });
}

function highlight(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function render(posts) {
  const cont = document.getElementById('postsList');
  cont.innerHTML = '';
  const q = document.getElementById('searchInput').value.trim().toLowerCase();

  if (posts.length === 0) {
    cont.innerHTML = '<p style="color:var(--muted-2)">No posts match your filters.</p>';
    return;
  }

  posts.forEach(p => {
    const el = document.createElement('a');
    el.className = 'post-card';
    el.href = p.href;

    const metaTags = p.tags.map(t => `<span class="tag">${t}</span>`).join(' ');
    const readTimeStr = p.readTime ? `· ${p.readTime} min read` : '';

    el.innerHTML = `
      <h3>${highlight(p.title, q)}</h3>
      <div class="post-meta">
        ${formatDateISO(p.date)} · ${metaTags}
        ${readTimeStr}
      </div>
      <p class="post-excerpt">${highlight(p.excerpt, q)}</p>
    `;
    cont.appendChild(el);
  });
}

function renderPagination(posts) {
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE) || 1;
  const cont = document.getElementById('pagination');
  cont.innerHTML = '';

  if (totalPages <= 8) {
    for (let i = 1; i <= totalPages; i++) addPageButton(i);
  } else {
    let start = Math.max(1, currentPage - 3);
    let end = Math.min(totalPages, start + 7);
    if (end - start < 7) start = end - 7;

    for (let i = start; i <= end; i++) addPageButton(i);

    if (end < totalPages) {
      const jumpInput = document.createElement('input');
      jumpInput.type = 'number';
      jumpInput.min = 1;
      jumpInput.max = totalPages;
      jumpInput.placeholder = 'Pg';
      jumpInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          let val = parseInt(jumpInput.value, 10);
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

  const startOfNewLine = Array.from(cont.children).filter(c => c.tagName === 'BUTTON' && c.offsetTop > 0);
  if (startOfNewLine.length) {
    startOfNewLine.forEach(c => c.style.marginTop = '10px');
  }

  const start = (currentPage - 1) * POSTS_PER_PAGE;
  render(posts.slice(start, start + POSTS_PER_PAGE));
}

function filterAndSort() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const year = document.getElementById('yearFilter').value;
  const month = document.getElementById('monthFilter').value;
  const sort = document.getElementById('sortSelect').value;

  let list = POSTS.slice();

  if (year) list = list.filter(p => new Date(p.date).getFullYear() === Number(year));
  if (month) list = list.filter(p => {
    const m = String(new Date(p.date).getMonth() + 1).padStart(2,'0');
    return m === month;
  });
  if (q) list = list.filter(p => {
    const hay = (p.title + " " + (p.excerpt||'') + " " + (p.tags||[]).join(' ')).toLowerCase();
    return hay.includes(q);
  });

  list.sort((a,b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return sort === 'oldest' ? da - db : db - da;
  });

  currentFiltered = list;
  currentPage = 1;
  renderPagination(list);
}

document.addEventListener('DOMContentLoaded', () => {
  buildYearOptions(POSTS);
  filterAndSort();

  ['searchInput','yearFilter','monthFilter','sortSelect'].forEach(id => {
    document.getElementById(id).addEventListener('input', filterAndSort);
  });
});
