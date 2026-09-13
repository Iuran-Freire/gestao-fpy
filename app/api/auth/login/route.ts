import {
  checkOrigin,
  failure,
  HttpError,
  sessionCookie,
} from "@/src/application/access";
import { database } from "@/src/infrastructure/database";
import {
  verifyPassword,
  tokenHash,
  newToken,
} from "@/src/infrastructure/passwords";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const body = (await req.json()) as { login: string; password: string };
    if (
      typeof body.login !== "string" ||
      body.login.length > 254 ||
      typeof body.password !== "string" ||
      body.password.length > 128
    )
      throw new HttpError(400, "Informe usuário/e-mail e senha.");
    const login = body.login.trim().toLowerCase(),
      db = database(),
      now = Date.now();
    const keys = [
      "account:" + tokenHash(login),
      "ip:" + tokenHash(req.headers.get("cf-connecting-ip") || "local"),
    ];
    const attempts = await db.batch(
      keys.map((key) =>
        db
          .prepare(
            "INSERT INTO login_attempts(key,count,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN until<? THEN 1 ELSE count+1 END,until=CASE WHEN until<? THEN excluded.until ELSE until END RETURNING count",
          )
          .bind(key, now + 15 * 60 * 1000, now, now),
      ),
    );
    if (
      attempts.some(
        (r, i) =>
          Number((r.results[0] as { count: number })?.count) >
          (i === 0 ? 10 : 60),
      )
    )
      throw new HttpError(429, "Muitas tentativas. Aguarde 15 minutos.");
    const found = await db
      .prepare(
        "SELECT u.id,u.active,u.revision,c.hash FROM login_handles h JOIN users u ON u.id=h.user_id JOIN credentials c ON c.user_id=u.id WHERE h.handle=?",
      )
      .bind(login)
      .first<{ id: string; active: number; revision: number; hash: string }>();
    const dummy =
      "scrypt-16384-8-5$00000000000000000000000000000000$" + "00".repeat(32);
    const valid = verifyPassword(body.password, found?.hash || dummy);
    if (!found || !valid || found.active !== 1)
      throw new HttpError(401, "Usuário ou senha inválidos.");
    const token = newToken();
    await db.batch([
      db
        .prepare(
          "INSERT INTO sessions(token,user_id,expires,user_revision,credential_hash) VALUES(?,?,?,?,?)",
        )
        .bind(
          tokenHash(token),
          found.id,
          now + 43200000,
          found.revision,
          found.hash,
        ),
      db.prepare("DELETE FROM sessions WHERE expires<?").bind(now),
    ]);
    return Response.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": sessionCookie(req, token),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
