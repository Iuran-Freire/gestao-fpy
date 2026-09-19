import {
  currentUser,
  failure,
  checkOrigin,
  HttpError,
  sessionCookie,
} from "@/src/backend/application/access";
import { accountAudit } from "@/src/backend/application/users";
import { database } from "@/src/backend/infrastructure/database";
import {
  passwordHash,
  verifyPassword,
  newToken,
  tokenHash,
} from "@/src/backend/infrastructure/passwords";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await currentUser(true),
      db = database();
    const body = (await req.json()) as {
      password: string;
      currentPassword: string;
    };
    const old = await db
      .prepare("SELECT hash FROM credentials WHERE user_id=?")
      .bind(user.id)
      .first<{ hash: string }>();
    if (old && !verifyPassword(body.currentPassword, old.hash))
      throw new HttpError(400, "Senha atual incorreta.");
    if (!user.username)
      throw new HttpError(
        400,
        "Edite seu perfil e defina um nome de usuário antes de cadastrar a senha.",
      );
    let hash: string;
    try {
      hash = passwordHash(body.password);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    if (old && verifyPassword(body.password, old.hash))
      throw new HttpError(400, "Escolha uma senha diferente da atual.");
    const token = newToken();
    await db.batch([
      db
        .prepare(
          "INSERT INTO credentials(user_id,hash,must_change) VALUES(?,?,0) ON CONFLICT(user_id) DO UPDATE SET hash=excluded.hash,must_change=0",
        )
        .bind(user.id, hash),
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id),
      db
        .prepare(
          "INSERT INTO sessions(token,user_id,expires,user_revision,credential_hash) VALUES(?,?,?,?,?)",
        )
        .bind(
          tokenHash(token),
          user.id,
          Date.now() + 43200000,
          user.revision,
          hash,
        ),
      accountAudit(user.id, user.id, "password_changed", null, null),
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
