import { hashPassword, json, readBody, sha256, supabaseRequest } from "./_supabase.js";

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

async function findMagicLink(tokenHash) {
  try {
    const links = await supabaseRequest(`magic_links?select=*&token_hash=eq.${encodeURIComponent(tokenHash)}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`);
    const link = Array.isArray(links) ? links[0] : null;
    if (link) return { link, fallbackRow: null };
  } catch (error) {
    // Older deployments may not have a usable magic_links table yet. In that case
    // we validate the token against the hashed fallback stored on the application.
  }
  const rows = await supabaseRequest("applications?select=*&order=updated_at.desc&limit=500");
  const now = Date.now();
  const fallbackRow = Array.isArray(rows)
    ? rows.find((row) => {
        const credentials = row?.data?.credentials || {};
        const expiresAt = credentials.magicTokenExpiresAt || credentials.magicLinkExpiresAt || "";
        return credentials.magicTokenHash === tokenHash
          && !credentials.magicTokenUsedAt
          && Number.isFinite(new Date(expiresAt).getTime())
          && new Date(expiresAt).getTime() > now;
      })
    : null;
  if (!fallbackRow?.data) return null;
  return {
    fallbackRow,
    link: {
      application_id: fallbackRow.id,
      email: fallbackRow.data.credentials?.email || fallbackRow.student_email || "",
      fallback: true,
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { token, password } = await readBody(req);
    if (!token || !password || String(password).length < 8) {
      return json(res, 400, { error: "Token and stronger password are required" });
    }
    const tokenHash = sha256(token);
    const found = await findMagicLink(tokenHash);
    const link = found?.link || null;
    if (!link) return json(res, 400, { error: "Magic link is invalid or expired" });

    const onboardingRows = found?.fallbackRow?.source === "onboarding"
      ? [found.fallbackRow]
      : await supabaseRequest(`applications?select=*&source=eq.onboarding&id=eq.${encodeURIComponent(link.application_id)}&limit=1`);
    const webRows = Array.isArray(onboardingRows) && onboardingRows[0]
      ? []
      : found?.fallbackRow?.source === "web"
        ? [found.fallbackRow]
        : await supabaseRequest(`applications?select=*&source=eq.web&id=eq.${encodeURIComponent(link.application_id)}&limit=1`);
    const row = Array.isArray(onboardingRows) && onboardingRows[0] ? onboardingRows[0] : Array.isArray(webRows) ? webRows[0] : null;
    if (!row?.data) return json(res, 404, { error: "Application was not found" });

    const passwordData = hashPassword(password);
    const portalData = portalApplicationFromWeb(row.data);
    const nextData = {
      ...portalData,
      credentials: {
        ...(portalData.credentials || {}),
        email: link.email,
        password: "",
        passwordHash: passwordData.hash,
        passwordSalt: passwordData.salt,
        passwordAlgorithm: passwordData.algorithm,
        passwordIterations: passwordData.iterations,
        passwordSet: true,
        magicToken: "",
        magicExpiresAt: "",
        magicTokenHash: "",
        magicTokenExpiresAt: "",
        magicTokenUsedAt: new Date().toISOString(),
      },
    };
    await supabaseRequest("applications?on_conflict=id,source", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rowFromApplication(nextData)),
    });
    if (link.fallback && found?.fallbackRow?.data) {
      await supabaseRequest(`applications?id=eq.${encodeURIComponent(found.fallbackRow.id)}&source=eq.${encodeURIComponent(found.fallbackRow.source)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          data: {
            ...found.fallbackRow.data,
            credentials: {
              ...(found.fallbackRow.data.credentials || {}),
              magicTokenHash: "",
              magicTokenExpiresAt: "",
              magicTokenUsedAt: new Date().toISOString(),
            },
          },
        }),
      });
    } else {
      await supabaseRequest(`magic_links?token_hash=eq.${encodeURIComponent(tokenHash)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ used_at: new Date().toISOString() }),
      });
    }
    return json(res, 200, { ok: true, applicationId: row.id, application: nextData });
  } catch (error) {
    return json(res, 500, { error: "Password could not be saved", detail: error.message });
  }
}
