"use strict";

/**
 * Thin wrapper around the Resend REST API (no SDK dependency — just fetch).
 * Gracefully no-ops when RESEND_API_KEY is not set so the contact form
 * still succeeds in environments without the key configured.
 *
 * @param {{ to: string, subject: string, html: string, replyTo?: string }} opts
 * @returns {Promise<void>}
 */
async function sendEmail({ to, subject, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(
      `[resend] RESEND_API_KEY not set — skipping email to ${to} (subject: "${subject}")`,
    );
    return;
  }

  const payload = {
    from: "OptiGrid Energy <noreply@optigrid.co.zw>",
    to: [to],
    subject,
    html,
  };

  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "(unreadable body)");
    throw new Error(`Resend API error ${response.status}: ${errorBody}`);
  }
}

module.exports = { sendEmail };
