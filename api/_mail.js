import nodemailer from "nodemailer";

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function fromAddress() {
  return env("MAIL_FROM", env("MAGIC_LINK_FROM_EMAIL", "Autoškola BuBu <info@autoskolabubu.cz>"));
}

function smtpReady() {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS"));
}

function smtpTransport() {
  const secure = env("SMTP_SECURE", "false").toLowerCase() === "true";
  return nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: Number(env("SMTP_PORT", secure ? "465" : "587")),
    secure,
    auth: {
      user: env("SMTP_USER"),
      pass: env("SMTP_PASS"),
    },
    requireTLS: !secure,
  });
}

async function sendViaResend(message) {
  if (!process.env.RESEND_API_KEY) return { sent: false, provider: "none" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: message.from || fromAddress(),
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
  return { sent: true, provider: "resend" };
}

export async function sendMail(message) {
  const normalized = {
    ...message,
    from: message.from || fromAddress(),
  };
  if (smtpReady()) {
    const info = await smtpTransport().sendMail(normalized);
    return { sent: true, provider: "smtp", messageId: info.messageId };
  }
  return sendViaResend(normalized);
}

export function mailLayout({ title, intro, buttonUrl, buttonText, children = "", footer = "" }) {
  const safeButton = buttonUrl && buttonText
    ? `<p style="margin:26px 0"><a href="${buttonUrl}" style="display:inline-block;background:#4AB9AB;color:#fff;padding:14px 20px;border-radius:10px;text-decoration:none;font-weight:800">${buttonText}</a></p>`
    : "";
  return `
    <div style="margin:0;padding:0;background:#f4f8f8">
      <div style="max-width:640px;margin:0 auto;padding:28px 16px;font-family:Montserrat,Arial,sans-serif;color:#10131a;line-height:1.55">
        <div style="padding:26px;border:1px solid #d7e2ea;border-radius:14px;background:#ffffff">
          <p style="margin:0 0 10px;color:#2F5AA6;font-weight:900;text-transform:uppercase;font-size:12px">Autoškola BuBu</p>
          <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15">${title}</h1>
          <p style="margin:0 0 18px;color:#475467">${intro}</p>
          ${safeButton}
          ${children}
        </div>
        <p style="margin:16px 0 0;color:#667085;font-size:12px">${footer || "Tento e-mail posílá Autoškola BuBu automaticky."}</p>
      </div>
    </div>`;
}

export function textFromHtml(html = "") {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
