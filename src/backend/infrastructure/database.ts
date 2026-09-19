import { env } from "cloudflare:workers";
export function database(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw Error("Banco indisponível.");
  return db;
}
export function bucket(): R2Bucket {
  const b = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
  if (!b) throw Error("Backup indisponível.");
  return b;
}

export function bucketAvailable() {
  return !!(env as unknown as { BUCKET?: R2Bucket }).BUCKET;
}
