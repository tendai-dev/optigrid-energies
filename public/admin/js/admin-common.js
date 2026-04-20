/* ============================================================
   OptiGrid CRM — Shared Admin Utilities
   ============================================================ */

const API = "/api/admin";

// ---------------------------------------------------------------------------
// Fetch wrapper with auth error handling
// ---------------------------------------------------------------------------
async function apiFetch(path, options = {}) {
  const opts = {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  };
  if (opts.body && typeof opts.body === "object") {
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${API}${path}`, opts);

  if (res.status === 401) {
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------
function ensureToastContainer() {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = "success") {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------
function confirmDialog(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.innerHTML = `
      <div class="dialog-box">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="dialog-actions">
          <button class="btn btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn btn-danger" data-action="confirm">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      const action = e.target.dataset.action;
      if (action === "confirm") {
        overlay.remove();
        resolve(true);
      } else if (action === "cancel" || e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Sidebar toggle
// ---------------------------------------------------------------------------
function initSidebar() {
  const btn = document.querySelector(".mobile-menu-btn");
  const sidebar = document.querySelector(".admin-sidebar");
  if (btn && sidebar) {
    btn.addEventListener("click", () => sidebar.classList.toggle("open"));
  }

  // Mark active nav link
  const path = window.location.pathname;
  document.querySelectorAll(".sidebar-nav a").forEach((a) => {
    const href = a.getAttribute("href");
    if (
      path === href ||
      (href !== "/admin/dashboard" && path.startsWith(href))
    ) {
      a.classList.add("active");
    }
  });
}

// ---------------------------------------------------------------------------
// Theme toggle (matches main site)
// ---------------------------------------------------------------------------
function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) document.documentElement.setAttribute("data-theme", saved);
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
async function handleLogout() {
  try {
    await apiFetch("/logout", { method: "POST" });
  } catch (e) {
    /* ignore */
  }
  window.location.href = "/admin/login";
}

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------
function renderPagination(container, pagination, onPageChange) {
  container.innerHTML = "";
  if (pagination.pages <= 1) return;

  const info = document.createElement("span");
  info.textContent = `Page ${pagination.page} of ${pagination.pages} (${pagination.total} records)`;

  const prev = document.createElement("button");
  prev.textContent = "Prev";
  prev.disabled = pagination.page <= 1;
  prev.onclick = () => onPageChange(pagination.page - 1);

  const next = document.createElement("button");
  next.textContent = "Next";
  next.disabled = pagination.page >= pagination.pages;
  next.onclick = () => onPageChange(pagination.page + 1);

  const wrap = document.createElement("div");
  wrap.className = "pagination";
  wrap.append(prev, info, next);
  container.appendChild(wrap);
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadge(status) {
  return `<span class="badge badge-${status}">${status}</span>`;
}

// ---------------------------------------------------------------------------
// URL params helper
// ---------------------------------------------------------------------------
function getIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

// ---------------------------------------------------------------------------
// Init on DOM ready
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initSidebar();

  // Logout buttons
  document.querySelectorAll("[data-logout]").forEach((btn) => {
    btn.addEventListener("click", handleLogout);
  });
});
