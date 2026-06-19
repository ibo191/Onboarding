import assert from "node:assert/strict";
import handler from "../api/set-student-password.js";
import { verifyPassword } from "../api/_supabase.js";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

const savedRows = [];
const usedMagicLinks = [];
const magicToken = "magic-token-123";
const magicTokenHash = "c89fed75ce95ae149c7994e097f3065a0070edd94f83c0d0f2a2e29f1fdebb89";
const webApplication = {
  id: "order-123",
  status: "new",
  courseTitle: "Skupina B",
  student: {
    firstName: "Jan",
    lastName: "Novak",
    email: "Jan.Novak@Example.cz",
    phone: "+420123456789",
  },
  payment: { amount: 19900 },
};

globalThis.fetch = async (url, options = {}) => {
  const requestUrl = String(url);
  if (requestUrl.includes(`magic_links?select=*&token_hash=eq.${magicTokenHash}`)) {
    return Response.json([
      {
        id: "magic-row-1",
        application_id: "order-123",
        email: "jan.novak@example.cz",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        used_at: null,
      },
    ]);
  }
  if (requestUrl.includes("magic_links?id=eq.magic-row-1") && options.method === "PATCH") {
    usedMagicLinks.push(JSON.parse(options.body));
    return new Response(null, { status: 204 });
  }
  if (requestUrl.includes("applications?select=*&id=eq.order-123")) {
    return Response.json([
      {
        id: "order-123",
        source: "web",
        status: "new",
        student_email: "jan.novak@example.cz",
        data: webApplication,
        updated_at: "2026-06-19T10:00:00.000Z",
      },
    ]);
  }
  if (requestUrl.includes("applications?on_conflict=id,source") && options.method === "POST") {
    savedRows.push(JSON.parse(options.body));
    return new Response(null, { status: 204 });
  }
  throw new Error(`Unexpected fetch: ${requestUrl}`);
};

function createRes() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

const req = {
  method: "POST",
  body: {
    applicationId: "order-123",
    email: "jan.novak@example.cz",
    password: "BezpecneHeslo123",
  },
};
const res = createRes();
await handler(req, res);

assert.equal(res.statusCode, 200);
assert.equal(res.body.ok, true);
assert.equal(savedRows.length, 1);
assert.equal(savedRows[0].id, "order-123");
assert.equal(savedRows[0].source, "onboarding");
assert.equal(savedRows[0].student_email, "jan.novak@example.cz");
assert.equal(savedRows[0].data.credentials.passwordSet, true);
assert.equal(savedRows[0].data.credentials.password, "");
assert.equal(verifyPassword("BezpecneHeslo123", savedRows[0].data.credentials), true);

const magicReq = {
  method: "POST",
  body: {
    magic: magicToken,
    password: "DruheBezpecneHeslo123",
  },
};
const magicRes = createRes();
await handler(magicReq, magicRes);

assert.equal(magicRes.statusCode, 200);
assert.equal(magicRes.body.ok, true);
assert.equal(savedRows.length, 2);
assert.equal(savedRows[1].source, "onboarding");
assert.equal(savedRows[1].student_email, "jan.novak@example.cz");
assert.equal(savedRows[1].data.credentials.passwordSet, true);
assert.equal(verifyPassword("DruheBezpecneHeslo123", savedRows[1].data.credentials), true);
assert.equal(usedMagicLinks.length, 1);
assert.ok(usedMagicLinks[0].used_at);

console.log("password setup endpoint ok");
