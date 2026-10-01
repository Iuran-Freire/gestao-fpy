import assert from "node:assert/strict";
const origin = "http://localhost:5173";
async function request(path, body, auth = true) {
  const r = await fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(auth ? { Cookie: "__sites_local_auth=1" } : {}),
      Origin: origin,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json() };
}
assert.equal((await request("/api/records", null, false)).status, 401);
const id = crypto.randomUUID(),
  op = crypto.randomUUID();
const entry = {
  id,
  kind: "production",
  date: "2026-09-12",
  shift: "3",
  line: "QA-" + id.slice(0, 8),
  pn: "QA-API",
  model: "Teste de integração",
  quantity: 100,
  code: "",
  description: "",
  position: "",
  station: "",
  category: "",
  author: "Untrusted client",
  createdAt: "",
  updatedAt: "",
  revision: 1,
};
const initial = { id: op, entry };
assert.equal((await request("/api/records", initial)).status, 200);
assert.equal((await request("/api/records", initial)).body.replayed, true);
assert.equal(
  (
    await request("/api/records", {
      id: crypto.randomUUID(),
      entry: { ...entry, id: crypto.randomUUID() },
    })
  ).status,
  409,
);
assert.equal(
  (await request("/api/records", { id: op, entry: { ...entry, quantity: 20 } }))
    .status,
  409,
);
assert.equal(
  (
    await request("/api/records", {
      id: crypto.randomUUID(),
      entry: { ...entry, id: crypto.randomUUID(), quantity: -1 },
    })
  ).status,
  400,
);
assert.equal(
  (
    await request("/api/records", {
      id: crypto.randomUUID(),
      entry: { ...entry, quantity: 120 },
      expectedRevision: 1,
      reason: "Conferência local",
    })
  ).status,
  200,
);
assert.equal(
  (
    await request("/api/records", {
      id: crypto.randomUUID(),
      entry: { ...entry, quantity: 150 },
      expectedRevision: 1,
      reason: "Conflito local",
    })
  ).status,
  409,
);
const history = await request("/api/history?id=" + id);
assert.equal(history.body.length, 1);
assert.equal(JSON.parse(history.body[0].before).quantity, 100);
assert.equal(JSON.parse(history.body[0].after).quantity, 120);
const read = await request("/api/records?year=2026");
const saved = read.body.records.find((e) => e.id === id);
assert.equal(saved.author, "Seedy");
assert.equal(saved.revision, 2);
assert.equal(saved.quantity, 120);
console.log(
  "PASS: autenticação, criação, idempotência, produção única, validação, correção, conflito, autoria e auditoria.",
);
