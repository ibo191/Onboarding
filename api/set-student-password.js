import { hashPassword, json, readBody, supabaseRequest } from "./_supabase.js";

const DEFAULT_BANK_ACCOUNT = "2702696953/2010";

function portalApplicationFromWeb(webApplication = {}) {
  if (webApplication.applicant) return webApplication;
  const student = webApplication.student || {};
  const credentials = webApplication.credentials || {};
  const id = webApplication.id || "";
  return {
    id,
    createdAt: webApplication.createdAt || new Date().toISOString(),
    status: webApplication.status || "new",
    course: webApplication.courseTitle || webApplication.course || webApplication.courseId || "Web objednávka",
    package: webApplication.packageTitle || webApplication.packageName || "Web objednávka",
    price: Number(webApplication.payment?.amount || webApplication.totalPrice || webApplication.price || 0),
    selectedProducts: webApplication.selectedProducts || [],
    applicant: {
      targetGroups: webApplication.courseGroup || student.targetGroups || webApplication.courseId || "",
      hasLicense: student.hasLicense || (student.heldGroups ? "yes" : "no"),
      heldGroups: student.heldGroups || "",
      licenseNumber: student.licenseNumber || "",
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      birthDate: student.birthDate || "",
      birthPlace: student.birthPlace || "",
      birthNumber: student.birthNumber || "",
      citizenship: student.citizenship || "",
      identityDocument: student.identityDocument || "",
      phone: student.phone || "",
      address: student.address || "",
      zip: student.zip || "",
      authority: student.authority || "",
      email: student.email || credentials.email || "",
      guardianName: student.guardianName || "",
    },
    documents: {
      healthReport: webApplication.fileUploads?.health || webApplication.documents?.healthReport || null,
      licenseBack: webApplication.fileUploads?.licenseBack || webApplication.documents?.licenseBack || null,
    },
    review: {
      documentsOk: false,
      applicantDataOk: false,
      reminderSentAt: webApplication.review?.reminderSentAt || null,
      note: webApplication.reviewNote || "",
    },
    credentials: {
      email: credentials.email || student.email || "",
      passwordSet: Boolean(credentials.passwordSet),
    },
    payment: {
      amount: Number(webApplication.payment?.amount || webApplication.totalPrice || 0),
      account: webApplication.payment?.account || DEFAULT_BANK_ACCOUNT,
      variableSymbol: webApplication.payment?.variableSymbol || String(id).replace(/\D/g, ""),
      installments: Boolean(webApplication.payment?.installments),
      installmentCount: webApplication.payment?.installmentCount || 1,
      instruction: webApplication.payment?.note || "Prosíme o úhradu podle pokynů autoškoly.",
    },
    mojeAutoskola: webApplication.moje || { status: "Přihlašovací údaje odejdou e-mailem." },
    messages: webApplication.messages || [],
  };
}

function rowFromApplication(application) {
  const applicant = application.applicant || {};
  return {
    id: application.id,
    source: "onboarding",
    status: application.status || "new",
    course_id: application.course || applicant.targetGroups || "",
    student_email: String(applicant.email || application.credentials?.email || "").toLowerCase(),
    student_name: [applicant.firstName, applicant.lastName].filter(Boolean).join(" "),
    phone: applicant.phone || "",
    data: application,
    updated_at: new Date().toISOString(),
  };
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function rowEmail(row) {
  const data = row?.data || {};
  const applicant = data.applicant || data.student || {};
  return normalizeEmail(row?.student_email || data.credentials?.email || applicant.email);
}

async function findApplicationForPasswordSetup(applicationId, email) {
  const normalizedEmail = normalizeEmail(email);
  const id = String(applicationId || "").trim();
  if (id) {
    const rows = await supabaseRequest(`applications?select=*&id=eq.${encodeURIComponent(id)}&order=updated_at.desc&limit=10`);
    const row = Array.isArray(rows) ? rows.find((item) => !normalizedEmail || rowEmail(item) === normalizedEmail) : null;
    if (row?.data) return row;
  }
  if (!normalizedEmail) return null;
  const rows = await supabaseRequest(`applications?select=*&student_email=eq.${encodeURIComponent(normalizedEmail)}&order=updated_at.desc&limit=20`);
  const row = Array.isArray(rows)
    ? rows.find((item) => item.source === "onboarding" && rowEmail(item) === normalizedEmail)
      || rows.find((item) => item.source === "web" && rowEmail(item) === normalizedEmail)
      || rows.find((item) => rowEmail(item) === normalizedEmail)
    : null;
  return row?.data ? row : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { email, applicationId, password } = await readBody(req);
    if (!password || String(password).length < 8) {
      return json(res, 400, { error: "Stronger password is required" });
    }
    if (!email && !applicationId) {
      return json(res, 400, { error: "Application e-mail or application ID is required" });
    }

    const row = await findApplicationForPasswordSetup(applicationId, email);
    if (!row?.data) return json(res, 404, { error: "Application was not found" });
    const normalizedEmail = normalizeEmail(email || rowEmail(row));
    if (!normalizedEmail || rowEmail(row) !== normalizedEmail) return json(res, 403, { error: "Application e-mail does not match" });

    const passwordData = hashPassword(password);
    const portalData = portalApplicationFromWeb(row.data);
    const nextData = {
      ...portalData,
      id: portalData.id || row.id,
      credentials: {
        ...(portalData.credentials || {}),
        email: normalizedEmail,
        password: "",
        passwordHash: passwordData.hash,
        passwordSalt: passwordData.salt,
        passwordAlgorithm: passwordData.algorithm,
        passwordIterations: passwordData.iterations,
        passwordSet: true,
      },
    };
    await supabaseRequest("applications?on_conflict=id,source", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rowFromApplication(nextData)),
    });
    return json(res, 200, { ok: true, applicationId: row.id, application: nextData });
  } catch (error) {
    return json(res, 500, { error: "Password could not be saved", detail: error.message });
  }
}
