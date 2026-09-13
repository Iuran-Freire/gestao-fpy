import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
const options = {
  headers: { Cookie: "__sites_local_auth=1", Origin: "http://localhost:5173" },
};
const response = await fetch("http://localhost:5173/api/backups", {
  ...options,
  method: "POST",
});
const result = await response.json();
assert.equal(response.status, 200, JSON.stringify(result));
const archive = await fetch(
  "http://localhost:5173/api/backups?date=" + result.date,
  options,
);
assert.equal(archive.status, 200);
const lines = (await archive.text())
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
assert.equal(lines[0].type, "manifest");
const restored = new DatabaseSync(":memory:");
for (const file of readdirSync("drizzle")
  .filter((f) => f.endsWith(".sql"))
  .sort())
  restored.exec(readFileSync("drizzle/" + file, "utf8"));
let count = 0;
for (const { table, row } of lines.slice(1)) {
  assert.ok(
    [
      "users",
      "ownership",
      "records",
      "operations",
      "audit",
      "credentials",
      "login_handles",
      "user_audit",
    ].includes(table),
  );
  const keys = Object.keys(row).filter((k) => k !== "_rowid");
  restored
    .prepare(
      `INSERT INTO ${table} (${keys.map((k) => '"' + k + '"').join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
    )
    .run(...keys.map((k) => row[k]));
  count++;
}
assert.ok(count > 0);
assert.ok(restored.prepare("SELECT COUNT(*) AS n FROM records").get().n > 0);
assert.ok(
  restored.prepare("SELECT COUNT(*) AS n FROM credentials").get().n > 0,
);
console.log(
  "PASS: backup R2, download e restauração em SQLite isolado (" +
    count +
    " linhas).",
);
