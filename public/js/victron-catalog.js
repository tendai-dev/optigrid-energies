/* ============================================================
   Victron Catalog — Product Listing Page Logic
   ============================================================ */

(function () {
  'use strict';

  const API = '/api/victron';
  const DEBOUNCE_MS = 350;

  // DOM refs
  const searchInput = document.getElementById('vcSearch');
  const categorySelect = document.getElementById('vcCategory');
  const sortSelect = document.getElementById('vcSort');
  const grid = document.getElementById('vcGrid');
  const skeleton = document.getElementById('vcSkeleton');
  const empty = document.getElementById('vcEmpty');
  const errorEl = document.getElementById('vcError');
  const pagination = document.getElementById('vcPagination');
  const resultsMeta = document.getElementById('vcResultsMeta');

  let currentPage = 1;
  let debounceTimer = null;

  // -- Asset type labels and icons -----------------------------------------
  const ASSET_LABELS = {
    datasheet: 'Datasheet',
    manual: 'Manual',
    schematic: 'Schematic',
    enclosure: 'Dimensions',
    '3d': '3D',
    brochure: 'Brochure',
    certificate: 'Certificate',
    video: 'Video',
    technical: 'Technical',
  };

  // -- Fetch categories -----------------------------------------------------
  async function loadCategories() {
    try {
      const res = await fetch(`${API}/categories`);
      if (!res.ok) return;
      const { data } = await res.json();
      for (const cat of data) {
        const opt = document.createElement('option');
        opt.value = cat.slug;
        opt.textContent = `${cat.name} (${cat.product_count})`;
        categorySelect.appendChild(opt);
      }
    } catch (_) { /* non-critical */ }
  }

  // -- Render a single product card -----------------------------------------
  function renderCard(product) {
    const badges = (product.asset_types || [])
      .filter((t) => ASSET_LABELS[t])
      .slice(0, 4)
      .map((t) => `<span class="vc-badge vc-badge--${t}">${ASSET_LABELS[t]}</span>`)
      .join('');

    const imgSrc = product.image_url || 'https://via.placeholder.com/400x260?text=No+Image';

    return `
      <a href="victron-product.html?slug=${encodeURIComponent(product.slug)}" class="vc-card">
        <div class="vc-card__img-wrap">
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(product.name)}" loading="lazy">
        </div>
        <div class="vc-card__body">
          <span class="vc-card__category">${escapeHtml(product.category_name || '')}</span>
          <h3 class="vc-card__title">${escapeHtml(product.name)}</h3>
          <p class="vc-card__desc">${escapeHtml(product.short_description || '')}</p>
          ${badges ? `<div class="vc-card__badges">${badges}</div>` : ''}
        </div>
      </a>
    `;
  }

  // -- Load products --------------------------------------------------------
  async function load() {
    const params = new URLSearchParams();
    params.set('page', currentPage);
    params.set('limit', '24');
    if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
    if (categorySelect.value) params.set('category', categorySelect.value);
    if (sortSelect.value) params.set('sort', sortSelect.value);

    showState('loading');

    try {
      const res = await fetch(`${API}/products?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data, pagination: pg } = await res.json();

      if (data.length === 0) {
        showState('empty');
        return;
      }

      grid.innerHTML = data.map(renderCard).join('');
      renderPagination(pg);
      resultsMeta.textContent = `Showing ${(pg.page - 1) * pg.limit + 1}–${Math.min(pg.page * pg.limit, pg.total)} of ${pg.total} products`;
      showState('loaded');
    } catch (err) {
      console.error('Failed to load products:', err);
      showState('error');
    }
  }

  // -- Pagination -----------------------------------------------------------
  function renderPagination(pg) {
    if (pg.pages <= 1) { pagination.innerHTML = ''; return; }

    let html = '';
    const maxVisible = 7;
    const start = Math.max(1, pg.page - Math.floor(maxVisible / 2));
    const end = Math.min(pg.pages, start + maxVisible - 1);

    if (pg.page > 1) {
      html += `<button class="vc-page-btn" data-page="${pg.page - 1}">Prev</button>`;
    }

    for (let i = start; i <= end; i++) {
      const active = i === pg.page ? ' vc-page-btn--active' : '';
      html += `<button class="vc-page-btn${active}" data-page="${i}">${i}</button>`;
    }

    if (pg.page < pg.pages) {
      html += `<button class="vc-page-btn" data-page="${pg.page + 1}">Next</button>`;
    }

    pagination.innerHTML = html;
  }

  // -- State management -----------------------------------------------------
  function showState(state) {
    skeleton.style.display = state === 'loading' ? '' : 'none';
    grid.style.display = state === 'loaded' ? '' : 'none';
    empty.style.display = state === 'empty' ? '' : 'none';
    errorEl.style.display = state === 'error' ? '' : 'none';
    if (state !== 'loaded') {
      pagination.innerHTML = '';
      resultsMeta.textContent = '';
    }
  }

  // -- Event listeners ------------------------------------------------------
  function onFilterChange() {
    currentPage = 1;
    load();
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(onFilterChange, DEBOUNCE_MS);
  });

  categorySelect.addEventListener('change', onFilterChange);
  sortSelect.addEventListener('change', onFilterChange);

  pagination.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn) return;
    currentPage = parseInt(btn.dataset.page, 10);
    load();
    window.scrollTo({ top: document.querySelector('.vc-toolbar').offsetTop - 80, behavior: 'smooth' });
  });

  // -- Utility --------------------------------------------------------------
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // -- Init -----------------------------------------------------------------
  loadCategories();
  load();

  // Expose for retry button
  window.vcApp = { load };
})();
