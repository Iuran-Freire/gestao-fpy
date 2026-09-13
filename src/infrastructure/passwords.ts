import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export function passwordHash(password: string) {
  if (
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 4096
  )
    throw Error("Informe uma senha.");
  const salt = randomBytes(16).toString("hex");
  return (
    "scrypt-16384-8-5$" +
    salt +
    "$" +
    scryptSync(password, salt, 32, {
      N: 16384,
      r: 8,
      p: 5,
      maxmem: 32 * 1024 * 1024,
    }).toString("hex")
  );
}
export function verifyPassword(password: string, stored: string) {
  if (
    typeof password !== "string" ||
    password.length < 1 ||
    password.length > 4096
  )
    return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt-16384-8-5" || !salt || !hash) return false;
  const value = scryptSync(password, salt, 32, {
    N: 16384,
    r: 8,
    p: 5,
    maxmem: 32 * 1024 * 1024,
  });
  const expected = Buffer.from(hash, "hex");
  return expected.length === value.length && timingSafeEqual(expected, value);
}
export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
