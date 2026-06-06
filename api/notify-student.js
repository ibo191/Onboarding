import { json, publicBaseUrl, readBody, supabaseRequest } from "./_supabase.js";
import { mailLayout, sendMail, textFromHtml } from "./_mail.js";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function applicantFromApplication(application = {}) {
  return application.student || application.applicant || {};
}

function studentEmail(application = {}) {
  const applicant = applicantFromApplication(application);
  return String(applicant.email || application.credentials?.email || "").trim().toLowerCase();
}

function studentName(application = {}) {
  const applicant = applicantFromApplication(application);
  return [applicant.firstName, applicant.lastName].filter(Boolean).join(" ") || "student";
}

async function findApplication(applicationId) {
  const rows = await supabaseRequest(`applications?select=source,data&id=eq.${encodeURIComponent(applicationId)}&order=updated_at.desc&limit=5`);
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows.find((row) => row.source === "web")?.data || rows[0]?.data || null;
}

function notificationContent(type, message, baseUrl) {
  const portalUrl = `${baseUrl}/onboarding/index.html`;
  const safeMessage = message
    ? `<div style="margin:18px 0;padding:14px 16px;border-radius:12px;background:#f4f8f8;border:1px solid #d7e2ea;color:#344054">${escapeHtml(message)}</div>`
    : "";

  if (type === "chat_message") {
    return {
      subject: "Nová zpráva ve studentském portálu | Autoškola BuBu",
      title: "Ve studentském portálu máte novou zprávu",
      intro: "Autoškola BuBu vám napsala zprávu do studentského portálu. Přihlaste se a podívejte se na detail.",
      buttonText: "Otevřít studentský portál",
      buttonUrl: portalUrl,
      children: safeMessage,
    };
  }

  if (type === "application_approved") {
    return {
      subject: "Přihláška je schválená | Autoškola BuBu",
      title: "Přihláška je schválená",
      intro: "Vaše údaje a dokumenty jsme zkontrolovali. Ve studentském portálu uvidíte další krok.",
      buttonText: "Pokračovat v portálu",
      buttonUrl: portalUrl,
      children: safeMessage,
    };
  }

  return {
    subject: "Je potřeba akce ve studentském portálu | Autoškola BuBu",
    title: "Ve studentském portálu čeká další krok",
    intro: "Prosíme, přihlaste se do studentského portálu a dokončete potřebný krok. Jakmile bude vše v pořádku, posuneme vaši přihlášku dál.",
    buttonText: "Otevřít studentský portál",
    buttonUrl: portalUrl,
    children: safeMessage,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { applicationId, type = "student_action_required", message = "" } = await readBody(req);
    if (!applicationId) return json(res, 400, { error: "Missing applicationId" });

    const application = await findApplication(applicationId);
    if (!application) return json(res, 404, { error: "Application not found" });

    const email = studentEmail(application);
    if (!email) return json(res, 400, { error: "Student e-mail is missing" });

    const content = notificationContent(type, message, publicBaseUrl(req));
    const html = mailLayout({
      title: content.title,
      intro: `Dobrý den, ${escapeHtml(studentName(application))}. ${content.intro}`,
      buttonUrl: content.buttonUrl,
      buttonText: content.buttonText,
      children: content.children,
      footer: "Tento e-mail je automatické upozornění ze studentského portálu Autoškoly BuBu.",
    });

    const result = await sendMail({
      to: email,
      subject: content.subject,
      html,
      text: textFromHtml(html),
    });

    return json(res, 200, { ok: true, emailSent: result.sent, provider: result.provider });
  } catch (error) {
    return json(res, 500, { error: "Student notification failed", detail: error.message });
  }
}
