function env(name, fallback = "") {
  return String(process.env[name] || fallback).trim();
}

export function recaptchaSiteKey() {
  return env("RECAPTCHA_SITE_KEY", env("PUBLIC_RECAPTCHA_SITE_KEY", env("NEXT_PUBLIC_RECAPTCHA_SITE_KEY")));
}

export function recaptchaSecretKey() {
  return env("RECAPTCHA_SECRET_KEY", env("RECAPTCHA_SECRET"));
}

export async function verifyRecaptchaToken(token, req) {
  const secret = recaptchaSecretKey();
  const required = env("RECAPTCHA_REQUIRED", "false").toLowerCase() === "true";
  if (!secret) {
    if (required) return { ok: false, skipped: false, error: "reCAPTCHA secret key is missing" };
    return { ok: true, skipped: true };
  }
  if (!token) return { ok: false, skipped: false, error: "Missing reCAPTCHA token" };

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
  if (ip) body.set("remoteip", ip);

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: Boolean(payload.success),
    skipped: false,
    error: Array.isArray(payload["error-codes"]) ? payload["error-codes"].join(", ") : "",
    payload,
  };
}
