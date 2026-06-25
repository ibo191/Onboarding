import { json, portalBaseUrl, randomToken, readBody, sha256, supabaseRequest } from "./_supabase.js";
import { mailLayout, sendMail, textFromHtml } from "./_mail.js";

function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

function ordersEmail() {
  return env("ORDERS_EMAIL", env("ADMIN_EMAIL", "objednavky@autoskolabubu.cz"));
}

function siteUrl(path = "") {
  return `${env("PUBLIC_SITE_URL", "https://www.autoskolabubu.cz")}${path}`;
}

function portalUrl(req) {
  return `${portalBaseUrl(req)}/onboarding/index.html`;
}

function portalPasswordSetupUrl(req, applicationId, email, setupToken) {
  const url = new URL(portalUrl(req));
  url.searchParams.set("flow", "set-password");
  url.searchParams.set("application", applicationId);
  url.searchParams.set("email", email);
  url.searchParams.set("setup", setupToken);
  return url.toString();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "dle objednávky";
  return new Intl.NumberFormat("cs-CZ").format(number) + " Kč";
}

function applicantFromApplication(application) {
  return application.student || application.applicant || {};
}

function courseTitle(courseId = "") {
  const titles = {
    b: "Řidičák skupiny B",
    ba: "Řidičák skupiny B na automat",
    l17: "Řidičák skupiny B v režimu L17",
    a: "Řidičák skupiny A",
    a2: "Řidičák skupiny A2",
    a1: "Řidičák skupiny A1",
    am: "Řidičák skupiny AM",
    be: "Řidičák skupiny B+E",
    b96: "Rozšíření B96",
    kondicni: "Kondiční jízdy",
    maminky: "Jízdy pro maminky",
    ucitelak: "Učitelské oprávnění",
  };
  return titles[courseId] || courseId || "Kurz Autoškoly BuBu";
}

function courseSummary(application) {
  return {
    title: application.courseTitle || application.courseName || application.title || courseTitle(application.courseId),
    packageName: application.packageTitle || application.packageName || application.packageId || "",
    price: application.totalPrice || application.price || application.payment?.amount || "",
    location: application.branchName || application.location || application.branch || application.preferredBranch || "",
  };
}

function detailsTable(rows) {
  return `
    <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;margin:18px 0;border:1px solid #d7e2ea;border-radius:14px;overflow:hidden">
      ${rows.map(([key, value], index) => `
        <tr style="background:${index % 2 ? "#ffffff" : "#f8fbfc"}">
          <td style="padding:12px 14px;border-bottom:1px solid #e6eef2;color:#667085;font-size:13px;width:38%">${escapeHtml(key)}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #e6eef2;color:#10131a;font-weight:800;font-size:14px">${escapeHtml(value || "neuvedeno")}</td>
        </tr>`).join("")}
    </table>`;
}

function infoBox(title, text) {
  return `
    <div style="margin:18px 0;padding:16px;border-radius:14px;background:#eef9f7;border:1px solid #c9eeea">
      <p style="margin:0 0 6px;color:#168d80;font-weight:900">${escapeHtml(title)}</p>
      <p style="margin:0;color:#475467">${escapeHtml(text)}</p>
    </div>`;
}

function stepsList(items) {
  return `
    <div style="margin:22px 0 0">
      ${items.map((item, index) => `
        <div style="display:block;margin:0 0 10px;padding:12px 14px;border:1px solid #e1ebef;border-radius:12px;background:#ffffff">
          <span style="display:inline-block;width:26px;height:26px;margin-right:8px;border-radius:999px;background:#4AB9AB;color:#ffffff;text-align:center;line-height:26px;font-weight:900">${index + 1}</span>
          <span style="color:#344054;font-weight:700">${escapeHtml(item)}</span>
        </div>`).join("")}
    </div>`;
}

function createPortalAccess(application, email, req) {
  if (!application?.id || !email) return null;
  const normalizedEmail = String(email).toLowerCase();
  const setupToken = randomToken(32);
  const setupUrl = portalPasswordSetupUrl(req, application.id, normalizedEmail, setupToken);
  const setupExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  application.credentials = {
    ...(application.credentials || {}),
    email: normalizedEmail,
    portalLoginUrl: portalUrl(req),
    passwordSetupTokenHash: sha256(setupToken),
    passwordSetupTokenExpiresAt: setupExpiresAt,
    passwordSetupTokenUsedAt: "",
    passwordSet: Boolean(application.credentials?.passwordSet),
  };
  return { setupUrl, portalUrl: portalUrl(req) };
}

async function sendOrderEmails(application, req, portalAccess = null) {
  if (!application || application.mail?.orderEmailsSentAt) return { skipped: true };
  const applicant = applicantFromApplication(application);
  const email = String(applicant.email || application.credentials?.email || "").trim();
  const fullName = [applicant.firstName, applicant.lastName].filter(Boolean).join(" ") || "Nový student";
  const course = courseSummary(application);
  const selectedProducts = Array.isArray(application.selectedProducts) ? application.selectedProducts : [];
  const rows = [
    ["Student", fullName],
    ["E-mail", email],
    ["Telefon", applicant.phone || "neuvedeno"],
    ["Kurz", course.title],
    ["Balíček", course.packageName || "neuvedeno"],
    ["Pobočka", course.location || "neuvedeno"],
    ["Cena", money(course.price)],
    ...(selectedProducts.length ? [["Doplňky", selectedProducts.map((product) => product.title).join(", ")]] : []),
    ...(application.payment?.installments ? [["Splátky", "student má zájem o 3 splátky"]] : []),
  ];
  const table = detailsTable(rows);
  const result = { customer: null, admin: null, errors: {} };

  const adminHtml = mailLayout({
    title: "Nová přihláška do kurzu",
    intro: `${escapeHtml(fullName)} právě odeslal/a objednávku z webu. Níže je rychlý přehled pro zpracování v admin portálu.`,
    buttonUrl: siteUrl("/admin"),
    buttonText: "Otevřít admin portál",
    children: `
      ${infoBox("Kurz", `${course.title}${course.packageName ? ` · ${course.packageName}` : ""}`)}
      ${table}
      <p style="margin:18px 0 0;color:#475467">ID objednávky: <strong>${escapeHtml(application.id)}</strong></p>
      ${application.orderMessage ? infoBox("Zpráva od studenta", application.orderMessage) : ""}
    `,
    footer: "Interní upozornění pro Autoškolu BuBu.",
  });
  try {
    result.admin = await sendMail({
      to: ordersEmail(),
      subject: `Nová přihláška: ${fullName} - ${course.title} | Autoškola BuBu`,
      ...(email ? { replyTo: `${fullName} <${email}>` } : {}),
      html: adminHtml,
      text: textFromHtml(adminHtml),
    });
  } catch (error) {
    result.errors.admin = error.message;
  }

  if (email) {
    try {
      result.portalSetupUrl = portalAccess?.setupUrl || "";
    } catch (error) {
      result.errors.passwordSetup = error.message;
    }
    const customerHtml = mailLayout({
      title: "Přihláška je přijatá",
      intro: `Dobrý den, ${escapeHtml(fullName)}. Děkujeme za rezervaci místa v Autoškole BuBu. Přihlásil/a jste se do kurzu ${escapeHtml(course.title)}. Váš další krok je otevřít studentský portál, nastavit si heslo a doplnit údaje k přihlášce.`,
      buttonUrl: portalAccess?.setupUrl || "",
      buttonText: "Nastavit heslo do studentského portálu",
      children: `
        ${infoBox("Co teď musíte udělat", "Otevřete studentský portál, nastavte si heslo a vyplňte tam údaje. Bez doplnění údajů a dokumentů nemůžeme přihlášku posunout dál.")}
        ${infoBox("Vybraný kurz", `${course.title}${course.packageName ? ` · ${course.packageName}` : ""}`)}
        ${detailsTable([
          ["Kurz", course.title],
          ["Balíček", course.packageName || "neuvedeno"],
          ["Pobočka", course.location || "neuvedeno"],
          ["Cena", money(course.price)],
          ...(selectedProducts.length ? [["Doplňky", selectedProducts.map((product) => product.title).join(", ")]] : []),
        ])}
        <h2 style="margin:26px 0 10px;font-size:20px;color:#10131a">Co bude následovat</h2>
        ${stepsList([
          "Klikněte na tlačítko „Nastavit heslo do studentského portálu“.",
          "Nastavte si heslo. Přihlašovací jméno bude váš e-mail.",
          "Nahrajte potřebné dokumenty.",
          "Autoškola údaje zkontroluje a ozve se vám s dalším postupem.",
        ])}
        ${portalAccess?.setupUrl ? `
          <div style="margin:22px 0 0;padding:16px;border:1px solid #d7e2ea;border-radius:14px;background:#ffffff">
            <p style="margin:0 0 8px;color:#10131a;font-weight:900">Odkazy do portálu</p>
            <p style="margin:0 0 12px;color:#667085;font-size:13px">Nejprve si nastavte heslo. Přihlašovací jméno bude váš e-mail.</p>
            <a href="${escapeHtml(portalAccess.setupUrl)}" style="display:inline-block;margin:0 10px 10px 0;padding:12px 16px;border-radius:10px;background:#4AB9AB;color:#ffffff;text-decoration:none;font-weight:900">Nastavit heslo</a>
            <a href="${escapeHtml(portalAccess.portalUrl)}" style="display:inline-block;margin:0 0 10px;padding:12px 16px;border-radius:10px;background:#eef9f7;color:#1f3772;text-decoration:none;font-weight:900">Přihlásit se do portálu</a>
          </div>` : ""}
        <p style="margin:20px 0 0;color:#475467">Nemusíte se ničeho bát. Celým procesem vás provedeme krok za krokem.</p>
      `,
      footer: "Autoškola BuBu · Řidičák bez stresu",
    });
    try {
      result.customer = await sendMail({
        to: email,
        subject: `Potvrzení přihlášky: ${course.title} | Autoškola BuBu`,
        html: customerHtml,
        text: textFromHtml(customerHtml),
      });
    } catch (error) {
      result.errors.customer = error.message;
    }
  }

  const anySent = Boolean(result.admin?.sent || result.customer?.sent);
  application.mail = {
    ...(application.mail || {}),
    ...(anySent
      ? { orderEmailsSentAt: new Date().toISOString() }
      : { orderEmailSkippedAt: new Date().toISOString(), orderEmailSkippedReason: "smtp_not_configured" }),
    orderEmailProvider: result.admin?.provider || result.customer?.provider || "unknown",
    ordersEmail: ordersEmail(),
    ...(result.errors.admin ? { adminOrderEmailError: result.errors.admin } : {}),
    ...(result.errors.customer ? { customerOrderEmailError: result.errors.customer } : {}),
    ...(result.errors.passwordSetup ? { passwordSetupError: result.errors.passwordSetup } : {}),
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

async function preservePasswordSetupToken(application, source) {
  if (source !== "web" || !application?.id) return application;
  const credentials = application.credentials || {};
  if (credentials.passwordSetupTokenHash || credentials.passwordSetupTokenUsedAt) return application;

  const rows = await supabaseRequest(`applications?select=data&id=eq.${encodeURIComponent(application.id)}&source=eq.web&limit=1`);
  const existingCredentials = Array.isArray(rows) ? rows[0]?.data?.credentials || {} : {};
  if (!existingCredentials.passwordSetupTokenHash && !existingCredentials.passwordSetupTokenUsedAt) return application;

  return {
    ...application,
    credentials: {
      ...credentials,
      passwordSetupTokenHash: existingCredentials.passwordSetupTokenHash || "",
      passwordSetupTokenExpiresAt: existingCredentials.passwordSetupTokenExpiresAt || "",
      passwordSetupTokenUsedAt: existingCredentials.passwordSetupTokenUsedAt || "",
    },
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
      const { source, application, sendEmails = false } = await readBody(req);
      if (!["web", "onboarding"].includes(source) || !application?.id) return json(res, 400, { error: "Invalid application payload" });
      if (sendEmails === true && source === "web" && (application.status || "new") === "new") {
        const applicant = applicantFromApplication(application);
        const email = String(applicant.email || application.credentials?.email || "").trim();
        const portalAccess = createPortalAccess(application, email, req);
        await supabaseRequest("applications?on_conflict=id,source", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rowFromApplication(application, source)),
        });
        json(res, 200, {
          ok: true,
          mail: null,
          credentials: application.credentials ? {
            email: application.credentials.email || "",
            passwordSet: Boolean(application.credentials.passwordSet),
            portalLoginUrl: application.credentials.portalLoginUrl || "",
          } : null,
          portalSetupUrl: portalAccess?.setupUrl || "",
        });
        try {
          await sendOrderEmails(application, req, portalAccess);
        } catch (error) {
          application.mail = {
            ...(application.mail || {}),
            orderEmailErrorAt: new Date().toISOString(),
            orderEmailError: error.message,
            ordersEmail: ordersEmail(),
          };
        }
        try {
          await supabaseRequest("applications?on_conflict=id,source", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify(rowFromApplication(application, source)),
          });
        } catch (error) {
          console.error("Order e-mail status could not be saved", error);
        }
        return;
      }
      const applicationToSave = await preservePasswordSetupToken(application, source);
      await supabaseRequest("applications?on_conflict=id,source", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rowFromApplication(applicationToSave, source)),
      });
      return json(res, 200, {
        ok: true,
        mail: applicationToSave.mail || null,
        credentials: applicationToSave.credentials ? {
          email: applicationToSave.credentials.email || "",
          passwordSet: Boolean(applicationToSave.credentials.passwordSet),
          portalLoginUrl: applicationToSave.credentials.portalLoginUrl || "",
        } : null,
        portalSetupUrl: "",
      });
    }
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, { error: "Applications API failed", detail: error.message });
  }
}
