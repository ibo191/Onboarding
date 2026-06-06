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
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    return {
      sent: accepted.length > 0 && rejected.length === 0,
      provider: "smtp",
      messageId: info.messageId,
      accepted,
      rejected,
      response: info.response,
    };
  }
  return sendViaResend(normalized);
}

export function mailLayout({ title, intro, buttonUrl, buttonText, children = "", footer = "" }) {
  const safeButton = buttonUrl && buttonText
    ? `<p style="margin:28px 0 6px"><a href="${buttonUrl}" style="display:inline-block;background:#4AB9AB;color:#ffffff;padding:14px 22px;border-radius:12px;text-decoration:none;font-weight:800;box-shadow:0 10px 24px rgba(74,185,171,.24)">${buttonText}</a></p>`
    : "";
  return `
    <div style="margin:0;padding:0;background:#eef7f6">
      <div style="max-width:680px;margin:0 auto;padding:32px 16px;font-family:Montserrat,Arial,sans-serif;color:#10131a;line-height:1.55">
        <div style="margin:0 0 14px;padding:0 4px;color:#2F5AA6;font-weight:900;font-size:18px;letter-spacing:.01em">Autoškola BuBu</div>
        <div style="overflow:hidden;border:1px solid #d7e2ea;border-radius:20px;background:#ffffff;box-shadow:0 18px 48px rgba(47,90,166,.10)">
          <div style="height:8px;background:linear-gradient(90deg,#4AB9AB,#2F5AA6)"></div>
          <div style="padding:30px 28px 26px">
          <p style="display:inline-block;margin:0 0 14px;padding:6px 10px;border-radius:999px;background:#e9f8f6;color:#168d80;font-weight:900;text-transform:uppercase;font-size:12px">Řidičák bez stresu</p>
          <h1 style="margin:0 0 14px;font-size:30px;line-height:1.15;color:#10131a">${title}</h1>
          <p style="margin:0 0 20px;color:#475467;font-size:16px">${intro}</p>
          ${safeButton}
          ${children}
          </div>
        </div>
        <p style="margin:16px 4px 0;color:#667085;font-size:12px">${footer || "Tento e-mail posílá Autoškola BuBu automaticky."}</p>
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
