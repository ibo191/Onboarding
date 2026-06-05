import { json, readBody, supabaseRequest } from "./_supabase.js";

function rowFromApplication(application, source) {
  const applicant = application.student || application.applicant || {};
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
      await supabaseRequest("applications?on_conflict=id,source", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rowFromApplication(application, source)),
      });
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, { error: "Applications API failed", detail: error.message });
  }
}
