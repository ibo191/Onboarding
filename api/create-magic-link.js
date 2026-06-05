import { json, publicBaseUrl, randomToken, readBody, sha256, supabaseRequest } from "./_supabase.js";
import { mailLayout, sendMail, textFromHtml } from "./_mail.js";

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
