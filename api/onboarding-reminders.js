import { json, portalBaseUrl, randomToken, readBody, sha256, supabaseRequest } from "./_supabase.js";
import { mailLayout, sendMail, textFromHtml } from "./_mail.js";

const REMINDER_DELAY_HOURS = 48;
const SETUP_TOKEN_TTL_HOURS = 72;

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

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

function orderCreatedAt(row = {}) {
  const application = row.data || {};
  return application.createdAt
    || application.orderCreatedAt
    || application.mail?.orderEmailsSentAt
    || row.created_at
    || row.updated_at
    || "";
}

function hoursSince(value, now = Date.now()) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return 0;
  return (now - time) / 36e5;
}

function hasStartedOnboarding(application = {}, onboardingById, onboardingByEmail) {
  const credentials = application.credentials || {};
  if (credentials.passwordSet || credentials.passwordSetupTokenUsedAt) return true;

  const byId = onboardingById.get(String(application.id || ""));
  const byEmail = onboardingByEmail.get(studentEmail(application));
  const onboarding = byId || byEmail;
  if (!onboarding) return false;

  const onboardingCredentials = onboarding.credentials || {};
  if (onboardingCredentials.passwordSet || onboardingCredentials.passwordHash) return true;
  if (onboarding.status && onboarding.status !== "new") return true;
  if (onboarding.review?.completedAt) return true;
  if (onboarding.documents && Object.keys(onboarding.documents).length > 0) return true;

  const applicant = applicantFromApplication(onboarding);
  const filledFields = [
    applicant.birthDate,
    applicant.birthPlace,
    applicant.birthNumber,
    applicant.identityDocument,
    applicant.address,
    applicant.authority,
    applicant.guardianName,
  ].filter(Boolean);
  return filledFields.length > 0;
}

function shouldSendReminder(row, onboardingById, onboardingByEmail, now = Date.now()) {
  const application = row.data || {};
  if (!application.id || !studentEmail(application)) return false;
  if ((application.status || "new") !== "new") return false;
  if (application.mail?.onboardingReminderSentAt) return false;
  if (hasStartedOnboarding(application, onboardingById, onboardingByEmail)) return false;
  return hoursSince(orderCreatedAt(row), now) >= REMINDER_DELAY_HOURS;
}

function portalUrl(req) {
  return `${portalBaseUrl(req)}/onboarding/index.html`;
}

function passwordSetupUrl(req, applicationId, email, setupToken) {
  const url = new URL(portalUrl(req));
  url.searchParams.set("flow", "set-password");
  url.searchParams.set("application", applicationId);
  url.searchParams.set("email", email);
  url.searchParams.set("setup", setupToken);
  return url.toString();
}

function rowFromApplication(application, row = {}) {
  const applicant = applicantFromApplication(application);
  return {
    id: application.id,
    source: "web",
    status: application.status || "new",
    course_id: application.courseId || application.course || applicant.targetGroups || "",
    student_email: studentEmail(application),
    student_name: studentName(application),
    phone: applicant.phone || "",
    data: application,
    updated_at: new Date().toISOString(),
  };
}

function courseTitle(application = {}) {
  return application.courseTitle || application.courseName || application.title || application.courseId || "kurz AutoSkoly BuBu";
}

function reminderHtml(application, setupUrl) {
  const name = studentName(application);
  return mailLayout({
    title: "Dokoncete prihlasku do kurzu",
    intro: `Dobry den, ${escapeHtml(name)}. Pred dvema dny jste si vytvoril/a objednavku v AutoSkole BuBu, ale studentsky portal zatim neni dokonceny.`,
    buttonUrl: setupUrl,
    buttonText: "Nastavit heslo a doplnit udaje",
    children: `
      <div style="margin:18px 0;padding:16px;border-radius:14px;background:#eef9f7;border:1px solid #c9eeea">
        <p style="margin:0 0 6px;color:#168d80;font-weight:900">Co je potreba udelat</p>
        <p style="margin:0;color:#475467">Nastavte si heslo do studentskeho portalu, doplnte osobni udaje a nahrajte zdravotni posudek. Bez toho nemuzeme prihlasku posunout ke kontrole.</p>
      </div>
      <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;margin:18px 0;border:1px solid #d7e2ea;border-radius:14px;overflow:hidden">
        <tr>
          <td style="padding:12px 14px;background:#f8fbfc;color:#667085;font-size:13px;width:38%">Kurz</td>
          <td style="padding:12px 14px;color:#10131a;font-weight:800;font-size:14px">${escapeHtml(courseTitle(application))}</td>
        </tr>
      </table>
      <p style="margin:18px 0 0;color:#475467">Pokud jste uz udaje doplnil/a, tento e-mail prosim ignorujte.</p>
    `,
    footer: "Automaticka pripominka ze studentskeho portalu AutoSkoly BuBu.",
  });
}

function isAuthorized(req, body = {}) {
  const secret = env("CRON_SECRET");
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}` || body.secret === secret;
}

async function fetchOnboardingMaps() {
  const rows = await supabaseRequest("applications?select=id,source,status,data,updated_at&source=eq.onboarding&order=updated_at.desc");
  const byId = new Map();
  const byEmail = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const application = row.data;
    if (!application) continue;
    if (application.id) byId.set(String(application.id), application);
    const email = studentEmail(application);
    if (email && !byEmail.has(email)) byEmail.set(email, application);
  }
  return { byId, byEmail };
}

async function sendReminder(application, row, req, testRecipient = "") {
  const email = testRecipient || studentEmail(application);
  const setupToken = randomToken(32);
  const setupExpiresAt = new Date(Date.now() + SETUP_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const nextApplication = {
    ...application,
    credentials: {
      ...(application.credentials || {}),
      email: studentEmail(application),
      portalLoginUrl: portalUrl(req),
      passwordSetupTokenHash: sha256(setupToken),
      passwordSetupTokenExpiresAt: setupExpiresAt,
      passwordSetupTokenUsedAt: "",
      passwordSet: false,
    },
  };
  const setupUrl = passwordSetupUrl(req, application.id, studentEmail(application), setupToken);
  const html = reminderHtml(nextApplication, setupUrl);
  const result = await sendMail({
    to: email,
    subject: "Pripominka: dokoncete prihlasku | AutoSkola BuBu",
    html,
    text: textFromHtml(html),
  });

  if (!testRecipient) {
    nextApplication.mail = {
      ...(nextApplication.mail || {}),
      onboardingReminderSentAt: new Date().toISOString(),
      onboardingReminderProvider: result.provider || "unknown",
    };
    await supabaseRequest("applications?on_conflict=id,source", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rowFromApplication(nextApplication, row)),
    });
  }

  return { sent: result.sent, provider: result.provider, to: email, application: nextApplication };
}

export default async function handler(req, res) {
  try {
    const body = req.method === "POST" ? await readBody(req).catch(() => ({})) : {};
    if (!["GET", "POST"].includes(req.method)) return json(res, 405, { error: "Method not allowed" });
    if (!isAuthorized(req, body)) return json(res, 401, { error: "Unauthorized" });

    const url = new URL(req.url, `https://${req.headers.host}`);
    const testRecipient = String(body.testRecipient || body.to || url.searchParams.get("testRecipient") || url.searchParams.get("to") || "").trim();
    const testMode = body.test === true || url.searchParams.get("test") === "1";

    if (testMode) {
      const sample = {
        id: "TEST-ONBOARDING-REMINDER",
        status: "new",
        courseTitle: "Ridicak skupiny B",
        applicant: {
          firstName: "Jakub",
          lastName: "Test",
          email: testRecipient || "jakub.abraham@autoskolabubu.cz",
        },
      };
      const result = await sendReminder(sample, {}, req, testRecipient || "jakub.abraham@autoskolabubu.cz");
      return json(res, 200, { ok: true, test: true, sent: result.sent, provider: result.provider, to: result.to });
    }

    const { byId, byEmail } = await fetchOnboardingMaps();
    const rows = await supabaseRequest("applications?select=id,source,status,data,updated_at&source=eq.web&order=updated_at.asc");
    const due = (Array.isArray(rows) ? rows : []).filter((row) => shouldSendReminder(row, byId, byEmail));
    const limit = Math.max(1, Number(env("ONBOARDING_REMINDER_LIMIT", "25")) || 25);
    const selected = due.slice(0, limit);
    const results = [];

    for (const row of selected) {
      try {
        const result = await sendReminder(row.data, row, req);
        results.push({ id: row.data.id, email: studentEmail(row.data), sent: result.sent, provider: result.provider });
      } catch (error) {
        results.push({ id: row.data?.id || row.id, email: studentEmail(row.data || {}), sent: false, error: error.message });
      }
    }

    return json(res, 200, { ok: true, count: results.length, remaining: Math.max(0, due.length - selected.length), results });
  } catch (error) {
    return json(res, 500, { error: "Onboarding reminders failed", detail: error.message });
  }
}
