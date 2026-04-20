const COMPANY = {
  name: "OptiGrid Energies",
  tagline: "Zimbabwe's Trusted Solar Panel Contractor",
  address: "Harare, Zimbabwe",
  phone: "+263 XX XXX XXXX",
  email: "info@optigridenergies.com",
  website: "www.optigridenergies.com",
};

function docHeader(title, number, date, validUntil) {
  return `
    <div class="doc-header">
      <div class="doc-company">
        <h1>${COMPANY.name}</h1>
        <p>${COMPANY.address}<br>${COMPANY.phone}<br>${COMPANY.email}<br>${COMPANY.website}</p>
      </div>
      <div class="doc-info">
        <h2>${title}</h2>
        <p><strong>${number}</strong><br>
        Date: ${formatDate(date)}
        ${validUntil ? `<br>Valid Until: ${formatDate(validUntil)}` : ""}</p>
      </div>
    </div>
  `;
}

function docFooter() {
  return `
    <div class="doc-footer">
      <p><strong>Thank you for choosing ${COMPANY.name}</strong></p>
      <p>${COMPANY.tagline}</p>
    </div>
  `;
}

async function loadQuotationDocument() {
  const id = getIdFromUrl();
  if (!id) return;

  try {
    const { data } = await apiFetch(`/quotations/${id}`);
    const container = document.getElementById("documentContent");

    container.innerHTML = `
      ${docHeader("QUOTATION", data.quotation_number, data.created_at, data.valid_until)}

      <div class="doc-parties">
        <div class="doc-party">
          <h3>From</h3>
          <p><strong>${COMPANY.name}</strong><br>${COMPANY.address}<br>${COMPANY.phone}<br>${COMPANY.email}</p>
        </div>
        <div class="doc-party">
          <h3>To</h3>
          <p><strong>${data.client_name}</strong>
          ${data.client_address ? `<br>${data.client_address}` : ""}
          ${data.client_city ? `, ${data.client_city}` : ""}
          ${data.client_phone ? `<br>${data.client_phone}` : ""}
          ${data.client_email ? `<br>${data.client_email}` : ""}</p>
        </div>
      </div>

      <table class="doc-table">
        <thead>
          <tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Unit Price (USD)</th><th>Total (USD)</th></tr>
        </thead>
        <tbody>
          ${data.items
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
            .join("")}
        </tbody>
      </table>

      <div class="doc-totals">
        <table>
          <tr><td>Subtotal</td><td>${formatCurrency(data.subtotal)}</td></tr>
          <tr><td>VAT (${data.vat_rate}%)</td><td>${formatCurrency(data.vat_amount)}</td></tr>
          <tr class="grand-total"><td>Grand Total</td><td>${formatCurrency(data.total)}</td></tr>
        </table>
      </div>

      <div class="doc-terms">
        <h3>Terms & Conditions</h3>
        <ul>
          <li>This quotation is valid for 30 days from the date of issue unless otherwise specified.</li>
          <li>A 50% deposit is required to commence work, with the balance due upon completion.</li>
          <li>All equipment comes with manufacturer's warranty.</li>
          <li>Installation warranty: 12 months from commissioning date.</li>
          <li>Prices are in USD and exclusive of any additional government levies that may apply.</li>
        </ul>
      </div>

      ${docFooter()}
    `;

    document.title = `Quotation ${data.quotation_number} — ${COMPANY.name}`;
  } catch (err) {
    document.getElementById("documentContent").textContent =
      "Failed to load quotation.";
  }
}

async function loadReceiptDocument() {
  const id = getIdFromUrl();
  if (!id) return;

  try {
    const { data } = await apiFetch(`/receipts/${id}`);
    const container = document.getElementById("documentContent");

    container.innerHTML = `
      ${docHeader("RECEIPT", data.receipt_number, data.paid_at)}

      <div class="doc-parties">
        <div class="doc-party">
          <h3>From</h3>
          <p><strong>${COMPANY.name}</strong><br>${COMPANY.address}<br>${COMPANY.phone}<br>${COMPANY.email}</p>
        </div>
        <div class="doc-party">
          <h3>Received From</h3>
          <p><strong>${data.client_name}</strong>
          ${data.client_address ? `<br>${data.client_address}` : ""}
          ${data.client_city ? `, ${data.client_city}` : ""}
          ${data.client_phone ? `<br>${data.client_phone}` : ""}
          ${data.client_email ? `<br>${data.client_email}` : ""}</p>
        </div>
      </div>

      <div class="detail-section" style="border:1px solid #E8E8E8;border-radius:8px;padding:1rem;margin-bottom:1.5rem">
        <p><strong>Project:</strong> ${data.project_number} — ${data.project_title}</p>
      </div>

      <table class="doc-table">
        <thead><tr><th>Description</th><th>Amount (USD)</th></tr></thead>
        <tbody>
          <tr>
            <td>Payment via ${data.payment_method.replace("_", " ")}${data.payment_reference ? ` (Ref: ${data.payment_reference})` : ""}</td>
            <td>${formatCurrency(data.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="doc-totals">
        <table>
          <tr class="grand-total"><td>Total Paid</td><td>${formatCurrency(data.amount)}</td></tr>
          ${
            data.payment_summary.outstanding > 0
              ? `
            <tr><td>Outstanding Balance</td><td>${formatCurrency(data.payment_summary.outstanding)}</td></tr>
          `
              : ""
          }
        </table>
      </div>

      ${docFooter()}
    `;

    document.title = `Receipt ${data.receipt_number} — ${COMPANY.name}`;
  } catch (err) {
    document.getElementById("documentContent").textContent =
      "Failed to load receipt.";
  }
}
