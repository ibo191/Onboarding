import { json } from "./_supabase.js";

function present(name) {
  return Boolean(process.env[name]);
}

export default function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  return json(res, 200, {
    smtpConfigured: present("SMTP_HOST") && present("SMTP_USER") && present("SMTP_PASS"),
    smtpHost: present("SMTP_HOST"),
    smtpPort: process.env.SMTP_PORT || "",
    smtpSecure: process.env.SMTP_SECURE || "",
    smtpUser: present("SMTP_USER"),
    smtpPass: present("SMTP_PASS"),
    mailFrom: process.env.MAIL_FROM || process.env.MAGIC_LINK_FROM_EMAIL || "",
    ordersEmail: process.env.ORDERS_EMAIL || process.env.ADMIN_EMAIL || "objednavky@autoskolabubu.cz",
    resendFallbackConfigured: present("RESEND_API_KEY"),
  });
}
