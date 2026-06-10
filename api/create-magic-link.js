import { json, portalBaseUrl, randomToken, readBody, sha256, supabaseRequest } from "./_supabase.js";
import { mailLayout, sendMail, textFromHtml } from "./_mail.js";

function portalUrl(req) {
  return `${portalBaseUrl(req)}/onboarding/index.html`;
}

function portalPasswordSetupUrl(req, token) {
  const url = new URL(portalUrl(req));
  url.searchParams.set("magic", token);
  url.searchParams.set("flow", "set-password");
  return url.toString();
}

async function sendMagicEmail(email, magicUrl) {
  const html = mailLayout({
    title: "Studentský portál Autoškoly BuBu",
    intro: "Dobrý den, přes tlačítko níže si nastavíte heslo do studentského portálu. Přihlašovací jméno bude váš e-mail.",
    buttonUrl: magicUrl,
    buttonText: "Nastavit heslo",
    children: `<p style="margin:0;color:#475467">Odkaz je platný 24 hodin. Pokud jste o přístup nežádali, tento e-mail ignorujte.</p>`,
    footer: "Magic link je jednorázový a z bezpečnostních důvodů platí jen 24 hodin.",
  });
  return sendMail({
    to: email,
    subject: "Váš přístup do studentského portálu Autoškoly BuBu",
    html,
    text: textFromHtml(html),
  });
}

function applicantFromApplication(application = {}) {
  return application.student || application.applicant || {};
}

async function findApplicationRow(applicationId) {
  for (const source of ["onboarding", "web"]) {
    const rows = await supabaseRequest(`applications?select=*&source=eq.${source}&id=eq.${encodeURIComponent(applicationId)}&limit=1`);
    if (Array.isArray(rows) && rows[0]) return rows[0];
  }
  return null;
}

async function storeFallbackToken(applicationId, email, tokenHash, expiresAt, magicUrl, warning) {
  const row = await findApplicationRow(applicationId);
  if (!row?.data) throw new Error("Application was not found for magic link fallback");
  const application = {
    ...row.data,
    credentials: {
      ...(row.data.credentials || {}),
      email,
      magicLinkRequestedAt: new Date().toISOString(),
      magicLinkExpiresAt: expiresAt,
      magicLinkEmailSent: false,
      magicLinkPreviewUrl: magicUrl,
      magicLinkStorage: "application",
      magicLinkStorageWarning: warning,
      magicLinkError: "",
      magicTokenHash: tokenHash,
      magicTokenExpiresAt: expiresAt,
      magicTokenUsedAt: "",
    },
  };
  const applicant = applicantFromApplication(application);
  await supabaseRequest("applications?on_conflict=id,source", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: row.id,
      source: row.source,
      status: application.status || row.status || "new",
      course_id: application.courseId || application.course || applicant.targetGroups || "",
      student_email: String(applicant.email || application.credentials?.email || email || "").toLowerCase(),
      student_name: [applicant.firstName, applicant.lastName].filter(Boolean).join(" "),
      phone: applicant.phone || "",
      data: application,
      updated_at: new Date().toISOString(),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { applicationId, email } = await readBody(req);
    if (!applicationId || !email) return json(res, 400, { error: "Missing applicationId or email" });
    const normalizedEmail = String(email).toLowerCase();
    const token = randomToken(32);
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const magicUrl = portalPasswordSetupUrl(req, token);
    let storage = "magic_links";
    let storageWarning = "";
    try {
      await supabaseRequest(`magic_links?application_id=eq.${encodeURIComponent(applicationId)}&email=eq.${encodeURIComponent(normalizedEmail)}&used_at=is.null`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ used_at: new Date().toISOString() }),
      });
      await supabaseRequest("magic_links", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          token_hash: tokenHash,
          application_id: applicationId,
          email: normalizedEmail,
          expires_at: expiresAt,
        }),
      });
    } catch (error) {
      storage = "application";
      storageWarning = error.message || "magic_links write failed";
      await storeFallbackToken(applicationId, normalizedEmail, tokenHash, expiresAt, magicUrl, storageWarning);
    }
    const emailResult = await sendMagicEmail(normalizedEmail, magicUrl);
    return json(res, 200, {
      ok: true,
      expiresAt,
      emailSent: emailResult.sent,
      magicUrl,
      storage,
      ...(storageWarning ? { warning: storageWarning } : {}),
    });
  } catch (error) {
    return json(res, 500, { error: "Magic link could not be created", detail: error.message });
  }
}
