import assert from "node:assert/strict";
import applicationsHandler from "../api/applications.js";
import passwordHandler from "../api/set-student-password.js";
import loginHandler from "../api/student-login.js";
import { sha256, verifyPassword } from "../api/_supabase.js";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
process.env.PORTAL_BASE_URL = "https://portal.example.com";
delete process.env.SMTP_HOST;
process.env.RESEND_API_KEY = "test-key";
let releaseMail;
const mailGate = new Promise((resolve) => { releaseMail = resolve; });
const rows = new Map();
const writes = [];
const keyFor = (row) => row.id + ":" + row.source;
globalThis.fetch = async (url, options = {}) => {
  const requestUrl = String(url);
  if (requestUrl.includes("applications?on_conflict=id,source") && options.method === "POST") {
    const row = JSON.parse(options.body);
    rows.set(keyFor(row), structuredClone(row));
    writes.push(structuredClone(row));
    return new Response(null, { status: 204 });
  }
  if (requestUrl.includes("applications?select=*&id=eq.order-123&source=eq.web")) {
    const row = rows.get("order-123:web");
    return Response.json(row ? [structuredClone(row)] : []);
  }
  if (requestUrl.includes("applications?select=*&source=eq.onboarding&student_email=eq.jan.novak%40example.cz")) {
    const row = rows.get("order-123:onboarding");
    return Response.json(row ? [structuredClone(row)] : []);
  }
  if (requestUrl === "https://api.resend.com/emails") {
    await mailGate;
    return Response.json({ id: "mail-test" });
  }
  throw new Error("Unexpected fetch: " + requestUrl);
};
function createRes() { return { statusCode: 0, headers: {}, body: null, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } }; }
const application = { id: "order-123", status: "new", courseTitle: "Skupina B", student: { firstName: "Jan", lastName: "Novak", email: "Jan.Novak@Example.cz", phone: "+420123456789" }, credentials: { email: "Jan.Novak@Example.cz", passwordSet: false }, payment: { amount: 19900 } };
const orderRes = createRes();
const orderRequest = applicationsHandler({ method: "POST", headers: { host: "www.example.com" }, body: { source: "web", application, sendEmails: true } }, orderRes);
while (!orderRes.statusCode) await new Promise((resolve) => setImmediate(resolve));
assert.equal(orderRes.statusCode, 200);
releaseMail();
await orderRequest;
assert.equal(orderRes.body.ok, true);
const setupUrl = new URL(orderRes.body.portalSetupUrl);
const setupToken = setupUrl.searchParams.get("setup");
assert.ok(setupToken);
assert.equal(setupUrl.searchParams.get("application"), "order-123");
assert.equal(setupUrl.searchParams.get("email"), "jan.novak@example.cz");
const storedWebRow = rows.get("order-123:web");
assert.equal(storedWebRow.data.credentials.passwordSetupTokenHash, sha256(setupToken));
assert.equal(JSON.stringify(storedWebRow).includes(setupToken), false);
assert.equal("passwordSetupTokenHash" in orderRes.body.credentials, false);
const passwordRes = createRes();
await passwordHandler({ method: "POST", body: { applicationId: "order-123", email: "jan.novak@example.cz", setupToken, password: "BezpecneHeslo123" } }, passwordRes);
assert.equal(passwordRes.statusCode, 200);
assert.equal(passwordRes.body.ok, true);
const portalRow = rows.get("order-123:onboarding");
assert.ok(portalRow);
assert.equal(portalRow.data.credentials.passwordSet, true);
assert.equal(portalRow.data.credentials.password, "");
assert.equal(verifyPassword("BezpecneHeslo123", portalRow.data.credentials), true);
assert.equal(rows.get("order-123:web").data.credentials.passwordSetupTokenHash, "");
assert.ok(rows.get("order-123:web").data.credentials.passwordSetupTokenUsedAt);
const loginRes = createRes();
await loginHandler({ method: "POST", body: { email: "jan.novak@example.cz", password: "BezpecneHeslo123" } }, loginRes);
assert.equal(loginRes.statusCode, 200);
assert.equal(loginRes.body.applicationId, "order-123");
const reuseRes = createRes();
await passwordHandler({ method: "POST", body: { applicationId: "order-123", email: "jan.novak@example.cz", setupToken, password: "IneBezpecneHeslo123" } }, reuseRes);
assert.equal(reuseRes.statusCode, 403);
console.log("order -> password -> login flow ok");
