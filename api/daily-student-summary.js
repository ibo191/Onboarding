import { json, portalBaseUrl, readBody, supabaseRequest } from "./_supabase.js";
import { mailLayout, sendMail, textFromHtml } from "./_mail.js";

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function ordersEmail() {
  return env("ORDERS_EMAIL", env("ADMIN_EMAIL", "objednavky@autoskolabubu.cz"));
}

function pragueDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, hour: value("hour") };
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
  return application.applicant || application.student || {};
}

function applicantName(application = {}) {
  const applicant = applicantFromApplication(application);
  return [applicant.firstName, applicant.lastName].filter(Boolean).join(" ") || "Student";
}

function rowFromApplication(application) {
  const applicant = applicantFromApplication(application);
  return {
    id: application.id,
    source: "onboarding",
    status: application.status || "new",
    course_id: application.course || applicant.targetGroups || "",
    student_email: String(applicant.email || application.credentials?.email || "").toLowerCase(),
    student_name: applicantName(application),
    phone: applicant.phone || "",
    data: application,
    updated_at: new Date().toISOString(),
  };
}

function shouldInclude(application, today) {
  const review = application.review || {};
  if (application.status !== "student_completed") return false;
  if (!review.completedAt) return false;
  if (review.completedSummarySentDate === today) return false;
  if (!review.completedSummarySentAt) return true;
  return new Date(review.completedAt) > new Date(review.completedSummarySentAt);
}

function summaryRows(applications) {
  return `
    <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;margin:18px 0;border:1px solid #d7e2ea;border-radius:14px;overflow:hidden">
      ${applications.map((application, index) => {
        const applicant = applicantFromApplication(application);
        const portalUrl = `${application.portalBaseUrl || ""}/onboarding/index.html#admin`;
        return `
          <tr style="background:${index % 2 ? "#ffffff" : "#f8fbfc"}">
            <td style="padding:12px 14px;border-bottom:1px solid #e6eef2;color:#10131a;font-weight:900">${escapeHtml(applicantName(application))}</td>
            <td style="padding:12px 14px;border-bottom:1px solid #e6eef2;color:#475467">${escapeHtml(applicant.email || application.credentials?.email || "")}</td>
            <td style="padding:12px 14px;border-bottom:1px solid #e6eef2;color:#475467">${escapeHtml(applicant.phone || "")}</td>
            <td style="padding:12px 14px;border-bottom:1px solid #e6eef2;color:#475467">${escapeHtml(applicant.targetGroups || application.course || "")}</td>
            <td style="padding:12px 14px;border-bottom:1px solid #e6eef2"><a href="${escapeHtml(portalUrl)}" style="color:#2F5AA6;font-weight:900;text-decoration:none">Otevřít</a></td>
          </tr>`;
      }).join("")}
    </table>`;
}

export default async function handler(req, res) {
  try {
    const body = req.method === "POST" ? await readBody(req) : {};
    const forceAllowed = env("ALLOW_DAILY_SUMMARY_FORCE").toLowerCase() === "true";
    const force = forceAllowed && (req.query?.force === "1" || body.force === true);
    const secret = env("CRON_SECRET");
    if (secret && req.headers.authorization !== `Bearer ${secret}` && !force) {
      return json(res, 401, { error: "Unauthorized" });
    }

    const prague = pragueDateParts();
    if (!force && prague.hour !== "07") {
      return json(res, 200, { ok: true, skipped: true, reason: "outside_prague_7am", prague });
    }

    const rows = await supabaseRequest("applications?select=id,source,status,data,updated_at&source=eq.onboarding&order=updated_at.desc");
    const portalBase = portalBaseUrl(req);
    const applications = (Array.isArray(rows) ? rows : [])
      .map((row) => row.data)
      .filter(Boolean)
      .filter((application) => shouldInclude(application, prague.date))
      .map((application) => ({ ...application, portalBaseUrl: portalBase }));

    if (!applications.length) {
      return json(res, 200, { ok: true, sent: false, count: 0, date: prague.date });
    }

    const html = mailLayout({
      title: "Denní přehled doplněných údajů",
      intro: `Studenti níže odeslali údaje ke kontrole. Přehled je za den ${escapeHtml(prague.date)} a posílá se jednou denně.`,
      buttonUrl: `${portalBase}/onboarding/index.html#admin`,
      buttonText: "Otevřít admin portál",
      children: summaryRows(applications),
      footer: "Automatický ranní přehled ze studentského portálu Autoškoly BuBu.",
    });

    const result = await sendMail({
      to: ordersEmail(),
      subject: `Denní přehled doplněných údajů (${applications.length}) | Autoškola BuBu`,
      html,
      text: textFromHtml(html),
    });

    const sentAt = new Date().toISOString();
    await Promise.all(applications.map((application) => {
      const nextApplication = {
        ...application,
        review: {
          ...(application.review || {}),
          completedSummarySentAt: sentAt,
          completedSummarySentDate: prague.date,
        },
      };
      delete nextApplication.portalBaseUrl;
      return supabaseRequest("applications?on_conflict=id,source", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rowFromApplication(nextApplication)),
      });
    }));

    return json(res, 200, { ok: true, sent: result.sent, provider: result.provider, count: applications.length, date: prague.date });
  } catch (error) {
    return json(res, 500, { error: "Daily student summary failed", detail: error.message });
  }
}
