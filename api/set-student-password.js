import { hashPassword, json, readBody, sha256, supabaseRequest } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { token, password } = await readBody(req);
    if (!token || !password || String(password).length < 8) {
      return json(res, 400, { error: "Token and stronger password are required" });
    }
    const tokenHash = sha256(token);
    const links = await supabaseRequest(`magic_links?select=*&token_hash=eq.${encodeURIComponent(tokenHash)}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`);
    const link = Array.isArray(links) ? links[0] : null;
    if (!link) return json(res, 400, { error: "Magic link is invalid or expired" });

    const rows = await supabaseRequest(`applications?select=*&source=eq.onboarding&id=eq.${encodeURIComponent(link.application_id)}&limit=1`);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.data) return json(res, 404, { error: "Application was not found" });

    const passwordData = hashPassword(password);
    const nextData = {
      ...row.data,
      credentials: {
        ...(row.data.credentials || {}),
        email: link.email,
        password: "",
        passwordHash: passwordData.hash,
        passwordSalt: passwordData.salt,
        passwordAlgorithm: passwordData.algorithm,
        passwordIterations: passwordData.iterations,
        passwordSet: true,
        magicToken: "",
        magicExpiresAt: "",
      },
    };
    await supabaseRequest(`applications?id=eq.${encodeURIComponent(row.id)}&source=eq.onboarding`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ data: nextData, status: nextData.status || row.status }),
    });
    await supabaseRequest(`magic_links?token_hash=eq.${encodeURIComponent(tokenHash)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    });
    return json(res, 200, { ok: true, applicationId: row.id, application: nextData });
  } catch (error) {
    return json(res, 500, { error: "Password could not be saved", detail: error.message });
  }
}
