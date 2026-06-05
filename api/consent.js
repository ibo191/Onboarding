import { clientIp, json, randomToken, readBody, sha256, supabaseRequest } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const body = await readBody(req);
    const consentId = body.consentId || randomToken(18);
    const decision = {
      necessary: true,
      analytics: Boolean(body.analytics),
      marketing: Boolean(body.marketing),
    };
    await supabaseRequest("cookie_consents", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        consent_id: consentId,
        decision,
        page: body.page || "",
        user_agent: req.headers["user-agent"] || "",
        ip_hash: clientIp(req) ? sha256(clientIp(req)) : "",
      }),
    });
    res.setHeader("Set-Cookie", `bubu_cookie_consent=${encodeURIComponent(consentId)}; Max-Age=31536000; Path=/; Secure; SameSite=Lax`);
    return json(res, 200, { ok: true, consentId, decision });
  } catch (error) {
    return json(res, 500, { error: "Consent could not be stored", detail: error.message });
  }
}
