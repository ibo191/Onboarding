import { json, readBody, supabaseRequest, verifyPassword } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { email, password } = await readBody(req);
    if (!email || !password) return json(res, 400, { error: "Missing email or password" });
    const normalizedEmail = String(email).toLowerCase();
    const rows = await supabaseRequest(`applications?select=*&source=eq.onboarding&student_email=eq.${encodeURIComponent(normalizedEmail)}&order=updated_at.desc&limit=1`);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.data || !verifyPassword(password, row.data.credentials || {})) {
      return json(res, 401, { error: "Invalid credentials" });
    }
    return json(res, 200, { ok: true, applicationId: row.id, application: row.data });
  } catch (error) {
    return json(res, 500, { error: "Login failed", detail: error.message });
  }
}
