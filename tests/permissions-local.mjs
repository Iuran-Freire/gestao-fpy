import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const cli = [
  "--import",
  "./scripts/sites-env.mjs",
  "./node_modules/wrangler/bin/wrangler.js",
  "d1",
  "execute",
  "DB",
  "--local",
  "--config",
  "dist/server/wrangler.json",
  "--persist-to",
  ".wrangler/state",
];
function role(value) {
  const r = spawnSync(
    process.execPath,
    [
      ...cli,
      "--command",
      "UPDATE users SET revision=revision+1,role='" + value + "' WHERE id='local_seedy'",
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw Error(r.stderr);
}
try {
  role("operador");
  const records = await (
    await fetch("http://localhost:5173/api/records?year=2026", {
      headers: { Cookie: "__sites_local_auth=1" },
    })
  ).json();
  const entry = records.records.find((e) => e.pn === "QA-API");
  assert.ok(entry);
  const response = await fetch("http://localhost:5173/api/records", {
    method: "POST",
    headers: {
      Cookie: "__sites_local_auth=1",
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      entry: { ...entry, quantity: 999 },
      expectedRevision: entry.revision,
      reason: "Teste de bloqueio",
    }),
  });
  assert.equal(response.status, 403);
  console.log("PASS: servidor impede correção pelo operador.");
} finally {
  role("supervisor");
}
