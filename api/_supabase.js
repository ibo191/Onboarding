import crypto from "node:crypto";

export function json(res, status, body, headers = {}) {
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(status).json(body);
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return { url, serviceKey };
}

export async function supabaseRequest(path, options = {}) {
  const { url, serviceKey } = supabaseEnv();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Supabase ${response.status}: ${message}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashPassword(password) {
  const salt = randomToken(16);
  const hash = crypto.pbkdf2Sync(String(password), salt, 210000, 32, "sha256").toString("base64url");
  return { salt, hash, algorithm: "pbkdf2-sha256", iterations: 210000 };
}

export function verifyPassword(password, credentials = {}) {
  if (!credentials.passwordHash || !credentials.passwordSalt) return false;
  const expected = Buffer.from(credentials.passwordHash, "base64url");
  const actual = crypto.pbkdf2Sync(String(password), credentials.passwordSalt, credentials.passwordIterations || 210000, expected.length, "sha256");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function publicBaseUrl(req) {
  return process.env.PUBLIC_SITE_URL || `https://${req.headers.host || "www.autoskolabubu.cz"}`;
}

export function portalBaseUrl(req) {
  const base =
    process.env.PORTAL_BASE_URL ||
    process.env.ONBOARDING_BASE_URL ||
    "https://onboarding-one-delta.vercel.app";
  return String(base)
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/onboarding\/index\.html$/i, "")
    .replace(/\/onboarding$/i, "");
}

export function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}
