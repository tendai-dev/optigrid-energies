"use strict";

const express = require("express");
const { sendEmail } = require("../email/resend");

const router = express.Router();

// ---------------------------------------------------------------------------
// In-memory rate limiter: 5 submissions per IP per hour.
// Resets on serverless cold starts — acceptable for MVP.
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** @type {Map<string, { count: number, windowStart: number }>} */
const ipSubmissions = new Map();

/**
 * Returns true if the given IP has exceeded the rate limit.
 * Automatically resets the window when it has expired.
 *
 * @param {string} ip
 * @returns {boolean}
 */
function isRateLimited(ip) {
  const now = Date.now();
  const entry = ipSubmissions.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipSubmissions.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

/**
 * Internal notification email sent to OptiGrid staff.
 *
 * @param {{ name: string, email: string, phone: string, service: string, location: string, message: string }} data
 * @returns {string}
 */
function buildInternalEmail({
  name,
  email,
  phone,
  service,
  location,
  message,
}) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family: sans-serif; color: #0f232a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #0f232a; border-bottom: 2px solid #e8e8e8; padding-bottom: 12px;">
    New Contact Form Submission — OptiGrid Energy
  </h2>
  <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
    <tr><td style="padding: 8px 0; font-weight: 600; width: 160px;">Name</td><td style="padding: 8px 0;">${escapeHtml(name)}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: 600;">Email</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
    <tr><td style="padding: 8px 0; font-weight: 600;">Phone</td><td style="padding: 8px 0;">${escapeHtml(phone || "Not provided")}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: 600;">Service</td><td style="padding: 8px 0;">${escapeHtml(service)}</td></tr>
    <tr><td style="padding: 8px 0; font-weight: 600;">Location</td><td style="padding: 8px 0;">${escapeHtml(location || "Not provided")}</td></tr>
  </table>
  <h3 style="margin-top: 24px; margin-bottom: 8px;">Message</h3>
  <p style="background: #f5f5f3; padding: 16px; border-radius: 8px; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(message)}</p>
  <hr style="margin: 24px 0; border: none; border-top: 1px solid #e8e8e8;" />
  <p style="font-size: 12px; color: #79898f;">Submitted via optigridenergy.co.zw contact form</p>
</body>
</html>
`.trim();
}

/**
 * Auto-reply email sent to the lead confirming receipt of their enquiry.
 *
 * @param {{ name: string }} data
 * @returns {string}
 */
function buildAutoReplyEmail({ name }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family: sans-serif; color: #0f232a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #0f232a;">Thank you, ${escapeHtml(name)}!</h2>
  <p style="line-height: 1.7; margin-top: 16px;">
    We've received your enquiry and a member of our team will be in touch within
    <strong>24 business hours</strong>.
  </p>
  <p style="line-height: 1.7; margin-top: 16px;">
    In the meantime, feel free to explore our
    <a href="https://optigridenergy.co.zw/services.html" style="color: #0f232a;">services</a>
    or browse our
    <a href="https://optigridenergy.co.zw/victron-catalog.html" style="color: #0f232a;">Victron product catalogue</a>.
  </p>
  <hr style="margin: 32px 0; border: none; border-top: 1px solid #e8e8e8;" />
  <p style="font-size: 13px; color: #79898f;">
    OptiGrid Energy &mdash; 14 Samora Machel Ave, Harare, Zimbabwe<br />
    <a href="tel:+263782345678" style="color: #79898f;">+263 78 234 5678</a> &nbsp;|&nbsp;
    <a href="mailto:info@optigridenergy.co.zw" style="color: #79898f;">info@optigridenergy.co.zw</a>
  </p>
</body>
</html>
`.trim();
}

/**
 * Basic HTML entity escaping to prevent injection in email bodies.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// Valid service options — kept in sync with the front-end select.
// ---------------------------------------------------------------------------
const VALID_SERVICES = new Set([
  "Residential",
  "Commercial",
  "Solar EPC",
  "PAYG",
  "Other",
]);

// ---------------------------------------------------------------------------
// POST /api/contact
// ---------------------------------------------------------------------------

/**
 * Handles contact form submissions.
 * - Discards honeypot-filled requests silently (spam protection).
 * - Validates required fields and returns field-level errors on bad input.
 * - Rate-limits per IP (5 per hour in-memory).
 * - Sends email via Resend when RESEND_API_KEY is configured; logs and
 *   succeeds gracefully otherwise (MVP fallback).
 */
router.post("/", async (req, res) => {
  const { name, email, phone, service, location, message, website } = req.body;

  // Silently discard honeypot-triggered submissions.
  if (website) {
    return res.status(200).json({ success: true });
  }

  // Rate limiting — req.ip respects trust proxy set in server.js.
  const clientIp = req.ip || "unknown";
  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      error: "Too many submissions. Please try again in an hour.",
    });
  }

  // Field validation.
  const errors = {};

  if (!name || name.trim().length < 2) {
    errors.name = "Please enter your full name (at least 2 characters).";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  if (!service || !VALID_SERVICES.has(service)) {
    errors.service = "Please select a service of interest.";
  }

  if (!message || message.trim().length < 10) {
    errors.message = "Please enter a message (at least 10 characters).";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const sanitised = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone ? phone.trim() : "",
    service,
    location: location ? location.trim() : "",
    message: message.trim(),
  };

  // Log every submission regardless of email availability — useful for debugging.
  console.log(
    `[contact] ${new Date().toISOString()} | ${sanitised.name} <${sanitised.email}> | ${sanitised.service} | IP: ${clientIp}`,
  );

  // Send emails — both fire independently so an auto-reply failure doesn't
  // prevent the internal notification from being delivered.
  const emailErrors = [];

  try {
    await sendEmail({
      to: "info@optigridenergy.co.zw",
      subject: `New Solar Enquiry from ${sanitised.name} — ${sanitised.service}`,
      html: buildInternalEmail(sanitised),
      replyTo: sanitised.email,
    });
  } catch (err) {
    console.error("[contact] Failed to send internal notification email:", err);
    emailErrors.push("internal");
  }

  try {
    await sendEmail({
      to: sanitised.email,
      subject: "We received your enquiry — OptiGrid Energy",
      html: buildAutoReplyEmail({ name: sanitised.name }),
    });
  } catch (err) {
    console.error("[contact] Failed to send auto-reply email:", err);
    emailErrors.push("autoreply");
  }

  // Return success even if emails failed — the submission itself was received.
  return res.status(200).json({ success: true });
});

module.exports = router;
