/* ============================================================
   Victron Product — Detail Page Logic
   ============================================================ */

(function () {
  "use strict";

  const API = "/api/victron";

  // Get slug from URL
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  if (!slug) {
    showError();
    return;
  }

  // DOM refs
  const skeletonEl = document.getElementById("vpSkeleton");
  const contentEl = document.getElementById("vpContent");
  const errorEl = document.getElementById("vpError");
  const assetsSection = document.getElementById("vpAssetsSection");
  const relatedSection = document.getElementById("vpRelatedSection");

  // -- Asset type display config -------------------------------------------
  const ASSET_GROUP_CONFIG = {
    datasheet: { label: "Datasheets", icon: "file-text" },
    manual: { label: "Manuals & Guides", icon: "book-open" },
    brochure: { label: "Brochures", icon: "layout" },
    schematic: { label: "System Schematics & Wiring", icon: "git-branch" },
    enclosure: { label: "Enclosure Dimensions & Drawings", icon: "box" },
    "3d": { label: "3D Files", icon: "cube" },
    certificate: { label: "Certificates", icon: "award" },
    technical: { label: "Technical Information", icon: "info" },
    video: { label: "Videos", icon: "play-circle" },
    photo: { label: "Product Photos", icon: "image" },
    other: { label: "Other Resources", icon: "file" },
  };

  // Display order
  const GROUP_ORDER = [
    "datasheet",
    "manual",
    "schematic",
    "enclosure",
    "3d",
    "brochure",
    "certificate",
    "technical",
    "video",
    "photo",
    "other",
  ];

  // -- SVG icons ------------------------------------------------------------
  function getIcon(name) {
    const icons = {
      "file-text":
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      "book-open":
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>',
      layout:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
      "git-branch":
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/></svg>',
      box: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
      cube: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>',
      award:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
      info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      "play-circle":
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
      image:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
      file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      download:
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    };
    return icons[name] || icons["file"];
  }

  // -- Load product ---------------------------------------------------------
  async function loadProduct() {
    try {
      const res = await fetch(`${API}/products/${encodeURIComponent(slug)}`);
      if (!res.ok) {
        showError();
        return;
      }
      const { data } = await res.json();
      render(data);
    } catch (err) {
      console.error("Failed to load product:", err);
      showError();
    }
  }

  // -- Render product -------------------------------------------------------
  function render(product) {
    // Page title
    document.title = `${product.name} — Victron | OptiGrid Energy`;

    // Breadcrumb
    document.getElementById("vpBreadcrumbName").textContent = product.name;

    // Image
    const img = document.getElementById("vpImage");
    img.src =
      product.image_url || "https://via.placeholder.com/600x400?text=No+Image";
    img.alt = product.name;

    // Info
    document.getElementById("vpCategory").textContent =
      product.category_name || "";
    document.getElementById("vpTitle").textContent = product.name;
    document.getElementById("vpModel").textContent = product.model
      ? `Model: ${product.model}`
      : "";
    document.getElementById("vpDescription").textContent =
      product.full_description || product.short_description || "";
    document.getElementById("vpOfficialLink").href = product.product_url || "#";

    // Show content
    skeletonEl.style.display = "none";
    contentEl.style.display = "";

    // Render asset groups
    renderAssets(product.documents_grouped || {});

    // Render related products
    renderRelated(product.related || []);
  }

  // -- Render asset groups --------------------------------------------------
  function renderAssets(grouped) {
    const container = document.getElementById("vpAssetsGroups");
    let hasAny = false;

    for (const type of GROUP_ORDER) {
      const docs = grouped[type];
      if (!docs || docs.length === 0) continue;

      hasAny = true;
      const config = ASSET_GROUP_CONFIG[type] || { label: type, icon: "file" };

      // Limit photos to first 6 to avoid overwhelming the page
      const displayDocs = type === "photo" ? docs.slice(0, 6) : docs;

      let html = `
        <div class="vp-asset-group">
          <div class="vp-asset-group__header">
            ${getIcon(config.icon)}
            <h3>${escapeHtml(config.label)}</h3>
            <span class="vp-asset-group__count">${docs.length}</span>
          </div>
          <div class="vp-asset-group__list">
      `;

      for (const doc of displayDocs) {
        const format = doc.file_format ? doc.file_format.toUpperCase() : "";
        html += `
          <a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener" class="vp-asset-item">
            <div class="vp-asset-item__info">
              <span class="vp-asset-item__title">${escapeHtml(doc.title || "Document")}</span>
              ${format ? `<span class="vp-asset-item__format">${format}</span>` : ""}
            </div>
            <span class="vp-asset-item__action">${getIcon("download")}</span>
          </a>
        `;
      }

      if (type === "photo" && docs.length > 6) {
        html += `<p class="vp-asset-group__more">+ ${docs.length - 6} more photos</p>`;
      }

      html += "</div></div>";
      container.insertAdjacentHTML("beforeend", html);
    }

    if (hasAny) {
      assetsSection.style.display = "";
    }
  }

  // -- Render related products ----------------------------------------------
  function renderRelated(related) {
    if (related.length === 0) return;

    const grid = document.getElementById("vpRelatedGrid");
    grid.innerHTML = related
      .map(
        (p) => `
      <a href="victron-product.html?slug=${encodeURIComponent(p.slug)}" class="vc-card">
        <div class="vc-card__img-wrap">
          <img src="${escapeHtml(p.image_url || "https://via.placeholder.com/400x260?text=No+Image")}" alt="${escapeHtml(p.name)}" loading="lazy">
        </div>
        <div class="vc-card__body">
          <h3 class="vc-card__title">${escapeHtml(p.name)}</h3>
          <p class="vc-card__desc">${escapeHtml(p.short_description || "")}</p>
        </div>
      </a>
    `,
      )
      .join("");

    relatedSection.style.display = "";
  }

  // -- Helpers --------------------------------------------------------------
  function showError() {
    skeletonEl.style.display = "none";
    contentEl.style.display = "none";
    document.getElementById("vpError").style.display = "";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  // -- Init -----------------------------------------------------------------
  loadProduct();
})();
