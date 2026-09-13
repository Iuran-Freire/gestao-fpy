import { database, bucket } from "@/src/infrastructure/database";
export async function createBackup() {
  const db = database(),
    b = bucket(),
    day = new Date().toISOString().slice(0, 10),
    marker = "backups/" + day + "/manifest.json";
  if (await b.head(marker)) return { date: day, existing: true };
  const run = crypto.randomUUID(),
    prefix = "backups/" + day + "/" + run + "/",
    files: string[] = [];
  const start = await db
    .prepare("SELECT MAX(rowid) AS n FROM operations")
    .first<{ n: number }>();
  for (const table of [
    "records",
    "users",
    "ownership",
    "operations",
    "audit",
  ]) {
    let cursor = 0,
      page = 0;
    while (true) {
      const result = await db
        .prepare(
          `SELECT rowid AS _rowid,* FROM ${table} WHERE rowid>? ORDER BY rowid LIMIT 500`,
        )
        .bind(cursor)
        .all();
      if (!result.results.length) break;
      const key = prefix + table + "-" + page++ + ".json";
      await b.put(key, JSON.stringify(result.results), {
        httpMetadata: { contentType: "application/json" },
      });
      files.push(key);
      cursor = Number(result.results.at(-1)!._rowid);
    }
  }
  const end = await db
    .prepare("SELECT MAX(rowid) AS n FROM operations")
    .first<{ n: number }>();
  if (start?.n !== end?.n) {
    await b.delete(files);
    throw Error("Novos lançamentos durante o backup. Tente novamente.");
  }
  await b.put(
    marker,
    JSON.stringify({
      version: 1,
      date: day,
      createdAt: new Date().toISOString(),
      files,
    }),
    { httpMetadata: { contentType: "application/json" } },
  );
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  let cursor: string | undefined;
  do {
    const list = await b.list({ prefix: "backups/", cursor });
    const expired = list.objects
      .filter((o) => o.key.slice(8, 18) < cutoff.toISOString().slice(0, 10))
      .map((o) => o.key);
    if (expired.length) await b.delete(expired);
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  return { date: day, existing: false };
}
