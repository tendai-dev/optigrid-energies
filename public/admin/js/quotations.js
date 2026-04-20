document.addEventListener("DOMContentLoaded", () => {
  const page = window.location.pathname;

  if (page.includes("quotation-detail")) initQuotationDetail();
  else if (page.includes("quotation-form")) initQuotationForm();
  else if (page.includes("quotations")) initQuotationList();
});

// ---------------------------------------------------------------------------
// Quotation List
// ---------------------------------------------------------------------------
function initQuotationList() {
  let currentPage = 1;
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");

  async function load() {
    const params = new URLSearchParams({ page: currentPage });
    if (searchInput.value) params.set("search", searchInput.value);
    if (statusFilter.value) params.set("status", statusFilter.value);

    try {
      const { data, pagination } = await apiFetch(`/quotations?${params}`);
      const tbody = document.getElementById("quotationsBody");

      if (!data.length) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="empty-state">No quotations found</td></tr>';
      } else {
        tbody.innerHTML = data
          .map(
            (q) => `
          <tr>
            <td><a href="/admin/quotation-detail?id=${q.id}">${q.quotation_number}</a></td>
            <td>${q.client_name}</td>
            <td>${statusBadge(q.status)}</td>
            <td>${formatCurrency(q.total)}</td>
            <td>${formatDate(q.created_at)}</td>
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
  statusFilter.addEventListener("change", () => {
    currentPage = 1;
    load();
  });

  load();
}

// ---------------------------------------------------------------------------
// Quotation Form (Create / Edit)
// ---------------------------------------------------------------------------
async function initQuotationForm() {
  const id = getIdFromUrl();
  const form = document.getElementById("quotationForm");
  const lineItemsBody = document.getElementById("lineItems");
  let itemIndex = 0;

  // Load clients dropdown
  try {
    const { data: clients } = await apiFetch("/clients?limit=100");
    const select = document.getElementById("client_id");
    clients.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
  } catch (err) {
    showToast("Failed to load clients", "error");
  }

  function addLineItem(item = {}) {
    const idx = itemIndex++;
    const tr = document.createElement("tr");
    tr.dataset.idx = idx;
    tr.innerHTML = `
      <td><input type="text" name="desc_${idx}" value="${item.description || ""}" required placeholder="Description"></td>
      <td class="col-qty"><input type="number" name="qty_${idx}" value="${item.quantity || 1}" min="0.01" step="any" required></td>
      <td class="col-unit"><input type="text" name="unit_${idx}" value="${item.unit || "unit"}" placeholder="unit"></td>
      <td class="col-price"><input type="number" name="price_${idx}" value="${item.unit_price || ""}" min="0" step="any" required></td>
      <td class="col-total"><span class="line-total">$0.00</span></td>
      <td class="col-action"><button type="button" class="btn btn-danger btn-sm remove-item">X</button></td>
    `;
    lineItemsBody.appendChild(tr);

    tr.querySelector(".remove-item").addEventListener("click", () => {
      tr.remove();
      recalcTotals();
    });

    tr.querySelectorAll('input[type="number"]').forEach((input) => {
      input.addEventListener("input", () => recalcTotals());
    });

    recalcTotals();
  }

  function recalcTotals() {
    let subtotal = 0;
    lineItemsBody.querySelectorAll("tr").forEach((tr) => {
      const idx = tr.dataset.idx;
      const qty =
        parseFloat(tr.querySelector(`[name="qty_${idx}"]`).value) || 0;
      const price =
        parseFloat(tr.querySelector(`[name="price_${idx}"]`).value) || 0;
      const lineTotal = qty * price;
      subtotal += lineTotal;
      tr.querySelector(".line-total").textContent = formatCurrency(lineTotal);
    });

    const vatRate = parseFloat(document.getElementById("vat_rate").value) || 0;
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;

    document.getElementById("subtotalDisplay").textContent =
      formatCurrency(subtotal);
    document.getElementById("vatRateDisplay").textContent = vatRate;
    document.getElementById("vatDisplay").textContent = formatCurrency(vat);
    document.getElementById("totalDisplay").textContent = formatCurrency(total);
  }

  document.getElementById("vat_rate").addEventListener("input", recalcTotals);
  document
    .getElementById("addItemBtn")
    .addEventListener("click", () => addLineItem());

  // Edit mode: load existing
  if (id) {
    document.getElementById("pageTitle").textContent = "Edit Quotation";
    try {
      const { data } = await apiFetch(`/quotations/${id}`);
      document.getElementById("client_id").value = data.client_id;
      document.getElementById("valid_until").value = data.valid_until || "";
      document.getElementById("vat_rate").value = data.vat_rate;
      document.getElementById("notes").value = data.notes || "";
      data.items.forEach((item) => addLineItem(item));
    } catch (err) {
      showToast(err.message, "error");
    }
  } else {
    addLineItem(); // Start with one empty row
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const items = [];
    lineItemsBody.querySelectorAll("tr").forEach((tr) => {
      const idx = tr.dataset.idx;
      items.push({
        description: tr.querySelector(`[name="desc_${idx}"]`).value,
        quantity:
          parseFloat(tr.querySelector(`[name="qty_${idx}"]`).value) || 1,
        unit: tr.querySelector(`[name="unit_${idx}"]`).value || "unit",
        unit_price:
          parseFloat(tr.querySelector(`[name="price_${idx}"]`).value) || 0,
      });
    });

    if (!items.length) {
      showToast("Add at least one line item", "error");
      return;
    }

    const body = {
      client_id: parseInt(document.getElementById("client_id").value),
      valid_until: document.getElementById("valid_until").value || null,
      vat_rate: parseFloat(document.getElementById("vat_rate").value),
      notes: document.getElementById("notes").value,
      items,
    };

    try {
      if (id) {
        await apiFetch(`/quotations/${id}`, { method: "PUT", body });
        showToast("Quotation updated");
        window.location.href = `/admin/quotation-detail?id=${id}`;
      } else {
        const { data } = await apiFetch("/quotations", {
          method: "POST",
          body,
        });
        showToast("Quotation created");
        window.location.href = `/admin/quotation-detail?id=${data.id}`;
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// ---------------------------------------------------------------------------
// Quotation Detail
// ---------------------------------------------------------------------------
async function initQuotationDetail() {
  const id = getIdFromUrl();
  if (!id) return;

  try {
    const { data } = await apiFetch(`/quotations/${id}`);
    document.getElementById("pageTitle").textContent = data.quotation_number;

    // Actions
    let actions = `<a href="/admin/quotation-document?id=${id}" class="btn btn-secondary" target="_blank">Print</a>`;
    if (data.status === "draft") {
      actions += ` <a href="/admin/quotation-form?id=${id}" class="btn btn-secondary">Edit</a>`;
      actions += ` <button class="btn btn-danger btn-sm" onclick="deleteQuotation(${id})">Delete</button>`;
    }
    if (data.status === "accepted") {
      actions += ` <a href="/admin/project-form?quotation_id=${id}" class="btn btn-primary">Create Project</a>`;
    }
    document.getElementById("actionButtons").innerHTML = actions;

    // Info
    document.getElementById("quotationInfo").innerHTML = `
      <div class="detail-item"><label>Number</label><span>${data.quotation_number}</span></div>
      <div class="detail-item"><label>Status</label><span>${statusBadge(data.status)}</span></div>
      <div class="detail-item"><label>Date</label><span>${formatDate(data.created_at)}</span></div>
      <div class="detail-item"><label>Valid Until</label><span>${formatDate(data.valid_until)}</span></div>
      ${data.notes ? `<div class="detail-item" style="grid-column:1/-1"><label>Notes</label><span>${data.notes}</span></div>` : ""}
    `;

    // Client
    document.getElementById("clientInfo").innerHTML = `
      <div class="detail-item"><label>Name</label><span><a href="/admin/client-detail?id=${data.client_id}">${data.client_name}</a></span></div>
      <div class="detail-item"><label>Email</label><span>${data.client_email || "-"}</span></div>
      <div class="detail-item"><label>Phone</label><span>${data.client_phone || "-"}</span></div>
    `;

    // Items
    const tbody = document.getElementById("itemsBody");
    tbody.innerHTML = data.items
      .map(
        (item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.description}</td>
        <td>${item.quantity}</td>
        <td>${item.unit}</td>
        <td>${formatCurrency(item.unit_price)}</td>
        <td>${formatCurrency(item.total)}</td>
      </tr>
    `,
      )
      .join("");

    document.getElementById("totalsTable").innerHTML = `
      <tr><td>Subtotal</td><td>${formatCurrency(data.subtotal)}</td></tr>
      <tr><td>VAT (${data.vat_rate}%)</td><td>${formatCurrency(data.vat_amount)}</td></tr>
      <tr class="grand-total"><td>Total</td><td>${formatCurrency(data.total)}</td></tr>
    `;

    // Status buttons
    const statuses = ["draft", "sent", "accepted", "rejected"];
    const statusSection = document.getElementById("statusSection");
    statusSection.style.display = "block";
    document.getElementById("statusButtons").innerHTML = statuses
      .map(
        (s) =>
          `<button class="btn ${s === data.status ? "btn-primary" : "btn-secondary"} btn-sm" onclick="updateQuotationStatus(${id}, '${s}')" ${s === data.status ? "disabled" : ""}>${s}</button>`,
      )
      .join("");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function updateQuotationStatus(id, status) {
  try {
    await apiFetch(`/quotations/${id}/status`, {
      method: "PUT",
      body: { status },
    });
    showToast(`Status updated to ${status}`);
    location.reload();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteQuotation(id) {
  const yes = await confirmDialog(
    "Delete Quotation",
    "Are you sure? This cannot be undone.",
  );
  if (!yes) return;
  try {
    await apiFetch(`/quotations/${id}`, { method: "DELETE" });
    showToast("Quotation deleted");
    window.location.href = "/admin/quotations";
  } catch (err) {
    showToast(err.message, "error");
  }
}
