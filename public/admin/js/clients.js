document.addEventListener("DOMContentLoaded", () => {
  const page = window.location.pathname;

  if (page.includes("client-detail")) initClientDetail();
  else if (page.includes("client-form")) initClientForm();
  else if (page.includes("clients")) initClientList();
});

// ---------------------------------------------------------------------------
// Client List
// ---------------------------------------------------------------------------
function initClientList() {
  let currentPage = 1;
  const searchInput = document.getElementById("searchInput");
  const typeFilter = document.getElementById("typeFilter");

  async function loadClients() {
    const params = new URLSearchParams({ page: currentPage });
    if (searchInput.value) params.set("search", searchInput.value);
    if (typeFilter.value) params.set("type", typeFilter.value);

    try {
      const { data, pagination } = await apiFetch(`/clients?${params}`);
      const tbody = document.getElementById("clientsBody");

      if (!data.length) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="empty-state">No clients found</td></tr>';
      } else {
        tbody.innerHTML = data
          .map(
            (c) => `
          <tr>
            <td><a href="/admin/client-detail?id=${c.id}">${c.name}</a></td>
            <td>${statusBadge(c.type)}</td>
            <td>${c.city || "-"}</td>
            <td>${c.phone || "-"}</td>
            <td>${formatDate(c.created_at)}</td>
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
          loadClients();
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
      loadClients();
    }, 300);
  });
  typeFilter.addEventListener("change", () => {
    currentPage = 1;
    loadClients();
  });

  loadClients();
}

// ---------------------------------------------------------------------------
// Client Form (Create / Edit)
// ---------------------------------------------------------------------------
function initClientForm() {
  const id = getIdFromUrl();
  const form = document.getElementById("clientForm");

  if (id) {
    document.getElementById("pageTitle").textContent = "Edit Client";
    apiFetch(`/clients/${id}`)
      .then(({ data }) => {
        form.name.value = data.name;
        form.email.value = data.email || "";
        form.phone.value = data.phone || "";
        form.address.value = data.address || "";
        form.city.value = data.city || "";
        form.type.value = data.type;
        form.notes.value = data.notes || "";
      })
      .catch((err) => showToast(err.message, "error"));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      name: form.name.value,
      email: form.email.value,
      phone: form.phone.value,
      address: form.address.value,
      city: form.city.value,
      type: form.type.value,
      notes: form.notes.value,
    };

    try {
      if (id) {
        await apiFetch(`/clients/${id}`, { method: "PUT", body });
        showToast("Client updated");
      } else {
        const { data } = await apiFetch("/clients", { method: "POST", body });
        showToast("Client created");
        window.location.href = `/admin/client-detail?id=${data.id}`;
        return;
      }
      window.location.href = "/admin/clients";
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// ---------------------------------------------------------------------------
// Client Detail
// ---------------------------------------------------------------------------
async function initClientDetail() {
  const id = getIdFromUrl();
  if (!id) return;

  try {
    const { data } = await apiFetch(`/clients/${id}`);
    document.getElementById("pageTitle").textContent = data.name;

    document.getElementById("actionButtons").innerHTML = `
      <a href="/admin/client-form?id=${id}" class="btn btn-secondary">Edit</a>
      <button class="btn btn-danger btn-sm" onclick="deleteClient(${id})">Delete</button>
    `;

    document.getElementById("clientInfo").innerHTML = `
      <div class="detail-item"><label>Type</label><span>${statusBadge(data.type)}</span></div>
      <div class="detail-item"><label>Email</label><span>${data.email || "-"}</span></div>
      <div class="detail-item"><label>Phone</label><span>${data.phone || "-"}</span></div>
      <div class="detail-item"><label>Address</label><span>${data.address || "-"}</span></div>
      <div class="detail-item"><label>City</label><span>${data.city || "-"}</span></div>
      <div class="detail-item"><label>Created</label><span>${formatDate(data.created_at)}</span></div>
      ${data.notes ? `<div class="detail-item" style="grid-column:1/-1"><label>Notes</label><span>${data.notes}</span></div>` : ""}
    `;

    // Quotations
    const qBody = document.getElementById("clientQuotations");
    if (data.quotations && data.quotations.length) {
      qBody.innerHTML = data.quotations
        .map(
          (q) => `
        <tr>
          <td><a href="/admin/quotation-detail?id=${q.id}">${q.quotation_number}</a></td>
          <td>${statusBadge(q.status)}</td>
          <td>${formatCurrency(q.total)}</td>
          <td>${formatDate(q.created_at)}</td>
        </tr>
      `,
        )
        .join("");
    }

    // Projects
    const pBody = document.getElementById("clientProjects");
    if (data.projects && data.projects.length) {
      pBody.innerHTML = data.projects
        .map(
          (p) => `
        <tr>
          <td><a href="/admin/project-detail?id=${p.id}">${p.project_number}</a></td>
          <td>${p.title}</td>
          <td>${statusBadge(p.status)}</td>
          <td>${formatDate(p.created_at)}</td>
        </tr>
      `,
        )
        .join("");
    }

    // Receipts
    const rBody = document.getElementById("clientReceipts");
    if (data.receipts && data.receipts.length) {
      rBody.innerHTML = data.receipts
        .map(
          (r) => `
        <tr>
          <td><a href="/admin/receipt-detail?id=${r.id}">${r.receipt_number}</a></td>
          <td>${formatCurrency(r.amount)}</td>
          <td>${formatDate(r.paid_at)}</td>
        </tr>
      `,
        )
        .join("");
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteClient(id) {
  const yes = await confirmDialog(
    "Delete Client",
    "Are you sure? This cannot be undone.",
  );
  if (!yes) return;
  try {
    await apiFetch(`/clients/${id}`, { method: "DELETE" });
    showToast("Client deleted");
    window.location.href = "/admin/clients";
  } catch (err) {
    showToast(err.message, "error");
  }
}
