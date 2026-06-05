import { json } from "./_supabase.js";

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function present(name) {
  return Boolean(env(name));
}

export default function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  return json(res, 200, {
    smtpConfigured: present("SMTP_HOST") && present("SMTP_USER") && present("SMTP_PASS"),
    smtpHost: present("SMTP_HOST"),
    smtpPort: env("SMTP_PORT"),
    smtpSecure: env("SMTP_SECURE"),
    smtpUser: present("SMTP_USER"),
    smtpPass: present("SMTP_PASS"),
    mailFrom: env("MAIL_FROM", env("MAGIC_LINK_FROM_EMAIL")),
    ordersEmail: env("ORDERS_EMAIL", env("ADMIN_EMAIL", "objednavky@autoskolabubu.cz")),
    resendFallbackConfigured: present("RESEND_API_KEY"),
  });
}
