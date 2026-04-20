document.addEventListener("DOMContentLoaded", () => {
  const page = window.location.pathname;

  if (page.includes("project-detail")) initProjectDetail();
  else if (page.includes("project-form")) initProjectForm();
  else if (page.includes("projects")) initProjectList();
});

// ---------------------------------------------------------------------------
// Project List
// ---------------------------------------------------------------------------
function initProjectList() {
  let currentPage = 1;
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const typeFilter = document.getElementById("typeFilter");

  async function load() {
    const params = new URLSearchParams({ page: currentPage });
    if (searchInput.value) params.set("search", searchInput.value);
    if (statusFilter.value) params.set("status", statusFilter.value);
    if (typeFilter.value) params.set("type", typeFilter.value);

    try {
      const { data, pagination } = await apiFetch(`/projects?${params}`);
      const tbody = document.getElementById("projectsBody");

      if (!data.length) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="empty-state">No projects found</td></tr>';
      } else {
        tbody.innerHTML = data
          .map(
            (p) => `
          <tr>
            <td><a href="/admin/project-detail?id=${p.id}">${p.project_number}</a></td>
            <td>${p.title}</td>
            <td>${p.client_name}</td>
            <td>${statusBadge(p.type)}</td>
            <td>${statusBadge(p.status)}</td>
          </tr>
        `,
          )
          .join("");
      }

      renderPagination(
        document.getElementById("paginationWrap"),
        pagination,
        (pg) => {
          currentPage = pg;
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
  typeFilter.addEventListener("change", () => {
    currentPage = 1;
    load();
  });

  load();
}

// ---------------------------------------------------------------------------
// Project Form (Create / Edit)
// ---------------------------------------------------------------------------
async function initProjectForm() {
  const id = getIdFromUrl();
  const params = new URLSearchParams(window.location.search);
  const quotationId = params.get("quotation_id");
  const form = document.getElementById("projectForm");

  // Load clients
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

  // Load accepted quotations
  try {
    const { data: quotations } = await apiFetch(
      "/quotations?status=accepted&limit=100",
    );
    const select = document.getElementById("quotation_id");
    quotations.forEach((q) => {
      const opt = document.createElement("option");
      opt.value = q.id;
      opt.textContent = `${q.quotation_number} — ${q.client_name} (${formatCurrency(q.total)})`;
      select.appendChild(opt);
    });
  } catch (err) {
    /* ignore */
  }

  // Pre-fill from quotation
  if (quotationId) {
    try {
      const { data: q } = await apiFetch(`/quotations/${quotationId}`);
      document.getElementById("client_id").value = q.client_id;
      document.getElementById("quotation_id").value = q.id;
      document.getElementById("type").value = "residential"; // default
    } catch (err) {
      /* ignore */
    }
  }

  // Edit mode
  if (id) {
    document.getElementById("pageTitle").textContent = "Edit Project";
    try {
      const { data } = await apiFetch(`/projects/${id}`);
      form.client_id.value = data.client_id;
      form.quotation_id.value = data.quotation_id || "";
      form.title.value = data.title;
      form.type.value = data.type;
      form.site_address.value = data.site_address || "";
      form.panel_count.value = data.panel_count || "";
      form.capacity_kw.value = data.capacity_kw || "";
      form.inverter_details.value = data.inverter_details || "";
      form.battery_details.value = data.battery_details || "";
      form.start_date.value = data.start_date || "";
      form.expected_completion.value = data.expected_completion || "";
      form.notes.value = data.notes || "";
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      client_id: parseInt(form.client_id.value),
      quotation_id: form.quotation_id.value
        ? parseInt(form.quotation_id.value)
        : null,
      title: form.title.value,
      type: form.type.value,
      site_address: form.site_address.value,
      panel_count: form.panel_count.value
        ? parseInt(form.panel_count.value)
        : null,
      capacity_kw: form.capacity_kw.value
        ? parseFloat(form.capacity_kw.value)
        : null,
      inverter_details: form.inverter_details.value,
      battery_details: form.battery_details.value,
      start_date: form.start_date.value || null,
      expected_completion: form.expected_completion.value || null,
      notes: form.notes.value,
    };

    try {
      if (id) {
        await apiFetch(`/projects/${id}`, { method: "PUT", body });
        showToast("Project updated");
        window.location.href = `/admin/project-detail?id=${id}`;
      } else {
        const { data } = await apiFetch("/projects", { method: "POST", body });
        showToast("Project created");
        window.location.href = `/admin/project-detail?id=${data.id}`;
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });
}

// ---------------------------------------------------------------------------
// Project Detail
// ---------------------------------------------------------------------------
async function initProjectDetail() {
  const id = getIdFromUrl();
  if (!id) return;

  try {
    const { data } = await apiFetch(`/projects/${id}`);
    document.getElementById("pageTitle").textContent =
      `${data.project_number} — ${data.title}`;

    document.getElementById("actionButtons").innerHTML = `
      <a href="/admin/project-form?id=${id}" class="btn btn-secondary">Edit</a>
    `;

    // Pipeline
    const stages = [
      "planning",
      "procurement",
      "installation",
      "commissioning",
      "completed",
    ];
    const currentIdx = stages.indexOf(data.status);
    document.getElementById("pipelineWrap").innerHTML = `
      <div class="pipeline">
        ${stages
          .map(
            (s, i) => `
          <div class="pipeline-stage ${i < currentIdx ? "completed" : ""} ${i === currentIdx ? "active" : ""}">
            ${s}
          </div>
        `,
          )
          .join("")}
      </div>
    `;

    // Project info
    document.getElementById("projectInfo").innerHTML = `
      <div class="detail-item"><label>Client</label><span><a href="/admin/client-detail?id=${data.client_id}">${data.client_name}</a></span></div>
      <div class="detail-item"><label>Type</label><span>${statusBadge(data.type)}</span></div>
      <div class="detail-item"><label>Status</label><span>${statusBadge(data.status)}</span></div>
      <div class="detail-item"><label>Site Address</label><span>${data.site_address || "-"}</span></div>
      <div class="detail-item"><label>Start Date</label><span>${formatDate(data.start_date)}</span></div>
      <div class="detail-item"><label>Expected Completion</label><span>${formatDate(data.expected_completion)}</span></div>
      ${data.quotation ? `<div class="detail-item"><label>Quotation</label><span><a href="/admin/quotation-detail?id=${data.quotation.id}">${data.quotation.quotation_number}</a></span></div>` : ""}
      ${data.notes ? `<div class="detail-item" style="grid-column:1/-1"><label>Notes</label><span>${data.notes}</span></div>` : ""}
    `;

    // System details
    document.getElementById("systemInfo").innerHTML = `
      <div class="detail-item"><label>Panel Count</label><span>${data.panel_count || "-"}</span></div>
      <div class="detail-item"><label>Capacity (kW)</label><span>${data.capacity_kw || "-"}</span></div>
      <div class="detail-item"><label>Inverter</label><span>${data.inverter_details || "-"}</span></div>
      <div class="detail-item"><label>Battery</label><span>${data.battery_details || "-"}</span></div>
    `;

    // Payment
    const ps = data.payment_summary;
    document.getElementById("paymentCards").innerHTML = `
      <div class="admin-card"><div class="card-label">Quoted Total</div><div class="card-value">${formatCurrency(ps.quoted_total)}</div></div>
      <div class="admin-card"><div class="card-label">Total Paid</div><div class="card-value">${formatCurrency(ps.total_paid)}</div></div>
      <div class="admin-card"><div class="card-label">Outstanding</div><div class="card-value">${formatCurrency(ps.outstanding)}</div></div>
    `;

    // Receipts
    document.getElementById("addReceiptBtn").href =
      `/admin/receipt-form?project_id=${id}`;
    const rBody = document.getElementById("receiptsBody");
    if (data.receipts && data.receipts.length) {
      rBody.innerHTML = data.receipts
        .map(
          (r) => `
        <tr>
          <td><a href="/admin/receipt-detail?id=${r.id}">${r.receipt_number}</a></td>
          <td>${formatCurrency(r.amount)}</td>
          <td>${r.payment_method.replace("_", " ")}</td>
          <td>${formatDate(r.paid_at)}</td>
        </tr>
      `,
        )
        .join("");
    }

    // Status buttons
    const statuses = [
      "planning",
      "procurement",
      "installation",
      "commissioning",
      "completed",
    ];
    document.getElementById("statusButtons").innerHTML = statuses
      .map(
        (s) =>
          `<button class="btn ${s === data.status ? "btn-primary" : "btn-secondary"} btn-sm" onclick="updateProjectStatus(${id}, '${s}')" ${s === data.status ? "disabled" : ""}>${s}</button>`,
      )
      .join("");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function updateProjectStatus(id, status) {
  try {
    await apiFetch(`/projects/${id}/status`, {
      method: "PUT",
      body: { status },
    });
    showToast(`Status updated to ${status}`);
    location.reload();
  } catch (err) {
    showToast(err.message, "error");
  }
}
