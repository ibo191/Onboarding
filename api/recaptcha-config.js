import { json } from "./_supabase.js";
import { recaptchaSiteKey } from "./_recaptcha.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  const siteKey = recaptchaSiteKey();
  return json(res, 200, { enabled: Boolean(siteKey), siteKey });
}
