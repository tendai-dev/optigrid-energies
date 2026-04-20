document.addEventListener("DOMContentLoaded", async () => {
  try {
    const { data } = await apiFetch("/dashboard");

    document.getElementById("statClients").textContent = data.clientCount;
    document.getElementById("statProjects").textContent = data.activeProjects;
    document.getElementById("statQuotations").textContent =
      data.pendingQuotations;
    document.getElementById("statRevenue").textContent = formatCurrency(
      data.totalRevenue,
    );

    // Recent projects
    const projBody = document.getElementById("recentProjects");
    if (data.recentProjects.length) {
      projBody.innerHTML = data.recentProjects
        .map(
          (p) => `
        <tr>
          <td><a href="/admin/project-detail?id=${p.id}">${p.project_number}</a></td>
          <td>${p.client_name}</td>
          <td>${statusBadge(p.status)}</td>
        </tr>
      `,
        )
        .join("");
    } else {
      projBody.innerHTML =
        '<tr><td colspan="3" class="empty-state">No projects yet</td></tr>';
    }

    // Recent receipts
    const recBody = document.getElementById("recentReceipts");
    if (data.recentReceipts.length) {
      recBody.innerHTML = data.recentReceipts
        .map(
          (r) => `
        <tr>
          <td><a href="/admin/receipt-detail?id=${r.id}">${r.receipt_number}</a></td>
          <td>${r.client_name}</td>
          <td>${formatCurrency(r.amount)}</td>
        </tr>
      `,
        )
        .join("");
    } else {
      recBody.innerHTML =
        '<tr><td colspan="3" class="empty-state">No payments yet</td></tr>';
    }
  } catch (err) {
    showToast(err.message, "error");
  }
});
