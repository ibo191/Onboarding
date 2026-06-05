import { json, publicBaseUrl, randomToken, readBody, sha256, supabaseRequest } from "./_supabase.js";

async function sendMagicEmail(email, magicUrl) {
  if (!process.env.RESEND_API_KEY) return { sent: false, provider: "none" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAGIC_LINK_FROM_EMAIL || "Autoškola BuBu <noreply@autoskolabubu.cz>",
      to: [email],
      subject: "Váš přístup do studentského portálu Autoškoly BuBu",
      html: `
        <div style="font-family:Montserrat,Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h1>Studentský portál Autoškoly BuBu</h1>
          <p>Dobrý den, přes tlačítko níže si nastavíte heslo do studentského portálu.</p>
          <p><a href="${magicUrl}" style="display:inline-block;background:#4AB9AB;color:#fff;padding:14px 18px;border-radius:12px;text-decoration:none;font-weight:700">Nastavit heslo</a></p>
          <p>Odkaz je platný 24 hodin. Pokud jste o přístup nežádali, tento e-mail ignorujte.</p>
        </div>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
  return { sent: true, provider: "resend" };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  try {
    const { applicationId, email } = await readBody(req);
    if (!applicationId || !email) return json(res, 400, { error: "Missing applicationId or email" });
    const token = randomToken(32);
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabaseRequest(`magic_links?application_id=eq.${encodeURIComponent(applicationId)}&email=eq.${encodeURIComponent(String(email).toLowerCase())}&used_at=is.null`, {
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
        email: String(email).toLowerCase(),
        expires_at: expiresAt,
      }),
    });
    const magicUrl = `${publicBaseUrl(req)}/onboarding/index.html#magic=${encodeURIComponent(token)}`;
    const emailResult = await sendMagicEmail(email, magicUrl);
    return json(res, 200, {
      ok: true,
      expiresAt,
      emailSent: emailResult.sent,
      magicUrl: process.env.NODE_ENV === "production" && emailResult.sent ? undefined : magicUrl,
    });
  } catch (error) {
    return json(res, 500, { error: "Magic link could not be created", detail: error.message });
  }
}
