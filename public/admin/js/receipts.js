document.addEventListener("DOMContentLoaded", () => {
  const page = window.location.pathname;

  if (page.includes("receipt-detail")) initReceiptDetail();
  else if (page.includes("receipt-form")) initReceiptForm();
  else if (page.includes("receipts")) initReceiptList();
});

// ---------------------------------------------------------------------------
// Receipt List
// ---------------------------------------------------------------------------
function initReceiptList() {
  let currentPage = 1;
  const searchInput = document.getElementById("searchInput");
  const methodFilter = document.getElementById("methodFilter");

  async function load() {
    const params = new URLSearchParams({ page: currentPage });
    if (searchInput.value) params.set("search", searchInput.value);
    if (methodFilter.value) params.set("payment_method", methodFilter.value);

    try {
      const { data, pagination } = await apiFetch(`/receipts?${params}`);
      const tbody = document.getElementById("receiptsBody");

      if (!data.length) {
        tbody.innerHTML =
          '<tr><td colspan="6" class="empty-state">No receipts found</td></tr>';
      } else {
        tbody.innerHTML = data
          .map(
            (r) => `
          <tr>
            <td><a href="/admin/receipt-detail?id=${r.id}">${r.receipt_number}</a></td>
            <td>${r.client_name}</td>
            <td><a href="/admin/project-detail?id=${r.project_id}">${r.project_number}</a></td>
            <td>${formatCurrency(r.amount)}</td>
            <td>${r.payment_method.replace("_", " ")}</td>
            <td>${formatDate(r.paid_at)}</td>
          </tr>
        `,
          )
          .join("");
      }

      renderPagination(
        document.getElementById("paginationWrap"),
        pagination,
        (p) => {
          currentPage = p;
          load();
        },
      );
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  let debounce;
  searchInput.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      currentPage = 1;
      load();
    }, 300);
  });
  methodFilter.addEventListener("change", () => {
    currentPage = 1;
    load();
  });

  load();
}

// ---------------------------------------------------------------------------
// Receipt Form
// ---------------------------------------------------------------------------
async function initReceiptForm() {
  const params = new URLSearchParams(window.location.search);
  const presetProjectId = params.get("project_id");

  // Set today as default date
  document.getElementById("paid_at").value = new Date()
    .toISOString()
    .split("T")[0];

  // Load projects
  try {
    const { data: projects } = await apiFetch("/projects?limit=100");
    const select = document.getElementById("project_id");
    projects.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.project_number} — ${p.title} (${p.client_name})`;
      select.appendChild(opt);
    });

    if (presetProjectId) {
      select.value = presetProjectId;
    }
  } catch (err) {
    showToast("Failed to load projects", "error");
  }

  document
    .getElementById("receiptForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;

      const body = {
        project_id: parseInt(form.project_id.value),
        amount: parseFloat(form.amount.value),
        payment_method: form.payment_method.value,
        payment_reference: form.payment_reference.value,
        paid_at: form.paid_at.value,
        notes: form.notes.value,
      };

      try {
        const { data } = await apiFetch("/receipts", { method: "POST", body });
        showToast("Receipt created");
        window.location.href = `/admin/receipt-detail?id=${data.id}`;
      } catch (err) {
        showToast(err.message, "error");
      }
    });
}

// ---------------------------------------------------------------------------
// Receipt Detail
// ---------------------------------------------------------------------------
async function initReceiptDetail() {
  const id = getIdFromUrl();
  if (!id) return;

  try {
    const { data } = await apiFetch(`/receipts/${id}`);
    document.getElementById("pageTitle").textContent = data.receipt_number;

    document.getElementById("actionButtons").innerHTML = `
      <a href="/admin/receipt-document?id=${id}" class="btn btn-secondary" target="_blank">Print</a>
      <button class="btn btn-danger btn-sm" onclick="deleteReceipt(${id})">Delete</button>
    `;

    document.getElementById("receiptInfo").innerHTML = `
      <div class="detail-item"><label>Receipt Number</label><span>${data.receipt_number}</span></div>
      <div class="detail-item"><label>Client</label><span><a href="/admin/client-detail?id=${data.client_id}">${data.client_name}</a></span></div>
      <div class="detail-item"><label>Project</label><span><a href="/admin/project-detail?id=${data.project_id}">${data.project_number} — ${data.project_title}</a></span></div>
      <div class="detail-item"><label>Amount</label><span style="font-size:1.2rem;font-weight:700">${formatCurrency(data.amount)}</span></div>
      <div class="detail-item"><label>Payment Method</label><span>${data.payment_method.replace("_", " ")}</span></div>
      <div class="detail-item"><label>Payment Reference</label><span>${data.payment_reference || "-"}</span></div>
      <div class="detail-item"><label>Payment Date</label><span>${formatDate(data.paid_at)}</span></div>
      <div class="detail-item"><label>Created</label><span>${formatDate(data.created_at)}</span></div>
      ${data.notes ? `<div class="detail-item" style="grid-column:1/-1"><label>Notes</label><span>${data.notes}</span></div>` : ""}
    `;

    const ps = data.payment_summary;
    document.getElementById("paymentCards").innerHTML = `
      <div class="admin-card"><div class="card-label">Quoted Total</div><div class="card-value">${formatCurrency(ps.quoted_total)}</div></div>
      <div class="admin-card"><div class="card-label">Total Paid</div><div class="card-value">${formatCurrency(ps.total_paid)}</div></div>
      <div class="admin-card"><div class="card-label">Outstanding</div><div class="card-value">${formatCurrency(ps.outstanding)}</div></div>
    `;
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteReceipt(id) {
  const yes = await confirmDialog(
    "Delete Receipt",
    "Are you sure? This cannot be undone.",
  );
  if (!yes) return;
  try {
    await apiFetch(`/receipts/${id}`, { method: "DELETE" });
    showToast("Receipt deleted");
    window.location.href = "/admin/receipts";
  } catch (err) {
    showToast(err.message, "error");
  }
}
