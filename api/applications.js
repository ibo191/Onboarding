import { json, readBody, supabaseRequest } from "./_supabase.js";
import { mailLayout, sendMail, textFromHtml } from "./_mail.js";

function ordersEmail() {
  return process.env.ORDERS_EMAIL || process.env.ADMIN_EMAIL || "objednavky@autoskolabubu.cz";
}

function applicantFromApplication(application) {
  return application.student || application.applicant || {};
}

function courseSummary(application) {
  return {
    title: application.courseTitle || application.courseName || application.title || application.courseId || "Kurz Autoškoly BuBu",
    packageName: application.packageTitle || application.packageName || application.packageId || "",
    price: application.totalPrice || application.price || application.payment?.amount || "",
    location: application.branchName || application.location || application.branch || "",
  };
}

async function sendOrderEmails(application) {
  if (!application || application.mail?.orderEmailsSentAt) return { skipped: true };
  const applicant = applicantFromApplication(application);
  const email = String(applicant.email || application.credentials?.email || "").trim();
  const fullName = [applicant.firstName, applicant.lastName].filter(Boolean).join(" ") || "Nový student";
  const course = courseSummary(application);
  const rows = [
    ["Student", fullName],
    ["E-mail", email],
    ["Telefon", applicant.phone || "neuvedeno"],
    ["Kurz", course.title],
    ["Balíček", course.packageName || "neuvedeno"],
    ["Pobočka", course.location || "neuvedeno"],
    ["Cena", course.price ? `${course.price} Kč` : "dle objednávky"],
  ];
  const table = `<table style="width:100%;border-collapse:collapse;margin:18px 0">${rows.map(([key, value]) => `<tr><td style="padding:8px 10px;border:1px solid #d7e2ea;color:#667085">${key}</td><td style="padding:8px 10px;border:1px solid #d7e2ea;font-weight:700">${value}</td></tr>`).join("")}</table>`;
  const result = { customer: null, admin: null };

  if (email) {
    const customerHtml = mailLayout({
      title: "Objednávku máme v systému",
      intro: "Děkujeme za rezervaci místa v Autoškole BuBu. Další kroky vám pošleme e-mailem a přístup do studentského portálu dorazí samostatným odkazem.",
      children: table,
      footer: "Objednávka je přijatá. Autoškola BuBu vás provede dalším postupem.",
    });
    result.customer = await sendMail({
      to: email,
      subject: "Potvrzení objednávky | Autoškola BuBu",
      html: customerHtml,
      text: textFromHtml(customerHtml),
    });
  }

  const adminHtml = mailLayout({
    title: "Nová objednávka z webu",
    intro: "Na webu Autoškoly BuBu vznikla nová objednávka. Detail uvidíte v admin portálu.",
    children: `${table}<p style="margin:18px 0 0;color:#475467">ID objednávky: <strong>${application.id}</strong></p>`,
    footer: "Interní upozornění pro Autoškolu BuBu.",
  });
  result.admin = await sendMail({
    to: ordersEmail(),
    subject: `Nová objednávka: ${fullName} | Autoškola BuBu`,
    html: adminHtml,
    text: textFromHtml(adminHtml),
  });

  const anySent = Boolean(result.admin?.sent || result.customer?.sent);
  application.mail = {
    ...(application.mail || {}),
    ...(anySent
      ? { orderEmailsSentAt: new Date().toISOString() }
      : { orderEmailSkippedAt: new Date().toISOString(), orderEmailSkippedReason: "smtp_not_configured" }),
    orderEmailProvider: result.admin?.provider || result.customer?.provider || "unknown",
    ordersEmail: ordersEmail(),
  };
  return result;
}

function rowFromApplication(application, source) {
  const applicant = applicantFromApplication(application);
  return {
    id: application.id,
    source,
    status: application.status || "new",
    course_id: application.courseId || application.course || applicant.targetGroups || "",
    student_email: String(applicant.email || application.credentials?.email || "").toLowerCase(),
    student_name: [applicant.firstName, applicant.lastName].filter(Boolean).join(" "),
    phone: applicant.phone || "",
    data: application,
    updated_at: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const source = req.query?.source || new URL(req.url, `https://${req.headers.host}`).searchParams.get("source");
      if (!["web", "onboarding"].includes(source)) return json(res, 400, { error: "Invalid source" });
      const rows = await supabaseRequest(`applications?select=id,source,status,data,updated_at&source=eq.${encodeURIComponent(source)}&order=updated_at.desc`);
      return json(res, 200, { applications: Array.isArray(rows) ? rows.map((row) => row.data).filter(Boolean) : [] });
    }
    if (req.method === "POST") {
      const { source, application } = await readBody(req);
      if (!["web", "onboarding"].includes(source) || !application?.id) return json(res, 400, { error: "Invalid application payload" });
      let mailResult = null;
      if (source === "web" && (application.status || "new") === "new") {
        try {
          const existingRows = await supabaseRequest(`applications?select=data&source=eq.web&id=eq.${encodeURIComponent(application.id)}&limit=1`);
          const existingMail = Array.isArray(existingRows) ? existingRows[0]?.data?.mail : null;
          if (existingMail?.orderEmailsSentAt) {
            application.mail = { ...(application.mail || {}), ...existingMail };
            mailResult = { skipped: true, reason: "already_sent" };
          } else {
            mailResult = await sendOrderEmails(application);
          }
        } catch (error) {
          application.mail = {
            ...(application.mail || {}),
            orderEmailErrorAt: new Date().toISOString(),
            orderEmailError: error.message,
            ordersEmail: ordersEmail(),
          };
          mailResult = { sent: false, error: error.message };
        }
      }
      await supabaseRequest("applications?on_conflict=id,source", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rowFromApplication(application, source)),
      });
      return json(res, 200, { ok: true, mail: mailResult });
    }
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, { error: "Applications API failed", detail: error.message });
  }
}
