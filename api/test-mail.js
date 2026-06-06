import { json, readBody } from "./_supabase.js";
import { mailLayout, sendMail, textFromHtml } from "./_mail.js";

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function ordersEmail() {
  return env("ORDERS_EMAIL", env("ADMIN_EMAIL", "objednavky@autoskolabubu.cz"));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const token = req.headers["x-mail-test-token"];
    if (!process.env.MAIL_TEST_TOKEN || token !== process.env.MAIL_TEST_TOKEN) {
      return json(res, 401, { error: "Unauthorized" });
    }
    const body = await readBody(req).catch(() => ({}));
    const url = new URL(req.url, `https://${req.headers.host}`);
    const recipient = String(body.to || url.searchParams.get("to") || ordersEmail()).trim();
    const html = mailLayout({
      title: "Test odosielania e-mailov",
      intro: "Toto je testovací e-mail z webu Autoškoly BuBu. Ak prišiel, SMTP odosielanie funguje.",
      footer: "Testovací e-mail z Vercel API.",
    });
    const result = await sendMail({
      to: recipient,
      subject: "Test SMTP | Autoškola BuBu",
      html,
      text: textFromHtml(html),
    });
    return json(res, 200, { ok: true, emailSent: result.sent, provider: result.provider, to: recipient, accepted: result.accepted || [], rejected: result.rejected || [], response: result.response || "" });
  } catch (error) {
    return json(res, 500, { error: "Test mail failed", detail: error.message });
  }
}
